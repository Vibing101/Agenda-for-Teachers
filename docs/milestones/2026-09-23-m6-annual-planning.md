# M6 — Annual planning & the rest of teaching

> **Archived evidence (added 2026-09-24).** This repository's history was
> rewritten on 2026-09-24 to remove local-only material before it was made
> public. The pull requests, CI runs and commit hashes this note cites
> belong to the pre-rewrite repository, kept private as
> `Vibing101/Agenda-for-Teachers-archive`: links to them will not resolve here,
> and the hashes differ from this repository's. The note is otherwise left as
> it was written, except that references to material outside the project were
> removed on 2026-09-26.

**Date:** 2026-09-23
**Branch:** `m6-annual-planning`
**Signed off by:** <product owner, once reviewed>

**Two items under "What still needs a human" were _not_ performed**, and they
are **inherited from M5 rather than created here**: **nobody has looked at a
printed letter**, and **the Windows typing pass is still undone** — the last one
was on macOS at M4.5. The product owner signed M5 off with both open and they
carry into M6 unchanged. M6 adds a third, its own: **nobody has typed anything
into its six new screens**, and two of them are grids.

Worked on **the dev Mac** (`uname -s` = `Darwin`, `VBoxManage list vms` lists
`MilestoneTesting`), with the Windows half of the gate driven over SSH into the
`MilestoneTesting` VM (`COMPUTERNAME` = `MILESTONETESTIN`, Windows 11 Home).
Every result below says which machine produced it and whether an agent or a
human produced it. macOS 26.6.2 on x86_64, Node 24.15.0; Rust 1.98.1 on both.

**One thing to be exact about, because it changes what the evidence is worth.**
The first pass of gate steps 1–4 ran at `8a8e246`. A cosmetic change then landed
— `650b33c`, which removes a redundant visually-hidden span from the matrix's
cell — so **both the Windows gate and both packaged builds were re-run at
`650b33c`**, the branch head, and every figure below is from that second pass.
The evidence describes the code being reviewed, which is the standard M3 set
after making the same correction.

## What shipped

**The spec's eight module-3 surfaces, as six new sub-pages inside `Πλάνο`.**
`Πλάνο` had no sub-pages at all before — M3 built only the weekly plan — so the
row is new and M3's screen becomes its first tab, making **seven** in all. The
top row stays at **nine**.

Eight surfaces become six new pages because two pairs collapse: the annual plan
and the units are one record, and the two reference lists are the two surfaces
that hang off no class and no week.

- **Ετήσιο πλάνο** — an *Ετήσια επισκόπηση ανά μάθημα και τμήμα* over
  the *Ενότητες* cards that fill it. **One register, two views**: the overview
  table is built from the same `unit` rows the cards edit, so a unit's title and
  its hours are typed once. The header's `ΜΑΘΗΜΑ`, `ΤΑΞΗ` and `ΩΡΕΣ/ΕΒΔ.` are
  looked up — the last from the master timetable.
- **Πρόοδος τμημάτων** — the week-by-class matrix, **a view over M3's
  `lesson_plan` with no table and no input of its own**. See below; this is the
  milestone.
- **Εξετάσεις** — a register, with an upcoming panel that is a pure
  function of the day the shell read.
- **Αναστοχασμός** — dated free-text entries per class.
- **Εκδρομές** — the register's seven columns, a per-trip checklist and
  evaluation, and **per-student consent tracking whose `Συγκαταθέσεις` cell is
  counted, never typed**.
- **Βιβλία & υλικά** — the two reference lists: textbooks with seven
  columns and a `ΠΑΡΑΤΗΡΗΣΕΙΣ` box stored per line, and resources across six
  categories.

**`Εβδομάδα` is M3's weekly plan screen, unmoved and unchanged** — it is the
first tab of the new row rather than anything M6 built, and the matrix is a
second view of exactly what it writes.

**The row's order** — annual plan, units, the
matrix, exams, reflections, trips, books, materials — with the weekly plan
pulled to the front because it is the one the teacher opens daily and because it
was already there.

**Schema climbs to `user_version = 7`** — seven tables, purely additive.
**None of them carries a week**, and a Rust test walks every column of every
table in the file to say so.

## The one thing M6 had to get right

**M6's first acceptance criterion is that the matrix "correctly reflects entries
made from the per-class weekly plan (M3) **without duplicate data entry**", and
the obvious implementation breaks it.** A table with a cell per `(week, class)`
would give the teacher two places to write what she did that week.

