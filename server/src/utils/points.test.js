import { calculatePointsEarned } from './ledger.js';

const settings = { points_per_100: 1, minimum_spend: 100 };

const cases = [
  [950, 9],
  [1000, 10],
  [99, 0],
  [100, 1],
  [200, 2],
  [1499, 14],
];

let failed = 0;
for (const [amount, expected] of cases) {
  const got = calculatePointsEarned(amount, settings);
  if (got !== expected) {
    console.error(`FAIL amount=${amount}: expected ${expected}, got ${got}`);
    failed += 1;
  } else {
    console.log(`OK   amount=${amount} → ${got}`);
  }
}

const double = { points_per_100: 2, minimum_spend: 100 };
const promo = calculatePointsEarned(1000, double);
if (promo !== 20) {
  console.error(`FAIL promo: expected 20, got ${promo}`);
  failed += 1;
} else {
  console.log('OK   double points weekend → 20');
}

process.exit(failed ? 1 : 0);
