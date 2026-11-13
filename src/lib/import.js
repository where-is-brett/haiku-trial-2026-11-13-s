// src/lib/import.js

import { readStatement } from './statement.js';

// The date and cents never contain a NUL, which keeps the separator unambiguous.
function keyOf(row) {
  return [row.date, row.description, row.cents].join('\u0000');
}

// Stores the statement rows the ledger does not hold yet and reports the counts.
// A key is date, description and cents. The ledger holds some number of copies
// of each key, and the file may hold more or fewer. The upload adds only the
// copies the ledger lacks: the Nth copy of a key in the file is added when N is
// greater than the number of copies already stored, and skipped otherwise. So
// re-importing the same file, whose counts equal the stored counts, adds nothing.
export function importStatement(db, text) {
  const rows = readStatement(text);

  const stored = new Map();
  for (const row of db.prepare('SELECT date, description, cents FROM transactions').iterate()) {
    const key = keyOf(row);
    stored.set(key, (stored.get(key) ?? 0) + 1);
  }

  const seen = new Map();
  const insert = db.prepare('INSERT INTO transactions (date, description, cents) VALUES (?, ?, ?)');
  let added = 0;
  let skipped = 0;
  db.exec('BEGIN');
  try {
    for (const row of rows) {
      const key = keyOf(row);
      const copies = (seen.get(key) ?? 0) + 1;
      seen.set(key, copies);
      if (copies > (stored.get(key) ?? 0)) {
        insert.run(row.date, row.description, row.cents);
        added += 1;
      } else {
        skipped += 1;
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
  return { added, skipped };
}
