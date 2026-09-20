# M1 — branch commit log

The branch `m1-school-year-classes-students` was squash-merged into `main` as
**`ac61eb4`** on 2026-09-20 and then deleted. Squashing collapsed its nine
commits into one, so the individual messages below — which record *why* each
step was taken — would otherwise have been lost. They are kept here because this
project's practice is to write decisions down rather than rely on history being
browsable later.

Nothing here is live documentation. What M1 shipped, what was decided, and what
is still open live in
[`2026-09-19-m1-school-year-classes-students.md`](2026-09-19-m1-school-year-classes-students.md)
and in the spec's "Carried risks".

Verified before the branch was deleted: `main`'s tree was byte-identical to the
branch tip `c7b9931` (`b6b141d6d9dd5c1d7873921c9b16cc0e8d1fbbef`), so no content
was lost with it.

---

## Replace M0's scratch table with the M1 schema, store and commands, migrating forward from user_version 1

- **Commit:** `f6bf470` (`f6bf470dabfc13739a83d3db1910fd0cc1fa2a98`)
- **Author:** Kyriakos
- **Date:** 2026-09-19T23:19:08+03:00

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## Route every user-facing string through one id-keyed lookup, and fail lint on an inline Greek literal

- **Commit:** `983f821` (`983f821505c3d345a5754276ef12b165e47517ca`)
- **Author:** Kyriakos
- **Date:** 2026-09-19T23:19:08+03:00

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## Build the year, classes and students screens, deriving weeks and months from the start date

- **Commit:** `11ff3ae` (`11ff3ae91df635a621fc45535c7ef921ca3e05a5`)
- **Author:** Kyriakos
- **Date:** 2026-09-19T23:19:08+03:00

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## Cover the three M1 acceptance criteria with unit and component tests

- **Commit:** `d655315` (`d655315b247a7dd7ea04fa4299bbf014a67f25fb`)
- **Author:** Kyriakos
- **Date:** 2026-09-19T23:19:08+03:00

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## Keep a half-typed form from being wiped when an unrelated save replaces the planner

- **Commit:** `d526143` (`d526143aef4a24203ae98ea1d5b2d1a6138c815a`)
- **Author:** Kyriakos
- **Date:** 2026-09-19T23:21:00+03:00

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## Record the Greek-first/M9-English timing decision and write the M1 release note

- **Commit:** `234a845` (`234a8457fe133174c7a0b11f2c2da289e0fccf05`)
- **Author:** Kyriakos
- **Date:** 2026-09-20T00:08:18+03:00

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## Record the green CI run in the M1 release note

- **Commit:** `86edcd9` (`86edcd96db1cf60985f8cd7f44d3d04fe3cacddf`)
- **Author:** Kyriakos
- **Date:** 2026-09-20T00:16:54+03:00

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## Record the M1 Windows gate run: OneDrive and placeholders pass, Drive still open

- **Commit:** `9896484` (`9896484afee3606d88db55d93463dfc14360a0d4`)
- **Author:** Kyriakos Savvides
- **Date:** 2026-09-20T10:15:20+03:00

Gate step 5 was finally run on a physical Windows machine against the packaged
build from CI run 35469528187. Results in the M1 release note and the spec's
carried risks.

What passed: double-click from a Greek-named OneDrive folder; the online-only
placeholder case, verified genuinely dehydrated (0 bytes on disk) and launching
with no hang, no second database and no data loss; real data typed into the
packaged UI and surviving a restart with per-class support flags distinct;
backups with no -wal/-shm sidecars; and the block-and-reload panel, watched by a
human for the first time.

What did not: the Google Drive half, because that client is not installed on the
machine used. Drive streams differently from OneDrive, so the result does not
carry over.

Two findings. Nevo tmima ("Neo tmima") leaves the editor bound to the previously
selected class, so creating a second class and typing a name renames the first
one instead -- confirmed silent data loss, not fixed here. And the CI
Mark-of-the-Web tripwire does not actually measure SmartScreen: Start-Process
and InvokeVerb both launch a tagged build cleanly, only a real Explorer
double-click is blocked, so the "confirmed by CI" claim is withdrawn while the
risk itself is confirmed on hardware.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

## Select the record a new-record button just created, instead of the old one

- **Commit:** `c7b9931` (`c7b99316cad930989b268f2e9479e00ab7d110b2`)
- **Author:** Kyriakos Savvides
- **Date:** 2026-09-20T10:29:03+03:00

Found by driving the packaged Windows build by hand at the M1 gate. Pressing
"Neo tmima" created a class but left the editor bound to whichever class was
selected before, so typing a name and saving -- the obvious next gesture --
renamed the existing class and left the new one empty. The student button had
the identical defect, where it would have overwritten a whole card, guardians
and SEN included.

Neither button moved the selection to the record it had just created. The
"keep a sensible selection" effect only reassigns when the current selection is
gone, and creating a record does not invalidate the old one, so the editor
stayed mounted on it and the save wrote with its id.

Run now hands back the planner it read from disk, or null if the write did not
happen, so each button can find the row the backend assigned an id to and
select it. Every other caller ignores the result.

Both existing creation tests start from an empty planner, which is the one case
where the selection effect compensates -- that is why 64 component tests never
caught this. The two regression tests added here start with a record already on
file and were confirmed to fail against the unfixed code.

Verified on Windows: typecheck clean, lint clean, 66 tests pass. Not yet
exercised in a repackaged build; that machine has no Rust toolchain.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>

---

