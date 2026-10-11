export function isAdminRoute(path: string) {
  return path === '/controls' || path.startsWith('/controls/');
}

export const adminSections = [
  { key: 'customers', label: 'Manage Customers', href: '/controls/customers' },
  { key: 'banners', label: 'Manage Banners', href: '/controls/banners' },
  { key: 'report', label: 'Adoption Report', href: '/controls/report' },
];

export function adminTitle(path: string) {
  if (path === '/controls/customers/new') return 'Create Customer';
  if (path.startsWith('/controls/customers/')) return 'Customer Details';
  return (
    adminSections.find((section) => section.href === path)?.label ??
    (path === '/controls' ? 'Admin Home' : 'Admin Page')
  );
}
