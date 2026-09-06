/**
 * One-off: add (or update) the platform-owner account on a LIVE database.
 * Unlike seed.js this does NOT wipe anything.
 *
 * Usage:
 *   OWNER_EMAIL=you@example.com OWNER_PASSWORD='Strong@Pass1' OWNER_NAME='Ms. Rismy' \
 *     node src/seed/add-platform-owner.js
 *
 * Defaults are used for any var you don't pass.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { connectDb } from '../config/db.js';
import { StaffAccount } from '../models/StaffAccount.js';
import { validatePassword } from '../utils/password.js';

const name = process.env.OWNER_NAME || 'Ms. Rismy';
const email = (process.env.OWNER_EMAIL || 'rismyrimasha@gmail.com').toLowerCase().trim();
const password = process.env.OWNER_PASSWORD || 'Owner@123';

async function run() {
  const pwError = validatePassword(password);
  if (pwError) {
    console.error(`Password rejected: ${pwError}`);
    process.exit(1);
  }

  await connectDb(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/builders-brew');

  const password_hash = await bcrypt.hash(password, 10);
  const existing = await StaffAccount.findOne({ email });

  if (existing) {
    existing.name = name;
    existing.role = 'platform_owner';
    existing.active = true;
    existing.password_hash = password_hash;
    await existing.save();
    console.log(`Updated existing account ${email} -> platform_owner (password reset).`);
  } else {
    await StaffAccount.create({ name, email, password_hash, role: 'platform_owner', active: true });
    console.log(`Created platform_owner account ${email}.`);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
