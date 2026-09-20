# M1 — School year, classes, students

**Date:** 2026-09-19
**Branch:** `m1-school-year-classes-students`
**Signed off by:** Product owner, 2026-09-20 — reviewed on a Windows machine
(where the gate run found and fixed a data-loss bug), then squash-merged to
`main` as `ac61eb4` and the branch deleted. The Google Drive half of gate step 5
on Windows was not run and is accepted as a carried risk, not a blocker — see
question 4 under "Open questions".

## What shipped

- **School year setup.** Year model (Sep–Aug / Jan–Dec / Feb–Dec) and a start
  date, from which 53 weeks and the month grid are derived live — the derived
  span updates as the date is typed, before anything is saved. Whatever day the
  teacher enters is stored as the Monday of that week, matching the source
  product's own behaviour.
- **Three grading periods, holidays and important dates**, each keyed by an
  actual date and carrying the source product's own vocabulary (Ministry/school
  for a holiday's source; deadline / meeting / exam window / event / other for
  an important date).
- **The six fixed annual-goal areas** — teaching, professional development,
  students, colleagues, parents, wellbeing — each with goal, actions, success
  indicators, deadline, status and end-of-year review.
- **Class CRUD**: name, subject, room, form teacher, notes; a weekly timetable
  of Monday–Saturday slots with period label, times and room; a live roster with
  a per-class support flag and short note; and an editable room plan.
- **Student CRUD with the complete card** from the source product: details,
  register number, birth date, home language, address, mid-year enrolment, two
  guardians (name, phone, email each), health and emergency (allergies,
  conditions, medication, emergency phone), SEN status with plan and
  accommodations, general notes and a meeting-notes log.
- **Many-to-many enrolment.** A student can be added to any number of classes,
  from either the class's roster or her own card, and appears correctly in each
  with her own per-class support flag and note. Each roster shows which *other*
  classes a student is in.
- **A searchable, sortable student index** (by name, by class, by register
  number; sorted by name, register number or birth date) and a **birthday
  calendar** derived from the cards, laid out from the month the school year
  starts in.
- **The single string lookup.** Every user-facing string is a string id resolved
  through `src/i18n/`; fixed reference vocabularies are stable codes labelled
  through the same table, and the code is what the database stores. An eslint
  rule fails the build on a Greek literal anywhere under `src/` outside
  `src/i18n/`.
- **Schema migration to `user_version = 2`**, replacing M0's `scratch_note`
  probe. M0's migration is kept as written and the file climbs from wherever it
  is, so a data file created by the signed-off M0 build migrates forward rather
  than being recreated.

## Decisions taken

| Decision | Call taken | Why |
|---|---|---|
| Language rollout timing | Greek-only through M1–M8; the English pass happens once, at M9 | The product owner's call (2026-09-19), answering the question M9's spec entry flags. Recorded in the spec's Resolved table. It settles *sequencing* only — bilingual is still in scope, so M1 ships no Greek literals in components: every string is an id through one lookup, and every fixed vocabulary is a code labelled through a translation table. Adding English at M9 is one new file plus one line in `BUNDLES` |
| Enforcing that | An eslint rule (`no-restricted-syntax`) rejecting Greek characters in JSX text, string literals and template chunks under `src/`, exempting `src/i18n/` | A convention nobody can check decays. Lint is gate step 2, so a screen that grows an inline label fails CI. Verified by hand that the rule fires on a real violation, and a unit test asserts the rule is still configured so deleting it fails a test rather than quietly removing the guarantee |
| Vocabularies stored as codes | `sen_status = 'accommodations'`, never `'Προσαρμογές'` | A vocabulary is a code list plus a `vocab.<kind>.<code>` label id. Storing the label would make a teacher's own data change meaning when the UI language changes at M9. This is the spec's "translation table rather than hardcoded per language", made concrete |
| One `load`, whole-planner mutations | Every command returns the entire planner, re-read from the file it just wrote | The data is tiny (one teacher, a hundred students) and it keeps the UI's state a copy of what is on disk rather than a cache that can drift from the file M0's change detection guards. Same reasoning as M0's per-operation connections |
| Mutations run in a transaction | `mutate()` wraps the write in a `BEGIN`/`COMMIT` | A roster is written row by row; the app can be quit mid-save. A partially-written class list is exactly the damage the spec chose SQLite to rule out. Covered by a test that fails a write partway and asserts the earlier rows rolled back too |
| Seating plan included in M1 | Built as part of Class | The seating plan is a field of `Class` in the spec's data model, M1's scope line says "class CRUD", and no later milestone claims it — while M7's criteria assume it already exists in the Classes module. Flagged here rather than taken silently; if the product owner would rather it moved, it is self-contained |
| Foreign keys enforced and cascading | `foreign_keys = ON`; roster and seat rows cascade from class and student | The spec asks for an orphaned student reference to be "rejected at write time, not silently allowed to dangle". A roster row for a non-existent student now errors; deleting a student removes her roster rows and seats; deleting a class keeps its students |
| Annual-goal `status` is free text | Not a fixed vocabulary | See "Open questions" — the spec does not say, and the source product leaves the area as an open box |
| Student's class is a real membership, not the card's text field | The source card's single "ΤΑΞΗ / ΤΜΗΜΑ" box is replaced by enrolments | The spec explicitly makes this many-to-many, since a subject teacher's class is a subject group. The card shows every class the student is in and can add her to another |

