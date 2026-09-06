import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { requireStaff, requireAdmin, requirePlatformOwner } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { Customer } from '../models/Customer.js';
import { StaffAccount } from '../models/StaffAccount.js';
import { MenuItem } from '../models/MenuItem.js';
import { Reward } from '../models/Reward.js';
import { EarnTransaction } from '../models/EarnTransaction.js';
import { RedemptionTransaction } from '../models/RedemptionTransaction.js';
import { AdjustmentTransaction } from '../models/AdjustmentTransaction.js';
import { getSettings, Settings } from '../models/Settings.js';
import { Campaign } from '../models/Campaign.js';
import { MessageLog } from '../models/MessageLog.js';
import { getNotifyStatus, publicSmsStatus } from '../services/notifyLk.js';
import { estimateSmsSegments, queueCampaign, sendAndLog } from '../services/sms.js';
import { getCustomerBalance, getCustomerLedger } from '../utils/ledger.js';
import { validatePassword } from '../utils/password.js';
import { validatePhone } from '../utils/phone.js';

const router = Router();
router.use(requireStaff, requireAdmin);

function monthRange() {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setMonth(end.getMonth() + 1);
  return { start, end };
}

router.get(
  '/overview',
  asyncHandler(async (req, res) => {
    const { start, end } = monthRange();

    const [totalCustomers, earnedAgg, redeemedAgg, topRewards] = await Promise.all([
      Customer.countDocuments(),
      EarnTransaction.aggregate([
        { $match: { created_at: { $gte: start, $lt: end } } },
        {
          $group: {
            _id: null,
            points: { $sum: '$points_earned' },
            orders: { $sum: 1 },
            revenue: { $sum: '$amount_paid' },
          },
        },
      ]),
      RedemptionTransaction.aggregate([
        {
          $match: {
            status: 'completed',
            completed_at: { $gte: start, $lt: end },
          },
        },
        {
          $group: {
            _id: null,
            points: { $sum: '$points_spent' },
            count: { $sum: 1 },
          },
        },
      ]),
      RedemptionTransaction.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: '$reward_id', count: { $sum: 1 }, points: { $sum: '$points_spent' } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        {
          $lookup: {
            from: 'rewards',
            localField: '_id',
            foreignField: '_id',
            as: 'reward',
          },
        },
        { $unwind: { path: '$reward', preserveNullAndEmptyArrays: true } },
      ]),
    ]);

    res.json({
      total_customers: totalCustomers,
      this_month: {
        points_issued: earnedAgg[0]?.points || 0,
        points_redeemed: redeemedAgg[0]?.points || 0,
        orders: earnedAgg[0]?.orders || 0,
        revenue: earnedAgg[0]?.revenue || 0,
        redemptions: redeemedAgg[0]?.count || 0,
      },
      top_rewards: topRewards.map((r) => ({
        reward_id: r._id,
        name: r.reward?.name || 'Unknown',
        count: r.count,
        points: r.points,
      })),
    });
  })
);

// —— Rewards CRUD ——
router.get(
  '/rewards',
  asyncHandler(async (req, res) => {
    const rewards = await Reward.find()
      .populate('linked_menu_item_ids', 'name category price')
      .sort({ points_cost: 1 })
      .lean();
    res.json({ rewards });
  })
);

router.post(
  '/rewards',
  asyncHandler(async (req, res) => {
    const {
      name,
      description,
      points_cost,
      type,
      linked_menu_item_ids,
      cash_value,
      active,
    } = req.body;

    if (!name || !points_cost || !type) {
      return res.status(400).json({ error: 'name, points_cost, and type are required' });
    }

    const reward = await Reward.create({
      name,
      description: description || '',
      points_cost,
      type,
      linked_menu_item_ids: linked_menu_item_ids || [],
      cash_value: type === 'cash_credit' ? cash_value : null,
      active: active !== false,
    });

    res.status(201).json({ reward });
  })
);

router.put(
  '/rewards/:id',
  asyncHandler(async (req, res) => {
    const reward = await Reward.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    }).populate('linked_menu_item_ids', 'name category price');

    if (!reward) return res.status(404).json({ error: 'Reward not found' });
    res.json({ reward });
  })
);

router.delete(
  '/rewards/:id',
  asyncHandler(async (req, res) => {
    const reward = await Reward.findByIdAndDelete(req.params.id);
    if (!reward) return res.status(404).json({ error: 'Reward not found' });
    res.json({ reward });
  })
);

// —— Menu CRUD ——
router.get(
  '/menu',
  asyncHandler(async (req, res) => {
    const items = await MenuItem.find().sort({ category: 1, name: 1 }).lean();
    res.json({ items });
  })
);

router.post(
  '/menu',
  asyncHandler(async (req, res) => {
    const { name, category, price, active } = req.body;
    if (!name || !category || price == null) {
      return res.status(400).json({ error: 'name, category, and price are required' });
    }
    const item = await MenuItem.create({
      name,
      category,
      price,
      active: active !== false,
    });
    res.status(201).json({ item });
  })
);

