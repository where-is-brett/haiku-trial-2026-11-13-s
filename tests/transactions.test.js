import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ensureCategoryColumn, categoryOf, ensureShopRulesTable, shopRules, setShopRule } from '../src/lib/transactions.js';
import { shopNameFor } from '../src/lib/categories.js';

test('a row with no chosen category reports the rule category', () => {
  assert.equal(categoryOf({ description: 'Greenbarrow Fresh REF 1021', category: null }), 'groceries');
});

test('a row with a chosen category reports that category, not the rule', () => {
  assert.equal(categoryOf({ description: 'Greenbarrow Fresh REF 1021', category: 'shopping' }), 'shopping');
});

test('a stored value that is not a category key falls back to the rule', () => {
  assert.equal(categoryOf({ description: 'Marlowe Homewares', category: 'nonsense' }), 'shopping');
});

test('a ledger from before the column gains it, keeps its rows, and reports rule categories', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  db.exec("INSERT INTO transactions (date, description, cents) VALUES ('2026-08-03', 'Greenbarrow Fresh', 5420)");
  ensureCategoryColumn(db);
  const rows = db.prepare('SELECT date, description, cents, category FROM transactions').all().map((row) => ({ ...row }));
  assert.deepEqual(rows, [{ date: '2026-08-03', description: 'Greenbarrow Fresh', cents: 5420, category: null }]);
  assert.equal(categoryOf(rows[0]), 'groceries');
});

test('running the column step again on a ledger that has the column does nothing', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  ensureCategoryColumn(db);
  assert.doesNotThrow(() => ensureCategoryColumn(db));
});

test('a shop rule applies to a row with no chosen category, even when the shop list gives another answer', () => {
  const rules = new Map([['Greenbarrow Fresh', 'dining']]);
  assert.equal(categoryOf({ description: 'Greenbarrow Fresh REF 1021', category: null }, rules), 'dining');
});

test('a chosen category on the row still wins over the shop rule', () => {
  const rules = new Map([['Greenbarrow Fresh', 'dining']]);
  assert.equal(categoryOf({ description: 'Greenbarrow Fresh REF 1021', category: 'shopping' }, rules), 'shopping');
});

test('a shop rule is found when the description is in lower case', () => {
  const rules = new Map([['Greenbarrow Fresh', 'dining']]);
  assert.equal(categoryOf({ description: 'greenbarrow fresh ref 1021', category: null }, rules), 'dining');
});

test('a shop rule does not apply to a description with no shop name', () => {
  const rules = new Map([['Greenbarrow Fresh', 'dining']]);
  assert.equal(categoryOf({ description: 'Unknown Shop', category: null }, rules), 'other');
});

test('a shop rule whose stored value is not a category key is ignored', () => {
  const rules = new Map([['Greenbarrow Fresh', 'nonsense']]);
  assert.equal(categoryOf({ description: 'Greenbarrow Fresh REF 1021', category: null }, rules), 'groceries');
});

test('the shop rules table can be ensured twice, and a rule can be stored and then replaced', () => {
  const db = new DatabaseSync(':memory:');
  ensureShopRulesTable(db);
  assert.doesNotThrow(() => ensureShopRulesTable(db));
  setShopRule(db, 'Greenbarrow Fresh', 'dining');
  assert.deepEqual(shopRules(db), new Map([['Greenbarrow Fresh', 'dining']]));
  setShopRule(db, 'Greenbarrow Fresh', 'shopping');
  assert.deepEqual(shopRules(db), new Map([['Greenbarrow Fresh', 'shopping']]));
});

test('shopNameFor gives the canonical shop name, or null when no shop matches', () => {
  assert.equal(shopNameFor('Greenbarrow Fresh REF 1021'), 'Greenbarrow Fresh');
  assert.equal(shopNameFor('greenbarrow fresh ref 1021'), 'Greenbarrow Fresh');
  assert.equal(shopNameFor('Unknown Shop'), null);
});
