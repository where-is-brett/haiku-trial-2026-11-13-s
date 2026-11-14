// tests/export-route.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const serverFile = new URL('../src/server.js', import.meta.url).pathname;
let dir;
let dbFile;

before(() => {
  dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), 'export-route-'));
  dbFile = path.join(dir, 'ledger.db');
  const db = new DatabaseSync(dbFile);
  db.exec('CREATE TABLE transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
  insert.run('2026-08-03', 'Greenbarrow Fresh REF 1021', 5420);
  insert.run('2026-08-19', 'Marlowe Homewares', -4000);
  insert.run('2026-07-31', 'Greenbarrow Fresh', 9999);
  db.close();
});

after(() => fs.rmSync(dir, { recursive: true, force: true }));

function start(features) {
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
  });
}

test('with the switch on, /export sends the month as a CSV attachment', async () => {
  const { child, base } = await start('export-month');
  try {
    const res = await fetch(`${base}/export?m=2026-08`);
    const csv = await res.text();
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'text/csv; charset=utf-8');
    assert.equal(res.headers.get('content-disposition'), 'attachment; filename="spending-2026-08.csv"');
    assert.equal(csv.split('\r\n')[0], 'Date,Description,Amount,Category');
    assert.ok(csv.includes('03/08/2026,Greenbarrow Fresh REF 1021,54.20,Groceries\r\n'), csv);
  } finally {
    child.kill();
  }
});

test('an empty month is the header line only', async () => {
  const { child, base } = await start('export-month');
  try {
    const res = await fetch(`${base}/export?m=2026-06`);
    assert.equal(res.status, 200);
    assert.equal(await res.text(), 'Date,Description,Amount,Category\r\n');
  } finally {
    child.kill();
  }
});

test('a missing or malformed m gets a plain 400', async () => {
  const { child, base } = await start('export-month');
  try {
    for (const q of ['', '?m=2026-8', '?m=2026-13']) {
      const res = await fetch(`${base}/export${q}`);
      assert.equal(res.status, 400, q);
      assert.match(res.headers.get('content-type'), /^text\/plain/);
      assert.equal(await res.text(), 'The month is needed as YYYY-MM');
    }
  } finally {
    child.kill();
  }
});

test('with the switch off, /export is not found', async () => {
  const { child, base } = await start(undefined);
  try {
    const res = await fetch(`${base}/export?m=2026-08`);
    assert.equal(res.status, 404);
    assert.equal(await res.text(), 'Not found');
  } finally {
    child.kill();
  }
});
