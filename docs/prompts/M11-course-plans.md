# M11 — Ministry course plans (Προγραμματισμός)

You are picking up a shipped project: a native Tauri desktop app for a Greek
teacher's planner ("Ημερολόγιο Εκπαιδευτικού"). M0–M10 are merged and signed
off, and the app is at **v1.0.2, schema `user_version = 11`**. Your task is
**M11**, the first feature milestone after handover. It reworks the Πλάνο
section's annual plan around the documents the Cyprus Ministry of Education
issues for every subject.

**START BY READING `docs/MILESTONE_PROMPT.md` IN FULL.** It is the standing brief
for every milestone agent on this project: how to work out which machine you are
on and what that machine may claim, what else to read, the language rules, the
patterns already settled, and how the gate is run. All of it applies to you.
**Do its section 1 before you plan anything.**

Then read, in this order: `docs/SPEC.md` (especially its **Resolved** table,
its **Open** section and its **Carried risks**), `docs/ENGINEERING.md`,
`docs/WINDOWS_VM.md`, and every release note in `docs/milestones/`. These notes
matter most to you:

- **M6** built the surfaces you are replacing: units, the annual plan as a view
  of them, and the progress matrix as a view over weekly plans.
- **M3** keyed weekly plans by the actual Monday rather than a week number.
- **v1.0.1** built `dayOff()` and per-lesson counting from the timetable. You
  will reuse both.
