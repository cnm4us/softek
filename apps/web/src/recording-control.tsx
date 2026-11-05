import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Circle, Square, X } from 'lucide-react';
import { api, ApiError, type State } from './api';
import { Alert } from './ui';

type Adapter = {
  version: 1;
  documentId: string;
  send: (message: Record<string, unknown>) => void;
};
const adapter = () =>
  (window as Window & { __softekCapture?: Adapter }).__softekCapture;
let policy = { allowed: false, identity: '', generation: 0 };
function publish() {
  adapter()?.send({
    type: 'eligibility',
    allowed: policy.allowed,
    generation: policy.generation,
  });
}
export function suspendRecording() {
  policy = { ...policy, allowed: false, generation: policy.generation + 1 };
  publish();
  adapter()?.send({ type: 'stop', reason: 'Signed out' });
}
export function RecordingControl({
  state,
  enabled,
}: {
  state: State | null;
  enabled: boolean;
}) {
  const [capable, setCapable] = useState(adapter()?.version === 1),
    [open, setOpen] = useState(false),
    [phase, setPhase] = useState('stopped'),
    [count, setCount] = useState(0),
    [error, setError] = useState(''),
    [starting, setStarting] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    button = useRef<HTMLButtonElement>(null);
  const pendingRequest = useRef<{
    id: string;
    identity: string;
    documentId: string;
  } | null>(null);
  const allowed = Boolean(state && !state.impersonation && enabled);
  const identity = allowed ? `${state!.user.id}:${state!.runId}` : '';
  useLayoutEffect(() => {
    policy = { allowed, identity, generation: policy.generation + 1 };
    publish();
    return () => {
      policy = {
        allowed: false,
        identity: '',
        generation: policy.generation + 1,
      };
      publish();
    };
  }, [allowed, identity]);
  useEffect(() => {
    const ready = () => {
      setCapable(adapter()?.version === 1);
      publish();
    };
    const suspend = () => suspendRecording();
    const native = (event: Event) => {
      const message = (event as CustomEvent).detail;
      if (!message || message.documentId !== adapter()?.documentId) return;
      if (message.type === 'probe') {
        adapter()?.send({
          type: 'probe',
          requestId: message.requestId,
          generation: policy.generation,
          allowed:
            policy.allowed &&
            document.visibilityState === 'visible' &&
            window.top === window &&
            !location.pathname.startsWith('/controls') &&
            location.pathname !== '/login',
        });
      } else if (
        message.type === 'status' &&
        ['recording', 'uploading', 'stopped', 'error'].includes(message.phase)
      ) {
        setStarting(false);
        setPhase(message.phase);
        if (Number.isInteger(message.uploaded)) setCount(message.uploaded);
        setError(typeof message.error === 'string' ? message.error : '');
      }
    };
    window.addEventListener('softek-capture-ready', ready);
    window.addEventListener('softek-capture-native', native);
    window.addEventListener('customer-session-changing', suspend);
    window.addEventListener('softek-capture-suspend', suspend);
    window.addEventListener('pagehide', suspend);
    return () => {
      window.removeEventListener('softek-capture-ready', ready);
      window.removeEventListener('softek-capture-native', native);
      window.removeEventListener('customer-session-changing', suspend);
      window.removeEventListener('softek-capture-suspend', suspend);
      window.removeEventListener('pagehide', suspend);
    };
  }, []);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [open]);
  async function record() {
    if (!state || !allowed || !adapter()) return;
    setStarting(true);
    setError('');
    setCount(0);
    policy = { allowed: true, identity, generation: policy.generation + 1 };
    publish();
    const generation = policy.generation,
      documentId = adapter()!.documentId;
    if (
      !pendingRequest.current ||
      pendingRequest.current.identity !== identity ||
      pendingRequest.current.documentId !== documentId
    )
      pendingRequest.current = {
        id: crypto.randomUUID(),
        identity,
        documentId,
      };
    try {
      const session = await api<{ id: string; credential: string }>(
        '/recordings',
        {
          requestId: pendingRequest.current.id,
          documentId,
          approvalVersion: 'screenshots-v1',
        },
        state.csrf,
        { timeoutMs: 10000 },
      );
      if (
        !policy.allowed ||
        policy.generation !== generation ||
        adapter()?.documentId !== documentId
      ) {
        await fetch(`/api/recordings/${session.id}/stop`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.credential}`,
          },
          body: JSON.stringify({
            phase: 'finish',
            elapsedMs: 0,
            slots: 0,
            reason: 'Closed',
          }),
        });
        setStarting(false);
        return;
      }
      adapter()!.send({
        type: 'start',
        recordingId: session.id,
        credential: session.credential,
        generation,
      });
      pendingRequest.current = null;
    } catch (e) {
      if (e instanceof ApiError && e.status < 500 && e.status !== 429)
        pendingRequest.current = null;
      setStarting(false);
      setError((e as Error).message);
    }
  }
  if (!capable || !allowed) return null;
  const recording = phase === 'recording';
  return (
    <>
      <button
        ref={button}
        className={`menu-button recording-button ${recording ? 'is-recording' : ''}`}
        aria-label={`Recording controls: ${recording ? 'Recording' : 'Stopped'}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        title={recording ? 'Recording' : 'Stopped'}
      >
        {recording ? (
          <Circle size={24} fill="currentColor" aria-hidden="true" />
        ) : (
          <Square size={22} aria-hidden="true" />
        )}
      </button>
      <dialog
        ref={dialog}
        className="recording-dialog surface"
        aria-labelledby="recording-title"
        onClose={() => {
          setOpen(false);
          button.current?.focus();
        }}
        onCancel={() => setOpen(false)}
      >
        <div className="menu-top">
          <h2 id="recording-title">Screen recording</h2>
          <button
            className="menu-button"
            aria-label="Close recording controls"
            onClick={() => setOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        <p>
          Record takes one screenshot per second of the visible fictional
          banking screen and uploads it for the demo administrator to review.
          Login and admin screens are excluded.
        </p>
        <p>
          Tap Record to approve this session. Closing this panel keeps
          recording; Stop ends capture. Leaving the app stops capture and
          requires a new Record tap.
        </p>
        <p role="status">
          <strong>
            {starting ? 'Starting…' : recording ? 'Recording' : 'Stopped'}
          </strong>
          {phase === 'uploading' ? ' · Uploading remaining screenshots…' : ''} ·{' '}
          {count} uploaded
        </p>
        <Alert message={error} />
        <div className="context-actions">
          <button
            className="button"
            disabled={recording || starting || phase === 'uploading'}
            onClick={() => void record()}
          >
            Record
          </button>
          <button
            className="button secondary"
            disabled={!recording}
            onClick={() => adapter()?.send({ type: 'stop', reason: 'Stopped' })}
          >
            Stop
          </button>
        </div>
      </dialog>
    </>
  );
}
