export function isAdminRoute(path: string) {
  return path === '/controls' || path.startsWith('/controls/');
}

export const adminSections = [
  { key: 'customers', label: 'Manage Customers', href: '/controls/customers' },
  { key: 'banners', label: 'Manage Banners', href: '/controls/banners' },
  {
    key: 'feature-explorer',
    label: 'Feature Explorer',
    href: '/controls/feature-explorer',
  },
  { key: 'report', label: 'Adoption Report', href: '/controls/report' },
  { key: 'clarity', label: 'Clarity Settings', href: '/controls/clarity' },
  { key: 'recordings', label: 'Recordings', href: '/controls/recordings' },
];

export function adminTitle(path: string) {
  if (path.startsWith('/controls/recordings/')) return 'Review Recording';
  if (path.startsWith('/controls/feature-explorer/'))
    return 'Configure Explore Feature';
  if (path === '/controls/customers/generate') return 'Generate Customers';
  if (path === '/controls/customers/new') return 'Create Customer';
  if (path.startsWith('/controls/customers/')) return 'Customer Details';
  return (
    adminSections.find((section) => section.href === path)?.label ??
    (path === '/controls' ? 'Admin Home' : 'Admin Page')
  );
}
