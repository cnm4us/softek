import { captureClock, type Clock } from './capture-loop';
import type { OverlayImage } from './overlay-capture';

export type OverlayReason =
  'invalid' | 'ui' | 'content' | 'scroll' | 'viewport';
export type OverlaySample = {
  pair: number;
  method: 'View baseline' | 'Window candidate';
  reason: OverlayReason;
  elapsedMs: number;
  image?: OverlayImage;
  error?: string;
};
// Local A/B only: one sequential pair per event, no recurring image timer.
export class OverlayComparison {
  private running = false;
  private epoch = 0;
  private started = 0;
  private last = -Infinity;
  private busy = false;
  private pending: OverlayReason | null = null;
  private timer: unknown;
  private deadline: unknown;
  private pair = 0;
  constructor(
    private ports: {
      eligible(): boolean;
      capture(method: OverlaySample['method']): Promise<OverlayImage>;
      sample(sample: OverlaySample): void;
      stopped(reason: string): void;
    },
    private clock: Clock = captureClock,
  ) {}
  start() {
    if (this.running) return;
    this.running = true;
    this.epoch++;
    this.started = this.clock.now();
    this.last = -Infinity;
    this.pair = 0;
    this.deadline = this.clock.later(
      () => this.stop('One-minute local check finished'),
      60_000,
    );
    this.request('ui');
  }
  stop(reason = 'Stopped') {
    if (!this.running) return;
    this.running = false;
    this.epoch++;
    this.pending = null;
    this.clock.cancel(this.timer);
    this.timer = undefined;
    this.clock.cancel(this.deadline);
    this.ports.stopped(reason);
  }
  request(reason: OverlayReason) {
    if (!this.running) return;
    if (reason === 'invalid' || this.pending !== 'invalid')
      this.pending = reason;
    this.schedule();
  }
  private schedule() {
    if (!this.running || !this.pending || this.busy || this.timer !== undefined)
      return;
    this.timer = this.clock.later(
      () => {
        this.timer = undefined;
        void this.run();
      },
      Math.max(350, this.last + 500 - this.clock.now()),
    );
  }
  private async run() {
    if (!this.running || !this.pending) return;
    if (!this.ports.eligible()) return this.stop('Local capture unavailable');
    const epoch = this.epoch,
      pair = ++this.pair,
      reason = this.pending;
    this.pending = null;
    this.busy = true;
    this.last = this.clock.now();
    try {
      for (const method of ['View baseline', 'Window candidate'] as const) {
        if (!this.running || epoch !== this.epoch) return;
        if (!this.ports.eligible())
          return this.stop('Local capture unavailable');
        const elapsedMs = Math.round(this.clock.now() - this.started);
        let image: OverlayImage | undefined, error: string | undefined;
        try {
          image = await this.ports.capture(method);
        } catch (e) {
          error = e instanceof Error ? e.message : 'Local capture failed';
        }
        if (!this.running || epoch !== this.epoch || !this.ports.eligible()) {
          image?.dispose();
          if (this.running && epoch === this.epoch)
            this.stop('Local capture unavailable');
          return;
        }
        this.ports.sample({ pair, reason, method, elapsedMs, image, error });
      }
    } finally {
      this.busy = false;
      this.schedule();
    }
  }
}