**So there is no such table.** `domain/progress.ts` builds the grid from
whichever weeks are asked for, and each cell is a button that opens that week's
plan on the screen where it *is* written.

**`ProgressScreen` does not import `api` or `Run`.** It is not that it declines
to write — it has no way to. That is the strongest form the claim can take, and
it is the same shape as M3's Today view, which the spec calls "a convenience
aggregation view, not a data-entry surface".

The matrix is **the weekly plan in one table** — a grid of `Εβδομάδα | Τμήμα 1 …
Τμήμα 6` — and nothing else.

It is the fourth time this project has made that call — M3's timetable, M4's
attendance grid, M5's appointment week.

**Tested as the criterion is worded.** `tests/component/ProgressScreen.test.tsx`
mounts the **real M3 screen** against a shared fake backend, types a plan into
it, saves it through `save_lesson_plan`, re-renders the **real matrix** from the
planner that came back, finds the text there, and then asserts three things: the
matrix contains no `textbox`, `combobox` or `checkbox`; rendering it made no
further backend call at all; and clicking six of its cells writes nothing.

## Confirming the tests fail against broken code

Budgeted for, and done — the step that at M5 caught a genuinely weak test for
the first time. **Eight deliberate mutations, every one caught**, and each by
the test that should catch it:

| Mutation | Caught by |
|---|---|
| A cell also requires a unit to have been entered — *literally the duplicate data entry the criterion forbids* | `is a function of the lesson plans alone` |
| The matrix grows a status box of its own, and a plan needs it filled before it shows | **the criterion test itself** — `no second field to fill` |
| A cell stops carrying the plan's own notes | 3 tests, including the criterion test |
| The week is pinned to a fixed start date, ignoring corrections | `re-labels the weeks when the start date moves` |
| A class's first plan shows on every week's row | 3 tests |
| The summary truncates the teacher's own words | 3 tests |
| The assessment marker fires for any written week | `marks the week that carries an assessment` |
| A class with no plan is dropped from the grid | `keeps a class with no plan as a column of blanks` |

The second row is the one that mattered: it is the defect the criterion names,
introduced on purpose, and the criterion's own test failed on it.

## Decisions taken

All recorded in the spec's Resolved table.

| Decision | Call taken | Why |
|---|---|---|
| **Whether the progress matrix is a stored table** | **No — a view over `lesson_plan`** | The criterion forbids a second place to type a week's work: the matrix is "the weekly plan in one table". Fourth time this project has derived a grid rather than stored one |
| **The matrix's `Εβδομάδα` rows** | **Derived from the school year's start date at display time** | M1's rule, and the surface most at risk of breaking it, since `Εβδομάδα` is its own axis. A Rust test scans every column of every table for a week index |
| **Annual plan vs. units** | **One record, `unit`.** The annual plan is a view of a class's units | Every column of *Ετήσιο πλάνο* is a field of the *Ενότητες* card. Two tables would make the teacher type a title and its hours twice — the same defect, one surface along. `ΒΑΘΜΟΙ` and `Αξιολόγηση` are **one** field; `ΔΙΔΑΚΤΙΚΟΙ ΣΤΟΧΟΙ` and `Δεξιότητες / Κριτήρια` are **two**, because they are headed differently and merging would lose a distinction the teacher made — M4's call on strengths and needs |
| **Where the eight surfaces live** | **Seven sub-pages in `Πλάνο`, no new tab.** The row stays at nine | M4's shape. The spec files all eight under module 3 and the app already had that section; it simply had no sub-pages. Eight become seven because two pairs collapse — the annual plan with its units, and the two reference lists |
| **A trip's `Συγκαταθέσεις`** | **Counted from per-student consent rows, never typed** | A number she typed could disagree with the list she ticked. The roster is read from `enrollment`, so a student added to the class appears with nothing recorded |
| **A consent's states** | **`given` and `refused`; no row means "not recorded yet"** | M4's rule for an unmarked attendance cell. A cleared state with a note still on it keeps the row and counts as pending, so a dropdown never throws away something she wrote |
| **Exam kind, textbook `Κατάσταση` and `Τιμή`** | **Free text, all three** | Nothing about them is a fixed list, and a teacher writes "δωρεάν" in a price box. M4's rule on absence kinds. The resource categories *are* a vocabulary by the same rule, because the screen shows all six as fixed captions |
| **What an exam's `Βαρύτητα` does** | **Nothing — a planning note.** Not wired to M2's gradebook | Two surfaces that both say "βαρύτητα" are where a silent coupling hides. No command, selector or statement reaches across; a test asserts the whole gradebook output is unchanged by adding exams, and the screen says so under the field |
| **The six resource categories** | **Six kinds of material** — `websites` / `apps` / `books` / `video` / `classroom` / `other` | **The spec names a different six.** See below |
| **Deleting a class** | Units cascade; exams, trips and reflections keep their row with the link emptied | A unit *is* the class's annual plan. The other three record something planned or something that happened, which is still true afterwards |
| **Which M6 surfaces print** | **None**, per the scope line | See open question 2 for the "annual goals" reading, which was checked rather than assumed |

