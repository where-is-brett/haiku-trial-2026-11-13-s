<!-- docs/decisions/2026-11-14-what-the-import-does-with-an-amount-that-has-digit.md -->
# What the import does with an amount that has digits but is malformed, such as 1.2.3, 12abc or (40.00

- **Date:** 14 November 2026
- **Piece:** statement-import
- **Options:** A. Refuse the whole file, naming the line, when an amount is not a plain or bracketed number (A few real statements with odd amounts would be refused and need fixing by hand; Can be undone) · B. Keep reading it as the current reader does, with the wrong values it gives today (Nothing extra, but some wrong amounts go into the ledger unnoticed; Cannot be undone)
- **Recommended:** refuse
- **Chosen:** refuse
- **The director's words:** none
