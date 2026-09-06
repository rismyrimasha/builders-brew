/**
 * Normalize and validate Sri Lanka mobile numbers.
 * Accepts: 07XXXXXXXX, 7XXXXXXXX, +94 7X XXX XXXX, 947XXXXXXXX
 * Stores as: 07XXXXXXXX (10 digits)
 */

const LOCAL_MOBILE = /^07[0-9]\d{7}$/;

export function normalizePhone(phone) {
  let digits = String(phone || '').replace(/\D/g, '');

  if (digits.startsWith('94') && digits.length === 11) {
    digits = `0${digits.slice(2)}`;
  } else if (digits.length === 9 && digits.startsWith('7')) {
    digits = `0${digits}`;
  }

  return digits;
}

export function validatePhone(phone) {
  const normalized = normalizePhone(phone);

  if (!normalized) {
    return { ok: false, error: 'Phone number is required' };
  }

  if (!LOCAL_MOBILE.test(normalized)) {
    return {
      ok: false,
      error: 'Enter a valid Sri Lanka mobile (e.g. 07XXXXXXXX — 10 digits)',
    };
  }

  return { ok: true, phone: normalized };
}

/** Notify.lk requires 947XXXXXXXX (no +). */
export function toNotifyLk(phone) {
  const local = normalizePhone(phone);
  if (!LOCAL_MOBILE.test(local)) return null;
  return `94${local.slice(1)}`;
}
