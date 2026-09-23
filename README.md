# Ατζέντα Εκπαιδευτικού — Teacher Planner

A small native desktop app for Windows and macOS that gives a teacher her whole
year in one place: classes and students, a weighted gradebook, a timetable and
weekly plans, attendance and behaviour, parent communication and staff meetings,
and printable letters and forms.

It is designed to be run from inside a Google Drive– or OneDrive–synced folder,
keeping all of its data as plain files in that same folder — no login, no
server, and no runtime for the teacher to install.

- **Spec:** [docs/REBUILD_SPEC.md](docs/REBUILD_SPEC.md) — the source of truth
  for scope, data model and already-resolved decisions.
- **Process:** [docs/ENGINEERING.md](docs/ENGINEERING.md) — repo layout,
  branching, the gate every milestone passes, and the acceptance criteria.
- **Briefing an agent:** [docs/MILESTONE_PROMPT.md](docs/MILESTONE_PROMPT.md) —
  the standing brief every milestone prompt starts from.
- **Windows testing:** [docs/WINDOWS_VM.md](docs/WINDOWS_VM.md) — the VM that
  runs the Windows half of gate step 5, and what still needs a human.
- **Release notes:** [docs/milestones/](docs/milestones/), one per milestone.

## Source material

This app implements a planner whose original source material — its wording,
field lists and page layouts — is **a third party's copyrighted work**, used
here only as a reference while building.

**That material is not part of this project and is scheduled for removal from
the repository.** The `reference/` folder still holds it today; it will be
deleted, and the repo will then carry only code, tests and documentation. Treat
it as already gone when planning work:

- **Never edit it, and never generate output into it.** Generated PDFs go to
  `exports/`.
- **Do not add a dependency on it.** Nothing in `src/`, `src-tauri/` or `tests/`
  reads from `reference/` at build time or at run time, and nothing should
  start. Content taken from it — the letter templates and the message bank —
  was transcribed into `src/i18n/` and the app reads it from there.
- **Do not redistribute it.** If you fork or publish this repo, remove the
  folder first.

## Stack

| Piece | Choice |
|---|---|
| Shell | Tauri 2 — Rust backend plus the OS's own web renderer, so there is no runtime for the teacher to install |
| Data | SQLite (`rusqlite`, bundled) at `data/planner.sqlite` |
| Frontend | React + TypeScript + Vite |
| Tests | Vitest + Testing Library (frontend), `cargo test` (Rust) |

## Language

The app ships **Greek-only through M1–M8**; the English translation is one
dedicated pass at M9 (product owner's call, recorded in the spec's Resolved
table). Bilingual is still the target — only the timing is settled.

So there are no English strings to author yet, but there are no Greek literals
in components either:

- every user-facing string is a string id resolved through one lookup
  ([`src/i18n/index.ts`](src/i18n/index.ts)), read in components via
  `useTranslate()`. The Greek bundle is assembled from three files, split by
  *kind* rather than by screen: [`el.ts`](src/i18n/el.ts) for the app's own
  labels, [`lettersEl.ts`](src/i18n/lettersEl.ts) for the 7 parent letters and
  [`messagesEl.ts`](src/i18n/messagesEl.ts) for the 150-message bank;
- fixed reference vocabularies (SEN categories, holiday sources, contact
  formats, …) are stable codes in
  [`src/i18n/vocabularies.ts`](src/i18n/vocabularies.ts), labelled through the
  same table — the **code** is what the database stores;
- teacher-entered data is never translated and is rendered exactly as typed;
- `eslint` fails the build on a Greek literal anywhere under `src/` outside
  `src/i18n/`, so a screen cannot quietly grow an untranslatable label.

Adding English at M9 is: write `en.ts`, `lettersEn.ts` and `messagesEn.ts` with
the same keys, add one line to `BUNDLES` in `src/i18n/index.ts`, and show the
toggle. No screen, document builder or domain module changes.

## Getting set up

