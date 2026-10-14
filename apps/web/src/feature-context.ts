import { accountPageAtPath } from '../../api/src/account-pages.js';
import type { State } from './api.js';
import { featureAtPath, getFeature } from '../../api/src/features.js';
import { explorerBannerAnalyticsId } from '../../api/src/feature-explorer-config.js';
export type FeatureEntry = {
  userId: string;
  runId: string;
  featureId: string;
  selectionId: string;
  bannerId: string;
  bannerAnalyticsId?: string;
};
export function featureEntry(
  state: State,
  featureId: string,
  value: unknown,
): FeatureEntry | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as FeatureEntry;
  return v.userId === state.user.id &&
    v.runId === state.runId &&
    v.featureId === featureId &&
    typeof v.selectionId === 'string' &&
    /^[a-f0-9-]{36}$/i.test(v.selectionId) &&
    typeof v.bannerId === 'string' &&
    /^[a-z0-9-]{1,40}$/.test(v.bannerId) &&
    (v.bannerAnalyticsId === undefined ||
      v.bannerAnalyticsId === explorerBannerAnalyticsId('summary', featureId))
    ? v
    : null;
}
export function bannerCtaAnalyticsId(
  state: State,
  path: string,
  value: unknown,
): string | null {
  const feature = featureAtPath(path);
  return feature
    ? (featureEntry(state, feature.id, value)?.bannerAnalyticsId ?? null)
    : null;
}
type ContextTags = { route: string } & Record<string, string>;
export type ContextBanner = {
  bannerId: string | null;
  analyticsId?: string;
  destination: string;
  campaignId: string | null;
};
export function analyticsContext(
  state: State,
  path: string,
  value: unknown,
  banner: ContextBanner | null = null,
  bannerPending = false,
): ContextTags {
  const feature = featureAtPath(path),
    entry = feature ? featureEntry(state, feature.id, value) : null;
  const savings = ['/savings-goals', '/enroll', '/goals'].includes(path);
  const summaryFeature =
    path === '/' && banner ? getFeature(banner.destination) : null;
  const known = [
    'transfers',
    'bill-pay',
    'cards',
    'savings-goals',
    'enroll',
    'goals',
    'statements',
    'support',
    'about',
    'savings',
    'loans',
    'discovery-preferences',
    'explore',
  ];
  const tags = {
    institution: 'harbor',
    actor: state.analytics.actor,
    variant: state.variant,
    route:
      accountPageAtPath(path)?.routeKey ??
      feature?.id ??
      (path === '/'
        ? 'summary'
        : known.includes(path.slice(1))
          ? path.slice(1)
          : 'unknown'),
    feature: feature?.id ?? summaryFeature?.id ?? 'none',
    service:
      feature?.id ??
      summaryFeature?.id ??
      (savings || (path === '/' && banner?.campaignId === 'savings-launch')
        ? 'savings-goals'
        : 'banking'),
    campaign:
      savings || (path === '/' && banner?.campaignId === 'savings-launch')
        ? 'savings-launch'
        : 'none',
    banner: feature
      ? (entry?.bannerAnalyticsId ?? entry?.bannerId ?? 'none')
      : path === '/'
        ? (banner?.analyticsId ?? banner?.bannerId ?? 'none')
        : 'none',
  };
  if (path === '/' && bannerPending) {
    const { feature, service, campaign, banner, ...known } = tags;
    return known;
  }
  return tags;
}
export function applyContext(
  clarity: (command: string, ...args: string[]) => void,
  state: State,
  tags: ReturnType<typeof analyticsContext>,
) {
  clarity('identify', state.user.id, state.visitId, tags.route);
  clarity('set', 'run', state.runId);
  for (const [key, value] of Object.entries(tags)) clarity('set', key, value);
}

// One updater per browser document. Only successfully invoked context is cached.
export function createContextUpdater() {
  let owner = '',
    identity = '';
  const values = new Map<string, string>();
  const reset = () => {
    owner = '';
    identity = '';
    values.clear();
  };
  return {
    reset,
    apply(
      clarity: (command: string, ...args: string[]) => void,
      state: State,
      tags: ReturnType<typeof analyticsContext>,
    ) {
      const nextOwner = JSON.stringify([
        state.user.id,
        state.runId,
        state.visitId,
      ]);
      if (owner !== nextOwner) {
        reset();
        owner = nextOwner;
      }
      applyContext(
        (command, ...args) => {
          if (command === 'identify') {
            const nextIdentity = JSON.stringify(args);
            if (identity === nextIdentity) return;
            clarity(command, ...args);
            identity = nextIdentity;
          } else {
            const [key, value] = args as [string, string];
            if (values.get(key) === value) return;
            clarity(command, ...args);
            values.set(key, value);
          }
        },
        state,
        tags,
      );
    },
  };
}
