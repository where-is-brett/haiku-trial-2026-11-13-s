// tests/month.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { monthRows, parseMonth, renderMonth, shiftMonth, signedCents, totalsByCategory, totalsByCategory as totals } from '../src/lib/month.js';

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

function ledger(rows) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  for (const [date, description, cents] of rows) {
    db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)').run(date, description, cents);
  }
  return db;
}

test('a month holds its own rows, including its first and last day', () => {
  const db = ledger([
    ['2026-07-31', 'Greenbarrow Fresh', 100],
    ['2026-08-01', 'Greenbarrow Fresh', 200],
    ['2026-08-31', 'Greenbarrow Fresh', 300],
    ['2026-09-01', 'Greenbarrow Fresh', 400],
  ]);
  assert.deepEqual(monthRows(db, '2026-08').map((r) => r.cents).sort(), [200, 300]);
});

test('the page body gives a total cell per category and a grand total cell', () => {
  const html = renderMonth('2026-08', totals([{ description: 'Greenbarrow Fresh REF 1021', cents: 5420 }]));
  assert.match(html, /<td data-category="groceries" data-total="54\.20">54\.20<\/td>/);
  assert.match(html, /<td data-category="all" data-total="54\.20">54\.20<\/td>/);
  assert.match(html, />Groceries</);
  assert.match(html, /href="\/month\?m=2026-07"/);
  assert.match(html, /href="\/month\?m=2026-09"/);
});

test('an empty month shows 0.00 everywhere and still links to its neighbours', () => {
  const html = renderMonth('2026-06', totals([]));
  assert.match(html, /<td data-category="groceries" data-total="0\.00">0\.00<\/td>/);
  assert.match(html, /<td data-category="all" data-total="0\.00">0\.00<\/td>/);
  assert.match(html, /href="\/month\?m=2026-05"/);
  assert.match(html, /href="\/month\?m=2026-07"/);
});
