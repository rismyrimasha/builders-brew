// Role helpers shared across staff + admin screens.
// Server roles: 'staff' | 'admin' (cafe owner) | 'platform_owner'.

export const ADMIN_ROLES = ['admin', 'platform_owner'];

export function isAdminRole(role) {
  return ADMIN_ROLES.includes(role);
}

export function roleLabel(role) {
  if (role === 'platform_owner') return 'Platform Owner';
  if (role === 'admin') return 'Admin';
  if (role === 'staff') return 'Staff';
  return role || '';
}
