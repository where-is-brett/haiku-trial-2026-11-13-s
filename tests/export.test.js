// tests/export.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { csvField, csvLine, exportName, fileDate, exportRows, renderCsv } from '../src/lib/export.js';

test('an empty month renders the header line only, with CRLF', () => {
  assert.equal(renderCsv([]), 'Date,Description,Amount,Category\r\n');
});

test('one row renders its date, description, amount and category', () => {
  assert.equal(
    renderCsv([{ date: '2026-08-03', description: 'Greenbarrow Fresh REF 1021', cents: 5420 }]),
    'Date,Description,Amount,Category\r\n03/08/2026,Greenbarrow Fresh REF 1021,54.20,Groceries\r\n',
  );
});

test('a negative amount keeps its stored sign', () => {
  assert.equal(
    renderCsv([{ date: '2026-08-10', description: 'Marlowe Homewares', cents: -4000 }]),
    'Date,Description,Amount,Category\r\n10/08/2026,Marlowe Homewares,-40.00,Shopping\r\n',
  );
});

test('a description with a comma and quotes is quoted with the quotes doubled', () => {
  const description = 'Pasta, Pizza & Co "Late" night';
  assert.equal(csvField(description), '"Pasta, Pizza & Co ""Late"" night"');
  assert.equal(
    renderCsv([{ date: '2026-08-04', description, cents: 1850 }]),
    'Date,Description,Amount,Category\r\n04/08/2026,"Pasta, Pizza & Co ""Late"" night",18.50,Eating out\r\n',
  );
});

test('a description with a line break is quoted', () => {
  assert.equal(csvField('first\nsecond'), '"first\nsecond"');
  assert.equal(csvField('first\rsecond'), '"first\rsecond"');
});

test('a plain field is written bare', () => {
  assert.equal(csvField('Groceries'), 'Groceries');
  assert.equal(csvField(-40), '-40');
});

test('csvLine joins the fields with commas and ends with CRLF', () => {
  assert.equal(csvLine(['a', 'b,c', 3]), 'a,"b,c",3\r\n');
});

test('the file name carries the month', () => {
  assert.equal(exportName('2026-08'), 'spending-2026-08.csv');
});

test('the date is reformatted from ISO to day-first', () => {
  assert.equal(fileDate('2026-01-05'), '05/01/2026');
});

test('exportRows returns only the month, by date then stored order', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
  insert.run('2026-08-15', 'Ember Grill', 2200);
  insert.run('2026-07-31', 'Last of July', 100);
  insert.run('2026-08-03', 'Greenbarrow Fresh REF 1021', 5420);
  insert.run('2026-09-01', 'First of September', 300);
  insert.run('2026-08-03', 'Tramline Fares', 280);
  insert.run('2026-08-01', 'Brightfield Power', 9900);

  assert.deepEqual(exportRows(db, '2026-08'), [
    { date: '2026-08-01', description: 'Brightfield Power', cents: 9900 },
    { date: '2026-08-03', description: 'Greenbarrow Fresh REF 1021', cents: 5420 },
    { date: '2026-08-03', description: 'Tramline Fares', cents: 280 },
    { date: '2026-08-15', description: 'Ember Grill', cents: 2200 },
  ]);
  assert.deepEqual(exportRows(db, '2026-07'), [
    { date: '2026-07-31', description: 'Last of July', cents: 100 },
  ]);
  assert.deepEqual(exportRows(db, '2026-10'), []);
});
