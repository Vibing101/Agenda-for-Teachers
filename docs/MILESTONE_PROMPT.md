# The standing brief for a milestone agent

Every milestone prompt written for this project starts from this file. It holds
the parts that do not change between milestones — what to read, which machine
you are on, the language rules, the patterns already settled, and how the gate
is actually run now that a Windows VM exists.

A milestone prompt is therefore: **this brief, plus that milestone's own scope,
acceptance criteria and known traps.**

---

## 1. Work out which machine you are on — first, before anything else

Three machines can run work on this project and they can do different things.
Claiming a gate step from the wrong one is precisely the failure this project
keeps guarding against, so establish this before you plan anything.

On macOS:

```sh
uname -s                                     # Darwin
VBoxManage list vms | grep MilestoneTesting  # present => the dev Mac
```

On Windows, in PowerShell:

```powershell
$env:COMPUTERNAME                            # MILESTONETESTIN => inside the test VM
```

| Where | How you know | What it means for you |
|---|---|---|
| **The dev Mac** | `Darwin`, and `VBoxManage` lists `MilestoneTesting` | The normal place to work. Build and test on macOS, and **drive the Windows VM over SSH** for the Windows half of the gate — see [WINDOWS_VM.md](WINDOWS_VM.md) |
| **Inside the test VM** | `COMPUTERNAME` is `MILESTONETESTIN` | You are the Windows test target. Full gate natively, packaged builds, file-level cloud-folder checks. No repo credentials here by design |
| **The separate physical Windows PC** | Windows, different `COMPUTERNAME` | Hand-testing with a human present. At the M1 gate it had VS Code and Node but **no Rust toolchain or MSVC Build Tools** — verify before assuming you can build or package |

If none match, say so plainly and do not claim gate step 4 or 5 from it.

**State which machine you are on in your PR description**, and attribute each
gate result to the machine that produced it.

## 2. Read these in full before writing code

- **`docs/REBUILD_SPEC.md`** — the functional and architectural source of truth.
  Its **Resolved** table records calls already made: apply them, do not
  re-litigate them. Its **Open** section lists what is deliberately undecided.
  Read **Carried risks** too — those are live.
- **`docs/ENGINEERING.md`** — repo layout, branching, the six-step gate,
  sign-off, and **your milestone's acceptance criteria**. It is the only copy of
  all of those; the spec used to carry a second one and they drifted.
- **`docs/WINDOWS_VM.md`** — how the Windows half of the gate is run, what the
  VM can verify, and the two things that still need a human.
- **The release note for every milestone already shipped**, in
  `docs/milestones/`. They record decisions and patterns you are expected to
  follow rather than reinvent, and traps already paid for.
- **`reference/`** — the original source material, and the authority on wording,
  field lists and layout while a module is being built. **It exists only on the
  dev Mac**: it is git-ignored, was removed from the repository's history on
  2026-09-24, and the repository is public.

  **On the dev Mac, use it whenever a decision turns on what a source page
  says** — render the page and look, as M5 and M7 did. It is needed right up to
  M9, whose criteria include a side-by-side check of generated PDFs against the
  source's pages. It is read-only: never edit it, never generate into it.

  **Anywhere else — a fresh clone, the Windows VM, CI — it is not there.** Say so
  rather than guessing, and work from what is already in the repo: the content
  transcribed into `src/i18n/`, and the source pages quoted in the release notes.

  Three rules, all enforced by nothing but you:

  - **Never commit it, or any file from it.** The ignore rule stops `git add -A`;
    it does not stop `git add -f`. The planner PDF is a third party's copyrighted
    work and this repository is public. If a source file seems to be needed in
    the repo, ask the product owner.
  - **Build no dependency on it.** Nothing in `src/`, `src-tauri/`, `tests/` or CI
    reads from it at build time or run time, and nothing may start. Content the
    app needs is *transcribed into the repo* — the letters, the message bank and
    the forms' fixed text live in `src/i18n/`.
  - **Quote it in a release note rather than pointing at it.** When a decision
    turns on what a source page says, copy the sentence or the field list into
    the note. Nobody reading the public repository can open the folder.

## 3. Language — settled, not reopenable

The app ships **Greek-only through M1–M8**; English is one dedicated pass at
**M9**. That is sequencing, not scope — bilingual is still in the Resolved
table. So author no English, but hardcode no Greek either:

- every user-facing string is a string id in `src/i18n/el.ts`, read through
  `useTranslate()`;
- fixed reference vocabularies are stable codes in `src/i18n/vocabularies.ts`,
  labelled through `vocab.<kind>.<code>` — **the code is what the database
  stores**, never the label;
