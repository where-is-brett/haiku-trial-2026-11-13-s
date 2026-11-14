<!-- docs/decisions/2026-11-14-should-the-csv-neutralise-descriptions-that-start.md -->
# Should the CSV neutralise descriptions that start with an equals sign, a plus or an at sign, so a spreadsheet does not run them as formulas?

- **Date:** 14 November 2026
- **Piece:** export-month
- **Options:** A. Put a leading apostrophe on description cells that start with an equals sign, plus or at sign. Other rows and the amounts are unchanged (Small: one function and its tests; a few rows show a leading apostrophe; Can be undone) · B. Keep the file exactly as approved. The formula risk stays (No work; the risk stays; Can be undone)
- **Recommended:** neutralise
- **Chosen:** neutralise
- **The director's words:** none
