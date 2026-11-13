// tests/money.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAmount } from '../src/lib/money.js';

test('a bracketed amount is money back', () => {
  assert.equal(parseAmount('(12.50)'), -1250);
  assert.equal(parseAmount(' ( 12.50 ) '), -1250);
  assert.equal(parseAmount('(1,040.00)'), -104000);
  assert.equal(parseAmount('(0.00)'), 0);
});

test('a plain amount and a leading minus read as before', () => {
  assert.equal(parseAmount('12.50'), 1250);
  assert.equal(parseAmount('-2100.00'), -210000);
  assert.equal(parseAmount('(12.50'), 1250);
});
