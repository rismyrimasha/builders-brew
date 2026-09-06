import { Customer } from '../models/Customer.js';
import { Campaign } from '../models/Campaign.js';
import { MessageLog } from '../models/MessageLog.js';
import { isSmsEnabled, sendSms } from './notifyLk.js';

const MAX_SMS_CHARS = 621;

// SMS has no rich text, so "bold" = ALL CAPS for the brand and reward names.
// (Unicode bold glyphs would force the costlier UCS-2 encoding — avoided.)
const BRAND = 'BUILDERS BREW';

function firstName(name) {
  const part = String(name || '').trim().split(/\s+/)[0];
  return part || 'there';
}

function rupeesToUnlock(pointsShort, settings) {
  const rate = Number(settings?.points_per_100) || 0;
  const short = Number(pointsShort) || 0;
  if (rate <= 0 || short <= 0) return 0;
  return Math.ceil(short / rate) * 100;
}

/**
 * Turn an admin-entered reward name into a short SMS label:
 *   "1 Brownie · 200 pts" -> "Brownie"
 * Drops a leading count, a trailing "<sep> N pts/points" suffix, and any
 * non-ASCII (keeps the SMS on the cheaper GSM-7 encoding).
 */
function rewardLabel(name) {
  const s = String(name || '')
    .replace(/[^\x00-\x7F]+/g, ' ')
    .replace(/[\s|(–—·-]+\d+\s*(?:pts?|points?)\)?\s*$/i, '')
    .replace(/^\s*\d+\s*x?\s+/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return s || 'reward';
}

function money(rs) {
  return `Rs ${Number(rs).toLocaleString('en-LK')}`;
}

function pointsWord(n) {
  return `${n} point${Math.abs(Number(n)) === 1 ? '' : 's'}`;
}

export function estimateSmsSegments(text) {
  const len = String(text || '').length;
  const unicode = /[^\x00-\x7F]/.test(text || '');
  const per = unicode ? 70 : 160;
  return Math.max(1, Math.ceil(len / per));
}

/**
 * Reward-guidance line of the order SMS. Built entirely from live data:
 * `profile.reward_tiers` (active rewards with names + costs) and the current
 * earn rate `settings.points_per_100`. Change a reward or the rate and the
 * next order SMS reflects it — no code change. Returns '' when there are no
 * active rewards or no useful guidance.
 */
function composeOrderRewardLine({ total, profile, settings }) {
  const tiers = (profile?.reward_tiers || [])
    .map((t) => {
      const cost = Number(t.points_cost) || 0;
      return {
        cost,
        short: Number.isFinite(t.points_short) ? t.points_short : Math.max(0, cost - total),
        affordable: t.affordable ?? total >= cost,
        label: rewardLabel(t.menu_item?.name || t.cash_credit?.name || `${cost} pt reward`).toUpperCase(),
      };
    })
    .sort((a, b) => a.cost - b.cost);

  if (tiers.length === 0) return '';

  const affordable = tiers.filter((t) => t.affordable);
  const locked = tiers.filter((t) => !t.affordable);

  // Every reward is already within reach — point at the best one.
  if (locked.length === 0) {
    const best = affordable[affordable.length - 1];
    return `You can redeem a free ${best.label} now - just ask at the counter.`;
  }

  // Can redeem something now, with a bigger reward still to aim for.
  if (affordable.length > 0) {
    const best = affordable[affordable.length - 1];
    const nextUp = locked[0];
    const rs = rupeesToUnlock(nextUp.short, settings);
    const tail = rs > 0 ? ` Spend about ${money(rs)} more to unlock a free ${nextUp.label}.` : '';
    return `You can redeem a free ${best.label} now!${tail}`;
  }

  // Nothing redeemable yet — show the next one or two tiers.
  const first = locked[0];
  const rs1 = rupeesToUnlock(first.short, settings);
  if (rs1 <= 0) return '';

  const second = locked[1];
  if (second) {
    const rs2 = rupeesToUnlock(second.short, settings);
    if (rs2 > 0) {
      return `Spend about ${money(rs1)} more for a free ${first.label}, or ${money(rs2)} more for a free ${second.label}.`;
    }
  }
  return `Spend about ${money(rs1)} more for a free ${first.label}.`;
}

export function composeOrderSms({ customer, pointsEarned, profile, settings }) {
  const name = firstName(customer?.name);
  const total = profile?.balance?.available ?? 0;

  const lines = [
    `Dear ${name}, thank you for your order at ${BRAND}.`,
    `You earned ${pointsWord(pointsEarned)}. Your total is now ${total}.`,
  ];

  const rewardLine = composeOrderRewardLine({ total, profile, settings });
  if (rewardLine) lines.push(rewardLine);

  return lines.join('\n').slice(0, MAX_SMS_CHARS);
}

export function composeRedemptionSms({ customer, reward, balance }) {
  const name = firstName(customer?.name);
  const label = rewardLabel(reward?.name || 'reward').toUpperCase();
  const total = balance?.available ?? balance?.balance ?? 0;

  return [
    `Dear ${name}, you just redeemed a free ${label} at ${BRAND} - enjoy every bite!`,
    `Your points balance is now ${total}. Thanks for being part of the crew; your next reward is already brewing.`,
  ]
    .join('\n')
    .slice(0, MAX_SMS_CHARS);
}

function serializeResponse(data) {
  try {
    return JSON.stringify(data || {}).slice(0, 800);
  } catch {
    return '';
  }
}

export async function sendAndLog({
  customer = null,
  phone,
  body,
  kind,
  campaignId = null,
  earnTransactionId = null,
}) {
  const targetPhone = phone || customer?.phone || '';
  const text = String(body || '').trim().slice(0, MAX_SMS_CHARS);

  const base = {
    customer_id: customer?._id || customer?.id || null,
    phone: targetPhone,
    kind,
    campaign_id: campaignId,
    body: text,
    provider: 'notify.lk',
  };
  if (earnTransactionId) base.earn_transaction_id = earnTransactionId;

  if (earnTransactionId) {
    const existing = await MessageLog.findOne({ earn_transaction_id: earnTransactionId });
    if (existing && (existing.status === 'sent' || existing.status === 'skipped')) {
      return existing;
    }
  }

  if (!text) {
    return MessageLog.create({ ...base, status: 'failed', error: 'empty_message' });
  }

  if (customer?.sms_opt_out) {
    return MessageLog.create({ ...base, status: 'skipped', error: 'opted_out' });
  }

  if (!isSmsEnabled()) {
    return MessageLog.create({ ...base, status: 'skipped', error: 'sms_disabled' });
  }

  let log = earnTransactionId
    ? await MessageLog.findOne({ earn_transaction_id: earnTransactionId })
    : null;

  if (!log) {
    try {
      log = await MessageLog.create({ ...base, status: 'queued' });
    } catch (err) {
      if (err.code === 11000 && earnTransactionId) {
        return MessageLog.findOne({ earn_transaction_id: earnTransactionId });
      }
      throw err;
    }
  }

  const result = await sendSms({
    toLocal: targetPhone,
    message: text,
    contactName: customer?.name,
  });

  log.status = result.ok ? 'sent' : result.skipped ? 'skipped' : 'failed';
  log.error = result.ok ? '' : result.error || 'send_failed';
  log.provider_response = serializeResponse(result.data);
  log.sent_at = result.ok ? new Date() : null;
  await log.save();
  return log;
}

export async function sendOrderSms({ customer, transaction, profile, settings }) {
  if (!transaction?.points_earned) return null;

  const body = composeOrderSms({
    customer,
    pointsEarned: transaction.points_earned,
    profile,
    settings,
  });

  return sendAndLog({
    customer,
    phone: customer.phone,
    body,
    kind: 'order_earned',
    earnTransactionId: transaction._id,
  });
}

export function queueOrderSms(payload) {
  setImmediate(() => {
    sendOrderSms(payload).catch((err) => {
      console.error('[sms] order send failed:', err.message || err);
    });
  });
}

export async function sendRedemptionSms({ customer, reward, balance }) {
  if (!customer?.phone) return null;

  const body = composeRedemptionSms({ customer, reward, balance });

  return sendAndLog({
    customer,
    phone: customer.phone,
    body,
    kind: 'redemption',
  });
}

export function queueRedemptionSms(payload) {
  setImmediate(() => {
    sendRedemptionSms(payload).catch((err) => {
      console.error('[sms] redemption send failed:', err.message || err);
    });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function processCampaign(campaignId) {
  const campaign = await Campaign.findById(campaignId);
  if (!campaign) return;

  campaign.status = 'sending';
  campaign.error = '';
  await campaign.save();

  const customers = await Customer.find({ sms_opt_out: { $ne: true } })
    .select('name phone sms_opt_out')
    .lean();

  campaign.total = customers.length;
  campaign.sent = 0;
  campaign.failed = 0;
  campaign.skipped = 0;
  await campaign.save();

  for (const customer of customers) {
    const log = await sendAndLog({
      customer,
      phone: customer.phone,
      body: campaign.body,
      kind: 'promo',
      campaignId: campaign._id,
    });

    if (log.status === 'sent') campaign.sent += 1;
    else if (log.status === 'skipped') campaign.skipped += 1;
    else campaign.failed += 1;

    const processed = campaign.sent + campaign.failed + campaign.skipped;
    if (processed % 10 === 0) await campaign.save();

    await sleep(250);
  }

  campaign.status = 'sent';
  await campaign.save();
}

export function queueCampaign(campaignId) {
  setImmediate(() => {
    processCampaign(campaignId).catch(async (err) => {
      console.error('[sms] campaign failed:', err.message || err);
      await Campaign.findByIdAndUpdate(campaignId, {
        status: 'failed',
        error: err.message || 'campaign_failed',
      }).catch(() => {});
    });
  });
}
