<!-- docs/decisions/2026-11-14-when-a-statement-line-is-already-stored-and-the-ne.md -->
# When a statement line is already stored and the new upload has that line twice, should both copies be skipped, or should only the copies the ledger does not have be stored?

- **Date:** 14 November 2026
- **Piece:** statement-import
- **Options:** A. Store the copies the ledger does not already have (the second purchase is kept) (A little more logic in the import; a repeat upload still adds nothing; Can be undone) · B. Skip every copy when one is already stored (the spec's wording as it reads today) (Nothing extra, but a real purchase can be dropped on a later statement; Can be undone)
- **Recommended:** count
- **Chosen:** count
- **The director's words:** none