- teacher-entered data is never translated and renders exactly as typed;
- **eslint fails the build on a Greek literal** anywhere under `src/` outside
  `src/i18n/`. That rule is load-bearing. Do not weaken or exempt past it.

## 4. Patterns already settled — follow, don't re-derive

All recorded in the M1 release note:

- **Schema changes are forward migrations.** Add a `migrate_to_<n>`; never edit
  an earlier step. A data file from any previously shipped build must climb.
- **Commands:** one `load` returning the whole planner, and granular mutations
  that each re-read the file and return the whole planner. Every mutation goes
  through `mutate()`, which re-checks the file's content fingerprint *before*
  writing and runs the write in a transaction. There is deliberately no
  "save anyway".
- **Connections are opened per operation.** `journal_mode` stays `DELETE`,
  `synchronous` stays `FULL`, foreign keys stay `ON` with cascades.
- **Screens take `{ planner, run }`.** `run` returns the planner it read back,
  or `null` if the write did not happen. Forms use `useStoredDraft` so an
  unrelated save cannot wipe a half-typed field.
- **A create-then-edit flow tested only from an empty fixture is not tested.**
  The `Νέο τμήμα` data-loss bug at M1 survived 64 component tests for exactly
  this reason. Any "new record" button gets a test that starts from a planner
  that already has a record of that kind selected.

## 5. Running the gate

Steps 1–4 run wherever you are. Step 5 now has a real path on both OSes.

```sh
npm run typecheck && npm run lint && npm test
cd src-tauri && cargo fmt --all --check && cargo clippy --all-targets -- -D warnings && cargo test
```

**From the dev Mac, the Windows half is yours to run** — push a bundle to the VM
and drive it over SSH. You can do the full gate there, produce a real installer,
and run the file-level cloud-folder checks including the online-only placeholder
case. `WINDOWS_VM.md` has the commands.

### Before any manual pass: confirm the build in front of you is yours

Found at the M4.5 gate, after it produced a false bug report and cost an hour.

**A stale build with the same bundle identifier silently shadows the one under
test.** Every build of this app declares `CFBundleIdentifier`
`gr.atzenta.teacher-planner`. On macOS, double-clicking a copy while *another*
copy is running activates the running one instead — so at M4.5 a double-click of
the M4.5 build in a Drive folder opened the **M0** build from `/Applications`,
showing `M0 — shell & persistence` and `Schema version 1`. The M4.5 binary was
byte-identical to the branch build and entirely innocent.

Removing that copy was not enough: LaunchServices had accumulated **30
registrations for the one identifier** — every cloud test folder from M0 to
M4.5, every mounted `.dmg`, every build output, and the copy in the Trash. 23 of
them pointed at paths that no longer existed.

So:

- **Check the app's own `Schema version` line against the milestone's
  `user_version` before typing anything into it.** It is the cheapest possible
  proof that the window in front of you is the build under test.
- **Delete the previous milestone's test copies, and empty the Trash** — a
  trashed bundle is still registered.
- If a double-click opens the wrong build:
  `lsregister -dump | grep -c "Teacher Planner.app"` measures it, and
  `lsregister -kill -r -domain local -domain system -domain user` rebuilds the
  database — at the cost of resetting the machine's "Open With" defaults, so ask
  first. `lsregister` lives in
  `/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/`.
- **No automated step could have caught this**, which is why it survived four
  gates: every scripted launch uses `open -a <full path>` or the binary path,
  both of which resolve the bundle themselves. Only a human double-click goes
  through the identifier.

**Two things you cannot do from anywhere, and must hand back:**

- **A genuine Explorer double-click, and therefore SmartScreen.** `Start-Process`
  and `Shell.InvokeVerb("open")` both launch a Mark-of-the-Web-tagged unsigned
  build cleanly; only a real double-click is blocked. Scripting cannot reproduce
  it, in the VM or anywhere else.
- **Looking at the UI.** Typing real data into the milestone's new screens and
  seeing whether anything is clipped, misaligned or untranslated.

Report both as *not performed*, with who needs to do them. Never report a step as
passed that was not run, and mark clearly which results came from an agent and
which from a human.

## 6. Surfacing ambiguity

Where the spec leaves something genuinely open, **deliver something defensible,
state the assumption plainly, and ask in the PR description** — per
ENGINEERING.md's "Milestone sign-off". Resolved calls get recorded in the spec's
Resolved table; open ones go in its Open section so the next agent finds them.
Do not silently decide, and do not reopen what is already settled.

## 7. Finishing

- Branch `m<N>-<slug>`, one PR per milestone, no merge on failing CI.
- A dated release note in `docs/milestones/` from `TEMPLATE.md`, recording the
  real result of every gate step **including the ones you could not perform**.
- Be exact about verified versus assumed.
- Do not start the next milestone until this one passes its full gate.
