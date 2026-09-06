import { Router } from 'express';
import { customAlphabet } from 'nanoid';
import { requireStaff } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Customer } from '../models/Customer.js';
import { EarnTransaction } from '../models/EarnTransaction.js';
import { RedemptionTransaction } from '../models/RedemptionTransaction.js';
import { Reward } from '../models/Reward.js';
import { getSettings } from '../models/Settings.js';
import {
  calculatePointsEarned,
  getCustomerBalance,
  getCustomerLedger,
} from '../utils/ledger.js';
import { queueOrderSms, queueRedemptionSms } from '../services/sms.js';
import { normalizePhone, validatePhone } from '../utils/phone.js';

const router = Router();
router.use(requireStaff);

const makeCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

async function buildCustomerProfile(customer) {
  const balance = await getCustomerBalance(customer._id);
  const rewards = await Reward.find({ active: true })
    .populate('linked_menu_item_ids', 'name category price')
    .sort({ points_cost: 1 })
    .lean();

  const rewardsWithAffordability = rewards.map((r) => ({
    ...r,
    affordable: balance.available >= r.points_cost,
    points_short: Math.max(0, r.points_cost - balance.available),
  }));

  const tierMap = new Map();
  for (const r of rewardsWithAffordability) {
    if (!tierMap.has(r.points_cost)) {
      tierMap.set(r.points_cost, {
        points_cost: r.points_cost,
        affordable: r.affordable,
        points_short: r.points_short,
        menu_item: null,
        cash_credit: null,
      });
    }
    const tier = tierMap.get(r.points_cost);
    if (r.type === 'menu_item') tier.menu_item = r;
    if (r.type === 'cash_credit') tier.cash_credit = r;
  }
  const reward_tiers = [...tierMap.values()].sort((a, b) => a.points_cost - b.points_cost);

  const nextTier = reward_tiers.find((t) => !t.affordable) || reward_tiers[reward_tiers.length - 1] || null;
  const next_reward = nextTier
    ? {
        points_cost: nextTier.points_cost,
        name: `${nextTier.points_cost} pt reward`,
        affordable: nextTier.affordable,
        points_short: nextTier.points_short,
      }
    : null;

  const affordable = rewardsWithAffordability.filter((r) => r.affordable);
  const recent = await getCustomerLedger(customer._id, 15);

  return {
    customer: {
      id: customer._id,
      name: customer.name,
      phone: customer.phone,
      created_at: customer.created_at,
    },
    balance,
    next_reward,
    reward_tiers,
    affordable_rewards: affordable,
    rewards: rewardsWithAffordability,
    recent_activity: recent,
  };
}

router.get(
  '/customers/search',
  asyncHandler(async (req, res) => {
    const phone = normalizePhone(req.query.q);
    if (phone.length < 3) return res.json({ customers: [] });

    const customers = await Customer.find({ phone: new RegExp(phone) }).limit(20).lean();
    const withBalance = await Promise.all(
      customers.map(async (c) => {
        const balance = await getCustomerBalance(c._id);
        return {
          id: c._id,
          name: c.name,
          phone: c.phone,
          balance,
        };
      })
    );

    res.json({ customers: withBalance });
  })
);

router.post(
  '/customers',
  asyncHandler(async (req, res) => {
    const name = String(req.body.name || '').trim();
    const phoneCheck = validatePhone(req.body.phone);

    if (!name) return res.status(400).json({ error: 'Customer name is required' });
    if (!phoneCheck.ok) {
      return res.status(400).json({ error: phoneCheck.error });
    }

    const phone = phoneCheck.phone;

    const existing = await Customer.findOne({ phone });
    if (existing) {
      return res.status(409).json({
        error: 'This phone is already registered',
        customer: {
          id: existing._id,
          name: existing.name,
          phone: existing.phone,
        },
      });
    }

    const customer = await Customer.create({ name, phone });
    const profile = await buildCustomerProfile(customer);
    res.status(201).json(profile);
  })
);

router.get(
  '/customers/:id',
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });
    res.json(await buildCustomerProfile(customer));
  })
);

router.post(
  '/orders',
  asyncHandler(async (req, res) => {
    const { customer_id, amount_paid, order_ref } = req.body;
    const amount = Number(amount_paid);

    if (!customer_id) return res.status(400).json({ error: 'customer_id is required' });
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ error: 'Enter a valid amount paid' });
    }

    const customer = await Customer.findById(customer_id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const settings = await getSettings();
    const points = calculatePointsEarned(amount, settings);

    const txn = await EarnTransaction.create({
      customer_id: customer._id,
      amount_paid: amount,
      points_earned: points,
      staff_id: req.user.id,
      order_ref: order_ref || '',
    });

    const profile = await buildCustomerProfile(customer);

    queueOrderSms({
      customer,
      transaction: txn,
      profile,
      settings,
    });

    res.status(201).json({
      transaction: {
        id: txn._id,
        amount_paid: txn.amount_paid,
        points_earned: txn.points_earned,
        created_at: txn.created_at,
      },
      ...profile,
      settings: {
        points_per_100: settings.points_per_100,
        minimum_spend: settings.minimum_spend,
      },
    });
  })
);

router.post(
  '/orders/preview',
  asyncHandler(async (req, res) => {
    const amount = Number(req.body.amount_paid);
    if (!Number.isFinite(amount) || amount < 0) {
      return res.status(400).json({ error: 'Enter a valid amount' });
    }
    const settings = await getSettings();
    const points = calculatePointsEarned(amount, settings);
    res.json({
      amount_paid: amount,
      points_earned: points,
      points_per_100: settings.points_per_100,
      minimum_spend: settings.minimum_spend,
    });
  })
);

/** Staff redeems a reward for the customer immediately (verbal / at counter). */
router.post(
  '/redemptions',
  asyncHandler(async (req, res) => {
    const { customer_id, reward_id } = req.body;
    if (!customer_id || !reward_id) {
      return res.status(400).json({ error: 'customer_id and reward_id are required' });
    }

    const customer = await Customer.findById(customer_id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const reward = await Reward.findById(reward_id);
    if (!reward || !reward.active) {
      return res.status(404).json({ error: 'Reward not found or inactive' });
    }

    const balance = await getCustomerBalance(customer._id);
    if (balance.available < reward.points_cost) {
      return res.status(400).json({
        error: `Not enough points (available ${balance.available}, needs ${reward.points_cost})`,
      });
    }

    let redemption;
    let attempts = 0;
    while (attempts < 5) {
      try {
        redemption = await RedemptionTransaction.create({
          customer_id: customer._id,
          reward_id: reward._id,
          points_spent: reward.points_cost,
          redemption_code: `S-${makeCode()}`,
          status: 'completed',
          staff_id: req.user.id,
          expires_at: null,
          completed_at: new Date(),
        });
        break;
      } catch (err) {
        if (err.code === 11000) {
          attempts += 1;
          continue;
        }
        throw err;
      }
    }

    if (!redemption) {
      return res.status(500).json({ error: 'Could not record redemption' });
    }

    const profile = await buildCustomerProfile(customer);

    queueRedemptionSms({ customer, reward, balance: profile.balance });

    res.status(201).json({
      redemption: {
        id: redemption._id,
        code: redemption.redemption_code,
        status: redemption.status,
        points_spent: redemption.points_spent,
        completed_at: redemption.completed_at,
        reward: {
          id: reward._id,
          name: reward.name,
          type: reward.type,
          cash_value: reward.cash_value,
        },
        customer: {
          id: customer._id,
          name: customer.name,
          phone: customer.phone,
        },
      },
      ...profile,
    });
  })
);

export default router;
