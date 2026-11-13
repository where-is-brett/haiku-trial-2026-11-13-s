// tests/categories.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { categoryFor, CATEGORIES } from '../src/lib/categories.js';

const SHOPS = [
  ['Greenbarrow Fresh', 'groceries'],
  ['Pennywhistle Market', 'groceries'],
  ['Lowtide Grocers', 'groceries'],
  ['Harvest Lane Foods', 'groceries'],
  ['Pasta, Pizza & Co', 'dining'],
  ['Kestrel Coffee Bar', 'dining'],
  ['Saltbush Noodle House', 'dining'],
  ['Ember Grill', 'dining'],
  ['Waverly Fuel Stop', 'transport'],
  ['Tramline Fares', 'transport'],
  ['Lantern Rideshare', 'transport'],
  ['Northgate Parking', 'transport'],
  ['Brightfield Power', 'bills'],
  ['Clearwater Utilities', 'bills'],
  ['Skyline Broadband', 'bills'],
  ['Hollis Insurance', 'bills'],
  ['Marlowe Homewares', 'shopping'],
  ['Quillon Books', 'shopping'],
  ['Fernhill Outfitters', 'shopping'],
  ['Pixel Parade Tech', 'shopping'],
  ['Larkspur Pharmacy', 'health'],
  ['Elmgrove Physio', 'health'],
  ['Cobalt Dental', 'health'],
  ['Sunnyvale Optical', 'health'],
  ['Brightwave Payroll', 'income'],
  ['Tidepool Interest', 'income'],
  ['Oakridge Dividends', 'income'],
];

test('each shop name as a description files under its category', () => {
  for (const [name, category] of SHOPS) {
    assert.equal(categoryFor(name), category, name);
  }
});

test('a shop name in another case still matches', () => {
  assert.equal(categoryFor('GREENBARROW FRESH'), 'groceries');
  assert.equal(categoryFor('pasta, pizza & co'), 'dining');
});

test('a shop name inside a longer description still matches', () => {
  assert.equal(categoryFor('CARD 0912 Greenbarrow Fresh Ltd'), 'groceries');
});

test('a description naming two shops files under the one listed first', () => {
  assert.equal(categoryFor('Greenbarrow Fresh Ember Grill'), 'groceries');
});

test('a description that matches no shop files under other', () => {
  assert.equal(categoryFor('Unknown Shop 123'), 'other');
  assert.equal(categoryFor(''), 'other');
});

test('the eight category labels are the spec labels', () => {
  assert.deepEqual(CATEGORIES, {
    groceries: 'Groceries',
    dining: 'Eating out',
    transport: 'Transport',
    bills: 'Bills',
    shopping: 'Shopping',
    health: 'Health',
    income: 'Income',
    other: 'Other',
  });
});
