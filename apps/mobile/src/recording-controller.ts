import {
  CaptureLoop,
  captureClock,
  type CapturedFile,
  type Frame,
  type Clock,
} from './capture-loop';
import { destination } from './navigation';
import { pageGeometry, type PageGeometry } from './page-context';
import {
  ChangeCaptureLoop,
  geometry,
  type Geometry,
  type Interaction,
  type CaptureReason,
} from './change-capture';

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
  policy: 'periodic-v1' | 'changes-v2';
  captureMethod: 'view-v1' | 'window-crop-v1';
  pageContext: boolean;
  page: PageGeometry | null;
  offset: number | null;
  uncertainty: number;
  geometry: Geometry | null;
  clockRequest?: {
    id: string;
    sent: number;
    timer: ReturnType<typeof setTimeout>;
  };
  events: Interaction[];
  eventBytes: number;
  eventSequence: number;
  lostEvents: number;
  eventsReady: boolean;
  eventTimer: ReturnType<typeof setTimeout> | null;
};
export type RecordingPorts = {
  pageContext?: boolean;
  capture: () => Promise<CapturedFile>;
  windowCapture?: () => Promise<CapturedFile>;
  inject: (script: string) => void;
  request: (
    session: { id: string; credential: string },
    endpoint: 'frames' | 'heartbeat' | 'stop' | 'events',
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
  private changes: ChangeCaptureLoop;
  constructor(
    private ports: RecordingPorts,
    private clock: Clock = captureClock,
  ) {
    this.loop = new CaptureLoop(
      {
        eligible: () => this.ready && this.allowed && this.foreground,
        capture: () => this.capture(),
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
    this.changes = new ChangeCaptureLoop(
      {
        settleMs: (reason) =>
          this.session?.captureMethod === 'window-crop-v1' && reason === 'error'
            ? 350
            : 100,
        eligible: () => this.ready && this.allowed && this.foreground,
        capture: (reason) => this.capture(reason),
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
  private async capture(reason?: CaptureReason) {
    const s = this.session;
    if (
      !s ||
      s.stopping ||
      this.session !== s ||
      !(await this.probe(s.generation))
    )
      throw new Error('Capture not eligible');
    const before = s.geometry;
    const beforePage = s.page;
    if (reason && !before) throw new Error('Missing viewport geometry');
    if (s.pageContext && !beforePage)
      throw new Error('Missing page reference geometry');
    const file = await (s.captureMethod === 'window-crop-v1'
      ? this.ports.windowCapture!()
      : this.ports.capture());
    if (s.captureMethod === 'window-crop-v1' && !file.surface) {
      file.dispose();
      throw new Error('Missing native capture provenance');
    }
    if (s.pageContext && !file.imageBounds) {
      file.dispose();
      throw new Error('Missing page reference bounds');
    }
    if (this.session !== s || !(await this.probe(s.generation))) {
      file.dispose();
      throw new Error('Capture eligibility changed');
    }
    if (reason && before)
      file.context = {
        reason,
        geometry: before,
        uncertaintyMs: Math.min(
          1000,
          Math.ceil(s.uncertainty + (file.captureMs ?? 100)),
        ),
        unstable:
          JSON.stringify(before) !== JSON.stringify(s.geometry) ||
          (s.pageContext &&
            JSON.stringify(beforePage) !== JSON.stringify(s.page)),
        ...(file.surface ? { surface: file.surface } : {}),
        ...(s.pageContext && beforePage && file.imageBounds
          ? {
              page: {
                version: 1 as const,
                web: beforePage,
                image: file.imageBounds,
              },
            }
          : {}),
      };
    return file;
  }
  // Injected after main-document load, using a new native-owned document ID.
  bootstrap() {
    return `(function(){if(window.top!==window||location.origin!=='https://demo.bawebtech.com')return;
      const id=${JSON.stringify(this.documentId)};
      Object.defineProperty(window,'__softekCapture',{configurable:true,value:Object.freeze({version:1,capabilities:${JSON.stringify(['changes-v2', ...(this.ports.windowCapture ? ['window-crop-v1'] : []), ...(this.ports.windowCapture && this.ports.pageContext ? ['page-context-v1'] : [])])},documentId:id,
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
      if (
        this.session &&
        m.generation === this.session.generation &&
        geometry(m.geometry)
      )
        this.session.geometry = geometry(m.geometry);
      if (this.session?.pageContext) {
        this.session.page = pageGeometry(m.page);
        if (!this.session.page) {
          pending.resolve(false);
          return;
        }
      }
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
      if (
        (m.captureMethod !== undefined &&
          !['view-v1', 'window-crop-v1'].includes(String(m.captureMethod))) ||
        (m.captureMethod === 'window-crop-v1' &&
          (!this.ports.windowCapture || m.policy !== 'changes-v2')) ||
        (m.pageContextVersion !== undefined &&
          (m.pageContextVersion !== 1 ||
            !this.ports.pageContext ||
            m.captureMethod !== 'window-crop-v1'))
      ) {
        this.status('error', 'This capture method is unavailable.');
        return;
      }
      this.start(
        m.recordingId,
        m.credential,
        this.generation,
        m.policy === 'changes-v2' ? 'changes-v2' : 'periodic-v1',
        m.captureMethod === 'window-crop-v1' ? 'window-crop-v1' : 'view-v1',
        m.pageContextVersion === 1,
      );
    } else if (m.type === 'clock-reply') {
      const s = this.session;
      if (
        !s ||
        s.stopping ||
        s.policy !== 'changes-v2' ||
        !s.clockRequest ||
        m.requestId !== s.clockRequest.id ||
        m.generation !== s.generation ||
        typeof m.webNow !== 'number' ||
        !Number.isFinite(m.webNow) ||
        !geometry(m.geometry)
      )
        return;
      const now = this.clock.now();
      s.offset = (s.clockRequest.sent + now) / 2 - m.webNow;
      s.uncertainty = Math.ceil((now - s.clockRequest.sent) / 2);
      s.geometry = geometry(m.geometry);
      if (s.pageContext) {
        s.page = pageGeometry(m.page);
        if (!s.page) {
          void this.stop('Capture failed');
          return;
        }
      }
      clearTimeout(s.clockRequest.timer);
      s.clockRequest = undefined;
      this.send({ type: 'observe', active: true });
      this.changes.start(s.started);
      this.status('recording');
    } else if (m.type === 'interaction') {
      this.interaction(m);
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
  private start(
    id: string,
    credential: string,
    generation: number,
    policy: 'periodic-v1' | 'changes-v2',
    captureMethod: 'view-v1' | 'window-crop-v1',
    pageContext = false,
  ) {
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
      policy,
      captureMethod,
      pageContext,
      page: null,
      offset: null,
      uncertainty: 0,
      geometry: null,
      events: [],
      eventBytes: 0,
      eventSequence: 0,
      lostEvents: 0,
      eventsReady: false,
      eventTimer: null,
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
    if (policy === 'periodic-v1') {
      this.loop.start();
      this.status('recording');
    } else {
      const requestId = uuid();
      s.clockRequest = {
        id: requestId,
        sent: this.clock.now(),
        timer: setTimeout(() => void this.stop('Capture failed'), 1000),
      };
      this.send({ type: 'clock', requestId });
    }
  }
  private interaction(m: Record<string, unknown>) {
    const s = this.session,
      g = geometry(m.geometry);
    if (
      !s ||
      s.stopping ||
      s.policy !== 'changes-v2' ||
      s.offset === null ||
      !this.allowed ||
      !this.foreground ||
      m.generation !== s.generation ||
      !g ||
      typeof m.webNow !== 'number' ||
      !Number.isFinite(m.webNow)
    )
      return;
    const kinds = [
      'tap',
      'swipe',
      'scroll',
      'viewport',
      'route',
      'ui',
      'error',
      'content',
    ] as const;
    if (!kinds.includes(m.kind as (typeof kinds)[number])) return;
    const elapsedMs = Math.round(m.webNow + s.offset - s.started);
    if (
      elapsedMs < -s.uncertainty ||
      elapsedMs > this.clock.now() - s.started + 1000 ||
      elapsedMs > 900000
    )
      return;
    const event: Interaction = {
      sequence: ++s.eventSequence,
      elapsedMs: Math.max(0, elapsedMs),
      kind: m.kind as Interaction['kind'],
      geometry: g,
      uncertaintyMs: s.uncertainty,
    };
    if (event.kind === 'tap' || event.kind === 'swipe') {
      for (const key of [
        'x',
        'y',
        ...(event.kind === 'swipe' ? ['endX', 'endY'] : []),
      ] as const) {
        const v = m[key];
        if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
          s.eventSequence--;
          return;
        }
        (event as unknown as Record<string, unknown>)[key] = v;
      }
      if (event.kind === 'swipe') {
        if (
          typeof m.durationMs !== 'number' ||
          !Number.isInteger(m.durationMs) ||
          m.durationMs < 0 ||
          m.durationMs > 60000
        ) {
          s.eventSequence--;
          return;
        }
        event.durationMs = m.durationMs;
      }
    }
    const length = JSON.stringify(event).length;
    if (
      s.eventSequence > 12000 ||
      s.events.length >= 500 ||
      s.eventBytes + length > 256 * 1024
    ) {
      s.lostEvents++;
      s.eventSequence = Math.min(12000, s.eventSequence);
      void this.stop('Upload failed');
      return;
    }
    s.events.push(event);
    s.eventBytes += length;
    if (s.captureMethod === 'window-crop-v1' && event.kind === 'tap')
      this.changes.request('ui');
    if (m.capture === true && event.kind !== 'tap' && event.kind !== 'swipe')
      this.changes.request(event.kind);
    if (!s.eventTimer)
      s.eventTimer = setTimeout(() => {
        s.eventTimer = null;
        s.eventsReady = true;
        this.kick(s);
      }, 1000);
  }
  private kick(s: Session) {
    if (s.pumping || s.failed || s.abort.signal.aborted) return;
    s.pumping = this.pump(s).finally(() => {
      s.pumping = null;
      if (
        !s.failed &&
        !s.abort.signal.aborted &&
        (s.queue.length || (s.events.length && s.eventsReady))
      )
        this.kick(s);
    });
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
    this.kick(s);
  }
  private async pump(s: Session) {
    while (
      (s.queue.length || (s.eventsReady && s.events.length)) &&
      !s.abort.signal.aborted
    ) {
      const frame = s.queue[0]!;
      const events: Interaction[] = [];
      const batchId = uuid();
      if (!frame)
        for (const event of s.events.slice(0, 30)) {
          if (
            JSON.stringify({ requestId: batchId, events: [...events, event] })
              .length >
            12 * 1024
          )
            break;
          events.push(event);
        }
      const batch = events.length ? { requestId: batchId, events } : null;
      let accepted = false;
      for (let attempt = 0; attempt < 3 && !s.abort.signal.aborted; attempt++) {
        try {
          const result = await this.ports.request(
            s,
            frame ? 'frames' : 'events',
            frame ?? batch!,
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
      if (frame) {
        s.queue.shift();
        s.bytes -= frame.bytes;
        frame.dispose();
      } else {
        s.events.splice(0, events.length);
        s.eventBytes -= events.reduce(
          (n, e) => n + JSON.stringify(e).length,
          0,
        );
        if (!accepted) s.lostEvents += events.length;
        if (!s.stopping) s.eventsReady = false;
      }
      if (accepted) {
        if (frame) s.uploaded++;
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
    if (s.clockRequest) clearTimeout(s.clockRequest.timer);
    if (s.eventTimer) clearTimeout(s.eventTimer);
    s.eventTimer = null;
    this.send({ type: 'observe', active: false });
    s.eventsReady = true;
    const elapsedMs = Math.min(
      901_000,
      Math.max(0, Math.round(this.clock.now() - s.started)),
    );
    const slots =
      s.policy === 'changes-v2'
        ? this.changes.attempted
        : Math.min(900, Math.floor(elapsedMs / 1000));
    const body = {
      elapsedMs,
      slots,
      reason,
      ...(s.policy === 'changes-v2'
        ? {
            events: s.eventSequence,
            lostEvents: s.lostEvents,
            coalesced: this.changes.coalesced,
          }
        : {}),
    };
    this.loop.stop();
    this.changes.stop();
    this.kick(s);
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
    s.lostEvents += s.events.length;
    s.events = [];
    s.eventBytes = 0;
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
