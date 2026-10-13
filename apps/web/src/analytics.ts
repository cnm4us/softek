import { renderedSummaryBanner } from './summary-explorer-context';
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
type Policy = State['analytics'];
let policy: Policy | null = null;
let captureUser: string | null = null;
export function consentChoice(state: State): 'granted' | 'denied' | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem('softek_analytics_consent') ?? 'null',
    );
    return value?.userId === state.user.id &&
      value?.revision === state.analytics.revision &&
      ['granted', 'denied'].includes(value.choice)
      ? value.choice
      : null;
  } catch {
    return null;
  }
}
export function stopCollection() {
  if (window.clarity) {
    window.clarity('consentv2', {
      ad_Storage: 'denied',
      analytics_Storage: 'denied',
    });
    window.clarity('stop');
  }
  // Remove this site's first-party Clarity cookies even if the script is blocked.
  const domains = [
    location.hostname,
    ...location.hostname
      .split('.')
      .slice(1)
      .map((_, i) =>
        location.hostname
          .split('.')
          .slice(i + 1)
          .join('.'),
      ),
  ];
  for (const name of ['_clck', '_clsk']) {
    document.cookie = `${name}=; Max-Age=0; Path=/; SameSite=Lax`;
    for (const domain of domains)
      document.cookie = `${name}=; Max-Age=0; Path=/; Domain=${domain}; SameSite=Lax`;
  }
  captureUser = null;
}
export function syncCollectionPolicy(next: Policy) {
  const changed =
    policy &&
    (policy.revision !== next.revision || policy.enabled !== next.enabled);
  policy = next;
  if (changed || !next.enabled) {
    const loaded = Boolean(window.clarity);
    if (loaded) stopCollection();
    if (changed) sessionStorage.removeItem('softek_analytics_consent');
    if (loaded) window.location.reload();
  }
}
export function collectionAvailable(state: State) {
  return (
    !state.impersonation &&
    !isAdminRoute(location.pathname) &&
    state.analytics.enabled &&
    (policy === null ||
      (policy.enabled && policy.revision === state.analytics.revision)) &&
    import.meta.env?.VITE_CLARITY_ENABLED === 'true' &&
    Boolean(state.analytics.projectId?.match(/^[a-z0-9]{6,30}$/))
  );
}
export function initialize(state: State) {
  if (!collectionAvailable(state) || consentChoice(state) !== 'granted') return;
  if (captureUser && captureUser !== state.user.id) {
    stopCollection();
    window.location.reload();
    return;
  }
  captureUser = state.user.id;
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
  // Only loaded Summary artwork supplies banner context, never retained legacy selections.
  applyContext(
    window.clarity!,
    state,
    analyticsContext(
      state,
      location.pathname,
      window.history.state?.usr?.featureEntry,
      location.pathname === '/' ? renderedSummaryBanner(state) : null,
    ),
  );
}
export function confirmed(state: State, names: string[]) {
  if (!collectionAvailable(state) || consentChoice(state) !== 'granted') return;
  initialize(state);
  for (const name of names)
    if (eventNames.includes(name as Name)) window.clarity?.('event', name);
}
export function chooseConsent(state: State, allow: boolean) {
  sessionStorage.setItem(
    'softek_analytics_consent',
    JSON.stringify({
      choice: allow ? 'granted' : 'denied',
      userId: state.user.id,
      revision: state.analytics.revision,
    }),
  );
  if (allow) initialize(state);
  else if (window.clarity) {
    stopCollection();
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
  if (!collectionAvailable(state) || consentChoice(state) !== 'granted') return;
  initialize(state);
  window.clarity?.('event', name);
}
