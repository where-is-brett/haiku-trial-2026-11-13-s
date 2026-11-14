// src/lib/transactions.js
import { CATEGORIES, categoryFor } from './categories.js';

// Adds the nullable category column to the ledger when it is missing. Existing rows keep NULL, which means the shop rule applies.
export function ensureCategoryColumn(db) {
  const columns = db.prepare('PRAGMA table_info(transactions)').all();
  if (!columns.some((column) => column.name === 'category')) {
    db.exec('ALTER TABLE transactions ADD COLUMN category TEXT');
  }
}

// Returns the chosen category when it is a category key, otherwise the category the shop rule gives the description.
export function categoryOf(row) {
  return row.category !== null && Object.hasOwn(CATEGORIES, row.category)
    ? row.category
    : categoryFor(row.description);
}
