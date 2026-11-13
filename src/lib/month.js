// src/lib/month.js
import { CATEGORIES, categoryFor } from './categories.js';
import { formatCents } from './money.js';

// A month as YYYY-MM, with the month between 01 and 12.
export const MONTH_FORMAT = /^\d{4}-(0[1-9]|1[0-2])$/;

// Returns the month when the text is a valid YYYY-MM, otherwise null.
export function parseMonth(text) {
  return typeof text === 'string' && MONTH_FORMAT.test(text) ? text : null;
}

// Moves a YYYY-MM month by a number of months, across year boundaries.
export function shiftMonth(m, by) {
  const [year, month] = m.split('-').map(Number);
  const index = year * 12 + (month - 1) + by;
  const shiftedYear = Math.floor(index / 12);
  const shiftedMonth = (index % 12) + 1;
  return `${shiftedYear}-${String(shiftedMonth).padStart(2, '0')}`;
}

// The one place the sign is decided: the stored sign is kept for every category (recommendation "keep", held for the director).
export function signedCents(category, cents) {
  return cents;
}

// Sums each category, and all categories together, for a month's rows.
export function totalsByCategory(rows) {
  const totals = Object.fromEntries(Object.keys(CATEGORIES).map((key) => [key, 0]));
  totals.all = 0;
  for (const row of rows) {
    const category = categoryFor(row.description);
    const cents = signedCents(category, row.cents);
    totals[category] += cents;
    totals.all += cents;
  }
  return totals;
}

// Reads the rows dated in a YYYY-MM month from the ledger.
export function monthRows(db, m) {
  return db
    .prepare('SELECT date, description, cents FROM transactions WHERE substr(date, 1, 7) = ?')
    .all(m);
}

// Returns the HTML body for a month's totals table, with links to the months either side.
// The server's page() adds the surrounding document. Labels are constants and m is validated before this call, so nothing is escaped here.
export function renderMonth(m, totals) {
  const cell = (key, cents) => {
    const text = formatCents(cents);
    return `<td data-category="${key}" data-total="${text}">${text}</td>`;
  };
  const rows = Object.entries(CATEGORIES)
    .map(([key, label]) => `<tr><th scope="row">${label}</th>${cell(key, totals[key])}</tr>`)
    .join('\n');
  const grand = `<tr><th scope="row">Total</th>${cell('all', totals.all)}</tr>`;
  return `<h2>${m}</h2>
<nav><a href="/month?m=${shiftMonth(m, -1)}">Previous</a> <a href="/month?m=${shiftMonth(m, 1)}">Next</a></nav>
<table>
${rows}
${grand}
</table>`;
}
