// tests/import-page.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { renderImportPage, handleImport } from '../src/lib/import-page.js';

// The five lines of scripts/make-statement.js, copied here so the test runs no script.
const STATEMENT = [
  'Date,Description,Amount',
  '03/08/2026,Greenbarrow Fresh REF 1021,54.20',
  '07/08/2026,Kestrel Coffee Bar,6.50',
  '12/08/2026,Brightfield Power,121.00',
  '19/08/2026,Marlowe Homewares,(40.00)',
  '25/08/2026,Brightwave Payroll,-2100.00',
].join('\r\n') + '\r\n';

function ledger() {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  return db;
}

function count(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;
}

function uploadOf(text) {
  const formData = new FormData();
  formData.set('statement', new File([text], 'statement.csv', { type: 'text/csv' }));
  return new Request('http://localhost/import', { method: 'POST', body: formData });
}

test('the import page has a multipart file form under the statement field', () => {
  const html = renderImportPage();
  assert.match(html, /method="post"/);
  assert.match(html, /enctype="multipart\/form-data"/);
  assert.match(html, /<input type="file" name="statement" accept="\.csv,text\/csv">/);
  assert.match(html, /<button[^>]*>/);
});

test('a first upload of the statement reports Added 5, skipped 0', async () => {
  const db = ledger();
  const html = await handleImport(db, uploadOf(STATEMENT));
  assert.match(html, /Added 5, skipped 0/);
  assert.equal(count(db), 5);
});

test('the same upload again reports Added 0, skipped 5 and adds nothing', async () => {
  const db = ledger();
  await handleImport(db, uploadOf(STATEMENT));
  const html = await handleImport(db, uploadOf(STATEMENT));
  assert.match(html, /Added 0, skipped 5/);
  assert.equal(count(db), 5);
});

test('a refused file shows the plain reason and adds nothing', async () => {
  const db = ledger();
  const bad = 'Date,Description,Amount\r\n03/08/2026,Kestrel Coffee Bar,6.50\r\n04/08/2026,Broken,abc\r\n';
  const html = await handleImport(db, uploadOf(bad));
  assert.match(html, /line 3:/);
  assert.equal(count(db), 0);
});

test('a POST whose statement field is text, not a file, gets the plain error', async () => {
  const db = ledger();
  const formData = new FormData();
  formData.set('statement', 'Date,Description,Amount');
  const request = new Request('http://localhost/import', { method: 'POST', body: formData });
  const html = await handleImport(db, request);
  assert.match(html, /choose a statement file/);
  assert.equal(count(db), 0);
});

test('a POST with no statement field gets the plain error', async () => {
  const db = ledger();
  const formData = new FormData();
  formData.set('other', 'x');
  const request = new Request('http://localhost/import', { method: 'POST', body: formData });
  const html = await handleImport(db, request);
  assert.match(html, /choose a statement file/);
});

test('a POST that is not form data gets the plain error', async () => {
  const db = ledger();
  const request = new Request('http://localhost/import', { method: 'POST', body: 'not form data' });
  const html = await handleImport(db, request);
  assert.match(html, /choose a statement file/);
});

test('a message with markup in it is escaped on the page', () => {
  const html = renderImportPage('<b>x</b>');
  assert.match(html, /&lt;b&gt;x&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>x<\/b>/);
});
