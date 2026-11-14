// tests/home-route.test.js
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const serverFile = new URL('../src/server.js', import.meta.url).pathname;
let dir;
let counter = 0;

before(() => {
  dir = fs.mkdtempSync(path.join(process.env.TMPDIR ?? os.tmpdir(), 'home-route-'));
});

after(() => fs.rmSync(dir, { recursive: true, force: true }));

// A new ledger file for each test, holding the given rows (date, description, cents).
function makeLedger(rows) {
  counter += 1;
  const file = path.join(dir, `ledger-${counter}.db`);
  const db = new DatabaseSync(file);
  db.exec('CREATE TABLE transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
  for (const [date, description, cents] of rows) insert.run(date, description, cents);
  db.close();
  return file;
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

test('with the switch on, the home page lists the months newest first', async () => {
  const dbFile = makeLedger([
    ['2026-07-31', 'Greenbarrow Fresh', 9999],
    ['2026-08-03', 'Greenbarrow Fresh REF 1021', 5420],
  ]);
  const { child, base } = await start(dbFile, 'statement-import');
  try {
    const res = await fetch(`${base}/`);
    const html = await res.text();
    assert.equal(res.status, 200);
    assert.match(html, /2 transactions imported/);
    const aug = html.indexOf('href="/month?m=2026-08"');
    const jul = html.indexOf('href="/month?m=2026-07"');
    assert.notEqual(aug, -1);
    assert.notEqual(jul, -1);
    assert.ok(aug < jul, 'August should be listed before July');
  } finally {
    child.kill();
  }
});

test('with the switch off, the home page shows the count and no month list', async () => {
  const dbFile = makeLedger([
    ['2026-07-31', 'Greenbarrow Fresh', 9999],
    ['2026-08-03', 'Greenbarrow Fresh REF 1021', 5420],
  ]);
  const { child, base } = await start(dbFile, undefined);
  try {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /2 transactions imported/);
    assert.doesNotMatch(html, /\/month\?m=/);
  } finally {
    child.kill();
  }
});

test('with the switch on and an empty ledger, the home page says nothing is imported and lists no months', async () => {
  const dbFile = makeLedger([]);
  const { child, base } = await start(dbFile, 'statement-import');
  try {
    const html = await (await fetch(`${base}/`)).text();
    assert.match(html, /Nothing imported yet/);
    assert.doesNotMatch(html, /\/month\?m=/);
  } finally {
    child.kill();
  }
});
