import { toNotifyLk } from '../utils/phone.js';

const API = 'https://app.notify.lk/api/v1';

export function smsConfig() {
  return {
    userId: String(process.env.NOTIFY_USER_ID || '').trim(),
    apiKey: String(process.env.NOTIFY_API_KEY || '').trim(),
    senderId: String(process.env.NOTIFY_SENDER_ID || 'NotifyDEMO').trim(),
    enabled: String(process.env.SMS_ENABLED || 'true').toLowerCase() !== 'false',
  };
}

export function isSmsConfigured() {
  const c = smsConfig();
  return Boolean(c.userId && c.apiKey && c.senderId);
}

export function isSmsEnabled() {
  return smsConfig().enabled && isSmsConfigured();
}

export function publicSmsStatus() {
  const c = smsConfig();
  return {
    enabled: c.enabled,
    configured: isSmsConfigured(),
    sender_id: c.senderId,
    user_id: c.userId,
  };
}

export async function sendSms({ toLocal, message, contactName }) {
  if (!isSmsEnabled()) {
    return { ok: false, skipped: true, error: 'sms_disabled' };
  }

  const to = toNotifyLk(toLocal);
  if (!to) return { ok: false, error: 'invalid_phone' };

  const text = String(message || '').trim();
  if (!text) return { ok: false, error: 'empty_message' };
  if (text.length > 621) return { ok: false, error: 'message_too_long' };

  const c = smsConfig();
  const body = new URLSearchParams({
    user_id: c.userId,
    api_key: c.apiKey,
    sender_id: c.senderId,
    to,
    message: text,
  });
  if (contactName) body.set('contact_fname', String(contactName).slice(0, 80));

  try {
    const res = await fetch(`${API}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(12000),
    });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && String(data.status || '').toLowerCase() === 'success';
    const error = ok
      ? null
      : String(data.data || data.message || data.error || `http_${res.status}`);
    return { ok, data, error };
  } catch (err) {
    return { ok: false, error: err.message || 'network_error' };
  }
}

export async function getNotifyStatus() {
  if (!isSmsConfigured()) {
    return { ok: false, error: 'not_configured' };
  }

  const c = smsConfig();
  const url = new URL(`${API}/status`);
  url.searchParams.set('user_id', c.userId);
  url.searchParams.set('api_key', c.apiKey);

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    const data = await res.json().catch(() => ({}));
    const ok = res.ok && String(data.status || '').toLowerCase() === 'success';
    return {
      ok,
      active: Boolean(data.data?.active),
      acc_balance: data.data?.acc_balance ?? null,
      error: ok ? null : String(data.data || data.message || 'status_failed'),
    };
  } catch (err) {
    return { ok: false, error: err.message || 'network_error' };
  }
}
