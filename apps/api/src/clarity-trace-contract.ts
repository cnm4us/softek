import { features } from './features.js';
import { accountPages } from './account-pages.js';
import { explorerBannerAnalyticsIds } from './feature-explorer-config.js';

export const traceCommands = [
  'event',
  'set',
  'identify',
  'consentv2',
  'stop',
] as const;
export const traceEvents = [
  'eligible',
  'promotion_visible',
  'promotion_clicked',
  'details_viewed',
  'enrollment_started',
  'enrollment_completed',
  'first_use',
  'repeat_use',
  'banner_visible',
  'banner_clicked',
  'page_view',
  'menu_open',
  'menu_selected',
  'placeholder_action',
  'feature_viewed',
  'feature_cta_clicked',
];
export const traceRoutes = [
  'summary',
  'transfers',
  'bill-pay',
  'cards',
  'savings-goals',
  'statements',
  'support',
  'goals',
  'enroll',
  'about',
  'savings',
  'loans',
  'discovery-preferences',
  'explore',
  'unknown',
  ...features.map((f) => f.id),
  ...accountPages.map((p) => p.routeKey),
];
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
export const traceUuid = (v: unknown): v is string =>
  typeof v === 'string' && uuid.test(v);
export function safeTag(key: string, value: unknown): boolean {
  if (typeof value !== 'string') return false;
  switch (key) {
    case 'institution':
      return value === 'harbor';
    case 'actor':
      return ['human', 'automation'].includes(value);
    case 'variant':
      return ['baseline', 'value'].includes(value);
    case 'route':
      return traceRoutes.includes(value);
    case 'feature':
      return value === 'none' || features.some((f) => f.id === value);
    case 'service':
      return (
        ['banking', 'savings-goals', 'none'].includes(value) ||
        features.some((f) => f.id === value)
      );
    case 'campaign':
      return ['none', 'savings-launch'].includes(value);
    case 'run':
      return traceUuid(value);
    case 'cta-clicked':
      return (
        explorerBannerAnalyticsIds.includes(value) &&
        value.startsWith('summary-')
      );
    case 'banner':
      return (
        ['none', 'harbor-goals', 'harbor-bill-pay', 'harbor-cards'].includes(
          value,
        ) ||
        explorerBannerAnalyticsIds.includes(value) ||
        traceUuid(value)
      );
    default:
      return false;
  }
}
export function safeCall(command: string, args: unknown[]): boolean {
  if (JSON.stringify(args).length > 4096) return false;
  switch (command) {
    case 'stop':
      return args.length === 0;
    case 'event':
      return (
        args.length === 1 &&
        typeof args[0] === 'string' &&
        traceEvents.includes(args[0])
      );
    case 'set':
      return (
        args.length === 2 &&
        typeof args[0] === 'string' &&
        safeTag(args[0], args[1])
      );
    case 'identify':
      return (
        args.length === 3 &&
        traceUuid(args[0]) &&
        traceUuid(args[1]) &&
        typeof args[2] === 'string' &&
        traceRoutes.includes(args[2])
      );
    case 'consentv2': {
      const v = args[0] as Record<string, unknown> | null;
      return (
        args.length === 1 &&
        Boolean(v) &&
        typeof v === 'object' &&
        Object.keys(v!).length === 2 &&
        v!.ad_Storage === 'denied' &&
        ['granted', 'denied'].includes(String(v!.analytics_Storage))
      );
    }
    default:
      return false;
  }
}
export type TraceCall = {
  id: string;
  sequence: number;
  command: (typeof traceCommands)[number];
  args: unknown[];
  observedAt: string;
  durationUs: number;
  sdkState: 'queued' | 'loaded' | 'absent';
  outcome: 'returned' | 'threw' | 'absent';
  metadata: Record<string, string>;
};
