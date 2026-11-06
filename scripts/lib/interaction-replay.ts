import type { Interaction } from '../../apps/mobile/src/change-capture.js';
import type { ReplayFrame, ReplayInterval } from './recording-replay.js';

export function guideMotion(
  intervals: ReplayInterval[],
  frames: ReplayFrame[],
  events: Interaction[],
  lostEvents = 0,
) {
  for (const i of intervals) {
    if (i.kind !== 'scroll') continue;
    const a = frames.find((f) => f.sequence === i.source),
      b = frames.find((f) => f.sequence === i.next),
      ag = a?.context?.geometry,
      bg = b?.context?.geometry;
    const nativeSurface = [a?.context, b?.context].some(
      (c) =>
        c?.surface &&
        (c.surface.maskedKeyboard ||
          c.surface.anchoredPopover ||
          c.reason === 'error'),
    );
    if (
      !a ||
      nativeSurface ||
      a.context?.surface?.method !== b?.context?.surface?.method ||
      !b ||
      !ag ||
      !bg ||
      ag.route !== bg.route ||
      ag.container !== 'document' ||
      bg.container !== 'document' ||
      a.height !== b.height ||
      Math.abs(ag.width - bg.width) > 1 ||
      Math.abs(ag.height - bg.height) > 1 ||
      Math.abs(ag.scale - bg.scale) > 0.01 ||
      b.context?.reason !== 'scroll'
    ) {
      i.kind = 'hold';
      delete i.dy;
      i.reason = 'Layout, route or scroll container changed; observed cut';
      continue;
    }
    if (lostEvents) continue;
    const scrollEvents = events.filter(
      (e) =>
        e.kind === 'scroll' &&
        e.elapsedMs > i.startMs &&
        e.elapsedMs < i.endMs &&
        e.geometry.route === ag.route &&
        e.geometry.container === 'document' &&
        Math.abs(e.geometry.width - ag.width) < 2 &&
        Math.abs(e.geometry.height - ag.height) < 2 &&
        Math.abs(e.geometry.scale - ag.scale) < 0.01,
    );
    // A moving endpoint may need pixel-based interpolation, but it must not
    // spread motion over a long preceding idle pause. Scroll samples are at
    // most 100 ms apart; allow that sampling window plus clock uncertainty.
    if (!a.context?.unstable && scrollEvents.length) {
      i.motionStartMs = Math.max(
        i.startMs,
        scrollEvents[0].elapsedMs - 100 - scrollEvents[0].uncertaintyMs,
      );
    }
    if (a.context?.unstable || b.context?.unstable) continue;
    const expected = ((bg.scrollY - ag.scrollY) * a.width) / ag.width;
    if (Math.abs(expected - i.dy!) > 6) continue;
    const points = [
      { atMs: i.startMs, position: 0 },
      ...(i.motionStartMs !== undefined && i.motionStartMs > i.startMs
        ? [{ atMs: i.motionStartMs, position: 0 }]
        : []),
      ...scrollEvents.map((e) => ({
        atMs: e.elapsedMs,
        position: ((e.geometry.scrollY - ag.scrollY) * a.width) / ag.width,
      })),
      { atMs: i.endMs, position: i.dy! },
    ].sort((x, y) => x.atMs - y.atMs);
    const direction = Math.sign(i.dy!);
    if (
      points.length < 3 ||
      points.some(
        (p, n) =>
          p.position < Math.min(0, i.dy!) - 6 ||
          p.position > Math.max(0, i.dy!) + 6 ||
          (n > 0 && direction * (p.position - points[n - 1].position) < -6),
      )
    )
      continue;
    const step = Math.max(1, Math.ceil(points.length / 94));
    i.motion = points.filter(
      (_, n) => n === 0 || n === points.length - 1 || n % step === 0,
    );
    i.reason = 'Image-aligned reconstructed scroll with recorded scroll timing';
  }
}

export function gestureFilters(
  events: Interaction[],
  frame: ReplayFrame | undefined,
  startMs: number,
  endMs: number,
  band: number,
) {
  if (!frame?.context) return { filters: [], suppressed: 0 };
  if (
    frame.context.surface &&
    (frame.context.surface.maskedKeyboard ||
      frame.context.surface.anchoredPopover ||
      frame.context.reason === 'error')
  )
    return { filters: [], suppressed: 0 };
  const g = frame.context.geometry;
  // visualViewport can be shorter than the native WebView while the keyboard
  // is open. Both coordinates use the same CSS-to-image scale, not independent
  // x/y stretching to the full backing view.
  const visibleHeight = Math.min(
    frame.height,
    (g.height * frame.width) / g.width,
  );
  const matches = events.filter(
    (e) =>
      (e.kind === 'tap' || e.kind === 'swipe') &&
      e.elapsedMs + (e.kind === 'tap' ? 450 : 0) >= startMs &&
      e.elapsedMs - (e.durationMs ?? 0) < endMs &&
      e.geometry.route === g.route &&
      e.geometry.container === g.container &&
      Math.abs(e.geometry.width - g.width) < 2 &&
      Math.abs(e.geometry.height - g.height) < 2 &&
      Math.abs(e.geometry.scale - g.scale) < 0.02,
  );
  const filters = matches.slice(0, 64).map((e) => {
    const begin =
        e.kind === 'swipe' ? e.elapsedMs - (e.durationMs ?? 0) : e.elapsedMs,
      end = e.kind === 'tap' ? e.elapsedMs + 450 : e.elapsedMs;
    const duration = Math.max(1, end - begin),
      fraction = `min(1,max(0,(t+${(startMs - begin) / 1000})/${duration / 1000}))`;
    const x = `(${e.x}+${(e.endX ?? e.x!) - e.x!}*${fraction})*${frame.width}-18`;
    const y = `${band}+(${e.y}+${(e.endY ?? e.y!) - e.y!}*${fraction})*${visibleHeight}-18`;
    const arrow =
      Math.abs((e.endX ?? 0) - e.x!) > Math.abs((e.endY ?? 0) - e.y!)
        ? (e.endX ?? 0) > e.x!
          ? '→'
          : '←'
        : (e.endY ?? 0) > e.y!
          ? '↓'
          : '↑';
    return `drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf:text='${e.kind === 'tap' ? '●' : arrow}':fontcolor=0xe46f25:fontsize=36:borderw=1:bordercolor=white:x='${x}':y='${y}':enable='between(t,${Math.max(0, (begin - startMs) / 1000)},${Math.max(0, (end - startMs) / 1000)})'`;
  });
  return { filters, suppressed: Math.max(0, matches.length - 64) };
}
