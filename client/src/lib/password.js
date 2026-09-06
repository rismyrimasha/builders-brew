/**
 * Staff/admin passwords must be at least 8 characters,
 * include a letter, and include a special character.
 */
export function validatePassword(password) {
  const value = String(password || '');
  if (value.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!/[A-Za-z]/.test(value)) {
    return 'Password must include at least one letter';
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    return 'Password must include at least one special character (e.g. @ ! # $)';
  }
  return null;
}
