# Export month slice 1: the CSV for a month Implementation Plan

**Goal:** `/export?m=YYYY-MM` sends one month's transactions as a CSV file named `spending-YYYY-MM.csv`, with the header `Date,Description,Amount,Category`, behind the feature switch `export-month`.

**Architecture:** Pure helpers in a new `src/lib/export.js` (CSV quoting and lines, the file name, the date reformat, the month's rows in stored order, the CSV text). The server adds one `/export` route next to `/month`, reusing `parseMonth` from `src/lib/month.js`. With the switch off, `/export` is an ordinary 404.

**Tech Stack:** Node 22.13+, `node:sqlite`, `node:test`, `node:assert/strict`. No new dependencies.

**Spec:** `.wheelhouse/feature/approved.md` (decisions 1-11, slice 1 done list)

## Global Constraints

- Stored transaction dates are ISO `YYYY-MM-DD`. The file writes them as `DD/MM/YYYY` (decision 2). The month is `substr(date, 1, 7)`, as `monthRows` does in `src/lib/month.js`.
- Amounts are written only with `formatCents` from `src/lib/money.js`, using the stored sign (decisions 3 and the approved sign rule).
- Category label comes from `categoryFor(description)` and `CATEGORIES` in `src/lib/categories.js`, the same lookup the month page uses (decision 4).
- Quoting (decision 5): a field containing `,`, `"`, `\r` or `\n` is wrapped in double quotes with each inner `"` doubled. Every other field is written bare.
- Line endings (decision 11): every line, including the last, ends with `\r\n`. No byte-order mark (decision 10).
- Row order (decision 6): by `date`, then by `id` (stored order).
- Empty month (decision 7): the header line only, status 200.
- A missing or malformed `m` (decision 8): plain-text 400 with the body `The month is needed as YYYY-MM`, the same text as `/month`.
- Response (decision 9): `content-type: text/csv; charset=utf-8` and `content-disposition: attachment; filename="spending-YYYY-MM.csv"`.
- Feature switch `export-month` is off unless listed in the `FEATURES` environment variable. Off means `/export` returns the normal 404 `Not found`.

## Review Focus

- A description with a comma, a double quote or a line break is quoted with its quotes doubled, and no other field is quoted. Pinned in Task 1 (`csvField`, `renderCsv`).
- Rows come out by date then stored order, and the month boundary excludes the last day of the previous month and the first of the next. Pinned in Task 1 (`exportRows` on `:memory:`).
- A missing or malformed `m` (`''`, `2026-8`, `2026-13`) gets a 400, not a 200 with a blank file. Pinned in Task 2.
- With the switch off, `/export` is 404 and nothing is written. Pinned in Task 2.

## File Structure

- Create: `src/lib/export.js`. One job: turn a month's rows into CSV text and name the file.
- Modify: `src/server.js`. Adds the `/export` route, gated by the switch. Nothing else changes.
- Create: `tests/export.test.js`, `tests/export-route.test.js`.

## Decisions taken in this plan

- **Trailing line ending.** Every line ends with `\r\n`, including the last, so an empty month is exactly `Date,Description,Amount,Category\r\n`. This follows decision 11 of the approved design; it is not a new call.
- **Stored order is `id`.** Rows with the same date come out in insertion order (`ORDER BY date, id`), which is what "the order they were stored" means in decision 6.
- **400 text reused.** The `/export` 400 body is the `/month` body, so the two pages report a bad month the same way.

---

### Task 1: CSV helpers and the month's rows

**Files:**
- Create: `src/lib/export.js`
- Test: `tests/export.test.js`

**Interfaces:**
- Consumes: `CATEGORIES`, `categoryFor` from `src/lib/categories.js`; `formatCents` from `src/lib/money.js`.
- Produces:
  - `csvField(value: unknown): string` returns `String(value)`, wrapped in double quotes with inner `"` doubled when it contains `,`, `"`, `\r` or `\n`; otherwise unchanged.
  - `csvLine(fields: unknown[]): string` joins `csvField` of each field with `,` and ends with `\r\n`.
  - `exportName(m: string): string` returns `spending-${m}.csv`.
  - `fileDate(isoDate: string): string` returns `'2026-08-03'` as `'03/08/2026'`.
  - `exportRows(db, m: string): {date, description, cents}[]` runs `SELECT date, description, cents FROM transactions WHERE substr(date, 1, 7) = ? ORDER BY date, id`.
  - `renderCsv(rows: {date, description, cents}[]): string` returns the header line followed by one `csvLine` per row: `[fileDate(date), description ?? '', formatCents(cents), CATEGORIES[categoryFor(description ?? '')]]`.

- [ ] **Step 1: Write the failing tests**

Create `tests/export.test.js` covering: header only for `renderCsv([])` equal to `'Date,Description,Amount,Category\r\n'`; one row (`2026-08-03`, `Greenbarrow Fresh REF 1021`, `5420`) gives `03/08/2026,Greenbarrow Fresh REF 1021,54.20,Groceries\r\n`; a negative amount (`Marlowe Homewares`, `-4000`) gives `-40.00,Shopping`; a description `Pasta, Pizza & Co "Late" night` is written as `"Pasta, Pizza & Co ""Late"" night"` with category `Eating out`; a description with a line break is quoted; a plain field is not quoted; `exportName('2026-08')` is `spending-2026-08.csv`; `fileDate('2026-01-05')` is `05/01/2026`; `exportRows` on an in-memory database returns only the month's rows, sorted by date then insertion order, and excludes `2026-07-31` and `2026-09-01`.

Run `npm test`. The new file must fail (module not found or assertions), and the other 88 tests must still pass.

- [ ] **Step 2: Implement `src/lib/export.js`** to make those tests pass. Use `'\r\n'` for line endings and `db.prepare(...).all(m)` for the rows.

- [ ] **Step 3: Run `npm test`.** Expect all tests to pass.

- [ ] **Step 4: Commit** the test and the module on `feature/export-month`.

---

### Task 2: The `/export` route behind the switch

**Files:**
- Modify: `src/server.js`
- Test: `tests/export-route.test.js`

**Interfaces:**
- Consumes: `featureOn` from `src/lib/flags.js`; `parseMonth` from `src/lib/month.js`; `exportRows`, `renderCsv`, `exportName` from `src/lib/export.js`.
- Produces: `GET /export?m=YYYY-MM` with the switch on:
  - valid `m`: status 200, `content-type: text/csv; charset=utf-8`, `content-disposition: attachment; filename="spending-YYYY-MM.csv"`, body `renderCsv(exportRows(db, m))`.
  - missing or malformed `m`: status 400, `content-type` starting `text/plain`, body `The month is needed as YYYY-MM`.
  - switch off: status 404, body `Not found`.

- [ ] **Step 1: Write the failing route tests** in `tests/export-route.test.js`, following `tests/month-route.test.js` (same fixture: a temporary database with the three rows used there, same `start(features)` helper). Cover: with `export-month` on, `/export?m=2026-08` is 200 with the `text/csv` type, the attachment name `spending-2026-08.csv`, and a body whose first line is `Date,Description,Amount,Category` and that contains `03/08/2026,Greenbarrow Fresh REF 1021,54.20,Groceries`; `/export?m=2026-06` is the header line only; `''`, `?m=2026-8` and `?m=2026-13` are each 400 with the plain body; with the switch off, `/export?m=2026-08` is 404.

Run the file; it must fail on the route, not on the fixture.

- [ ] **Step 2: Add the route to `src/server.js`**, directly after the `/month` block, gated by `featureOn('export-month')`, and import the helpers from `./lib/export.js`.

- [ ] **Step 3: Run `npm test`.** All tests pass.

- [ ] **Step 4: Commit** the route and its tests on `feature/export-month`.

## Done check for slice 1

Each line of the slice's done list is a test above:

1. First line is `Date,Description,Amount,Category` (Task 1 header test; Task 2 body check).
2. Each row holds `DD/MM/YYYY`, the stored amount and the category label (Task 1 row tests).
3. A comma or a quote is quoted and doubled (Task 1 quoting tests).
4. Empty month gives the header line only (Task 1 header test; Task 2 `2026-06`).
5. Missing or malformed `m` gets a plain 400 (Task 2).
6. `text/csv` and `spending-YYYY-MM.csv` (Task 2).

Slice 1 adds no link to the month page; that is slice 2.
