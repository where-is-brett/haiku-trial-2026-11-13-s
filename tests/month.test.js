// tests/month.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMonth, shiftMonth, signedCents, totalsByCategory } from '../src/lib/month.js';

test('only YYYY-MM with a real month is accepted', () => {
  assert.equal(parseMonth('2026-08'), '2026-08');
  for (const bad of ['2026-8', '2026-13', '2026-00', '2026-08-01', 'abc', '', undefined, null]) {
    assert.equal(parseMonth(bad), null, String(bad));
  }
});

test('the previous and next month cross the year boundary', () => {
  assert.equal(shiftMonth('2026-08', -1), '2026-07');
  assert.equal(shiftMonth('2026-08', 1), '2026-09');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(shiftMonth('2026-12', 1), '2027-01');
});

test('the stored sign is the signed value for every category', () => {
  assert.equal(signedCents('groceries', 5420), 5420);
  assert.equal(signedCents('shopping', -4000), -4000);
  assert.equal(signedCents('income', -210000), -210000);
});

test('each category total is the sum of its rows, money back counting negative', () => {
  const totals = totalsByCategory([
    { description: 'Greenbarrow Fresh REF 1021', cents: 5420 },
    { description: 'Greenbarrow Fresh REF 1022', cents: 1000 },
    { description: 'Marlowe Homewares', cents: -4000 },
    { description: 'Brightwave Payroll', cents: -210000 },
    { description: 'Unknown Shop', cents: 300 },
  ]);
  assert.equal(totals.groceries, 6420);
  assert.equal(totals.shopping, -4000);
  assert.equal(totals.income, -210000);
  assert.equal(totals.other, 300);
  assert.equal(totals.transport, 0);
});

test('the grand total is the sum of every category total', () => {
  const totals = totalsByCategory([
    { description: 'Greenbarrow Fresh', cents: 5420 },
    { description: 'Marlowe Homewares', cents: -4000 },
    { description: 'Brightwave Payroll', cents: -210000 },
  ]);
  assert.equal(totals.all, 5420 - 4000 - 210000);
});

test('no rows gives every category and the grand total at zero', () => {
  const totals = totalsByCategory([]);
  assert.deepEqual(Object.keys(totals).sort(), ['all', 'bills', 'dining', 'groceries', 'health', 'income', 'other', 'shopping', 'transport'].sort());
  assert.ok(Object.values(totals).every((cents) => cents === 0));
});
