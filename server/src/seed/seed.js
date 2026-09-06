import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { connectDb } from '../config/db.js';
import { Customer } from '../models/Customer.js';
import { StaffAccount } from '../models/StaffAccount.js';
import { MenuItem } from '../models/MenuItem.js';
import { Reward } from '../models/Reward.js';
import { Settings } from '../models/Settings.js';
import { EarnTransaction } from '../models/EarnTransaction.js';
import { RedemptionTransaction } from '../models/RedemptionTransaction.js';
import { AdjustmentTransaction } from '../models/AdjustmentTransaction.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const menuData = JSON.parse(readFileSync(join(__dirname, 'menu.json'), 'utf8'));

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/builders-brew';
  await connectDb(uri);

  console.log('Clearing existing data...');
  await Promise.all([
    Customer.deleteMany({}),
    StaffAccount.deleteMany({}),
    MenuItem.deleteMany({}),
    Reward.deleteMany({}),
    Settings.deleteMany({}),
    EarnTransaction.deleteMany({}),
    RedemptionTransaction.deleteMany({}),
    AdjustmentTransaction.deleteMany({}),
  ]);

  console.log('Seeding settings...');
  await Settings.create({
    key: 'global',
    points_per_100: 1,
    minimum_spend: 100,
    redemption_code_expiry_minutes: 5,
  });

  console.log('Seeding menu...');
  await MenuItem.insertMany(
    menuData.map((item) => ({ ...item, active: true }))
  );

  console.log('Seeding rewards catalog...');
  await Reward.insertMany([
    {
      name: '1 Brownie · 200 pts',
      description: 'Redeem 200 points for one brownie',
      points_cost: 200,
      type: 'menu_item',
      linked_menu_item_ids: [],
      active: true,
    },
    {
      name: '1 Cookie · 100 pts',
      description: 'Redeem 100 points for one cookie',
      points_cost: 100,
      type: 'menu_item',
      linked_menu_item_ids: [],
      active: true,
    },
  ]);

  console.log('Seeding staff accounts...');
  const ownerHash = await bcrypt.hash('Owner@123', 10);
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const staffHash = await bcrypt.hash('Staff@123', 10);

  await StaffAccount.insertMany([
    {
      name: 'Ms. Rismy',
      email: 'rismyrimasha@gmail.com',
      password_hash: ownerHash,
      role: 'platform_owner',
      active: true,
    },
    {
      name: 'Cafe Owner',
      email: 'admin@buildersbrew.pk',
      password_hash: adminHash,
      role: 'admin',
      active: true,
    },
    {
      name: 'Counter Staff',
      email: 'staff@buildersbrew.pk',
      password_hash: staffHash,
      role: 'staff',
      active: true,
    },
  ]);

  console.log('Seeding demo customer...');
  await Customer.create({
    name: 'Demo Guest',
    phone: '0712345678',
  });

  console.log('\nSeed complete.');
  console.log('—— Demo logins ——');
  console.log('Staff:          staff@buildersbrew.pk / Staff@123');
  console.log('Admin (owner):  admin@buildersbrew.pk / Admin@123');
  console.log('Platform owner: rismyrimasha@gmail.com / Owner@123');
  console.log('Demo member phone: 0712345678');
  console.log('\nClient note: menu item "Wester Egg & Cheese" looks like a typo for "Western" — confirm before go-live.');

  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
