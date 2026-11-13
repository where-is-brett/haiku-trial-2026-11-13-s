// tests/statement.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitCsvLine } from '../src/lib/statement.js';

test('a quoted field may hold a comma', () => {
  assert.deepEqual(splitCsvLine('05/09/2026,"Smith, J",(40.00)'), ['05/09/2026', 'Smith, J', '(40.00)']);
});

test('a doubled quote inside a quoted field is one quote', () => {
  assert.deepEqual(splitCsvLine('"Bob ""B"" Shop",1.00'), ['Bob "B" Shop', '1.00']);
});

test('an unclosed quote or text after a closing quote is not a line', () => {
  assert.equal(splitCsvLine('"Smith, J,1.00'), null);
  assert.equal(splitCsvLine('"a"b,1.00'), null);
});
