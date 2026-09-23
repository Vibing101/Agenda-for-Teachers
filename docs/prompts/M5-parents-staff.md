# M5 — Parents & staff

You are picking up an in-progress project: a from-scratch rebuild of a Greek
teacher's planner ("Ατζέντα Εκπαιδευτικού") as a native Tauri desktop app.
M0, M1, M2, M3, M4 and M4.5 are merged and signed off. Your task is **M5**.

**START BY READING `docs/MILESTONE_PROMPT.md` IN FULL.** It is the standing brief
for every milestone agent on this project: how to work out which machine you are
on and what that machine is allowed to claim, what else to read, the language
rules, the patterns already settled, and how the six-step gate is run. All of it
applies to you. **Do its section 1 before you plan anything.**

Then read, in this order: `docs/REBUILD_SPEC.md` (especially its **Resolved**
table, its **Open** section and its **Carried risks**), `docs/ENGINEERING.md`,
`docs/WINDOWS_VM.md`, and every release note in `docs/milestones/`. The **M2**
and **M4.5** notes matter most to you: between them they record how PDF
generation on this project actually works, what was tried and failed, and the
document/pagination contract you will be extending rather than inventing.

**Before you branch, confirm M4.5 actually merged.** It had passed its full gate
— including, for the first time on this project, every human item — but PR #10
was still open when this prompt was written. `git log --oneline -5` on `main`
should show M4.5's merge commit. If it does not, stop and ask.

---

## What to build

M5's delivery-scope line, verbatim:

> **M5 — Parents & staff.** Communication log, parent-appointment grid,
> staff/council meetings, letters (7) and message bank (150) with bilingual
> content and PDF generation.

The precedent on this project is that **a milestone ships its scope line
exactly** — M2 built PDFs because its line said so, M3 did not because its line
did not, M4 did not and raised the conflict instead of resolving it silently,
which is how M4.5 came to exist. Your line names PDF generation, so build it.

Module 5 of the spec ("Γονείς & Ομάδα") is the full functional detail. Six
surfaces:

1. **Parent communication log** — date, student, guardian, format, *reason /
   agreements* kept **separate from** overall remarks, outcome, next step.
2. **Weekly Monday–Friday parent-appointment grid** — time slots, student /
   guardian, mode, place, status, topic, outcome. **Independent of the log
   above**: the spec is explicit that one is a *booking* and the other a *record
   of what happened*.
3. **Upcoming-overview panel** — merges upcoming appointments with upcoming and
   recent meetings in one glance, opening straight into a meeting's minutes.
4. **Staff / council / class meetings** — type, date, time, attendees, agenda,
   agreements (who / what / deadline), optional class link, duration.
5. **The 7 parent letters** — fill the placeholders in the UI, preview, generate
   a descriptively-named PDF.
6. **The 150-message bank** across 15 categories — searchable, fill-and-generate
   a PDF **or** copy to clipboard.

### The source material, already located for you

`reference/` is **read-only**: never edit it, never generate into it.

**`reference/03 - Έτοιμες επιστολές προς γονείς.pdf`** — 8 pages, page 1 is a
cover, so the seven letters are pages 2–8 (1-indexed):

| # | Letter | Note |
|---|---|---|
| 1 | Επιστολή καλωσορίσματος — για την αρχή της σχολικής χρονιάς | header: ΤΜΗΜΑ / ΣΧΟΛΙΚΟ ΕΤΟΣ / ΗΜΕΡΟΜΗΝΙΑ |
| 2 | Ενημερωτικό δελτίο για γονείς | ΤΜΗΜΑ / ΑΡΙΘΜΟΣ–ΜΗΝΑΣ / ΘΕΜΑ ΤΕΥΧΟΥΣ; has ΤΙ ΕΓΙΝΕ, ΠΡΟΣΕΧΕΙΣ ΗΜΕΡΟΜΗΝΙΕΣ, ΥΠΕΝΘΥΜΙΣΕΙΣ, ΠΩΣ ΝΑ ΒΟΗΘΗΣΕΤΕ ΣΤΟ ΣΠΙΤΙ |
| 3 | Πρόσκληση σε συνάντηση / συνεντεύξεις | has ΗΜΕΡΗΣΙΑ ΔΙΑΤΑΞΗ and an **ΑΠΟΚΟΨΤΕ ΚΑΙ ΕΠΙΣΤΡΕΨΤΕ** reply slip |
| 4 | Ενημέρωση για προβλεπόμενο βαθμό κάτω της βάσης | ΜΑΘΗΤΗΣ / ΤΜΗΜΑ / ΜΑΘΗΜΑ; ΛΟΓΟΙ, ΟΡΟΙ ΚΑΙ ΠΡΟΘΕΣΜΙΕΣ ΒΕΛΤΙΩΣΗΣ, ΒΕΒΑΙΩΣΗ ΠΑΡΑΛΑΒΗΣ |
| 5 | Συγκατάθεση για επίσκεψη / εκδρομή | ΤΜΗΜΑ / ΩΡΕΣ / ΚΟΣΤΟΣ / ΣΥΝΟΔΟΙ + reply slip |
| 6 | Έπαινος | a certificate, **2-up on the page** |
| 7 | Βραβείο επίδοσης | a certificate, **2-up on the page** |