- **M10** decided that the annual plan does **not** print. This milestone
  reverses that call for the new Προγραμματισμός sheet (see "Decisions already
  taken").

**The Windows half of the gate may not be available.** At M10 (2026-09-25) the
`MilestoneTesting` VM's `sshd` service had vanished, and the Windows half was
skipped. Check whether it has been restored before you plan around it. If it
has not, say so and do not claim Windows results.

---

## Why this milestone exists

Every Cyprus teacher assigned a class for a subject gets Ministry documents for
it and plans the year from them. The product owner supplied six samples for the
2026–2027 year, in two families:

- **Γενική Εκπαίδευση** (e.g. Μαθηματικά Β΄ Γυμνασίου): one *Προγραμματισμός*
  **per τετράμηνο**. The same subject exists in **variants** with different
  periods per week and weights. The samples cover four: standard (4
  periods/week, εξεταζόμενο, term worth 35% of the year) and *Μεταναστευτικής
  Βιογραφίας* (6 periods/week, μη εξεταζόμενο, 50%), each for Α΄ and Β΄
  τετράμηνο.
- **Τεχνική Εκπαίδευση / ΤΕΣΕΚ** (e.g. Τεχνολογία και Εργαστήρια Μαγειρικής
  Τέχνης, Β΄, Μάγειροι–Τραπεζοκόμοι, 7 periods/week): one year-long *Πλαίσιο
  Αναλυτικού Προγράμματος* (numbered units and sub-units with periods, total
  210, plus numbered *Σημειώσεις*), and one *Πλαίσιο Μάθησης* **per τετράμηνο**
  (aims, learning outcomes, which units are taught and examined that term, and
  the assessment forms).

**The samples are not in the repository and must not be committed.** The repo
is public. Build test fixtures as **synthetic text in the same shape**. The
structure is described below in enough detail to do that.

### The shared skeleton

| Part | Γενική | ΤΕΣΕΚ |
|---|---|---|
| Header | school year, term, grade, variant, subject, periods/week, εξεταζόμενο or not, textbooks, materials | κατεύθυνση, κλάδος, grade, ειδικότητα, subject, periods/week, εξεταζόμενο |
| Aims | a sentence plus a URL to the Ministry's general aims | a paragraph (*Γενικοί σκοποί και στόχοι*) |
| Learning outcomes | a sentence plus a URL to the curriculum | a full bullet list per term, grouped by unit in practice but not labelled as such |
| Assessment | the term's weight of the year (35% / 50%); **Μορφή Α΄** (2 tests of 40–45 min, 2 ten-minute quizzes) and **Μορφή Β΄** (participation, homework, project, other) side by side | *Γραπτή* (up to two 40-minute tests) and *Συντρέχουσα / Προφορική* (a bullet list) |
| Units | `1. ΓΕΩΜΕΤΡΙΑ (Ενότητα 3)`, then `▪` subtopics, then a period count | `7 ΨΑΡΙΑ ΚΑΙ ΘΑΛΑΣΣΙΝΑ 21`, then `7.1 …`, `7.2 …` (and deeper: `4.1.1`) |
| Non-teaching rows | `Επανάληψη 6` | `ΑΞΙΟΛΟΓΗΣΗ / ΤΕΛΙΚΗ ΠΡΑΚΤΙΚΗ ΕΞΕΤΑΣΗ 14`, `ΕΠΑΝΑΛΗΨΗ / ΚΑΘΑΡΙΟΤΗΤΑ ΕΡΓΑΣΤΗΡΙΟΥ 14`, `ΠΑΡΑΘΕΣΗ ΜΕΝΟΥ 28` |
| Notes | exclusions highlighted in red, e.g. *(Δεν θα διδαχθεί η μέθοδος υπολογισμού τετραγωνικής ρίζας με προσέγγιση)* | a numbered *Σημειώσεις* block at the end |
| Total | `Σύνολο περιόδων 91` | `ΣΥΝΟΛΟ 210` |

### Four facts the design has to respect

1. **The periods are a budget that fills the term.** 91 ÷ 6 ≈ 15 weeks,
   60 ÷ 4 = 15, 85 ÷ 6 ≈ 14, 57 ÷ 4 ≈ 14, and 210 ÷ 7 = 30. Checking the budget
   against the real calendar is the main new value this milestone adds.
2. **A textbook chapter spans terms.** *Γεωμετρία (Ενότητα 3)* is unit 4 in
   term Α΄ (Συμμετρία … Τετράγωνο) and unit 1 in term Β΄ (Τραπέζιο … Κύκλος). The
   book reference is a label and must never be used as a key.
3. **The numbering is irregular.** The cooking framework has two items
   numbered `5.5` and goes from `6.4.2` to `6.4.4`. **Store every number as
   text, exactly as written.** Never validate, renumber or "fix" it.
4. **One plan serves several classes.** A teacher with three sections of
   Μαθηματικά Β΄ follows one Ministry plan, at three different paces.

---

## What the current module does, and why it falls short

`src/domain/units.ts` stores `unit` rows **per class**, every field free text,
and the annual plan (`annualPlan()`) is a view of them.
`src/screens/AnnualPlanScreen.tsx` shows that table above the unit cards.

- **The plan is per class, but the Ministry's plan is per course.** Three
  sections mean typing it three times. This project treats that as a defect
  (M6's first criterion).
- **`period` and `hours` are strings**, so nothing can be totalled or checked
  against a term.
- **There are no subtopics.** The Ministry's real unit of work has nowhere to
  live, so neither the weekly plan nor the progress matrix can say where a
  class is.
- **The header, the variant, the per-term assessment scheme, the outcomes and
  the Ministry's notes and exclusions have no home.**

---

## What to build

### 1. A course plan, shared by classes (schema 12)

Add a **course plan** (*Προγραμματισμός μαθήματος*). It is independent of any
class, and many classes point at it.

```
course_plan
  id, position, subject, grade, variant, stream   -- stream: κατεύθυνση/κλάδος/ειδικότητα, free text
  periods_per_week (integer, nullable), examined (boolean)
  aims, aims_ref, outcomes_ref, materials, ministry_notes   -- free text; *_ref are URLs kept as text
course_plan_textbook (plan_id, textbook_id)       -- links to the existing Σχολικά βιβλία list
course_plan_term                                  -- one per (plan, grading_period ordinal) actually used
  plan_id, term_ordinal, year_weight (text), assessment_a, assessment_b, outcomes
plan_unit                                         -- replaces `unit`
  id, plan_id, position, number_label (text), title, book_ref,
  term_ordinal (nullable = whole year), periods (integer, nullable),
  kind: 'teaching' | 'review' | 'assessment' | 'other',
  notes (exclusions/remarks),
  + every free-text field today's `unit` has (objectives, skills, methods,
    assessment, content, materials, differentiation, review, deadlines)
plan_subtopic
  id, unit_id, position, number_label (text), title
class.course_plan_id  (nullable, ON DELETE SET NULL)
```

- **`kind` is a stable code** labelled through `vocab.planUnitKind.<code>`,
  like every other vocabulary on this project.
- **`term_ordinal` refers to the existing grading periods**
  (`grading_period.ordinal`, 1–3). Cyprus secondary schools use two τετράμηνα.
  Do not invent a second list of terms.
- **Deleting a class never deletes a plan.** Deleting a plan that classes still
  use must ask first, and say how many classes use it.
- **"Αντιγραφή ως παραλλαγή"** duplicates a plan with all its terms, units and
  subtopics, for the Μεταναστευτικής Βιογραφίας case.
- **The free-text layer the teacher already uses stays.** The Ministry
  skeleton (number, title, subtopics, periods, notes) and the teacher's own
  elaboration (objectives, methods, differentiation …) live on the same unit,
  in two visibly separate parts of the card.

### 2. Migration: `migrate_to_12`, and nothing may be lost

Every class that has `unit` rows gets **its own** course plan: subject from the
class card, the class pointed at it, and its units moved over field for field.

- `hours` becomes `periods` **only if the whole trimmed string is an integer**.
  Otherwise `periods` stays null and the original text is kept, appended to
  `notes` with a label, and shown on the card.
- `period` (free text such as "Οκτ.–Νοε.") has no term to map to. Keep it
  verbatim in `notes` the same way. Do not guess a term from month names.
- `position`, `id` order and every other field survive unchanged.

Test it the way v1.0.1 tested migration 11: a schema-11 file with awkward units
(non-numeric hours, empty units, two classes with identical titles) climbs to
12, with record-level equality on everything that should not change.

### 3. The Προγραμματισμός screen

This replaces the M6 page *Πλάνο → Ετήσιο πλάνο*. Keep the page key, so links
and the Today view do not break, and rename its label if you judge it clearer.

- Pick a plan, not a class. Each plan shows which classes use it. Assigning a
  class to a plan also happens here, as well as on the class card.
- The header fields, the per-term tabs, and the units in order, each with its
  subtopics, periods, kind and notes. Notes and exclusions are visually marked,
  as the Ministry marks them in red.
- **Totals per term and for the year**, computed and never typed.
- **The period budget per term, for each class using the plan** (section 4).

### 4. The period budget, and pacing by week

**The product owner's call: pacing is by week, not per lesson.** Weekends,
holidays and the teacher's leave are already in the app, so lost lessons are
computed, never entered.

- **Available lessons for a class in a term** = for each date in the grading
  period's range, the class's timetable hours that weekday, skipping every date
  `dayOff()` reports. **Reuse `dayOff()` from `src/domain/attendance.ts`**, or
  lift it into a shared module if two domains now need it. Do not write a
  second definition of a day off.
- The screen shows **planned vs available** per term and per class, plus how
  many lessons the term's holidays and leave cost. For example: "Προγραμματισμένες
  91 · Διαθέσιμες 86 (−7 λόγω αργιών)".
- **Derived schedule.** Walk the term week by week, consume units' periods in
  order against that week's available lessons, and show each unit's resulting
  **date span**. It is a view: **nothing about it is stored**. Adding a holiday
  pushes later units later with no row written. This is the M1/M3 rule (no
  stored week index), and it is the point of the feature.
- **What was actually covered** is recorded **on the weekly plan**: the weekly
  plan screen gains a list of the class's plan subtopics to tick for that week.
  Store it as `lesson_plan_subtopic (class_id, week_monday, subtopic_id)`,
  keyed by the actual Monday like `lesson_plan`. **This is the only progress
  record.** There is no separate progress table.
- **Ahead / behind** per class = where the ticks have reached vs where the
  derived schedule says the class should be this week. Show it on the plan
  screen and as a cell hint in the progress matrix
  (`src/domain/progress.ts`). The matrix must still read no second copy of
  anything.
- The Today view may show the next unticked subtopic for each of today's
  classes. It still writes nothing.

### 5. Paste to import

Nobody should retype a four-page Ministry document.

- The teacher copies the PDF's text from any viewer and pastes it into an
  *Εισαγωγή από κείμενο* box. A **pure** parser in `src/domain/` turns it into a
  proposed set of units (number label, title, book ref, periods, kind guess,
  subtopics) plus a detected total.
- **She always reviews the result before anything is saved.** The preview is
  editable, and the detected total is compared with the sum of the parsed
  periods, with the mismatch shown when they differ.
- It must cope with both families: `▪` bullets with the period count on its own
  line, and `7.1`-style sub-units with the count at the end of the unit's line.
  It must also drop repeated page furniture (headers, `Σελίδα 1 από 4`, the
  ministry banner).
- Header fields, assessment text and outcomes may be pasted into their own
  boxes as plain text. Parsing them is **not** required.
- **Importing a PDF file directly is out of scope** (see "Not in M11"). Paste
  needs no new dependency, and these PDFs have a text layer, so copying works.

### 6. The printed Προγραμματισμός

**The product owner's call: it prints**, because teachers hand it in.

- One sheet per plan **per term**, laid out like the Ministry's own document:
  the header block, the assessment block (Μορφή Α΄ | Μορφή Β΄, or Γραπτή |
  Συντρέχουσα), then the table `ΕΝΟΤΗΤΕΣ | ΠΕΡΙΟΔΟΙ` with subtopics under each
  unit and notes emphasised, then *Σύνολο περιόδων*.
- One extra column, **the derived date span**, which the teacher can switch
  off. The Ministry's document is *ενδεικτικός*. Hers is the dated one.
- For a year-long ΤΕΣΕΚ plan, add one whole-year sheet as well.
- Build it on the existing document contract (`src/print/document.ts`,
  `paginate.ts`, `sheetParts.ts`, `ExportButton`). Portrait is likely.
- The sheet and the screen **call the same selectors**, the M4.5 rule. A sheet
  never recomputes a total or a span.

---

## Decisions already taken (product owner, 2026-09-26)

Copy these into the spec's Resolved table:

| Decision | Call |
|---|---|
| Does the Προγραμματισμός print? | **Yes**: teachers submit it. Reverses M10's "M6's annual plan does not print" **for this sheet only**. The exam tracker, trips, textbooks and the progress matrix still do not print |
| Pacing granularity | **By week.** Coverage is ticked on the weekly plan. Lost lessons come from weekends, holidays and leave already in the app |
| Assessment scheme vs gradebook | **Independent.** The plan's assessment text and year weight are stored and printed, and **nothing in the gradebook reads them or is seeded from them** |

The third is testable as **insensitivity**, the M4.5 pattern: fill every
assessment field on a plan and assert that every gradebook selector's output is
unchanged. Confirm the test fails against deliberately broken code.

---

## Not in M11 — do not build, list in the release note

- **Sharing a plan with colleagues as a file** (export one plan, import it on
  another teacher's app). The product owner did not settle this, so it is
  **open**. Record it in the spec's Open section, worded plainly: *"Should a
  teacher be able to save a course plan to a file and give it to a colleague
  who teaches the same subject, so only one person in the department types
  it?"*
- Importing a PDF file directly, or attaching the original PDF to a plan.
- Any link from the plan's assessment scheme to grades or the exam tracker.
- Per-lesson pacing, and extra lessons the timetable does not schedule (still
  open from v1.0.1).
- Any network call, including fetching the curriculum URLs. They are stored as
  text.

---

## The traps specific to M11

### 1. Two classes, one plan, two paces

The plan is shared and the progress is not. The regression that matters:
ticking a subtopic for class A leaves class B's ticks, derived schedule and
ahead/behind **byte-for-byte unchanged**, and editing a subtopic's title once
shows in both. Test both directions.

### 2. A class that changes plan

Ticks point at subtopic ids. If a class is moved to another plan, **keep the
old ticks** (they are history), count only ticks on the current plan's
subtopics, and let moving back restore them. Deleting a subtopic or a plan
cascades its ticks. Say so in the deletion prompt.

### 3. No stored week, anywhere

The derived schedule, the budget and ahead/behind are functions of `(planner,
today)`. **`today` is an argument** passed down from the shell. Never call
`new Date()` or `todayIso()` in a component or a domain module. A test should
move the school year's start date and a holiday and assert that no stored row
changed.

### 4. The parser is a heuristic, so its tests are fixtures

Write synthetic fixtures in both shapes, including the irregular numbering
(`5.5` twice, missing `6.4.3`), a red-note line, page furniture repeated
mid-list, a unit with a book ref, `Επανάληψη` as a non-teaching row, and a
total that does **not** match the sum. Assert exact output. The parser must
never throw on garbage; it returns what it could, plus warnings.

### 5. Create-then-edit, again

*Νέος προγραμματισμός*, *Νέα ενότητα*, *Νέα υποενότητα*, *Αντιγραφή ως
παραλλαγή* and the import's *Αποθήκευση* are all "new record" buttons. Each
gets a test **starting from a planner that already holds records of that kind,
one of them selected**, asserting that the siblings come back unchanged. The
M1 data-loss bug is why.

### 6. Hard rules still apply

No Greek literal under `src/` outside `src/i18n/`. Every new string must exist
in **both** `el.ts` and `en.ts` (the parity test enforces it). Counts are
`.one`/`.other` pairs. Dates are formatted by the app. Teacher text is never
translated. Schema changes are forward migrations only.

### 7. Update the teacher's guide

`docs/user/user-guide.md` and `workflow.md` describe the M6 annual plan. Rewrite
those sections in Greek for the teacher, including how to paste a Ministry
document in and what the budget numbers mean.

---

## Acceptance criteria for M11

They are also in `docs/ENGINEERING.md`. Quote them in your release note with the
evidence:

- One course plan assigned to two classes: a unit or subtopic edited once shows
  for both, and a subtopic ticked on one class's weekly plan leaves the other
  class's progress unchanged.
- On a test dataset with a known timetable, grading periods, holidays and
  leave, the available lessons per class per term equal a hand-computed figure.
  Adding a holiday on a teaching day lowers it by exactly that class's lessons
  that day and moves later units' derived spans later, with no stored row
  changed.
- Pasting synthetic text in both Ministry shapes (Γενική per-term, ΤΕΣΕΚ
  year-long) yields the expected units, subtopics, periods and total, with
  irregular numbering preserved verbatim.
- The printed Προγραμματισμός generates a real PDF that renders Greek, and its
  units, periods, totals and date spans match the screen.
- A schema-11 data file with units migrates to schema 12 with every unit's text
  intact.
- Filling a plan's assessment scheme changes no gradebook output.

---

## Process

- **Branch `m11-course-plans`. One PR. No merge on failing CI.** Check the
  GitHub Actions minutes left before your first push. Run everything locally
  first and batch fixes. The `[skip ci]` caveats in the M5 prompt still apply.
- Version **`1.1.0`** in all three manifests once signed off, plus the Greek
  guides' version and schema lines, and the upgrade warning (schema 12 cannot
  be opened safely by 1.0.x).
- A dated release note in `docs/milestones/` from `TEMPLATE.md`, recording the
  real result of every gate step, attributed to machine and agent-or-human.
- **Still needs a human, and you should ask for it:** someone pasting a real
  Ministry document (the product owner has six), and someone holding the printed
  sheet next to the Ministry's original. Before any manual pass, check the
  app's *Schema version* line reads **12** (the stale-build hazard in
  `docs/MILESTONE_PROMPT.md`).
