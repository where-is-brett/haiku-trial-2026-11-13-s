// src/lib/import.js

import { readStatement } from './statement.js';

// The date and cents never contain a NUL, which keeps the separator unambiguous.
function keyOf(row) {
  return [row.date, row.description, row.cents].join('\u0000');
}

// Stores the statement rows that are not stored yet and reports the counts.
// A row matches a stored row when date, description and cents are all equal.
// Rows added by this upload are not compared with each other, so identical
// lines in one file are both stored.
export function importStatement(db, text) {
  const rows = readStatement(text);

  const stored = new Set();
  for (const row of db.prepare('SELECT date, description, cents FROM transactions').iterate()) {
    stored.add(keyOf(row));
  }

  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
  let added = 0;
  let skipped = 0;
  db.exec('BEGIN');
  try {
    for (const row of rows) {
      if (stored.has(keyOf(row))) {
        skipped += 1;
      } else {
        insert.run(row.date, row.description, row.cents);
        added += 1;
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { added, skipped };
}
