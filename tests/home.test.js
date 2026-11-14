// tests/home.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { monthsWithTransactions, renderMonthList } from '../src/lib/home.js';

function ledger(rows) {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
  for (const [date, description, cents] of rows) insert.run(date, description, cents);
  return db;
}

test('months with transactions are listed newest first, and only those', () => {
  const db = ledger([
    ['2026-07-31', 'A', 100],
    ['2026-08-03', 'B', 200],
    ['2026-08-19', 'C', 300],
    ['2026-09-01', 'D', 400],
    ['2026-06-30', 'E', 500],
  ]);
  assert.deepEqual(monthsWithTransactions(db), ['2026-09', '2026-08', '2026-07', '2026-06']);
});

test('a month inserted first still sorts by date, and an empty ledger lists nothing', () => {
  const db = ledger([['2026-08-03', 'B', 200], ['2026-07-31', 'A', 100]]);
  assert.deepEqual(monthsWithTransactions(db), ['2026-08', '2026-07']);
  assert.deepEqual(monthsWithTransactions(ledger([])), []);
});

test('each month links to its page, and an empty list renders nothing', () => {
  const html = renderMonthList(['2026-08', '2026-07']);
  assert.match(html, /<a href="\/month\?m=2026-08">2026-08<\/a>/);
  assert.match(html, /<a href="\/month\?m=2026-07">2026-07<\/a>/);
  assert.ok(html.indexOf('2026-08') < html.indexOf('2026-07'));
  assert.equal(renderMonthList([]), '');
});
