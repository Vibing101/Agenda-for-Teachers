# M7 — Print forms & substitute folder

> **Archived evidence (added 2026-09-24).** This repository's history was
> rewritten on 2026-09-24 to remove the third-party source package before it was
> made public. The pull requests, CI runs and commit hashes this note cites
> belong to the pre-rewrite repository, kept private as
> `Vibing101/Agenda-for-Teachers-archive`: links to them will not resolve here,
> and the hashes differ from this repository's. The note is otherwise left as
> it was written.

**Date:** 2026-09-24
**Branch:** `m7-print-forms`
**Signed off by:** Product owner, 2026-09-24 — squash-merged to `main` as
`dfac8f6` (pre-rewrite hash). The merge's tree hash was
`ee0dc093b0ecbbe52a815c0a8dd453d6229f2c73`, identical to the branch head's, so
the squash lost nothing; the branch was deleted in the same step. **Signed off
with the Windows half of the gate still unperformed** (see below) — it remains
outstanding against this milestone.

**The Windows half of this gate was not run locally, and this note says so
everywhere it matters.** The `MilestoneTesting` VM went through a Windows Update
during this milestone ("Installing 42% … your computer may restart a few
times"), came back to the desktop, and **its sshd never answered again**: the
port forward accepts the connection and the guest never sends a banner. Someone
was using the VM's desktop at the time, so nothing was done to it from the
Mac. Windows steps 1–4 are covered **by CI** (typecheck, lint, both test suites,
the packaged build, a smoke launch and a backup check on `windows-latest`), not
by an agent in the VM. **Windows step 5 and the Windows page count of the
folder PDF were not performed** — see "What still needs a human" for the
one-command way to produce them.

Worked on **the dev Mac** (`uname -s` = `Darwin`, `VBoxManage list vms` lists
`MilestoneTesting`). macOS 26.6.2 on x86_64, Node 24.15.0, Rust 1.98.1. Every
result below says which machine produced it and whether an agent or a human
produced it.

## What shipped

**Two opposite things, built apart on purpose.**

- **The eleven standalone print forms** (spec module 8), in a new top-level
  section **`Πρότυπα`**: *Απουσίες του μήνα, Επικοινωνία με γονείς, Πλάνο
  αναπλήρωσης, Πρακτικό συνεδρίασης, Προτεραιότητες της εβδομάδας, Πλάνο
  αίθουσας, Κωδικοί και πρόσβαση, Λίστα ελέγχου της περιόδου, Σημείωμα προς
  γονείς, Δανεισμοί υλικού και βοηθημάτων, Στόχοι και επαγγελματική ανάπτυξη*.
  Each can be printed **blank** (the source's own use) or created as a **named,
  saved copy** that is filled on screen, reopened from a list, edited again and
  exported. Every box saves as the teacher leaves it. Portrait A4, one form per
  sheet, as the source.
- **The substitute folder** (spec module 6), as **Τάξεις → Φάκελος
  αναπλήρωσης**: per class, a cover and the source's five pages — *Πληροφορίες
  τμήματος, Πλάνο εβδομάδας, Πλάνο αίθουσας, Πλάνο μιας μέρας, Επαφές και
  διαδικασίες* — exported as **one landscape PDF of six pages**. The class's
  details, its roster count, the students who need attention, the week's hours
  and plan, and the seating are all **read live**; only the folder's own words
  are stored.

**And the machinery both needed:**

- **One PDF can now carry several documents.** `renderPrintBundle()` emits
  several sheets under one stylesheet and `paginate()` cuts each onto pages of
  its own, in order. **The Rust side did not change.**
- **The document contract gained** header blocks (captioned fields above a
  ruled table, repeated per page), side-by-side areas, a desk grid, a drawn-tick
  checklist, label/value pairs, and framed cards (dashed for the parent note's
  cut line).
- **The first save → reopen → re-edit flow for filled document state**, shaped
  so a parent letter could join it without a migration (see Open questions).

**Schema climbs to `user_version = 8`** — four tables, purely additive:
`print_form`, `print_form_value`, `substitute_text`, `substitute_school_text`.
**The top row goes from nine to ten** (`Πρότυπα`), and `Τάξεις` gains its first
sub-pages (*Τμήματα / Φάκελος αναπλήρωσης*).

**One M5 defect found and fixed on the way** — see "A defect found in M5's
certificates".

## The central risk, and how it is held

The brief's warning was that M7's two halves are opposite patterns and four
milestones of momentum push toward deriving everything. So:

**A print form reads nothing.** `print_form` / `print_form_value` have no
column that links to a class, student or seat, and a Rust test checks their
foreign keys point only at each other. `formDocument(t, definition, values,
today)` is **never handed the planner** — there is no path from a real class to
a printed form. `FormsScreen.test.tsx` exports the blank and the filled *Πλάνο
αίθουσας* next to a planner full of real seats and asserts none of those names
reaches either file; a mutation that fed the seats in was caught. The four
forms that *look* like live surfaces the app already has —

| Form | Looks like | Is |
|---|---|---|
| *Απουσίες του μήνα* | M4.5's printed month card | a blank card with no class behind it |
| *Επικοινωνία με γονείς* | M5's stored log | a blank log |
| *Πλάνο αίθουσας* | M1's seating — and the folder's | a blank room with desks to write names on |
| *Πρακτικό συνεδρίασης* | M5's meetings | a blank form; **not** an answer to M5's "should minutes print?" |

— all read nothing. *Στόχοι και επαγγελματική ανάπτυξη* is neither M1's six
annual-goal areas nor M8's development goals.

**The folder stores nothing it shows from elsewhere.** `substituteFolder(planner,
classId, today)` is a pure function called on every render and at export, and a
Rust test walks every M7 column asserting none could hold a student, a desk or a
week. `Πλάνο αίθουσας` therefore exists twice in this milestone, as two
different artefacts, on purpose — recorded in the spec's Resolved table.

## Acceptance criteria for this milestone

Quoted from `docs/ENGINEERING.md` as written.

| Criterion | Result | Evidence |
|---|---|---|
| **All 11 print forms can be filled, saved under a custom name, reopened, and re-edited.** | **Pass** (agent, both OSes' test runs via CI; locally on the Mac) | `tests/component/FormsScreen.test.tsx` runs **one test per form, all eleven**, through the real screen: from a planner that **already holds three saved forms**, pick the form, *Νέο έντυπο*, type a name, fill a representative input (a register cell, a box, a desk, a tick or a field inside a repeated card — every kind of part is covered across the eleven), then **tear the screen down and mount it again from what the backend stored** (a relaunch, not a re-render), pick the saved copy by its name, find the value, change it, and find the change stored — with the name intact and the three pre-existing forms byte-for-byte unchanged at every step. At the storage layer, `a_print_form_is_saved_under_its_name_reopened_and_re_edited` does the same across a real file closed and reopened, and `cloud_folder.rs` carries a saved form through a quit and relaunch. **The create-then-edit case**: a saved room plan is explicitly opened, *Νέο έντυπο* is pressed, and everything typed next lands in the new form while the old one does not change by a byte |
| **The substitute folder's seating plan reflects a live edit made in the Classes module without needing regeneration — i.e. it reads live data, it isn't a stale copy.** | **Pass** (agent) | **Tested as liveness, not as a snapshot compare.** `SubstituteScreen.test.tsx` mounts the **real app**: opens the folder (Ελένη at desk 1·1), goes to *Τάξεις → Τμήματα*, moves Νίκος into that seat through the real seating select, returns to the folder — which already shows Νίκος — and asserts **the only backend traffic between the edit and the folder showing it was `save_seating` and the shell's routine `status` check**: no folder command, no reload, no rebuild. It then exports and finds Νίκος at that desk in the PDF's HTML. By construction there is nothing to regenerate: `folderSeating()` reads `planner.seats` each call, and no M7 table has a column that could hold a seat (Rust test). **Two "stale copy" designs were planted and both failed it**: a module-level cache of the seating, and a screen that stores a snapshot of the seating the first time the folder is opened |
| **The substitute folder exports as one combined multi-page PDF, not 5 separate files.** | **Pass on macOS (agent, from a real file); Windows not performed** | **One export call, one file, six pages** — the source's cover plus its five. From the **packaged universal build**, via the print self-test (the export button's own path): `pdfinfo` → `Pages: 6`, `841 x 595 pts (A4)`, fonts embedded (`HelveticaNeue` subsets); each page's first line is its own document's title, in order. Written into `exports/` **inside live Google Drive and OneDrive folders** as part of step 5, six pages in both. An empty class's folder is also six pages. Tests: the folder screen makes exactly one `export_pdf` call whose HTML carries six sheets under one stylesheet; `paginate.test.ts` checks six documents become six pages in order, that a document which runs over still leaves the next starting on a fresh page, and that no sheet is left unpaginated. **Windows**: not measured — see "What still needs a human". The machinery was proven early on macOS (a synthetic five-document bundle → 5 pages, one per document) before the folder's pages were built; WebView2 breaks at the same `.page` blocks it has broken at since M2, but no Windows file exists to prove it for a bundle |

## Confirming the tests fail against broken code

Budgeted for, and done. **Thirteen deliberate mutations; every one caught, by
the test aimed at it.**

| Mutation | Caught by |
|---|---|
| *Νέο έντυπο* stops selecting the form it made (M1's `Νέο τμήμα` shape) | `moves to the new form it made…` — **but only after the test was strengthened**: its first version never selected the old form explicitly, so the fallback (newest first) hid the defect. Caught before any mutation ran, by reading it |
| The folder caches its seating per class | 4 tests, including **the liveness criterion test** |
| The folder stores a snapshot of the seating when first opened (the "regenerate" design) | **the liveness criterion test** |
| The folder shows last week's plan | 5 tests |
| `paginate()` only paginates the first sheet | 3 tests |
| The folder exports one page instead of the bundle | 4 tests, including **the one-file criterion test** |
| A cleared box is stored as "no row" (fake backend) | the cleared-vs-untouched screen test |
| A cleared box reads as the suggestion | 4 tests |
| Pages lose their sheet's classes — **the pre-M7 paginator** | the certificate regression test, and the dense-sheet test |
| The blank room plan is fed the real seats | `never prints a real class's seats…` |
| **Rust:** saving a form's head rewrites its values | `saving_a_forms_head_never_rewrites_its_values` |
| **Rust:** a cleared folder text is deleted rather than stored | `a_cleared_folder_text_is_stored_and_differs_from_an_untouched_one` |

**One honest limit.** The "a rename rewrites the values" mutation, applied to
the fake backend, **survived** the screen tests: the fake answers synchronously,
so the in-flight race it guards against cannot happen in jsdom. That property is
held where it can be tested — the Rust store — and the Rust mutation was caught.

## Decisions taken

All recorded in the spec's Resolved table.

| Decision | Call taken | Why |
|---|---|---|
| **Print forms vs. the substitute folder** | **Opposites**: a form reads nothing; the folder stores nothing it shows from elsewhere | Module 8 says the forms are "independent of the modules above"; module 6 says the folder is "generated per class from live data" with seating "shared live, not copied". See above |
| **Where they live** | **`Πρότυπα`, one new top-level section, for the forms; *Τάξεις → Φάκελος αναπλήρωσης* for the folder.** Ten tabs | The folder is made of a class, so it goes where the class is (M4/M6 shape). The forms belong to nothing (M5's situation) and take one tab, named with the source's own word. One shared "print" tab would have cost the same place and put a live seating plan next to a blank one. `App.test.tsx` is renamed and says why |
| **How a filled form is stored** | A head plus one row per filled field, **written by different commands**; an emptied field is removed; `kind` checked in Rust, no `CHECK` | So a rename cannot write back stale values, and so a letter could join as one more kind with no migration |
| **"Prefilled once and stays independently editable"** | **No row = untouched (the suggestion shows and prints); a row = hers, including an empty row = cleared; *Επαναφορά* deletes the row.** The suggestion is never copied into the file | "She cleared it" must stay distinguishable from "she has not touched it". An untouched box follows the UI language at M9; what she typed never changes |
| **The folder's "current week"** | This week — **the coming week on a Saturday or Sunday** | The folder is for the morning she does not come in |
| **The folder's contacts and procedures** | **School-wide, typed once for every class**; *Υπεύθυνος τμήματος* is the class card's own field, looked up | "Not a separate data-entry chore" |
| **The attention box** | Live and verbatim from the cards — SEN category, the class's support note, allergies, conditions, medication — then her own note | The three signals M4's overview merges plus the health fields a substitute needs. **Raised as a privacy question** |
| **The week page** | The master timetable's hours × Monday–Friday (Saturday only if the class meets then), **only this class's lessons**, in the room the timetable says; the week's plan and assessment beneath | The source's `Ώρα × Δευτέρα–Παρασκευή`. The folder is the class's, so the teacher's other classes are left out |
| **A register form's rows** | The source page's own count, **extendable**; extra rows run onto a second sheet with the header repeated | The spec forbids caps; the source's sheet is one page |
| **`ΕΙΔΟΣ ΣΥΝΕΔΡΙΑΣΗΣ`** | Free text | M6's rule: the field is a blank box; the subtitle's three examples are not a vocabulary |
| **Content vs. labels** | **A fourth bundle file, `src/i18n/formsEl.ts`**: the checklist's sixteen items (transcribed) and the folder's suggestions (the app's own wording). Every caption in `el.ts` | M5's split-by-kind rule |
| **Three subtitles** | **All eleven forms have one** | The brief lists *Επικοινωνία με γονείς*, *Πλάνο αναπλήρωσης* and *Στόχοι…* as having none; the source pages print one each. Recorded because the brief is wrong |
| **The parent note** | **Genuinely two-up**, each note in a dashed frame | The source says so; rendered and looked at anyway, per M5's lesson |
| **A tick on the checklist** | A **drawn** circle, filled when ticked — never a glyph | M4.5's rule: a check mark is not in every face that carries Greek |

### What the source pages actually say

Quoted, because `reference/` will not exist to be checked later.

- The forms' front matter: *"Συμπληρώστε τα στην οθόνη ή τυπώστε τα και έχετε
  τα πρόχειρα. Κάθε πρότυπο σε ξεχωριστή σελίδα A4."* — all twelve pages are
  portrait A4.
- The parent note: *"Δύο σημειώματα ανά σελίδα · κόψτε κατά μήκος της
  γραμμής"*, and two framed notes each with `ΜΑΘΗΤΗΣ`, `ΗΜΕΡΟΜΗΝΙΑ`,
  `ΠΕΡΙΕΧΟΜΕΝΟ`, `ΥΠΟΓΡΑΦΗ ΕΚΠΑΙΔΕΥΤΙΚΟΥ`, `ΥΠΟΓΡΑΦΗ ΓΟΝΕΑ`.
- The room plan: `ΤΜΗΜΑ / ΜΑΘΗΜΑ / ΗΜΕΡΟΜΗΝΙΑ`, a `ΠΙΝΑΚΑΣ` bar, and a grid of
  **six desks across and five deep**.
- The checklist: eight items under `ΑΡΧΗ ΤΗΣ ΠΕΡΙΟΔΟΥ` and eight under `ΤΕΛΟΣ ΤΗΣ
  ΠΕΡΙΟΔΟΥ` (transcribed into `formsEl.ts`), then `ΣΗΜΕΙΩΣΕΙΣ`.
- The folder: a cover — *"Αφήστε τον συμπληρωμένο στο συρτάρι. Όταν αρρωστήσετε,
  κανείς δεν θα σας πάρει τηλέφωνο με ερωτήσεις."* — and five **landscape**
  pages. *Πληροφορίες τμήματος*: `ΤΜΗΜΑ / ΜΑΘΗΜΑ / ΑΙΘΟΥΣΑ / ΑΡΙΘΜΟΣ ΜΑΘΗΤΩΝ /
  ΥΠΕΥΘΥΝΟΣ` over four boxes (`ΚΑΝΟΝΕΣ ΚΑΙ ΣΥΝΗΘΕΙΕΣ ΤΗΣ ΤΑΞΗΣ`, `ΜΑΘΗΤΕΣ ΠΟΥ
  ΧΡΕΙΑΖΟΝΤΑΙ ΠΡΟΣΟΧΗ`, `ΥΛΙΚΑ ΚΑΙ ΒΟΗΘΗΜΑΤΑ — ΠΟΥ ΒΡΙΣΚΟΝΤΑΙ`, `ΤΙ ΝΑ ΚΑΝΕΤΕ ΣΕ
  ΠΕΡΙΠΤΩΣΗ ΠΡΟΒΛΗΜΑΤΟΣ`); *Πλάνο εβδομάδας*: `Ώρα | Δευτέρα … Παρασκευή`;
  *Πλάνο αίθουσας*: the desk grid and `ΣΗΜΕΙΩΣΕΙΣ ΓΙΑ ΤΗ ΔΙΑΤΑΞΗ`; *Πλάνο μιας
  μέρας*: `ΗΜΕΡΟΜΗΝΙΑ / ΣΤΟΧΟΣ ΤΗΣ ΜΕΡΑΣ` over `Ώρα | Προγραμματισμένες
  δραστηριότητες | Σημειώσεις / υλικά`; *Επαφές και διαδικασίες*: six contacts
  (Διευθυντής, Υποδιευθυντής, Γραμματεία, Υπεύθυνος τμήματος, Ψυχολόγος /
  κοινωνικός λειτουργός, Φαρμακείο και πρώτες βοήθειες), six procedures
  (Έξοδοι στην τουαλέτα, Εκκένωση και συναγερμός, Κινητά και συσκευές,
  Διαλείμματα και εφημερίες, Καθυστερήσεις και απουσίες, Τέλος του μαθήματος),
  and `ΜΗΝΥΜΑ ΓΙΑ ΤΟΝ ΑΝΑΠΛΗΡΩΤΗ`. **Every box on every source page is blank** —
  which is why the folder's suggested text had to be written, not transcribed.

## Rendering, and what looking at it changed

Every form (blank and harshly filled) and both fixture folders were rendered
through the real export path and **looked at**, and the first render was badly
wrong: **every form spilled onto a second page.** The cause is worth knowing: the
print window lays A4 out in CSS pixels one-to-one with PDF points, so **a CSS
millimetre prints at about 1.33mm**, and a portrait sheet has about **207 CSS mm**
of height (landscape about 142), not 277. Every box, desk and row was
re-budgeted against that. Also found only by looking: WebKit adds a cell's
padding *on top of* its `height`; `Ημερομηνία` breaking mid-word in its header;
two-digit day numbers breaking in two on the 31-day card; an 11% `Μορφή` column
wrapping one word.

**Final, from the packaged universal build:** all eleven blank forms are **one
A4 portrait page**; the parent note is two cut-out notes on one sheet; the
31-day card holds thirty rows on one sheet; the folder is **six landscape
pages** for a full class and for an empty one. Two filled registers
(*Επικοινωνία*, *Δανεισμοί*) run to a second page when nearly every row carries a
long entry — correct behaviour, header repeated; their blanks are one page.

## A defect found in M5's certificates

**The two award certificates have been printing without their frame since M5.**
The stylesheet frames a certificate as `.certificate .page-inner`, but the
element carrying `certificate` was the sheet, which the paginator removes after
cutting it into pages — so the rule matched nothing, and the certificate came
out as plain text with an ordinary-sized title. Nobody had looked at a printed
letter, which is the outstanding human item that would have caught it. Found
while making the paginator walk several sheets; **a sheet's classes now travel
onto its pages**, and the award renders inside its frame at certificate size
(rendered and looked at). A regression test was confirmed to fail against the
old paginator.

## Open questions for the product owner

All in the spec's Open section.

1. **Should *Κωδικοί και πρόσβαση* be fillable in the app at all?** Built like
   the other ten, as the spec asks — but what goes in it is passwords, stored
   **unencrypted** in the data file, in the cloud folder and in every backup.
   The form carries an on-screen warning saying exactly that. Alternatives:
   blank-only, or encryption (well beyond a form).
2. **Should the folder print students' health and support notes?** It lists
   each student's SEN category, support note, allergies, conditions and
   medication — what that box is for, and what a substitute most needs — on a
   sheet meant to be left in a drawer. Alternatives: health only, or a blank box.
3. **The folder's suggested text is the app's own Greek.** The source's boxes are
   blank. It is short and generic, but a Greek-speaking teacher should read it
   before a teacher does (`src/i18n/formsEl.ts`).
4. **Should a filled letter join the saved forms?** Still yours (M5's question).
   **What it costs now: no migration.** A letter is already a key → value map;
   it would be seven more `kind` codes and the letters screen gaining the saved
   list, *Νέο* button and per-field saving. It would also settle M6's "should a
   trip fill in the consent letter?".
5. **The conduct sheet with the grade sheet** (M2's question) **is now one call**:
   both are landscape and `renderPrintBundle()` exists. Still yours.
6. **Should the folder's contacts come from M8's staff directory** once it exists?
7. **Meeting minutes** (M5's question) are **not** answered by the blank
   *Πρακτικό συνεδρίασης* form, which reads no stored meeting.

**Carried, untouched, and not M7's:** the six resource categories, whether M1's
annual goals print, whether M6's surfaces print, an exam's `Βαρύτητα`,
page-level boxes at volume, the absence register's kinds, and the Feb–Dec year
model.

## Gate results (docs/ENGINEERING.md)

| # | Step | Result |
|---|---|---|
| 1 | Typecheck clean | **macOS: pass, by agent** at `0914f17`. **Windows: CI only** — not run in the VM (unreachable) |
| 2 | Lint clean | **macOS: pass, by agent** — eslint including the no-inline-Greek rule, `cargo fmt --all --check`, `cargo clippy --all-targets -- -D warnings`. **Windows: CI only** |
| 3 | Automated tests pass | **macOS: pass, by agent** — **594 frontend tests** (was 527) and **105 Rust tests** (was 95). **Windows: CI only** |
| 3b | Persistence round-trip | **Pass, extended** — `cloud_folder.rs` writes a saved form with two values and the folder's texts in all three states (written, cleared, untouched), quits, relaunches, asserts each — **the cleared one still an empty row** — then moves the school year's start date and asserts all three M7 arrays compare equal. And `db.rs` gains **the M6-era climb test**: a `user_version = 7` file with a seat, a lesson plan and a row in every M6 table climbs to 8 with every row intact and the seat neither moved nor copied |
| 4 | Packaged build on Windows and macOS, structurally verified | **macOS: pass, by agent** — `npm run tauri build --target universal-apple-darwin` at `0914f17`: `Teacher Planner.app` (binary 9,814,928 bytes), `.dmg` 4,685,739 bytes, `lipo -archs` → `x86_64 arm64`, `CFBundleIdentifier` `gr.atzenta.teacher-planner`; launched and driven (step 5). **Windows: CI only** (`npm run tauri build` and its smoke launch on `windows-latest`); **not built in the VM** |
| 5 | Manual launch test from inside a cloud-synced folder, both OSes | **macOS: pass, by agent. Windows: not performed.** Launches were programmatic, not human double-clicks |
| 6 | This release note | **Pass** |

### What step 5 covered on macOS (by agent)

The universal `.app` was copied into `Atzenta M7 mac` inside live **Google
Drive** and live **OneDrive** (paths resolved with `pwd -P`, per M6's lesson)
and launched with `open -a`. In **both**:

- it started and **stayed** running, created `data/` and wrote `planner.sqlite`
  at **`user_version = 8`**, `integrity_check` → `ok`, with **all four M7
  tables** present;
- it survived a quit **verified by PID** and a relaunch with the database
  **byte-identical** (SHA-256 unchanged), and the relaunch wrote a dated
  snapshot (`0 → 1`; the first launch has no file yet to back up);
- **no `-wal`/`-shm` sidecars**;
- **the folder PDF and the parent-note PDF were written into `exports/` inside
  the synced folder** by the packaged binary: **6 pages** and **1 page**.

## What still needs a human

**Before any manual pass: the app's own `Schema version` line must read `8`.**

- **The Windows half of this gate.** The VM's sshd stopped answering after a
  Windows Update mid-milestone. Whoever has the VM: (1) restart sshd or the VM,
  and the agent can run steps 1–5 as at M6; **or** (2) at the VM's own screen,
  run the packaged Windows build (CI's artifact, or `npm run tauri build` in
  `C:\Dev\Agenda-for-Teachers` after pulling this branch) through
  `G:\My Drive\Atzenta M7 evidence\run-windows-selftest.ps1 -Exe <path>` — it
  renders the folder, all eleven forms and the award certificate with WebView2
  and leaves the PDFs in `pdf-windows\`. **`folder-A1-win.pdf` must be 6 pages.**
  That is criterion 3's Windows half, and it is the one piece of new machinery
  (several documents in one file) never exercised on WebView2.
- **Look at the forms and the folder.** They were rendered and looked at by the
  agent at low resolution; no person has judged them. Especially: the
  31-day card at 7pt on portrait, the parent note's cut frames, and whether the
  folder's suggested wording reads as a teacher would write it.
- **Type into the two new screens**, on either OS. The five-minute script below.
- **Carried, still outstanding, not closed by M7:**
  - **Nobody has looked at a printed letter** (M5). More pressing now: M7 found
    the certificates had printed without their frame all along.
  - **Four of M6's six screens were never typed into** — *Εβδομάδα*,
    *Αναστοχασμός*, *Εκδρομές*, *Βιβλία & υλικά* — and **nobody has seen the
    progress matrix holding anything**.
  - **A genuine Explorer double-click, and therefore SmartScreen.** Scripting
    cannot reproduce it.

### The five-minute script, now with M7's part

M6's list with **part 7 added**:

1. **M2** — gradebook column, weight, marks, both export buttons.
2. **M3** — timetable hour, a class in a cell, a duty, a week's plan, Σημερινό,
   *Αντιγραφή ως κείμενο*.
3. **M4** — the month grid at 31 columns, an absence line, an incident, a
   support plan and two goals.
4. **M4.5** — all four export buttons, and open what comes out.
5. **M5** — walk *Γονείς & Ομάδα*, and **look at a printed letter** — the award
   certificate should now have a frame.
6. **M6** — walk *Πλάνο*'s seven sub-pages; watch the matrix fill by itself.
7. **M7.**
   - *Τάξεις → Φάκελος αναπλήρωσης*: pick a class with students. Check the
     class details, the attention list and the seating are what *Τμήματα* says.
     **Go to *Τμήματα*, move a student to another desk, come back — the folder
     already shows it, with nothing pressed.** Clear one suggested box: it must
     stay empty after a restart; *Επαναφορά προτεινόμενου* brings it back. Press
     *Εξαγωγή φακέλου σε PDF* and **check it is one file of six pages**.
   - *Πρότυπα*: for two or three forms, *Νέο έντυπο*, give it a name, fill a
     few boxes, pick another saved one, come back — everything is there. Press
     *Κενό PDF* on *Σημείωμα προς γονείς* and **check the two notes and the cut
     line**. Open *Πλάνο αίθουσας* and confirm it shows **none** of your real
     students.

## Known gaps

- **The Windows half of the gate**, above.
- **No human has looked at M7's pages or typed into its screens.**
- **The credentials form stores passwords unencrypted** (with a warning). Open
  question 1.
- **A filled letter is still not stored.** Open question 4, now cheap.
- **Meeting minutes still do not print** from *Συνεδριάσεις*.
- **The folder's contacts are its own text**, not M8's staff directory (which
  does not exist yet).
- **No reordering or duplicating of saved forms.** A copy starts blank.
- **M1's annual goals are still unprinted**; unchanged, not M7's.
- **Windows code signing is still unresolved**, unchanged, and still the nearest
  real-world blocker.

## A note on CI minutes

The full gate was run locally on the dev Mac before pushing, so the CI run is
confirmatory. **The Windows VM could not be used**, so for once CI's
`windows-latest` job is the only Windows evidence for steps 1–4 — stated rather
than blurred. The code and these docs go in **one push**, so the PR opens with
its checks attached; no commit message on the branch carries the CI-skip marker
in any form.

**Sixthing M3's, M4's, M4.5's, M5's and M6's proposal, not implementing it**
(it changes what the gate proves, so it stays the product owner's call): a
`paths-ignore` for `docs/**`, and/or running typecheck, lint and the frontend
tests once on `ubuntu-latest`, reserving macOS and Windows for the Rust build,
Rust tests and packaging.
