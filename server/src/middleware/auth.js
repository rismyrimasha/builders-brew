import jwt from 'jsonwebtoken';
import { Customer } from '../models/Customer.js';
import { StaffAccount } from '../models/StaffAccount.js';

function extractToken(req) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice(7);
}

export function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

export async function requireCustomer(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'customer') {
      return res.status(403).json({ error: 'Customer access only' });
    }

    const customer = await Customer.findById(decoded.sub);
    if (!customer) return res.status(401).json({ error: 'Invalid session' });

    req.user = { id: customer._id, type: 'customer', customer };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

export async function requireStaff(req, res, next) {
  try {
    const token = extractToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.type !== 'staff') {
      return res.status(403).json({ error: 'Staff access only' });
    }

    const account = await StaffAccount.findById(decoded.sub);
    if (!account || !account.active) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    req.user = {
      id: account._id,
      type: 'staff',
      role: account.role,
      account,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

const ADMIN_ROLES = ['admin', 'platform_owner'];

/** Cafe owner (admin) or platform owner */
export function requireAdmin(req, res, next) {
  if (!ADMIN_ROLES.includes(req.user?.role)) {
    return res.status(403).json({ error: 'Admin access only' });
  }
  next();
}

/** Platform owner only — SMS sending, platform-owner account management */
export function requirePlatformOwner(req, res, next) {
  if (req.user?.role !== 'platform_owner') {
    return res.status(403).json({ error: 'Platform owner access only' });
  }
  next();
}

/** Staff or admin */
export function requireStaffOrAdmin(req, res, next) {
  if (!req.user || req.user.type !== 'staff') {
    return res.status(403).json({ error: 'Staff access only' });
  }
  next();
}
