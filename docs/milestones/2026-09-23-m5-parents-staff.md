# M5 — Parents & staff

> **Archived evidence (added 2026-09-24).** This repository's history was
> rewritten on 2026-09-24 to remove local-only material before it was made
> public. The pull requests, CI runs and commit hashes this note cites
> belong to the pre-rewrite repository, kept private as
> `Vibing101/Agenda-for-Teachers-archive`: links to them will not resolve here,
> and the hashes differ from this repository's. The note is otherwise left as
> it was written, except that references to material outside the project were
> removed on 2026-09-26.

**Date:** 2026-09-23
**Branch:** `m5-parents-staff`
**Signed off by:** Product owner, 2026-09-23 — squash-merged to `main` as
`3618bc9`. The merge's tree hash is `69b589d40268cdcb0840f4778bc80b2ccfbf6926`,
identical to the branch head `5ffe628`, so the squash lost nothing. The branch
was deleted afterwards.

**Two items under "What still needs a human" were _not_ performed before the
sign-off**, and are stated plainly here rather than left to be inferred:
**nobody has looked at a printed letter**, and **the Windows typing pass is
still undone**. The product owner signed off with both outstanding. They remain
outstanding against this milestone and are carried into M6's brief — the same
position M2 was merged in, and the reason M2's own typing pass went undone for
three milestones afterwards.

Worked on **the dev Mac** (`uname -s` = `Darwin`, `VBoxManage list vms` lists
`MilestoneTesting`), with the Windows half of the gate driven over SSH into the
`MilestoneTesting` VM (`COMPUTERNAME` = `MILESTONETESTIN`). Every result below
says which machine produced it and whether an agent or a human produced it.
macOS 26.6.2 on x86_64, Node 24.15.0.

**M4.5 was merged at the start of this milestone**, not before it. PR #10 was
still open with its head carrying `[skip ci]`, so the PR showed no checks at all
— the third time that trap has cost this project something. It was squash-merged
to `main` as `68027c7` after confirming the tree hash of the merge matched the
branch head byte for byte (`9345f257…` both sides), and that the only commits
after its green CI run (`35687760971`) were docs-only.

## What shipped

**Six surfaces, under one new top-level section `Γονείς & Ομάδα`** — the ninth
tab, and the first change to the top row since M0.

- **The parent communication log** (`Επικοινωνία με τους γονείς`) — a register,
  with the spec's *reason* and *agreements* kept apart
  from each other and from the page-level *remarks*, filterable by student and
  by class roster, and exporting a real PDF of **what the filter is showing**.
- **The weekly parent-appointment grid** (`Συναντήσεις με γονείς`) — `Ώρα ×
  Δευτέρα–Παρασκευή`, keyed by actual dates so the grid is a *view* over a
  chosen week, with its own PDF.
- **The upcoming-overview panel** — appointments and meetings due in the next
  seven days in one glance, with recent meetings marked as held and a button
  that opens straight into a meeting's minutes.
- **Staff, council and class meetings** — a card's fields over a list
  of agreements broken out as *who / what / by when*, because the spec names
  three parts and a deadline that is a stored date is what the panel can read.
- **The seven parent letters** — filled in the UI and exported as a
  descriptively-named **portrait** PDF, including the two reply slips and the
  two certificates.
- **The 150-message bank** across 15 categories — searchable (accent- and
  case-folded, over titles *and* bodies), fill-and-export, or copy to clipboard.

**Schema climbs to `user_version = 6`** — four tables, purely additive. Nothing
M0–M4 wrote is touched.

**Two pieces of shared machinery grew**, and both are described under Decisions:
the print document contract gained *blocks*, and `PrintCell` gained `nowrap`.

## The three things M5 had to get right, and how they are held

**1. No placeholder reaches a PDF.** Placeholders are written `[ΑΓΚΥΛΕΣ]`, and
a teacher would otherwise have to search for `[` before sending. That check is
now automatic. `fillPlaceholders` replaces every token
with what was typed or with a ruled blank — never with the token — and the tests
**scan rather than spot-check**: a regex for the syntax is run over the whole
generated HTML of **all seven letters** (unfilled and filled) and **all 150
messages** (unfilled and filled), asserted to find nothing.