### The materials categories: by kind, not by owner

This document's module-3 entry lists own / school / shared / borrowed / digital
/ other — about who a resource **belongs to**. *Υλικά και πηγές* groups by what
a resource **is**, which is how a teacher looks for one:

> `ΙΣΤΟΤΟΠΟΙ ΚΑΙ ΠΛΑΤΦΟΡΜΕΣ` · `ΕΦΑΡΜΟΓΕΣ` · `ΒΙΒΛΙΑ ΚΑΙ ΚΕΙΜΕΝΑ`
> `ΒΙΝΤΕΟ ΚΑΙ ΗΧΟΣ` · `ΒΟΗΘΗΜΑΤΑ ΣΤΗΝ ΤΑΞΗ` · `ΑΛΛΕΣ ΠΗΓΕΣ`

Ownership is partly covered by the materials-loan log among M7's 11 print forms
(`Ημερομηνία / Μάθημα / Δόθηκε σε / Πόσα / Επιστροφή / Κατάσταση`). **Raised,
not settled quietly: see open question 1.**

## Open questions for the product owner

**1. Are the six resource categories about what a material *is* or whom it
belongs to?** M6 ships six kinds of material. If the spec's provenance six were
meant — and there is a real argument for them, since whose a thing is matters
when you leave a school — it is one vocabulary and one migration.

**2. Should M1's six annual-goal areas print?** The spec's "PDF output" section
names "annual goals" among the surfaces that produce a real file, and module 1
says those six are "printed as one table". **Nothing has built it.** M6 checked
this phrase specifically, because M4 skipped that check and M4.5 had to be
created: it reads as **M1's `annual_goals`**, not M6's annual *plan* — the
wording matches the table name and module 3 says nothing of the sort about the
annual plan. So M6 ships no PDF, per its scope line. But that leaves a surface
the spec promises a file and has not got one, which is exactly the shape that
created M4.5.

**3. Should a trip fill in M5's consent letter?** The letter asks for six
fields — `destination`, `date`, `class`, `hours`, `cost`, `escorts` — and a trip
now holds **five of them**: `activity` → destination, `date`, `class_id`,
`cost`, and `responsible` → escorts. Only `hours` has no trip equivalent, and a
trip's `transport` has no letter field. So it is a near-complete fill, not a
total one.

M6 does not wire them, because **M5 deliberately stores nothing for a filled
letter** and that is M5's decision to change, not M6's — and because it is
entangled with M5's own open question about whether a filled letter should
persist at all. The screen points at the letter in a hint instead.

**4. Should any of M6's six new surfaces print?** None does. Four are registers
of the same shape M4.5 and M5 gave PDFs to, and each would be one document
definition on the existing contract. The matrix is the interesting one: it
would print over two pages.

**5. Is an exam's `Βαρύτητα` meant to reach the gradebook?** Kept strictly
apart. But a teacher who writes "20%" on an exam in September and types 20 into
a grade column in November has said the same thing twice, which is the one thing
this milestone spent its effort avoiding elsewhere.

**Carried, untouched, and not M6's:** whether meeting minutes should print,
whether a filled letter should be saveable before M7, whether page-level boxes
stay boxes at volume, whether the conduct sheet prints with the grade sheet, the
absence register's kinds, and the Feb–Dec year model.

## Gate results (docs/ENGINEERING.md)

