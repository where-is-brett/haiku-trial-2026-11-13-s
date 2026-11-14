// src/lib/import-page.js

import { importStatement } from './import.js';
import { StatementError } from './statement.js';

const NO_FILE = 'choose a statement file';

// Escapes the five characters that can open markup or end an attribute.
function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// The body of the import page: the message when given, then the upload form.
// The server's page() wraps it in the document.
export function renderImportPage(message) {
  const notice = message === undefined ? '' : `<p>${escapeHtml(message)}</p>\n`;
  return `<h2>Import a statement</h2>
${notice}<form method="post" enctype="multipart/form-data">
<input type="file" name="statement" accept=".csv,text/csv">
<button type="submit">Import</button>
</form>`;
}

// Runs one upload. Returns the page with the counts for this upload, or with the
// plain reason when the file is refused. Any other error is rethrown.
export async function handleImport(db, request) {
  let statement;
  try {
    const formData = await request.formData();
    statement = formData.get('statement');
  } catch {
    return renderImportPage(NO_FILE);
  }
  if (!(statement instanceof File)) {
    return renderImportPage(NO_FILE);
  }

  try {
    const text = await statement.text();
    const { added, skipped } = importStatement(db, text);
    return renderImportPage(`Added ${added}, skipped ${skipped}`);
  } catch (error) {
    if (error instanceof StatementError) {
      return renderImportPage(error.message);
    }
    throw error;
  }
}