Then the same scan was run against the **ten real PDFs**, extracted back with
`pdftotext`, on **both operating systems**. Zero.

**2. A booking and a record of what happened are independent.** Held by
construction at every layer — two tables with no key between them, no trigger,
no view, no foreign key; two commands, neither of which can reach the other's
table; two selectors in `domain/parents.ts`; two document builders in
`print/parentSheets.ts` — and checked as **insensitivity**, not as a count.

**The first version of that test was too weak, and a mutation caught it.** It
pushed 30 more bookings for a guardian who already had one and asserted the log
was unchanged; a deliberate mutation that tagged any contact whose guardian
appeared in the appointment table **passed it**, because that guardian's
membership never changed. The test now compares the log with the appointment
table **empty** against the log with it **full**, at every filter, and the same
both ways round. Nothing short of real independence survives that. This is
exactly why the "confirm it fails against broken code" step exists, and it is
the first time on this project that the step has actually caught a bad test.

**3. The upcoming window is a function of the day, not of the clock.**
`upcomingOverview(planner, today, days)` is pure, lives in `domain/meetings.ts`,
and takes the day the shell read. No component reads the calendar.

## Decisions taken

| Decision | Call taken | Why |
|---|---|---|
| **The "bilingual content" in M5's own scope line** | **Superseded — Greek only.** M5 authors no English | A direct contradiction inside the spec: M5's delivery line asks for bilingual content, while the **Language rollout timing** row (product owner, 2026-09-19) says Greek-only through M1–M8 with one dedicated pass at M9, and the **English translation authorship** row says that pass is a machine-translated draft. The later, more specific decision wins. Stated here and in the spec so the next agent does not re-derive it |
| **Where M5's surfaces live in the navigation** | **One new top-level section, `Γονείς & Ομάδα`, with five sub-pages.** Nine tabs, not eight, and not ten | M4's four surfaces became sub-pages because the spec filed them under sections the app already had. **M5's module has no such home** — nothing in the app was about parents or staff meetings. Making ΓΟΝΕΙΣ and ΟΜΑΔΑ *two* separate top-level items would have made ten. One tab named after the spec's own module 5 keeps the label honest about holding both halves and costs the top row one place rather than five. `tests/component/App.test.tsx` is renamed, pins the nine, and says in its comment why the number moved |
| **Where the letters and the message bank live** | **`src/i18n/lettersEl.ts` and `src/i18n/messagesEl.ts`**, merged with `el.ts` into one bundle in `i18n/index.ts`. The *structure* is in `src/domain/letters.ts` and `src/domain/messages.ts` and carries **no Greek at all** | The no-inline-Greek rule puts the content under `src/i18n/`, but 465 strings — several of them multi-paragraph — would have roughly tripled `el.ts` and mixed a product's content in among its button labels. Splitting by *kind* keeps one lookup, one `StringId` type and one lint rule. **The test of the shape is M9's, and it passes: adding English is adding two files and one line in `BUNDLES`** — no screen, no document builder, no domain module |
| **How a letter is printed, given a letter is not a table** | **The document contract gains blocks; `renderPrintDocument` stays the only renderer.** `PrintDocument.table` becomes optional; `blocks` is added (field row, prose, writing area, reply slip, signatures, certificate); `paginate()` flows blocks as well as rows | The alternative was a second renderer beside the first, which is how two printed pages start disagreeing about their own stylesheet. **A document that is all table paginates exactly where it did before** — M2's and M4.5's four sheets are the test of that, and `tests/unit/paginate.test.ts` is unchanged and still green. The app still measures and still places; a reply slip is kept whole by the paginator *and* by CSS, because only the first is binding on a fixed-height captured page |
| **Whether the two award pages are two-up** | **No — one certificate per full A4 portrait sheet** | The M5 brief says they are "2-up on the page". They are not. A certificate reads as a single centred award inside a coloured border on a full portrait sheet, and that is what the app prints. **Recorded because the brief is wrong and the next agent will read it** |
| **Whether a filled letter is stored** | **No.** Values live in the screen while composing, one draft per letter | M5's scope line asks for "fill the placeholders in the UI, preview, generate a PDF". The spec asks for *saved* filled state only for the 11 print forms, which are M7's, and M7's acceptance criterion is "filled, saved under a custom name, reopened, and re-edited" almost word for word. Building it here would have been building M7's surface early and in the wrong module. **Flagged — see Open questions** |
| **Which M5 surfaces produce a PDF** | **The 7 letters, the message bank, the communication log and the appointment week.** Not the meeting minutes | The scope line names the letters and the bank; the spec's "PDF output" section separately names **"parent-appointment weeks"**, so that is promised too. The log is the direct analogue of the incident register M4.5 printed — a register suited to formal documentation — and cost one document definition. Minutes are named nowhere, so they are **raised rather than decided**: that is the M4 precedent that created M4.5 |
| **An appointment's key** | **`(date, clock_time)` with an actual date.** No weekday column, no week index | The rule M1 set and M4 followed: correcting the school year's start date must not move a booking. The Monday–Friday grid is a view built from whichever Monday is asked for. A test asserts no appointment carries a `weekday` field |
| **A meeting's agreements** | **Their own table**, one row per agreement, with `who`, `what` and `deadline` | The spec names three parts of one thing — "agreements (who/what/deadline)" — and a deadline that is a stored date is what lets the upcoming panel read an action falling due. A paragraph could not |
| **The printed log's column count** | **Eight**, ending `… Αιτία / Συμφωνίες / Αποτέλεσμα / Επόμενα` | The spec's field list puts "outcome" between the agreements and the next step. Dropping it would lose a field the spec names |
| **A short formatted value that must not break** | **`PrintCell.nowrap`** | **Found by looking at a real rendered PDF, not at the HTML.** The log's date column broke `05.11.2026` across two lines and its format column broke `Τηλέφωνο`. The page default `overflow-wrap: anywhere` is right for a sentence and wrong for a formatted number, so the opt-out is per cell — the default is what stops a long Greek surname overflowing the sheet |
| **The four new vocabularies** | Contact format (`meeting`/`phone`/`email`/`message`/`note`), appointment mode (`in_person`/`phone`/`online`), appointment status (`proposed`/`confirmed`/`done`/`cancelled`), meeting kind (`staff`/`council`/`class`) | Nothing about them is a given list; these are the app's, as stable codes labelled through `vocab.<kind>.<code>` like every other fixed vocabulary. `proposed` is deliberately distinct from `confirmed` because the upcoming panel shows both and the difference is what the teacher is looking for; `cancelled` is what that panel leaves out |
| **Where the log's page-level remarks come from** | **A stored per-record field, printed attributed and verbatim** | The shape M4.5 resolved for a sheet's captioned box. It also inherits M4.5's open question about how that reads at volume — see Open questions |

