import { features } from './features.js';
// Admin-controlled placements; titles and destinations always come from the catalog.
export const explorerSections = [
  { key: 'summary', label: 'Account Summary', href: '/' },
  {
    key: 'account-checking',
    label: 'Everyday Checking',
    href: '/accounts/checking',
  },
  {
    key: 'account-savings',
    label: 'Harbor Savings',
    href: '/accounts/savings',
  },
  {
    key: 'account-credit',
    label: 'Harbor Credit Card',
    href: '/accounts/credit-card',
  },
] as const;
export type ExplorerSection = (typeof explorerSections)[number]['key'];
export const explorerBannerAnalyticsId = (
  section: ExplorerSection,
  featureId: string,
) => `${section}-${featureId}`;
export const explorerBannerAnalyticsIds = explorerSections.flatMap(({ key }) =>
  features.map(({ id }) => explorerBannerAnalyticsId(key, id)),
);
export type ExplorerWidget = {
  id: string;
  analyticsId: string;
  section: ExplorerSection;
  featureId: string;
  title: string;
  href: string;
  imageUrl: string | null;
  altText: string;
  enabled: boolean;
  sortOrder: number;
};
