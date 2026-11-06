import type { Geometry } from '../../mobile/src/change-capture';
import type { PageGeometry } from '../../mobile/src/page-context';
type Kind =
  | 'tap'
  | 'swipe'
  | 'scroll'
  | 'viewport'
  | 'route'
  | 'ui'
  | 'error'
  | 'content';
let stopCurrent = () => {};
let currentContainer: Element | null = null;
const containers = new WeakMap<Element, string>();
let containerNumber = 0;
let pageVisit = 0,
  pageLayout = 0,
  pageRoute = '',
  pageSignature = '';
export function capturePageGeometry(): PageGeometry {
  const root = document.scrollingElement ?? document.documentElement;
  const style = getComputedStyle(document.body);
  const fontSize = parseFloat(style.fontSize) || 16,
    lineHeight = parseFloat(style.lineHeight) || fontSize * 1.2;
  // Numeric positions/sizes only. Catch internal reflow even if total document
  // height is unchanged; no node text, HTML or form values enter the signature.
  const anchors = Array.from(
    document.querySelectorAll<HTMLElement>('#main > *,#main .card'),
  )
    .slice(0, 64)
    .map((n) =>
      [n.offsetLeft, n.offsetTop, n.offsetWidth, n.offsetHeight].join(','),
    )
    .join(';');
  const signature = [
    root.scrollWidth,
    root.scrollHeight,
    root.clientWidth,
    fontSize,
    lineHeight,
    anchors,
  ].join(':');
  if (pageRoute !== location.pathname) {
    pageRoute = location.pathname;
    pageVisit++;
    pageLayout = 0;
    pageSignature = '';
  }
  if (pageSignature !== signature) {
    pageLayout++;
    pageSignature = signature;
  }
  const selected = window.getSelection();
  const active = document.activeElement;
  const inputSelection =
    (active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement) &&
    active.selectionStart !== null &&
    active.selectionEnd !== null &&
    active.selectionStart !== active.selectionEnd;
  return {
    version: 1,
    visit: Math.min(pageVisit, 10000),
    layout: Math.min(pageLayout, 10000),
    documentWidth: root.scrollWidth,
    documentHeight: root.scrollHeight,
    clientWidth: root.clientWidth,
    clientHeight: root.clientHeight,
    scrollX: root.scrollLeft,
    scrollY: root.scrollTop,
    fontSize,
    lineHeight,
    layer: document.querySelector('dialog[open],.bank-menu')
      ? 'overlay'
      : inputSelection || (selected && !selected.isCollapsed)
        ? 'selection'
        : 'document',
    top: root.scrollTop <= 1,
    bottom: root.scrollTop + root.clientHeight >= root.scrollHeight - 1,
  };
}
export function captureGeometry(): Geometry {
  const v = window.visualViewport;
  const surface =
    document.querySelector('dialog[open]') ??
    document.querySelector('.bank-menu');
  let visibleContainer = surface
    ? currentContainer && surface.contains(currentContainer)
      ? currentContainer
      : surface
    : currentContainer;
  let container = 'document';
  if (visibleContainer && visibleContainer.isConnected) {
    if (!containers.has(visibleContainer))
      containers.set(visibleContainer, `s${Math.min(999, ++containerNumber)}`);
    container = containers.get(visibleContainer)!;
  } else {
    currentContainer = null;
    visibleContainer = null;
  }
  return {
    route: location.pathname,
    width: v?.width ?? innerWidth,
    height: v?.height ?? innerHeight,
    scale: v?.scale ?? 1,
    offsetX: v?.offsetLeft ?? 0,
    offsetY: v?.offsetTop ?? 0,
    scrollX: scrollX + (v?.offsetLeft ?? 0),
    scrollY: scrollY + (v?.offsetTop ?? 0),
    container,
    containerX: visibleContainer?.scrollLeft ?? scrollX,
    containerY: visibleContainer?.scrollTop ?? scrollY,
  };
}
export function captureChange(
  kind: 'route' | 'ui' | 'error' | 'content' | 'viewport',
) {
  if (kind === 'route') currentContainer = null;
  window.dispatchEvent(
    new CustomEvent('softek-capture-change', { detail: kind }),
  );
}
export function stopObserving() {
  stopCurrent();
  stopCurrent = () => {};
  currentContainer = null;
}
// Local observation emits only typed timing/geometry. DOM nodes, mutations,
// input values, status/error text and URL query strings never cross the bridge.
export function startObserving(
  send: (event: Record<string, unknown>) => void,
  eligible: () => boolean,
  pageContext = false,
) {
  stopObserving();
  let active = true,
    lastTouch = -Infinity,
    lastMotion = -Infinity;
  const cleanup: (() => void)[] = [],
    timers = new Set<ReturnType<typeof setTimeout>>(),
    rafs = new Set<number>();
  let motion: ReturnType<typeof setTimeout> | null = null,
    pendingMotionCapture = false,
    inputTimer: ReturnType<typeof setTimeout> | null = null,
    settle: ReturnType<typeof setTimeout> | null = null;
  let touch: { x: number; y: number; at: number } | null = null;
  const checkpoints = new Map<
    string,
    { x: number; y: number; previousY: number; direction: number }
  >();
  checkpoints.set('document', {
    x: scrollX,
    y: scrollY,
    previousY: scrollY,
    direction: 0,
  });
  const emit = (
    kind: Kind,
    capture = false,
    extra: Record<string, number> = {},
  ) => {
    if (
      !active ||
      !eligible() ||
      document.visibilityState !== 'visible' ||
      location.pathname === '/login' ||
      location.pathname.startsWith('/controls')
    )
      return;
    send({
      type: 'interaction',
      kind,
      capture,
      webNow: performance.now(),
      geometry: captureGeometry(),
      ...(pageContext ? { page: capturePageGeometry() } : {}),
      ...extra,
    });
  };
  const later = (action: () => void, ms: number) => {
    const t = setTimeout(() => {
      timers.delete(t);
      action();
    }, ms);
    timers.add(t);
    return t;
  };
  const afterPaint = (kind: Exclude<Kind, 'tap' | 'swipe' | 'scroll'>) => {
    const first = requestAnimationFrame(() => {
      rafs.delete(first);
      const second = requestAnimationFrame(() => {
        rafs.delete(second);
        emit(kind, true);
      });
      rafs.add(second);
    });
    rafs.add(first);
  };
  const listen = (
    target: EventTarget,
    name: string,
    handler: EventListener,
    options: AddEventListenerOptions = { passive: true },
  ) => {
    target.addEventListener(name, handler, options);
    cleanup.push(() => target.removeEventListener(name, handler, options));
  };
  const point = (x: number, y: number) => {
    const g = captureGeometry();
    return {
      x: Math.max(0, Math.min(1, (x - g.offsetX) / g.width)),
      y: Math.max(0, Math.min(1, (y - g.offsetY) / g.height)),
    };
  };
  const motionSample = (capture = false) => {
    pendingMotionCapture ||= capture;
    if (motion) return;
    motion = later(
      () => {
        motion = null;
        lastMotion = performance.now();
        emit('scroll', pendingMotionCapture);
        pendingMotionCapture = false;
      },
      Math.max(0, 100 - (performance.now() - lastMotion)),
    );
  };
  listen(
    document,
    'scroll',
    (event) => {
      currentContainer =
        event.target instanceof Element &&
        event.target !== document.documentElement &&
        event.target !== document.body
          ? event.target
          : null;
      const g = captureGeometry(),
        old = checkpoints.get(g.container) ?? {
          x: g.containerX,
          y: g.containerY,
          previousY: g.containerY,
          direction: 0,
        };
      const change = g.containerY - old.previousY,
        sign = Math.sign(change),
        crossed =
          Math.abs(g.containerY - old.y) >= g.height * 0.45 ||
          Math.abs(g.containerX - old.x) >= g.width * 0.45,
        reversed =
          old.direction !== 0 &&
          sign !== 0 &&
          sign !== old.direction &&
          Math.abs(change) > 4;
      if (crossed || reversed) {
        old.x = g.containerX;
        old.y = g.containerY;
      }
      old.previousY = g.containerY;
      if (sign) old.direction = sign;
      checkpoints.set(g.container, old);
      motionSample(crossed || reversed);
      if (settle) clearTimeout(settle);
      settle = later(() => {
        settle = null;
        motionSample(true);
      }, 180);
    },
    { passive: true, capture: true },
  );
  listen(
    document,
    'scrollend',
    () => {
      if (settle) clearTimeout(settle);
      settle = null;
      motionSample(true);
    },
    { passive: true, capture: true },
  );
  listen(document, 'touchstart', (event) => {
    const e = event as TouchEvent;
    lastTouch = performance.now();
    touch =
      e.touches.length === 1
        ? {
            ...point(e.touches[0].clientX, e.touches[0].clientY),
            at: lastTouch,
          }
        : null;
  });
  listen(document, 'touchend', (event) => {
    lastTouch = performance.now();
    const e = event as TouchEvent,
      from = touch;
    touch = null;
    if (!from || e.touches.length || e.changedTouches.length !== 1) return;
    const end = point(e.changedTouches[0].clientX, e.changedTouches[0].clientY),
      durationMs = Math.round(lastTouch - from.at);
    if (durationMs > 60000) return;
    if (Math.hypot(end.x - from.x, end.y - from.y) < 0.025)
      emit('tap', false, { x: from.x, y: from.y });
    else
      emit('swipe', false, {
        x: from.x,
        y: from.y,
        endX: end.x,
        endY: end.y,
        durationMs,
      });
  });
  listen(document, 'touchcancel', () => {
    touch = null;
    lastTouch = performance.now();
  });
  listen(document, 'click', (event) => {
    if (performance.now() - lastTouch < 800) return;
    const e = event as MouseEvent;
    if (e.detail === 0) return;
    emit('tap', false, point(e.clientX, e.clientY));
  });
  listen(window, 'softek-capture-change', (event) => {
    const kind = (event as CustomEvent).detail;
    if (['route', 'ui', 'error', 'content', 'viewport'].includes(kind))
      afterPaint(kind);
  });
  listen(
    document,
    'load',
    (event) => {
      if (event.target instanceof HTMLImageElement) afterPaint('content');
    },
    { capture: true, passive: true },
  );
  listen(document, 'toggle', () => afterPaint('ui'), {
    capture: true,
    passive: true,
  });
  listen(document, 'invalid', () => afterPaint('error'), {
    capture: true,
    passive: true,
  });
  listen(document, 'change', () => afterPaint('content'));
  listen(document, 'input', () => {
    if (inputTimer) clearTimeout(inputTimer);
    inputTimer = later(() => {
      inputTimer = null;
      afterPaint('content');
    }, 300);
  });
  const resized = () => afterPaint('viewport');
  listen(window, 'resize', resized);
  if (window.visualViewport) {
    listen(window.visualViewport, 'resize', resized);
    listen(window.visualViewport, 'scroll', () => motionSample(true));
  }
  // Explicit React page/menu/alert hooks are primary. This local fallback catches
  // asynchronous committed customer content changes. Upload counters are outside
  // main and cannot create a screenshot/status feedback loop.
  const main = document.getElementById('main'),
    observer = new MutationObserver(() =>
      afterPaint(main?.querySelector('[role="alert"]') ? 'error' : 'content'),
    );
  if (main)
    observer.observe(main, {
      subtree: true,
      childList: true,
      characterData: true,
    });
  cleanup.push(() => observer.disconnect());
  emit('viewport');
  stopCurrent = () => {
    active = false;
    for (const f of cleanup) f();
    for (const t of timers) clearTimeout(t);
    for (const r of rafs) cancelAnimationFrame(r);
    touch = null;
  };
  return stopObserving;
}
