// src/lib/categories.js

// Category keys and their labels, in the order the spec lists them.
export const CATEGORIES = {
  groceries: 'Groceries',
  dining: 'Eating out',
  transport: 'Transport',
  bills: 'Bills',
  shopping: 'Shopping',
  health: 'Health',
  income: 'Income',
  other: 'Other',
};

// Shops in spec order. The first shop whose name appears in a description wins.
const SHOPS = [
  { name: 'Greenbarrow Fresh', category: 'groceries' },
  { name: 'Pennywhistle Market', category: 'groceries' },
  { name: 'Lowtide Grocers', category: 'groceries' },
  { name: 'Harvest Lane Foods', category: 'groceries' },
  { name: 'Pasta, Pizza & Co', category: 'dining' },
  { name: 'Kestrel Coffee Bar', category: 'dining' },
  { name: 'Saltbush Noodle House', category: 'dining' },
  { name: 'Ember Grill', category: 'dining' },
  { name: 'Waverly Fuel Stop', category: 'transport' },
  { name: 'Tramline Fares', category: 'transport' },
  { name: 'Lantern Rideshare', category: 'transport' },
  { name: 'Northgate Parking', category: 'transport' },
  { name: 'Brightfield Power', category: 'bills' },
  { name: 'Clearwater Utilities', category: 'bills' },
  { name: 'Skyline Broadband', category: 'bills' },
  { name: 'Hollis Insurance', category: 'bills' },
  { name: 'Marlowe Homewares', category: 'shopping' },
  { name: 'Quillon Books', category: 'shopping' },
  { name: 'Fernhill Outfitters', category: 'shopping' },
  { name: 'Pixel Parade Tech', category: 'shopping' },
  { name: 'Larkspur Pharmacy', category: 'health' },
  { name: 'Elmgrove Physio', category: 'health' },
  { name: 'Cobalt Dental', category: 'health' },
  { name: 'Sunnyvale Optical', category: 'health' },
  { name: 'Brightwave Payroll', category: 'income' },
  { name: 'Tidepool Interest', category: 'income' },
  { name: 'Oakridge Dividends', category: 'income' },
];

// Returns the category key for a transaction description, ignoring case.
// Returns 'other' when no shop name appears in the description.
export function categoryFor(description) {
  const text = description.toLowerCase();
  const shop = SHOPS.find((s) => text.includes(s.name.toLowerCase()));
  return shop ? shop.category : 'other';
}