## Open questions for the product owner

**1. Should a meeting's minutes print?** M5 gives a PDF to every surface this
spec promises one somewhere, and none to the staff/council/class meetings,
because nothing asks for one. But the ΟΜΑΔΑ section is about
*"Πρακτικά, συμφωνίες και ενέργειες"*, and minutes with a list of who agreed to
do what by when is a thing a teacher hands round. One document definition on the
existing contract; no stored data either way.

**2. Should a filled letter be saveable before M7?** M5 stores nothing for a
letter. That matches its scope line and leaves saved, reopenable filled forms to
M7. The risk is a teacher filling a long newsletter, closing the app, and
expecting to find it. One table and one migration if it should persist sooner.

**3. M4.5's open question about page-level boxes now has a second register.**
The printed log lists each line's own `remarks` in the sheet's `ΠΑΡΑΤΗΡΗΣΕΙΣ`
box, one attributed line per entry. It reads well for a handful and badly at
volume, exactly as the absence register's two boxes do. Whatever is decided
there should be decided here at the same time.

## Gate results (docs/ENGINEERING.md)

| # | Step | Result |
|---|---|---|
| 1 | Typecheck clean | **Pass, both OSes, by agent** — `npm run typecheck` on the dev Mac and, over SSH, natively in the Windows VM, both at branch head `768ea9d` |
| 2 | Lint clean | **Pass, both OSes, by agent** — `eslint` (including the no-inline-Greek rule), `cargo fmt --all --check` and `cargo clippy --all-targets -- -D warnings`, all clean on the dev Mac and in the VM. fmt and clippy confirmed by explicit exit code 0, since PowerShell renders cargo's stderr as an error record |
| 3 | Automated tests pass | **Pass, both OSes, by agent** — **447 frontend tests** (was 354) and **85 Rust tests** (was 78), green on the dev Mac and natively in the VM |
| 3b | Persistence round-trip | **Pass, extended** — `src-tauri/tests/cloud_folder.rs` now carries M5 as well: it writes a contact, an appointment, a meeting and an agreement, quits, relaunches, and asserts every field comes back — **including the contested pair, a booking and a log entry for the same guardian on the same date, both intact and neither derived from the other** |
| 4 | Packaged build on Windows and macOS, structurally verified | **Pass on both, locally, by agent.** **macOS:** `npm run tauri build --target universal-apple-darwin` produced `Teacher Planner.app` and a `.dmg`; `lipo -archs` reports `x86_64 arm64`. **Windows:** `npm run tauri build` **inside the VM** produced `teacher-planner.exe` (4,675,584 bytes) and `Teacher Planner_0.1.0_x64-setup.exe` (1,831,911); `Get-AuthenticodeSignature` → `NotSigned`, as expected. Both were built at branch head and then launched and driven — see step 5 |
| 5 | Manual launch test from inside a cloud-synced folder, both OSes | **Pass on both, by agent, with two parts still needing a human.** Detail below. Launches were programmatic, not human double-clicks |
| 6 | This release note | **Pass** |

