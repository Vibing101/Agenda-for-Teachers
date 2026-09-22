# M4 — Attendance & behaviour

**Date:** 2026-09-21
**Branch:** `m4-attendance-behaviour`
**Signed off by:** Product owner, 2026-09-22 — squash-merged to `main`.
**Note that the three steps under "What still needs a human" were _not_ performed
before the merge:** nobody has double-clicked the build from Explorer, nobody has
typed anything into the packaged app's four new screens, and the Google Drive
online-only placeholder case is still not driven. All three remain outstanding
against this milestone, alongside M2's and M3's own outstanding human passes.

**Open question 1 is answered: yes, the PDFs are wanted — as their own milestone.**
The product owner's call (2026-09-22) is that the incident log, the absence
register and the support overview all get real PDF exports, and that this happens
as **M4.5**, a milestone inserted between M4 and M5 that the roadmap did not
previously have. M4 itself is unchanged by that decision and merges as it stands.
Recorded in the spec's Resolved table.

Worked on **the dev Mac** (`uname -s` = `Darwin`, `VBoxManage list vms` lists
`MilestoneTesting`), with the Windows half of the gate driven over SSH into the
`MilestoneTesting` VM (`COMPUTERNAME` = `MILESTONETESTIN`, Windows 11 Home build
26200). Every result below says which machine produced it and whether an agent
or a human produced it. macOS 26.6.2, Node 24.15.0, Rust 1.98.1.

## What shipped

- **The monthly attendance grid** (`Απουσίες του μήνα`) — the source print
  template's card: the roster down the side with its `Αρ.` column, the days of
  the month across the top, and the source's own four symbols in each cell
  (`·` παρών, `α` απουσία, `κ` καθυστέρηση, `u` δικαιολογημένη), with per-month
  totals per student and ‹ › month navigation.
- **The detailed absence register** (`Απουσίες και καθυστερήσεις`) — the
  source's "μία γραμμή για κάθε απουσία ή καθυστέρηση", with every field the
  spec lists: date, kind, clock time, teaching hour, reason, the independent
  justification flag, the parent-follow-up status and the frequent-absence note.
- **The behaviour/incident log** (`Διαγωγή και περιστατικά`) — dated, with what
  happened, the action taken and the parents-informed flag, **hanging off the
  student so it follows her across every class she is in**, filterable by
  student and by class.
- **Support plans**, 0..n per student, each with start date, monitoring
  frequency, strengths, needs, accommodations, collaboration notes, a
  teacher-written status and a next-review date — plus **goals**, 0..n per plan,
  each with its own progress rating and monitoring date.
- **The cross-class support overview** (`Στήριξη και προσαρμογές`) — one row per
  student, merging **both** of M1's card-level flags with every plan's status
  and next review date. Computed live from the loaded planner, never stored.
- **Schema migration to `user_version = 5`**, added as a forward step. M4 adds
  five tables and alters none, so a file from any previously shipped build
  climbs with every existing record untouched.
- **M3's two carry-over items**: a **"copy as text"** affordance on the master
  timetable producing a column-aligned plain-text grid, and the **removal of
  `timetable.printLater`** and the note that rendered it.

## The two things M4 had to get right, and how they are held

**1. The grid and the register are independent, and nothing derives one from
the other.** This is held *by construction* at four layers and then checked at
each:

- **Schema:** two tables with no shared key beyond `(class, student)`, no
  trigger, no view, no foreign key between them.
- **Storage:** `save_attendance_mark` names `attendance_mark` and nothing else;
  `save_absence_event` names `absence_event` and nothing else.
- **Commands:** separate commands; there is deliberately no call that writes
  both.
- **Selectors:** `monthTotals` counts marks only — a test adds three absence
  events for the same student in the same month and the grid's totals do not
  move.
- **UI:** both panels are on one screen on purpose, so the teacher can see that
  they disagree, with a note saying so. There is no "also mark this in the grid"
  button, and a test asserts the note is present so a later agent does not add
  one.

The fixture carries the criterion directly: **Ελένη is marked `present` on
05.11 in the grid and carries a logged late arrival on 05.11 in the register.**
That pair survives every edit, every deletion and a full quit-and-relaunch
against a real file in a real cloud folder.

