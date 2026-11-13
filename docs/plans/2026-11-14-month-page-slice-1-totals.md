# Month page slice 1: totals by category Implementation Plan

**Goal:** `/month?m=YYYY-MM` shows one row per category with that month's total, a grand total row, and previous and next month links, behind the feature switch `month-page`.

**Architecture:** Pure helpers in `src/lib/month.js` (month parsing, month shifting, signed totals, HTML body) and a feature switch in `src/lib/flags.js`. The server reads the month's rows with one SQL query and gives the page body to the existing `page()` wrapper. With the switch off, `/month` is an ordinary 404.

**Tech Stack:** Node 22.13+, `node:sqlite`, `node:test`, `node:assert/strict`. No new dependencies.

**Spec:** `.wheelhouse/feature/approved.md` (decisions 1-9, slice 1 done list)

## Global Constraints

- Money is whole cents internally; a total is written only with `formatCents` from `src/lib/money.js` (e.g. `1234.50`, `-40.00`).
- Category keys, labels and order come from `CATEGORIES` in `src/lib/categories.js`; the page does not repeat the list.
- The month is `YYYY-MM`, matched by `/^\d{4}-(0[1-9]|1[0-2])$/`.
- A missing or malformed `m` gets a plain-text 400 with the body `The month is needed as YYYY-MM`.
- Row order: the `CATEGORIES` order, grand total last.
- Feature switch `month-page` is off unless listed in the `FEATURES` environment variable (comma-separated). Off means `/month` returns the normal 404.
- Stored transaction dates are ISO `YYYY-MM-DD` (what `parseDate` writes on the statement-import branch). The month is the first seven characters.

## Review Focus

- A malformed or missing `m` (`2026-8`, `2026-13`, `2026-08-01`, no `m`) must give a 400, not a blank page or a crash. Pinned in Task 1 (`parseMonth`) and Task 3 (route).
- An empty month shows every category and the grand total as `0.00`, and its links still work. Pinned in Task 2 (`renderMonth`) and Task 3 (route, `2026-06`).
- Transactions on the last day of the previous month and the first day of the next are not counted in `m`. Pinned in Task 2 (`monthRows` on `:memory:`).
- Money back (negative cents) counts negative in its category and in the grand total. Pinned in Task 1 (`totalsByCategory`).
- The previous link across a year boundary: `2026-01` goes back to `2025-12`. Pinned in Task 1 (`shiftMonth`).

## File Structure

- Create: `src/lib/flags.js`. One job: say whether a named feature is switched on.
- Create: `src/lib/month.js`. Month parsing and shifting, signed totals, the month's rows, and the body HTML.
- Modify: `src/server.js`. Adds the `/month` route, gated by the switch. Nothing else changes.
- Create: `tests/flags.test.js`, `tests/month.test.js`, `tests/month-route.test.js`.

## Decisions taken in this plan

- **Sign of income (asked, see question in the ledger).** `signedCents(category, cents)` is the one place that decides the sign. It returns `cents` unchanged for every category, so money in and money back both count negative as stored. The approved design's "negate income" is a one-line change in this function if the director picks it.
- **Month of a transaction** is `substr(date, 1, 7)` in SQL, not `monthOf` from `src/lib/dates.js`. `monthOf` takes `DD/MM/YYYY`, while stored dates are ISO and `monthOf` would throw on them. The month is the same either way.

---

### Task 1: Feature switch, month parsing, shifting and signed totals

**Files:**
- Create: `src/lib/flags.js`
- Create: `src/lib/month.js`
- Test: `tests/flags.test.js`, `tests/month.test.js`

**Interfaces:**
- Consumes: `CATEGORIES` from `src/lib/categories.js`; `formatCents` not needed here.
- Produces:
  - `featureOn(name: string, env?: Record<string, string | undefined>): boolean` (`flags.js`; `env` defaults to `process.env`)
  - `MONTH_FORMAT: RegExp` = `/^\d{4}-(0[1-9]|1[0-2])$/` (`month.js`)
  - `parseMonth(text: unknown): string | null` returns the month if it matches `MONTH_FORMAT`, else `null`
  - `shiftMonth(m: string, by: number): string` (`'2026-08', -1` gives `'2026-07'`; `'2026-01', -1` gives `'2025-12'`)
  - `signedCents(category: string, cents: number): number`
  - `totalsByCategory(rows: { description: string, cents: number }[]): Record<string, number>` returns an object with every `CATEGORIES` key plus `all`, each an integer count of cents, zero where empty

- [ ] **Step 1: Write the failing tests for the switch**

```js
// tests/flags.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featureOn } from '../src/lib/flags.js';

test('a feature is on only when named in FEATURES', () => {
  assert.equal(featureOn('month-page', { FEATURES: 'month-page' }), true);
  assert.equal(featureOn('month-page', { FEATURES: 'other, month-page ' }), true);
  assert.equal(featureOn('month-page', { FEATURES: 'other' }), false);
  assert.equal(featureOn('month-page', {}), false);
});
```

- [ ] **Step 2: Write the failing tests for month helpers and totals**

```js
// tests/month.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMonth, shiftMonth, signedCents, totalsByCategory } from '../src/lib/month.js';

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
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test tests/flags.test.js tests/month.test.js`
Expected: FAIL with "Cannot find module" for `src/lib/flags.js` and `src/lib/month.js`.

- [ ] **Step 4: Implement `featureOn` in `src/lib/flags.js`**

Split the `FEATURES` value on commas, trim each name, and check membership. Default `env` to `process.env`.

- [ ] **Step 5: Implement the helpers in `src/lib/month.js`**

