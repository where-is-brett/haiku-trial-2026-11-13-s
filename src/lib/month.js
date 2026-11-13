// src/lib/month.js
import { CATEGORIES, categoryFor } from './categories.js';

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
