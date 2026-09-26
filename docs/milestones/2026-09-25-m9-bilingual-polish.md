# M9 — Bilingual pass & polish

**Date:** 2026-09-25
**Branch:** `m9-bilingual-polish`
**Signed off by:** Product owner, 2026-09-25, "signing off everything", and
asking for the merge. That sign-off covers the layout-fidelity judgement
(criterion 2). It is recorded as given; this note does not claim that the
bilingual read of the English draft (below) has been done, and it stays on the
list before handover.

**Which situation this leaves behind.** Everything an agent can do for M9 is
done and passed on both operating systems, including the real two-device gate
on both sync clients. **M9 is not finished**, because two of its three
acceptance criteria end in a person: the layout-fidelity criterion is, in its
own words, "a judgment call for the product owner", and the English letters and
messages are an unreviewed draft that someone who reads both languages must read
before a teacher sends one. Both are packaged and waiting — see "What still
needs a human".

Worked on **the dev Mac** (`uname -s` = `Darwin`, `VBoxManage list vms` lists
`MilestoneTesting`), with the Windows half driven over SSH into the
`MilestoneTesting` VM (`COMPUTERNAME` = `MILESTONETESTIN`, Windows 11 Pro, user
`kyria`), and through a scheduled task in the VM's logged-in console session
wherever the app had to render. **Every result in this note was produced by an
agent**, except the four items the product owner reported done since M8 (see
"Human items").

## What shipped

**English, everywhere, behind a toggle.**

