# Engineering process & repo conventions

## Repo layout

```
/
├─ src-tauri/          ← Rust backend: file I/O, SQLite, backup job, PDF trigger
├─ src/                 ← frontend (framework choice left to the implementing agent; keep it boring)
├─ reference/            ← LOCAL ONLY, git-ignored: third-party source material on the dev Mac, read-only, never committed, and nothing may depend on it (see README)
├─ docs/
│   ├─ REBUILD_SPEC.md      ← the functional/architecture spec, kept in sync
│   ├─ ENGINEERING.md       ← this document
│   ├─ MILESTONE_PROMPT.md  ← the standing brief every milestone prompt starts from
│   ├─ WINDOWS_VM.md        ← standing up a Windows 11 VM on the dev Mac for gate step 5
│   └─ milestones/           ← one short dated release note per milestone, matching the acceptance criteria below
├─ tests/
└─ .github/workflows/     ← CI: build + test on both Windows and macOS runners
```

## Branching & commits

- `main` is always releasable. Work happens on short-lived branches named `m<N>-<slug>` (e.g. `m2-grades`), one per milestone or a clear sub-slice of one.
- Commit messages state what changed and why in one line; a commit that only makes tests pass again references the milestone it belongs to.
- One pull request per milestone (or per sub-slice, for the larger milestones like M6). No PR merges with failing CI.
- **Merge with a squash, and delete the branch in the same breath.** Every
  milestone so far has been squash-merged, which has one consequence worth
  knowing: **a squashed branch is never an ancestor of `main`**. The squash
  creates a new commit with the same *tree* but unrelated history, so
  `git branch --merged` will not list it, `git merge-base --is-ancestor` says
  no, and the branch looks permanently unmerged in every client. That is not a
  failed merge — it is what squashing means.

  So do not check whether a branch merged by asking git whether it is merged.
  **Compare the trees:**

  ```sh
  git rev-parse <branch-head>^{tree}
  git rev-parse <merge-commit>^{tree}   # identical => the squash lost nothing
  ```

  Then delete the branch locally and on the remote (`git branch -D`,
  `git push origin --delete`, or `gh pr merge --delete-branch` at merge time),
  so nobody has to ask the question again. M4.5's branch survived its merge for
  exactly this reason and was noticed a day later.

## The gate every milestone must pass before it's called done

1. **Typecheck** clean.
2. **Lint** clean.
3. **Automated tests pass** — unit tests for any calculation logic (the grade-weighting formula above all), component/integration tests for the module's screens, and a persistence round-trip test (write data, close, reopen, data is intact).
4. **Packaged build succeeds on both Windows and macOS**, structurally verified (the app actually launches from a double-click, not just "the build command exited 0").
5. **Manual launch test from inside a simulated cloud-sync folder** on both OSes — this is the specific failure mode that killed the previous attempt, so it is a named, non-skippable step every milestone, not just at the end of the project. For the Windows half, see [WINDOWS_VM.md](WINDOWS_VM.md): how to stand up a Windows 11 VM on the development Mac, what an agent can verify in it over SSH, and the two things that still need a human at its screen.
6. **A short dated release note** goes in `docs/milestones/`, recording what shipped, what was decided (if a milestone touched anything the rebuild spec left open), and the result of steps 1-5 — following the previous project's own practice of writing this down per release rather than only trusting green CI.

## Briefing a milestone agent

Every milestone prompt starts from [MILESTONE_PROMPT.md](MILESTONE_PROMPT.md) —
the standing brief: which machine the agent is on and what that machine can
verify, what to read, the language rules, the patterns already settled, and how
the gate is run now that a Windows VM exists. A milestone prompt is that brief
plus the milestone's own scope, acceptance criteria and known traps.

## Milestone sign-off

A milestone is "done" only when its specific acceptance criteria (below) are met **and** the gate above passes. The implementing agent posts the release note and a one-line summary; the product owner reviews before the branch merges to `main`. Agents should surface any spec ambiguity they hit as a question in the PR description rather than silently deciding — the rebuild spec's "Decisions & open questions" table is the model to follow: resolved calls get recorded, not re-litigated by the next agent to touch the code.

# Acceptance criteria per milestone

Each milestone's generic gate (above) still applies; these are what's specific to that milestone's own content.

**This file is the single home for the process and these criteria.**
`REBUILD_SPEC.md` used to carry a second copy of both, and the two drifted:
M4.5 inserted itself into the roadmap and added its criteria to the spec's copy
only, so this file — the one every release note cites for its gate results —
was missing a whole milestone's criteria for two milestones. The spec now points
here instead of repeating it.

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

**M4.5 — Printing attendance, behaviour and support**
- The incident log, the absence register and the support overview each generate a real PDF file in `exports/` that opens and renders Greek correctly (not just Latin).
- Each printed sheet carries the same records the screen shows for the same filter/selection — nothing is recomputed for print, and a sheet never disagrees with the screen it was printed from.
- A support plan's teacher-written status appears on the printed overview exactly as typed, and printing computes nothing from a plan's goals.
- The printed absence register and the printed attendance grid, if both are produced, remain independent of each other — neither derives a figure from the other.

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
