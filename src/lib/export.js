// src/lib/export.js
import { CATEGORIES, categoryFor } from './categories.js';
import { formatCents } from './money.js';

const HEADER = ['Date', 'Description', 'Amount', 'Category'];

// Writes one field as CSV: wrapped in double quotes with inner quotes doubled when it holds a comma, quote or line break.
export function csvField(value) {
  const text = String(value);
  return /[,"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

// Writes one CSV line from its fields, ending with CRLF.
export function csvLine(fields) {
  return `${fields.map(csvField).join(',')}\r\n`;
}

// The file name for a YYYY-MM month.
export function exportName(m) {
  return `spending-${m}.csv`;
}

// Reformats a stored ISO date (YYYY-MM-DD) as DD/MM/YYYY.
export function fileDate(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
}

// Reads a month's transactions in stored order: by date, then by id, as plain objects.
export function exportRows(db, m) {
  return db
    .prepare('SELECT date, description, cents FROM transactions WHERE substr(date, 1, 7) = ? ORDER BY date, id')
    .all(m)
    .map(({ date, description, cents }) => ({ date, description, cents }));
}

// Returns the whole CSV text for a month's rows, header first.
export function renderCsv(rows) {
  const lines = [csvLine(HEADER)];
  for (const { date, description, cents } of rows) {
    const text = description ?? '';
    lines.push(csvLine([fileDate(date), text, formatCents(cents), CATEGORIES[categoryFor(text)]]));
  }
  return lines.join('');
}
