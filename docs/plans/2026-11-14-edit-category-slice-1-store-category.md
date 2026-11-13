# Edit category slice 1: store a chosen category Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The `transactions` table can hold a chosen category per row, and a row without one reports the category its shop rule gives, behind the feature switch `edit-category`.

**Architecture:** One new module, `src/lib/transactions.js`, holds the two rules this slice adds: making sure the nullable `category` column exists, and reporting a row's category (chosen when valid, otherwise the shop rule). The server adds the column at start-up only when the switch is on, so with the switch off the ledger file is not touched. The importer already writes three columns and leaves `category` alone, so the slice pins that with a test rather than changing it.

**Tech Stack:** Node 22.13+, `node:sqlite`, `node:test`, `node:assert/strict`. No new dependencies.

**Spec:** `.wheelhouse/feature/approved.md` (decision 1 Storage, decision 2 Valid categories, decision 8; slice 1 done list)

## Global Constraints

- The valid category keys are exactly the keys of `CATEGORIES` in `src/lib/categories.js`; the module does not repeat the list.
- The new column is named `category`, is `TEXT`, is nullable, and has no default. A `NULL` means "use the shop rule".
- Feature switch `edit-category` is off unless listed in the `FEATURES` environment variable (comma-separated), read through `featureOn` in `src/lib/flags.js`.
- The import never writes the `category` column.
- No change to `src/lib/categories.js`, to `totalsByCategory`, or to any route in this slice.

## Review Focus

- A ledger created before this slice has no `category` column; after the switch-on start-up the old rows report their shop rule category, and no row is lost. Pinned in Task 1 (`ensureCategoryColumn` on an old-schema table).
- Start-up runs with the column already present (every restart after the first). It must not fail with a duplicate column error. Pinned in Task 1 (second call).
- A stored value that is not a current category key (hand-edited or left by an older list) must not reach the totals as an unknown key. `categoryOf` falls back to the shop rule. Pinned in Task 1 (`categoryOf` with an unknown key).
- A chosen category on one of two identical statement lines must stay on that row when the statement is imported again with one more copy. Pinned in Task 2 (import with a twin).
- With the switch off, the server must not change the ledger's schema. Pinned in Task 2 (`server.js` wiring, checked by reading and by the route test in slice 2; see Task 2 step 4).

## File Structure

- Create: `src/lib/transactions.js`. One job: the category column's existence and a row's reported category.
- Modify: `src/server.js`. One line after the `CREATE TABLE` statement, gated by the switch. Nothing else changes.
- Create: `tests/transactions.test.js`.
- Modify: `tests/import.test.js`. Adds the category-preserving test; the file's existing tests are unchanged.

## Decisions taken in this plan

- **Column added only when the switch is on.** The server calls `ensureCategoryColumn` only under `featureOn('edit-category')`, so the real ledger's schema changes only once the director turns the switch on. The approved design's storage decision is otherwise followed as written.
- **Unknown stored value falls back to the rule.** `categoryOf` checks the stored value against `CATEGORIES` keys. This is a defensive choice that keeps the totals' keys valid; it changes no behaviour a user sees, because the page only ever saves valid keys.

---

### Task 1: The category column and a row's reported category

**Files:**
- Create: `src/lib/transactions.js`
- Test: `tests/transactions.test.js`

**Interfaces:**
- Consumes: `CATEGORIES` and `categoryFor` from `src/lib/categories.js`; `DatabaseSync` from `node:sqlite`.
- Produces:
  - `ensureCategoryColumn(db: DatabaseSync): void`. Adds `category TEXT` to `transactions` when no column of that name exists; does nothing when one does.
  - `categoryOf(row: { description: string, category: string | null }): string`. Returns `row.category` when it is a key of `CATEGORIES`, otherwise `categoryFor(row.description)`.

- [ ] **Step 1: Write the failing tests**

