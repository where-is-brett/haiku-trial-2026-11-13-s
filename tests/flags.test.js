// tests/flags.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { featureOn } from '../src/lib/flags.js';

test('a feature is on only when named in FEATURES', () => {
  assert.equal(featureOn('month-page', { FEATURES: 'month-page' }), true);
  assert.equal(featureOn('month-page', { FEATURES: 'other, month-page ' }), true);
  assert.equal(featureOn('month-page', { FEATURES: 'other' }), false);
  assert.equal(featureOn('month-page', {}), false);
});
