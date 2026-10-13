// Shared, bounded navigation identities; no customer/account IDs in route tags.
export const accountPages = [
  {
    kind: 'checking',
    href: '/accounts/checking',
    routeKey: 'account-checking',
  },
  { kind: 'savings', href: '/accounts/savings', routeKey: 'account-savings' },
  { kind: 'credit', href: '/accounts/credit-card', routeKey: 'account-credit' },
] as const;

export const accountPageAtPath = (path: string) =>
  accountPages.find((page) => page.href === path);
