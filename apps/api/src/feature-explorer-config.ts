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
export type ExplorerWidget = {
  id: string;
  section: ExplorerSection;
  featureId: string;
  title: string;
  href: string;
  imageUrl: string | null;
  altText: string;
  enabled: boolean;
  sortOrder: number;
};