- **Four English bundle files** — `en.ts` (the app's 1,078 labels, including
  M9's own), `lettersEn.ts` (7 letters), `messagesEn.ts` (150 messages, 15
  categories, and the placeholder names), `formsEn.ts` (the checklist's 16 items
  and the folder's suggestions) — and **one more entry in `BUNDLES`**.
- **The letters, messages and forms content is an unreviewed machine-translated
  draft**, written by this agent, as the Resolved "English translation
  authorship" row decided. It says so at the top of each of those three files,
  in the teacher-facing docs, and here. `en.ts` is the app's own labels and is
  not so marked.
- **A language toggle in the header**, top right on every screen:
  *Ελληνικά* / *English*, each named in its own language.
- **The language is stored in the data file** (`migrate_to_10`, a one-row
  `preference` table; `user_version = 10`). It is never read from the OS. A
  switch is a write through `mutate()` like any other, so it is refused while
  the file is blocked. See Decisions.
- **Printed output follows the language at the moment of generation**; the
  teacher's own words never change; dates stay `dd.MM.yyyy` and numbers keep a
  dot in both languages.
- The **window title** and `<html lang>` follow the language too.

**Backups, tuned** (the schedule itself untouched): snapshots are atomic,
lock-consistent, skipped when identical to the newest, taken on a macOS quit,
and taken even when the file changes within the same minute. See Part 3.

**A two-device gate tool**, `src-tauri/examples/two_device.rs`: writes a known
record set (one of everything from M1 to M9) through the app's own storage
functions, and dumps any data file record by record as JSON.

## The shape test M5 set: was adding English "adding files and one line"?

**For every screen and every document builder, yes.** No screen was edited to
make a string English, and no print builder either. **Three places did need
code, and each is a defect or gap in an earlier milestone's shape, recorded
rather than worked around:**

1. **The message bank kept a filled value against the token's Greek spelling**
   (`values["ΜΑΘΗΜΑ"]`, M5), and the letters' reply slips did the same. Switching
   to English, where the slot reads `[SUBJECT]`, would have lost every value.
   Fixed with stable placeholder codes (`ph.<code>`, 72 of them); touches
   `domain/placeholders.ts`, `domain/messages.ts`, `domain/letters.ts`,
   `print/letterSheets.ts` and the two screens' field loops. **Verified before
   fixing**, as the brief asked: `MessagesScreen` stored `values[token]` with
   `token` from `placeholdersIn(body)`.
2. **The shell pinned the language** (`const locale = DEFAULT_LOCALE`), which M8
   said M9 would replace. It now reads the stored preference.
3. **Errors from the Rust side were shown raw** — English sentences in a Greek
   interface. They now get a translated prefix (`describeError`), with the
   system's own message as the detail. The same change made the shell keep
   *what happened* rather than a finished sentence, which is what lets the
   message line re-word itself on a switch.

Two smaller screen-level changes: the message screen keeps the picked message
open across a switch (a Greek search matches nothing in English), and the shell
sets the window title.

## Acceptance criteria for this milestone

Quoted from `docs/ENGINEERING.md` as written.

| Criterion | Result | Evidence |
|---|---|---|
| **Every UI string, all 7 letters, and all 150 messages have both a Greek and an English version; switching the language toggle changes all of them, with no string left showing a placeholder or the wrong language.** | **Pass by agent, both OSes — with the English content still an unreviewed draft** | **Bundles:** `tests/unit/i18nParity.test.ts` reads the four file pairs directly (not through the lookup, whose Greek fallback would hide a gap) and fails, naming the key, on a missing or empty English string or an orphan English key; checks every `{param}` matches; checks every letter and message asks for **the same placeholder codes** in both languages, that every token has a code, and that no Greek is left inside an English string (the one exception is `lang.el`, *Ελληνικά*). The compiler checks the key sets too (`satisfies`). **The switch:** `tests/component/Bilingual.test.tsx` switches through the real shell and asserts the English is there **and the Greek is gone**; it exports, after switching, a table sheet (grade sheet), a letter (with a reply slip filled in Greek), a message (filled in Greek), a form, and the folder bundle, and checks each file's text for English captions, the teacher's values, `dd.MM.yyyy`, no `[BRACKETS]`, and no Greek but hers. **A sweep** opens every section and sub-page in English over **seven fixtures** and fails on any Greek letter left in text, form values or `aria-label`/`placeholder`/`title` once her words are set aside. **Real files:** 46 documents × 2 languages = **92 PDFs** from the packaged build on each OS; see Part 1. **Real windows:** the English interface photographed on Windows reading device 1's data (Part 4). Last defect found this way: the title bar, fixed |
| **A check of at least 3 PDF outputs confirms acceptable layout fidelity (page size, general structure, Greek rendering) — a judgment call for the product owner to sign off on, not an automated check.** | **Prepared and looked at by the agent; the judgement is the product owner's and has not been made** | **Eight** documents rendered in Greek and English at the same scale: grade sheet, absence register, invitation letter, achievement award, period checklist, note to parents, message, and all six pages of the substitute folder. What the agent saw is under Part 2 |
| **The real two-device test passes: write data on a simulated "device 1", let a real cloud-sync client (Drive or OneDrive) finish syncing, launch on "device 2", confirm the data is there and correct.** | **Pass, by agent, on both Google Drive and OneDrive, both directions** | One shared folder per client, both builds in it. Sync measured by SHA-256, not slept on. Record-level equality by dumping both devices' files through the app's own loader. Plus the M0 guard on real devices: a write blocked, reload offered. See Part 4 |

## Confirming the tests fail against broken code

**Nine planted in the frontend, four in Rust; one survivor, explained.**

| Mutation | Caught by |
|---|---|
| **One English string deleted** (`nav.exams`) | the parity test, by name (and the sweep, on six fixtures) |
| **The toggle reaches the header but not a printed letter** (letter built with a Greek translator) | the letter export test |
| **A message's filled values lost on switching** (placeholder keys back to token text) | the message export test, the letter export test, and M5's "copies what it prints" |
| **An untouched folder box stays Greek** | the folder bundle test, and the sweep on all seven fixtures |
| **An edited folder box changes with the language** | the folder bundle test, alone |
| **The language read from the OS locale** (`navigator.language`) | 11 tests, including both "file says / OS says" tests |
| **A date formatted by locale in English** | `localeIndependence.test.ts` and three export tests |
| **An amount formatted by locale in English** (`1,250.00`) | `localeIndependence.test.ts` |
| The lookup falls back to Greek for `exams.*` in English (parity untouched) | **the sweep**, on all seven fixtures — proving it catches what the parity test cannot |
| Rust: automatic snapshots copy an unchanged file anyway | `an_unchanged_file_is_not_snapshotted_again…` |
| Rust: the copy takes no read lock | `no_save_can_write_to_the_file_while_a_snapshot_copies_it` |
| Rust: the copy is written straight to its final name | `a_copy_stopped_halfway_leaves_nothing_that_looks_like_a_snapshot` |
| Rust: a changed file in the same minute is skipped | `a_changed_file_within_the_same_minute_is_still_snapshotted` |

**Two honest notes.** The first versions of two backup tests were too weak and
the mutations said so: the "waits for a writer" test passed without the read
lock (the writer blocked the snapshot *before* the copy, not during it), and
nothing tested the rename. Both were rewritten around an injectable copy step
and then caught their mutations. **The one survivor**: removing the busy
timeout M9 had added to `db::open_at` changed nothing — because rusqlite 0.32
already sets a five-second one on every connection (checked in its source). The
call was removed as redundant, and the test now holds the default.

## Part 1 — English, and the printed sheets

Every printed document was built by the app's own builders from the test
fixtures, in Greek and in English, and rendered by **the packaged build of each
OS through its real export path** (the print self-test hook):

| | macOS (`createPDFWithConfiguration:`) | Windows (`PrintToPdf`) |
|---|---|---|
| Documents | 92 (46 × 2 languages), 0 failures | 92, 0 failures, run in the console session |
| Page counts | **identical Greek vs English for every document** | **identical to macOS for every document** |
| Blank forms (11) | 1 A4 portrait page each, both languages | same |
| Substitute folder (2 classes) | **6 landscape pages**, both languages | **6 pages** |
| Letters (7), messages (15) | 1 page each | same |
| Registers (8 sheets) | 1 landscape page each | same |
| Fonts | Helvetica Neue subsets only, embedded | Arial CID subsets only, embedded |
| `[BRACKETS]` in extracted text | none, in any of the 92 | none |

**The Windows folder at 6 pages is the figure M7's Windows self-test was meant
to produce** and that no file on the VM recorded (see Human items).

**Looked at, not only counted** (both OSes, English especially): the checklist's
English items fit their two columns; the month card holds 30 days on one sheet
with the English key `· a l e`; the folder's contacts and procedures page keeps
its two columns; the reply slip sits at the letter's foot; the note to parents
is two cut-out frames. No clipping, spill or broken frame was found in English.

**Other checks from the brief:** nothing formats a date, month or weekday with
`toLocale…` or `Intl` (checked; months and weekdays are `vocab.*` ids);
`localeCompare(…, "el")` is kept for teacher-entered names (Resolved); the
search fold works on Latin (tested on the English bank); exported file names
follow the language and carry no character either filesystem refuses (tested);
the folder's untouched boxes follow the language, edited ones do not, cleared
ones stay empty (tested through a switch, and the switch writes nothing to the
folder's texts).

## Part 2 — Layout check (for the product owner)

**What was looked at**, all at 60 dpi: the grade sheet and the absence register
(A4 landscape), the invitation letter, the achievement award, the blank period
checklist, the blank note to parents, one printed message (A4 portrait), and the
six pages of the substitute folder (A4 landscape).

**What the agent saw.** Every sheet is A4, as the spec asks. Structure is right
on all eight: header fields, table columns or captioned areas, the register's two
boxes at its foot, the letter's reply slip at its foot, one certificate per
sheet, two notes per sheet, six contacts beside six procedures. Greek renders on
every page. The app uses its own plain styling (Resolved: not a visual copy of
any paper planner). **Two details were flagged rather than changed**: the
certificate's content sits in the top two-thirds of its frame, and the sheet
footer ("Printed …") falls inside the certificate's frame.

## Part 3 — Backup retention tuning

**The schedule is unchanged** (Resolved). **Measured:**

| | |
|---|---|
| A fresh or lightly-filled data file (schema 9/10) | **397,312 bytes** (97 pages of 4 KB; mostly one page per table) |
| **A heavy year** — 150 students, 6 classes, the attendance grid filled every school day (26,250 marks), 15 marks per student, weekly plans, 250 agenda notes, 200 absences, 150 contacts | **3.85 MB** (gzip: 0.71 MB) |
| Snapshots kept, steady state, for a teacher using the app twice a school day | about **45** in the 7-day tier (≈8 a school day with the M9 skip; ≥10 before), **≤23** daily, **≤12** monthly — **≈75 files** |
| **A year's cost in the synced folder** | **≈30 MB** early in the year; **≈110 MB** mid-year; **≈290 MB** at the end of a heavy year. Upload traffic at year's end ≈ 30 MB a school day |

**What changed, each with tests** (`src-tauri/src/backup.rs`):

1. **Atomic snapshots.** Written as `….sqlite.partial` and renamed. Before, a
   copy killed mid-way left a truncated file under a valid snapshot name, which
   thinning could keep as its day's representative while deleting a good one.
2. **A read lock for the copy.** The 30-minute snapshot runs on its own thread
   and could copy a commit half-written. Now it holds SQLite's shared lock for
   the whole copy; a save meeting it waits milliseconds (rusqlite's default
   five-second busy timeout).
3. **Automatic snapshots skip an unchanged file** (launch, 30 minutes, quit);
   the storage panel's button always writes. An afternoon with the app left open
   no longer writes a dozen identical files for the sync client to upload.
4. **A macOS quit now takes its snapshot.** Until M9 the code handled only
   Tauri's `ExitRequested`, which a normal Mac quit (Cmd-Q, Dock, Apple Event)
   never raises; **no build before M9 wrote a snapshot on quitting on a Mac.**
   Found at this gate by quitting and counting the folder; verified fixed on the
   packaged build.
5. **A file that changes within the same minute is still snapshotted**, under a
   seconds-precision name (`planner-2026-09-25-101039.sqlite`) that thinning
   parses. Before, the second state was silently not written. Found at this
   gate: a quit and a relaunch in one minute after a write.

**Does thinning run when it should?** On launch, every 30 minutes and on quit —
the quit on macOS only since change 4. Verified on the packaged builds.

**Could two devices thinning one `data/backups/` fight?** No, and it is tested:
two devices, one a few minutes behind, each thinning what the sync client gives
it, converge on the same survivors in either order; and over two years of
simulated snapshots thinned alternately by two devices, **the newest snapshot of
every calendar month survives every pass at any clock**. **Two things the
schedule does not do, found by testing it and recorded rather than claimed
away:** thinning is **not monotonic in time** (an older snapshot of a day,
thinned in the daily tier, is one a later fresh pass would briefly have kept as
its month's representative — a newer snapshot of that day always survives, so
nothing promised is lost), and **a clock set forward thins what exists
irreversibly** (a year ahead leaves one per month). A clock set back only keeps
more; a future-stamped snapshot is never deleted (M0).

**The rig had a real wrong clock.** The VM was 1 h 43 m slow, in the same time
zone, during the two-device runs; its snapshots in the shared folder were named
in the past. Inside the 7-day tier that changes nothing, as the tests predict.
(It had corrected itself by the end of the session.)

**Month boundaries** are calendar months (tested at 31 January / 1 February).
**Unparsable names** — a sync client's conflict copy, a stray note — are never
counted or thinned, and never deleted (tested).

## Part 4 — The real two-device test

**Rig:** the dev Mac and the `MilestoneTesting` VM, signed into the same Google
Drive and OneDrive accounts. **One shared folder per client**
(`Atzenta M9 shared final3` on Drive, `Atzenta M9 shared` on OneDrive), holding
**both builds**, as the spec's folder layout does. The app was fully quit on
one device, verified by PID, before it was launched on the other.

**Writes** go through `examples/two_device.rs`, i.e. `db::open` and the same
`store::save_*` functions the app's commands call — **an agent cannot type into
the app**. Every *read* and every launch was the packaged app itself. The record
set is one of everything from M1 to M9 — `cloud_folder.rs`'s own, including M8's
**cover and leave on the same date** and **a training line with no cost** — and
the language set to English.

| Step | Google Drive (final builds, `f6d0b02`) | OneDrive (final builds) |
|---|---|---|
| Device 1 (Mac) launches from the shared folder, quits; writes; launches, quits | done, PIDs verified | done |
| **Sync settles** — polled until device 2's SHA-256 equals device 1's | **97 s** | **20 s** |
| Device 2 (PC) launches the exe **from the shared folder** in its console session, quits | ran (pid 10720), quit verified | ran (pid 5756), quit verified |
| Device 2's file after its session | **byte-identical** to device 1's | **byte-identical** |
| **Record-level equality** (both files dumped through the app's loader) | **equal** (14,661 bytes of JSON) | **equal** |
| Device 2 writes on the way back (an edit, a cover on a new date, a contact, a wellbeing entry, language back to Greek), launches, quits | done | done |
| Sync settles back (measured from when polling began) | 2 s | 4 s |
| Device 1 launches, quits; its file | byte-identical to device 2's; **records equal** (15,181 bytes) | byte-identical; **equal** |

The English screenshot of device 2 shows device 1's start date and its choice of
English — the language travelled in the file, as the Resolved row intends.

**The M0 safety net, across real devices (Drive).** Device 1 = the PC, app open
in Greek. Device 2 = the Mac, writing into the shared file. The PC's copy had the
Mac's write after **18 s**. Then, in the PC's running app, the *English* button
was pressed (a real mouse click at the button, in the console session):
**the write was refused, the block panel appeared — «Το αρχείο δεδομένων άλλαξε
στον δίσκο» with *Επαναφόρτωση από τον δίσκο* — and the PC's file was
byte-for-byte the Mac's.** *Επαναφόρτωση* wrote nothing; the next press of
*English* went through and the title bar followed it. Screenshots in the
session's evidence, described here because they are not committed.

**Three runs did not count, and are recorded because of what they show.** Two
earlier Drive runs used a reused or brand-new folder in a way that made both
devices write into it at once — the script emptied the folder on the Mac while
the PC was copying a fresh exe into it, and Drive applied the Mac's deletion to
the PC's new copy; in another, Drive took over four minutes to show a new empty
folder on the PC. That is the one-device rule doing its job: the final design
has the Mac place both builds and the PC wait for them by sync. The data layer
of the first of those runs still matched record for record.

**What needed a human and was not claimed.** Nothing in Part 4: launches were a
scheduled task in the PC's console session (a real window, a real WebView2)
and `open -a` on the Mac — **not double-clicks**. A double-click, and
SmartScreen, remain a human item.

## Decisions taken

All recorded in the spec's Resolved table.

| Decision | Call taken | Why |
|---|---|---|
| Where the language lives | **The data file** (`migrate_to_10`) | Travels with the records, one copy of the truth, the spec keeps everything in the folder. A switch is a write and is refused while blocked — accepted |
| Where the toggle sits | **Header, top right; endonyms** | On every screen; a teacher can always find her language |
| Language source | **The file only; never the OS; unknown → Greek** | The spec's words; tested |
| Filled placeholders | **Kept against stable codes `ph.<code>`** | M5's token-text keys would lose every value on a switch |
| Sorting | **`localeCompare(…, "el")` kept** | It sorts teacher-entered Greek names |
| Backend errors | **Translated prefix, system detail** | They were raw English in a Greek interface |
| English symbols | `· a l e`; grades `A–D` | Labels over stored codes |
| User docs in English | **No** (product owner) | — |
| Code signing | **Out of M9** (product owner) | Listed first below |
| Backups | Schedule unchanged; five changes to *taking* a snapshot | Part 3 |

**No schema change beyond `migrate_to_10`.** It comes with an **M8-era climb
test** (a `user_version = 9` file with a row in all eight M8 tables, including a
cover and a leave on one date and a blank cost); the M7-era test is renamed to
"climbs to the current schema"; `no_table_is_keyed_by_a_week_index` is green.

## Open questions for the product owner

All in the spec's Open section.

1. **A bilingual read of the English letters, messages and form suggestions**
   before any teacher sends one.
2. **Every "should X print?" question now costs two languages.** Meeting
   minutes, the annual goals, M6's surfaces, the covers register, the conduct
   sheet with the grade sheet: each new sheet needs English captions and a look
   in both languages. Not answered here.
3. **The invitation asks for the meeting date twice** (head field and slip);
   an M5 comment claimed otherwise. Kept as is.
4. **The certificates**: content top-weighted; the footer inside the frame.
5. **Counts are not pluralised** ("1 messages"; Greek has the same shape).
6. **Should snapshots be compressed?** 3.85 MB → 0.71 MB, but it changes the
   restore procedure.

**Carried, untouched, not M9's** (the brief's list): the credentials form's
unencrypted storage; the folder printing health and support notes; the folder's
Greek wording; filled letters joining the saved forms; the conduct sheet with
the grade sheet; meeting minutes, M1's annual goals, M6's surfaces and the covers
register printing; the staff directory linked from the folder, meetings, covers
and trips; the six resource categories; an exam's `Βαρύτητα`; page-level boxes
at volume; the absence register's kinds; the Feb–Dec year model; the `Email`
label **in Greek** (in English it is simply "Email"); a leave over several days.

## Gate results (docs/ENGINEERING.md)

| # | Step | Result |
|---|---|---|
| 1 | Typecheck clean | **Pass on both, by agent**, at `f6d0b02` (Mac) and natively in the VM |
| 2 | Lint clean | **Pass on both, by agent**: eslint (no-inline-Greek rule intact), `cargo fmt --all --check`, `cargo clippy --all-targets -- -D warnings` (which now includes the example) |
| 3 | Automated tests pass | **Pass on both, by agent.** **687 frontend tests** (was 639) and **131 Rust unit + 1 integration = 132** (was 117) on the Mac and natively in the VM |
| 3b | Persistence round-trip | **Pass, extended.** `cloud_folder.rs` switches the language to English, quits, relaunches, finds `en`, and finds it unmoved by a start-date change; a second automatic snapshot of the unchanged file adds nothing. `db.rs` gains the M8-era climb test |
| 4 | Packaged build, structurally verified | **macOS, by agent:** universal `Teacher Planner.app`, binary **10,045,376** bytes, `lipo -archs` `x86_64 arm64`, `.dmg` **4,800,016** bytes, identifier `gr.atzenta.teacher-planner`. **Windows, in the VM, by agent:** `teacher-planner.exe` **4,948,992** bytes, `Teacher Planner_0.1.0_x64-setup.exe` **1,928,210** bytes, `Get-AuthenticodeSignature` **NotSigned** |
| 5 | Launch from inside a cloud-synced folder, both OSes | **Pass on both, by agent** — details below. Programmatic launches, not double-clicks |
| 6 | This release note | **Pass** |

**Builds and commits, to be exact.** Step 5 on both OSes ran on the builds of
`a801879`; the two-device runs and the guard demo on `f6d0b02`, which differs
only by the window-title command. The 92 PDFs were rendered by the builds of
`d711420` (Mac) and `9fff723` (Windows); nothing under `src/print/`,
`src/domain/` or the print path in Rust changed after them.

### Step 5 on macOS (by agent)

The universal `.app` in `Atzenta M9 mac` inside live **Google Drive** and
**OneDrive** (paths via `pwd -P`), launched with `open -a`. In both: running at
12 s; **`user_version = 10`**, `integrity_check` `ok`, language `el`; quit
verified by PID; **a snapshot on that quit** (new in M9); one of everything
written; relaunch and quit verified by PID; database **byte-identical**
(`635f8da2…`); a second, seconds-named snapshot because the file changed within
the minute; **no sidecars**; the cover and the leave both present, the blank
cost still `NULL`, language `en`.

### Step 5 on Windows, in the VM (by agent)

The exe in `Atzenta M9 vm` inside live **Google Drive** (`G:\My Drive`) and
**OneDrive**, launched in the **console session** (session 1). In both: running,
quit verified by PID, a snapshot on the first quit, one of everything written,
relaunch byte-identical — **with the same hash as the Mac's, `635F8DA2…`** — no
sidecars. Copied back to the Mac: `user_version = 10`, `ok`, `en`, one cover,
one leave, the blank cost `NULL`.

**The OneDrive online-only case**: exe and database forced online-only and
proven dehydrated — **0 bytes on disk against 4,947,456 and 401,408** — then
launched: the app ran, both files hydrated, the database hash unchanged, one
database.

## Human items

**Reported done by the product owner since M8 (2026-09-25), recorded as
reported:** M7's Windows self-test; the typing passes over M6's four, M7's two
and M8's four screens (including seeing the progress matrix hold data);
looking at a printed letter; a genuine Explorer double-click. **One check made:**
the M7 script writes its PDFs to `pdf-windows\` beside itself, and **no
`folder-A1-win.pdf` exists on the VM or in the Drive evidence folder** — it may
have been run elsewhere or cleared. M9's own Windows rendering above produced
the figure it was for (the folder, 6 pages on WebView2).

**What still needs a human for M9:**

- **The fidelity judgement** — look at the eight rendered documents and decide
  whether page size, general structure and Greek rendering are acceptable
  (Part 2).
- **A bilingual read of the English draft** — the letters, the 150 messages and
  the folder's suggestions, against the Greek.
- **A look at the English interface**, typing into a few screens in English on
  either OS. The agent saw it on Windows (screenshots) but did not type.
- **A double-click, and SmartScreen**, on this build. Scripting cannot.

**Before any manual pass: the app's own `Schema version` line must read `10`.**

## Known gaps

- The English content is unreviewed (above).
- Counts are not pluralised.
- The VM was **not reverted to `clean-baseline`** before step 5: the product
  owner had used it since M8 and reverting would have discarded that. The M8
  clone is kept aside as `C:\Dev\Agenda-for-Teachers-m8`; M9's is a fresh clone.
- Two-device writes were by the storage functions, not by typing.

## What stands between this build and handing it to the teacher

1. **Code signing, Windows first** (SmartScreen on the installer's first run;
   macOS needs a right-click → Open). Out of M9 by the product owner's call.
2. **The product owner's fidelity sign-off** (Part 2).
3. **A bilingual review of the English letters, messages and suggestions** — or
   a decision to ship Greek content only until one is done.
4. **A human pass on this build**: double-click from a synced folder on both
   OSes, check `Schema version` reads `10`, switch the language, type a little,
   export one letter in each language and look at it.
5. **The product owner's open questions** that decide what prints (above) —
   cheaper now than after the teacher has the app.
6. **Handover itself**: which build goes where (one synced folder holding both
   builds, as the spec lays it out), and telling the teacher the one-device rule.

## A note on CI

The repository is public, so CI costs no minutes. The full gate was run on the
dev Mac and natively in the VM before pushing; code and docs went in one push, and
no commit message on the branch carries the CI-skip marker.

**CI was green on both runners on the first run**: run
[36113736766](https://github.com/Vibing101/Agenda-for-Teachers/actions/runs/36113736766)
at `901da08`, `macos-latest` 5m50s and `windows-latest` 8m32s, no retries
(PR #2). This commit, which records it, is docs-only and runs CI again.