**2. A support plan's status is never overwritten by changes to its goals.**
A plan's `status` is a column on `support_plan`; a goal's `progress` is a column
on `support_goal`. They are written by different commands through different
statements, and `store::save_support_goal` names only `support_goal` — so there
is no path from a goal to a status at any layer. Tests drive every way the UI
offers to change a goal (rate it, date it, rename it, add one, delete one, rate
*every* goal as `met`) and assert the status is still the sentence the teacher
typed, plus that `save_support_plan` was never called at all during the session.

**3. The overview reflects a change made in a single class**, because
`supportOverview()` is a pure selector over the loaded planner rather than a
stored roll-up. A test edits a plan's status in the card above and asserts the
table below already says the new thing, with the student's *other* plan
untouched.

## The trap the prompt warned about

The prompt said every "new record" button gets a test that starts from a planner
which already has a record of that kind selected, plus one asserting the sibling
records are byte-for-byte unchanged, and to expect one of them to find something.
**Reporting this plainly: none of them found a data-loss bug, and the tests are
not what made it safe.** What made it safe was choosing the shape first:

- **Three of the four record types avoid M1's shape entirely**, because they are
  edited **in place as lists of rows** rather than through one editor bound to a
  selected record. Each field carries its own row's id, so a "new record" button
  has no selection to move and nothing to point at the wrong row. This is the
  same shape M3's `Προσθήκη ώρας` used, and it is the shape that passed first
  time there too.
- **`Νέο πλάνο στήριξης` genuinely has M1's shape** — a card bound to a selected
  record — and M1's fix was applied from the start rather than discovered: `run`
  hands back the planner it read from disk, the button finds the row the backend
  assigned an id to, and selects it.

The tests were written anyway, from non-empty planners, and they pass. They are
worth having as regression cover — but the honest account is that they confirmed
a decision rather than caught a defect.

**They did catch one smaller thing.** Each register row was given an
`aria-label` on a bare `<li>`, which exposes no accessible group — so a screen
reader would have announced the row's fields with no indication of which entry
they belonged to, and the tests could not address a row either. Fixed by
wrapping each row's fields in a labelled `role="group"`, matching the
precedent M3 set with the timetable's cell editor.

## Decisions taken

| Decision | Call taken | Why |
|---|---|---|
| Where M4's four surfaces live | **Sub-pages inside the sections that already hold their modules; no new top-level tabs.** Βαθμοί gains *Βαθμολόγιο / Απουσίες*, Μαθητές gains *Καρτέλες / Περιστατικά / Στήριξη* | The spec files them under modules 4 and 2 respectively, and the source product reaches each from its module's own index page. Four more top-level tabs would have made twelve and contradicted both. A test pins the top row at eight |
| How the monthly grid is keyed | **`(class_id, student_id, date)`, an actual date.** The month grid is a *view* built from M3's `monthGrid()` | The tempting alternative — `(class, year, month)` with 31 day columns — is the same mistake the spec spent M1 ruling out. A test asserts `attendance_mark` has exactly four columns, so a later agent cannot quietly add a month one |
| A support goal's progress rating | **A fixed vocabulary**: `not_started`, `in_progress`, `partly_met`, `met`, `needs_review`, plus empty for "not rated" | The spec uses both words in one sentence — each goal has a *progress rating*, while the plan's *status* is "written by the teacher, never computed". A rating reads as a scale, a status as a sentence. **This was genuinely open; flagged** |
| What a "card-level support flag" is | **Both of M1's, merged and shown separately**: `Student.sen_status` (per student, from the card's ΕΠΕ box) and `Enrollment.support` with its per-class note | They mean different things — Ελένη's card says "Προσαρμογές" while only Α1 ticks her support box, although she is in two classes. The source overview page's columns are that same merge. A student appears if *any* of three signals fires: a card category, a class's tick, or a plan |
| Whether M4 produces a PDF | **No.** See "Open questions" — this one needs an answer | M4's delivery-scope line names no PDF export, and the precedent is that a milestone ships its scope line exactly (M2 built PDFs because its line said so; M3 did not because its line did not). **No on-screen note was added about it** — that is exactly the mistake M3 made with `timetable.printLater` |
| A blank new record | **Kept, not deleted** — for absence events, incidents, plans and goals | A deliberate departure from the delete-when-empty rule. Those four have a "new record" button: the teacher pressed something to create the row and is about to type into it, so deleting it on save would make it vanish as it appeared. **`attendance_mark` still follows the rule** — an emptied cell is deleted, because an unmarked day genuinely is the absence of a row |
| Whether an incident names a class | **Optionally, `ON DELETE SET NULL`** | The spec's data model lists four fields and no class, but the source register has a `Τάξη` column and "filterable" is only meaningful with one. Deleting a class empties the link and keeps the entry, because something still happened. A Rust test covers exactly that |
| Filtering the incident log by class | Matches the **class's roster**, not the entry's own class link | "Cross-class (follows the student)" cuts both ways: an incident logged in Α1 is still this student's incident when she is looked at from Β2. A test asserts Β2's view shows both of Ελένη's entries — the Α1 one and the one naming no class — alongside Μαρία's |
| `SupportPlan`'s "strengths & needs" | **Two fields** | Splitting loses nothing, merging would, and two boxes is what a teacher fills in. `next_review` is a column too, because the spec's overview line names it although its field list does not |
| The absence register's kinds | **`absence` and `late` only** | Exactly the two tick columns the source register has (`Απ.`, `Καθ.`). Early departure is the obvious third and is *not* invented here. **Flagged** |
| "Δικαιολογημένη" in the grid | **One of four mutually exclusive states**, so it means "an excused absence" | Matches the source card, whose key is four symbols one of which goes in a cell, and the spec, which names four states. The two-dimensional reading (absent + a justified flag) already exists where the spec puts it: `AbsenceEvent.justified`, on the independent register. **Flagged as a deliberate reading** |
| Where the goal-progress counts go | Shown beside the status, **written nowhere** | `goalSummary()` exists for display only. It is the closest the app comes to summarising progress, and it deliberately stops short of the status |

