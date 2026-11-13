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

test('an amount with a digit that does not read as a number is refused, naming the line', () => {
  assert.throws(
    () => readStatement('Date,Description,Amount\r\n03/08/2026,Shop,"..5"\r\n'),
    (err) => err instanceof StatementError && err.message.startsWith('line 2: '),
  );
});

const ACCEPTED_AMOUNTS = [
  ['12.50', 1250],
  ['-2100.00', -210000],
  ['(40.00)', -4000],
  ['"1,040.00"', 104000],
  ['"12,345"', 1234500],
  ['0.50', 50],
  ['.50', 50],
];

for (const [amount, cents] of ACCEPTED_AMOUNTS) {
  test(`the amount ${amount} is accepted as ${cents} cents`, () => {
    assert.deepEqual(readStatement(`Date,Description,Amount\r\n03/08/2026,Shop,${amount}\r\n`), [
      { date: '2026-08-03', description: 'Shop', cents },
    ]);
  });
}

const REFUSED_AMOUNTS = ['1.2.3', '12abc', '(40.00', '40.00)', '-(12.50)', '1 2', '"12,34"', '"1,04"', '"1,0400"', '",123"', '"123,"'];

for (const amount of REFUSED_AMOUNTS) {
  test(`the amount ${amount} is refused with a StatementError naming line 2`, () => {
    assert.throws(
      () => readStatement(`Date,Description,Amount\r\n03/08/2026,Shop,${amount}\r\n`),
      (err) => err instanceof StatementError && err.message.startsWith('line 2: '),
    );
  });
}

test('a byte-order mark before the header is ignored', () => {
  assert.deepEqual(readStatement('﻿Date,Description,Amount\r\n03/08/2026,A,1.00\r\n'), [
    { date: '2026-08-03', description: 'A', cents: 100 },
  ]);
});

const REFUSED_DATES = ['31/02/2026', '29/02/2026', '00/13/2026', '00/00/0000', '32/01/2026', '15/00/2026'];

for (const date of REFUSED_DATES) {
  test(`the date ${date} does not exist and is refused with a StatementError naming line 2`, () => {
    assert.throws(
      () => readStatement(`Date,Description,Amount\r\n${date},Shop,1.00\r\n`),
      (err) => err instanceof StatementError && err.message.startsWith('line 2: '),
    );
  });
}

const ACCEPTED_DATES = [
  ['29/02/2028', '2028-02-29'],
  ['31/12/2026', '2026-12-31'],
  ['01/01/2026', '2026-01-01'],
];

for (const [date, iso] of ACCEPTED_DATES) {
  test(`the date ${date} is a real date and is accepted as ${iso}`, () => {
    assert.deepEqual(readStatement(`Date,Description,Amount\r\n${date},Shop,1.00\r\n`), [
      { date: iso, description: 'Shop', cents: 100 },
    ]);
  });
}