**`reference/06 - Τράπεζα μηνυμάτων.pdf`** — 18 pages. Confirmed structure:
**15 categories × 10 messages = 150**, with an index page that says so
("150 μηνύματα ταξινομημένα κατά περίσταση"). The categories, in order:

1. Καλωσόρισμα και αρχή της χρονιάς · 2. Αίτημα για συνάντηση ·
3. Υπενθύμιση για συνάντηση γονέων · 4. Απουσίες μαθητή · 5. Καθυστερήσεις ·
6. Εργασίες που δεν παραδόθηκαν · 7. Βελτίωση και πρόοδος ·
8. Αναγνώριση της προσπάθειας · 9. Συγχαρητήρια για τα αποτελέσματα ·
10. Συμπεριφορά · 11. Έλλειψη συμμετοχής στο μάθημα ·
12. Μετά τη συνάντηση με τους γονείς · 13. Οργανωτικές υπενθυμίσεις ·
14. Τέλος περιόδου και έκδοση βαθμών · 15. Επικοινωνία μέσα στο σχολείο

There is also `reference/06 - Τράπεζα μηνυμάτων (επεξεργάσιμη).docx`, which may
be easier to extract cleanly than the PDF. **Transcribe the content; do not
rewrite it.** These are the product's own words and the teacher recognises them.

---

## The traps specific to M5

### 1. "with bilingual content" in your scope line is superseded — do not author English

Your delivery line says the letters and message bank come "with bilingual
content". **That is overridden by a later product-owner decision** recorded in
the spec's Resolved table: *"Greek-only through M1–M8; the English translation
happens in one dedicated pass at M9"* (2026-09-19). A second Resolved row says
the English translation of the message bank and letters will be a
**machine-translated draft**, authored at M9.

So: **ship Greek only**, structured so that M9 is *adding one file*, not editing
yours. Say in the PR that you read the conflict this way, because it is a direct
contradiction between two parts of the spec and the next agent should not have to
re-derive which one wins.

### 2. Where 150 messages and 7 letters actually live — decide and record

This is the biggest structural decision in M5 and the spec does not answer it.

The constraint is hard: **eslint fails the build on a Greek literal anywhere
under `src/` outside `src/i18n/`.** That rule is load-bearing; do not weaken it,
do not add an exemption. So the letter and message content must live under
`src/i18n/` — but dropping 150 messages and 7 multi-paragraph letters into
`src/i18n/el.ts` beside the UI strings would roughly triple that file and mix two
very different kinds of content.

Decide, ship it, and record it. A defensible shape is a separate module under
`src/i18n/` (say `src/i18n/letters.ts` and `src/i18n/messages.ts`) with the same
single-lookup discipline the UI strings have, so M9 adds `letters.en.ts` and
nothing else changes. **Whatever you choose, the test is: can M9 add English by
adding files?** If not, choose again.

### 3. The eighth tab — the app has no home for this module

`src/App.tsx` has **eight top-level sections** (Έτος, Τάξεις, Μαθητές, Βαθμοί,
Πρόγραμμα, Πλάνο, Ατζέντα, Σημερινό) and
`tests/component/App.test.tsx` **pins that list exactly** in a test named
*"keeps eight top-level sections after M4"*. M4 deliberately added four surfaces
as *sub-pages* rather than tabs, and recorded that as a decision.

**M5's module has no existing home.** The source product's own navigation has
**ΓΟΝΕΙΣ** and **ΟΜΑΔΑ** as separate top-level items, which argues for adding at
least one tab. That is a real decision, not an oversight:

- adding a `Γονείς` tab makes nine, and you must update that test *deliberately*,
  renaming it and saying in the comment why the number moved;
- whether **ΟΜΑΔΑ** (staff meetings) is its own tab or a sub-page under Γονείς is
  also yours — the spec files meetings under module 5 with the parent surfaces,
  but the source product separates them.

Follow M4's precedent for the *shape* of the answer: sub-pages inside a section,
with the top row kept as small as the spec allows. Record the call in the spec's
Resolved table either way.

