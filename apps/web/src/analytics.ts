import { api, type State } from './api';
import { isAdminRoute } from './routes';
import { analyticsContext, applyContext } from './feature-context';
export const eventNames = [
  'eligible',
  'promotion_visible',
  'promotion_clicked',
  'details_viewed',
  'enrollment_started',
  'enrollment_completed',
  'first_use',
  'repeat_use',
] as const;
type Name = (typeof eventNames)[number];
type Consent = {
  ad_Storage: 'denied';
  analytics_Storage: 'granted' | 'denied';
};
type Clarity = ((command: string, ...args: (string | Consent)[]) => void) & {
  q?: (string | Consent)[][];
};
declare global {
  interface Window {
    clarity?: Clarity;
  }
}
export function collectionAvailable(state: State) {
  return (
    !isAdminRoute(location.pathname) &&
    state.analytics.enabled &&
    import.meta.env?.VITE_CLARITY_ENABLED === 'true' &&
    Boolean(state.analytics.projectId?.match(/^[a-z0-9]{6,30}$/))
  );
}
export function initialize(state: State) {
  if (
    !collectionAvailable(state) ||
    sessionStorage.getItem('softek_analytics_consent') !== 'granted'
  )
    return;
  if (!window.clarity) {
    const queue: (string | Consent)[][] = [];
    window.clarity = Object.assign(
      (command: string, ...args: (string | Consent)[]) => {
        queue.push([command, ...args]);
      },
      { q: queue },
    );
    window.clarity('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'granted',
    });
    const script = document.createElement('script');
    script.async = true;
    script.src = `https://www.clarity.ms/tag/${state.analytics.projectId}`;
    document.head.append(script);
  }
  let savedBanner = null;
  try {
    const saved = JSON.parse(sessionStorage.getItem('softek_banner') ?? 'null');
    if (saved?.userId === state.user.id) savedBanner = saved.banner;
  } catch {
    /* No saved artwork context. */
  }
  applyContext(
    window.clarity!,
    state,
    analyticsContext(
      state,
      location.pathname,
      window.history.state?.usr?.featureEntry,
      savedBanner,
    ),
  );
}
export function confirmed(state: State, names: string[]) {
  if (
    !collectionAvailable(state) ||
    sessionStorage.getItem('softek_analytics_consent') !== 'granted'
  )
    return;
  initialize(state);
  for (const name of names)
    if (eventNames.includes(name as Name)) window.clarity?.('event', name);
}
export function chooseConsent(state: State, allow: boolean) {
  sessionStorage.setItem(
    'softek_analytics_consent',
    allow ? 'granted' : 'denied',
  );
  if (allow) initialize(state);
  else if (window.clarity) {
    window.clarity('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'denied',
    });
    location.reload();
  }
}
export async function observe(
  state: State,
  name:
    | 'promotion_visible'
    | 'promotion_clicked'
    | 'details_viewed'
    | 'enrollment_started',
  placement: 'banner' | 'sidebar' | 'direct' = 'direct',
) {
  if (isAdminRoute(location.pathname)) return { accepted: false, events: [] };
  const presentation =
    placement === 'sidebar'
      ? matchMedia('(min-width: 1100px)').matches
        ? 'sidebar'
        : 'inline'
      : placement;
  const result = await api<{ accepted: boolean; events: string[] }>(
    '/events',
    { name, placement, presentation, observedAt: new Date().toISOString() },
    state.csrf,
  );
  confirmed(state, result.events);
  return result;
}

export function emitFeatureObservation(
  state: State,
  name: 'feature_viewed' | 'feature_cta_clicked',
) {
  if (
    !collectionAvailable(state) ||
    sessionStorage.getItem('softek_analytics_consent') !== 'granted'
  )
    return;
  initialize(state);
  window.clarity?.('event', name);
}