| # | Step | Result |
|---|---|---|
| 1 | Typecheck clean | **Pass, both OSes, by agent** — `npm run typecheck` on the dev Mac and, over SSH, natively in the Windows VM, both at branch head `650b33c` |
| 2 | Lint clean | **Pass, both OSes, by agent** — `eslint` (including the no-inline-Greek rule), `cargo fmt --all --check` and `cargo clippy --all-targets -- -D warnings`, all clean on the dev Mac and in the VM. Each confirmed by explicit exit code, since PowerShell renders cargo's stderr as an error record |
| 3 | Automated tests pass | **Pass, both OSes, by agent** — **527 frontend tests** (was 447) and **95 Rust tests** (was 85), green on the dev Mac and natively in the VM |
| 3b | Persistence round-trip | **Pass, extended** — `src-tauri/tests/cloud_folder.rs` now carries M6 as well: it writes a unit, an exam, a reflection, a trip with a consent, a textbook and a resource, quits, relaunches, and asserts every field comes back by name. It then moves the school year's start date and asserts all seven arrays compare equal — **the end-to-end half of the claim that the matrix's rows are derived**, since the week of 2 November is now called a different number and neither the plan the matrix reads nor anything M6 stores has moved |
| 4 | Packaged build on Windows and macOS, structurally verified | **Pass on both, locally, by agent.** **macOS:** `npm run tauri build --target universal-apple-darwin` on the dev Mac produced `Teacher Planner.app` (binary 9,732,704 bytes) and a 4,642,908-byte `.dmg`; `lipo -archs` reports **`x86_64 arm64`** and `CFBundleIdentifier` is `gr.atzenta.teacher-planner`. **Windows:** `npm run tauri build` **inside the VM** produced `teacher-planner.exe` (4,786,688 bytes) and `Teacher Planner_0.1.0_x64-setup.exe` (1,861,542); `Get-AuthenticodeSignature` → `NotSigned` on both, as expected. Both were built at branch head `650b33c` and then launched and driven — see step 5 — rather than only exiting 0 |
| 5 | Manual launch test from inside a cloud-synced folder, both OSes | **Pass on both, by agent, with three parts still needing a human.** Detail below. Launches were programmatic, not human double-clicks |
| 6 | This release note | **Pass** |

## Acceptance criteria for this milestone

Quoted from `docs/ENGINEERING.md` as written.

| Criterion | Result | Evidence |
|---|---|---|
| **The week-by-class progress matrix correctly reflects entries made from the per-class weekly plan (M3) without duplicate data entry.** | **Pass** | Held **by construction** at every layer, then checked as *insensitivity to duplication* rather than as a count. **Schema:** `migrate_to_7` adds no matrix table; `store.rs` has no matrix loader and no matrix saver; `lib.rs` has no matrix command; `api.ts` has no `saveProgressCell`. **Storage:** `store::tests::nothing_m6_adds_can_hold_a_weeks_work_for_a_class` writes a plan, then walks the columns of all five dated M6 tables asserting none carries a week, and asserts exactly one row in the whole file holds that week's work. **Selector:** `tests/unit/progress.test.ts` empties *everything M6 stores* — units, exams, reflections, trips, consents, textbooks, resources — and asserts the whole matrix compares equal to the full one; if any of it fed a cell, the teacher would have had to fill it in for her plan to appear. **UI, as the criterion is worded:** `tests/component/ProgressScreen.test.tsx` types a plan into the **real M3 screen**, saves it through the real `save_lesson_plan`, re-renders the **real matrix** from the planner that came back, finds the text, and asserts the matrix holds no `textbox`, `combobox` or `checkbox`, that rendering it made no further backend call, and that clicking six cells writes nothing. **And confirmed against broken code:** eight mutations, all caught — including the literal defect, a status box of the matrix's own that a plan must have filled before it shows, which failed the criterion's own test |
| **An exam, a trip, a textbook, and a resource entry each round-trip through save/reload with every field intact.** | **Pass** | `store::tests::an_exam_a_trip_a_textbook_and_a_resource_round_trip_with_every_field_intact` saves one of each from a fixture with **every field filled** and compares the reloaded records as **whole values**, not field by field — so a column dropped from either statement fails it rather than reading back quietly empty. A sibling test does the same after an **`UPDATE`**, since a criterion about save/reload is about that statement too. End to end against a real file on disk, `src-tauri/tests/cloud_folder.rs` writes all four plus a unit and a consent, quits, relaunches, and asserts every field individually by name. The unit is held to the same standard although the criterion does not name it, because it is the annual plan's row as well as its own card |

### What step 5 covered on macOS (by agent)

The universal `.app` was copied into a folder inside live **Google Drive** and
live **OneDrive** storage and launched through LaunchServices (`open -a`) — the
same path a double-click takes. In **both**:

