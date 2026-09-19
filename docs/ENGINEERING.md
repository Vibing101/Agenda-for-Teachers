# Engineering process & repo conventions

## Repo layout

```
/
├─ src-tauri/          ← Rust backend: file I/O, SQLite, backup job, PDF trigger
├─ src/                 ← frontend (framework choice left to the implementing agent; keep it boring)
├─ reference/            ← the source PDF package (letters, message bank, print templates, quick-start guide) and the Excel grade registry — read-only inputs, never generated output
├─ docs/
│   ├─ REBUILD_SPEC.md      ← the functional/architecture spec, kept in sync
│   ├─ ENGINEERING.md       ← this document
│   └─ milestones/           ← one short dated release note per milestone, matching the acceptance criteria below
├─ tests/
└─ .github/workflows/     ← CI: build + test on both Windows and macOS runners
```

## Branching & commits

- `main` is always releasable. Work happens on short-lived branches named `m<N>-<slug>` (e.g. `m2-grades`), one per milestone or a clear sub-slice of one.
- Commit messages state what changed and why in one line; a commit that only makes tests pass again references the milestone it belongs to.
- One pull request per milestone (or per sub-slice, for the larger milestones like M6). No PR merges with failing CI.

## The gate every milestone must pass before it's called done

1. **Typecheck** clean.
2. **Lint** clean.
3. **Automated tests pass** — unit tests for any calculation logic (the grade-weighting formula above all), component/integration tests for the module's screens, and a persistence round-trip test (write data, close, reopen, data is intact).
4. **Packaged build succeeds on both Windows and macOS**, structurally verified (the app actually launches from a double-click, not just "the build command exited 0").
5. **Manual launch test from inside a simulated cloud-sync folder** on both OSes — this is the specific failure mode that killed the previous attempt, so it is a named, non-skippable step every milestone, not just at the end of the project.
6. **A short dated release note** goes in `docs/milestones/`, recording what shipped, what was decided (if a milestone touched anything the rebuild spec left open), and the result of steps 1-5 — following the previous project's own practice of writing this down per release rather than only trusting green CI.

## Milestone sign-off

A milestone is "done" only when its specific acceptance criteria (below) are met **and** the gate above passes. The implementing agent posts the release note and a one-line summary; the product owner reviews before the branch merges to `main`. Agents should surface any spec ambiguity they hit as a question in the PR description rather than silently deciding — the rebuild spec's "Decisions & open questions" table is the model to follow: resolved calls get recorded, not re-litigated by the next agent to touch the code.

# Acceptance criteria per milestone

Each milestone's generic gate (above) still applies; these are what's specific to that milestone's own content.

**M0 — Shell & persistence**
- App launches by double-click on both Windows and macOS from inside a folder actively synced by both Google Drive and OneDrive (test both, not just one).
- Data written, then a full app quit and relaunch, still shows the data.
- A backup snapshot exists in `data/backups/` after a session; an old backup is thinned per the retention schedule once enough time/snapshots have passed.
- Manually editing the data file's bytes while the app is closed, then reopening the app, triggers the "disk changed" block-and-reload behavior rather than a silent overwrite.

**M1 — School year, classes, students**
- Changing the school-year start date after data exists does not move or delete any already-entered record.
- A student can belong to two classes at once and shows correctly in both rosters.
- Every field in the Student data-model entry (guardians, health/emergency, SEN status) round-trips through save/reload.

**M2 — Grades**
- The weighted-average formula matches the spec's worked examples exactly, including: a row with some columns still blank, a row where entered weights don't sum to 100, and the all-zero-weight fallback to plain average.
- The running-weight-total warning appears/disappears correctly as columns are edited; no save is ever blocked by it.
- A generated grade-sheet PDF opens and renders Greek characters correctly (not just Latin).
- Class and year summary numbers match a hand-computed check on a test dataset.

**M3 — Weekly planning & timetable**
- A lesson plan entered against a specific date survives a school-year start-date change (it's keyed by date, not week-index).
- The Today view correctly shows only today's scheduled classes on a spot-checked date.

**M4 — Attendance & behavior**
- The monthly attendance grid and the detailed absence-event log can hold different, non-derived data for the same student/date without either overwriting the other.
- A support plan's status field is never overwritten by changes to its goals (status stays teacher-written).
- The cross-class support overview correctly reflects a plan change made in a single class.

**M5 — Parents & staff**
- All 7 letters and a sample across all 15 message-bank categories generate a correctly-formatted, Greek-rendering PDF with every placeholder filled and none left as `[BRACKETS]`.
- A parent appointment and a parent-contact-log entry for the same guardian/date coexist independently.
- The upcoming-overview panel correctly surfaces both appointments and meetings due in the next 7 days on a test dataset.

**M6 — Annual planning & the rest of teaching**
- The week-by-class progress matrix correctly reflects entries made from the per-class weekly plan (M3) without duplicate data entry.
- An exam, a trip, a textbook, and a resource entry each round-trip through save/reload with every field intact.

**M7 — Print forms & substitute folder**
- All 11 print forms can be filled, saved under a custom name, reopened, and re-edited.
- The substitute folder's seating plan reflects a live edit made in the Classes module without needing regeneration — i.e. it reads live data, it isn't a stale copy.
- The substitute folder exports as one combined multi-page PDF, not 5 separate files.

**M8 — Development, wellbeing, staff directory, covers/leave**
- Development goals (open-ended) and the 6 fixed annual-goal areas (from M1's school-year setup) remain visibly separate and neither is generated from the other.
- A cover-taught record and a leave record for the same date coexist as separate entries.

**M9 — Bilingual pass & polish**
- Every UI string, all 7 letters, and all 150 messages have both a Greek and an English version; switching the language toggle changes all of them, with no string left showing a placeholder or the wrong language.
- A side-by-side check of at least 3 PDF outputs against the source product's equivalent page confirms acceptable layout fidelity (page size, general structure, Greek rendering) — a judgment call for the product owner to sign off on, not an automated check.
- The real two-device test passes: write data on a simulated "device 1", let a real cloud-sync client (Drive or OneDrive) finish syncing, launch on "device 2", confirm the data is there and correct.
