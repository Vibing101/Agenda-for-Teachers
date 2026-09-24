# M3 — Weekly planning & timetable

> **Archived evidence (added 2026-09-24).** This repository's history was
> rewritten on 2026-09-24 to remove the third-party source package before it was
> made public. The pull requests, CI runs and commit hashes this note cites
> belong to the pre-rewrite repository, kept private as
> `Vibing101/Agenda-for-Teachers-archive`: links to them will not resolve here,
> and the hashes differ from this repository's. The note is otherwise left as
> it was written.

**Date:** 2026-09-21
**Branch:** `m3-weekly-planning-timetable`
**Signed off by:** Product owner, 2026-09-21 — squash-merged to `main` as
`333b7cc` and the branch deleted. **Note that the three steps under "What still
needs a human" were _not_ performed before the merge:** nobody has double-clicked
the build from Explorer, nobody has typed anything into the packaged app's four
new screens, and the Google Drive online-only placeholder case is still not
driven. All three remain outstanding against this milestone, alongside M2's own
outstanding human pass.

The merge deliberately carried `[skip ci]`: the only change between the green CI
run ([35575180371](https://github.com/Vibing101/Agenda-for-Teachers/actions/runs/35575180371),
both runners) and the merge commit was this release note's markdown, so `main`'s
code tree is exactly what CI verified. Confirmed after merging — `main`'s tree
hash `0f5c8449540fbccce0ae6499f90e1df742bca7cb` is identical to the branch tip's,
so nothing was lost in the squash — and **the full gate was then re-run locally on
`main`**: typecheck, eslint, 229 frontend tests, `cargo fmt --check`,
`clippy -D warnings` and 67 Rust tests, all clean.

The branch's six commits, collapsed by the squash, were:

| Commit | Subject |
|---|---|
| `6bfa7b6` | Make the master timetable the single register of the teacher's week, and key lesson plans and agenda notes by actual date |
| `4242ad8` | Commit an hour's clock times on blur rather than on every partial value typed |
| `0827422` | Add M3's dated release note, recording every gate step including the ones an agent cannot perform |
| `286ce4f` | Note that a sync client's eviction is asynchronous, so the placeholder check polls for it |
| `792ad1a` | Record the green first-push CI run, confirming the billing problem is resolved |
| `3b678ef` | Record the avoidable second CI run, and how to avoid it next time |

Worked on **the dev Mac** (`uname -s` = `Darwin`, `VBoxManage list vms` lists
`MilestoneTesting`), with the Windows half of the gate driven over SSH into the
`MilestoneTesting` VM (`COMPUTERNAME` = `MILESTONETESTIN`, Windows 11 Home build
26200). Every result below says which machine produced it and whether an agent or
a human produced it. macOS 26.6.2, Node 24.15.0 (24.19.0 in the VM), Rust 1.98.1
on both.

## What shipped

- **The teacher's master timetable.** Named hours with clock times down the side,
  Δευτέρα–Σάββατο across the top — the source page's `Ώρα` grid — and in each
  cell an optional link to a class, a room override, a cover/duty field and
  notes. This is now the single register of the teacher's week; see "The one
  design decision" below.
- **Weekly lesson plans per class**, keyed by the Monday of the week as an actual
  date, with weekly notes and one optional assessment.
- **Agenda notes at three scopes** — day, week and month — each keyed by an
  actual date, with ‹ › adjacent-period navigation and a "jump to today". The week
  view is the source's Δευτέρα–Κυριακή strip plus its "ΣΗΜΕΙΩΣΕΙΣ ΤΗΣ ΕΒΔΟΜΑΔΑΣ"
  box; the month view is its Δευτέρα–Κυριακή grid plus "ΕΣΤΙΑΣΗ ΤΟΥ ΜΗΝΑ" and the
  "01 / 12" counter.
- **The Today view** (Σημερινό μάθημα): today's date and derived week number,
  today's hours from the master timetable, today's agenda note with the week's
  beside it, and one link per class met today into that class's weekly plan. It
  takes no `run` at all, because per the spec it is "a convenience aggregation
  view, not a data-entry surface" — a test asserts it reaches storage never.
- **A class's hours are now derived and read-only on the class card**, pointing at
  the Πρόγραμμα screen, so the same lesson is never typed twice.
- **Schema migration to `user_version = 4`**, added as a forward step, which
  folds every M1 `class_slot` row onto the master timetable and drops the table.
- **"Today" enters the app in exactly one place** — the shell — and is passed down
  as a prop. No component calls `new Date()`.

## The one design decision this milestone turned on

**M1 already shipped a per-class timetable (`class_slot`); M3 needed the
teacher's master timetable. The two cover the same ground from opposite
directions.** The call taken: **the master timetable is the single register, and a
class's hours are derived from it.** `migrate_to_4` folds the old rows in and
drops `class_slot`.

Three things forced the direction rather than the reverse:

1. **A cover or duty belongs to no class at all**, so it cannot live in a
   per-class table. The spec asks for "covers/duties per cell" explicitly.
2. **The spec describes the link to a class as _optional_, and as something that
   "fills subject/room"** — i.e. the cell is the record and the class is a
   pointer, not the other way round.
3. **The spec has the Today view read "from the master timetable."** One register
   is the only way it cannot list the same class twice.

The two constraints the prompt set are met by construction, not by care:

- **A lesson is typed once.** The teacher names her hours once, then picks a class
  per cell; the subject and room are a *lookup* through `resolveHour`, not a copy,
  so renaming a class or moving its room updates every hour it is taught in with
  nothing to regenerate. A test asserts exactly that.
- **The Today view cannot list a class twice**, because there is one register to
  read. Where a class genuinely is taught twice in a day it shows as two *hours* —
  she really is in that room twice — while the links into the week's plans
  de-duplicate to one per class, because there is one plan per class per week.
  Both halves are tested.

**What this costs, stated plainly:** it removes a surface M1 shipped and the
product owner signed off. `Class.slots` is gone from the wire format, the class
card's slot editor is gone, and one M1 test
(`saving_a_class_replaces_its_timetable_slots_rather_than_appending`) is replaced
by its equivalent at the register that now owns the data. **If the product owner
would rather the class card kept its own editor, say so** — but then the
reconciliation question comes back, and the honest answer would be a one-way
derivation in the other direction, which cannot hold a duty.

**No data is lost climbing to the new schema.** `migrate_to_4` turns each slot's
`(period_label, start_time, end_time)` into an hour and the slot itself into that
hour's cell on its weekday, creating hours in clock order. The case that needed
care is a **collision** — M1 allowed two classes at the same label, times and
weekday, which one cell cannot hold. Rather than drop one, the second gets its own
hour row with the same name and times, so it is still on the grid and visible as a
duplicate the teacher can tidy up. Two tests cover this, one per case.

## Decisions taken

| Decision | Call taken | Why |
|---|---|---|
| Master timetable vs. M1's `class_slot` | **One register: the master timetable.** `class_slot` is folded into it and dropped; a class's hours are derived | See above. Forced by covers/duties having no class, by the spec making the class link optional and "fills subject/room", and by the Today view reading one register. **Flagged for the product owner — it retires a surface M1 shipped.** |
| A colliding `class_slot` pair at migration | Gets a second hour row with the same name and times | Silent data loss in a migration is the one thing this project will not do. A visible duplicate the teacher can merge beats a dropped lesson. |
| `timetable_cell.class_id` on class delete | `ON DELETE SET NULL` — the hour stays, the link empties | The hour is still in the teacher's week after a class is gone, and the cell's own duty, room and notes are hers. Deleting the *hour* is the other statement, and that cascades. |
| Where a cell's subject and room come from | A **lookup** at display time, with the cell's own values as overrides | The spec's "fills subject/room". A copy would go stale the moment a class moved room, and M7's substitute folder is required to read live data. An empty override means "take it from the class". |
| An emptied cell, plan or note | **Deleted, not stored blank** | Same rule as M2's cleared grade cell: "free hour" and "nothing written this week" are the absence of a row at every layer, which is what M6's progress matrix will read as "nothing entered". |
| Lesson plan key | `(class_id, week_monday)` with no generated id | The spec's "linked to the week via an actual date (the Monday of that week), not a week-index". It also removes the create-then-edit shape entirely — see "The trap" below. |
| Agenda note key | `(scope, date)`, normalised per scope by `agendaKey` | A week note goes on its Monday and a month note on the 1st, whichever day was on screen. Without one normalising function a teacher would end up with seven notes for one week, each invisible from the others. |
| Sunday | In the agenda's week and month grids, not in the timetable | The source's timetable page is Δευτέρα–Σάββατο; its week and month pages are Δευτέρα–Κυριακή. The Today view says so plainly on a Sunday rather than showing an empty list. |
| Where "today" is read | Once, in the shell, passed down as a prop | Makes the second acceptance criterion testable at all. `App` takes an optional `today` override for tests; the shell also re-checks every minute so a session left open overnight rolls over. |
| Reordering hours | Not built. `position` exists and hours append in order | Hours are added top-down (1η, 2η, …) so insertion order is the clock order in practice. The column is there for a later move-up/down without a migration. |
| PDF export of the timetable | **Not built** — see "Open questions" | The spec calls the timetable "printable", but PDF export is not in M3's scope line. Same call M2 made on progress-check periods. The screen says so on screen rather than leaving a dead button. |

## Open questions for the product owner

**1. Is retiring the class card's slot editor the right call? — ANSWERED
2026-09-21: yes.** The product owner confirmed the retirement. The master
timetable is the single register, a class's hours are derived from it, and the
class card shows them read-only. Recorded in the spec's Resolved table.

**2. Should the master timetable print to PDF? — ANSWERED 2026-09-21: no, and
not later either.** The product owner's call is that **the timetable needs no PDF
export at all** — plain text in the app, to copy and paste, is enough. Recorded in
the spec's Resolved table as a **narrow exception for the timetable only**: grade
sheets, conduct sheets, letters, the message bank, the print forms and the
substitute folder all still produce real PDF files as the spec's "PDF output"
section requires.

Two small pieces of work follow and are **not built here**, because M3 was already
merged when the decision was taken:

- a **"copy as text"** affordance on the timetable, producing a plain-text grid
  the teacher can paste into an email or a document;
- **removing the on-screen note** `timetable.printLater`, which currently says PDF
  export "has not been implemented yet at this stage" and is now misleading, since
  it is not coming.

Both are named in the M4 prompt as a carry-over so they land with a milestone's
own CI run rather than costing one of their own.

**3. Should the source page's two page-level boxes exist as well as the per-cell
ones?** The source's timetable page has one "ΑΝΑΠΛΗΡΩΣΕΙΣ ΚΑΙ ΑΛΛΑ ΚΑΘΗΚΟΝΤΑ" box
and one "ΠΑΡΑΤΗΡΗΣΕΙΣ" box for the whole week. The spec instead asks for
"covers/duties per cell, ... notes", which is what M3 ships, and per-cell is
strictly more expressive. Recording it because it is a deliberate departure from
the page rather than an oversight.

**4. Should the Today view show the day's holidays and important dates?** M1's
year module keys both by date and shows them "in every month/period they
overlap". The Today view would be an obvious place for them, but the spec's list
for it is exactly four things and none of them is this, so M3 ships the four.

## Gate results (docs/ENGINEERING.md)

| # | Step | Result |
|---|---|---|
| 1 | Typecheck clean | **Pass, both OSes, by agent** — `npm run typecheck` on the dev Mac and, over SSH, natively in the Windows VM, both at branch head `4242ad8` |
| 2 | Lint clean | **Pass, both OSes, by agent** — `eslint` (including the no-inline-Greek rule), `cargo fmt --all --check` and `cargo clippy --all-targets -D warnings`, all four clean on the dev Mac and in the VM |
| 3 | Automated tests pass | **Pass, both OSes, by agent** — **229 frontend tests** (was 134) and **67 Rust tests** (was 53), green on the dev Mac and in the VM |
| 3b | Persistence round-trip | **Pass** — `src-tauri/tests/cloud_folder.rs` now also carries M3 data: the master timetable including a duty cell with no class, a lesson plan against a November Monday, and all three scopes of agenda note. It writes them, quits, relaunches, asserts every field comes back, then moves the school year's start date and asserts the plans, notes and timetable are unchanged |
| 4 | Packaged build on Windows and macOS, structurally verified | **Pass on both, locally, by agent.** **macOS:** `npm run tauri build --target universal-apple-darwin` on the dev Mac produced `Teacher Planner.app` (8.9MB) and a `.dmg`; `lipo -archs` reports `x86_64 arm64`. **Windows:** `npm run tauri build` **inside the VM** produced `teacher-planner.exe` (4.30MB) and `Teacher Planner_0.1.0_x64-setup.exe` (1.69MB); `Get-AuthenticodeSignature` → `NotSigned`, as expected. Both were rebuilt at branch head `4242ad8` after the last code change and re-verified there, so the evidence below describes the code being reviewed. Both were then launched and driven — see step 5 — rather than only exiting 0 |
| 5 | Manual launch test from inside a cloud-synced folder, both OSes | **Pass on both, by agent, with two parts still needing a human.** Detail below. **macOS:** the universal `.app` ran from a live **Google Drive** folder and a live **OneDrive** folder. **Windows:** the packaged exe ran in the VM from a live **OneDrive** folder and a live **Google Drive** folder (`G:\My Drive\…`), including the **online-only placeholder case on OneDrive**. Launches were programmatic, not human double-clicks — see "What still needs a human" |
| 6 | This release note | **Pass** |

### What step 5 covered on macOS (by agent)

The universal `.app` was copied into `My Drive/Ατζέντα Εκπαιδευτικού M3` and the
equivalent folder under `OneDrive-Personal`, and launched through LaunchServices
(`open -a`) — the same path a double-click takes. In **both** folders it:

- started and **stayed** running, with `lsappinfo` confirming it resolved its
  bundle path inside the synced folder;
- created `data/`, `data/backups/` and `exports/` beside itself and wrote
  `planner.sqlite` at **`user_version = 4`**, with all four M3 tables present and
  `class_slot` gone from `sqlite_master`;
- **kept its M3 data across a provably clean quit and relaunch.** In the Drive
  folder: the hour `2η 09:20–10:05`, a Monday cell linked to Α1, a Friday duty
  cell with **no class** (`Εφημερία στο προαύλιο`), the plan for `2026-11-02`
  (`Κεφάλαιο 4: εξισώσεις πρώτου βαθμού` / `Ολιγόλεπτο διαγώνισμα την Πέμπτη`) and
  all three agenda notes all read back **byte-identical** (SHA-256 unchanged)
  after the process was confirmed gone and the app relaunched. The OneDrive folder
  carried its own equivalent set with the same result;
- wrote a dated snapshot into `data/backups/` on the relaunch
  (`planner-2026-09-21-0656.sqlite` in Drive, `…-0659` in OneDrive), and left
  **no `-wal`/`-shm` sidecars**.

**One correction to how this was reached, since it affects how much the result is
worth:** the first two attempts at this reported a clean quit that had not
happened — a `grep` pattern containing Greek did not match under this shell, so
the process list came back empty and the "relaunch" merely activated a still-running
app. Both runs were redone with ASCII-only process matching and the quit verified
by PID before seeding. The figures above are from the redone runs.

### What step 5 covered on Windows, in the VM (by agent)

The packaged exe built in the VM at branch head was copied into
`C:\Users\vboxtester\OneDrive\Ατζέντα Εκπαιδευτικού M3` and
`G:\My Drive\Ατζέντα Εκπαιδευτικού M3` and started with `Start-Process`. In both:

- the process **started and stayed running**, created `data\` and `exports\`
  beside itself, and wrote `planner.sqlite` — polled until the migration had
  **settled**, then 159,744 bytes at **`user_version = 4`** with **no sidecars at
  rest at all**, and in particular **no `-wal`/`-shm`**;
- **quit and relaunch left the database byte-identical** in both folders, still at
  `user_version = 4`, with a dated snapshot written
  (`planner-2026-09-21-1049.sqlite` in OneDrive, `…-1050` in Drive) and no
  `-wal`/`-shm` afterwards;
- both databases were copied back to the Mac and inspected with `sqlite3`:
  **`user_version = 4`**, all four M3 tables present, **`class_slot` absent from
  `sqlite_master`**, `PRAGMA integrity_check` → `ok`.

**Two measurement mistakes of mine, corrected, because they change what the
numbers are worth.** First, an early check for "`class_slot` is gone" scanned the
file's raw bytes for the table name and reported it as still present — SQLite
leaves a dropped table's text in freed pages. It was replaced by the
`sqlite_master` query above, which is authoritative. Second, one Drive read came
back at 32,768 bytes, `user_version = 1`, with the file locked and a
`planner.sqlite-journal` beside it. **That was the host's power management pausing
the VM mid-migration** (`VBoxManage` reported `VMState="paused"`, "paused due to
host power management"), and a rollback journal is precisely what `DELETE` journal
mode writes *during* a transaction and removes at commit — so it was a read taken
mid-write, not a torn file. The criterion is about `-wal` and `-shm`, and neither
has appeared at any point. The settled figures above were taken after the VM
resumed, with polling that waits for the migration to finish.

**The online-only placeholder case — passed on OneDrive, still not driven on
Drive.** In the OneDrive folder the exe and the database were forced offline
(`attrib -P +U`) and verified **genuinely dehydrated**, not merely flagged.
**Eviction is asynchronous**, which is worth knowing before repeating this: a
first attempt read the attributes eight seconds after `attrib` and found the files
merely `UNPINNED` with their bytes still on disk, so the check now polls until the
sync client has actually evicted them. Once dehydrated:
`GetCompressedFileSizeW` reported **0 bytes on disk** against logical sizes of
4,512,256 and 159,744, with attributes `ARCHIVE | SPARSE_FILE | REPARSE_POINT |
OFFLINE | UNPINNED | RECALL_ON_DATA_ACCESS`. Launched from that state the app
**started within 2s, stayed open** (polled to T+20s), Windows **hydrated** the exe
on demand, the database hash was **unchanged**, exactly one `planner.sqlite`
existed and no sidecars appeared.

**Against Google Drive the same attempt did not dehydrate the files at all** —
after `attrib -P +U` both still reported full size on disk and attributes
`Normal`. `attrib +U` drives OneDrive's `cldflt` placeholder mechanism, which
Drive for Desktop's virtual drive does not implement; its online-only toggle is a
shell-extension menu item with no scriptable equivalent found. **So the Drive
placeholder case is still not exercised, and the carried risk stays open.** That
is a more specific finding than M2's ("was not driven") and worth keeping: an
agent cannot close this one by scripting, so it needs a human at the VM using
Drive's own right-click → *Available offline* / online-only toggle.

## Acceptance criteria for this milestone

| Criterion | Result | Evidence |
|---|---|---|
| A lesson plan entered against a specific date survives a school-year start-date change (it's keyed by date, not week-index) | **Pass** | Held **by construction** and then checked at four layers, as M1 did for its equivalent. **Schema:** no table has a week column; `lesson_plan` is keyed `(class_id, week_monday)` and `agenda_note` `(scope, date)`, both actual dates, and the start date remains one field on one row with nothing to cascade into. **Storage:** `store::tests::moving_the_school_year_start_date_leaves_every_plan_and_note_where_it_was` seeds a plan and all three note scopes, moves the start date a week earlier *and* switches the year model, then asserts `lesson_plans`, `agenda_notes`, `timetable_periods` and `timetable_cells` all compare equal. **Derivation:** `tests/unit/plans.test.ts` shows the week of 02.11.2026 moving from week 8 to week 9 while the stored row is untouched, and a second test covers the harder half — a start date moved *past* a plan leaves it readable, flagged as outside the year rather than hidden. **UI:** `PlanScreen.test.tsx` types a plan under "Εβδομάδα αρ. 8", moves the start date, re-renders and finds the same text under "Εβδομάδα αρ. 9" with the stored rows byte-equal. **End to end:** `cloud_folder.rs` repeats it against a real folder on disk, and the packaged macOS build carried a November plan through a quit and relaunch in both cloud folders |
| The Today view correctly shows only today's scheduled classes on a spot-checked date | **Pass** | Testable because `today` is an argument: the shell reads the calendar once and passes the day down, and `App` takes an override. `tests/component/TodayScreen.test.tsx` pins **Wednesday 16.09.2026** against a fixture that teaches Α1 on Monday and Wednesday, Β2 twice on Wednesday, and holds a Friday duty: the view shows exactly the three Wednesday hours in day order (1η Β2, 2η Α1, 3η Β2) and Friday's duty does not leak in. Sibling tests spot-check **Monday 14.09** (Α1 only, no Β2), **Friday 18.09** (the duty, no class) and **Sunday 20.09** (says the grid has no Sunday rather than showing an empty list). `tests/unit/timetable.test.ts` checks the same dates at the selector. Β2, taught twice that Wednesday, appears as **two hours but one plan link** — the "must not list the same class twice" half. A further test asserts the view writes nothing at all, since the spec makes it an aggregation view |

## The trap the prompt warned about

The prompt asked for every "new record" button to be tested from a planner that
already holds a record of that kind, and said to expect that test to be the one
that finds something. Two things to report:

- **Lesson plans and agenda notes have no "new record" button at all, and that is
  by design rather than by omission.** `(class, Monday)` and `(scope, date)` are
  the whole keys, the screen knows both halves before it writes, and nothing hands
  back a generated id — so there is no selection to move and no room for the M1
  defect. A test asserts the button's absence so a later agent does not
  reintroduce the shape by adding one.
- **The one genuine create button M3 adds is `Προσθήκη ώρας`**, and it is tested
  from a planner that already has three hours **with lessons placed in them**:
  the test asserts the three existing hours come back byte-for-byte, the new one
  is blank, and every cell is still on the hour it was on. **It passed first
  time** — the shape differs from M1's, because the hours are edited in place
  rather than through a single editor bound to a selected record, so there is no
  shared draft to point at the wrong row. Two sibling tests cover the adjacent
  risk directly: editing the second hour's name writes to the second hour only,
  and renaming an hour leaves its cells untouched.

So this one did not find a bug. **It did find a smaller thing worth having:** the
hours' clock times were writing on every intermediate value a `type="time"` input
emits, contradicting the commit-on-blur rule stated in the screen's own doc
comment. Fixed in `4242ad8`, with a test that asserts nothing is written until the
field loses focus and then exactly once.

## What still needs a human

Unchanged in kind from M1 and M2, and stated plainly rather than claimed:

- **A genuine Explorer double-click, and therefore SmartScreen. Not performed.**
  Everything on Windows above was started with `Start-Process`. As established at
  the M1 gate, `Start-Process` and `Shell.InvokeVerb("open")` both launch a
  Mark-of-the-Web-tagged unsigned build cleanly with no dialog; only a real
  double-click is blocked, and scripting cannot reproduce it. It needs someone at
  the VM (or at the physical Windows PC) to double-click the installer and the exe
  from a synced folder.
- **Looking at the new screens. Not performed, and this is the one that matters
  most for M3.** Nobody has typed an hour into the packaged app's timetable, put a
  class in a cell, written a plan or opened the Today view and *looked* at it. M3
  adds four screens, two of which are grids — the timetable and the month
  calendar — and grids are exactly where clipping and misalignment live. The M1
  gate found a silent data-loss bug this way and by nothing else.
- **The Google Drive online-only placeholder case. Not performed**, and now known
  not to be scriptable — see the Windows section above. It needs a human using
  Drive's own right-click toggle.

**M2's human pass was never done either.** Per its release note, nobody has typed
a grade into the packaged app's gradebook and looked at it, and nobody
double-clicked its build from Explorer. **Whoever is next at a Windows machine
should do both milestones' five minutes in one sitting:** add a gradebook column,
weight it, type marks, watch the average and the warning, press both export
buttons — and then add an hour to the timetable, drop a class into a cell, add a
duty, write a week's plan, and open Σημερινό μάθημα.

## A note on CI minutes

The account has ~1000 Actions minutes left this month and the current two-OS
matrix costs about 104 billed minutes a run. **The full gate was run locally and
in the Windows VM at branch head `4242ad8` before this branch was pushed**, so the
first CI run should be confirmatory rather than exploratory, and fixes are batched.

**CI ran green on the first push, on both runners** — run
[35575180371](https://github.com/Vibing101/Agenda-for-Teachers/actions/runs/35575180371):
`macos-latest` 9m02s, `windows-latest` 11m05s, no retries and no cancelled runs,
so one full matrix (~104 billed minutes) covered the code. **One avoidable extra
cost, recorded rather than glossed:** a follow-up commit that touched only this
release note triggered a second matrix, because the workflow has no path filter.
It was cancelled 19s in, so it billed a few minutes rather than another ~104. Two
things follow for the next agent — **a docs-only push costs a full matrix run**,
and `[skip ci]` in the commit message is the way to avoid it. Adding a `paths-ignore`
for `docs/**` would fix it properly, but that edits the workflow, which is the
product owner's call. It also confirms the
billing problem that made CI on `main` go red immediately after the M2 merge is
resolved: those runs died in 8–9s without starting a job, these started and
finished normally.

**A proposal, not a change** (per the prompt, this is the product owner's call
because it changes what the gate proves): run typecheck, lint and the frontend
tests once on `ubuntu-latest` at ×1, and reserve `macos-latest` and
`windows-latest` for the Rust build, the Rust tests and packaging. That would cut
roughly 40–50 billed minutes a run. What it gives up: today the frontend gate runs
on both target platforms, which is how the M1 gate caught a Windows-only
difference in how native date inputs render. The Rust and packaging half — where
the platform actually matters — would be unchanged.

## Known gaps

- **No PDF export of the timetable**, per M3's scope line. See "Open questions".
- **No reordering of hours.** They append in the order added, which is the clock
  order in practice; `position` exists so a move-up/down needs no migration.
- **The week-by-class progress matrix is M6's**, and it reads what M3 writes: one
  `lesson_plan` row per `(class_id, week_monday)`, with an absent row meaning
  "nothing entered". `plansForWeek` is already in `domain/plans.ts` for it.
- **The Today view shows the four things the spec lists for it** and not the day's
  holidays or important dates. See "Open questions".
- **Nothing else from module 1 ships here.** The staff directory and the
  substitution/leave log are M8's per its scope line.
- **Windows code signing is still unresolved**, unchanged by M3 and still the
  nearest real-world blocker; macOS builds remain unsigned and un-notarized.
