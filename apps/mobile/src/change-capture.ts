import {
  captureClock,
  type CapturedFile,
  type Clock,
  type Frame,
} from './capture-loop';
import type { PageGeometry, ImageBounds } from './page-context';

export type CaptureReason =
  'start' | 'route' | 'ui' | 'error' | 'scroll' | 'viewport' | 'content';
export type Geometry = {
  route: string;
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
  scrollX: number;
  scrollY: number;
  container: string;
  containerX: number;
  containerY: number;
};
export type CaptureContext = {
  reason: CaptureReason;
  geometry: Geometry;
  uncertaintyMs: number;
  unstable: boolean;
  page?: { version: 1; web: PageGeometry; image: ImageBounds };
  surface?: {
    method: 'window-crop-v1';
    maskedKeyboard: boolean;
    anchoredPopover: boolean;
  };
};
export type Interaction = {
  sequence: number;
  elapsedMs: number;
  kind:
    | 'tap'
    | 'swipe'
    | 'scroll'
    | 'viewport'
    | 'route'
    | 'ui'
    | 'error'
    | 'content';
  geometry: Geometry;
  uncertaintyMs: number;
  x?: number;
  y?: number;
  endX?: number;
  endY?: number;
  durationMs?: number;
};
export const reasons: CaptureReason[] = [
  'content',
  'ui',
  'scroll',
  'viewport',
  'route',
  'start',
  'error',
];
export function geometry(value: unknown): Geometry | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (
    typeof v.route !== 'string' ||
    v.route.length > 120 ||
    !/^\/[a-z0-9/-]*$/i.test(v.route) ||
    typeof v.container !== 'string' ||
    !/^(document|s[1-9][0-9]{0,2})$/.test(v.container)
  )
    return null;
  for (const k of [
    'width',
    'height',
    'scale',
    'offsetX',
    'offsetY',
    'scrollX',
    'scrollY',
    'containerX',
    'containerY',
  ])
    if (
      typeof v[k] !== 'number' ||
      !Number.isFinite(v[k]) ||
      Math.abs(v[k] as number) > 10_000_000
    )
      return null;
  if (
    (v.width as number) <= 0 ||
    (v.width as number) > 8192 ||
    (v.height as number) <= 0 ||
    (v.height as number) > 8192 ||
    (v.scale as number) < 0.25 ||
    (v.scale as number) > 5
  )
    return null;
  return {
    route: v.route,
    container: v.container,
    width: v.width as number,
    height: v.height as number,
    scale: v.scale as number,
    offsetX: v.offsetX as number,
    offsetY: v.offsetY as number,
    scrollX: v.scrollX as number,
    scrollY: v.scrollY as number,
    containerX: v.containerX as number,
    containerY: v.containerY as number,
  };
}

// A single pending deadline exists only after a change. The duration deadline
// stops an idle recording; it never schedules screenshots.
export class ChangeCaptureLoop {
  private running = false;
  private busy = false;
  private epoch = 0;
  private started = 0;
  private last = -Infinity;
  private pending: CaptureReason | null = null;
  private notBefore = 0;
  private timer: unknown;
  private durationTimer: unknown;
  attempted = 0;
  coalesced = 0;
  constructor(
    private ports: {
      capture: (reason: CaptureReason) => Promise<CapturedFile>;
      frame: (frame: Frame) => void;
      eligible: () => boolean;
      stopped: (reason: string) => void;
      settleMs?: (reason: CaptureReason) => number;
    },
    private clock: Clock = captureClock,
  ) {}
  start(started = this.clock.now()) {
    if (this.running) return;
    this.running = true;
    this.epoch++;
    this.started = started;
    this.last = -Infinity;
    this.attempted = 0;
    this.coalesced = 0;
    this.pending = null;
    this.notBefore = 0;
    this.durationTimer = this.clock.later(
      () => this.stop('Duration limit reached'),
      Math.max(1, 900000 - (this.clock.now() - started)),
    );
    this.request('start');
  }
  request(reason: CaptureReason) {
    if (!this.running) return;
    const settleMs = this.ports.settleMs?.(reason) ?? 100;
    if (settleMs > 100)
      this.notBefore = Math.max(this.notBefore, this.clock.now() + settleMs);
    if (this.pending) {
      this.coalesced++;
      if (reasons.indexOf(reason) > reasons.indexOf(this.pending))
        this.pending = reason;
    } else this.pending = reason;
    this.schedule();
  }
  private schedule() {
    if (!this.running || !this.pending || this.busy || this.timer !== undefined)
      return;
    const epoch = this.epoch;
    this.timer = this.clock.later(
      () => {
        this.timer = undefined;
        if (this.running && epoch === this.epoch) void this.tick(epoch);
      },
      Math.max(
        100,
        Math.ceil(500 - (this.clock.now() - this.last)),
        Math.ceil(this.notBefore - this.clock.now()),
      ),
    );
  }
  stop(reason = 'Stopped') {
    if (!this.running) return;
    this.running = false;
    this.epoch++;
    this.pending = null;
    this.clock.cancel(this.timer);
    this.clock.cancel(this.durationTimer);
    this.timer = undefined;
    this.ports.stopped(reason);
  }
  private async tick(epoch: number) {
    if (!this.pending || this.busy) return;
    if (!this.ports.eligible()) return this.stop('Capture unavailable');
    const remaining = Math.max(
      500 - (this.clock.now() - this.last),
      this.notBefore - this.clock.now(),
    );
    if (remaining > 0) {
      this.schedule();
      return;
    }
    if (this.attempted >= 900) return this.stop('Duration limit reached');
    const reason = this.pending;
    this.pending = null;
    this.notBefore = 0;
    this.busy = true;
    this.last = this.clock.now();
    const sequence = ++this.attempted;
    let file: CapturedFile | undefined;
    try {
      file = await this.ports.capture(reason);
      if (!this.running || epoch !== this.epoch || !this.ports.eligible()) {
        file.dispose();
        file = undefined;
        return;
      }
      this.last = Math.max(this.last, file.capturedMonotonicMs ?? this.last);
      if (file.bytes <= 0 || file.bytes > 1048576)
        throw new Error('Invalid image size');
      this.ports.frame({
        ...file,
        sequence,
        elapsedMs: Math.max(
          0,
          Math.round((file.capturedMonotonicMs ?? this.last) - this.started),
        ),
        capturedAt: file.capturedAt ?? this.clock.utc(),
        captureMs: file.captureMs ?? Math.round(this.clock.now() - this.last),
      });
      file = undefined;
      if (sequence === 900) this.stop('Duration limit reached');
    } catch {
      file?.dispose();
      if (epoch === this.epoch) this.stop('Screenshot capture failed');
    } finally {
      this.busy = false;
      if (this.running && this.pending) this.schedule();
    }
  }
}
