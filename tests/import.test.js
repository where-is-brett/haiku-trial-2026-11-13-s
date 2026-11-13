// tests/import.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { importStatement } from '../src/lib/import.js';
import { StatementError } from '../src/lib/statement.js';

const STATEMENT = 'Date,Description,Amount\r\n03/08/2026,Greenbarrow Fresh REF 1021,54.20\r\n19/08/2026,"Smith, J",(40.00)\r\n';

function ledger() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  return db;
}

test('a first import of a statement adds every row and reports Added n, skipped 0', () => {
  const db = ledger();
  assert.deepEqual(importStatement(db, STATEMENT), { added: 2, skipped: 0 });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 2);
});

test('importing the same statement again adds nothing and reports Added 0', () => {
  const db = ledger();
  importStatement(db, STATEMENT);
  assert.deepEqual(importStatement(db, STATEMENT), { added: 0, skipped: 2 });
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 2);
});

test('two identical lines in one file are both stored', () => {
  const db = ledger();
  const twins = 'Date,Description,Amount\r\n03/08/2026,Kestrel Coffee Bar,6.50\r\n03/08/2026,Kestrel Coffee Bar,6.50\r\n';
  assert.deepEqual(importStatement(db, twins), { added: 2, skipped: 0 });
});

test('a row with the same date and amount but another description is a new row', () => {
  const db = ledger();
  importStatement(db, STATEMENT);
  const other = 'Date,Description,Amount\r\n03/08/2026,Someone Else,54.20\r\n';
  assert.deepEqual(importStatement(db, other), { added: 1, skipped: 0 });
});

test('a refused file adds nothing, even when the bad row is last', () => {
  const db = ledger();
  const bad = 'Date,Description,Amount\r\n03/08/2026,Kestrel Coffee Bar,6.50\r\n04/08/2026,Broken,abc\r\n';
  assert.throws(() => importStatement(db, bad), StatementError);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 0);
});

test('a second upload leaves the stored rows exactly as they were', () => {
  const db = ledger();
  importStatement(db, STATEMENT);
  const before = db.prepare('SELECT * FROM transactions ORDER BY id').all();
  importStatement(db, STATEMENT);
  assert.deepEqual(db.prepare('SELECT * FROM transactions ORDER BY id').all(), before);
});

test('a stored line uploaded twice adds only the copy the ledger lacks', () => {
  const db = ledger();
  importStatement(db, 'Date,Description,Amount\r\n10/01/2027,Coffee,5.00\r\n');
  const twice = 'Date,Description,Amount\r\n10/01/2027,Coffee,5.00\r\n10/01/2027,Coffee,5.00\r\n';
  assert.deepEqual(importStatement(db, twice), { added: 1, skipped: 1 });
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM transactions WHERE description = 'Coffee'").get().n, 2);
});

test('a line with the same description and cents on another date is a new row', () => {
  const db = ledger();
  importStatement(db, 'Date,Description,Amount\r\n03/08/2026,Kestrel Coffee Bar,6.50\r\n');
  const otherDate = 'Date,Description,Amount\r\n04/08/2026,Kestrel Coffee Bar,6.50\r\n';
  assert.deepEqual(importStatement(db, otherDate), { added: 1, skipped: 0 });
});

test('a line with the same date and description but other cents is a new row', () => {
  const db = ledger();
  importStatement(db, 'Date,Description,Amount\r\n03/08/2026,Kestrel Coffee Bar,6.50\r\n');
  const otherCents = 'Date,Description,Amount\r\n03/08/2026,Kestrel Coffee Bar,7.50\r\n';
  assert.deepEqual(importStatement(db, otherCents), { added: 1, skipped: 0 });
});

test('a write that fails part-way rolls back the whole upload', () => {
  const db = ledger();
  db.exec("CREATE TRIGGER no_boom BEFORE INSERT ON transactions WHEN NEW.description = 'Boom' BEGIN SELECT RAISE(ABORT, 'no'); END");
  const text = 'Date,Description,Amount\r\n03/08/2026,Kestrel Coffee Bar,6.50\r\n04/08/2026,Boom,1.00\r\n';
  assert.throws(() => importStatement(db, text));
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n, 0);
});