## Open questions for the product owner

**1. Does anything in M4 produce a PDF? — ANSWERED 2026-09-22: yes, but as
M4.5.** The product owner's call is that all three surfaces named below get real
PDF exports, delivered as **their own milestone, M4.5**, rather than being
retrofitted into M4 or folded into M5. M4 ships as reviewed. The question as it
was raised is kept below, because it is the reasoning M4.5 starts from.

M4 ships **none**, per its
delivery-scope line. But this is a real conflict rather than silence: the spec's
module-2 entry says the incident log and the support overview are "both
printable", and its "PDF output" section names "absence logs" and "support
plans" among the surfaces that produce a real PDF file. **So three of M4's four
surfaces are promised a PDF somewhere in the spec and have not got one.** The
2026-09-21 ruling that the *timetable* needs no PDF is explicitly narrow and
does not extend here. **Recommendation: give the incident log, the absence
register and the support overview real PDF exports** — either as their own small
piece of work or folded into M5, which is already building print surfaces. The
app's pagination has been its own since M2, so each is a document definition
rather than new machinery. Nothing misleading is shown in the meantime: the
surfaces simply have no export button.

**2. Is a support goal's progress rating right as a fixed vocabulary?** Shipped
as five codes plus "not rated". The alternative is free text, matching the plan's
status and M1's annual-goal status. One array and five strings change it either
way; nothing stored would need migrating unless ratings had already been typed.

**3. Should the absence register offer more kinds than `absence` and `late`?**
The source has exactly those two columns. Early departure (πρόωρη αποχώρηση) is
a real thing teachers log, but adding it would be the app inventing a category
the source does not have. One entry in `ABSENCE_KINDS` and one string.

**4. Is "δικαιολογημένη" a fourth state or a flag on an absence?** M4 ships four
mutually exclusive states, matching the source card and the spec's wording. The
flag reading would let a *late* arrival be justified too — which it already can
be, on the detailed register, where the spec puts that field.

## Gate results (docs/ENGINEERING.md)

