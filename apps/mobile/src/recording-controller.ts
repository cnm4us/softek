import {
  CaptureLoop,
  captureClock,
  type CapturedFile,
  type Frame,
  type Clock,
} from './capture-loop';
import { destination } from './navigation';

type StopReason =
  | 'Stopped'
  | 'Backgrounded'
  | 'Navigation'
  | 'Signed out'
  | 'Capture failed'
  | 'Upload failed'
  | 'Duration limit'
  | 'Closed';
type Reply = { ok: boolean; status: number };
type Session = {
  id: string;
  credential: string;
  generation: number;
  started: number;
  queue: Frame[];
  bytes: number;
  uploaded: number;
  stopping: boolean;
  abort: AbortController;
  pumping: Promise<void> | null;
  heartbeat: ReturnType<typeof setInterval> | null;
  failed: boolean;
};
export type RecordingPorts = {
  capture: () => Promise<CapturedFile>;
  inject: (script: string) => void;
  request: (
    session: { id: string; credential: string },
    endpoint: 'frames' | 'heartbeat' | 'stop',
    body: Frame | Record<string, unknown>,
    signal: AbortSignal,
  ) => Promise<Reply>;
};
const uuid = () =>
  'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
const validId = (id: unknown): id is string =>
  typeof id === 'string' &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
    id,
  );
