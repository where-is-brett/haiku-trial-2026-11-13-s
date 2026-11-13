// tests/statement.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitCsvLine, readStatement, StatementError } from '../src/lib/statement.js';

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

test('a statement becomes dated rows with cents, quoted commas and brackets read correctly', () => {
  const text = 'Date,Description,Amount\r\n03/08/2026,Greenbarrow Fresh REF 1021,54.20\r\n19/08/2026,"Smith, J",(40.00)\r\n25/08/2026,Brightwave Payroll,-2100.00\r\n';
  assert.deepEqual(readStatement(text), [
    { date: '2026-08-03', description: 'Greenbarrow Fresh REF 1021', cents: 5420 },
    { date: '2026-08-19', description: 'Smith, J', cents: -4000 },
    { date: '2026-08-25', description: 'Brightwave Payroll', cents: -210000 },
  ]);
});

test('a header-only file is a statement with no rows', () => {
  assert.deepEqual(readStatement('Date,Description,Amount\r\n'), []);
});

test('a file with another header, a bad date or a short row is refused with a plain error', () => {
  assert.throws(() => readStatement('Date,Payee,Amount\r\n03/08/2026,A,1.00\r\n'), StatementError);
  assert.throws(() => readStatement('Date,Description,Amount\r\n2026-08-03,A,1.00\r\n'), StatementError);
  assert.throws(() => readStatement('Date,Description,Amount\r\n03/08/2026,A\r\n'), StatementError);
  assert.throws(() => readStatement('Date,Description,Amount\r\n03/08/2026,A,()\r\n'), StatementError);
  assert.throws(() => readStatement(''), StatementError);
});

test('a byte-order mark before the header is ignored', () => {
  assert.deepEqual(readStatement('﻿Date,Description,Amount\r\n03/08/2026,A,1.00\r\n'), [
    { date: '2026-08-03', description: 'A', cents: 100 },
  ]);
});
