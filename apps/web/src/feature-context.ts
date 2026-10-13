import { accountPageAtPath } from '../../api/src/account-pages.js';
import type { State } from './api.js';
import { featureAtPath, getFeature } from '../../api/src/features.js';
export type FeatureEntry = {
  userId: string;
  runId: string;
  featureId: string;
  selectionId: string;
  bannerId: string;
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
    /^[a-z0-9-]{1,40}$/.test(v.bannerId)
    ? v
    : null;
}
export function analyticsContext(
  state: State,
  path: string,
  value: unknown,
  banner: {
    bannerId: string | null;
    destination: string;
    campaignId: string | null;
  } | null = null,
) {
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
  return {
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
      ? (entry?.bannerId ?? 'none')
      : path === '/'
        ? (banner?.bannerId ?? 'none')
        : 'none',
  };
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