const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class RecordingController {
  documentId = uuid();
  private ready = false;
  private allowed = false;
  private foreground = true;
  private generation = 0;
  private session: Session | null = null;
  private probes = new Map<
    string,
    {
      resolve: (r: boolean) => void;
      timer: ReturnType<typeof setTimeout>;
      generation: number;
    }
  >();
  private loop: CaptureLoop;
  constructor(
    private ports: RecordingPorts,
    private clock: Clock = captureClock,
  ) {
    this.loop = new CaptureLoop(
      {
        eligible: () => this.ready && this.allowed && this.foreground,
        capture: async () => {
          const s = this.session;
          if (!s || !(await this.probe(s.generation)))
            throw new Error('Capture not eligible');
          const file = await this.ports.capture();
          if (this.session !== s || !(await this.probe(s.generation))) {
            file.dispose();
            throw new Error('Capture eligibility changed');
          }
          return file;
        },
        frame: (frame) => this.enqueue(frame),
        stopped: (reason) =>
          void this.stop(
            reason === 'Duration limit reached'
              ? 'Duration limit'
              : 'Capture failed',
          ),
      },
      this.clock,
    );
  }
  // Injected after main-document load, using a new native-owned document ID.
  bootstrap() {
    return `(function(){if(window.top!==window||location.origin!=='https://demo.bawebtech.com')return;
      const id=${JSON.stringify(this.documentId)};
      Object.defineProperty(window,'__softekCapture',{configurable:true,value:Object.freeze({version:1,documentId:id,
        send:function(message){if(window.top===window)window.ReactNativeWebView.postMessage(JSON.stringify({...message,protocol:'softek-capture-v1',documentId:id}));},
        receive:function(message){if(message.documentId===id)window.dispatchEvent(new CustomEvent('softek-capture-native',{detail:message}));}
      })});window.dispatchEvent(new Event('softek-capture-ready'));window.__softekCapture.send({type:'hello'});
    })();true;`;
  }
  navigate() {
    this.ready = false;
    this.allowed = false;
    void this.stop('Navigation');
    this.documentId = uuid();
    for (const pending of this.probes.values()) {
      clearTimeout(pending.timer);
      pending.resolve(false);
    }
    this.probes.clear();
  }
  route(url: string) {
    if (destination(url) !== 'internal') {
      this.allowed = false;
      void this.stop('Navigation');
      return;
    }
    const path = new URL(url).pathname;
    if (
      path === '/login' ||
      path === '/controls' ||
      path.startsWith('/controls/')
    ) {
      this.allowed = false;
      void this.stop('Navigation');
    }
  }
  appState(active: boolean) {
    this.foreground = active;
    if (!active) {
      this.allowed = false;
      void this.stop('Backgrounded');
    }
  }
  dispose() {
    this.foreground = false;
    this.navigate();
  }
  receive(sourceUrl: string, raw: string) {
    if (destination(sourceUrl) !== 'internal' || raw.length > 4096) return;
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(raw);
    } catch {
      return;
    }
    if (
      !m ||
      m.protocol !== 'softek-capture-v1' ||
      m.documentId !== this.documentId
    )
      return;
    if (m.type === 'hello') {
      this.ready = true;
      this.status();
      return;
    }
    if (!this.ready) return;
    if (
      m.type === 'eligibility' &&
      typeof m.allowed === 'boolean' &&
      Number.isInteger(m.generation)
    ) {
      this.allowed = m.allowed;
      this.generation = Number(m.generation);
      if (
        !m.allowed ||
        (this.session && this.session.generation !== this.generation)
      )
        void this.stop('Navigation');
    } else if (m.type === 'probe' && typeof m.requestId === 'string') {
      const pending = this.probes.get(m.requestId);
      if (!pending) return;
      clearTimeout(pending.timer);
      this.probes.delete(m.requestId);
      pending.resolve(
        m.allowed === true &&
          m.generation === pending.generation &&
          this.foreground &&
          this.allowed,
      );
    } else if (
      m.type === 'start' &&
      validId(m.recordingId) &&
      typeof m.credential === 'string' &&
      /^[a-f0-9]{64}$/.test(m.credential) &&
      m.generation === this.generation
    ) {
      if (this.session || !this.allowed || !this.foreground) {
        this.status('error', 'Recording cannot start right now.');
        return;
      }
      this.start(m.recordingId, m.credential, this.generation);
    } else if (m.type === 'stop') {
      void this.stop(m.reason === 'Signed out' ? 'Signed out' : 'Stopped');
    }
  }
  private send(message: Record<string, unknown>) {
    this.ports.inject(
      `window.__softekCapture?.receive(${JSON.stringify({ ...message, documentId: this.documentId })});true;`,
    );
  }
  private status(phase?: string, error = '') {
    const s = this.session;
    this.send({
      type: 'status',
      phase:
        phase ?? (s ? (s.stopping ? 'uploading' : 'recording') : 'stopped'),
      uploaded: s?.uploaded ?? 0,
      error,
    });
  }
  private probe(generation: number) {
    if (
      !this.ready ||
      !this.allowed ||
      !this.foreground ||
      generation !== this.generation
    )
      return Promise.resolve(false);
    const requestId = uuid();
    return new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.probes.delete(requestId);
        resolve(false);
      }, 400);
      this.probes.set(requestId, { resolve, timer, generation });
      this.send({ type: 'probe', requestId });
    });
  }
  private start(id: string, credential: string, generation: number) {
    const s: Session = {
      id,
      credential,
      generation,
      started: this.clock.now(),
      queue: [],
      bytes: 0,
      uploaded: 0,
      stopping: false,
      abort: new AbortController(),
      pumping: null,
      heartbeat: null,
      failed: false,
    };
    this.session = s;
    s.heartbeat = setInterval(() => {
      if (s.stopping) return;
      void this.ports
        .request(s, 'heartbeat', {}, s.abort.signal)
        .then((r) => {
          if (!r.ok) void this.stop('Upload failed');
        })
        .catch(() => {
          void this.stop('Upload failed');
        });
    }, 10_000);
    this.loop.start();
    this.status('recording');
  }
  private enqueue(frame: Frame) {
    const s = this.session;
    if (!s || s.stopping) {
      frame.dispose();
      return;
    }
    if (s.queue.length >= 10 || s.bytes + frame.bytes > 10 * 1_048_576) {
      frame.dispose();
      void this.stop('Upload failed');
      return;
    }
    s.queue.push(frame);
    s.bytes += frame.bytes;
    if (!s.pumping) {
      s.pumping = this.pump(s).finally(() => {
        s.pumping = null;
      });
    }
  }
  private async pump(s: Session) {
    while (s.queue.length && !s.abort.signal.aborted) {
      const frame = s.queue[0]!;
      let accepted = false;
      for (let attempt = 0; attempt < 3 && !s.abort.signal.aborted; attempt++) {
        try {
          const result = await this.ports.request(
            s,
            'frames',
            frame,
            s.abort.signal,
          );
          if (result.ok) {
            accepted = true;
            break;
          }
          if (![429, 500, 502, 503, 504].includes(result.status)) break;
        } catch {
          /* Bounded retries only, no raw network/credential logging. */
        }
        if (attempt < 2) await wait(1000 * 2 ** attempt);
      }
      if (s.abort.signal.aborted) break;
      s.queue.shift();
      s.bytes -= frame.bytes;
      frame.dispose();
      if (accepted) {
        s.uploaded++;
        if (this.session === s) this.status();
      } else {
        s.failed = true;
        void this.stop('Upload failed');
        break;
      }
    }
  }
  async stop(reason: StopReason = 'Stopped') {
    const s = this.session;
    if (!s || s.stopping) return;
    s.stopping = true;
    const elapsedMs = Math.min(
      901_000,
      Math.max(0, Math.round(this.clock.now() - s.started)),
    );
    const slots = Math.min(900, Math.floor(elapsedMs / 1000));
    const body = { elapsedMs, slots, reason };
    this.loop.stop();
    if (s.heartbeat) clearInterval(s.heartbeat);
    this.status('uploading');
    let drainTimer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        (async () => {
          await this.ports.request(
            s,
            'stop',
            { ...body, phase: 'drain' },
            s.abort.signal,
          );
          await s.pumping;
        })(),
        new Promise<void>((resolve) => {
          drainTimer = setTimeout(() => {
            s.abort.abort();
            resolve();
          }, 30_000);
        }),
      ]);
    } catch {
      /* Server inactivity expiry handles unreachable stop requests. */
    } finally {
      if (drainTimer) clearTimeout(drainTimer);
    }
    s.abort.abort();
    for (const frame of s.queue.splice(0)) frame.dispose();
    s.bytes = 0;
    const final = new AbortController(),
      timer = setTimeout(() => final.abort(), 8000);
    let finalized = false;
    try {
      finalized = (
        await this.ports.request(
          s,
          'stop',
          { ...body, phase: 'finish' },
          final.signal,
        )
      ).ok;
    } catch {
      /* Interrupted state is reconciled by receiver cleanup. */
    } finally {
      clearTimeout(timer);
    }
    if (this.session === s) {
      this.status(
        finalized &&
          !s.failed &&
          !['Upload failed', 'Capture failed'].includes(reason)
          ? 'stopped'
          : 'error',
        finalized
          ? s.failed ||
            reason === 'Upload failed' ||
            reason === 'Capture failed'
            ? 'Some screenshots failed. Missing frames remain visible in review.'
            : ''
          : 'Upload completion could not be confirmed. Received screenshots remain available for review.',
      );
      this.session = null;
    }
    s.credential = '';
  }
}
