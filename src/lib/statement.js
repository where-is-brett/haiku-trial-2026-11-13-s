// src/lib/statement.js

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