| # | Step | Result |
|---|---|---|
| 1 | Typecheck clean | **Pass, both OSes, by agent** — `npm run typecheck` on the dev Mac and, over SSH, natively in the Windows VM, both at branch head `cdf556e` |
| 2 | Lint clean | **Pass, both OSes, by agent** — `eslint` (including the no-inline-Greek rule), `cargo fmt --all --check` and `cargo clippy --all-targets -D warnings`, all four clean on the dev Mac and in the VM (fmt and clippy confirmed by explicit exit code 0, since PowerShell renders cargo's stderr as an error record) |
| 3 | Automated tests pass | **Pass, both OSes, by agent** — **319 frontend tests** (was 229) and **78 Rust tests** (was 67), green on the dev Mac and in the VM |
| 3b | Persistence round-trip | **Pass** — `src-tauri/tests/cloud_folder.rs` now also carries M4 data: an attendance mark and an absence event **for the same student on the same date, disagreeing**, plus an incident and a support plan with a goal. It writes them, quits, relaunches, asserts every field comes back, then moves the school year's start date and asserts all five M4 collections compare equal |
| 4 | Packaged build on Windows and macOS, structurally verified | **Pass on both, locally, by agent.** **macOS:** `npm run tauri build --target universal-apple-darwin` produced `Teacher Planner.app` (9.0MB) and a `.dmg` (4.3MB); `lipo -archs` reports `x86_64 arm64`. **Windows:** `npm run tauri build` **inside the VM** produced `teacher-planner.exe` (4.38MB) and `Teacher Planner_0.1.0_x64-setup.exe` (1.71MB); `Get-AuthenticodeSignature` → `NotSigned`, as expected. Both were built at branch head `cdf556e` and then launched and driven — see step 5 — rather than only exiting 0 |
| 5 | Manual launch test from inside a cloud-synced folder, both OSes | **Pass on both, by agent, with three parts still needing a human.** Detail below. Launches were programmatic, not human double-clicks |
| 6 | This release note | **Pass** |

### What step 5 covered on macOS (by agent)

The universal `.app` was copied into a folder inside live **Google Drive** and
live **OneDrive** storage and launched through LaunchServices (`open -a`) — the
same path a double-click takes. In **both** folders it:

- started and **stayed** running, created `data/`, `data/backups/` and
  `exports/` beside itself, and wrote `planner.sqlite` at **`user_version = 5`**
  with **all five M4 tables present**;
- **kept its M4 data across a quit verified by PID and a relaunch** — the
  database came back **byte-identical** (SHA-256 unchanged), and in particular
  the contested pair was intact: `attendance_mark` still `present` on
  2026-11-05 and `absence_event` still `late` on 2026-11-05, for the same
  student. The plan's status, the goal's rating and the incident all
  round-tripped;
- wrote a dated snapshot into `data/backups/`, left **no `-wal`/`-shm`
  sidecars**, and `PRAGMA integrity_check` returned `ok`.

### What step 5 covered on Windows, in the VM (by agent)

The exe built in the VM at branch head was copied into a folder inside live
**OneDrive** and live **Google Drive** (`G:\My Drive\…`) and started with
`Start-Process`. In both the process started and stayed running, created `data\`
and `exports\` beside itself, wrote `planner.sqlite` with **no sidecars at rest
at all**, survived a quit and relaunch **byte-identical**, and wrote a dated
snapshot.

**The online-only placeholder case passed on OneDrive.** The exe and the
database were forced offline (`attrib -P +U`) and verified **genuinely
dehydrated** by polling `GetCompressedFileSizeW` until it read 0 — **0 bytes on
disk against 208,896 logical**. Launched from that state the app started, stayed
up, Windows hydrated the files on demand, the database hash was **unchanged**,
and exactly one database existed.

### A mistake of mine, and what it accidentally demonstrated

**The first Google Drive run in the VM failed, and the cause was my test design,
not the app.** The Mac and the VM are signed into the **same** Google Drive
account, and I gave both devices the **same folder name** — so the macOS run and
the Windows run were operating on one synced folder at the same time. That is
precisely the situation the spec says is out of scope ("one device active at a
time, never two at once").

What it produced is worth recording: the VM's run left a stale 0-byte
`planner.sqlite-journal` and a database that read back at **`user_version = 3`**
— an *older schema than either device had written* — with
`PRAGMA integrity_check` still `ok`. The Mac's copy of the same file then showed
the identical bytes. In other words, **Drive resolved the collision by
delivering an old revision, silently, to both devices.** No corruption, but a
clean loss of everything written after that revision.

This is not an M4 regression and it is not evidence against the app; it is
evidence for the spec's concurrency rule, obtained by accident. It is recorded
because a future agent testing two devices on one account will hit it, and
because **it is the closest this project has come to running M9's two-device
test** — and the result says the app needs M9's real two-device procedure
(write, *let sync settle*, then open on device 2), not a simultaneous one.

Both Drive runs were then redone with **a distinct folder per device**, which is
the correct rig.

### What still needs a human

Unchanged in kind from M1, M2 and M3, and stated plainly rather than claimed:

- **A genuine Explorer double-click, and therefore SmartScreen. Not performed.**
  Everything on Windows above was started with `Start-Process`. As established
  at the M1 gate, `Start-Process` and `Shell.InvokeVerb("open")` both launch a
  Mark-of-the-Web-tagged unsigned build cleanly with no dialog; only a real
  double-click is blocked, and scripting cannot reproduce it.
- **Looking at the new screens. Not performed, and it is the one that matters
  most for M4.** Nobody has typed into the packaged app's attendance grid,
  absence register, incident log or support plans. **M4's monthly grid is the
  widest table this app has ever drawn** — a roster against up to 31 day columns
  plus four totals — and a wide grid is exactly where clipping and misalignment
  live. The M1 gate found a silent data-loss bug this way and by nothing else.
- **The Google Drive online-only placeholder case. Not performed**, and known
  since the M3 gate not to be scriptable: `attrib -P +U` drives OneDrive's
  `cldflt` mechanism, which Drive for Desktop's virtual drive does not
  implement. It needs a human using Drive's own right-click → *Available
  offline* / online-only toggle.

**M2's and M3's human passes were both never done either.** Per their release
notes, nobody has typed a grade into the packaged app's gradebook, and nobody
has typed an hour into its timetable, dropped a class into a cell, written a
week's plan or opened the Today view. **Whoever is next at a Windows machine
should do all three milestones' five minutes in one sitting:**

1. **M2** — add a gradebook column, weight it, type marks, watch the average and
   the running-total warning, press both export buttons.
2. **M3** — add an hour to the timetable, drop a class into a cell, add a duty,
   write a week's plan, open Σημερινό μάθημα, and press *Αντιγραφή ως κείμενο*
   and paste it somewhere.
3. **M4** — open Βαθμοί → Απουσίες, mark a few days across a month and check the
   grid is readable at 31 columns; add an absence line and fill every field;
   open Μαθητές → Περιστατικά and add one; open Μαθητές → Στήριξη, add a plan
   and two goals, and confirm the overview at the bottom picks it up.

## Acceptance criteria for this milestone

| Criterion | Result | Evidence |
|---|---|---|
| The monthly attendance grid and the detailed absence-event log can hold different, non-derived data for the same student/date without either overwriting the other | **Pass** | Held **by construction** and checked at five layers. **Schema:** two tables, no trigger, no view, no foreign key between them, no shared key beyond `(class, student)`. **Storage:** `store::tests::the_attendance_grid_and_the_absence_log_hold_different_data_for_one_student_and_date` marks a student `present` on 2026-11-05 and logs a late arrival for her on 2026-11-05, then edits each and deletes each, asserting the other is untouched every time — including that deleting the event leaves the mark and that clearing the mark leaves the event. **Selectors:** `tests/unit/attendance.test.ts` adds three absence events in the month and asserts the grid's totals do not move, and that adding a mark creates no event. **UI:** `tests/component/AttendanceScreen.test.tsx` drives both panels — changing the contested cell writes no `save_absence_event`, editing the event writes no `save_attendance_mark`, and the totals hold across adding and deleting events. **End to end:** `cloud_folder.rs` carries the pair through a quit and relaunch against a real file, and the packaged build carried it through a quit and relaunch in four live cloud folders |
| A support plan's status field is never overwritten by changes to its goals (status stays teacher-written) | **Pass** | Held **by construction**: `status` is on `support_plan`, `progress` is on `support_goal`, and `store::save_support_goal` names only `support_goal`, so no statement can reach both. **Storage:** `store::tests::a_plans_status_is_never_touched_by_writing_its_goals` adds a goal, rates it `met`, adds a second, deletes the first, then deletes the last, asserting the whole plan row compares equal at every step. **Selectors:** `tests/unit/support.test.ts` sets every goal to `met` and then removes them all, and both statuses are still as typed. **UI:** `tests/component/SupportScreen.test.tsx` drives every affordance the screen offers on a goal — rating, adding, deleting — and asserts the status is unchanged *and* that `save_support_plan` was never called at all during the session. The field also carries an on-screen hint saying it is hers to write |
| The cross-class support overview correctly reflects a plan change made in a single class | **Pass** | `supportOverview()` is a pure selector over the loaded planner, so there is nothing to regenerate and nothing that can go stale. **Selector:** `tests/unit/support.test.ts` rewrites a plan's status and next review date and reads the new values straight back, with the student's other plan untouched. **UI:** `tests/component/SupportScreen.test.tsx` edits the status in the plan card and asserts the overview table below — a different component, reading the same planner — already shows it and no longer shows the old one; a sibling test creates a student's *first* plan and asserts she appears in the overview as a result. The merge itself is checked on a fixture where Ελένη is in two classes but flagged for support in only one: the overview shows both classes, the card's category, and only Α1's tick with Α1's own note |

## Known gaps

- **No PDF export from any M4 surface**, per M4's scope line. **This is now
  M4.5's job** (product owner, 2026-09-22): the incident log, the absence
  register and the support overview each get a real PDF. Deliberately **no
  on-screen note** says so in the meantime, because M3's equivalent note turned
  out to be misleading.
- **No progress-check periods.** They are in the spec's Βαθμοί module list but
  were ruled out of M2 and are not in M4's scope line either; still unclaimed.
- **The absence register has two kinds**, matching the source. See "Open
  questions".
- **No reordering of support plans or goals.** `position` exists on both and
  they append in order, so a move-up/down needs no migration.
- **The incident log is not printable yet** although the spec's module-2 entry
  calls it so — same open question as the PDF one above.
- **Windows code signing is still unresolved**, unchanged by M4 and still the
  nearest real-world blocker; macOS builds remain unsigned and un-notarized.
- **The Google Drive online-only placeholder case is still not exercised** and
  needs a human. Unchanged since M3, where it was established not to be
  scriptable.

## A note on CI minutes

The full gate was run locally on the dev Mac **and natively in the Windows VM**
at branch head `cdf556e` before this branch was pushed, so the first CI run was
confirmatory rather than exploratory.

**CI ran green on both runners on the first run** — run
[35645188592](https://github.com/Vibing101/Agenda-for-Teachers/actions/runs/35645188592),
`macos-latest` and `windows-latest` both `success`, with no retries and no
cancelled runs. **One full matrix (~104 billed minutes) covered the code, and
nothing else was spent**: the two docs commits carry `[skip ci]` and produced no
run at all, which was confirmed against the run list rather than assumed.

The three commits after the code commit changed **only `docs/`** — confirmed
with `git diff --stat cdf556e HEAD -- src src-tauri tests`, which is empty — so
the tree CI verified is exactly the one gated locally and in the VM.

**The release note and spec commits carry `[skip ci]`**, because the workflow
has no path filter and a docs-only push otherwise costs a full two-OS matrix
(~104 billed minutes) — the mistake M3 recorded so that it would not be repeated.

**A trap in that advice, found here and worth passing on.** M3's lesson was
"put `[skip ci]` on a docs-only commit", and it is right — but if that commit is
the **branch head when the PR is opened**, GitHub skips the `pull_request` run
too, and the PR sits with **no CI at all**. That is worse than the cost it
saves, because the gate says no merge on failing CI and a PR with no run cannot
show one. The workflow here also declares `workflow_dispatch`, so the fix is one
command rather than an empty commit:

```sh
gh workflow run "CI" --ref m4-attendance-behaviour
```

Which is what produced this milestone's run. **The rule to carry forward:**
`[skip ci]` belongs on a docs-only commit that is *not* the last one before the
PR is opened — or on the squash-merge commit, which is how M3 used it safely.
If it does end up at the head, dispatch the workflow explicitly rather than
pushing an empty commit, which would cost the same matrix run it was avoiding.

**Seconding M3's proposal, not implementing it** (it changes what the gate
proves, so it is the product owner's call): run typecheck, lint and the frontend
tests once on `ubuntu-latest` at ×1, and reserve `macos-latest` and
`windows-latest` for the Rust build, the Rust tests and packaging. That would
cut roughly 40–50 billed minutes a run. A `paths-ignore` for `docs/**` would fix
the docs-only problem properly and is a smaller change; both are left alone here.
