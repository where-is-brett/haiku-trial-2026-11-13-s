// src/lib/home.js

// Returns the YYYY-MM months that have at least one transaction, newest first.
export function monthsWithTransactions(db) {
  const rows = db
    .prepare('SELECT DISTINCT substr(date, 1, 7) AS month FROM transactions ORDER BY month DESC')
    .all();
  return rows.map((row) => String(row.month));
}

// Renders the months as a heading and a list of links, or nothing when there are none.
// The months are built from stored YYYY-MM dates, so they need no escaping.
export function renderMonthList(months) {
  if (months.length === 0) return '';
  let html = '<h2>Months</h2>\n<ul>\n';
  for (const m of months) {
    html += `<li><a href="/month?m=${m}">${m}</a></li>\n`;
  }
  return html + '</ul>\n';
}