### 4. A letter is not a table — the print contract needs extending, not bypassing

`src/print/document.ts` is currently table-centric: a `PrintDocument` is a title,
a `meta` row, one `PrintTable`, optional `boxes`, a note and a footer. **A letter
is prose with filled fields and a reply slip. Two of them are 2-up certificates.**

So you will be the first milestone to extend the document contract. Do that
rather than writing a second renderer:

- keep `renderPrintDocument()` as the single way HTML is produced, and keep the
  rule that **the app paginates, not the engine** (`src/print/paginate.ts`) —
  that is a Resolved decision forced by what the two platforms do;
- **`A4_WIDTH`, `A4_HEIGHT` and `PAGE_MARGIN` in `document.ts` are pinned to
  `src-tauri/src/pdf.rs` by a test.** Do not change one without the other;
- keep the two load-bearing stylesheet properties: a font stack with full Greek
  coverage, and **no external resource of any kind**;
- `paginate()` currently measures table rows. Prose blocks and a 2-up certificate
  page are a different measuring problem. If you need to teach it new block
  types, do so — but do not hand pagination back to the renderer.

**Do not try `printOperationWithPrintInfo:` on macOS.** M2 burned a milestone on
it: it returns a zero-sized print view and emits blank pages indefinitely (a
220MB file of empty pages). `createPDFWithConfiguration:` plus app-side
pagination on macOS, `PrintToPdf` on Windows. That is settled.

### 5. The booking and the record are independent — same discipline as M4

The spec says the appointment grid is "independent of the log above (a booking vs
a record of what happened)", and M5's second acceptance criterion is that an
appointment and a contact-log entry **for the same guardian and date coexist
independently**.

This is structurally identical to M4's attendance-grid-vs-absence-register pair,
and M4.5 proved the way to hold it. Copy that discipline:

- two tables, no shared key beyond `(student, guardian)`, no trigger, no view, no
  foreign key between them;
- separate commands; no call that writes both;
- selectors in `src/domain/` that read one array and never the other;
- and test it as **insensitivity**, not as a number: push a pile of rows into one
  register and assert the other's document/selector output compares *equal*.
  `tests/unit/printRegisters.test.ts` is the worked example. **Confirm each such
  test fails against deliberately broken code before you trust it** — M4.5 did,
  and it is the only way to know the test bites.

### 6. No placeholder may survive into a PDF

M5's first acceptance criterion says every placeholder is filled and **none is
left as `[BRACKETS]`**. That is testable without a webview, because the document
builders are pure: assert the generated HTML contains no unreplaced placeholder
token, for **all 7 letters and a sample across all 15 message categories**.
Write that test so it scans rather than spot-checks — a regex for your
placeholder syntax over the whole document, asserted empty.

### 7. "Today" is an argument, not a global

