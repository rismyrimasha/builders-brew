import mongoose from 'mongoose';
import { EarnTransaction } from '../models/EarnTransaction.js';
import { RedemptionTransaction } from '../models/RedemptionTransaction.js';
import { AdjustmentTransaction } from '../models/AdjustmentTransaction.js';

function toObjectId(id) {
  return id instanceof mongoose.Types.ObjectId
    ? id
    : new mongoose.Types.ObjectId(String(id));
}

/** Expire any pending redemptions past their expiry time. */
export async function expireStaleRedemptions(customerId = null) {
  const filter = {
    status: 'pending',
    expires_at: { $lte: new Date() },
  };
  if (customerId) filter.customer_id = toObjectId(customerId);

  await RedemptionTransaction.updateMany(filter, {
    $set: { status: 'expired' },
  });
}

/**
 * Live balance from append-only ledger:
 * earned + adjustments - completed redemptions
 */
export async function getCustomerBalance(customerId) {
  const oid = toObjectId(customerId);
  await expireStaleRedemptions(oid);

  const [earned, adjusted, completed, pending] = await Promise.all([
    EarnTransaction.aggregate([
      { $match: { customer_id: oid } },
      { $group: { _id: null, total: { $sum: '$points_earned' } } },
    ]),
    AdjustmentTransaction.aggregate([
      { $match: { customer_id: oid } },
      { $group: { _id: null, total: { $sum: '$points_delta' } } },
    ]),
    RedemptionTransaction.aggregate([
      { $match: { customer_id: oid, status: 'completed' } },
      { $group: { _id: null, total: { $sum: '$points_spent' } } },
    ]),
    RedemptionTransaction.aggregate([
      { $match: { customer_id: oid, status: 'pending' } },
      { $group: { _id: null, total: { $sum: '$points_spent' } } },
    ]),
  ]);

  const pointsEarned = earned[0]?.total || 0;
  const pointsAdjusted = adjusted[0]?.total || 0;
  const pointsRedeemed = completed[0]?.total || 0;
  const pointsReserved = pending[0]?.total || 0;

  const balance = pointsEarned + pointsAdjusted - pointsRedeemed;
  const available = balance - pointsReserved;

  return {
    balance,
    available,
    points_earned: pointsEarned,
    points_adjusted: pointsAdjusted,
    points_redeemed: pointsRedeemed,
    points_reserved: pointsReserved,
  };
}

export function calculatePointsEarned(amountPaid, settings) {
  const { points_per_100, minimum_spend } = settings;
  if (amountPaid < minimum_spend) return 0;
  return Math.floor(amountPaid / 100) * points_per_100;
}

export async function getCustomerLedger(customerId, limit = 50) {
  const oid = toObjectId(customerId);
  await expireStaleRedemptions(oid);

  const [earns, redemptions, adjustments] = await Promise.all([
    EarnTransaction.find({ customer_id: oid })
      .populate('staff_id', 'name')
      .sort({ created_at: -1 })
      .limit(limit)
      .lean(),
    RedemptionTransaction.find({ customer_id: oid })
      .populate('reward_id', 'name type cash_value')
      .populate('staff_id', 'name')
      .sort({ created_at: -1 })
      .limit(limit)
      .lean(),
    AdjustmentTransaction.find({ customer_id: oid })
      .populate('admin_id', 'name')
      .sort({ created_at: -1 })
      .limit(limit)
      .lean(),
  ]);

  const entries = [
    ...earns.map((e) => ({
      kind: 'earn',
      id: e._id,
      points: e.points_earned,
      amount_paid: e.amount_paid,
      order_ref: e.order_ref,
      staff: e.staff_id,
      created_at: e.created_at,
    })),
    ...redemptions.map((r) => ({
      kind: 'redemption',
      id: r._id,
      points: -r.points_spent,
      status: r.status,
      reward: r.reward_id,
      redemption_code: r.redemption_code,
      staff: r.staff_id,
      expires_at: r.expires_at,
      completed_at: r.completed_at,
      created_at: r.created_at,
    })),
    ...adjustments.map((a) => ({
      kind: 'adjustment',
      id: a._id,
      points: a.points_delta,
      reason: a.reason,
      admin: a.admin_id,
      created_at: a.created_at,
    })),
  ];

  entries.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  return entries.slice(0, limit);
}
