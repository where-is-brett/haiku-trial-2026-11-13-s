// src/lib/statement.js

import { parseDate } from './dates.js';
import { parseAmount } from './money.js';

const HEADER = 'Date,Description,Amount';
const DATE_SHAPE = /^\d{2}\/\d{2}\/\d{4}$/;

// Raised for any statement that is refused. The message is the plain reason.
export class StatementError extends Error {
  constructor(message) {
    super(message);
    this.name = 'StatementError';
  }
}

// Splits one CSV line into its fields. A quote opens a quoted field only at
// the start of a field, and a doubled quote inside one is a single quote.
// Returns null when a quoted field is never closed, or when text follows a
// closing quote without a comma.
export function splitCsvLine(line) {
  const fields = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch !== '"') {
        field += ch;
      } else if (line[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = false;
        const next = line[i + 1];
        if (next !== undefined && next !== ',') return null;
      }
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else if (ch === '"' && field === '') {
      inQuotes = true;
    } else {
      field += ch;
    }
    i += 1;
  }
  if (inQuotes) return null;
  fields.push(field);
  return fields;
}

// Reads a whole statement into rows, or throws a StatementError naming the
// first bad line. Every line is checked before anything is returned.
export function readStatement(text) {
  const body = text.startsWith('﻿') ? text.slice(1) : text;
  const lines = body.split('\n').map((line) => (line.endsWith('\r') ? line.slice(0, -1) : line));
  while (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();

  if (lines[0] !== HEADER) {
    throw new StatementError(`line 1: the header must be exactly ${HEADER}`);
  }

  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const lineNo = i + 1;
    const fields = splitCsvLine(lines[i]);
    if (fields === null) {
      throw new StatementError(`line ${lineNo}: a quoted field is not closed or is followed by text`);
    }
    if (fields.length !== 3) {
      throw new StatementError(`line ${lineNo}: expected 3 fields, found ${fields.length}`);
    }
    const [date, description, amount] = fields;
    if (!DATE_SHAPE.test(date)) {
      throw new StatementError(`line ${lineNo}: the date must be DD/MM/YYYY`);
    }
    if (!/[0-9]/.test(amount)) {
      throw new StatementError(`line ${lineNo}: the amount must contain a number`);
    }
    rows.push({ date: parseDate(date), description, cents: parseAmount(amount) });
  }
  return rows;
}
