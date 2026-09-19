# M<N> — <milestone name>

**Date:** YYYY-MM-DD
**Branch:** `m<N>-<slug>`
**Signed off by:** <product owner, once reviewed>

## What shipped

- <one line per thing a user can now do, or per piece of foundation laid>

## Decisions taken

Only for things the rebuild spec left open or did not cover. Resolved calls get
recorded here so the next agent does not re-litigate them. If nothing was
decided, say "None — everything followed the spec as written."

| Decision | Call taken | Why |
|---|---|---|
| | | |

## Open questions for the product owner

Anything ambiguous that was worked around rather than answered. "None" is a
valid entry.

## Gate results (docs/ENGINEERING.md)

| # | Step | Result |
|---|---|---|
| 1 | Typecheck clean | |
| 2 | Lint clean | |
| 3 | Automated tests pass | |
| 4 | Packaged build succeeds on Windows and macOS, structurally verified | |
| 5 | Manual launch test from inside a cloud-synced folder, both OSes | |
| 6 | This release note | |

## Acceptance criteria for this milestone

One row per criterion from ENGINEERING.md's "Acceptance criteria per milestone"
section, quoted as written, with the evidence.

| Criterion | Result | Evidence |
|---|---|---|
| | | |

## Known gaps

What is deliberately not done yet, and which milestone picks it up.
