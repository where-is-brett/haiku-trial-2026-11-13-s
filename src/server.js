// src/server.js
import http from 'node:http';
import { Readable } from 'node:stream';
import { DatabaseSync } from 'node:sqlite';
import { featureOn } from './lib/flags.js';
import { parseMonth, monthRows, totalsByCategory, renderMonth } from './lib/month.js';
import { renderImportPage, handleImport } from './lib/import-page.js';
import { monthsWithTransactions, renderMonthList } from './lib/home.js';

const port = Number(process.env.PORT ?? 3000);
const db = new DatabaseSync(process.env.LEDGER_DB ?? 'ledger.db');
db.exec(
  'CREATE TABLE IF NOT EXISTS transactions (id INTEGER PRIMARY KEY, date TEXT, description TEXT, cents INTEGER)',
);

function page(body) {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Spending tracker</title></head>
<body>
<main>
<h1>Spending tracker</h1>
${body}
</main>
</body>
</html>
`;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/') {
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM transactions').get();
    let body = n === 0 ? '<p>Nothing imported yet</p>' : `<p>${n} transactions imported</p>`;
    if (featureOn('statement-import')) body += renderMonthList(monthsWithTransactions(db));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page(body));
    return;
  }
  if (url.pathname === '/month' && featureOn('month-page')) {
    const m = parseMonth(url.searchParams.get('m'));
    if (m === null) {
      res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('The month is needed as YYYY-MM');
      return;
    }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(page(renderMonth(m, totalsByCategory(monthRows(db, m)))));
    return;
  }
  if (url.pathname === '/import' && featureOn('statement-import')) {
    if (req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(page(renderImportPage()));
      return;
    }
    if (req.method === 'POST') {
      const request = new Request(url, {
        method: 'POST',
        headers: req.headers,
        body: Readable.toWeb(req),
        duplex: 'half',
      });
      let body;
      try {
        body = page(await handleImport(db, request));
      } catch (error) {
        console.error(error);
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('The statement could not be imported; nothing was added.');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
      return;
    }
  }
  res.writeHead(404,{ 'content-type': 'text/plain; charset=utf-8' });
  res.end('Not found');
});

server.listen(port, () => {
  console.log(`listening on ${server.address().port}`);
});