Requires [Node.js](https://nodejs.org) 22+ and a
[stable Rust toolchain](https://rustup.rs).

```sh
npm install
npm run tauri dev     # run the app
```

## Checks

These are the same ones CI runs on both Windows and macOS.

```sh
npm run typecheck
npm run lint
npm test

cd src-tauri && cargo fmt --all --check && cargo clippy --all-targets -- -D warnings && cargo test
```

## Building the installable app

Each platform builds its own: **there is no cross-compiling here.** A `.exe`
must be built on Windows and a `.app` on macOS. The project's own route for the
Windows half is a VM on the development Mac — see
[docs/WINDOWS_VM.md](docs/WINDOWS_VM.md).

Everything below is run from the repo root, and `npm install` must have been run
first.

### macOS — `.app` and `.dmg`

**1. Install the toolchain**, once:

```sh
xcode-select --install                 # Apple's command line tools
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**2. Add both Mac architectures**, once. Releases ship as a **universal binary**
so the app runs natively on Intel *and* Apple Silicon instead of falling back to
Rosetta:

```sh
rustup target add x86_64-apple-darwin aarch64-apple-darwin
```

**3. Build:**

```sh
npm run tauri build -- --target universal-apple-darwin
```

**4. Collect the output** from
`src-tauri/target/universal-apple-darwin/release/bundle/`:

| File | What it is |
|---|---|
| `macos/Teacher Planner.app` | the app bundle — this is what the teacher runs |
| `dmg/Teacher Planner_0.1.0_universal.dmg` | the disk image, for handing over |

**5. Verify it is really universal**, because a single-architecture build
succeeds just as quietly:

```sh
lipo -archs "src-tauri/target/universal-apple-darwin/release/bundle/macos/Teacher Planner.app/Contents/MacOS/teacher-planner"
# expected: x86_64 arm64
```

To build for the current Mac's architecture only — faster, for local testing —
drop the `--target` and look in `src-tauri/target/release/bundle/`.

> **Unsigned.** The app is not code-signed or notarised, so the first launch
> needs a right-click → **Open** rather than a double-click. See *Carried risks*
> in the spec.

### Windows — `.exe` and the installer

**1. Install the toolchain**, once:

- [Microsoft C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
  with the **Desktop development with C++** workload — this provides the MSVC
  linker, and the Rust build fails without it;
- a [stable Rust toolchain](https://rustup.rs);
- [Node.js](https://nodejs.org) 22+;
- WebView2 — already present on Windows 10/11, so normally nothing to do.

**2. Build:**

```powershell
npm run tauri build
```

**3. Collect the output:**

| File | What it is |
|---|---|
| `src-tauri\target\release\teacher-planner.exe` | the bare executable |
| `src-tauri\target\release\bundle\nsis\Teacher Planner_0.1.0_x64-setup.exe` | the NSIS installer, for handing over |

**4. Confirm the signing status**, so it is never assumed:

```powershell
(Get-AuthenticodeSignature "src-tauri\target\release\teacher-planner.exe").Status
# expected today: NotSigned
```

> **Unsigned, and this one bites.** An unsigned build that carries Mark of the
> Web — anything downloaded, emailed, or delivered by some sync clients — is
> stopped by SmartScreen on a real double-click until the user clicks through
> *More info → Run anyway*. Verified twice on real machines. The installer is
> hit once; the app installed from it is untagged and starts cleanly afterwards.
> Code signing is an open decision — see *Carried risks* in the spec.

### After building

Both platforms write their data beside the binary, so the folder you copy the
app into becomes its home. To check a build is the one you think it is, open it
and read the **Schema version** line in the storage panel against the current
migration number — the cheapest guard against a stale copy shadowing a new one,
which has faked a bug on this project before.

## Where the app keeps its files

At runtime the app writes next to its own binary — the folder holding
`Teacher Planner.app` or `teacher-planner.exe`:

```
data/planner.sqlite      the single source of truth
data/backups/            automatic dated snapshots, thinned on a retention schedule
exports/                 generated PDFs
```

Both `data/` and `exports/` are gitignored: they are the user's content, not
part of the repo. To point a development build somewhere else, set
`TEACHER_PLANNER_DATA_DIR`.