## Open questions for the product owner

**1. Does the Feb–Dec year model cover eleven months or twelve?** Read
literally, February to December is eleven months. The source product's
quick-start page promises "53 εβδομάδες και **12** μήνες" for every model. M1
implements the literal reading — Feb–Dec shows eleven months — rather than
guessing at a wrap into January, because guessing would silently change which
months a teacher's calendar shows. Sep–Aug and Jan–Dec are unaffected (both
twelve). One line in `src/domain/schoolYear.ts` changes it either way. Recorded
in the spec's "Open" section.

**2. Should an annual goal's status be a fixed vocabulary?** The spec lists
`status` as a field on each of the six goal areas without saying what it holds.
The source product leaves the whole area as an open box, and the only status
field the spec is explicit about (SupportPlan's, M4) it says is "written by the
teacher, never computed". M1 ships free text on that reading. If a dropdown is
wanted, it should be added as a vocabulary rather than hardcoded.

**3. Is the seating plan meant to be in M1?** See "Decisions taken". It is not
named in M1's scope line, is part of `Class` in the data model, and M7's
criteria assume it exists by then. Shipped here; easy to defer.

**4. Gate step 5 on Windows — ANSWERED for OneDrive; the Google Drive half
ACCEPTED by the product owner (2026-09-20).** It was run on a physical Windows
machine from a live OneDrive folder, including the online-only placeholder case,
which passed. The **Google Drive half on Windows was not run** — that client was
not installed on the machine used — and the product owner has accepted it on the
same basis as M0's Windows gap: carried forward as a risk, not a blocker, rather
than holding the milestone for it.

That acceptance is a judgement that the evidence already in hand is enough to
proceed, not a claim that Drive was tested. It rests on the placeholder case —
the leading suspect for what killed the previous attempt — having passed on
OneDrive, which is the harder half of the mechanism. It does **not** transfer:
Drive streams files by a different mechanism, and the M0 acceptance criterion
names both clients explicitly. It stays recorded under Carried risks in the spec
and should be closed before the app reaches the teacher.

The run also turned up two findings detailed under "Windows gate results": a
confirmed data-loss bug in `Νέο τμήμα`, now fixed, and the fact that the CI
Mark-of-the-Web tripwire is not measuring SmartScreen — see question 5.

**5. Should the CI Mark-of-the-Web tripwire be reworked, or its claim softened?
— RESOLVED 2026-09-20: the launch assertion was dropped.** It could not observe
SmartScreen from a headless runner, so it passed for an unrelated reason; worse,
had code signing ever landed it would have failed the build and reported the
opposite of the truth. The step now tags a binary, records what the runner does,
and never fails the build, stating plainly that only a human double-click (gate
step 5) can answer the question. The M0 release note's claim that CI "confirmed"
the SmartScreen behaviour is withdrawn in a dated correction there, and the
spec's Carried risks bullet now rests on the real-machine observation instead.

## Gate results (docs/ENGINEERING.md)

Run on macOS 15 (Darwin 25.6.0), Node 24.15.0, Rust 1.98.1.

| # | Step | Result |
|---|---|---|
| 1 | Typecheck clean | **Pass** — `npm run typecheck` |
| 2 | Lint clean | **Pass** — `eslint` (including the new no-inline-Greek rule), `cargo clippy --all-targets -D warnings`, `cargo fmt --all --check` |
| 3 | Automated tests pass | **Pass** — 36 Rust tests (35 unit + the cloud-folder integration test) and 64 frontend tests, green locally and on both CI runners |
| 3b | Persistence round-trip | **Pass** — `src-tauri/tests/cloud_folder.rs` drives launch → write a year, two classes and a student enrolled in both → quit → relaunch → read it all back, against a real folder on disk. Repeated against the packaged app; see step 5 |
| 4 | Packaged build on Windows and macOS, structurally verified | **macOS: pass**, locally and in CI (run [35469528187](https://github.com/Vibing101/Agenda-for-Teachers/actions/runs/35469528187), `macos-latest`, 5m13s). Locally, `npm run tauri build -- --target universal-apple-darwin` produced `Teacher Planner.app` (8.6MB); `lipo -archs` reports `x86_64 arm64`, so both slices are present; `Info.plist` and an executable binary verified. **Windows: by CI only** — run [35469528187](https://github.com/Vibing101/Agenda-for-Teachers/actions/runs/35469528187) is green on `windows-latest` (7m12s); it builds the `.exe` and NSIS installer, smoke-launches the binary from a Greek, space-containing path, and checks it creates its data file and writes a snapshot on relaunch. Both installers are uploaded as artifacts. **Updated 2026-09-20: now also verified on a physical Windows machine** — the `teacher-planner-windows-latest` artifact from that run was installed via its NSIS installer and launched by real double-click. See "Windows gate results" below |
| 5 | Manual launch test from inside a cloud-synced folder, both OSes | **macOS: pass, from both a live Google Drive folder and a live OneDrive folder. Windows: partial pass (2026-09-20)** — performed on a physical Windows 11 Enterprise 26200 machine from a live **OneDrive** folder, including the online-only placeholder case. **The Google Drive half on Windows was not done** — client not installed on that machine — and is **accepted by the product owner as a carried risk** (2026-09-20), on the same basis as M0's Windows gap. See "Windows gate results" and question 4 above |
| 6 | This release note | **Pass** |

### What step 5 actually covered on macOS

The universal `.app` was copied into `My Drive/Ατζέντα Εκπαιδευτικού M1` and into
the equivalent folder under `OneDrive-Personal`, and launched through
LaunchServices (`open -a`) — the same path a double-click takes. In both folders
it:

- started and **stayed** running (confirmed by `ps` and `lsappinfo`, which also
  confirms it resolved its bundle path inside the synced folder);
- created `data/`, `data/backups/` and `exports/` beside itself, and created
  `data/planner.sqlite` at **`user_version = 2`** with all ten M1 tables and the
  fixed rows seeded (6 goal areas, 3 grading periods);
- **kept its data across a full quit and relaunch.** A school year
  (`sep_aug`, `2026-09-14`), two classes (Α1 Μαθηματικά, Β2 Φυσική) and a student
  (Ελένη Παπαδοπούλου, allergies Ξηροί καρποί, SEN `accommodations`, guardian
  Άννα Παπαδοπούλου) enrolled in **both** classes — flagged for support with the
  note `Μπροστινό θρανίο` in Α1 and not in Β2 — all read back byte-for-byte after
  the app was quit and reopened, with the per-class support flags still distinct;
- wrote a dated snapshot into `data/backups/` on the relaunch, and left **no
  `-wal`/`-shm` sidecar files**, which is the cloud-sync-safety reason for
  `journal_mode = DELETE`.

**What it did not cover, stated plainly:** the data above was seeded into the
file with `sqlite3` while the app was closed, not typed into the M1 screens,
because this agent cannot click in a packaged app's window. So the packaged
build's *file handling* is verified end to end; the packaged build's *UI* is not.
See "Known gaps".

## Windows gate results (2026-09-20)

Performed on a physical Windows 11 Enterprise 26200 machine, interactive console
session, against the packaged build: the `teacher-planner-windows-latest`
artifact from run
[35469528187](https://github.com/Vibing101/Agenda-for-Teachers/actions/runs/35469528187),
installed with its NSIS installer to `%LOCALAPPDATA%\Teacher Planner`
(`Get-AuthenticodeSignature` → NotSigned, as expected). Every launch was a real
Explorer double-click, not a programmatic start — that distinction matters, see
"SmartScreen" below.

| Test | Result | Evidence |
|---|---|---|
| SmartScreen / Mark of the Web | **Blocked, as the carried risk predicts** | With `ZoneId=3` on the exe, double-click shows "Windows protected your PC — Microsoft Defender SmartScreen prevented an unrecognised app from starting", `Application: Teacher Planner.exe`, `Publisher: Unknown publisher`. The app does not start until *More info → Run anyway*. SmartScreen confirmed enabled on the machine ("Check apps and files = On"). After one *Run anyway*, later launches of that same file go straight through |
| Double-click from a **OneDrive** folder | **Pass** | `C:\Users\ksavvides\OneDrive\Ατζέντα Εκπαιδευτικού M1` (Greek + spaces). Window opened and stayed open; `data\`, `data\backups\`, `exports\` created beside the exe; `data\planner.sqlite` created. The app's own panel reported the data path, **Έκδοση σχήματος = 2**, and the backup count |
| Double-click from a **Google Drive** folder | **Not done** | Google Drive for Desktop is not installed on that machine (no `GoogleDriveFS.exe`, no mount, absent from the uninstall registry). Deferred by the product owner rather than installed. Still open |
| **Online-only placeholder files** | **Pass — the carried risk did not reproduce on OneDrive** | Files forced online-only and verified genuinely dehydrated, not merely flagged: `GetCompressedFileSizeW` reported **0 bytes on disk** for the exe, the database and every backup against full logical sizes, attributes `OFFLINE + UNPINNED + RECALL_ON_DATA_ACCESS`. Double-click then launched normally — Windows hydrated the exe and the database on demand within 8s, the window opened and stayed open (polled to T+41s). **No hang, no second database, no data loss**: the database SHA-256 was byte-identical before and after, and exactly one `planner.sqlite` existed |
| Real data typed into the UI, surviving a restart | **Pass** | A school year, two classes with a timetable slot, and a full student card (both guardians, all four health fields, SEN status/plan/accommodations) were **typed into the packaged app's screens**, not seeded with `sqlite3`. The student was enrolled in both classes with the support flag set and noted in Α1 and clear in Β2. After a full quit and a fresh double-click, every field read back unchanged and both rosters still showed their own distinct support flag |
| Backups, and no `-wal`/`-shm` | **Pass** | Dated snapshots accumulated in `data\backups\`; the panel reported the count and latest timestamp. The folder was checked for `planner.sqlite-*` at every stage — quit, relaunch, save, block, reload, placeholder launch — and **no `-wal` or `-shm` file ever existed**. Snapshots are written on both quit and launch, not only on relaunch. Retention/thinning was not exercised |
| Block-and-reload panel | **Pass** | With the app open, another process overwrote the data file with genuinely different content. The next save was refused: the card greyed out, both buttons disabled, the typed edit preserved, and a panel appeared — "Το αρχείο δεδομένων άλλαξε στον δίσκο" — offering only `Επαναφόρτωση από τον δίσκο`, **with no save-anyway option**. The on-disk file was verified unchanged by the refused save. Reload recovered cleanly. Note: the guard keys on **content, not mtime** — rewriting the file with byte-identical content correctly does not trip it |

### What the Windows run did not cover

- **Google Drive on Windows**, as above. OneDrive's placeholder behaviour is now
  known good, but Drive's streaming implementation is a different mechanism and
  this spec names both.
- **The `cargo` trio** (`fmt --check`, `clippy -D warnings`, `test`) could not be
  run on that machine: no Rust toolchain and no MSVC Build Tools, and installing
  them is a multi-gigabyte step that was not taken. Those remain covered by CI
  and by the macOS run above. For the same reason the app could **not be
  repackaged** there, so the `Νέο τμήμα` fix is unverified in a packaged build.

  The three frontend gate commands **were** run on Windows once Node was
  installed, after the fix: `npm run typecheck` clean, `npm run lint` clean
  (including the no-inline-Greek rule), and `npm test` **66 passed** — the 64
  that existed plus the two new regression tests.

### The CI Mark-of-the-Web tripwire is not measuring SmartScreen

`.github/workflows/ci.yml` launches the MotW-tagged exe with `Start-Process`,
sleeps, and treats any non-running process as proof SmartScreen blocked it. On a
real machine with SmartScreen demonstrably **On**, all three launch paths were
tried against the same tagged file:

- `Start-Process` → launched cleanly, **no dialog**;
- `Shell.Application` → `InvokeVerb("open")` → launched cleanly, **no dialog**;
- a real Explorer double-click → **SmartScreen blocked it**.

The programmatic paths bypass the prompt, and a headless runner has no
interactive desktop to display it, so that step cannot be observing what its
comment claims. It currently passes for the wrong reason, and by the same logic
it would not detect signing landing. **The carried risk itself is confirmed** —
it is the "confirmed by CI" evidence claim that overstates what the step shows.
Raised for the product owner rather than changed here.

**Related nuance:** the NSIS installer does **not** propagate Mark of the Web to
what it extracts — the installed `teacher-planner.exe` carried no
`Zone.Identifier` at all. So in the real delivery path the SmartScreen prompt
hits the **installer, once**; the app the teacher launches daily afterwards is
untagged and starts without a prompt.

### Bug found: `Νέο τμήμα` overwrites the previously selected class

**Confirmed by reproduction, 2026-09-20.** With class Α1 saved and selected,
pressing **`Νέο τμήμα`** creates a `Χωρίς όνομα` card but leaves the editor bound
to **Α1** — Α1's timetable slot and form teacher stay visible in the form. Typing
a name and pressing `Αποθήκευση`, which is the obvious gesture, **renamed Α1**
to the typed name, keeping its subject, roster, support flag and timetable, while
the newly created class remained `Χωρίς όνομα · 0 μαθητές`.

So a teacher creating her second class silently overwrites her first, with no
warning and no indication anything went wrong.

**`Νέος μαθητής` had the identical defect**, and it is the worse of the two: with
a student already on file, creating a second card and typing a name would have
overwritten her entire record — guardians, health and SEN included. It escaped
the manual run only because the index happened to be empty at that point, which
is the one case where the selection effect picks the new record anyway.

**Root cause.** Neither button moved the selection to the record it had just
created. `ClassesScreen`'s effect only reassigns `selectedId` when the current
selection is *gone*, and creating a class does not invalidate the existing
selection — so the editor stayed mounted on the old record and `saveClass(draft)`
wrote with the old record's id. Same shape in `StudentsScreen`.

**Fixed on this branch.** `Run` now hands back the planner it read from disk (or
`null` if the write did not happen), so each "new record" button can find the row
the backend assigned an id to and select it. Both existing creation tests started
from an *empty* planner, which is exactly why 64 component tests never caught
this; the two new regression tests start with a record already on file, and were
confirmed to fail against the unfixed code and pass against the fix.

### Smaller UI observations (Greek-only through M8)

- **`Email` is in English** on both guardian panels; every other label on the
  card is Greek. It is a common loanword, so this may be deliberate.
- **Native date and time inputs render in English/US format**: `dd/mm/yyyy`
  placeholders and `09:00 am`. These come from the WebView2 control's locale, not
  from the string table, so the no-inline-Greek lint rule cannot catch them.
  Worth a locale decision before M9.

Nothing else on screen was untranslated, misaligned or clipped across the three
screens at 1920×1200 maximised.

## Acceptance criteria for this milestone

| Criterion | Result | Evidence |
|---|---|---|
| Changing the school-year start date after data exists does not move or delete any already-entered record | **Pass** | Guaranteed by construction, then checked at all three layers. **Schema:** no table has a week column; the start date is one field on one row, so there is nothing for a change to cascade into. **Storage:** `store::tests::moving_the_school_year_start_date_changes_no_other_record` seeds grading periods, a holiday, an important date, an annual goal, a class with a timetable slot, a student, an enrolment and a seat; moves the start date a week earlier *and* switches the year model; then asserts every other table is unchanged. **Derivation:** `schoolYear.test.ts` shows 5 November moving from week 8 to week 9 while the record's date stays `2026-11-05`. **UI:** `YearScreen.test.tsx` does it through the form and then asserts the holiday and the important date are still on screen on their own dates. **End to end:** `cloud_folder.rs` repeats it against a real folder on disk |
| A student can belong to two classes at once and shows correctly in both rosters | **Pass** | `store::tests::a_student_belongs_to_two_classes_at_once_and_appears_in_both_rosters` enrols one student in two classes and asserts each roster has her once, with the support flag set in one class and clear in the other. `ClassesScreen.test.tsx` does the same through the UI, switching between the two classes and checking each roster shows her, shows the *other* class she is in ("Επίσης: Α1"), and keeps its own support flag. `leaving_one_class_leaves_the_other_membership_alone` covers the other half: removing her from one roster leaves the other membership and the student herself untouched |
| Every field in the Student data-model entry (guardians, health/emergency, SEN status) round-trips through save/reload | **Pass** | `store::tests::every_student_field_round_trips_through_save_and_reload` fills all 21 fields, drops the connection entirely (the app quitting), reopens the file and asserts the whole struct compares equal. `StudentsScreen.test.tsx` asserts every field renders with its stored value — both guardians' name/phone/email, all four health fields, SEN status/plan/accommodations, notes and meeting notes — and that saving an untouched card hands back exactly what was loaded. A second test edits a health field and the SEN category and checks the stored value is the *code* (`reinforcement`), not the Greek label, and that nothing else on the card moved |

## Known gaps

- **RESOLVED 2026-09-20 for OneDrive; ACCEPTED as a carried risk for Google
  Drive.** Gate step 5
  has now been performed on a physical Windows machine, including the
  **online-only placeholder file** case that CI cannot reach — and the app
  launched normally from fully dehydrated placeholders with no hang, no second
  database and no data loss. See "Windows gate results". The **Google Drive**
  half on Windows remains untested, because that client is not installed on the
  machine used. It is a different streaming mechanism from OneDrive's, so the
  OneDrive result does not carry over. **The product owner accepted this on
  2026-09-20** rather than holding the milestone for it, on the same basis as
  M0's Windows gap — a risk carried forward, not a step passed. It should be
  closed before the app reaches the teacher.

- **RESOLVED 2026-09-20: the M1 screens have now been driven in the packaged
  app** — a school year, two classes with a timetable slot, and a full student
  card were typed into the real UI on Windows, enrolled in two classes with
  different per-class support flags, and read back intact after a full quit and
  relaunch. **This surfaced a confirmed silent-data-loss bug in `Νέο τμήμα`**
  (see "Windows gate results"), which is exactly what driving the real UI was
  meant to catch and which none of the 64 component tests detect.

- **RESOLVED 2026-09-20: the block-and-reload panel has now been watched by a
  human.** The warning appeared, the save was refused with no save-anyway
  option, the on-disk file was verified untouched, and Reload recovered cleanly.
  Also learned: the guard keys on file **content**, not mtime.

- **FOUND AND FIXED on this branch: `Νέο τμήμα` and `Νέος μαθητής` overwrote the
  previously selected record.** Confirmed by reproduction on the packaged Windows
  build, fixed, and covered by two regression tests that fail against the unfixed
  code. Detailed under "Windows gate results". **The fix is verified by
  typecheck, lint and the 66-test suite run on Windows, but has not been
  exercised in a repackaged build** — rebuilding needs Rust and the MSVC Build
  Tools, which are not installed on that machine. Worth one more double-click
  test against a fresh installer before hand-off.

- **Windows code signing is still unresolved and is now the nearest real-world
  blocker.** Unchanged by M1, and recorded under Carried risks in the spec: an
  unsigned build carrying Mark of the Web will not start for the teacher without
  *More info → Run anyway*. This needs a decision before the app reaches her.

- **macOS builds are unsigned and un-notarized**, so Gatekeeper needs a
  right-click → Open on first launch. Unchanged from M0.

- **Not in M1, by design, and where each is picked up:** support plans and the
  behaviour/incident log are M4; the master teacher timetable, weekly lesson
  plans and the Today view are M3; grades are M2. M1 deliberately ships only
  what its scope line names, plus the class seating plan (see "Decisions
  taken").

- **Printing and PDF export do not exist yet.** The `exports/` folder is created
  but nothing writes to it until M2.