The shell is the single place that reads the calendar: `App` takes an optional
`today` prop, re-checks every minute, and passes the day down. **Do not reach for
`new Date()` or `todayIso()` inside a component.** M4.5 removed the last
violation (M2's export button) and made `src/App.tsx`'s doc comment true again —
do not reintroduce one.

This matters for you specifically: the **upcoming-overview panel** is "due in the
next 7 days", which is a function of today. Put that window in a pure selector in
`src/domain/` taking `today` as an argument, not in the screen.
`tests/helpers/mount.tsx`'s `renderScreen` takes extra props for exactly this.

### 8. Keep the message bank's "copy text" — the precedent exists

The spec asks for a one-click copy-to-clipboard alongside PDF generation for
messages. M4 already built this shape for the timetable
(`Αντιγραφή ως κείμενο`, `timetableAsText()`, plus `timetable.copied` /
`timetable.copyFailed` strings). Follow it rather than inventing a new pattern,
including the failure message — clipboard access can refuse.

---

## What is already built, and must be reused rather than reinvented

- **`src/components/ExportButton.tsx`** — the shared export button, lifted out of
  `GradesScreen` at M4.5. Takes `{ labelId, fileName, html: () => string,
  landscape }` and owns the busy / written / failed states. `html` is a thunk so
  a big document is built when asked for, not on every render. **Use it; do not
  write a fifth copy.**
- **`src/print/document.ts`** — `PrintDocument` / `PrintTable` / `PrintCell` /
  `PrintBox`, `renderPrintDocument(doc, landscape)`, the A4 constants, and
  `PrintCell.width` / `PrintDocument.dense` which M4.5 added.
- **`src/print/paginate.ts`** — `paginate()`, the app-owned page breaking.
- **`src/print/sheetParts.ts`** — `printFooter()`, `tickText()`, `boxLine()`,
  shared by every sheet so one cannot drift from another.
- **Four worked sheet examples** — `gradeSheets.ts` (M2), `behaviourSheet.ts`,
  `attendanceSheets.ts`, `supportSheet.ts` (M4.5). All pure functions of
  `(t, planner, …, today)` returning a `PrintDocument`. Copy that shape.
- **`src/print/PrintHost.tsx`** and the `print_job` / `print_ready` commands —
  the hidden window. You should not need to touch this; if you think you do, stop
  and explain why in the PR.
- **`api.exportPdf(fileName, html, landscape)`** — writes one document into
  `exports/` and resolves with its path.
- **The print self-test hook** — set `TEACHER_PLANNER_PRINT_SELFTEST_HTML` and
  `TEACHER_PLANNER_PRINT_SELFTEST_PDF` (and optionally
  `…_PORTRAIT`) and the packaged app renders that HTML to that path and exits.
  It drives the *same* export path a button does and is how every PDF-rendering
  claim on this project has been evidenced. **Use it. Note that letters are
  likely portrait**, unlike every sheet so far — that flag exists for you.
- **`filteredIncidents()` in `src/domain/behaviour.ts`** — the M4.5 precedent
  that a screen and its printed sheet call **one** selector, so they cannot
  disagree. Do the same wherever a printed letter reflects what is on screen.

---

## Hard rules on this project — not negotiable, and enforced

1. **No Greek literal in a component.** Every user-facing string is an id in
   `src/i18n/el.ts`, read through `useTranslate()`. eslint fails the build on a
   Greek literal anywhere under `src/` outside `src/i18n/`. This applies to
   printed output exactly as it applies to screens.
2. **Every fixed vocabulary is a stable code labelled through
   `vocab.<kind>.<code>`**, and **the code is what the database stores**. A
   printed page prints the *label*. `displayValue()` in `gradeSheets.ts` is the
   worked example. Expect new vocabularies here: contact format, appointment
   mode, appointment status, meeting type.
3. **The app formats every date it displays or prints itself** — `dd.MM.yyyy`
   via `formatDate()` in `src/domain/dates.ts`, independent of OS locale.
   Numbers use a dot decimal separator, also app-formatted.
4. **Teacher-entered text is never translated** and prints exactly as typed.
5. **Keep arithmetic and layout rules out of screens** — they go in
   `src/domain/` (pure selectors over the loaded planner) or `src/print/`.
   Screens take `{ planner, run }` plus whatever else they need as props.
6. **Schema changes are forward migrations** (`migrate_to_<n>`, never edit an
   earlier step). M4.5 left the schema at **`user_version = 5`**, so you are
   writing `migrate_to_6`. A data file from any previously shipped build must
   climb.
7. **A create-then-edit flow tested only from an empty fixture is not tested.**
   The `Νέο τμήμα` data-loss bug at M1 survived 64 component tests for this
   reason. Every "new record" button gets a test starting from a planner that
   already has a record of that kind selected, plus one asserting the siblings
   come back byte-for-byte unchanged. M5 has several such buttons.

---

## What M4.5 left you

- **Schema at `user_version = 5`**, five M4 tables plus M0–M3's.
- **Four printed sheets** and the extended document contract described above.
- **`src/components/ExportButton.tsx`**, shared, taking the day as a prop.
- **Baseline so you notice a regression: 354 frontend tests and 78 Rust tests
  pass**, and `cargo fmt --check`, `clippy -D warnings` and eslint are clean.
- **Fixtures worth reusing**: `tests/helpers/supportFixture.ts` (a deliberately
  asymmetric planner with hand-computed expectations) and
  `tests/helpers/gradebookFixture.ts`. M5 will want its own; build it the same
  way — asymmetric, with the awkward case in it on purpose.
- **Open questions that are the product owner's, not yours.** Do not answer
  these; they are recorded in the spec's Open section: whether the conduct sheet
  should print with the grade sheet (M2), whether the absence register's
  per-event notes belong in page-level boxes or columns (M4.5), whether the
  incident register should gain a page-level notes field (M4.5), the absence
  register's kinds, and the Feb–Dec year-model question.

---

## Acceptance criteria for M5

These are in `docs/REBUILD_SPEC.md` under "Acceptance criteria per milestone".
Quote them in your release note with the evidence:

- All 7 letters and a sample across all 15 message-bank categories generate a
  correctly-formatted, Greek-rendering PDF with every placeholder filled and
  none left as `[BRACKETS]`.
- A parent appointment and a parent-contact-log entry for the same guardian/date
  coexist independently.
- The upcoming-overview panel correctly surfaces both appointments and meetings
  due in the next 7 days on a test dataset.

**Note the first one honestly.** "Greek-rendering PDF" needs a real PDF from a
real build. If you cannot produce one, say the criterion is **partly met — HTML
verified, PDF not produced** and hand it back. Do not restate it as something
you did do.

---

## Process

- **Branch `m5-parents-staff`. One PR. No merge on failing CI.**
- A dated release note in `docs/milestones/` from `TEMPLATE.md`, recording the
  real result of **every** gate step including the ones you could not perform,
  and attributing each to the machine and to agent-or-human. Be exact about
  verified versus assumed.
- Anything the spec leaves genuinely open: **deliver something defensible, state
  the assumption plainly, and ask in the PR description.** Resolved calls get
  recorded in the spec's Resolved table; open ones go in its Open section. Do not
  silently decide, and do not reopen what is already settled.

### CI minutes are tight — plan your pushes

The account has 3000 GitHub Actions minutes a month and roughly **2300 are
spent** after M4.5. macOS runners bill at ×10 and Windows at ×2, so the two-OS
matrix costs about **104 billed minutes per run** — call it **six runs of
headroom**. A cancelled run still bills for what it used, and pushing to an open
PR cancels and restarts the matrix.

So: **run everything you can locally before you push, push once when it is
actually ready, and batch fixes.** Three things earlier milestones paid for:

- **The workflow has no path filter, so a docs-only push costs a full matrix.**
  Put `[skip ci]` in the commit message for a commit touching only `docs/`.
- **But `[skip ci]` on the *branch head* suppresses the PR's CI entirely** — M4
  hit this and M4.5 hit it again. Either keep the docs commit off the head, or
  trigger the run explicitly: `gh workflow run "CI" --ref m5-parents-staff`.
- If you think a `paths-ignore` for `docs/**` is right, or that typecheck, lint
  and the frontend tests should run once on `ubuntu-latest` at ×1 with macOS and
  Windows reserved for the Rust build and packaging — **propose it in the PR
  rather than changing the workflow**, because it changes what the gate proves.
  M3 proposed it, M4 seconded, M4.5 thirded. You may fourth it. Do not implement
  it unilaterally.

---

## What still needs a human, and what no longer does

**Good news, and it is new: at the M4.5 gate the product owner performed every
outstanding human item**, several of which had been open since M0–M2. Do not
repeat the old boilerplate saying they are outstanding — check the M4.5 note and
report the current position.

Closed at M4.5, by the product owner on 2026-09-22:

- **the printed output was looked at**, on both the macOS- and Windows-rendered
  sets;
- **a genuine Explorer double-click**, on a Mark-of-the-Web-tagged unsigned
  installer, **hit SmartScreen** — confirming the carried risk a second time;
- **the Google Drive online-only placeholder case passed**, closing a risk
  carried since M0 and marked un-runnable at three previous gates;
- **the packaged app's screens were driven by hand end to end**, including all
  four M4.5 export buttons on real data, with no defect found. This had been
  outstanding since M2 and was the first time anyone had seen the packaged UI.

**Still needs a human, and you should ask for it:**

- **The typing pass on Windows.** M4.5's was done on macOS. The logic is
  platform-independent but layout is not — the same month card wrapped a student
  name on Windows and not on macOS. For M5 this matters more than usual: **you
  are building long-form prose documents**, where line breaking, reply slips and
  2-up certificates differ most between the two engines.
- **Looking at your own output.** Nobody can tell you whether a letter looks
  right except a person holding it. For M5, list exactly what to look at: does a
  reply slip land at the foot of the page or orphan onto a second; do the two
  certificates sit 2-up correctly; does a long Greek name break the letterhead.

### One hazard that nearly faked a bug at M4.5 — read this before any manual pass

**A stale build with the same bundle identifier silently shadows the one under
test.** Every build declares `CFBundleIdentifier` `gr.atzenta.teacher-planner`,
so on macOS double-clicking a copy while another is running activates the
running one. At M4.5 this made a double-click of the new build open the **M0**
build, reported as a bug against the milestone before it was traced.
LaunchServices had accumulated **~30 registrations for that one identifier** from
this project's own testing.

Before any manual pass: **check the app's own `Schema version` line against the
milestone's `user_version`** — yours will be **6**. It is the cheapest possible
proof that the window in front of you is the build under test. The full detail,
including the `lsregister` commands, is in `docs/MILESTONE_PROMPT.md`.

---

## Finishing

Do not start M6 until M5 passes its full gate — or, if you could not run part of
that gate, until the person who can has run it and signed off. Say which of those
two situations you are leaving behind.