- it started and **stayed** running, created `data/`, `data/backups/` and
  `exports/` beside itself, and wrote `planner.sqlite` at **`user_version = 7`**
  with **all seven M6 tables present** and `PRAGMA integrity_check` → `ok`;
- it survived a quit **verified by PID** and a relaunch with the database
  **byte-identical** (SHA-256 unchanged), and wrote a dated snapshot into
  `data/backups/`;
- **no `-wal`/`-shm` sidecars** at any point;
- every M6 record read back verbatim after the relaunch — the unit
  (`Εξισώσεις πρώτου βαθμού`), the exam (`Ολιγόλεπτο διαγώνισμα / 20%`), the
  reflection, the trip (`Επίσκεψη στο Μουσείο`), the consent
  (`given / Παραδόθηκε 28.11`), the textbook (`Μαθηματικά Β΄ / δωρεάν`) and the
  resource (`GeoGebra / websites`) — **and so did M3's lesson plan**, which is
  the row the progress matrix reads.

**One measurement mistake of mine, corrected, because it changes what the first
run was worth.** The first attempt reported `FAILED TO START` in the Drive
folder. **The app had started perfectly well**: `~/Google Drive/My Drive` is a
**symlink** into `~/Library/CloudStorage/GoogleDrive-…`, so the running process
reports its *real* path and a `pgrep` pattern built from the symlinked one
matched nothing. The check now resolves the folder with `pwd -P` first and
prints the real path it matched on. The figures above are from the corrected
run. This is the same class of bug the M3 gate hit with a Greek `grep` pattern,
and worth writing down a second time: **a launch check that cannot see the
process is indistinguishable from a launch that did not happen.**

### What step 5 covered on Windows, in the VM (by agent)

