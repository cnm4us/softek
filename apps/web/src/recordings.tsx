import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useAdmin } from './admin-session';
import { Alert, Card } from './ui';

type Recording = {
  id: string;
  user_id: string;
  username?: string;
  state: 'active' | 'uploading' | 'stopped' | 'interrupted';
  started_at: string;
  finalized_at: string | null;
  stop_reason: string | null;
  stop_elapsed_ms: number | null;
  scheduled_slots: number;
  received_frames: number;
  stored_bytes: number;
};
type Frame = {
  sequence_number: number;
  captured_at: string;
  received_at: string;
  elapsed_ms: number;
  capture_ms: number;
  width: number;
  height: number;
  byte_length: number;
  image_hash: string;
  clock_skew: boolean;
};
const utc = (value: string) =>
  new Date(value).toISOString().replace('T', ' ').replace('Z', ' UTC');
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const size = (bytes: number) => `${(bytes / 1_048_576).toFixed(2)} MiB`;
function Summary({ recording: r }: { recording: Recording }) {
  return (
    <dl className="recording-summary">
      <div>
        <dt>Started</dt>
        <dd>{utc(r.started_at)}</dd>
      </div>
      <div>
        <dt>Status</dt>
        <dd>
          {r.state}
          {r.stop_reason ? ` · ${r.stop_reason}` : ''}
        </dd>
      </div>
      <div>
        <dt>Capture duration</dt>
        <dd>
          {r.stop_elapsed_ms === null
            ? 'Not confirmed'
            : seconds(r.stop_elapsed_ms)}
        </dd>
      </div>
      <div>
        <dt>Screenshots</dt>
        <dd>
          {r.received_frames} received / {r.scheduled_slots} scheduled slots
          observed
        </dd>
      </div>
      <div>
        <dt>
          {r.stop_elapsed_ms === null
            ? 'Known missing intervals'
            : 'Missing intervals'}
        </dt>
        <dd>{Math.max(0, r.scheduled_slots - r.received_frames)}</dd>
      </div>
      <div>
        <dt>Stored images</dt>
        <dd>{size(r.stored_bytes)}</dd>
      </div>
      {r.stop_elapsed_ms === null && (
        <div>
          <dt>Coverage</dt>
          <dd>
            Capture end time was not confirmed. Additional screenshots may be
            missing.
          </dd>
        </div>
      )}
    </dl>
  );
}
export function Recordings() {
  const { request } = useAdmin();
  const [page, setPage] = useState(0),
    [data, setData] = useState<{
      recordings: Recording[];
      enabled: boolean;
      usage: { bytes: number };
      availableBytes: number | null;
    } | null>(null),
    [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let closed = false;
    setData(null);
    setError('');
    void request<typeof data>(`/admin/recordings?page=${page}`)
      .then((d) => {
        if (!closed) setData(d);
      })
      .catch((e: Error) => {
        if (!closed) setError(e.message);
      });
    return () => {
      closed = true;
    };
  }, [page, request, refresh]);
  return (
    <>
      <p className="lead">
        User-approved screenshots from the Softek iOS app. Capture and server
        arrival timestamps are recorded separately.
      </p>
      <button
        className="button secondary"
        onClick={() => setRefresh((n) => n + 1)}
      >
        Refresh recordings
      </button>
      <Alert message={error} />
      {!data && !error && <p role="status">Loading recordings…</p>}
      {data && (
        <>
          <p className="small-note">
            Receiver {data.enabled ? 'enabled' : 'disabled'} · Images stored:{' '}
            {size(Number(data.usage.bytes))}
            {data.availableBytes !== null
              ? ` · Disk available: ${(data.availableBytes / 1024 ** 3).toFixed(1)} GiB`
              : ' · Storage not provisioned'}
          </p>
          {!data.recordings.length && (
            <Card>
              <p>No recordings on this page.</p>
            </Card>
          )}
          <div className="recording-list">
            {data.recordings.map((r) => (
              <Card key={r.id}>
                <h2>{r.username ?? 'Fictional customer'}</h2>
                <Summary recording={r} />
                <Link
                  className="text-button"
                  to={`/controls/recordings/${r.id}`}
                >
                  Review recording
                </Link>
              </Card>
            ))}
          </div>
          <div className="context-actions">
            <button
              className="button secondary"
              disabled={page === 0}
              onClick={() => setPage((n) => n - 1)}
            >
              Previous page
            </button>
            <span>Page {page + 1}</span>
            <button
              className="button secondary"
              disabled={data.recordings.length < 25}
              onClick={() => setPage((n) => n + 1)}
            >
              Next page
            </button>
          </div>
        </>
      )}
    </>
  );
}
export function RecordingReview() {
  const { recordingId } = useParams(),
    { request } = useAdmin(),
    navigate = useNavigate();
  const [recording, setRecording] = useState<Recording | null>(null),
    [frames, setFrames] = useState<Frame[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
    [imageFailed, setImageFailed] = useState(false);
  const playOrigin = useRef({ time: 0, position: 0 });
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    if (!recordingId) return;
    const version = ++loadVersion.current;
    const all: Frame[] = [];
    let after = 0;
    for (let page = 0; page < 9; page++) {
      const result = await request<{ recording: Recording; frames: Frame[] }>(
        `/admin/recordings/${recordingId}?after=${after}`,
      );
      if (version !== loadVersion.current) return;
      all.push(...result.frames);
      setRecording(result.recording);
      if (result.frames.length < 100) break;
      after = result.frames.at(-1)!.sequence_number;
    }
    setFrames(all);
    setPlaying(false);
    setPosition(all[0]?.elapsed_ms ?? 0);
  }, [recordingId, request]);
  useEffect(() => {
    let cancelled = false;
    setRecording(null);
    setFrames([]);
    setError('');
    void load().catch((e: Error) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
      loadVersion.current++;
    };
  }, [load]);
  const duration =
    recording?.stop_elapsed_ms !== null &&
    recording?.stop_elapsed_ms !== undefined
      ? Math.max(recording.stop_elapsed_ms, frames.at(-1)?.elapsed_ms ?? 0)
      : (frames.at(-1)?.elapsed_ms ?? 0) + (frames.length ? 1000 : 0);
  useEffect(() => {
    if (!playing) return;
    playOrigin.current = { time: performance.now(), position };
    const timer = window.setInterval(() => {
      const next =
        playOrigin.current.position +
        performance.now() -
        playOrigin.current.time;
      setPosition(Math.min(duration, next));
      if (next >= duration) setPlaying(false);
    }, 100);
    return () => window.clearInterval(timer);
    // Position is advanced by this timer; user seeking pauses playback first.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, duration]);
  const frame = [...frames]
    .reverse()
    .find((f) => f.elapsed_ms <= position && position < f.elapsed_ms + 1000);
  useEffect(() => setImageFailed(false), [frame?.sequence_number]);
  function seek(value: number) {
    setPlaying(false);
    setPosition(value);
  }
  async function remove() {
    if (
      !window.confirm(
        'Delete this recording and all its screenshots? This cannot be undone.',
      )
    )
      return;
    setBusy(true);
    setError('');
    setPlaying(false);
    try {
      await request(`/admin/recordings/${recordingId}/delete`, {});
      navigate('/controls/recordings');
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="recording-review">
      <Link className="text-button" to="/controls/recordings">
        Back to recordings
      </Link>
      <Alert message={error} />
      {!recording && !error && <p role="status">Loading recording…</p>}
      {recording && (
        <>
          <Card>
            <Summary recording={recording} />
            <div className="context-actions">
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setError('');
                  void load().catch((e: Error) => setError(e.message));
                }}
              >
                Refresh recording
              </button>
              <button
                className="button danger"
                disabled={busy}
                onClick={() => void remove()}
              >
                Delete recording
              </button>
            </div>
          </Card>
          <Card title="Screenshot review">
            <p className="small-note">
              One image per second. Gaps remain visible; capture time comes from
              the phone and may have clock skew.
            </p>
            <div className="context-actions recording-player-actions">
              <button
                disabled={!frames.length}
                onClick={() => {
                  if (position >= duration) setPosition(0);
                  setPlaying((v) => !v);
                }}
              >
                {playing ? 'Pause' : 'Play'}
              </button>
              <button
                className="button secondary"
                disabled={!frames.some((f) => f.elapsed_ms < position)}
                onClick={() =>
                  seek(
                    [...frames].reverse().find((f) => f.elapsed_ms < position)!
                      .elapsed_ms,
                  )
                }
              >
                Previous frame
              </button>
              <button
                className="button secondary"
                disabled={!frames.some((f) => f.elapsed_ms > position)}
                onClick={() =>
                  seek(frames.find((f) => f.elapsed_ms > position)!.elapsed_ms)
                }
              >
                Next frame
              </button>
            </div>
            <label className="recording-timeline">
              Timeline · {seconds(position)} / {seconds(duration)}
              <input
                aria-label="Recording timeline"
                type="range"
                min="0"
                max={Math.max(1, duration)}
                step="100"
                value={position}
                disabled={!frames.length}
                onChange={(e) => seek(Number(e.target.value))}
              />
            </label>
            {frame ? (
              <>
                <dl className="recording-summary">
                  <div>
                    <dt>Frame</dt>
                    <dd>{frame.sequence_number}</dd>
                  </div>
                  <div>
                    <dt>Captured on phone</dt>
                    <dd>{utc(frame.captured_at)}</dd>
                  </div>
                  <div>
                    <dt>Received by server</dt>
                    <dd>{utc(frame.received_at)}</dd>
                  </div>
                  <div>
                    <dt>Capture duration / image size</dt>
                    <dd>
                      {frame.capture_ms} ms / {frame.byte_length} bytes
                    </dd>
                  </div>
                </dl>
                {frame.clock_skew && (
                  <p role="status">
                    Phone time may differ from the server clock; elapsed time
                    determines playback order.
                  </p>
                )}
                {imageFailed ? (
                  <p role="status">This screenshot file is unavailable.</p>
                ) : (
                  <img
                    className="recording-image"
                    src={`/api/admin/recordings/${recordingId}/frames/${frame.sequence_number}`}
                    alt={`Captured app screen at ${seconds(frame.elapsed_ms)}`}
                    onError={() => setImageFailed(true)}
                  />
                )}
              </>
            ) : (
              <div className="recording-gap" role="status">
                No screenshot at this time. This interval is a recording gap.
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
