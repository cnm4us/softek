export type CapturedFile = {
  uri: string;
  bytes: number;
  dispose: () => void;
  capturedAt?: string;
  capturedMonotonicMs?: number;
  captureMs?: number;
};
export type Frame = CapturedFile & {
  sequence: number;
  capturedAt: string;
  elapsedMs: number;
  captureMs: number;
};
export type Clock = {
  now: () => number;
  utc: () => string;
  later: (action: () => void, ms: number) => unknown;
  cancel: (timer: unknown) => void;
};
export const captureClock: Clock = {
  now: () => performance.now(),
  utc: () => new Date().toISOString(),
  later: (action, ms) => setTimeout(action, ms),
  cancel: (timer) => clearTimeout(timer as ReturnType<typeof setTimeout>),
};

// Deadlines belong to the start time, not to the previous capture's completion.
// Recipients own accepted files. Late results always get disposed here.
export class CaptureLoop {
  private running = false;
  private epoch = 0;
  private started = 0;
  private timer: unknown;
  private busy = false;
  constructor(
    private ports: {
      capture: () => Promise<CapturedFile>;
      frame: (frame: Frame) => void;
      stopped: (reason: string) => void;
      eligible: () => boolean;
    },
    private clock: Clock = captureClock,
    private maxSlots = 900,
  ) {}
  start() {
    if (this.running) return;
    this.running = true;
    this.started = this.clock.now();
    this.epoch++;
    this.schedule();
  }
  stop(reason = 'Stopped') {
    if (!this.running) return;
    this.running = false;
    this.epoch++;
    this.clock.cancel(this.timer);
    this.ports.stopped(reason);
  }
  private schedule() {
    if (!this.running) return;
    const elapsed = this.clock.now() - this.started;
    const slot = Math.floor(elapsed / 1000) + 1;
    if (slot > this.maxSlots) return this.stop('Duration limit reached');
    const epoch = this.epoch;
    this.timer = this.clock.later(
      () => void this.tick(slot, epoch),
      Math.max(1, Math.ceil(slot * 1000 - elapsed)),
    );
  }
  private async tick(slot: number, scheduledEpoch: number) {
    if (!this.running || scheduledEpoch !== this.epoch) return;
    if (!this.ports.eligible()) return this.stop('Capture is unavailable');
    if (this.busy) return this.schedule();
    const epoch = this.epoch;
    const began = this.clock.now();
    // Timers can truncate fractional milliseconds or wake early. Never capture
    // before this deadline, which would repeat the preceding frame sequence.
    const remaining = slot * 1000 - (began - this.started);
    if (remaining > 0) {
      this.timer = this.clock.later(
        () => void this.tick(slot, epoch),
        Math.max(1, Math.ceil(remaining)),
      );
      return;
    }
    const elapsedMs = Math.round(began - this.started);
    const sequence = Math.floor(elapsedMs / 1000);
    if (sequence > this.maxSlots) return this.stop('Duration limit reached');
    const capturedAt = this.clock.utc();
    this.busy = true;
    let file: CapturedFile | undefined;
    try {
      file = await this.ports.capture();
      if (!this.running || this.epoch !== epoch || !this.ports.eligible()) {
        file.dispose();
        if (this.epoch === epoch) this.stop('Capture is unavailable');
        return;
      }
      if (file.bytes <= 0 || file.bytes > 1024 * 1024)
        throw new Error('Screenshot exceeds the image limit');
      const actualElapsed = Math.round(
        (file.capturedMonotonicMs ?? began) - this.started,
      );
      const actualSequence = Math.floor(actualElapsed / 1000);
      if (actualSequence > this.maxSlots) {
        file.dispose();
        file = undefined;
        this.stop('Duration limit reached');
        return;
      }
      this.ports.frame({
        ...file,
        sequence: actualSequence,
        capturedAt: file.capturedAt ?? capturedAt,
        elapsedMs: actualElapsed,
        captureMs: file.captureMs ?? Math.round(this.clock.now() - began),
      });
      file = undefined;
      if (actualSequence === this.maxSlots) this.stop('Duration limit reached');
    } catch {
      file?.dispose();
      if (this.epoch === epoch) this.stop('Screenshot capture failed');
    } finally {
      this.busy = false;
      // A previous generation must not schedule work for a new recording.
      if (this.epoch === epoch) this.schedule();
    }
  }
}
