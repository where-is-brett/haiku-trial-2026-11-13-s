// tests/import-route.test.js

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const serverFile = new URL('../src/server.js', import.meta.url).pathname;
// The five lines of scripts/make-statement.js, copied here so the test runs no script.
const STATEMENT = [
  'Date,Description,Amount',
  '03/08/2026,Greenbarrow Fresh REF 1021,54.20',
  '07/08/2026,Kestrel Coffee Bar,6.50',
  '12/08/2026,Brightfield Power,121.00',
  '19/08/2026,Marlowe Homewares,(40.00)',
  '25/08/2026,Brightwave Payroll,-2100.00',
].join('\r\n') + '\r\n';
const BAD_DATE = [
  'Date,Description,Amount',
  '2026-08-03,Kestrel Coffee Bar,6.50',
  '07/08/2026,Brightfield Power,121.00',
].join('\r\n') + '\r\n';

let dir;
let counter = 0;

before(() => {
  dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), 'import-route-'));
});

after(() => fs.rmSync(dir, { recursive: true, force: true }));

// A new, empty ledger file for each test, with the table the server expects.
function freshLedger() {
  counter += 1;
  const file = path.join(dir, `ledger-${counter}.db`);
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  db.close();
  return file;
}

function countRows(file) {
  const db = new DatabaseSync(file);
  try {
    return db.prepare('SELECT COUNT(*) AS n FROM transactions').get().n;
  } finally {
    db.close();
  }
}

function start(dbFile, features) {
  const env = { ...process.env, LEDGER_DB: dbFile, PORT: '0' };
  if (features === undefined) delete env.FEATURES;
  else env.FEATURES = features;
  const child = spawn(process.execPath, [serverFile], { env });
  return new Promise((resolve, reject) => {
    child.stdout.on('data', (chunk) => {
      const match = /listening on (\d+)/.exec(chunk.toString());
      if (match) resolve({ child, base: `http://localhost:${match[1]}` });
    });
    child.on('error', reject);
    child.on('exit', () => reject(new Error('the server exited before it listened')));
  });
}

function upload(text, name = 'statement.csv') {
  const formData = new FormData();
  formData.set('statement', new File([text], name, { type: 'text/csv' }));
  return formData;
}

test('with the switch on, GET /import shows the upload form', async () => {
  const { child, base } = await start(freshLedger(), 'statement-import');
  try {
    const res = await fetch(`${base}/import`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /^text\/html/);
    assert.match(html, /name="statement"/);
  } finally {
    child.kill();
  }
});

test('with the switch off, GET /import is not found', async () => {
  const { child, base } = await start(freshLedger(), undefined);
  try {
    const res = await fetch(`${base}/import`);
    assert.equal(res.status, 404);
  } finally {
    child.kill();
  }
});

test('with the switch on, POST /import reports Added 5, skipped 0 for a new statement', async () => {
  const dbFile = freshLedger();
  const { child, base } = await start(dbFile, 'statement-import');
  try {
    const res = await fetch(`${base}/import`, { method: 'POST', body: upload(STATEMENT) });
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /Added 5, skipped 0/);
    assert.equal(countRows(dbFile), 5);
  } finally {
    child.kill();
  }
});

test('POST /import of the same statement again reports Added 0, skipped 5', async () => {
  const dbFile = freshLedger();
  const { child, base } = await start(dbFile, 'statement-import');
  try {
    await fetch(`${base}/import`, { method: 'POST', body: upload(STATEMENT) });
    const res = await fetch(`${base}/import`, { method: 'POST', body: upload(STATEMENT) });
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /Added 0, skipped 5/);
    assert.equal(countRows(dbFile), 5);
  } finally {
    child.kill();
  }
});

test('a refused statement shows the line and adds nothing', async () => {
  const dbFile = freshLedger();
  const seed = new DatabaseSync(dbFile);
  seed.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)').run('2026-07-01', 'Seed', 100);
  seed.close();
  const { child, base } = await start(dbFile, 'statement-import');
  try {
    const res = await fetch(`${base}/import`, { method: 'POST', body: upload(BAD_DATE) });
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /line 2:/);
    assert.equal(countRows(dbFile), 1);
  } finally {
    child.kill();
  }
});

test('with the switch off, POST /import is not found and adds nothing', async () => {
  const dbFile = freshLedger();
  const { child, base } = await start(dbFile, undefined);
  try {
    const res = await fetch(`${base}/import`, { method: 'POST', body: upload(STATEMENT) });
    assert.equal(res.status, 404);
    assert.equal(countRows(dbFile), 0);
  } finally {
    child.kill();
  }
});