router.put(
  '/menu/:id',
  asyncHandler(async (req, res) => {
    const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ item });
  })
);

router.delete(
  '/menu/:id',
  asyncHandler(async (req, res) => {
    const item = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { active: false },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: 'Menu item not found' });
    res.json({ item });
  })
);

// —— Staff accounts ——
router.get(
  '/staff',
  asyncHandler(async (req, res) => {
    const staff = await StaffAccount.find()
      .select('-password_hash')
      .sort({ created_at: -1 })
      .lean();
    res.json({ staff });
  })
);

router.post(
  '/staff',
  asyncHandler(async (req, res) => {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: 'name, email, password, and role are required' });
    }
    const assignableRoles =
      req.user.role === 'platform_owner'
        ? ['staff', 'admin', 'platform_owner']
        : ['staff', 'admin'];
    if (!assignableRoles.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${assignableRoles.join(', ')}` });
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const account = await StaffAccount.create({
      name,
      email: email.toLowerCase().trim(),
      password_hash,
      role,
    });

    res.status(201).json({
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
        role: account.role,
        active: account.active,
      },
    });
  })
);

router.put(
  '/staff/:id',
  asyncHandler(async (req, res) => {
    const updates = { ...req.body };
    delete updates.password_hash;

    // Escalation guards: only a platform owner may touch platform-owner accounts
    // or grant the platform_owner role.
    const target = await StaffAccount.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'Staff account not found' });
    if (target.role === 'platform_owner' && req.user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Cannot modify a platform owner account' });
    }
    if (updates.role && !['staff', 'admin', 'platform_owner'].includes(updates.role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }
    if (updates.role === 'platform_owner' && req.user.role !== 'platform_owner') {
      return res.status(403).json({ error: 'Cannot assign the platform owner role' });
    }

    if (updates.password) {
      const passwordError = validatePassword(updates.password);
      if (passwordError) {
        return res.status(400).json({ error: passwordError });
      }
      updates.password_hash = await bcrypt.hash(updates.password, 10);
      delete updates.password;
    }

    const account = await StaffAccount.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).select('-password_hash');

    if (!account) return res.status(404).json({ error: 'Staff account not found' });
    res.json({ account });
  })
);

// —— Customers + adjustments ——
router.get(
  '/customers',
  asyncHandler(async (req, res) => {
    const q = String(req.query.q || '').trim();
    const filter = q
      ? {
          $or: [
            { name: new RegExp(q, 'i') },
            { phone: new RegExp(q.replace(/\D/g, '')) },
          ],
        }
      : {};

    const customers = await Customer.find(filter).sort({ created_at: -1 }).limit(50).lean();
    const withBalance = await Promise.all(
      customers.map(async (c) => ({
        id: c._id,
        name: c.name,
        phone: c.phone,
        created_at: c.created_at,
        balance: await getCustomerBalance(c._id),
      }))
    );

    res.json({ customers: withBalance });
  })
);

router.get(
  '/customers/:id',
  asyncHandler(async (req, res) => {
    const customer = await Customer.findById(req.params.id).lean();
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    const balance = await getCustomerBalance(customer._id);
    const ledger = await getCustomerLedger(customer._id, 100);

    res.json({
      customer: {
        id: customer._id,
        name: customer.name,
        phone: customer.phone,
        created_at: customer.created_at,
      },
      balance,
      ledger,
    });
  })
);

router.post(
  '/customers/:id/adjustments',
  asyncHandler(async (req, res) => {
    const points_delta = Number(req.body.points_delta);
    const reason = String(req.body.reason || '').trim();

    if (!Number.isFinite(points_delta) || points_delta === 0) {
      return res.status(400).json({ error: 'points_delta must be a non-zero number' });
    }
    if (!reason) return res.status(400).json({ error: 'Reason is required' });

    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ error: 'Customer not found' });

    if (points_delta < 0) {
      const balance = await getCustomerBalance(customer._id);
      if (balance.available + points_delta < 0) {
        return res.status(400).json({
          error: `Adjustment would make available balance negative (available: ${balance.available})`,
        });
      }
    }

    const adjustment = await AdjustmentTransaction.create({
      customer_id: customer._id,
      points_delta,
      reason,
      admin_id: req.user.id,
    });

    const balance = await getCustomerBalance(customer._id);
    res.status(201).json({ adjustment, balance });
  })
);

// —— Settings ——
router.get(
  '/settings',
  asyncHandler(async (req, res) => {
    const settings = await getSettings();
    res.json({ settings });
  })
);

router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const allowed = ['points_per_100', 'minimum_spend', 'redemption_code_expiry_minutes'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = Number(req.body[key]);
    }

    const settings = await Settings.findOneAndUpdate(
      { key: 'global' },
      { $set: updates },
      { new: true, upsert: true, runValidators: true }
    );

    res.json({ settings });
  })
);

// —— SMS / Notify.lk ——
router.get(
  '/sms/status',
  asyncHandler(async (req, res) => {
    const local = publicSmsStatus();
    const remote = await getNotifyStatus();
    res.json({
      ...local,
      active: remote.ok ? remote.active : null,
      acc_balance: remote.ok ? remote.acc_balance : null,
      provider_error: remote.ok ? null : remote.error,
    });
  })
);

// Message activity stats — visible to the cafe owner in place of provider status.
router.get(
  '/sms/stats',
  asyncHandler(async (req, res) => {
    const { start } = monthRange();

    const [byStatus, monthSent, kindSent, campaignAgg, reachedAgg, lastCampaign] =
      await Promise.all([
        MessageLog.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        MessageLog.countDocuments({ status: 'sent', created_at: { $gte: start } }),
        MessageLog.aggregate([
          { $match: { status: 'sent' } },
          { $group: { _id: '$kind', count: { $sum: 1 } } },
        ]),
        Campaign.aggregate([
          { $match: { status: { $in: ['sent', 'sending'] } } },
          { $group: { _id: null, count: { $sum: 1 } } },
        ]),
        MessageLog.aggregate([
          { $match: { status: 'sent', kind: 'promo', customer_id: { $ne: null } } },
          { $group: { _id: '$customer_id' } },
          { $count: 'n' },
        ]),
        Campaign.findOne().sort({ created_at: -1 }).select('created_at').lean(),
      ]);

    const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));
    const kindMap = Object.fromEntries(kindSent.map((s) => [s._id, s.count]));

    res.json({
      sent: statusMap.sent || 0,
      failed: statusMap.failed || 0,
      skipped: statusMap.skipped || 0,
      queued: statusMap.queued || 0,
      total: Object.values(statusMap).reduce((a, b) => a + b, 0),
      this_month_sent: monthSent,
      receipts_sent: kindMap.order_earned || 0,
      redemptions_sent: kindMap.redemption || 0,
      promo_sent: kindMap.promo || 0,
      test_sent: kindMap.system || 0,
      campaigns_sent: campaignAgg[0]?.count || 0,
      customers_reached: reachedAgg[0]?.n || 0,
      last_campaign_at: lastCampaign?.created_at || null,
    });
  })
);

router.post(
  '/sms/test',
  requirePlatformOwner,
  asyncHandler(async (req, res) => {
    const phoneCheck = validatePhone(req.body.phone);
    if (!phoneCheck.ok) return res.status(400).json({ error: phoneCheck.error });

    const body = String(req.body.message || '').trim() ||
      'Builders Brew test SMS. If you received this, Notify.lk is connected.';

    if (body.length > 621) {
      return res.status(400).json({ error: 'Message must be 621 characters or fewer' });
    }

    const log = await sendAndLog({
      phone: phoneCheck.phone,
      body,
      kind: 'system',
    });

    if (log.status === 'failed') {
      return res.status(502).json({
        error: log.error || 'SMS failed',
        log,
      });
    }

    res.status(201).json({ log });
  })
);

router.get(
  '/sms/logs',
  asyncHandler(async (req, res) => {
    const kind = String(req.query.kind || '').trim();
    const filter = kind ? { kind } : {};
    const logs = await MessageLog.find(filter)
      .populate('customer_id', 'name phone')
      .sort({ created_at: -1 })
      .limit(40)
      .lean();
    res.json({ logs });
  })
);

router.get(
  '/campaigns',
  asyncHandler(async (req, res) => {
    const campaigns = await Campaign.find()
      .populate('created_by', 'name')
      .sort({ created_at: -1 })
      .limit(30)
      .lean();
    res.json({ campaigns });
  })
);

router.post(
  '/campaigns/preview',
  requirePlatformOwner,
  asyncHandler(async (req, res) => {
    const body = String(req.body.body || '').trim();
    const recipient_count = await Customer.countDocuments({ sms_opt_out: { $ne: true } });
    res.json({
      recipient_count,
      chars: body.length,
      segments: body ? estimateSmsSegments(body) : 0,
    });
  })
);

router.post(
  '/campaigns',
  requirePlatformOwner,
  asyncHandler(async (req, res) => {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ error: 'Message body is required' });
    if (body.length > 621) {
      return res.status(400).json({ error: 'Message must be 621 characters or fewer' });
    }

    const title = String(req.body.title || '').trim() || body.slice(0, 48);
    const recipient_count = await Customer.countDocuments({ sms_opt_out: { $ne: true } });
    if (recipient_count === 0) {
      return res.status(400).json({ error: 'No opted-in customers to message' });
    }

    const campaign = await Campaign.create({
      title,
      body,
      audience: 'all',
      created_by: req.user.id,
      status: 'sending',
      total: recipient_count,
    });

    queueCampaign(campaign._id);

    res.status(201).json({ campaign });
  })
);

router.get(
  '/campaigns/:id',
  asyncHandler(async (req, res) => {
    const campaign = await Campaign.findById(req.params.id)
      .populate('created_by', 'name')
      .lean();
    if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

    const logs = await MessageLog.find({ campaign_id: campaign._id })
      .populate('customer_id', 'name phone')
      .sort({ created_at: -1 })
      .limit(200)
      .lean();

    res.json({ campaign, logs });
  })
);

export default router;