### What step 5 covered on macOS (by agent)

The universal `.app` was copied into a folder inside live **Google Drive** and
live **OneDrive** storage and launched. In **both**:

- it started and **stayed** running, created `data/`, `data/backups/` and
  `exports/` beside itself, and wrote `planner.sqlite` at **`user_version = 6`**
  with all four M5 tables present;
- `PRAGMA integrity_check` returned `ok` and there were **no `-wal`/`-shm`
  sidecars**;
- it survived a quit **verified by PID** and a relaunch with the database
  **byte-identical** (SHA-256 unchanged), and wrote a dated snapshot;
- **M5 PDFs were exported into `exports/` inside the synced folder** — a letter,
  a letter with a reply slip, and the communication log.

### What step 5 covered on Windows, in the VM (by agent)

The exe built in the VM at branch head was copied into a folder inside live
**Google Drive** (`G:\My Drive\…`) and live **OneDrive** and started. In both:
the process started and stayed running, created `data\`, `data\backups\` and
`exports\`, wrote a 249,856-byte `planner.sqlite` at **`user_version = 6`** with
all four M5 tables and `integrity_check` = `ok`, left **no sidecars**, survived a
quit confirmed by PID and a relaunch **byte-identical**, wrote a dated snapshot,
and **exported the same three PDFs into `exports/` in both synced folders**.

**A distinct folder name per device** (`… M5 mac` / `Atzenta M5 vm`), per the
lesson the M4 gate paid for: the Mac and the VM are signed into the same Google
Drive account, and one synced folder live on two devices is out of scope.

**One operational finding worth carrying.** A launch over SSH lands in a
non-interactive session, where WebView2 has no desktop to render into: the print
self-test **hangs for ever** rather than failing. It has to go through a
scheduled task running as the logged-in user in the console session (`/ru
vboxtester /it`) — the route M2 and M4.5 used. New this time: **passing the exe
path to `schtasks /tr` directly fails with "The system cannot find the file
specified" when the path contains a space on a mapped drive** (`G:\My Drive\…`).
A one-line `.cmd` wrapper carrying the path works. That cost a round trip and is
written down so it does not cost another.

### The PDFs, and what was actually verified about them

This is the milestone's own criterion, so it is stated precisely.

**Ten documents × two operating systems = twenty real PDFs**, produced by the
**packaged build** through the print self-test hook, which drives the *same*
export path a button does. The documents were built by the app's own builders
with a deliberately harsh fixture: a 17-character Greek surname
(`Χατζηκωνσταντίνου`), multi-line teacher text, a five-day week, and **letters
left half-filled on purpose**, which is the case where an unfilled token could
escape.

| | macOS (`createPDFWithConfiguration:`) | Windows (`PrintToPdf`) |
|---|---|---|
| 7 letters | 1 page each, `595 x 841 pts (A4)` **portrait** | 1 page each, `594.96 x 841.92 pts (A4)` **portrait** |
| Message | 1 page, portrait | 1 page, portrait |
| Communication log | 1 page, `841 x 595 pts (A4)` landscape | 1 page, `841.92 x 594.96` landscape |
| Appointment week | 1 page, landscape | 1 page, landscape |
| Fonts | embedded subsets, `HelveticaNeue` | embedded subsets, `Arial` CID/Identity-H |

**Page counts and orientation match on both platforms on all ten sheets.**

**Portrait output is new.** Every sheet this project had printed until now was
landscape; the letters are the first use of the self-test hook's `…_PORTRAIT`
flag, and it works on both engines.

**Greek renders, and it was checked rather than assumed.** Every document
extracts back as Greek with diacritics and final sigma intact on both OSes —
`Επιστολή καλωσορίσματος`, `ΑΠΟΚΟΨΤΕ ΚΑΙ ΕΠΙΣΤΡΕΨΤΕ`, `Έπαινος`,
`Κωνσταντίνα Χατζηκωνσταντίνου`, `Συνεννοηθήκαμε ήρεμα`, `Επιβεβαιώθηκε` — not
tofu, not question marks, not Latin.

**Both reply slips land at the foot of their own letter's single page**, with
unfilled fields printing as `__________` rules, so a teacher can fill them in
by hand.

**What that does and does not establish.** It establishes that a real file is
produced, that it is A4 in the right orientation, that its fonts are embedded,
that the Greek is in it as Greek, and that **no `[ΑΓΚΥΛΕΣ]` survives into any of
the twenty files**. It does **not** establish that the letters *look right* —
whether the certificate's proportions read as a certificate, whether a reply
slip sits where the eye expects. **Nobody has looked at one.** See "What still
needs a human".

**One layout defect was found and fixed this way**, which is the argument for
rendering rather than trusting the HTML: the log's outcome and next-step columns
were 9% each and broke `Συνεννοηθήκαμε` mid-word; tightening the date column to
compensate then broke `05.11.2026` itself. The columns were rebalanced from a
real sheet and `PrintCell.nowrap` was added. **One thing remains and is a
judgement call:** a 17-character surname in a 13% column still breaks mid-word.
It is on the list below.

## Acceptance criteria for this milestone

| Criterion | Result | Evidence |
|---|---|---|
| All 7 letters and a sample across all 15 message-bank categories generate a correctly-formatted, Greek-rendering PDF with every placeholder filled and none left as `[BRACKETS]` | **Pass on the placeholders and on Greek rendering, by agent, both OSes — with "correctly formatted" only partly met: the files are correct, but nobody has looked at one** | **Placeholders:** `tests/unit/printLetters.test.ts` scans the *whole generated HTML* of all 7 letters (unfilled and filled) and **all 150 messages across all 15 categories** (unfilled and filled) with a regex for the syntax, asserted empty — and the same scan was run over the **twenty rendered PDFs' extracted text on both OSes**: zero. A mutation making an unfilled token print as itself failed five tests. **Greek:** every document extracts back with diacritics and final sigma intact on both OSes, fonts embedded as subsets. **Format:** A4, correct orientation, 1 page each, matching page counts on both engines. The judgement half — whether a letter *looks* like a letter — is not something a test settles; see "What still needs a human" |
| A parent appointment and a parent-contact-log entry for the same guardian/date coexist independently | **Pass** | Held by construction at four layers: no foreign key, trigger or view between `parent_contact` and `parent_appointment`; no command that writes both (`src-tauri/src/lib.rs`); no selector that reads both (`src/domain/parents.ts`); no document builder that reads both (`src/print/parentSheets.ts`). Checked as insensitivity of *whole outputs*: `tests/unit/parents.test.ts` and `tests/unit/printParents.test.ts` compare the log with the appointment table **empty** against the log with it **full**, and the same both ways round, for the selector, the `PrintDocument` and the rendered HTML. `tests/component/ParentsScreens.test.tsx` drives the real screens and asserts neither ever calls the other's command. `src-tauri/src/store.rs` does the same at the storage layer, and `cloud_folder.rs` round-trips the pair through a quit and relaunch. **The first version of the selector test was too weak and was caught by a mutation** — see "The three things M5 had to get right" |
| The upcoming-overview panel correctly surfaces both appointments and meetings due in the next 7 days on a test dataset | **Pass** | `tests/helpers/parentsFixture.ts` puts the boundaries deliberately close: a meeting 3 days back, one 6 days ahead and one 11 days ahead; a live booking 3 days ahead, a **cancelled** one 2 days ahead, and one 8 days ahead. `tests/unit/parents.test.ts` asserts the exact list and order, that the recent meeting is marked past, that the cancelled booking and the far meeting are left out, and that the same planner gives a different panel on a different day. Two mutations — including the cancelled filter and a four-day-wider horizon — each failed three tests. `tests/component/ParentsScreens.test.tsx` checks the same through the real panel |

## What still needs a human

**Two items, and the first matters more for M5 than it has for any previous
milestone.**

- **Looking at the printed letters.** Nobody can tell you whether a letter looks
  right except a person holding one. The twenty PDFs are in the session's
  scratch directory and three of each are in the synced test folders. Specifically:
  - **does each reply slip sit at the foot of its page, or does it orphan?**
    Both are on their letter's single page as produced here, but that is with
    the fixture's text; a longer agenda would push it.
  - **do the two certificates read as certificates?** They are one per full A4
    portrait sheet — *not* two-up, whatever the brief says — inside a ruled
    frame. Are the proportions right?
  - **does a long Greek name break the letterhead?** `Χατζηκωνσταντίνου` is
    17 characters and **still breaks mid-word in the log's 13% name column**.
    That is the known trade-off of eight columns of Greek on a landscape sheet,
    and it is a judgement call whether to accept it, drop a column, or shrink
    the type.
  - **is the blank rule right?** An unfilled field prints as `__________`, on
    the reading that these letters are forms. Does that look deliberate?
- **The typing pass on Windows.** Still outstanding from M4.5, and now larger:
  M5 adds five screens. The logic is platform-independent but layout is not.

**Before any manual pass: check the app's own `Schema version` line reads `6`.**
It is the cheapest proof that the window in front of you is this build and not a
stale one shadowing it through the shared bundle identifier — the hazard that
faked a bug at M4.5. `docs/MILESTONE_PROMPT.md` has the detail.

### The five-minute script, now with M5's part

This is M4.5's list with **part 5 added**:

1. **M2** — gradebook column, weight, marks, both export buttons.
2. **M3** — timetable hour, a class in a cell, a duty, a week's plan, Σημερινό,
   *Αντιγραφή ως κείμενο*.
3. **M4** — the month grid at 31 columns, an absence line, an incident, a
   support plan and two goals.
4. **M4.5** — all four export buttons, and open what comes out.
5. **M5 — open `Γονείς & Ομάδα` and walk its five sub-pages.**
   - *Επικοινωνία*: add a contact, fill every field including Παρατηρήσεις,
     filter by student, press *Εξαγωγή PDF μητρώου* and **check the sheet has
     only her lines and that the ΠΑΡΑΤΗΡΗΣΕΙΣ box lists the remark**.
   - *Συναντήσεις*: add two bookings at the same time on different days and
     check they land in **one row, two columns**; press *Εξαγωγή PDF εβδομάδας*.
     Then look at the **Επερχόμενες συναντήσεις** panel below and confirm it
     shows what is actually within a week.
   - *Συνεδριάσεις*: add a meeting and two agreements with deadlines; go back to
     *Συναντήσεις* and press **Άνοιγμα πρακτικών** on it.
   - *Επιστολές*: fill the welcome letter **partly**, export, and check the
     blanks print as rules and nothing shows `[ΑΓΚΥΛΕΣ]`. Then the invitation,
     for its reply slip, and Έπαινος, for the certificate.
   - *Μηνύματα*: search without accents (`απουσιες`), pick a message, fill its
     fields, press **Αντιγραφή ως κείμενο** and paste it somewhere.

## Known gaps

- **Nobody has looked at a printed letter.** The item above.
- **The Windows typing pass is still undone**, now across five more screens.
- **Meeting minutes do not print.** Open question 1.
- **A filled letter is not stored.** Open question 2, and M7's territory.
- **The log's remarks box inherits M4.5's open question** about page-level boxes
  at volume. Open question 3.
- **A 17-character Greek surname still breaks mid-word** in the printed log.
- **M4.5's and M2's own open questions are untouched** — the absence register's
  boxes, the incident register's notes field, whether the conduct sheet joins
  the grade sheet. None of them is M5's.
- **No progress-check periods.** Still unclaimed, unchanged since M2.
- **M7 still owns the 11 standalone print forms**, including saved filled state.
- **Windows code signing is still unresolved**, unchanged, and still the nearest
  real-world blocker.

## A note on CI minutes

The full gate was run locally on the dev Mac **and natively in the Windows VM**
at branch head before this branch was pushed, so the first CI run was
confirmatory rather than exploratory.

**CI ran green on both runners on the first run** — run
[35832664112](https://github.com/Vibing101/Agenda-for-Teachers/actions/runs/35832664112),
`macos-latest` and `windows-latest` both `success`, 13m39s, no retries and no
cancelled runs. **One full matrix (~104 billed minutes) covered the code, and
nothing else was spent.** PR #11 carries both checks and reports
`mergeStateStatus: CLEAN`.

**One skipped trigger, and it was self-inflicted — worth writing down.** The
first push produced *no run at all*. The cause was not the docs commit being the
head: it was that the commit message *explained* that it deliberately carried no
CI-skip marker, and in doing so **contained the literal token**. GitHub matches
that token anywhere in the message, including inside a sentence saying it is not
being used. Amending the message to refer to the marker without spelling it out
produced the green run above. It cost a skipped trigger, not a matrix, and it is
the fourth time this project has lost something to that mechanism.

Following M4's and M4.5's lesson: the docs commit carrying this note and the
spec update went in the **same single push** as the code, so the PR opened with
its CI attached rather than with none — the trap that had left PR #10 with no
checks at all when this milestone started.

**One thing to be exact about, as M4.5 was.** The green run above tested the tree
at `3f893dc`. The commit adding *these paragraphs* is docs-only and carries the
skip marker, so the branch head after it has no run of its own.
`git diff --stat 3f893dc HEAD -- src src-tauri tests` is **empty**, so the code
CI verified is byte-for-byte the code being reviewed. A run pinned to the literal
head would cost another ~104 billed minutes for no new information; it is one
command (`gh workflow run "CI" --ref m5-parents-staff`) if the product owner
wants one before merging. That call is deliberately left to them, because the
account has roughly five matrix runs of headroom left this month.

**Fourthing M3's, M4's and M4.5's proposal, not implementing it** (it changes
what the gate proves, so it stays the product owner's call): run typecheck, lint
and the frontend tests once on `ubuntu-latest` at ×1, and reserve
`macos-latest` and `windows-latest` for the Rust build, the Rust tests and
packaging. A `paths-ignore` for `docs/**` would fix the docs-only cost properly
and is the smaller change of the two. Both are left alone here.
