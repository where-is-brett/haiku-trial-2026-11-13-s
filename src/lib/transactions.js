// src/lib/transactions.js
import { CATEGORIES, categoryFor, shopNameFor } from './categories.js';

// Adds the nullable category column to the ledger when it is missing. Existing rows keep NULL, which means the shop rule applies.
export function ensureCategoryColumn(db) {
  const columns = db.prepare('PRAGMA table_info(transactions)').all();
  if (!columns.some((column) => column.name === 'category')) {
    db.exec('ALTER TABLE transactions ADD COLUMN category TEXT');
  }
}

// Creates the table of shop rules, one category per shop. Safe to run on a ledger that already has it.
export function ensureShopRulesTable(db) {
  db.exec('CREATE TABLE IF NOT EXISTS shop_rules (shop TEXT PRIMARY KEY, category TEXT NOT NULL)');
}

// Returns every shop rule as a Map from shop name to category key.
export function shopRules(db) {
  return new Map(db.prepare('SELECT shop, category FROM shop_rules').all().map((row) => [row.shop, row.category]));
}

// Stores the category for a shop, replacing any rule already held for that shop.
export function setShopRule(db, shop, category) {
  db.prepare('INSERT OR REPLACE INTO shop_rules (shop, category) VALUES (?, ?)').run(shop, category);
}

// Returns the chosen category when it is a category key. Otherwise returns the category of the shop rule that
// applies to the description, when that rule's category is a category key. Otherwise returns the shop list's category.
export function categoryOf(row, rules = new Map()) {
  if (row.category !== null && Object.hasOwn(CATEGORIES, row.category)) return row.category;
  const shop = shopNameFor(row.description);
  if (shop !== null && rules.has(shop) && Object.hasOwn(CATEGORIES, rules.get(shop))) return rules.get(shop);
  return categoryFor(row.description);
}
