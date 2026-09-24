# M0 — Shell & persistence

> **Archived evidence (added 2026-09-24).** This repository's history was
> rewritten on 2026-09-24 to remove the third-party source package before it was
> made public. The pull requests, CI runs and commit hashes this note cites
> belong to the pre-rewrite repository, kept private as
> `Vibing101/Agenda-for-Teachers-archive`: links to them will not resolve here,
> and the hashes differ from this repository's. The note is otherwise left as
> it was written.

**Date:** 2026-09-19
**Branch:** `m0-shell-persistence`
**Signed off by:** Product owner, 2026-09-19.

## What shipped

- Tauri 2 app skeleton: Rust backend, React + TypeScript + Vite frontend, packaging
  config for a macOS `.app`/`.dmg` and a Windows `.exe`/NSIS installer.
- `data/planner.sqlite` created and migrated on first run, resolved relative to the
  folder the user actually sees — on macOS that means walking up out of
  `Teacher Planner.app/Contents/MacOS/`, not the executable's own directory.
- Dated backup snapshots in `data/backups/` on launch, every 30 minutes of an open
  session, and on clean shutdown; thinned to the spec's schedule (everything from
  the last 7 days, then one per day to 30 days, then one per month).
- Disk-changed detection: the data file is fingerprinted by content hash on every
  read, re-checked before every write, and a write against a changed file is
  refused. The UI shows a block-and-reload panel with no "save anyway" path.
- CI running the gate on both `windows-latest` and `macos-latest`.
- A `scratch_note` table and a single text box — a persistence probe so the
  write/quit/relaunch criterion is testable against a real write path. M1 replaces
  it with the real school-year/class/student schema.

## Decisions taken

| Decision | Call taken | Why |
|---|---|---|
| SQLite journal mode | `DELETE`, not the usual WAL | WAL keeps committed data in `-wal`/`-shm` sidecars. A sync client that uploads `planner.sqlite` alone, or at a different moment, would carry a torn database to the other device. In `DELETE` mode the file is self-contained at rest. `synchronous=FULL` for the same reason. |
| Connection lifetime | Opened per operation, not held for the session | Keeps the on-disk file the single source of truth, which is what makes the change-detection check meaningful. Data volumes here are tiny. |
| Change detection signal | SHA-256 of file contents | Size and mtime are too weak: a sync client can rewrite a file to the same length, and mtime can be preserved across a sync. |
| Snapshots stamped in the future | Kept, never deleted | Clock skew between two devices is realistic; deleting a teacher's backup over a clock difference is the worse failure. |
| Frontend framework | React + TypeScript + Vite | The spec said "keep it boring": this is the most documented Tauri pairing, so the next agent hits known ground. |
| Spec file location | Renamed to `docs/REBUILD_SPEC.md` | ENGINEERING.md's repo layout names that path; the file was committed under its original Greek title. Content unchanged. |

## Open questions for the product owner

All resolved at sign-off. Recorded here and in the rebuild spec's Resolved table
so they are not re-litigated by the next agent to touch this code.

**1. When the "disk changed" block fires — RESOLVED as implemented.** The block
fires when the data file changes *after the running app has read it*, which is
the case where work is actually lost. An edit made while the app was closed is
read fresh on the next launch, because that is the normal device-switch case and
blocking there would warn the teacher on essentially every switch. The M0
criterion's literal wording ("while the app is closed") is superseded by this.

**2. The Windows half of gate steps 4 and 5 — ACCEPTED by the product owner**
without an on-machine run. CI builds and structurally verifies the Windows
bundle on every push; the double-click-from-a-synced-folder run on Windows has
not been performed by a human. Carried forward as a risk, not a blocker — see
"Known gaps".

**3. The Excel grade registry in `reference/` was rewritten on disk mid-session**
(83KB → 131KB, same 14 sheets) by Google Drive, not by this work. Committed as
the new baseline on the product owner's instruction.

## Gate results (docs/ENGINEERING.md)

Run on macOS 15 (Darwin 25.6.0), Node 24.15.0, Rust 1.98.1.