The exe built in the VM at branch head was copied into a folder inside live
**OneDrive** and live **Google Drive** (`G:\My Drive\…`) and started. In both:
the process started and stayed running, created `data\`, `data\backups\` and
`exports\`, wrote a 311,296-byte `planner.sqlite`, left **no sidecars**,
survived a quit **confirmed by PID** and a relaunch **byte-identical**, and
wrote a dated snapshot.

**A distinct folder name per device** (`Atzenta M6 mac` / `Atzenta M6 vm`), per
the lesson the M4 gate paid for: the Mac and the VM are signed into the same
Google Drive account, and one synced folder live on two devices is out of scope.

There is **no `sqlite3` in the guest**, so both databases were copied back to
the Mac and inspected there — the route M2 and M5 used. Both read
**`user_version = 7`**, `integrity_check` → `ok`, **all seven M6 tables
present**, and **no column named like a week index** on any of them.

## What still needs a human

**A partial human pass was done on the Windows VM on 2026-09-23, after the gate
above, and the product owner reported it clean.** What it covered is stated from
the evidence it left on disk rather than from recollection, because that is the
standard this project holds itself to:

- **It was the M6 build, proven rather than assumed.** Both test databases read
  **`user_version = 7`**, and the Google Drive one carries a `unit` row and an
  `exam` row — records only M6's own screens can write. The `Schema version`
  line was not checked at the time, so this is the evidence that closes that
  question. (The bundle-identifier hazard that faked a bug at M4.5 is in any
  case a **macOS** mechanism — `CFBundleIdentifier` plus LaunchServices — and
  has no Windows equivalent: running an exe from a folder runs that exe.)
- **Surfaces with stored evidence of typing:** Τάξεις, Μαθητές, Πρόγραμμα,
  Βαθμοί, Γονείς → Επικοινωνία, and **two of M6's six new screens** —
  *Ετήσιο πλάνο* (one unit) and *Εξετάσεις* (one exam). **Nothing was reported
  wrong on any of them.**
- **Surfaces with no stored evidence:** `lesson_plan`, `lesson_reflection`,
  `trip`, `trip_consent`, `textbook` and `resource` are all **empty in both test
  folders**, so *Εβδομάδα*, *Αναστοχασμός*, *Εκδρομές* and *Βιβλία & υλικά* were
  walked but not written to. The likeliest reason is that browsing a screen is
  not saving: the weekly plan commits on **Αποθήκευση** and the list screens
  need a record created first.
- **No PDF was exported during the pass**, anywhere in the VM. Every PDF on the
  machine dates from the M4.5 and M5 agent gates (newest 2026-09-23 10:28).
  Checked twice, per-folder and by a full sweep of both sync roots.

**So the items below are what remains, and they are carried into M7's brief
rather than closed.** The product owner merged M6 with them open, which is the
position M2 and M5 were merged in.

**The one that matters most, stated plainly: `lesson_plan` is empty, so
*Πρόοδος τμημάτων* had nothing to display during the pass.** The milestone's
headline claim — a plan typed once in Εβδομάδα appearing in the matrix without
being retyped — is proven by tests at four layers and by eight mutations, but
**no person has yet watched it happen.**

---

**Four items. The first two are M5's, carried forward unchanged; the third is
M6's own, now partial; the fourth is the standing one no machine can do.**

- **Nobody has looked at a printed letter.** M5 produced twenty verified PDFs
  and no person has judged whether one *looks* right — whether a reply slip
  orphans, whether a certificate reads as a certificate, whether the blank rule
  looks deliberate. **Still outstanding.** M6 adds no PDF, so it adds nothing to
  this list and removes nothing from it.
- **The Windows typing pass has never been done.** The last typing pass on any
  build was on **macOS at M4.5**. **Still outstanding**, and now larger again.
- **Four of M6's six new screens have not been typed into** — *Εβδομάδα* (M3's,
  but the matrix's only source), *Αναστοχασμός*, *Εκδρομές* and
  *Βιβλία & υλικά*. *Ετήσιο πλάνο* and *Εξετάσεις* were covered and were clean.
  **And the progress matrix has not been seen with anything in it**, because the
  weekly plan was never written during the pass. Two of these are grids, and
  grids are where clipping and misalignment live — the M1 gate found a silent
  data-loss bug this way and by nothing else.
- **A genuine Explorer double-click, and therefore SmartScreen. Not
  performed**, unchanged in kind since M1: `Start-Process` launches a
  Mark-of-the-Web-tagged unsigned build cleanly, and only a real double-click is
  blocked. Scripting cannot reproduce it.

**Not on this list, because it is closed:** the online-only placeholder case on
both sync clients. The product owner drove Google Drive's by hand at the M4.5
gate and OneDrive's was instrumented at M3, so that carried risk is shut and M6
did not re-open it.

**Before any manual pass: check the app's own `Schema version` line reads `7`.**
It is the cheapest proof that the window in front of you is this build and not a
stale one shadowing it through the shared bundle identifier — the hazard that
faked a bug at M4.5. `docs/MILESTONE_PROMPT.md` has the detail.

### The five-minute script, now with M6's part

M5's list with **part 6 added**:

1. **M2** — gradebook column, weight, marks, both export buttons.
2. **M3** — timetable hour, a class in a cell, a duty, a week's plan, Σημερινό,
   *Αντιγραφή ως κείμενο*.
3. **M4** — the month grid at 31 columns, an absence line, an incident, a
   support plan and two goals.
4. **M4.5** — all four export buttons, and open what comes out.
5. **M5** — walk the five sub-pages of *Γονείς & Ομάδα*, and **look at a
   printed letter**.
6. **M6 — open `Πλάνο` and walk its seven sub-pages.**
   - *Εβδομάδα*: write a plan for **this** week for two different classes, with
     a couple of lines each and an assessment on one of them.
   - *Πρόοδος τμημάτων*: **check both plans are there without you typing
     anything** — this is the milestone's whole claim. Confirm the current week
     is marked, that the assessment tag shows on the right one, and press a cell
     to be taken back to its plan. **Then look at the grid with three or four
     classes across it** and see whether the columns are still readable.
   - *Ετήσιο πλάνο*: add two units to a class, fill a few boxes on each, and
     check the overview table above fills in **by itself**. Look at whether a
     twelve-field card is legible or overwhelming.
   - *Εξετάσεις*: add two, one within the fortnight, and check the panel below.
   - *Αναστοχασμός*: add a note and type a paragraph into it.
   - *Εκδρομές*: add a trip, pick a class with real students, and tick a couple
     of consents — **watch the count change by itself**.
   - *Βιβλία & υλικά*: add a book with all seven columns, and a resource in two
     different categories.

## Known gaps

- **Four of M6's six new screens are untyped, and the matrix has never been
  seen holding anything.** The item above — the single most valuable five
  minutes anyone could spend on this milestone.
- **Nobody has looked at a printed letter**, and **the Windows typing pass is
  undone** — both M5's, both still open.
- **No PDF from any M6 surface.** Its scope line names none. Open questions 2
  and 4.
- **M1's annual goals are still unprinted** although the spec's "PDF output"
  section names them. Open question 2 — raised, not fixed, because it is M1's
  surface and M6's scope line does not reach it.
- **A trip does not fill in M5's consent letter.** Open question 3.
- **An exam's weight computes nothing.** Open question 5, and deliberate.
- **The materials categories are by kind, not the spec's provenance list.** Open
  question 1.
- **No reordering of units, trips, textbooks or resources.** `position` exists
  on all four and they append in order, so a move-up/down needs no migration —
  the same position M3 left the timetable's hours in.
- **M4.5's, M5's and M2's own open questions are untouched.** None is M6's.
- **No progress-check periods.** Still unclaimed, unchanged since M2.
- **M7 owns the 11 standalone print forms and the substitute folder**; M8 owns
  development, wellbeing, the staff directory and covers/leave.
- **Windows code signing is still unresolved**, unchanged, and still the nearest
  real-world blocker.

## A note on CI minutes

The full gate was run locally on the dev Mac **and natively in the Windows VM**
at branch head before this branch was pushed, so the first CI run was
confirmatory rather than exploratory.

**CI ran green on both runners on the first run** — run
[35857679603](https://github.com/Vibing101/Agenda-for-Teachers/actions/runs/35857679603):
`macos-latest` 13m48s and `windows-latest` 13m23s, both `success`, **no retries
and no cancelled runs**. One full matrix (~104 billed minutes) covered the code
and nothing else was spent. PR #12 carries both checks at head `2389cdc` and
reports `mergeStateStatus: CLEAN`.

**The skip-marker trap did not fire on the way in.** No commit message on the
first push contained that token in any form — including inside a sentence about
not using it, which is how M5 lost a trigger — and it was checked with a grep
over all three messages before pushing. PR #12 therefore opened with both checks
attached, which is what M5's fix was for.

**It fired on the way out, and this corrects M5's note.** The commit recording
the CI result is docs-only, so it carried the marker to avoid spending a second
full matrix on a paragraph. M5's note says that after doing the same thing
"PR #11 carries both checks and reports `mergeStateStatus: CLEAN`". **Half of
that does not hold.** Measured immediately after the push:

```
$ gh pr checks 12
no checks reported on the 'm6-annual-planning' branch
$ gh pr view 12 --json mergeStateStatus
CLEAN
```

So `mergeStateStatus` stays `CLEAN` — the merge is not blocked — but **the
checks stop being displayed on the PR at all**, because GitHub reports them
against the head commit and the head now has no run. This is the fifth time this
mechanism has cost this project something, and the first time the exact
behaviour has been pinned down: **the marker does not preserve an earlier run's
badge, it hides it.**

**What the evidence rests on instead, and it is checkable in one command.** The
green run tested the tree at `2389cdc`, and

```
$ git diff --stat 2389cdc HEAD -- src src-tauri tests
(empty)
```

so the code CI verified is byte-for-byte the code being reviewed; the only
difference is this section of this file.

**Restoring the badge costs one matrix (~104 billed minutes)** — amend the
message to drop the marker and force-push, or `gh workflow run "CI" --ref
m6-annual-planning`. With roughly five runs of headroom left this month, **that
is the product owner's call and is deliberately not taken here.** It is also the
strongest argument yet for the `paths-ignore` on `docs/**` that four milestones
have now proposed: with it, a docs commit would need no marker and this trap
would have nothing to catch.

Following M4's, M4.5's and M5's lesson, the commit carrying this note and the
spec update went in the **same single push** as the code, so the PR opens with
its CI attached rather than with none — the trap that has now cost this project
something four times. The CI-skip marker is deliberately not spelled out
anywhere in a commit message on this branch, which is the fifth lesson from the
same mechanism: GitHub matches that token anywhere in the message, **including
inside a sentence saying it is not being used**, which cost M5 a run.

**Fifthing M3's, M4's, M4.5's and M5's proposal, not implementing it** (it
changes what the gate proves, so it stays the product owner's call): run
typecheck, lint and the frontend tests once on `ubuntu-latest` at ×1, and
reserve `macos-latest` and `windows-latest` for the Rust build, the Rust tests
and packaging. A `paths-ignore` for `docs/**` would fix the docs-only cost
properly and is the smaller change of the two. Both are left alone here.