```js
// tests/transactions.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { ensureCategoryColumn, categoryOf } from '../src/lib/transactions.js';

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
  const rows = db.prepare('SELECT date, description, cents, category FROM transactions').all();
  assert.deepEqual(rows, [{ date: '2026-08-03', description: 'Greenbarrow Fresh', cents: 5420, category: null }]);
  assert.equal(categoryOf(rows[0]), 'groceries');
});

test('running the column step again on a ledger that has the column does nothing', () => {
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)');
  ensureCategoryColumn(db);
  assert.doesNotThrow(() => ensureCategoryColumn(db));
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `node --test tests/transactions.test.js`
Expected: FAIL with "Cannot find module" for `src/lib/transactions.js`.

- [ ] **Step 3: Implement `ensureCategoryColumn` and `categoryOf` in `src/lib/transactions.js`**

Read the column list with `PRAGMA table_info(transactions)` and run `ALTER TABLE transactions ADD COLUMN category TEXT` only when `category` is missing. `categoryOf` tests membership with `Object.hasOwn(CATEGORIES, row.category)` after a null check, so a `null` or unknown value falls through to `categoryFor(row.description)`.

- [ ] **Step 4: Run the tests to verify they pass**

Run: `node --test tests/transactions.test.js`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/transactions.js tests/transactions.test.js
git commit -m "feat: store and report a chosen transaction category"
```

---

### Task 2: Import keeps a chosen category; the switch wires the column in

**Files:**
- Modify: `tests/import.test.js` (append one test; `ledger()` helper unchanged)
- Modify: `src/server.js` (one gated call after the `CREATE TABLE` statement)

**Interfaces:**
- Consumes: `ensureCategoryColumn` and `categoryOf` from `src/lib/transactions.js` (Task 1); `featureOn` from `src/lib/flags.js`; `importStatement` from `src/lib/import.js` (unchanged).
- Produces: nothing new for later tasks.

- [ ] **Step 1: Write the failing test**

Append to `tests/import.test.js`. The test builds its own ledger with the column, since `ledger()` does not add it:

```js
test('importing a statement again leaves a chosen category in place', () => {
  const db = ledger();
  ensureCategoryColumn(db);
  importStatement(db, 'Date,Description,Amount\r\n03/08/2026,Kestrel Coffee Bar,6.50\r\n');
  db.prepare("UPDATE transactions SET category = 'shopping' WHERE description = 'Kestrel Coffee Bar'").run();
  importStatement(db, 'Date,Description,Amount\r\n03/08/2026,Kestrel Coffee Bar,6.50\r\n03/08/2026,Kestrel Coffee Bar,6.50\r\n');
  const rows = db.prepare('SELECT id, category FROM transactions ORDER BY id').all();
  assert.deepEqual(rows, [
    { id: 1, category: 'shopping' },
    { id: 2, category: null },
  ]);
});
```

Add `import { ensureCategoryColumn } from '../src/lib/transactions.js';` to the top of the file with the other imports.

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/import.test.js`
Expected: PASS already, because the importer inserts only three columns and so leaves `category` alone. This test pins that behaviour against future change; record the result in the report and do not change `import.js`.

- [ ] **Step 3: Wire the column into the server, behind the switch**

In `src/server.js`, import `featureOn` (already imported) and `ensureCategoryColumn` from `./lib/transactions.js`, then add directly after the `db.exec('CREATE TABLE ...')` call:

```js
if (featureOn('edit-category')) ensureCategoryColumn(db);
```

No other line in `server.js` changes.

- [ ] **Step 4: Run the full suite and check the switch by reading**

Run: `npm test`
Expected: all existing tests and the new ones PASS. The server's behaviour with the switch off is pinned by reading: the only added line is the gated call above, and the `month-page` route is unchanged.

- [ ] **Step 5: Commit**

```bash
git add tests/import.test.js src/server.js
git commit -m "feat: keep a chosen category through re-import and gate the column behind the switch"
```

---

## Done check for this slice

- `node --test tests/transactions.test.js tests/import.test.js` passes.
- `npm test` passes in full.
- The three slice 1 done lines in `approved.md` each have a test: the rule category (Task 1), the chosen category (Task 1), and re-import leaving it in place (Task 2).
