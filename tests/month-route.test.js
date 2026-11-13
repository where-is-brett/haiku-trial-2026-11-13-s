// tests/month-route.test.js
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
  dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), 'month-route-'));
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

test('with the switch on, /month shows the month totals', async () => {
  const { child, base } = await start('month-page');
  try {
    const res = await fetch(`${base}/month?m=2026-08`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /<td data-category="groceries" data-total="54\.20">54\.20<\/td>/);
    assert.match(html, /<td data-category="shopping" data-total="-40\.00">-40\.00<\/td>/);
    assert.match(html, /<td data-category="all" data-total="14\.20">14\.20<\/td>/);
    assert.match(html, /href="\/month\?m=2026-07"/);
    assert.match(html, /href="\/month\?m=2026-09"/);
  } finally {
    child.kill();
  }
});

test('a missing or malformed m gets a plain 400', async () => {
  const { child, base } = await start('month-page');
  try {
    for (const q of ['', '?m=2026-8', '?m=2026-13']) {
      const res = await fetch(`${base}/month${q}`);
      assert.equal(res.status, 400, q);
      assert.match(res.headers.get('content-type'), /^text\/plain/);
      assert.equal(await res.text(), 'The month is needed as YYYY-MM');
    }
  } finally {
    child.kill();
  }
});

test('an empty month shows zeros and still links', async () => {
  const { child, base } = await start('month-page');
  try {
    const html = await (await fetch(`${base}/month?m=2026-06`)).text();
    assert.match(html, /<td data-category="all" data-total="0\.00">0\.00<\/td>/);
    assert.match(html, /href="\/month\?m=2026-05"/);
  } finally {
    child.kill();
  }
});

test('with the switch off, /month is not found', async () => {
  const { child, base } = await start(undefined);
  try {
    const res = await fetch(`${base}/month?m=2026-08`);
    assert.equal(res.status, 404);
  } finally {
    child.kill();
  }
});
