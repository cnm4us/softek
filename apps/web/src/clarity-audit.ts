import { api, ApiError, type State } from './api';
import { invokeClarity } from './clarity-call';
import { safeCall, type TraceCall } from '../../api/src/clarity-trace-contract';
import { isAdminRoute } from './routes';
type Capture = {
  state: State;
  documentId: string;
  contextId: string | null;
  metadata: Record<string, string>;
  sequence: number;
  queue: TraceCall[];
  terminal: TraceCall[];
  dropped: number;
  failures: number;
  closing: boolean;
  busy: boolean;
  openAttempts: number;
  expires: number;
};
let current: Capture | null = null;
let timer: ReturnType<typeof setTimeout> | null = null;
const buildReady = () =>
  import.meta.env?.VITE_PHOENIX_TRACING_ENABLED === 'true';
function schedule(delay = 1000) {
  if (timer) return;
  timer = setTimeout(() => {
    timer = null;
    void flushAudit();
  }, delay);
}
export function syncAudit(state: State, metadata: Record<string, string>) {
  const eligible =
    buildReady() &&
    state.analytics.enabled &&
    state.analytics.tracing?.enabled &&
    !state.impersonation &&
    !isAdminRoute(location.pathname);
  if (!eligible) {
    closeAudit();
    return;
  }
  if (
    current &&
    (current.state.user.id !== state.user.id ||
      current.state.runId !== state.runId ||
      current.state.visitId !== state.visitId ||
      current.state.analytics.revision !== state.analytics.revision ||
      current.state.analytics.tracing?.revision !==
        state.analytics.tracing?.revision)
  )
    closeAudit();
  if (current?.closing) current = null;
  if (!current)
    current = {
      state,
      documentId: crypto.randomUUID(),
      contextId: null,
      metadata,
      sequence: 0,
      queue: [],
      terminal: [],
      dropped: 0,
      failures: 0,
      closing: false,
      busy: false,
      openAttempts: 0,
      expires: Date.now() + 12 * 60 * 60 * 1000,
    };
  current.state = state;
  current.metadata = { ...metadata };
  schedule();
}
export function Demo(command: string, ...args: any[]) {
  const x = current;
  // Avoid even serializing argument values when tracing is unavailable.
  if (!x) return window.clarity?.apply(window, [command, ...args]);
  return invokeClarity(
    window,
    command,
    args,
    (snapshot) => {
      x.sequence++;
      if (!safeCall(command, snapshot.args)) {
        x.dropped++;
        schedule();
        return;
      }
      const v: TraceCall = {
        ...snapshot,
        id: crypto.randomUUID(),
        sequence: x.sequence,
        command: command as TraceCall['command'],
        observedAt: new Date().toISOString(),
        metadata: { ...x.metadata },
      };
      if (x.closing) {
        const terminal =
          command === 'stop' ||
          (command === 'consentv2' &&
            (args[0] as any)?.analytics_Storage === 'denied');
        if (terminal && x.terminal.length < 2) x.terminal.push(v);
        else x.dropped++;
      } else {
        if (x.queue.length >= 250) {
          x.queue.shift();
          x.dropped++;
        }
        x.queue.push(v);
      }
      schedule();
    },
    () => {
      x.sequence++;
      x.dropped++;
      schedule();
    },
  );
}
export function beginAuditClose() {
  if (current) {
    current.closing = true;
    current.dropped += current.queue.length;
    current.queue = [];
  }
}
export function closeAudit() {
  beginAuditClose();
  void flushAudit(true);
}
export async function flushAudit(keepalive = false) {
  const x = current;
  if (!x || x.busy) return;
  if (Date.now() > x.expires && !x.closing) {
    x.dropped += x.queue.length;
    x.queue = [];
    current = null;
    return;
  }
  x.busy = true;
  try {
    if (!x.contextId) {
      if (x.closing || ++x.openAttempts > 5) {
        if (current === x) current = null;
        return;
      }
      const result = await api<{ contextId: string }>(
        '/analytics/trace-session',
        {
          documentId: x.documentId,
          visitId: x.state.visitId,
          collectionRevision: x.state.analytics.revision,
          tracingRevision: x.state.analytics.tracing!.revision,
          consent: 'granted',
        },
        x.state.csrf,
        { keepalive, timeoutMs: 5000 },
      );
      x.contextId = result.contextId;
    }
    const source = x.closing ? x.terminal : x.queue;
    // Bound encoded bytes, not just call count (Express limit is 16 KiB).
    const batch: TraceCall[] = [];
    for (const v of source.slice(0, 20)) {
      if (
        new TextEncoder().encode(
          JSON.stringify({ ...body([]), calls: [...batch, v] }),
        ).byteLength >=
        12 * 1024
      )
        break;
      batch.push(v);
    }
    function body(calls: TraceCall[]) {
      return {
        contextId: x!.contextId,
        calls,
        close: x!.closing,
        droppedCalls: x!.dropped,
        failedBatches: x!.failures,
      };
    }
    const sentClose = x.closing;
    await api('/analytics/clarity-calls', body(batch), x.state.csrf, {
      keepalive,
      timeoutMs: 5000,
    });
    for (const v of batch) {
      const index = source.findIndex((q) => q.id === v.id);
      if (index >= 0) source.splice(index, 1);
    }
    if (sentClose && current === x) current = null;
    if (!x.closing && x.queue.length) schedule(0);
  } catch (e) {
    x.failures++;
    if (e instanceof ApiError && e.status < 500 && e.status !== 429) {
      x.dropped += x.queue.length;
      if (current === x) current = null;
    } else if (x.failures < 10) schedule();
    else {
      if (current === x) current = null;
    }
  } finally {
    x.busy = false;
    if (x.closing && current === x) schedule();
  }
}
window.addEventListener('pagehide', () => void flushAudit(true));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') void flushAudit(true);
});
