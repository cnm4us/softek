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
  capture_policy?: 'periodic-v1' | 'changes-v2';
  capture_method?: 'view-v1' | 'window-crop-v1';
  received_events?: number;
  expected_events?: number;
  lost_events?: number;
  coalesced_triggers?: number;
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
  context?: {
    reason: string;
    unstable: boolean;
    uncertaintyMs: number;
    surface?: {
      method: 'window-crop-v1';
      maskedKeyboard: boolean;
      anchoredPopover: boolean;
    };
  } | null;
};
const utc = (value: string) =>
  new Date(value).toISOString().replace('T', ' ').replace('Z', ' UTC');
const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;
const size = (bytes: number) => `${(bytes / 1_048_576).toFixed(2)} MiB`;
type ReferencePreview = {
  page: number;
  route: string;
  truncated: boolean;
  coverageStatus?: string;
  extentStatus?: string;
  topReached?: boolean | null;
  bottomReached?: boolean | null;
  limited?: boolean;
  coveragePercent?: number | null;
  sourceCount?: number;
  firstCapturedAt?: string;
  lastCapturedAt?: string;
};
type ReplaySummary = {
  sample: { durationMs: number };
  full: { durationMs: number; fps?: number };
  note: string;
  sessionReference?: {
    enabled: boolean;
    preview: ReferencePreview | null;
    references?: ReferencePreview[];
  } | null;
};
type ReplayJob = {
  state: 'queued' | 'rendering' | 'ready' | 'failed';
  attempts: number;
};
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
          {r.received_frames} received / {r.scheduled_slots}{' '}
          {r.capture_policy === 'changes-v2'
            ? 'capture attempts'
            : 'scheduled slots observed'}
        </dd>
      </div>
      <div>
        <dt>
          {r.stop_elapsed_ms === null
            ? 'Known missing intervals'
            : r.capture_policy === 'changes-v2'
              ? 'Missing captures'
              : 'Missing intervals'}
        </dt>
        <dd>{Math.max(0, r.scheduled_slots - r.received_frames)}</dd>
      </div>
      <div>
        <dt>Stored images</dt>
        <dd>{size(r.stored_bytes)}</dd>
      </div>
      <div>
        <dt>Capture coverage</dt>
        <dd>
          {r.capture_method === 'window-crop-v1'
            ? 'Banking area including native tooltips (experimental)'
            : 'Page capture'}
        </dd>
      </div>
      {r.capture_policy === 'changes-v2' && (
        <>
          <div>
            <dt>Capture mode</dt>
            <dd>On screen changes; idle periods hold the previous image</dd>
          </div>
          <div>
            <dt>Interactions</dt>
            <dd>
              {r.received_events ?? 0} received · {r.lost_events ?? 0} reported
              missing
            </dd>
          </div>
          <div>
            <dt>Combined change triggers</dt>
            <dd>{r.coalesced_triggers ?? 0}</dd>
          </div>
        </>
      )}
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
      replayUsage?: { derivedBytes: number; reservedBytes: number };
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
            {data.replayUsage
              ? ` · Replay files: ${size(data.replayUsage.derivedBytes)}${data.replayUsage.reservedBytes ? ' · Render space reserved' : ''}`
              : ''}
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
    [events, setEvents] = useState<
      { sequence_number: number; elapsed_ms: number; event_kind: string }[]
    >([]),
    [replay, setReplay] = useState<ReplaySummary | null>(null),
    [job, setJob] = useState<ReplayJob | null>(null),
    [pollFailed, setPollFailed] = useState(false),
    [frames, setFrames] = useState<Frame[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
    [referencePage, setReferencePage] = useState<number | null>(null),
    [imageFailed, setImageFailed] = useState(false);
  const playOrigin = useRef({ time: 0, position: 0 });
  const loadVersion = useRef(0);
  const load = useCallback(async () => {
    if (!recordingId) return;
    const version = ++loadVersion.current;
    const all: Frame[] = [];
    let after = 0;
    for (let page = 0; page < 9; page++) {
      const result = await request<{
        recording: Recording;
        frames: Frame[];
        replay?: ReplaySummary | null;
        replayJob?: ReplayJob | null;
      }>(`/admin/recordings/${recordingId}?after=${after}`);
      if (version !== loadVersion.current) return;
      all.push(...result.frames);
      setRecording(result.recording);
      setReplay(result.replay ?? null);
      setJob(result.replayJob ?? null);
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
    setReplay(null);
    setJob(null);
    setPollFailed(false);
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
  useEffect(() => {
    if (!recordingId || !job || !['queued', 'rendering'].includes(job.state))
      return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await request<{
          replay?: ReplaySummary | null;
          replayJob?: ReplayJob | null;
        }>(`/admin/recordings/${recordingId}?after=900`);
        if (cancelled) return;
        setReplay(result.replay ?? null);
        setJob(result.replayJob ?? null);
        setPollFailed(false);
        if (
          !result.replayJob ||
          !['queued', 'rendering'].includes(result.replayJob.state)
        )
          return;
      } catch {
        if (cancelled) return;
        setPollFailed(true);
      }
      timer = setTimeout(() => void poll(), 3000);
    };
    timer = setTimeout(() => void poll(), 3000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recordingId, job?.state, request]);
  const referenceOptions = replay?.sessionReference?.references ?? [];
  const referenceInfo =
    referenceOptions.find((r) => r.page === referencePage) ??
    replay?.sessionReference?.preview;
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
    .find(
      (f) =>
        f.elapsed_ms <= position &&
        (recording?.capture_policy === 'changes-v2' ||
          position < f.elapsed_ms + 1000),
    );
  useEffect(() => {
    if (recording?.capture_policy !== 'changes-v2' || !recordingId) {
      setEvents([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      void request<{ events: typeof events }>(
        `/admin/recordings/${recordingId}/events?at=${Math.round(position)}`,
      )
        .then((r) => {
          if (!cancelled) setEvents(r.events);
        })
        .catch(() => {
          if (!cancelled) setEvents([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [recording?.capture_policy, recordingId, position, request]);
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
          {!replay && job && (
            <Card title="Animated replay experiment">
              <p role="status">
                {job.state === 'queued'
                  ? 'Video queued. It will appear here automatically when ready.'
                  : job.state === 'rendering'
                    ? 'Generating video… This page updates automatically.'
                    : job.state === 'failed'
                      ? 'Video generation failed. Your screenshots are still available below.'
                      : 'The generated video is unavailable. Refresh recording to check again.'}
              </p>
              {pollFailed && (
                <p role="status">Unable to refresh video status. Retrying…</p>
              )}
              {job.state === 'failed' && (
                <button
                  className="button secondary"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    setError('');
                    try {
                      await request(
                        `/admin/recordings/${recordingId}/replay/retry`,
                        {},
                      );
                      await load();
                    } catch (e) {
                      setError((e as Error).message);
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Retry video
                </button>
              )}
            </Card>
          )}
          {replay && (
            <Card title="Animated replay experiment">
              <p className="small-note">
                {replay.note} Pauses and the full recording duration are
                preserved. Snapshot capture times and elapsed playback time are
                labeled separately.{' '}
                {replay.full.fps ? `Video output: ${replay.full.fps} fps.` : ''}
              </p>
              <p id="replay-sample-label">Short scrolling example</p>
              <video
                id="replay-sample"
                aria-labelledby="replay-sample-label"
                className="recording-video"
                controls
                playsInline
                preload="metadata"
                src={`/api/admin/recordings/${recordingId}/replay/sample.mp4`}
              />
              <details>
                <summary>
                  Full session ({seconds(replay.full.durationMs)})
                </summary>
                <video
                  aria-label="Full session replay"
                  className="recording-video"
                  controls
                  playsInline
                  preload="none"
                  src={`/api/admin/recordings/${recordingId}/replay/full.mp4`}
                />
              </details>
              {referenceInfo && (
                <details>
                  <summary>
                    Page reference ({referenceInfo.coverageStatus ?? 'partial'})
                  </summary>
                  {referenceOptions.length > 1 && (
                    <label>
                      Page reference
                      <select
                        aria-label="Page reference"
                        value={referenceInfo.page}
                        onChange={(e) =>
                          setReferencePage(Number(e.target.value))
                        }
                      >
                        {referenceOptions.map((r) => (
                          <option key={r.page} value={r.page}>
                            {r.route} · reference {r.page + 1} ·{' '}
                            {r.coverageStatus ?? 'partial'}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                  <p className="small-note">
                    This image combines observed regions from different moments
                    in this recording. Unobserved regions use a checkerboard.{' '}
                    {referenceInfo.extentStatus === 'measured'
                      ? 'Page extent and scroll boundaries are measured for this layout. The scrollbar gutter is excluded from the reference.'
                      : 'Full page extent and scroll boundaries were not recorded.'}
                  </p>
                  {referenceInfo.extentStatus === 'measured' && (
                    <p className="small-note">
                      Top:{' '}
                      {referenceInfo.topReached ? 'observed' : 'not observed'} ·
                      Bottom:{' '}
                      {referenceInfo.bottomReached
                        ? 'observed'
                        : 'not observed'}
                    </p>
                  )}
                  {referenceInfo.coveragePercent !== null &&
                    referenceInfo.coveragePercent !== undefined && (
                      <p className="small-note">
                        Observed coverage: {referenceInfo.coveragePercent}% of
                        this layout
                      </p>
                    )}
                  {referenceInfo.sourceCount && (
                    <p className="small-note">
                      {referenceInfo.sourceCount} observations
                      {referenceInfo.firstCapturedAt &&
                      referenceInfo.lastCapturedAt
                        ? ` · ${utc(referenceInfo.firstCapturedAt)} to ${utc(referenceInfo.lastCapturedAt)}`
                        : ''}
                    </p>
                  )}
                  <img
                    src={
                      referenceOptions.length
                        ? `/api/admin/recordings/${recordingId}/page-references/${referenceInfo.page}`
                        : `/api/admin/recordings/${recordingId}/replay/canvas-preview.png`
                    }
                    alt={`${referenceInfo.coverageStatus === 'complete' ? 'Complete' : 'Partial'} session page reference for ${referenceInfo.route}`}
                    style={{ display: 'block', width: '100%', height: 'auto' }}
                    loading="lazy"
                  />
                  {referenceInfo.limited && (
                    <p className="small-note">
                      The reference size limit was reached. Later observations
                      remain available in screenshot review.
                    </p>
                  )}
                  {referenceInfo.truncated && (
                    <p className="small-note">
                      Preview height is limited; additional observed regions are
                      retained in the reference.
                    </p>
                  )}
                </details>
              )}
              <div className="context-actions">
                <a
                  className="text-button"
                  href={`/api/admin/recordings/${recordingId}/replay/sample.mp4`}
                  download="softek-scroll-example.mp4"
                >
                  Download short example
                </a>
                <a
                  className="text-button"
                  href={`/api/admin/recordings/${recordingId}/replay/full.mp4`}
                  download="softek-session-replay.mp4"
                >
                  Download full replay
                </a>
              </div>
            </Card>
          )}
          <Card title="Screenshot review">
            <p className="small-note">
              {recording.capture_policy === 'changes-v2'
                ? 'Screenshots are taken on changes. Idle periods hold the last observed image; missing capture/event counts are shown above.'
                : 'One image per second. Gaps remain visible;'}{' '}
              Capture time comes from the phone and may have clock skew.
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
                  {frame.context && (
                    <div>
                      <dt>Capture trigger</dt>
                      <dd>
                        {frame.context.reason}
                        {frame.context.unstable
                          ? ' · page moving during capture'
                          : ''}
                        {frame.context.surface
                          ? ` · Native tooltips${frame.context.surface.anchoredPopover ? ' · popover present' : ''}${frame.context.surface.maskedKeyboard ? ' · keyboard area blanked' : ''}`
                          : ''}
                      </dd>
                    </div>
                  )}
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
          {recording.capture_policy === 'changes-v2' && (
            <Card title="Interactions near this time">
              <p className="small-note">
                Recorded interactions within two seconds of the selected time.
              </p>
              {events.length ? (
                <ul>
                  {events.map((e) => (
                    <li key={e.sequence_number}>
                      <button
                        className="text-button"
                        onClick={() => seek(e.elapsed_ms)}
                      >
                        {seconds(e.elapsed_ms)} · {e.event_kind}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p>No interaction events near this time.</p>
              )}
            </Card>
          )}
        </>
      )}
    </div>
  );
}
