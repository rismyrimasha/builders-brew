import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { StaffAccount } from '../models/StaffAccount.js';
import { signToken, requireStaff } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.post(
  '/staff/login',
  asyncHandler(async (req, res) => {
    const email = String(req.body.email || '').toLowerCase().trim();
    const password = String(req.body.password || '');

    const account = await StaffAccount.findOne({ email });
    if (!account || !account.active) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, account.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password' });

    const token = signToken({
      sub: account._id.toString(),
      type: 'staff',
      role: account.role,
    });

    res.json({
      token,
      account: {
        id: account._id,
        name: account.name,
        email: account.email,
        role: account.role,
      },
    });
  })
);

router.get(
  '/staff/me',
  requireStaff,
  asyncHandler(async (req, res) => {
    res.json({
      account: {
        id: req.user.account._id,
        name: req.user.account.name,
        email: req.user.account.email,
        role: req.user.account.role,
      },
    });
  })
);

export default router;