`parseMonth` tests `MONTH_FORMAT` against a string and returns it or `null`. `shiftMonth` converts to a year and month index, adds `by`, and formats back with `padStart(2, '0')`. `signedCents` returns `cents`; put a one-line comment that it is the sign decision (see the plan's Decisions). `totalsByCategory` starts every key of `CATEGORIES` at 0 plus `all`, then for each row adds `signedCents(categoryFor(row.description), row.cents)` to its category and to `all`. Import `categoryFor` from `src/lib/categories.js`.

- [ ] **Step 6: Run the tests to verify they pass**

Run: `node --test tests/flags.test.js tests/month.test.js`
Expected: PASS, all tests in both files.

- [ ] **Step 7: Commit**

```bash
git add src/lib/flags.js src/lib/month.js tests/flags.test.js tests/month.test.js
git commit -m "Add the month-page switch and month totals helpers"
```

---

### Task 2: The month's rows and the page body

**Files:**
- Modify: `src/lib/month.js`
- Test: `tests/month.test.js`

**Interfaces:**
- Consumes: from Task 1: `parseMonth`-free `shiftMonth(m, by)`, `totalsByCategory(rows)`; `CATEGORIES`; `formatCents` from `src/lib/money.js`.
- Produces:
  - `monthRows(db: DatabaseSync, m: string): { date: string, description: string, cents: number }[]` runs `SELECT date, description, cents FROM transactions WHERE substr(date, 1, 7) = ?`
  - `renderMonth(m: string, totals: Record<string, number>): string` returns the HTML body fragment (no `<html>` wrapper; the server's `page()` adds it)

- [ ] **Step 1: Write the failing tests**

```js
// add to tests/month.test.js
import { DatabaseSync } from 'node:sqlite';
import { monthRows, renderMonth, totalsByCategory as totals } from '../src/lib/month.js';

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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/month.test.js`
Expected: FAIL with "monthRows is not a function" (or the import error for `renderMonth`).

- [ ] **Step 3: Implement `monthRows` and `renderMonth` in `src/lib/month.js`**

`monthRows` prepares the SQL above and returns `.all(m)`. `renderMonth` writes `<h2>` with the month, a `<nav>` with the two links (`/month?m=` plus `shiftMonth(m, -1)` and `shiftMonth(m, 1)`), and a `<table>` with one `<tr>` per `CATEGORIES` key in order: `<th scope="row">` with the label, then `<td data-category="KEY" data-total="FORMATTED">FORMATTED</td>` with `formatCents`. The grand total row follows with label `Total` and `data-category="all"`. Plain string template; no escaping is needed because labels are constants and `m` is validated before this is called.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/month.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/month.js tests/month.test.js
git commit -m "Read a month's rows and render its totals table"
```

---

### Task 3: The `/month` route behind the switch

**Files:**
- Modify: `src/server.js` (add a branch before the 404 in the request handler)
- Test: `tests/month-route.test.js`

**Interfaces:**
- Consumes: `featureOn` (Task 1), `parseMonth`, `monthRows`, `totalsByCategory`, `renderMonth` (Tasks 1-2), `page()` already in `src/server.js`.
- Produces: `GET /month?m=YYYY-MM`, served only when `FEATURES` includes `month-page`:
  - 400, `text/plain; charset=utf-8`, body `The month is needed as YYYY-MM`, when `m` is missing or malformed
  - 200, `text/html; charset=utf-8`, `page(renderMonth(...))` otherwise

The route handler belongs in `server.js` next to the `/` branch. Read `process.env` once at request time, so the test can spawn the server with the switch on or off.

- [ ] **Step 1: Write the failing integration test**

The test creates a temporary database file, inserts rows, and spawns `node src/server.js` with `LEDGER_DB` pointing at it, `PORT=0`, and `FEATURES` set or unset. It reads the port from the `listening on N` line.

```js
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
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/month-route.test.js`
Expected: FAIL. The switch-on tests get 404 instead of 200 and 400.

- [ ] **Step 3: Add the branch to `src/server.js`**

Import `featureOn` from `./lib/flags.js` and `parseMonth`, `monthRows`, `totalsByCategory`, `renderMonth` from `./lib/month.js`. Before the 404 fall-through, add: if `url.pathname === '/month' && featureOn('month-page')`, parse `url.searchParams.get('m')`; on `null` write the 400 as in Global Constraints and return; otherwise write 200 `text/html; charset=utf-8` with `page(renderMonth(m, totalsByCategory(monthRows(db, m))))` and return.

- [ ] **Step 4: Run the test to verify it passes**

Run: `node --test tests/month-route.test.js`
Expected: PASS, four tests.

- [ ] **Step 5: Run the whole suite**

Run: `npm test`
Expected: PASS for `tests/categories.test.js`, `tests/money-edge.test.js`, `tests/money.test.js`, `tests/smoke.test.js` and the three new files.

- [ ] **Step 6: Commit**

```bash
git add src/server.js tests/month-route.test.js
git commit -m "Serve the month totals page behind the month-page switch"
```

---

## Self-Review

1. **Spec coverage.** Slice 1 done items: row per category with total (Tasks 2, 3); grand total row (Task 2, `data-category="all"`); links (Task 2, Task 3); `mustShow Groceries` (Task 2 `>Groceries<` and Task 3 route); malformed m gives 400 (Tasks 1, 3); empty month zeros and links (Tasks 2, 3); total is sum of rows with income handled by `signedCents` (Task 1); grand total is sum (Task 1). Change column is out of scope (slice 2).
2. **Types.** `totalsByCategory` returns `Record<string, number>`; `renderMonth` and `monthRows` take the same shapes; the route uses `parseMonth`'s `string | null`. Names match across tasks.
3. **Review Focus.** Each of the five lines has a named test in the owning task.
4. **Open point.** The income sign is asked of the director (level 3). Task 1 builds the stored-sign version, the default in the `signedCents` seam.
