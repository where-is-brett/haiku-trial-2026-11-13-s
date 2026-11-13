<!-- docs/decisions/2026-11-14-should-a-statement-with-a-date-that-does-not-exist.md -->
# Should a statement with a date that does not exist, such as 31/02/2026 or 00/13/2026, be refused?

- **Date:** 14 November 2026
- **Piece:** statement-import
- **Options:** A. Refuse the whole file, naming the line, when a date does not exist (A statement with a typo in a date is refused and has to be fixed by hand; Can be undone) · B. Keep checking the shape only, and store impossible dates as they are (Nothing extra, but months like 2026-13 can appear on the home page; Cannot be undone)
- **Recommended:** refuse
- **Chosen:** refuse
- **The director's words:** none
