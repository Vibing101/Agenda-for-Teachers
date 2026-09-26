# M8 — Development, wellbeing, staff directory, covers/leave

**Date:** 2026-09-24
**Branch:** `m8-development-wellbeing`
**Signed off by:** Product owner, 2026-09-24, by asking for the merge. It was
squash-merged to `main` and the branch deleted in the same step. **Signed off
with two items still outstanding**, both listed under "What still needs a
human": **M7's Windows self-test** (at the VM's console; `folder-A1-win.pdf`
must be 6 pages) and **the typing pass over M8's four screens**. Neither had
been done at merge.

**The Windows half of this gate was run, after a VM rebuild.** When M8
started, the `MilestoneTesting` VM's sshd was still down, as it had been since
M7. The product owner then found its **virtual disk corrupted and reinstalled
Windows 11 Pro from scratch**, and reinstalled OpenSSH. The agent installed the
toolchain over SSH (VS Build Tools, Git, Node, Rust, all by `winget`), cloned
the branch fresh from a bundle, and ran **all of Windows steps 1–5 natively in
the VM** at `60c90c5`. See the gate table. **M7's Windows half is still
outstanding**, because it needs the VM's console, not SSH. See "What still
needs a human".

Worked on **the dev Mac** (`uname -s` = `Darwin`, `VBoxManage list vms` lists
`MilestoneTesting`), with the Windows half driven over SSH into the rebuilt
`MilestoneTesting` VM (`COMPUTERNAME` = `MILESTONETESTIN`, Windows 11 Pro, user
`kyria`). Every result below names the machine that produced it
and says whether an agent or a human produced it. **Every result in this note
was produced by an agent.**

## What shipped

Four surfaces from two spec modules, and the arithmetic for one of them.

- **Έτος → Επαφές σχολείου**: the staff directory (name, `Θέση / Τομέας`,
  phone, email). It is searchable, ignoring accents and case, across all four
  columns.
- **Έτος → Αναπληρώσεις & άδειες**: two separate registers on one page. One
  holds covers the teacher taught (date, class, subject/material, the colleague
  covered for, signature/remarks). The other holds her own leave (date, reason,
  documents submitted).
- **Ανάπτυξη & Ευεξία → Ανάπτυξη και καριέρα**: one screen. It holds the training log (date, activity, organiser, hours, format,
  cost, certificate), the open-ended **development goals**, and the **budget
  and summary**, which adds up cost and hours over the school year.
- **Ανάπτυξη & Ευεξία → Ευεξία**: dated free-text weekly reflections, each
  with its week number derived from the date. Below them are the page's two
  standing notes.

**`Έτος` gains its first sub-pages** (*Σχολικό έτος / Επαφές σχολείου /
Αναπληρώσεις & άδειες*); M1's screen is the first of them, unchanged apart
from one sentence under the six annual goals saying the development goals
are kept elsewhere. **The top row goes from ten to eleven** (`Ανάπτυξη &
Ευεξία`).

**Schema climbs to `user_version = 9`.** Eight tables, purely additive:
`staff_contact`, `cover_record`, `leave_record`, `development_goal`,
`training_entry`, `development_budget` (one row), `wellbeing_entry`,
`wellbeing_note` (one row). **None has a foreign key**, to anything or to each
other, and a Rust test checks it.

**Two pieces of existing code were moved so they could be reused rather than
copied.** The accent-folding search moved from `messages.ts` to
`domain/search.ts`, and `messages.ts` re-exports it. The comma-or-dot number
parser moved to `domain/numbers.ts`, and M2's `parseWeight` now calls it. A
test re-asserts M2's weight rules.

**No PDF.** M8's scope line names none, the spec's "PDF output" section names
none of these four surfaces, and neither module entry calls them printable.
This was checked, as M6 did, not assumed. One detail that argues for a covers
sheet is raised under Open questions.

## Acceptance criteria for this milestone

Quoted from `docs/ENGINEERING.md` as written. **Both are tested as
insensitivity, not as a count, at the storage, selector and screen layers.**