| # | Step | Result |
|---|---|---|
| 1 | Typecheck clean | **Pass** — `npm run typecheck` |
| 2 | Lint clean | **Pass** — `eslint`, `cargo clippy --all-targets -D warnings`, `cargo fmt --check` |
| 3 | Automated tests pass | **Pass** — 21 Rust tests, 8 frontend tests |
| 3b | Persistence round-trip | **Pass** — `tests/cloud_folder.rs` drives launch → write → quit → relaunch → read against a real folder |
| 4 | Packaged build on Windows and macOS, structurally verified | **Pass on both** — CI run [35456474409](https://github.com/Vibing101/Agenda-for-Teachers/actions/runs/35456474409) green on `macos-latest` (5m48s) and `windows-latest` (18m27s); bundles uploaded as artifacts. Locally the macOS `.app`/`.dmg` was built and launched. The Windows `.exe` and NSIS installer are structurally verified but **not yet double-click launched by a human** |
| 5 | Manual launch test from inside a cloud-synced folder, both OSes | **macOS: pass**, from both a live Google Drive folder and a live OneDrive folder. **Windows: not done** — needs a human on the machine |
| 6 | This release note | **Pass** |

## Acceptance criteria for this milestone

| Criterion | Result | Evidence |
|---|---|---|
| App launches by double-click on both Windows and macOS from inside a folder actively synced by both Google Drive and OneDrive | **macOS: pass. Windows: not verified** | The `.app` was copied into a live Google Drive folder and a live OneDrive folder and launched through LaunchServices — the same path a double-click takes. It started from both, resolved its folder correctly out of the bundle, and created `data/`, `data/backups/` and `exports/` beside itself. No Windows machine is available to this agent. |
| Data written, then a full app quit and relaunch, still shows the data | **Pass** | Done in both cloud folders: wrote a Greek note, fully quit the app, relaunched, read it back intact (`Α1 — συνάντηση γονέων`, `Β2 — έλεγχος αποθήκευσης`). Also covered by `tests/cloud_folder.rs`. |
| A backup snapshot exists in `data/backups/` after a session; an old backup is thinned per the retention schedule | **Pass, with one part time-shifted** | A snapshot appeared in both folders on the second launch (e.g. `planner-2026-09-19-1952.sqlite`); the first launch correctly wrote none, as there was no data file yet. Thinning cannot be observed in a minutes-long session, so it is covered by 7 unit tests across each bucket boundary plus a test against a real directory that also confirms non-snapshot files are left alone. |
| Manually editing the data file's bytes while the app is closed, then reopening, triggers block-and-reload rather than a silent overwrite | **Accepted — implemented for a different trigger, confirmed at sign-off** | See "Open questions". The block fires when the file changes *after the running app has read it*, which is the case that actually loses work. An edit made while the app was closed is read fresh on the next launch, because blocking there would block every legitimate device switch. Covered by unit tests at the fingerprint layer (including a same-length edit, which size+mtime would miss) and component tests at the UI layer. |

## Known gaps

- **CI is green on both operating systems** — see run 35456474409 — so the build
  pipeline itself is proven on Windows. What is not proven on Windows is the
  part CI cannot do.
- **The Windows double-click-from-a-synced-folder run has never been performed.**
  Accepted by the product owner at sign-off rather than blocking M0. This is the
  precise failure mode that killed the previous attempt, so it stays on the list:
  every later milestone repeats gate step 5, and the first time anyone runs the
  app on a Windows machine it should be from inside a Drive- and a
  OneDrive-synced folder. If it fails there, it fails for a reason rooted in M0,
  not in whatever milestone is being worked on at the time.
- **The block-and-reload panel has not been seen by a human.** Its logic is
  tested on both sides, but nobody has watched the warning appear and clicked
  Reload in the running app. Worth a look the first time M1 puts real data behind it.
- macOS builds are unsigned and un-notarized, so Gatekeeper will need a
  right-click → Open on first launch. Worth a product-owner decision before M9
  about whether to pay for a Developer ID certificate.
- The `scratch_note` probe is scaffolding and is replaced in M1.


---

## Addendum — 2026-09-19, after sign-off

Two follow-ups agreed after M0 was signed off. Neither changes what M0 delivered;
both narrow the risk it was signed off with. Branch `m0-ci-hardening`.

**macOS now ships a universal binary.** The signed-off build was x86_64 only,
which runs on an Apple Silicon Mac solely via Rosetta. Release builds now use
`--target universal-apple-darwin` and CI asserts with `lipo -archs` that both the
`x86_64` and `arm64` slices are present. Verified locally: both slices, 8.3MB
bundle — still comfortably inside the "single-digit megabytes" the spec promised
as the reason for choosing Tauri over Electron.

**Windows CI now launches the app instead of only building it.** On every push it
copies the real binary into a path shaped like the user's own — Greek characters,
spaces, deep nesting, mirroring `My Drive\Ατζέντα Εκπαιδευτικού` — launches it,
and checks that it stays open, creates `data/planner.sqlite` beside itself, and
writes a dated backup snapshot on a second launch. The equivalent smoke launch
runs on macOS too.

**That check immediately found something.** The first version of it also applied a
`Zone.Identifier` stream — a Mark-of-the-Web tag — before launching, to mirror how
the teacher will actually receive the app. It failed: Windows refused to start the
unsigned binary unattended. This is not a CI artefact. On a real machine it is
SmartScreen's "Windows protected your PC" dialog, and the app only starts if the
user picks *More info → Run anyway*. So the Mark-of-the-Web case is now its own CI
step that **asserts the blocked state as a tripwire** — if it ever launches
cleanly, signing has landed and the expectation must be flipped. The practical
consequence is that Windows code signing moved from "polish, revisit at M9" to
something needing a decision before the app reaches the teacher; it is recorded
under Carried risks in the rebuild spec.

To support that, the data file is now created and migrated eagerly at launch
rather than lazily on the first command. It matches the spec's wording ("SQLite
database file created on first run") more closely, and it makes the file's
appearance a meaningful signal that the app resolved its folder and wrote to it.

**What this deliberately does not claim.** Gate step 5 is still not passed on
Windows. CI cannot install Google Drive or OneDrive, so it cannot test
**online-only placeholder files** — the case where a sync client leaves a file
that looks present but whose contents are not on disk until touched. That remains
the most plausible remaining explanation for what killed the previous attempt,
and it still needs a human on a real Windows machine. The risk is narrowed, not
closed, and stays recorded under "Carried risks" in the rebuild spec.

---

## Correction — 2026-09-20, after the M1 Windows gate run

Two statements in the addendum above are now known to be wrong, and are
corrected here rather than edited out, so the record shows what was believed at
the time and why it changed. Both were found by running the gate on a physical
Windows 11 machine at M1.

**1. "It failed: Windows refused to start the unsigned binary unattended. This is
not a CI artefact." — Withdrawn. It was a CI artefact.** On a real machine with
SmartScreen on, both `Start-Process` and `Shell.InvokeVerb("open")` launch a
Mark-of-the-Web-tagged unsigned build *cleanly, with no dialog*. Only a genuine
Explorer double-click is blocked. A headless runner also has no interactive
desktop on which the dialog could appear. So the CI step was passing for a
reason unrelated to SmartScreen, and its "tripwire" could never have fired
correctly — worse, had signing ever landed it would have failed the build and
reported the opposite of the truth. That assertion has been removed; the step is
now informational only.

**The underlying risk is unchanged and still real** — it now rests on the
real-machine observation instead: a double-click of the tagged unsigned build
does show "Windows protected your PC", and the app does not start without
*More info → Run anyway*. One thing that run also established: the NSIS
installer does **not** propagate Mark of the Web to the exe it extracts, so the
prompt hits the installer once, not the app the teacher opens every day. See
"Carried risks" in the spec.

**2. "Gate step 5 is still not passed on Windows ... online-only placeholder
files."** — Now partially closed. At the M1 gate this was performed on a real
Windows machine from a **OneDrive** folder, with the files verified genuinely
dehydrated before launching: the app hydrated them on demand, opened, stayed
open, and lost no data. **The Google Drive half remains open**, since that is a
different streaming mechanism and the client was not installed on that machine.
Full detail in
[`2026-09-19-m1-school-year-classes-students.md`](2026-09-19-m1-school-year-classes-students.md).