| Criterion | Result | Evidence |
|---|---|---|
| **Development goals (open-ended) and the 6 fixed annual-goal areas (from M1's school-year setup) remain visibly separate and neither is generated from the other.** | **Pass** (agent, macOS) | **Storage:** `development_goals_and_the_six_annual_goals_are_never_written_from_each_other` fills all six areas, **including `development`**, starting from an empty development list and then from a full one, and asserts the development goals compare equal to before. It then adds and edits development goals and asserts that `annual_goals` **and a saved M7 goals form** compare equal. `no_m8_table_links_to_anything` walks every M8 table's foreign keys and columns. The **M7-era climb test** carries a filled `development` area and a saved goals form through the migration and asserts that it seeds no development goal. **Selector:** `allDevelopmentGoals()` is equal with the six filled or blanked, and with or without the saved form. **Screen:** the development panel's markup is **identical** with the annual goals filled or blank and the form present or absent, and the page shows no annual-goal text. Adding a goal from a list of two leaves the siblings, `annual_goals` and `print_forms` byte-for-byte, and only `save_development_goal` is called. The other way round, the Year panel's markup is identical with development goals present or absent, and saving the `development` area writes no development goal. **"Visibly separate":** the two are in **different top-level sections** (*Έτος → Σχολικό έτος* and *Ανάπτυξη & Ευεξία → Ανάπτυξη και καριέρα*), never on one screen, and each carries one sentence naming the other as separate. One lives under ΕΤΟΣ, the other under ΑΝΑΠΤΥΞΗ |
| **A cover-taught record and a leave record for the same date coexist as separate entries.** | **Pass** (agent, macOS) | The fixture puts a cover and a leave on **12.11.2026**, plus one more of each on other dates. **Storage:** `a_cover_and_a_leave_on_the_same_date_are_separate_and_blind_to_each_other` builds **three files**: covers only, leaves only, and both interleaved. It asserts each register is equal between the file where the other table is empty and the file where it is full. Other tests show that deleting one of the same-date pair leaves the other, and that neither touches the timetable's duty cells or the substitute folder. **Selector:** `coverRegister()` is equal with the leave table empty, full, and **crowded with a leave on every cover's own date**, and `leaveRegister()` likewise. **Screen:** each register's panel markup is **identical** with the other table empty or full. Adding a cover or a leave from a full register leaves the siblings and the **other register** byte-for-byte, calls only its own command, and (for a leave) leaves the folder's texts unchanged. **End to end:** `cloud_folder.rs` writes a same-date pair, quits, relaunches and reads both back. **Step 5 on macOS** did the same in live Drive and OneDrive folders |

## Confirming the tests fail against broken code

**Thirteen deliberate mutations, including the five the brief named. Every
one was caught, and the notes below say which test caught each.**

| Mutation | Caught by |
|---|---|
| **A development goal seeded from the `development` annual area** (selector) | `are not generated from the annual goals — filled, emptied or changed` |
| **Rust: saving an annual goal seeds a development goal** | `development_goals_and_the_six_annual_goals_are_never_written_from_each_other` |
| **Rust: a leave record also writes a cover record** | the same-date criterion test, plus two others |
| **Fake backend: a leave record also writes a cover record** | `adds a leave from a full register; the covers register … do not move` |
| **The cover register reads the leave table** | 4 tests: the selector insensitivity test, the same-date test, and **both** screen criterion tests |
| **The budget counts a blank cost as zero** | 4 tests, including `never reads a blank cost as zero` and the hand-computed fixture |
| The roll-up ignores the school year's window | 6 tests |
| The number field commits a blank as `0` | `stores a cleared cost as not entered, never as zero`, and the invalid-input test |
| Rust: a new line with no cost is stored as `0` | `a_blank_cost_is_not_stored_as_zero_and_a_zero_is_kept` |
| **A new-record button that does not reach what it made (1).** A new wellbeing entry sorts **below** an older one of the same date, so typing lands in the old one | `adds an entry dated the shell's today, from a full journal, and types into it` |
| **(2)** *Νέα επαφή* leaves an active search in place, so the new blank row is hidden and typing cannot reach it | `adds a contact from a full, filtered list …` |
| The staff search also reaches guardians on the student cards | the selector and the screen tests on the shared name |
| The development page shows the annual `development` goal | **`shows no annual goal and is insensitive to them`**, alone |

**Two honest notes on this step.**

- **The last mutation was caught for the wrong reason the first time.** As
  first written, it referenced a variable that was not in scope, so it crashed
  every render of the screen, and six unrelated tests "caught" it. It was
  rewritten so that the page renders and simply shows the annual goal. It was
  then caught by the criterion's own screen test and nothing else.
- **"Selected where selection applies": no M8 button has a selection.** All six
  surfaces are rows edited in place, as M3, M4, M6 and M7 did, and every field
  saves with its own row's id. So the "does not select what it made" defect
  cannot be planted literally. Its two real analogues here are the two planted
  above: the new row sorting where the teacher will not type into it, and the
  new row being hidden. **The first one was found by the tests before any
  mutation ran.** The fixture's wellbeing ids were above the fake backend's
  first new id, which SQLite never produces, so the new entry sorted second
  and the test failed. The fixture was corrected rather than the code, because
  the code's tie-break (a newer id sorts first) is right for real row ids.

## Decisions taken

All recorded in the spec's Resolved table.

| Decision | Call taken | Why |
|---|---|---|
| **Wellbeing** | **Free text only. No rating columns** | The Resolved "Wellbeing entries" decision beats a structured weekly check-in. The screen test asserts no select, slider, spinner, radio or checkbox |
| **What the wellbeing text holds** | **One field per entry, `Τι βοήθησε · τι να αλλάξω`.** The page's two boxes are **one stored note with two fields** | One free column is one field. The two boxes belong to the page, not to a week |
| **How an entry is keyed** | **An actual date**; the week is derived from the start date at display time. A new entry is dated the shell's `today` | M1's rule. A unit test moves the start date and sees the label change while no entry moves |
| **Navigation** | **`Έτος` sub-pages for module 1's two surfaces; one new section for module 7.** Eleven tabs | The spec puts the directory and the covers/leave register under module 1, which is Έτος. Module 7 had no home: M5's situation. See `App.tsx`'s comment and the renamed test |
| **Three goal surfaces** | Independent. No seed, no prefill, no "copy to…" | Criterion 1, and M7's own record of its form |
| **Covers vs. leave** | Two tables, two commands, two selectors, no key | Criterion 2 |
| **A cover's `Τάξη`** | **Free text, not a link** | She covers someone else's class. A link would force her to create a class she does not teach |
| **Paired column headings** | **One field each**: `Θέση / Τομέας`, `Μάθημα / Ύλη που καλύφθηκε`, `Υπογραφή / Παρατηρήσεις` | Each pair is one heading, and the spec writes each as one phrase |
| **Cost and hours** | **Nullable `REAL`.** Blank is not zero. `12,50` and `12.50` are both accepted and shown back as `12.50`. Anything else is refused and not saved | **Unlike M6's textbook price**, these are summed. A sum cannot read "δωρεάν", so the refusal message says to type 0 |
| **The roll-up** | A pure `trainingSummary()` over the school year's own 53-week window. It leaves out blank costs, out-of-year lines and undated lines, **and counts each group on screen** | M2's "never invent a number", applied to money |
| **The budget** | **One stored row**: an amount and the page's notes | One active school year per file |
| **`Μορφή`, `Βεβαίωση`** | Free text | There is no fixed list. Real certificate answers include "αναμένεται" and a number |
| **Search** | M5's folding rule, moved and shared. It searches staff contacts only | The brief's "no second folding function" |
| **PDFs** | None | Scope line, checked against the "PDF output" section |

## Open questions for the product owner

All in the spec's Open section.

1. **Should the substitute folder's contacts come from the staff directory?**
   (M7's question.) **Not wired.** **What it would cost:** one migration
   (`substitute_contact`, a role linked to a directory entry with `ON DELETE
   SET NULL`), a picker beside each of the five contacts, and
   `substituteFolder()` reading the linked name and phone live. It would also
   need a rule for which wins when a contact is both linked and typed. **No
   typed text would be converted.** It stays and shows until a link is picked,
   and it is the fallback if a linked entry is deleted.
2. **Should any other free-text name point into the directory?** These are a
   meeting's `attendees` (M5), a cover's `teacher` (M8) and a trip's
   `responsible` (M6). None was converted. An optional link beside the text is
   the shape question 1 would set; attendees are several people and would need
   a join table.
3. **Should the covers register print?** The register's `Υπογραφή` column suggests
   a sheet handed to the deputy head for signing. No PDF was built (scope
   line). It would be one document definition.
4. **Should a leave span several days?** The spec gives it one date, and so
   does the app. A range would be one column and one migration.

**Carried, untouched, and not M8's:** the credentials form's unencrypted
storage, whether the folder prints health and support notes, the folder's
suggested wording, whether a filled letter joins the saved forms, the conduct
sheet with the grade sheet, the six resource categories, whether M1's annual
goals print, whether M6's surfaces print, an exam's `Βαρύτητα`, whether
meeting minutes print, page-level boxes at volume, the absence register's
kinds, and the Feb–Dec year model.

## Gate results (docs/ENGINEERING.md)

| # | Step | Result |
|---|---|---|
| 1 | Typecheck clean | **Pass on both, by agent.** On the dev Mac, and natively in the Windows VM at `60c90c5` |
| 2 | Lint clean | **Pass on both, by agent.** eslint (including the no-inline-Greek rule), `cargo fmt --all --check` and `cargo clippy --all-targets -- -D warnings`, on the dev Mac and natively in the VM. Each was confirmed by its exit code |
| 3 | Automated tests pass | **Pass on both, by agent.** **639 frontend tests** (was 594) and **117 Rust tests** (was 105), green on the dev Mac and natively in the VM |
| 3b | Persistence round-trip | **Pass, extended.** `cloud_folder.rs` writes one of every M8 record: a cover and a leave on the same date, a training line with a cost and one with none, the budget, a reflection and both standing boxes. It quits, relaunches, and asserts each one, **the blank cost still blank rather than 0**. It then moves the school year's start date and asserts all eight M8 values compare equal. `db.rs` gains **the M7-era climb test**: a `user_version = 8` file with two saved print forms with values and the folder's texts in all three states (written, cleared as an empty row, untouched as no row) climbs to 9 with every row intact. The M6-era test is renamed to "climbs to the current schema". `no_table_is_keyed_by_a_week_index` stays green |
| 4 | Packaged build on Windows and macOS, structurally verified | **macOS: pass, by agent.** `npm run tauri build -- --target universal-apple-darwin` produced `Teacher Planner.app` (binary 9,979,504 bytes) and a 4,743,293-byte `.dmg`. `lipo -archs` gives `x86_64 arm64`, and `CFBundleIdentifier` is `gr.atzenta.teacher-planner`. The app was launched and driven (step 5). **Windows:** `npm run tauri build` **inside the VM** produced `teacher-planner.exe` (4,913,664 bytes) and `Teacher Planner_0.1.0_x64-setup.exe` (1,901,065 bytes). `Get-AuthenticodeSignature` reports `NotSigned` on both, as expected. The exe was launched and driven (step 5) |
| 5 | Manual launch test from inside a cloud-synced folder, both OSes | **Pass on both, by agent.** Launches were programmatic (`open -a` on the Mac, `Start-Process` in the VM), not human double-clicks |
| 6 | This release note | **Pass** |

### What step 5 covered on macOS (by agent)

The universal `.app` was copied into `Atzenta M8 mac` inside live **Google
Drive** and live **OneDrive**, with paths resolved with `pwd -P` per M6's
lesson, and launched with `open -a`. **In both folders:**

- it started and **stayed running**, and wrote `planner.sqlite` at
  **`user_version = 9`**. `integrity_check` returned `ok`, and **all eight M8
  tables** were present;
- the quit was **verified by PID**. Rows were then written into the closed
  file: a cover and a leave on 12.11.2026, a training line costing 12.5 and one
  with no cost, and a reflection. The app was relaunched and quit again (also
  confirmed by PID), and the database was **byte-identical** (SHA-256
  unchanged). The relaunch wrote a dated snapshot (`0 → 1`);
- **no `-wal`/`-shm` sidecars**;
- after the relaunch the cover and the leave were **both there, one each**, and
  the no-cost line was **still `NULL`**.

### What step 5 covered on Windows, in the VM (by agent)

The exe built in the VM was copied into `Atzenta M8 vm` inside live **OneDrive**
and live **Google Drive** (`G:\My Drive`). The folder names are distinct from
the Mac's, because both machines are signed into the same accounts. The script
was copied in as a `.ps1` file with ASCII-only content, per the guide. **In both
folders:** the process started and stayed running; it created `data\`,
`data\backups\` and `exports\`; the quit was confirmed by PID; the relaunch left
the database **byte-identical** (SHA-256); a dated snapshot was written
(`0 → 1`); and there were **no sidecars**. The guest has no `sqlite3`, so both
databases were copied back to the Mac. Both read **`user_version = 9`**,
`integrity_check` `ok`, **all eight M8 tables present**, `development_budget`'s
single row created, and **no column named like a week index**.

**One incident, recorded because of this VM's history.** Taking the live
`clean-baseline` snapshot left the VM `paused due to host power management`,
and `controlvm resume` refused. `controlvm savestate` then failed and **left
the VM `aborted`, a hard power-off**. It was restarted, and before anything
else was trusted: `Repair-Volume -Scan` reported `NoErrorsFound`, `git fsck`
was clean, the built exe was intact, and sshd came back on its own. Windows
logged the unexpected shutdown (events 41 and 6008). **Step 5 ran after this,
on the restarted VM.** `docs/WINDOWS_VM.md` now says to run `caffeinate` before
taking a snapshot.

The previous milestone's `Atzenta M7 mac` copies were **left in place** rather
than deleted, because they are in the product owner's cloud folders. Every
launch used the bundle's full path, which resolves the bundle itself (see
`MILESTONE_PROMPT.md` §5). **A human double-click should still check the
`Schema version` line reads `9`** before typing anything.

## What still needs a human

**Before any manual pass: the app's own `Schema version` line must read `9`.**

- **M7's Windows half is still outstanding.** It must run **in the VM's
  console session**, not over SSH. The inputs survived the reinstall on Drive.
  M8 changed nothing under `src/print/`, so M8's exe prints through exactly
  M7's code:
  `powershell -ExecutionPolicy Bypass -File "G:\My Drive\Atzenta M7 evidence\run-windows-selftest.ps1" -Exe C:\Dev\Agenda-for-Teachers\src-tauri\target\release\teacher-planner.exe`.
  **`folder-A1-win.pdf` must be 6 pages.**
- **Type into M8's four screens**, on either OS. Nobody has. The five-minute
  script below.
- **Carried, still outstanding, not closed by M8:**
  - **Nobody has looked at a printed letter** (open since M5).
  - **No person has looked at M7's forms or folder, or typed into those
    screens.**
  - **Four of M6's six screens were never typed into** (*Εβδομάδα*,
    *Αναστοχασμός*, *Εκδρομές*, *Βιβλία & υλικά*), and **nobody has seen the
    progress matrix holding anything**.
  - **A genuine Explorer double-click, and therefore SmartScreen.** Scripting
    cannot reproduce it.

### The five-minute script, now with M8's part

M7's list with **part 8 added**:

1. **M2**: gradebook column, weight, marks, both export buttons.
2. **M3**: timetable hour, a class in a cell, a duty, a week's plan, Σημερινό,
   *Αντιγραφή ως κείμενο*.
3. **M4**: the month grid at 31 columns, an absence line, an incident, a
   support plan and two goals.
4. **M4.5**: all four export buttons, and open what comes out.
5. **M5**: walk *Γονείς & Ομάδα*, and **look at a printed letter**.
6. **M6**: walk *Πλάνο*'s seven sub-pages, and watch the matrix fill by itself.
7. **M7**: the folder and the forms, as in M7's note.
8. **M8.**
   - *Έτος*: check the three sub-tabs, and that *Σχολικό έτος* is the screen
     you know.
   - *Έτος → Επαφές σχολείου*: add three people. Search for one **without
     accents**, then by part of a phone number. Press *Νέα επαφή* while a
     search is showing, and the search should clear.
   - *Έτος → Αναπληρώσεις & άδειες*: add a cover and a leave **on the same
     date**. Both should stay, each in its own list.
   - *Ανάπτυξη & Ευεξία → Ανάπτυξη και καριέρα*: add two trainings. Type one
     cost as `12,50` (it should come back as `12.50`), leave the other blank,
     and type `δωρεάν` somewhere: it should refuse. Enter a budget and read the
     summary. **Check that the six annual goals are not here, and that the
     development goals are not on *Έτος*.**
   - *Ευεξία*: *Νέα καταχώριση*. It should be dated today and show its week.
     Write two lines, and fill the two boxes below.

## Known gaps

- **M7's Windows half**, as above. M8's own Windows half is done.
- **No human has typed into M8's screens**, and no human has seen them in a
  real window. They were exercised in jsdom and against the packaged build's
  database, not looked at.
- **The directory is linked to nothing.** Open questions 1 and 2.
- **No PDF from any M8 surface.** Open question 3.
- **A leave is a single date.** Open question 4.
- **No reordering** of contacts or development goals. `position` exists on
  both, so move up/down needs no migration.
- **Windows code signing is still unresolved**, unchanged, and still the
  nearest real-world blocker.

## A note on CI

The repository is public, so CI costs no minutes. The full gate was run
locally on the dev Mac before pushing, and the code and these docs go in **one
push**. No commit message on the branch carries the CI-skip marker in any
form. The VM was rebuilt partway through the milestone, so Windows steps 1–5 were
also run natively there after CI had passed. CI is confirmatory, not the
Windows evidence.

**CI was green on both runners on the first run.** That was run
[36045460325](https://github.com/Vibing101/Agenda-for-Teachers/actions/runs/36045460325)
at `98653b8`: `macos-latest` 5m53s and `windows-latest` 9m21s, both `success`,
with no retries. PR #1 on the public repository reported `mergeStateStatus:
CLEAN`. This commit, which records that, is docs-only and runs CI again rather
than skipping it.

The `paths-ignore: docs/**` / ubuntu-for-frontend proposal is noted a seventh
time and left alone. With free minutes it matters less than it did.
