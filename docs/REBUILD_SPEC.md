# Ατζέντα Εκπαιδευτικού — Rebuild Spec (Teacher Planner v2)

This document specifies a from-scratch rebuild of the "Ατζέντα Εκπαιδευτικού" (Teacher's Agenda) — a Greek teacher's planner currently sold as a 289-page fillable Adobe Acrobat PDF, plus companion files (a grade-registry spreadsheet, 11 print templates, 7 parent letters, and a 150-message bank). It is written for AI developer agents to implement without needing further clarification from the product owner on the decisions recorded here.

A previous attempt (React/TypeScript/Vite, browser-only, single self-contained HTML file, IndexedDB + portable JSON) did not survive being moved into a cloud-synced folder — the HTML file would not open at all once relocated. This document does not inherit that project's architecture, module order, or scope decisions; it starts clean, targets full functionality across every module in the source product (not a cut-down MVP), and resolves the failure mode directly: **the deliverable is a small native desktop application** — not a bare HTML file opened via `file://` — requiring no separately-installed runtime, built for both Windows and macOS, designed to be launched from inside a folder synced by Google Drive or OneDrive, with all data (including backups) kept as plain files in that same folder.

The end user is a single non-technical person (a teacher). There is no login, no multi-user access, and no server-side component of any kind: all data stays on whichever device the app happens to be running on, synced only via the user's own cloud storage folder — one device active at a time, never two at once.

## Architecture

### Why the previous approach failed

A bare `.html` file opened via `file://` from inside a Google Drive– or OneDrive–synced folder is fragile in exactly the way that bit us: sync clients can leave a file as an online-only placeholder, replace-rather-than-edit a file on write (breaking any browser-remembered file handle instantly), or interact badly with a given OS's file-association and security-zone handling. None of this is reliably fixable purely in the browser — it needs a real, installed-feeling application that owns its own file I/O instead of depending on a browser tab's permissions model.

### Chosen architecture: a small native desktop app

Built with **Tauri** (Rust backend + the operating system's own web renderer for the UI — WebView2 on Windows, WKWebView on macOS). This is the concrete way to satisfy every constraint given:

- **No separately-installed runtime.** The Rust backend compiles directly into the app binary — there is no Node.js or Python for the user to install. WebView2 ships as part of Windows 10 (1803+) and Windows 11 by default; WKWebView is a standard macOS system framework. Neither needs a separate install on a normal, up-to-date machine.
- **Cross-platform.** Tauri produces a native `.exe` for Windows and a native `.app` for macOS from one codebase. Both are built and tested as part of every release.
- **Small footprint, unlike Electron.** Because it uses the OS's existing web renderer instead of bundling a full Chromium, the resulting app is on the order of single-digit-to-low-tens of megabytes rather than the 150MB+ typical of an Electron app — friendlier to sync across a cloud-storage folder on a slow connection.
- **Real file access.** The Rust side reads and writes the data file directly on disk — no browser sandbox, no dependence on the File System Access API or a remembered file handle. This is what makes the "launch from device 1, edit, close, later launch from device 2 once the cloud sync has caught up" workflow actually reliable: the app just opens whatever file is sitting in the folder at that moment.

### Folder layout

The user keeps one folder in their cloud storage (Drive or OneDrive), containing:

```
Ατζέντα Εκπαιδευτικού/
├─ Teacher Planner.exe        ← Windows build
├─ Teacher Planner.app/       ← macOS build (as a folder bundle, per macOS convention)
├─ data/
│   ├─ planner.sqlite          ← the single source of truth
│   └─ backups/
│       ├─ planner-2026-09-19-0730.sqlite
│       └─ …                   ← automatic dated snapshots (see below)
└─ exports/                    ← generated PDFs land here (letters, forms, reports)
```

Both the Windows and macOS builds ship in the same folder so the same cloud folder works regardless of which device the teacher opens it from; each build only runs on its own OS and ignores the other's binary.

### Data file: SQLite, not JSON

A single SQLite file (`data/planner.sqlite`) is the source of truth, not a tree of JSON files. Reasons: the domain is genuinely relational (student ↔ class ↔ grade-column ↔ grade value, parent ↔ contact-log ↔ appointment, etc.), SQLite still syncs across cloud storage as one ordinary file, and it gives the desktop app transactional writes (no half-written file if the app is killed mid-save, which a hand-rolled JSON writer would need to reimplement anyway).

### Backups

On each app launch, and again at a sensible interval during a long session (e.g. every 30 minutes of active use, and on clean shutdown), the app copies the current data file into `data/backups/` with a timestamped name. Older backups are thinned on a simple retention schedule (e.g. keep every backup from the last 7 days, then one per day for 30 days, then one per month) so the folder doesn't grow without bound. Backups are plain copies of the SQLite file — restoring means closing the app, copying a backup over `planner.sqlite`, and reopening.

### Explicit non-goals

- **No login, no accounts, no multi-user support.** The app assumes exactly one person uses the data at a time; there is nothing to authenticate.
- **No server, no hosted component, no network calls of any kind** other than what the OS's update mechanism might need for the app binary itself (out of scope for v1 — manual redistribution of a new build is acceptable).
- **No real-time sync or merge logic.** The user's own workflow — one device active at a time, cloud sync catching up in between — is the concurrency model. The app should still guard against the one realistic failure mode within that model: **detect and refuse to silently overwrite** a data file that changed on disk since the app last read it (e.g. sync hadn't finished catching up from the other device), surfacing a clear warning rather than corrupting data. This is a safety net, not a merge feature.

## Data model

Entities below are described at the level a developer needs to design tables/migrations; exact column types are an implementation detail. No entity has a fixed record-count cap (the source PDF's "100 students", "12 classes", "53 weeks" are print-medium limits, not data-model limits) — every list is add/remove freely.

### Core entities

- **SchoolYear** — one active record: start date (drives week numbering), year-model (Sep–Aug / Jan–Dec / Feb–Dec), 3 grading periods (name, start, end), holidays (name, date range, source: Ministry/school), important dates (name, date, type), 6 yearly-goal areas (fixed set: teaching/content, professional development, students, colleagues, parents, personal wellbeing — each with goal, actions, success indicators, deadline, status, end-of-year review).
- **Class** — name, subject, room, weekly timetable slots (day, period, time), roster (→ Student many-to-many via Enrollment), seating plan (grid position → student).
- **Student** — name, class(es), register number, birth date, home language, address, midyear-enrollment flag, 2 guardian contacts (name, phone, email) each, allergies, medical conditions, medication, emergency phone, SEN status (none / reinforcement teaching / accommodations / gifted), meeting notes (free text log), behavior/incident log entries (date, what happened, action taken, parents-informed flag).
- **SupportPlan** (0..n per student) — start date, monitoring frequency, strengths & needs, goals (each with its own progress rating and monitoring date), accommodations, parent/specialist collaboration notes, status (written by the teacher, never computed).
- **GradeColumn** (per class) — label, **weight as a percentage (0–100, teacher-entered)**; see the Grade weighting section for the calculation this feeds.
- **GradeRow** — one per (student, class): a value per GradeColumn (numeric 0–20 by default per the Cyprus scale, but also supporting descriptive A–Δ, pass/fail, and free-text comment grades per column, matching the prior project's finding that all four types are needed), plus conduct (6-level enum) and free-text observations.
- **LessonPlan** — one per (class, week): weekly notes, one optional assessment description, linked to the week via an actual date (the Monday of that week), not a week-index — so changing the school-year start date never silently moves existing plans.
- **AnnualPlan / Unit** — per class: periods, units (goals/content, methods, materials, differentiation, review), hours, assessment description.
- **Exam** — dated, class(es), weighting, notes, collaboration notes with colleagues.
- **Trip** — name, date, responsible staff, transport, cost, consent-tracking (per student), checklist, post-trip evaluation.
- **Textbook** — title, publisher, ISBN, level, price, status.
- **Resource** — material/resource entries across category (own / school / shared / borrowed / digital / other).
- **AttendanceRecord** — monthly grid per class: present / absent / late / excused per student per **lesson** (a date and a timetable hour; v1.0.1).
- **AbsenceEvent** — per class: date, kind, clock time, teaching-hour, reason, independent-justification flag, parent-follow-up status, frequent-absence note. Deliberately independent of AttendanceRecord (a teacher may use either or both).
- **ParentContactEntry** — date, student, guardian, format (call/email/in person/written), reason, agreements, outcome, next step.
- **ParentAppointment** — dated Monday–Friday slot: time, student/guardian, mode, place, status, topic, outcome. Independent of ParentContactEntry (this is the booking; the contact log is what happened) and of MeetingRecord.
- **MeetingRecord** — staff/council/class meetings: type, date, time, attendees, agenda, agreements (who/what/by when), linked class (optional), duration.
- **LetterTemplate** — the 7 fixed reference letters (welcome, newsletter, meeting invitation, at-risk-grade notice, trip consent, praise certificate, achievement award), each with `[PLACEHOLDER]` fields the teacher fills before generating a PDF.
- **MessageBankEntry** — the 150 reference messages across 15 fixed categories, same placeholder-fill-and-generate pattern, read-only content (not user-editable at the template level).
- **PrintForm** — the 11 fixed reference forms (attendance grid, parent-contact log, substitute lesson plan, meeting minutes, weekly priorities, room plan, credentials list, period checklist, parent note, materials-loan log, PD goals) — filled, named, saved, reopened, printed to PDF.
- **SubstituteFolder** — generated per class from live data: class info, week plan, room/seating plan (shared live with Class.seating, not copied), one-day plan, contacts & procedures. Descriptive text fields are prefilled once and then editable independently.
- **DevelopmentGoal** — free-form PD goals distinct from the 6 fixed annual-goal areas: goal, status, progress, notes.
- **WellbeingEntry** — dated free-text weekly reflection.
- **StaffContact** — name, role/area, phone, email (the school directory).
- **CoverRecord** — date, class covered, subject/material covered, teacher covered for, notes; separate from a teacher's own **LeaveRecord** (date, reason, documents submitted).

### Relationships worth calling out

- A Student can belong to more than one Class (many-to-many via an Enrollment join), since a subject teacher's "class" is a subject group, not a homeroom.
- GradeColumn and GradeRow are scoped to a single Class — grades are never shared across classes.
- SupportPlan, AbsenceEvent, and the incident log all reference Student directly (so they follow the student across classes); an orphaned reference (student deleted) should be rejected at write time, not silently allowed to dangle.
- ParentAppointment and ParentContactEntry both optionally — not mandatorily — link to a Student, matching how a guardian's slot or a general inquiry doesn't always name one child.

## Language (Greek/English)

The app UI ships with **Greek and English** interface strings, switchable by the user at any time from a settings/language toggle (persisted as a preference, not tied to the OS locale).

- **What's translated:** every UI label, button, menu, column header, validation message, the 7 letter templates, and the 150-message bank (each message needs both a Greek and an English version — the Greek content already exists from the source package). **On how the English is produced, the Resolved table below supersedes this paragraph:** it was written asking for hand-authored English on the grounds that these are sent to parents, and the product owner has since settled on a *machine-translated draft* for the letters and the message bank. Superseded text kept rather than deleted, because the reasoning is still the argument for reviewing that draft carefully at M9.
- **What's not translated:** data the teacher types in (student names, notes, comments, custom grade-column labels, etc.) — that stays exactly as entered, in whichever language the teacher used, regardless of the current UI language.
- **Printed/PDF output** follows the UI language active at the moment of generation for template/label text, but always includes the teacher's own entered data verbatim. A letter generated while the UI is in Greek produces a Greek letter; switching to English and regenerating produces the English version of that same letter with the same filled-in placeholders.
- Fixed reference vocabularies (conduct levels, absence kinds, SEN categories, etc.) need a translation table rather than being hardcoded per language, since several modules reuse the same vocabulary.

## Grade weighting

This replaces the source Excel registry's 1–5 relative-weight scheme with a **percentage-weight scheme**, matching how grading actually works in Cyprus, per the product owner.

### Model

- Each **GradeColumn** on a class carries a **weight**, entered by the teacher as a percentage (0–100). There is no fixed number of columns — the teacher adds as many as needed (a test, an assignment, a project, participation, etc.).
- The UI shows a **running total** of entered weights next to the column headers at all times (e.g. "Total: 85%").
- **Validation is a warning, not a hard block.** A teacher building up a gradebook mid-period will routinely have columns that don't yet sum to 100 (more assessments still to come). Block a save only on an invalid single value (negative, non-numeric, > 100 on one column); never block on the running total being off from 100. When the total is over 100 or under 100, show a clear, dismissible warning inline — a teacher entering final grades for report cards wants to *notice* a mis-weighted sheet before printing, but shouldn't be locked out of the app.
- Leaving a column's weight blank is not the same as 0 — treat a blank weight as **not yet decided**, excluded from both the running total and the average calculation until filled in (mirrors the source spreadsheet's "blank weight = doesn't count" behavior, just expressed as a percentage instead of a 1–5 multiplier).

### Calculation

For a given student's GradeRow in a class, across all GradeColumns that have **both** a value entered **and** a non-blank weight:

```
weighted_average = Σ(grade_i × weight_i) / Σ(weight_i)
```

— i.e. always normalize by the sum of the weights that actually contributed, **not** by a hardcoded 100. This is the important nuance carried over from the source Excel: if only two columns worth 40% and 30% have grades in so far, the average is computed over that 70%, not diluted as if the missing 30% were zeros. It is also why the running-total warning above matters — a sheet that's supposed to be "done" but only sums to 85% will silently self-normalize over 85% rather than erroring, so the warning is the only signal something's short.

- If **no** column has a value yet: the cell shows blank, not 0 or an error.
- If every entered value has a weight of exactly 0 (a teacher zeroing out a column instead of leaving it blank): treat that as the all-zero case and fall back to a **plain arithmetic average** of the entered values — this matches the source spreadsheet's documented fallback ("leave the whole weight row empty for a simple average") applied at the column level.

### Rounding and thresholds

- A rounded whole-number **suggested grade** is shown alongside the precise average (standard rounding, .5 rounds up), matching the source's `ROUND(average, 0)`.
- Each class has a configurable **pass threshold** ("Βάση"), default 10 on the 0–20 scale. Rows at or above threshold are flagged pass; below, flagged at-risk — this feeds the class-level "how many students are below the threshold" summary.
- **Conduct** is a separate 6-level scale per student per class (Υποδειγματική / Πολύ καλή / Καλή / Ικανοποιητική / Χρειάζεται στήριξη / Χρειάζεται παρέμβαση), not part of the weighted average.

### Class and year summary

A roll-up view (matching the source spreadsheet's "Σύνοψη" sheet) shows, per class: subject, class average, count of students at/above threshold, count below threshold, and roster size — computed live from every class's GradeRows, never entered separately.

## PDF output

Every printable surface in the source product produces an **actual PDF file**, saved into `exports/` — not just a print dialog, and not a "copy the text" fallback.

### Approach

Generate PDFs via the embedded WebView's print-to-PDF path (not a native Rust PDF library — confirmed decision, see below). Whichever path is used, it must:

- Match A4 page size and the source product's general layout conventions (header with class/date context, clearly labeled fields, landscape where the source used landscape — e.g. timetables, conduct sheets, parent-appointment weekly grids).
- Embed a font that renders Greek characters correctly (this is a common failure point in PDF generation — verify Greek diacritics, not just base Latin, before committing to a layout/print approach).
- Never depend on network access or an external service to generate a PDF.

### What generates a PDF

- **Letters (7 templates)** — teacher fills the placeholders in the UI, previews, generates a PDF named descriptively (e.g. `Επιστολή καλωσορίσματος — Τμήμα Α1 — 2026-09-19.pdf`).
- **Messages (150-entry bank)** — same fill-and-generate pattern per message; given these are short, also keep a one-click "copy text" option alongside PDF generation for messages the teacher will paste into an email/SMS rather than print.
- **Print forms (11)** — filled form state is saved (so it can be reopened and edited later) and generates a PDF on demand, not only at save time.
- **Grade sheets, conduct sheets, absence logs, timetable, annual goals, parent-appointment weeks, support plans** — each has its own print view already described in the source product's checklist; each becomes a PDF export button in the corresponding module.
- **Substitute folder** — generates as one multi-page PDF (the 5 pages bundled together), since that's how it's meant to be handed off or left in a drawer.

## Modules — full functional spec

Organized to mirror the source PDF's own top-level navigation, so nothing gets lost in translation. **Full functionality** means every item below ships — there is no deliberately-cut v1 feature list; see Delivery milestones for sequencing, which is a build order, not a scope cut.

### 1. Έτος (Year)

- School-year setup: pick a year model (Sep–Aug / Jan–Dec / Feb–Dec) and a start date; the app derives 53 week numbers and 12 months from it. Changing the start date later must never move or delete data already entered against specific dates (per the source project's hard-won lesson: key everything by actual date, never by week-index).
- Yearly calendar view (12-month grid), grading periods with date ranges and notes, holidays (with Ministry/school source tag), important dates (typed: deadline, meeting, exam window, event, other) shown in every month/period they overlap.
- 6 fixed annual-goal areas (teaching/content, PD, students, colleagues, parents, wellbeing) — one record each, goal/actions/success-indicators/deadline/status/end-of-year-review, printed as one table.
- Teacher master timetable: named hours with clock times, Monday–Saturday grid, covers/duties per cell, optional link to a Class (fills subject/room), notes, printable.
- Staff directory: name, role, phone, email — searchable.
- Substitution/leave log: date, class, subject/material covered, teacher covered for vs. teacher's own leave with documents submitted — two related but separate registers per the roadmap's own open item.
- Day/week/month agenda notes, keyed by actual date, with a quick "jump to today" and adjacent-period navigation.

### 2. Τάξεις (Classes & Students)

- Class list (unlimited, not capped at 12): subject, room, weekly schedule slots, roster with live count.
- Room seating plan per class, editable grid.
- Student index: searchable/sortable list, opens a full student card (all Student fields from the data model), including guardians, health/emergency info, SEN status, meeting-notes log.
- Birthday calendar, derived from student birth dates, viewable by month.
- Behavior/incident log: dated, cross-class (follows the student), action taken, parents-informed flag, filterable, printable.
- Support plans: multiple per student, each with goals/monitoring/collaboration notes as specified in the data model; plus a cross-class support overview (one row per student, merging card-level support flags with every plan's status and next review date) — both printable.

### 3. Πλάνο (Teaching & Planning)

- Annual plan per class: periods, units (goals/content, methods, materials, differentiation, review), hours, assessment approach.
- Week-by-class progress matrix: a grid of week × class, short status per cell — the largest genuinely new module versus the earlier attempt.
- Weekly lesson plan per class, keyed by date, with one optional assessment per week.
- Exam tracker: dated, per class, weighting, multiple assessments per exam window, collaboration notes.
- Lesson reflection log: dated free-text entries per class.
- Trips & events: responsibility, transport, cost, per-student consent tracking, checklist, post-trip evaluation.
- Textbooks: title, publisher, ISBN, level, price, status.
- Materials/resources: entries across the six source categories (own/school/shared/borrowed/digital/other).

### 4. Βαθμοί (Grades)

- Per-class gradebook: percentage-weighted columns as specified above, numeric/descriptive/pass-fail/comment grade types, conduct, observations.
- Class and year-wide summary roll-up (average, pass/at-risk counts, roster size).
- Progress-check periods tied to the school year's grading periods.
- Monthly attendance grid (present/absent/late/excused) — independent of the more detailed absence-event log below, per the roadmap's own documented decision (a teacher may use either or both; nothing derives one from the other).
- Detailed absence events per class: date, kind, clock time, teaching hour, reason, independent-justification flag, parent-follow-up status, frequent-absence notes.
- Per-class conduct sheet: the 6-level rating plus a written overall-result field (kept as a manually-written field, not computed — matches the source PDF and the prior project's explicit decision) and observations.

### 5. Γονείς & Ομάδα (Parents & Staff)

- Parent communication log: date, student, guardian, format, reason/agreements split from overall remarks, outcome, next step.
- Weekly Monday–Friday parent-appointment grid: time slots, student/guardian, mode, place, status, topic, outcome — independent of the log above (a booking vs. a record of what happened).
- Upcoming-overview panel: merges upcoming appointments with upcoming/recent meetings in one glance, opening straight into a meeting's minutes.
- Staff/council/class meetings: type, date, time, attendees, agenda, agreements (who/what/deadline), optional class link, duration.
- 7 parent letter templates, fill-and-generate-PDF.
- 150-message bank across 15 categories, searchable, fill-and-generate-PDF or copy-to-clipboard.

### 6. Substitute folder

- Generated per class from live data (not a separate data-entry chore): class info snapshot, current week's plan, room/seating plan (shared live, not copied, so it's never stale), a one-day fallback plan, contacts & emergency procedures. Descriptive boilerplate text is prefilled once and stays independently editable after that. Exports as one combined multi-page PDF.

### 7. Ανάπτυξη & Ευεξία (Development & Wellbeing)

- Open-ended PD/development goals: goal, status, progress notes — distinct from the 6 fixed annual-goal areas in Έτος (neither is generated from the other, per the earlier project's explicit decision, which holds up).
- Training/activity log: organiser, hours, format, cost, certificate, with a simple budget summary roll-up.
- Dated wellbeing reflections (free text only — confirmed decision, no structured mood/energy/workload dropdowns).

### 8. Print forms library

- The 11 standalone reference forms (attendance grid, parent-contact log, substitute lesson plan, meeting minutes, weekly priorities, room plan, credentials list, period-start/end checklist, parent note [2-up layout], materials-loan log, PD goals) — each fillable, nameable, saveable, reopenable, and PDF-exportable independent of the modules above, matching how the source product offers them as loose printable pages.

### 9. Σημερινό μάθημα (Today view)

- A single dashboard screen: today's date, the classes/hours scheduled today (from the master timetable), today's agenda note, and quick links into today's relevant weekly lesson plans. This is a convenience aggregation view, not a data-entry surface — everything it shows is entered elsewhere.

## Delivery milestones

Sequenced so each milestone is a real, launchable, testable build — not a code-complete-but-unrunnable stage. Every milestone ends with: the app launches on both Windows and macOS from inside a test cloud-sync folder, data written in one session is still there after fully quitting and relaunching, and a backup snapshot was created automatically.

**M0 — Shell & persistence.** Tauri app skeleton, packaging pipeline for both OSes, SQLite database file created on first run inside the app's own folder, backup snapshot job, the disk-changed-since-last-read safety check. No feature UI yet beyond a blank window — this milestone exists purely to prove the packaging and file-I/O foundation survives the actual cloud-folder workflow before anything is built on top of it, since that foundation is exactly what broke last time.

**M1 — School year, classes, students.** Year setup (date-driven week/month derivation), class CRUD, student CRUD with full card fields, guardians, health info, birthday calendar. This is the dependency root for almost every later module.

**M2 — Grades.** Percentage-weighted gradebook, all four grade types, conduct, class/year summary roll-up, PDF export of grade sheets. Grades are called out separately because the weighting logic is the one piece of real calculation logic in the whole app and deserves focused test coverage before other modules build print views that depend on it.

**M3 — Weekly planning & timetable.** Master timetable, weekly lesson plans keyed by date, today view, agenda notes.

**M4 — Attendance & behavior.** Monthly attendance grid, detailed absence events, incident log, support plans + cross-class overview.

**M4.5 — Printing attendance, behaviour and support.** Real PDF exports for the
three M4 surfaces the spec promises as printable: the behaviour/incident log, the
detailed absence register, and the cross-class support overview. No new data, no
new fields, no schema change — these are print views over records M4 already
stores, built on the app-owned pagination M2 established. Whether the *filled*
monthly attendance grid becomes a fourth sheet is M4.5's to decide and record;
the *blank* grid is separately one of M7's 11 print forms. **Inserted 2026-09-22**
by the product owner, answering the question M4 raised; it was not in the original
sequence.

**M5 — Parents & staff.** Communication log, parent-appointment grid, staff/council meetings, letters (7) and message bank (150) with bilingual content and PDF generation.

**M6 — Annual planning & the rest of teaching.** Annual plans/units, week-by-class progress matrix, exams, lesson reflections, trips, textbooks, materials.

**M7 — Print forms & substitute folder.** The 11 standalone forms, the substitute-folder generator drawing on M1–M3 live data.

**M8 — Development, wellbeing, staff directory, covers/leave.** The remaining smaller modules that don't block anything else.

**M9 — Bilingual pass & polish.** English translation of all UI strings, letters, and messages (if not done incrementally per module — a developer agent should flag whether to translate as each module ships or in one dedicated pass); full pass on PDF layout fidelity against the source product's A4 pages; backup retention tuning; real multi-device test (write on a simulated "device 1", let sync settle, read on "device 2") as an explicit release gate, not just a unit test.

## Decisions & open questions

### Resolved

| Decision | Resolution |
|---|---|
| Architecture | Native desktop app (Tauri: Rust backend + OS webview), not a browser-only page |
| Runtime dependency | None separately installed — compiled into the app binary |
| Platforms | Windows and macOS, both required |
| Concurrency model | Single user, single device active at a time; cloud folder is the only sync mechanism |
| Multi-user / login | None — explicitly out of scope, and treated as the user's own responsibility for data protection compliance |
| Data format | SQLite file, not JSON |
| Backups | Automatic, dated, retained on a thinning schedule |
| Grade weighting | Percentage per column (Cyprus convention), teacher-entered, not a fixed 1–5 scale |
| Scope | Full functionality across every module in the source product — no permanent MVP cut, only a build sequence |
| Language | Bilingual UI, Greek and English |
| Language rollout timing | **Greek-only through M1–M8; the English translation happens in one dedicated pass at M9** (decided by the product owner, 2026-09-19, answering the question M9's entry flags). This is a call about *sequencing only* — it does not cut English from scope, and the row above still stands. The constraint it puts on every milestone from M1 on: no Greek text literal may appear inline in a component. Every user-facing string goes through a single lookup keyed by a string id, and fixed reference vocabularies (SEN categories, conduct levels, holiday sources, …) are stored as stable codes labelled through a translation table rather than hardcoded per language. Adding English at M9 must therefore be adding one language file, not editing every screen. Teacher-entered data is never translated — it stays exactly as typed |
| Letters/messages/forms output | Real generated PDF, not print-dialog-only or text-only |
| PDF generation | WebView print-to-PDF path, not a native Rust PDF library |
| English translation authorship | Machine-translated draft, for the message bank and letters |
| Wellbeing entries | Free text only; no structured mood/energy/workload dropdowns |
| Backup retention schedule | Confirmed as proposed (7 days full, then daily to 30 days, then monthly) |
| Concurrent-edit conflict (disk changed since last read) | Block the write and require a manual reload before saving — no alongside-save fallback |
| Visual design | The app's own styling — not a visual copy of the source PDF's layout |
| SQLite journal mode | `DELETE`, not WAL (M0) — WAL keeps committed data in `-wal`/`-shm` sidecars, which a sync client can carry away separately from `planner.sqlite` and leave a torn database on the other device |
| SQLite connection lifetime | Opened per operation, not held for the session (M0) — keeps the on-disk file the single source of truth, which is what makes change detection meaningful |
| Disk-change detection signal | SHA-256 of the file's contents (M0) — size and mtime are too weak, since a sync client can rewrite a file to the same length and mtime can be preserved across a sync |
| When the disk-changed block fires | When the file changes *after the running app has read it* (M0) — an edit made while the app was closed is read fresh on the next launch, because that is the normal device-switch case and blocking there would warn the teacher on essentially every switch. This supersedes the literal wording of M0's fourth acceptance criterion |
| Frontend framework | React + TypeScript + Vite (M0) — the "keep it boring" slot, filled |
| Code signing | Not done for v1. **This is now known to be worse on Windows than assumed** — see Carried risks. macOS needs a one-time right-click → Open; Windows blocks an internet-tagged unsigned build behind a SmartScreen dialog. Revisit before M9, and sooner if the app is to be handed to the teacher in the meantime |
| macOS binary architecture | Universal (x86_64 + arm64), so the app runs natively on both Intel and Apple Silicon Macs instead of depending on Rosetta |
| Where the class seating plan lives | **M1, as part of Class.** It is a field of `Class` in the data model, M1's scope line covers class CRUD, no later milestone claims it, and M7's substitute-folder criteria assume it already exists in the Classes module. Raised by the M1 agent and settled by M1 being merged with it (2026-09-20) |
| Non-numeric grade types in the weighted average | **Only numeric columns count.** Descriptive (Α–Δ), pass/fail and comment columns are recorded, displayed and printed, but take no part in the weighted average — and their weight is excluded from the normalising sum too, so a 30% comment column cannot silently dilute a result. Decided by the product owner 2026-09-20, before M2. The app never invents a number the teacher did not type; the average is over the columns that carry marks |
| Date and time formatting | **Every date the app displays or prints is formatted by the app** (`dd.MM.yyyy`, matching the source product), independent of the OS locale. The native `<input type="date">` / `type="time"` widgets keep showing OS formatting while being edited, and that is accepted. Decided 2026-09-20. The reason it matters: printed output must look identical on the teacher's Windows PC and on the development Mac, and only app-side formatting guarantees that |
| Progress-check periods | **Not in M2.** They appear in the spec's Βαθμοί module list but not in M2's delivery scope line, so M2 ships its scope line exactly and progress checks are picked up in a later milestone. Decided 2026-09-20, keeping M2 focused on the weighting logic the spec asked for concentrated test coverage on |
| If PDF export proves blocked at M2 — **spent, not needed** | **Ship the gradebook, defer the PDF.** *(This contingency never fired: M2 made the WebView print-to-PDF path work, and every milestone since has printed through it. Kept as the record of a decision taken, not as a live option.)* If the WebView print-to-PDF path cannot be made to work, M2 lands with the weighted gradebook, all four grade types, conduct and the summary roll-ups — fully tested — and PDF export becomes its own piece of work with its own gate. Decided 2026-09-20. The reasoning: the weighting logic is what later milestones depend on, and it should not be held hostage to a platform rendering problem. This is a fallback, not permission to skip the attempt |

| How the WebView print-to-PDF path is actually done | **`createPDF` plus app-side pagination on macOS; `PrintToPdf` on Windows** (M2). AppKit's print pipeline (`printOperationWithPrintInfo:`) does not work against wry's webview — its print view is zero-sized and renders nothing, so the job emits blank pages indefinitely; that was tried hidden and visible, with default and explicit settings, with the print view's frame forced, and run both directly and modally. WebKit's `createPDFWithConfiguration:` does render the whole document and embeds its fonts, but does not paginate. So the app lays each sheet out into fixed A4 blocks, macOS captures one rectangle per block and PDFKit assembles them, and WebView2 paginates the same blocks itself. The spec's resolved approach stands — this is how it is done |
| Who decides where a printed sheet breaks | **The app, not the rendering engine** (M2). The print window measures the rendered rows and places them into A4 blocks, repeating the sheet header and the column headers and never splitting a row. Forced by the above. It gives both platforms the same page structure and the same A4 sheet; it does not make the break points identical, because row heights come from each platform's own text measurement — at the M2 gate a 45-row roster was five pages on macOS and six on Windows, differing only in whether the closing note shared the last page |
| Where the teacher's week is registered | **One register: the master timetable** (M3). M1's per-class `class_slot` rows are folded into it by `migrate_to_4` and the table is dropped; a class's hours are *derived* from the cells that link to it and are read-only on the class card. Forced by three things in this spec: a cover or duty belongs to no class and so cannot live in a per-class table, the link to a Class is described as *optional* and as something that "fills subject/room" (so the cell is the record and the class a pointer), and the Today view reads "from the master timetable", which is only unambiguous if there is one. It means a lesson is typed once and the Today view cannot list the same class twice. **Raised by the M3 agent as a deliberate retirement of a surface M1 shipped, and confirmed by the product owner on 2026-09-21** |
| Whether the master timetable exports a PDF | **No — not now and not later. Plain text in the app, to copy and paste, is enough.** Decided by the product owner 2026-09-21, answering the question M3 raised. This is a **narrow exception to the "PDF output" section above, for the timetable only**: grade sheets, conduct sheets, letters, the message bank, print forms and the substitute folder all still produce real PDF files as that section requires. The practical consequence is a small piece of work M3 did not build — a "copy as text" affordance on the timetable, and the removal of M3's on-screen note saying PDF export is not implemented "yet", which is now misleading |
| Where M4's four surfaces live in the navigation | **Sub-pages inside the two sections that already hold their modules, not new top-level tabs** (M4). Βαθμοί gains *Βαθμολόγιο / Απουσίες*; Μαθητές gains *Καρτέλες / Περιστατικά / Στήριξη*. The app stays at eight top-level tabs | The spec files the attendance grid and the absence register under module 4 and the incident log and support plans under module 2, and the source product reaches each from its module's own index page ("Απουσίες ανά τμήμα" from ΒΑΘΜΟΙ, "Συμπεριφορά και περιστατικά" από ΜΑΘΗΤΕΣ). Four more top-level tabs would have made twelve and would have contradicted both |
| How the monthly attendance grid is keyed | **Superseded in v1.0.1 — see the next row.** Originally **`(class_id, student_id, date)` where `date` is an actual date** (M4). There is no month column, no year column and no day-of-month index anywhere; the month grid is a *view* built by `domain/attendance.ts` from M3's `monthGrid()` | The source prints one card per month with columns 1–31, and keying the table by the column it prints is the same mistake the spec spent M1 ruling out. A test asserts `attendance_mark` has exactly four columns |
| **Attendance is per lesson, not per day** (v1.0.1) | **`(class_id, student_id, date, period_id)`**, where `period_id` is the master timetable's hour (product owner, 2026-09-26: "the absences are counted per lesson not per day"; linked to the timetable hour by the product owner's choice). Each day of the grid splits into the hours the class has that weekday; totals count lessons. `period_id` has **no foreign key**, so editing or deleting an hour never deletes attendance; `0` means "hour unknown". Migration 11 puts every per-day mark on the class's first hour that weekday, or on `0`. Weekends, holidays and leave days are greyed out with no cells; Saturday only when the class is not taught on Saturdays. The printed card shows only days with lessons | A teacher can meet a class twice in a day and absences are counted per lesson. A cascade from the timetable would silently delete a term's attendance. Still no month, year or day-of-month column |
| A support goal's progress rating | **A fixed vocabulary** — `not_started`, `in_progress`, `partly_met`, `met`, `needs_review`, plus empty for "not rated yet" (M4) | The spec uses two different words in one sentence: each goal has a *progress rating*, while the plan's *status* is "written by the teacher, never computed". A rating reads as a scale where a status reads as a sentence, so the two are modelled differently. The plan's status stays free text, matching M1's annual-goal status. **Flagged at M4 — this was genuinely open** |
| What a "card-level support flag" is in the cross-class overview | **Both of M1's flags, merged and shown separately** (M4): `Student.sen_status` (one per student, from the card's ΕΠΕ box) and `Enrollment.support` with its per-class note (which can differ between a student's classes) | They mean different things and the overview needs both — the source page's own columns are Μαθητής / Τάξη / Είδος στήριξης / Προσαρμογές–Στήριξη / Αξιολόγηση / Πλάνο, which is that same merge. A student appears in the overview if *any* of three signals fires: a card category, a class's tick, or a plan |
| Whether a blank new record is deleted on save | **No — a blank absence event, incident, support plan or goal is kept** (M4). This is a deliberate departure from the delete-when-empty rule M2's grade cells and M3's timetable cells and plans follow, which M4's `attendance_mark` still follows | Those are keyed cells with no create button: an emptied one is genuinely "nothing here". These four have a "new record" button, so the teacher pressed something to make the row and is about to type into it — deleting it on save would make a new record vanish as it appeared. Removing one is an explicit delete |
| Whether a behaviour incident names a class | **Optionally, as `ON DELETE SET NULL`** (M4). The entry belongs to the *student* and follows her across classes; the class is a note of where it happened | The spec's data model lists four fields and no class, but the source register has a `Τάξη` column, and "filterable" is only meaningful with one. Deleting a class empties the link and keeps the entry, because something still happened |
| `SupportPlan`'s "strengths & needs" | **Two fields, `strengths` and `needs`** (M4) | The spec names them as one phrase. Splitting loses nothing and merging would, and two boxes is what the teacher actually fills in. `next_review` is also a column, because the spec's overview line names "every plan's status and next review date" although its field list does not |
| The timetable's "copy as text" and the removal of its PDF note | **Both done in M4**, as the carry-over from the product owner's 2026-09-21 ruling | M3 was already merged when the decision landed. `timetable.printLater` and the note rendering it are gone; `timetableAsText()` produces a column-aligned plain-text grid |
| Whether M4's surfaces produce PDFs, and when | **Yes — and as their own milestone, `M4.5`, inserted between M4 and M5** (product owner, 2026-09-22). The incident log, the detailed absence register and the cross-class support overview each get a real PDF export. M4 merged without them, as its own scope line required | The spec promised these three in two places — module 2 calls the incident log and the support overview "both printable", and the "PDF output" section names "absence logs" and "support plans" — while M4's delivery-scope line named no PDF. M4 shipped its scope line exactly, per the M2/M3 precedent, and raised the conflict rather than silently resolving it. **The roadmap did not have an M4.5; this creates one**, rather than retrofitting M4 or enlarging M5, so the work gets its own gate and its own release note. **Whether the filled monthly attendance grid is a fourth sheet is left for M4.5 to settle and record**, because it is genuinely unclear: the "PDF output" section's "absence logs" could mean either register, and the *blank* attendance grid is already one of M7's 11 print forms |
| **Whether the filled monthly attendance grid is a fourth printed sheet** | **Yes — it prints** (M4.5). The *filled* month card for a real class is a print view over live M4 data and exports as its own landscape A4 PDF from the Απουσίες screen. **M7 still owns the blank fillable form** of the same page, which is a different artefact: a standalone, nameable, saveable, reopenable form with no class behind it | The question the product owner left to M4.5. Three things decided it: the "PDF output" section's "absence logs" reads naturally as both registers; the screen would otherwise have an export button on its lower half and none on its upper, for the one table in the app most worth having on paper; and the widest table this app draws is exactly the one a teacher wants to carry rather than scroll. It costs no new machinery — one more document definition on M2's pagination. The printed card and the printed register are held independent of each other by the same construction the screens use, and tested to be insensitive to each other's rows |
| How a printed sheet knows which records to carry | **It reads the same selector the screen renders from** (M4.5). The incident log's filter moved out of the screen into `domain/behaviour.ts` as `filteredIncidents()`, which both the screen and the sheet call; the filter is printed in the sheet's own header | M4.5's second acceptance criterion is that a sheet never disagrees with the screen it was printed from. Two functions that agree today are not that; one function is. It is also the spec's own rule that selection logic lives in `src/domain/`, not in a screen |
| Where a source page's captioned boxes get their content | **From stored per-record fields, verbatim and attributed — or left blank as ruled space** (M4.5). The absence register's *ΠΡΟΣΟΧΗ · ΣΥΧΝΕΣ ΑΠΟΥΣΙΕΣ* and *ΓΟΝΕΙΣ ΕΝΗΜΕΡΩΘΗΚΑΝ · ΕΝΕΡΓΕΙΕΣ* boxes list each event's own `frequent_note` and `follow_up`; the support overview's *ΣΥΝΕΡΓΑΣΙΑ ΚΑΙ ΣΥΜΒΟΥΛΕΥΤΙΚΗ* box lists each plan's own `collaboration`; the incident register's *ΠΡΟΣΘΕΤΕΣ ΣΗΜΕΙΩΣΕΙΣ* box prints **blank**, because nothing is stored for it and M4.5 adds no field | The source gives these fields a box at the foot of the page where M4 stores them per record, following the spec's own field lists. Listing them verbatim keeps the sheet a transcription rather than a summary — nothing is counted, and the app never decides for itself that an absence is "frequent". A box with no stored source stays a box on the paper, as it is on the source's own page. **Flagged at M4.5 — see Open** |
| Where the export button lives | **One shared `src/components/ExportButton.tsx`, taking the day as a prop** (M4.5). M2's copy inside `GradesScreen` is gone, and `GradesScreen` now takes `today` from the shell like every other screen | M4.5 adds four more export buttons and copying M2's would have copied its defect four times. That button called `todayIso()` inside a component, which is the one thing M3's rule forbids and the reason `App.tsx`'s own doc comment — "this is where the calendar is read, and the only place" — was untrue between M3 and M4.5. It is now true |
| **Where M5's six surfaces live in the navigation** | **One new top-level section, `Γονείς & Ομάδα`, with five sub-pages** (M5) — Επικοινωνία / Συναντήσεις / Συνεδριάσεις / Επιστολές / Μηνύματα. The top row goes from eight to **nine**, the first change to it since M0 | M4's four surfaces went in as sub-pages because the spec filed them under sections the app already had. **M5's module has no such home**: nothing in the app was about parents or about staff meetings, so a sub-page would have had to hang off an unrelated section. The source product carries **ΓΟΝΕΙΣ and ΟΜΑΔΑ as two separate top-level items**, which would have made ten; one tab named after the spec's own module 5 keeps the label honest about holding both halves while costing the top row one place rather than five. `tests/component/App.test.tsx` pins the nine and says why the number moved |
| **Where the 7 letters and the 150 messages live** | **Two new files under `src/i18n/`** — `lettersEl.ts` and `messagesEl.ts` — merged with `el.ts` into one bundle in `i18n/index.ts` (M5). The *structure* (which letters exist, their blocks and fields; the 15 categories and their codes) lives in `src/domain/letters.ts` and `src/domain/messages.ts` and **contains no Greek at all** | The no-inline-Greek rule puts the content under `src/i18n/`, but 465 strings of it — several of them multi-paragraph — would have roughly tripled `el.ts` and mixed a product's content in among its button labels. Splitting by *kind* keeps one lookup, one `StringId` type and one eslint rule. **The test of the shape is M9's: adding English is adding `lettersEn.ts` and `messagesEn.ts` and one line in `BUNDLES`** — no screen, no document builder and no domain module changes |
| **The "bilingual content" in M5's own scope line** | **Superseded — Greek only** (M5). M5 ships no English | A direct contradiction inside this document: M5's delivery line says the letters and message bank come "with bilingual content", while the **Language rollout timing** row above (product owner, 2026-09-19) says Greek-only through M1–M8 with the English pass at M9, and the **English translation authorship** row says that pass is a machine-translated draft. The later, more specific decision wins. Recorded so the next agent does not have to re-derive it |
| **How a letter is printed, given a letter is not a table** | **The document contract gains blocks; `renderPrintDocument` stays the only renderer** (M5). `PrintDocument.table` becomes optional and `blocks` is added — a field row, prose, a captioned writing area, a reply slip, signature lines, a certificate. `paginate()` now flows blocks as well as table rows | M5 is the first milestone whose printed output is not a table, and the alternative was a second renderer beside the first, which is how two printed pages start disagreeing about their own stylesheet. A document that is all table paginates exactly where it did before, which M2's and M4.5's four sheets are the test of. **The app still measures and still places** — the Resolved rows above about who paginates are untouched |
| **Whether the two award pages are two-up** | **No — one certificate per full A4 portrait sheet** (M5) | The M5 brief states pages 7 and 8 of `reference/03 - Έτοιμες επιστολές προς γονείς.pdf` are "a certificate, 2-up on the page". They are not: each is a single centred certificate inside a coloured border on a full portrait sheet. The pages were rendered and looked at rather than taken on trust, and the app matches the source. Recorded because the brief is wrong and the next agent will read it |
| **Whether a filled letter is stored** | **No — M5 stores nothing for a letter or a message** (M5). The values live in the screen while the teacher is composing, one draft per letter, and the PDF is the artefact | M5's scope line asks for "fill the placeholders in the UI, preview, generate a PDF", and the spec's own PDF-output section asks for saved filled state only for the **11 print forms**, which are M7's. Saving a letter under a name, reopening and re-editing it is M7's acceptance criterion almost word for word, so building it here would have been building M7's surface early and in the wrong module. **Flagged — see Open** |
| **Which M5 surfaces produce a PDF** | **The 7 letters, the message bank, the communication log and the parent-appointment week** (M5) | The scope line names the letters and the bank. The spec's "PDF output" section separately names **"parent-appointment weeks"** among the surfaces that produce a real file, so that one is promised too. The communication log is the direct analogue of the incident register M4.5 printed — a flat register the source itself calls "κατάλληλο για επίσημη τεκμηρίωση" — and cost one document definition. **Meeting minutes are the one surface left unprinted; see Open**, raised rather than silently decided, which is the M4 precedent that created M4.5 |
| **An appointment's key** | **`(date, clock_time)` where `date` is an actual date** (M5). There is no weekday column and no week index; the Monday–Friday grid is a view built by `appointmentWeek()` from whichever Monday is asked for | The same rule M1 set and M4 followed for the attendance grid, and for the same reason: correcting the school year's start date must not move a booking. A test asserts no appointment carries a `weekday` field |
| **The printed communication log's column count** | **Eight, where the source page has seven** — the extra is the spec's own `outcome` (M5) | The source's columns are `Ημερομηνία / Μαθητής / Ποιος / Μορφή / Αιτία / Συμφωνίες / Επόμενα`, and the spec's field list adds "outcome" between the agreements and the next step. Dropping it would have lost a field the spec names; adding it is a deliberate departure from the source's column count, recorded rather than quiet — the same call M4.5 made for the support overview's seventh column |
| **A short formatted value that must not break across lines** | **`PrintCell.nowrap`** (M5) | Found by looking at a real rendered PDF rather than at the HTML: the log's date column broke `05.11.2026` into `05.11.20` / `26`, and its format column broke `Τηλέφωνο`. The page's default `overflow-wrap: anywhere` is right for a teacher's sentence and wrong for a formatted number, so the opt-out is per cell rather than a change to the default — the default is what stops a long Greek surname overflowing the sheet |

| **Whether the week-by-class progress matrix is a stored table** | **No — it is a view over M3's `lesson_plan`, and M6 adds no table for it** (M6). `domain/progress.ts` builds the grid from whichever weeks are asked for; the screen takes no `run` and has no input of any kind | M6's first acceptance criterion says the matrix must reflect the weekly plan "without duplicate data entry", and a table with a cell per `(week, class)` would give the teacher two places to write what she did that week. **The source product agrees in its own words**: the index card that opens this page is headed *"Το εβδομαδιαίο πλάνο σε έναν πίνακα · Η πρόοδος των τμημάτων, εβδομάδα με εβδομάδα"* — the weekly plan in one table. It is the fourth time this call has been made, after M4's attendance grid, M5's appointment week and M3's own timetable |
| **The matrix's `Εβδομάδα` rows** | **Derived from the school year's start date at display time** (M6). No M6 table carries a week, and a Rust test walks every column of every table asserting none is named like a week index | The matrix's own axis is the one shape this project has refused since M1. Correcting the start date must re-label the rows and move nothing; `tests/unit/progress.test.ts` and `tests/component/ProgressScreen.test.tsx` both move it and find the same plan under a different number |
| **Whether the annual plan and the units are one record or two** | **One: `unit`** (M6). The annual plan is `annualPlan()`, a view of a class's units in order | The source keeps two pages — *Ετήσιο πλάνο*, whose columns are `Περίοδος / Θεματική ενότητα / Δεξιότητες / Κριτήρια / Ώρες / Αξιολόγηση`, and *Ενότητες*, a card per unit — and **every column of the first is a field of the second**. Two tables would make the teacher type a unit's title and its hours twice, which is the same defect the matrix criterion forbids. Same call M3 took on the timetable: where two surfaces cover one thing, one is derived. The unit card's `ΒΑΘΜΟΙ` and the annual plan's `Αξιολόγηση` are one field; its `ΔΙΔΑΚΤΙΚΟΙ ΣΤΟΧΟΙ` and the plan's `Δεξιότητες / Κριτήρια` are **two**, because the source heads them differently and merging would lose a distinction the teacher made — the call M4 took on a support plan's strengths and needs |
| **Where M6's eight surfaces live in the navigation** | **Seven sub-pages inside `Πλάνο`, and no new top-level tab** (M6) — Εβδομάδα / Ετήσιο πλάνο / Πρόοδος τμημάτων / Εξετάσεις / Αναστοχασμός / Εκδρομές / Βιβλία & υλικά. **The top row stays at nine** | M4's shape, which M5 departed from only because module 5 had nowhere to go. The spec files all eight surfaces under module 3, and the app already had `Πλάνο` as that module's section — it simply had no sub-pages, because M3 built only the weekly plan. The eight become seven because two pairs collapse: the annual plan and the units are one record, and the two reference lists are the two surfaces that hang off no class and no week. `tests/component/App.test.tsx` is renamed to say the nine survive M6 and pins the new row |
| **A trip's `Συγκαταθέσεις` column** | **Derived, never typed** (M6). Consents are rows keyed `(trip_id, student_id)`; the register's cell is counted from them by `consentTally()` over the class's *roster* | The spec asks for per-student consent tracking, so the consents are records. A number the teacher typed could disagree with the list she ticked; a counted one cannot. Reading the roster from `enrollment` rather than from the consents is what makes a student added to the class appear with nothing recorded |
| **A trip consent's states** | **Two — `given` and `refused` — and no row means "not recorded yet"** (M6). Clearing both the state and the note removes the row | M4's rule for an unmarked attendance cell, restated: an unrecorded consent is the absence of a row, not a third code, because the source's column is a blank cell the teacher fills as the slips come back. A cleared state with a note still on it keeps the row and counts as pending, so a note she wrote is never thrown away by a dropdown |
| **Whether a trip fills in M5's consent letter** | **No — M6 wires nothing to it** (M6). The trips screen points at *Γονείς & Ομάδα → Επιστολές* in a hint and stops there | M5 ships *Συγκατάθεση για επίσκεψη / εκδρομή* as one of the seven letters and **deliberately stores nothing for a filled letter**. Filling one from a trip would change that decision, which is M5's and the product owner's, not M6's. **Raised — see Open** |
| **The six resource categories** | **The source page's own six captioned boxes** (M6): `ΙΣΤΟΤΟΠΟΙ ΚΑΙ ΠΛΑΤΦΟΡΜΕΣ`, `ΕΦΑΡΜΟΓΕΣ`, `ΒΙΒΛΙΑ ΚΑΙ ΚΕΙΜΕΝΑ`, `ΒΙΝΤΕΟ ΚΑΙ ΗΧΟΣ`, `ΒΟΗΘΗΜΑΤΑ ΣΤΗΝ ΤΑΞΗ`, `ΑΛΛΕΣ ΠΗΓΕΣ` — as stable codes `websites` / `apps` / `books` / `video` / `classroom` / `other` | **This document's module-3 entry names a different six** — own / school / shared / borrowed / digital / other — and calls them "the six source categories". The source page contradicts that: its boxes are about what a resource *is*, not who it belongs to, and its own index card reads *"Ιστότοποι, εφαρμογές, βιβλία και ταινίες"*. Nothing resembling the provenance list appears anywhere in the source package, including the materials-loan log among M7's print forms, which was checked. The page wins on a question of what is on the page — the same call M5 took on the award pages being 2-up. **Raised rather than settled quietly — see Open** |
| **Whether an exam's kind, a textbook's `Κατάσταση` and its `Τιμή` are vocabularies** | **No — all three are free text** (M6) | The source pages are blank forms that enumerate nothing, and a teacher writes "δωρεάν" in a price box as readily as a number. The app does not invent a category the source does not have, which is the rule M4 followed on absence kinds. The resource categories above *are* a vocabulary by the same rule, because the source page prints all six of them as captions |
| **What an exam's `Βαρύτητα` does** | **Nothing — it is a planning note** (M6). It is stored on `exam` and is deliberately not wired to M2's percentage-weighted gradebook, whose weights live on `grade_column` | Two surfaces that both say "βαρύτητα" are exactly where a silent coupling would hide. No command, no selector and no statement reaches from one to the other; a test asserts the whole gradebook output is unchanged by adding exams, and the screen says so under the field rather than leaving the teacher to guess |
| **What deleting a class does to M6's records** | **A unit goes with it; an exam, a trip and a reflection stay with their link emptied** (M6) — `CASCADE` on `unit`, `ON DELETE SET NULL` on the other three | A unit *is* the class's annual plan and means nothing without it. The other three record something that was planned or that happened, which is still true after the class is gone — the call M4 took on an incident and M5 on a meeting |
| **Which M6 surfaces produce a PDF** | **None** (M6), per the M2/M3 precedent that a milestone ships its scope line exactly, and M6's names no PDF | The "PDF output" section names **"annual goals"** among the surfaces that produce a real file. That reads as M1's **six fixed annual-goal areas**, not M6's annual *plan*: the phrase matches `annual_goals` exactly, and module 1's own entry says those six are "printed as one table" while module 3 says nothing of the sort about the annual plan. So M6 is promised none. **But M1's annual goals are still unprinted** and nothing has claimed them — raised, see Open |

| **A print form and the substitute folder are opposite kinds of record** | **A print form is a loose page with nothing behind it; the substitute folder is a live view with nothing stored but its own words** (M7). `print_form` / `print_form_value` link to no class, student or seat, and `formDocument()` is never handed the planner. `substituteFolder()` reads the class, its roster, its seats, the timetable and the week's plan every time it is asked, and **no table holds a copy of any of them** — a Rust test walks every M7 column to say so | Module 8 says the forms are "independent of the modules above", and the source calls them `Πρότυπα για εκτύπωση`; module 6 says the folder is "generated per class **from live data**" with a seating plan "shared live, not copied". Four of the eleven forms look like live surfaces the app already has — *Απουσίες του μήνα* (M4.5's filled card), *Επικοινωνία με γονείς* (M5's log), *Πλάνο αίθουσας* (M1's seating, and the folder's), *Πρακτικό συνεδρίασης* (M5's meetings) — and **none of them reads from it**. `Πλάνο αίθουσας` therefore exists twice, as two different artefacts, on purpose. Recorded because the next agent will read "print forms" and "substitute folder" and assume they are the same kind of thing |
| **Where M7's two halves live in the navigation** | **The eleven forms get one new top-level section, `Πρότυπα`; the folder is a sub-page of `Τάξεις`** (M7) — *Τμήματα / Φάκελος αναπλήρωσης*. The top row goes from nine to **ten** | Opposite answers for opposite things. The folder is generated per class from the class's own data, so it goes where the class is — the M4/M6 shape, no new tab. The forms belong to nothing, so no existing section is honest about holding them — the M5 situation — and they take one section named with the source's own word. Filing both under one new tab would have cost the same one place and put a live view of a class's seating beside a blank room plan. `tests/component/App.test.tsx` is renamed to pin ten and says why |
| **How a filled print form is stored** | **A head (`print_form`: kind, name, created, updated) and one row per filled field (`print_form_value`)**, written by **different commands** (M7). Saving a form's name never rewrites its values; an emptied field is removed. `kind` is checked in Rust, not by a `CHECK` | Two commands so that a rename sent while a field is still saving cannot write back a stale copy of the values — a Rust test holds it. No `CHECK` so that **a filled letter could join as one more `kind` without a migration** (a letter's values are already a key → value map). Whether it should is the product owner's open question, not M7's — see Open |
| **What "prefilled once and stays independently editable" means for the folder's boilerplate** | **No row means untouched, and the suggestion from the language bundle shows and prints; a row means the teacher's text — including an empty row, which means she cleared it; *Επαναφορά* deletes the row** (M7). The suggestion is never copied into the file | "She cleared it" and "she has not touched it" must stay distinguishable, or the suggestion comes back into a box she emptied. This is the one text in the file where an empty string is stored rather than meaning "nothing" — M4's "a missing row is not recorded yet", applied to a sentence. Not copying the default is the same outcome for the teacher, with one advantage: an untouched box follows the UI language at M9, while what she typed stays as typed |
| **Which week the folder's "current week" is** | **The week containing the day the shell read — except on a Saturday or Sunday, when it is the coming week** (M7). A pure function of `today` | The folder is for the morning the teacher does not come in. Printed on a Sunday evening, last week's plan would be the wrong thing to leave in the drawer |
| **The folder's contacts and procedures** | **School-wide, typed once, shared by every class's folder** — except `Υπεύθυνος τμήματος`, which is the class card's own `responsible`, looked up (M7) | The principal's number does not change by class, and "not a separate data-entry chore" rules out typing it once per class. The one contact that differs by class already exists in M1 |
| **What the folder's `ΜΑΘΗΤΕΣ ΠΟΥ ΧΡΕΙΑΖΟΝΤΑΙ ΠΡΟΣΟΧΗ` box holds** | **A live list from the students' cards, verbatim** — a card's SEN category, the class's support tick and its note, allergies, conditions, medication — **then any note the teacher adds** (M7) | The same three signals M4's support overview merges, plus the card's health fields, which are exactly what a substitute must know. Nothing is summarised or inferred, the M4.5 rule. **Raised as a privacy question** — see Open |
| **How one PDF carries several documents** | **The print window cuts every sheet it is given onto A4 pages in order, each sheet starting a page of its own; the Rust side is unchanged** (M7). One orientation per file | Every PDF before M7 was one document. The app already measured and placed; macOS already captured however many pages it was told and PDFKit assembled them; WebView2 already broke at the same page blocks. So a bundle is more than one sheet in the document. **Proven on real files early**, before the folder's pages were built. The rule that the app, not the engine, decides where a page breaks is untouched |
| **Whether three of the forms have subtitles** | **Yes — all eleven do** (M7). *Επικοινωνία με γονείς*: "Καταγραφή συζητήσεων και μηνυμάτων — ημερομηνία, αιτία, συμφωνίες"; *Πλάνο αναπλήρωσης*: "Ό,τι πρέπει να ξέρει ο αναπληρωτής για αυτή την ώρα"; *Στόχοι και επαγγελματική ανάπτυξη*: "Εξέλιξη, επιμορφώσεις, δικοί σας στόχοι για τη χρονιά — και τι βγήκε από αυτούς" | The M7 brief lists these three as having none. The source pages print one each. Recorded, as M5 recorded the award pages, because the brief is wrong and the next agent will read it |
| **Whether the parent note is two-up** | **Yes — two notes to an A4 portrait sheet, each in a dashed frame to be cut out** (M7) | The source page says so itself: "Δύο σημειώματα ανά σελίδα · κόψτε κατά μήκος της γραμμής". Unlike the award pages M5 was told were 2-up, this one is — and it was **rendered and looked at anyway**, per M5's lesson |
| **A register form's row count** | **The source page's own, and the teacher can add rows**, which run onto a second sheet with the header repeated (M7). The goals page's four goals likewise | The spec says no list has a fixed cap, and these are paper forms with a fixed number of ruled lines. The default keeps a blank form to one A4 sheet, as the source's is; the extra rows keep the cap off |
| **`ΕΙΔΟΣ ΣΥΝΕΔΡΙΑΣΗΣ` on the minutes form** | **Free text** (M7) | M6's rule: a vocabulary only where the source enumerates one. The subtitle names three examples; the field itself is a blank box. M5's meeting kinds are a vocabulary because they belong to the stored meetings, which this form is not |
| **Where M7's content strings live** | **A fourth bundle file, `src/i18n/formsEl.ts`**: the period checklist's sixteen fixed items (transcribed) and the folder's suggested boilerplate (the app's own wording). Every caption stays in `el.ts` (M7) | M5's rule — split the bundle by *kind* of string. Captions are labels; the checklist's sentences and the folder's suggestions are content. M9 adds `formsEn.ts` and one line in `BUNDLES` |
| **A certificate's frame on a printed page** | **A sheet's classes are copied onto the pages cut from it** (M7) | **An M5 defect, found while making the paginator walk several sheets.** The stylesheet frames a certificate as `.certificate .page-inner`, but the element that carried `certificate` was the sheet, which the paginator removes — so no page matched, and the two award certificates printed with no frame and an ordinary-sized title. A regression test was confirmed to fail against the old paginator |

| **Wellbeing entries depart from the source page on purpose** | **Free text only — the source's five rating columns are not built** (M8). An entry is a date and the page's one free column, `Τι βοήθησε · τι να αλλάξω` | Page 222, *Ευεξία εκπαιδευτικού · Κάθε Παρασκευή κοιτάξτε πίσω · ένα λεπτό αρκεί*, is a structured weekly check-in: `Εβδομάδα | Ενέργεια | Φόρτος | Διάθεση | Ύπνος | Ισορροπία | Τι βοήθησε · τι να αλλάξω`. The **Wellbeing entries** row above is a product-owner decision — "Free text only; no structured mood/energy/workload dropdowns" — and the later, specific decision wins, as it did for M5's "bilingual content". **Recorded so the next agent does not "fix" it**, as dropdowns or as scales. The screen asserts there is no select, slider, spinner, radio or checkbox on it |
| **A wellbeing entry's key, and the page's two boxes** | **Keyed by an actual date; the week is derived at display time. The two page-level boxes — `ΤΙ ΜΕ ΚΡΑΤΑΕΙ ΣΕ ΦΟΡΜΑ` and `ΟΡΙΑ ΠΟΥ ΘΕΛΩ ΝΑ ΚΡΑΤΗΣΩ` — are one stored note with two fields, not columns on every entry** (M8) | The source's axis is `Εβδομάδα`; M1's rule forbids storing it, and `no_table_is_keyed_by_a_week_index` holds it. A new entry is dated the shell's `today`. The two boxes are separate on the rendered page (the text layer runs them together) and belong to the page, not to a week |
| **Where M8's four surfaces live in the navigation** | **`Έτος` gets its first sub-pages — *Σχολικό έτος / Επαφές σχολείου / Αναπληρώσεις & άδειες* — and module 7 gets one new section, `Ανάπτυξη & Ευεξία`, with *Ανάπτυξη και καριέρα / Ευεξία*.** The top row goes from ten to **eleven** (M8) | The spec files the directory and the covers/leave log under module 1, and the source's own ΕΤΟΣ index page lists them beside the calendar and the annual goals ("Άνθρωποι στο σχολείο · Διεύθυνση, γραμματεία και συνάδελφοι", "Αναπληρώσεις και άδειες") — M6's move on `Πλάνο`, M1's screen unmoved as the first tab. Module 7 had no section, and nothing else in the app is about the teacher herself — M5's situation; the source carries ΕΥΕΞΙΑ and ΑΝΑΠΤΥΞΗ as two top-level items, and one tab named after the spec's module keeps the label honest about both. `App.test.tsx` pins eleven and says why |
| **Development goals, the six annual goals and M7's goals form** | **Three independent surfaces. Nothing seeds, prefills or copies between any two of them** (M8) | The spec says development goals and annual goals are distinct and neither is generated from the other; M7 recorded that its *Στόχοι και επαγγελματική ανάπτυξη* form is neither. `development_goal` has no key to anything, no command writes two of them, and the development screen neither shows nor reads `annual_goals`. **Visibly separate** because they are in different sections — the six on *Έτος → Σχολικό έτος*, the open list on *Ανάπτυξη & Ευεξία → Ανάπτυξη και καριέρα* — which is how the source keeps them: page 10 *Στόχοι για τη χρονιά* under ΕΤΟΣ, the `ΣΤΟΧΟΙ ΑΝΑΠΤΥΞΗΣ` box on page 224 under ΑΝΑΠΤΥΞΗ. Each screen carries one sentence saying the other exists and is separate. A development goal's `status` is free text, like an annual goal's |
| **A cover taught and a leave taken** | **Two tables (`cover_record`, `leave_record`), two commands, two selectors, no key between them** (M8) | The spec's "two related but separate registers". The source prints both on page 13, a register over two boxes. A leave's `ΕΓΓΡΑΦΑ ΠΟΥ ΚΑΤΑΤΕΘΗΚΑΝ` is stored **per leave**, the spec's "documents submitted" field, the shape M4.5 resolved for a captioned box |
| **A cover record is not the timetable, and a leave is not the folder** | **Nothing reads or writes across** (M8) | "Αναπλήρωση" now means four things: the master timetable's duty cell (M3, a *planned* weekly slot), the substitute folder (M7, what someone covering *her* needs), a cover record (M8, a *dated record* of one she taught) and a leave record (M8, her own absence). Plan versus record is M5's booking/log distinction again. Tested at the storage layer and in the fixtures |
| **A cover's `Τάξη`** | **Free text, not a link to a class** (M8) | The class she covered is usually a colleague's and not in her class list. M4's optional link (`ON DELETE SET NULL`) suits an incident in *her* class; here a link would force her to create a class she does not teach, which would then appear in her gradebook, her timetable picker and her substitute folders |
| **Merged source columns** | **One field per source column**: a contact's `Θέση / Τομέας` is one `role`; a cover's `Μάθημα / Ύλη που καλύφθηκε` is one `covered` and its `Υπογραφή / Παρατηρήσεις` one `notes` (M8) | The source heads each pair as one column (pages 12 and 13) and the spec writes "role/area" and "subject/material covered" as one phrase. M4 split a support plan's strengths and needs because the source boxed them separately; these it does not. **The M8 brief's field lists split them**; the rendered pages do not, and the page wins |
| **How a training line's cost and hours are stored** | **Nullable `REAL`: `NULL` is "not entered", `0` is a real zero; `CHECK` refuses a negative.** The input accepts `12,50` and `12.50`, shows the stored value back with a dot, and **refuses anything else without saving it** (M8) | **Different from M6's textbook `Τιμή`, deliberately.** A price is never added up, so it can say "δωρεάν". A training cost is summed by a roll-up the spec asks for and the page captions (`ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΚΑΙ ΣΥΝΟΨΗ`), and a sum cannot read a word; "δωρεάν" is typed as `0`, and the refusal says so. The same three-way reading as M2's weights — one parser, `domain/numbers.ts`, which M2's `parseWeight` now reads through |
| **The budget summary roll-up** | **A pure function, `trainingSummary()`, over the school year's own window — week 1's Monday to week 53's Sunday — never the clock.** A blank cost is left out and **counted** ("N χωρίς έξοδο"); a line outside the year and an undated line are counted apart too; the remainder is shown only when a budget has been entered, and an overspend as one. Sums are in hundredths. Without a start date, every line counts and the screen says why (M8) | M2's rule — the app never invents a number the teacher did not type — applied to money. The budget itself is **one stored row** (`development_budget`: amount, notes) beside the page's notes box: one active school year per file, so one figure |
| **A training line's `Μορφή` and `Βεβαίωση`** | **Free text, both** (M8) | M6's rule: a vocabulary only where the source enumerates one, and page 224's columns enumerate nothing. A certificate is not a vocabulary but could be a tick; it is text because the common real answers are "αναμένεται" and a certificate number, which a tick cannot hold |
| **The staff directory's search** | **The message bank's folding rule, moved to `domain/search.ts` and shared**, over name, role, phone and email; it searches staff contacts only (M8) | "Do not write a second folding function." A guardian who shares a colleague's name is in another table and is never returned — the fixture carries exactly that case |
| **Which M8 surfaces produce a PDF** | **None** (M8), per the scope line | The "PDF output" section names none of the four, and neither module entry says "printable". One source detail is raised rather than decided — see Open |
| **Three details of the M8 brief were wrong about its source pages** | **The pages win** (M8) | Page 13's register has **five** columns, not seven (two pairs are merged); page 224's has **seven**, not eight (`Επιμόρφωση / Δραστηριότητα` is one); page 222's standing box is **two** boxes. Found by rendering the pages, per M5's and M7's lesson; recorded because the next agent will read the brief |


| **Where the interface language is stored** | **In the data file: a one-row `preference` table added by `migrate_to_10`, holding a language code** (M9). A fresh file, and every file that climbs from M8, reads `el` | The spec asks for the language to be "persisted as a preference, not tied to the OS locale", and there were two candidates. A file *beside* `planner.sqlite` would only be per-device if it lived outside the synced folder — anything inside it syncs — and the spec keeps everything the app writes in that one folder. In the data file, the language travels with the teacher's records: the PC opens in the language she left the Mac in, and a sheet printed on either machine comes out the same. The cost, accepted: **switching the language is a write**, through `mutate()`, the fingerprint check and the disk-changed block, like every other record — so it is refused while the file is blocked, and the toggle is disabled until the reload. `locale` is checked in Rust, not by a `CHECK`, as M7's form `kind` is |
| **Where the language toggle sits** | **The header, top right, on every screen: two small buttons, each language named in itself — *Ελληνικά* and *English*** (M9) | Not a new top-level tab (the brief ruled that out), and not the storage panel at the foot, because the toggle changes every screen and the header is the one thing on every screen. Each language is named in its own language, in both bundles, so a teacher who switched by mistake can find her way back. The only Greek allowed inside an English string is `lang.el`, and `i18nParity.test.ts` holds that |
| **Where the language comes from** | **The data file only — never `navigator.language`, `Intl` or anything else of the OS's.** An unknown code falls back to Greek (M9) | The spec's own words. Tested with the browser claiming English over a Greek file and Greek over an English one |
| **What a filled `[PLACEHOLDER]` is kept against** | **A stable code: `ph.<code>`, whose text in each language is a string id** in `messagesEl.ts` / `messagesEn.ts` (M9). `domain/placeholders.ts` lists the 72 codes and maps a token back to its code in whichever language is on | **An M5 defect, found as the brief predicted.** The message bank kept a filled value against the token's own Greek text — `values["ΜΑΘΗΜΑ"]` — so switching to English, where the slot reads `[SUBJECT]`, would have lost every value and printed a ruled blank in its place, against the spec's "the English version of that same letter with the same filled-in placeholders". The letters' reply slips had the same shape. The token text is still what the screen shows as the field's caption, in the language that is on. A test holds that every message and letter asks for **the same codes** in both languages |
| **The picked message across a language switch** | **Stays open** (M9). The message screen resolves the picked code in the current language instead of looking it up in the search results | A query typed in Greek matches nothing in the English bank, so the message the teacher was filling would otherwise have closed as she switched |
| **Sorting and search in an English interface** | **Unchanged: names still sort with `localeCompare(…, "el")`, and the search fold is language-blind** (M9) | What is sorted is teacher-entered text — Greek names, whatever the interface language — so Greek collation is still right. The other `localeCompare` calls compare ISO dates and clock times, where locale is irrelevant. `foldForSearch` strips accents and case for Latin as for Greek; a test searches the English bank by an English phrase in capitals |
| **A failure reported by the Rust side** | **Worded in the interface language, with the system's own message after a colon** (`error.db`, `error.io`, `error.pdf`, `error.other`) (M9) | The Rust side holds no user-facing string, so its messages are English. Before M9 they were shown on their own — an English sentence in a Greek interface. The shell now keeps *what happened* rather than a finished sentence, so a message on screen re-words itself when the language changes |
| **The English content's authorship** | **An unreviewed machine-translated draft, written by the M9 agent, and marked so at the top of `lettersEn.ts`, `messagesEn.ts` and `formsEn.ts`** (M9), per the "English translation authorship" row | The app's labels (`en.ts`) are the app's own and are not so marked. The letters and messages go to parents; until someone who reads both languages has read them, they are proposals. The teacher-facing docs say so too |
| **English symbols and grades** | **The month card's key is `· a l e` (present, absent, late, excused); descriptive grades print `A–D`** (M9) | The file stores codes (`present`…, `a`…`d`), never the symbol, so the symbols are labels like any other. English uses its own initials |
| **Whether the teacher-facing docs get an English version** | **No — Greek only** (product owner, 2026-09-25, asked at M9) | `docs/user/` is updated for the toggle, and "Αγγλικά" is gone from its not-yet list |
| **Backups, as tuned at M9** | **The schedule is unchanged. Taking a snapshot changed in four ways** (M9): it is written under a temporary name and renamed; it is copied under SQLite's shared lock, so it can never catch a commit half-written; an automatic snapshot (launch, 30 minutes, quit) is skipped when the newest snapshot already holds the same bytes — the storage panel's button still always writes one; and **a quit on macOS now takes its snapshot** — until M9 only `ExitRequested` was handled, which a normal Mac quit never raises | Measured, not assumed: a near-empty schema-9 file is 397,312 bytes; a heavy year (150 students, the attendance grid filled every school day, 15 marks each, weekly plans and notes) is **3.85 MB**. The 7-day tier dominates the folder; see the M9 release note for a year's cost. **Two things the schedule does not do, found by testing it**: thinning is not monotonic in time (an older snapshot of a day thinned while in the daily tier could briefly have been kept by a later pass as its month's representative — a newer snapshot of that day always survives), and a clock set a year forward thins everything that exists to one per month, irreversibly. The newest snapshot of every month survives any pass at any clock, and two devices thinning one folder converge; both are tested |
| **Code signing** — *updated* | **Out of scope for M9; listed as the first blocker before the app is handed to the teacher** (product owner, 2026-09-25, asked at M9 as the M0-era "Code signing" row required) | The M0-era row said "revisit before M9". It was revisited: no certificate is bought or configured in M9 |

| **M10 — Handover readiness** | **A milestone the roadmap did not have**, created by the product owner after M9 to hold what stands between the signed-off M9 build and the teacher. Its scope was set item by item on 2026-09-25, and every row below records one of those calls | The brief left each item as a question for the product owner, and the agent asked before planning |
| **Code signing** — *M10* | **Out of M10 as well** (product owner, 2026-09-25). v1.0.0 ships unsigned. The procedure for whoever signs later is `docs/CODE_SIGNING.md`; nothing in `tauri.conf.json` or CI was changed | Still the first item on the list of what stands between the build and the teacher. The teacher-facing guide tells her what SmartScreen and Gatekeeper will ask |
| **What prints, answered** (M10) | **Print: a meeting's minutes, M1's six annual goals, and the conduct sheet bundled with the grade sheet. Do not print: M6's surfaces (exam tracker, trips, textbooks, annual plan, progress matrix) and the covers register** (product owner, 2026-09-25) | Five Open questions raised at M2, M5, M6 and M8, answered together. The three that print are one document definition each on the existing contract, in both languages |
| **How a meeting's minutes print** | **One portrait A4 sheet per meeting, from an export button on the meeting's own card, laid out as M7's blank *Πρακτικό συνεδρίασης* form**: a row of fields (kind, date, time, duration, class), the attendees and the agenda as captioned areas, the agreements as the sheet's table (who / what / by when), then the notes (M10). An empty agreement list is said in words | That form is the source's own minutes page, so its layout is the one a teacher recognises. The sheet reads the card's own selectors (`allMeetings`, `agreementsOfMeeting`, `meetingClass`) and nothing else, verbatim. **The blank form still reads nothing**; the two stay the two different artefacts M7's row describes |
| **The document contract's one M10 addition** | **`PrintDocument.lead`: blocks that flow above the table**, and the paginator walks a sheet's items in document order instead of "all rows, then all blocks" (M10) | The minutes are the first sheet with blocks *above* a register. Every earlier sheet already had its rows before its blocks, so each paginates exactly as before, and M2's to M9's paginator tests are unchanged and green. A test pins the new order, and a mutation that restored the old order failed it |
| **How the six annual goals print** | **One landscape table, one row per area in the order the cards are shown, one column per card field; it prints what the six cards show — saved or not** (M10) | "Printed as one table" is the spec's own phrase. The cards save one at a time with their own button, so the screen can show a draft that is not stored yet. M4.5's rule is that what prints is what the teacher is looking at, so the export builds from the cards' draft. The order comes from one selector, `annualGoalsInOrder`, shared by the cards and the sheet |
| **The grade sheet and the conduct sheet** | **One PDF from the gradebook's button (*Εξαγωγή PDF βαθμών και συμπεριφοράς*), the two sheets bundled by `renderPrintBundle()`; the conduct sheet keeps its own button for printing it alone** (M10) | M2's open question, answered by the product owner. They stay two documents with their own headers, each starting a page, in one landscape file. Keeping the conduct sheet's own button costs nothing and keeps a use the teacher already had |
| **The English content** (M10) | **Greek content only until reviewed.** In the English interface, the seven letters, the 150 messages (with their categories and placeholder names) and the forms' content (the checklist's items and the folder's suggestions) are served from the Greek files, and **a letter or a message prints wholly in Greek**, footer and file name included. A form or the folder prints English captions around the Greek content. One switch, `ENGLISH_CONTENT_REVIEWED` in `src/i18n/contentReview.ts`, turns the English drafts on (product owner, 2026-09-25) | The drafts are an unreviewed machine translation, and they go to parents. The English files stay in the build, held key for key and placeholder for placeholder by `i18nParity.test.ts`, and `Bilingual.test.tsx` exercises them with the switch on. So the day a review lands, turning them on is one line. The screens that hold content say why it is Greek, in English. **Supersedes, for now, the M9 row's "switching the language changes all of them"** as far as the content is concerned |
| **Counts** (M10) | **Every count is a pair, `<id>.one` and `<id>.other`, chosen by `countOf()`: the singular for exactly one, the plural for anything else, zero included**, in both languages | Greek and English share that rule, so a pair is enough. 22 strings became pairs. A test fails on any string that puts a noun after `{n}` without being a pair. The four with no noun after `{n}` ("{n} χωρίς έξοδο") and the fixed 53-week count stay single, and the test allows them by name. A mutation adding one unpaired count string failed it |
| **The `Email` label in Greek** (M10) | **Stays `Email`** (product owner, 2026-09-25) | M1's open question. It is a common Greek loanword; recorded so that it is a decision rather than an accident |
| **The invitation's two date fields, and the certificates' layout** (M10) | **Both left as they are** (product owner, 2026-09-25) | M9's two open items. The invitation keeps asking for the meeting date at its head and again for its slip. The certificates keep their top-weighted content and the footer inside the frame |
| **Backup snapshots stay uncompressed** (M10) | **No compression** (product owner, 2026-09-25) | M9's question. The restore procedure stays "copy a backup into place", which is what `docs/user/restore.md` teaches and what M10's restore rehearsal checked on both OSes |
| **The app's version** (M10) | **`1.0.0`, one number in `package.json`, `Cargo.toml` and `tauri.conf.json`, shown as *Έκδοση εφαρμογής* beside the schema version; tag `v1.0.0`** on the merge commit after the product owner's sign-off. **Now `1.0.1`** (tag `v1.0.1`, 2026-09-26): per-lesson attendance, schema 11 | A Rust test fails if the three manifests disagree. The version on screen is the Rust side's own `CARGO_PKG_VERSION`, so it is the binary's and not a copy |
| **What the teacher runs, and from where** (M10) | **The `.app` and the `.exe` in the synced folder — never the NSIS installer or the `.dmg`.** The handover folder keeps those two in an `installers/` folder of their own, and the teacher-facing guide says not to use them | The app keeps `data/` beside its executable. That is the spec's design. It means an installed copy — `%LOCALAPPDATA%\Teacher Planner`, or `/Applications` from the `.dmg` — would keep the teacher's data **outside the synced folder**, on one computer. The pre-M10 guide implied she would use the installer. It was rewritten. **Raised in the M10 PR**, since the brief asked for both files in the handover folder |


### Open — flag back rather than silently decide

- **The English letters and messages need a bilingual read before a teacher
  sends one.** *M10: until that read happens, the English interface shows and
  prints the Greek content instead (Resolved, "The English content"). The read
  is still wanted, and turning the drafts on after it is one line.* M9's English
  content is an unreviewed machine draft (Resolved above). Whoever reads it should read it against the Greek: the letters and
  the fifteen categories' first messages are rendered side by side in the M9
  fidelity pack. Raised at M9 (2026-09-25).

- **Every "should X print?" question below now costs two languages. —
  ANSWERED at M10 (2026-09-25)**: minutes, the annual goals and the conduct
  sheet with the grade sheet print; M6's surfaces and the covers register do
  not. See Resolved. A new
  printed sheet needs its captions in `el.ts` and `en.ts` and must be looked at
  in both, since M7 and M9 each found layout defects only by rendering. That
  makes each of the open printing questions more expensive to answer later than
  it was before M9. Raised at M9 (2026-09-25), not answered.

- **The invitation asks for the meeting date twice. — ANSWERED at M10: left as
  it is** (product owner). Its head has a `ΗΜΕΡΟΜΗΝΙΑ`
  field and its reply slip a `[ΗΜΕΡΟΜΗΝΙΑ]` token, and they are separate inputs.
  An M5 comment said the slip's token was filled from the head's field; it
  never was (the field is keyed `date`, the token was keyed by its Greek text).
  M9 corrected the comment and kept the behaviour. Filling the slip from the
  head would be one line in `letterSheets.ts`. Raised at M9 (2026-09-25).

- **Two details of the printed certificates, for a judgement. — ANSWERED at
  M10: left as they are** (product owner). The content sits
  in the top two-thirds of the frame, where the source centres it, and the
  sheet's footer ("Printed …") prints inside the frame — on the award itself.
  Neither is clipping or a spill, so M9 did not change them. Raised at M9
  (2026-09-25).

- **Counts are not pluralised, in either language. — DONE at M10** (Resolved,
  "Counts"). "1 messages", "1
  students"; Greek has the same shape ("1 μηνύματα"). A plural form per count
  string, in both bundles, would fix it. Raised at M9 (2026-09-25).

- **Should snapshots be compressed? — ANSWERED at M10: no** (product owner). A heavy year's file is 3.85 MB and
  compresses to 0.71 MB with gzip; the 7-day tier alone can hold dozens of
  copies. Compressing would change the spec's restore procedure ("copy a backup
  over `planner.sqlite`"), so it is not a tuning call. Raised at M9 (2026-09-25).


- **Should the *Κωδικοί και πρόσβαση* form be fillable in the app at all?**
  The spec asks for all eleven forms to be "fillable, nameable, saveable", and
  M7 builds this one like the rest. But what a teacher types into it is her
  passwords, and it is stored **unencrypted** in `planner.sqlite`, inside a
  folder synced to the cloud, and in every backup snapshot. M7 shows a warning
  above the form saying exactly that and suggesting she print it blank. The
  alternatives are to offer it blank-only (print, never store), or to encrypt
  it — which would need a passphrase and is well beyond a form. Raised at M7
  (2026-09-24).

- **Should the substitute folder print students' health and support notes?**
  Its *ΜΑΘΗΤΕΣ ΠΟΥ ΧΡΕΙΑΖΟΝΤΑΙ ΠΡΟΣΟΧΗ* box lists, from the cards, each
  student's SEN category, the class's support note, allergies, conditions and
  medication — which is what that box on the source page is for, and what a
  substitute most needs to know. But it puts special-category information on a
  sheet meant to be left in a drawer. The alternatives are health fields only
  (the safety-critical half), or nothing live and a free box as on the source.
  Raised at M7 (2026-09-24).

- **The substitute folder's suggested text is the app's own Greek, not the
  source's.** "Descriptive boilerplate text is prefilled once", but the source's
  boxes are blank, so there was nothing to transcribe. M7 wrote short, generic
  suggestions in `src/i18n/formsEl.ts` for the rules, where things are, what to
  do if something goes wrong, the six procedures and the message to the
  substitute. They are written to be replaced, and a Greek-speaking teacher
  should read them before a teacher does. Raised at M7 (2026-09-24).

- **Should the folder's contacts come from M8's staff directory?** M7 stores
  the five school contacts as the folder's own text, typed once for every
  class. When M8 builds the directory, those five could point into it instead —
  which would be one more place typed once. Raised at M7 (2026-09-24) for M8.
  **M8 built the directory and did not wire it. What wiring would cost:** one
  migration adding `substitute_contact(role PRIMARY KEY, staff_contact_id
  REFERENCES staff_contact ON DELETE SET NULL)`; a picker beside each of the
  five contacts on the folder's last page; `substituteFolder()` reading the
  linked contact's name and phone live, as it already reads the seating; and a
  rule for which wins when a contact is both linked and typed. **Nothing the
  teacher has already typed would be converted** — the typed text stays and
  shows until she picks a link, so no migration touches her data. A deleted
  directory entry would fall back to the typed text rather than to a blank.

- **Should any other free-text name point into the staff directory?** Three
  fields hold a colleague's name as text today: a meeting's `attendees` (M5), a
  cover's `teacher` (M8) and a trip's `responsible` (M6). M8 converted none of
  them, because converting would be a migration over text the teacher has
  already typed. An *optional* link beside each — the text kept, the link added
  — is the shape the folder question above would set; a meeting's attendees are
  several people and would need a join table rather than one column. Raised at
  M8 (2026-09-24).

- **Should the covers register print? — ANSWERED at M10: no** (product owner). Page 13's last column is `Υπογραφή /
  Παρατηρήσεις` — a signature, which suggests a sheet the teacher hands to the
  deputy head to sign. The spec's "PDF output" section does not name it and
  M8's scope line names no PDF, so M8 ships none (the M2/M3 precedent). It
  would be one document definition on the existing contract, with a blank
  signature column. Raised at M8 (2026-09-24).

- **Should a leave cover several days?** The spec's `LeaveRecord` has one
  `date`, and M8 stores one; a three-day sick leave is one record dated its
  first day, with the length in its reason. A `to` date is one column and one
  migration if the product owner wants ranges. Raised at M8 (2026-09-24).


- **Are the six resource categories about what a material *is*, or about whom
  it belongs to?** This document's module-3 entry says "entries across the six
  source categories (own / school / shared / borrowed / digital / other)" —
  provenance. **The source page says otherwise.** *Υλικά και πηγές* has six
  captioned boxes and they are `ΙΣΤΟΤΟΠΟΙ ΚΑΙ ΠΛΑΤΦΟΡΜΕΣ`, `ΕΦΑΡΜΟΓΕΣ`, `ΒΙΒΛΙΑ
  ΚΑΙ ΚΕΙΜΕΝΑ`, `ΒΙΝΤΕΟ ΚΑΙ ΗΧΟΣ`, `ΒΟΗΘΗΜΑΤΑ ΣΤΗΝ ΤΑΞΗ`, `ΑΛΛΕΣ ΠΗΓΕΣ`, and
  the ΠΛΑΝΟ index card that opens it reads *"Ιστότοποι, εφαρμογές, βιβλία και
  ταινίες"*. The provenance list appears nowhere in the source package; the
  materials-loan log among M7's 11 print forms was checked and its columns are
  `Ημερομηνία / Μάθημα / Δόθηκε σε / Πόσα / Επιστροφή / Κατάσταση`. M6 ships the
  page's six. If the provenance six were meant — and there is a real argument
  for them, since knowing whether a thing is the school's or yours is what you
  need when you leave — it is one vocabulary and one migration. Raised at M6
  (2026-09-23).

- **Should M1's six annual-goal areas print? — ANSWERED at M10: yes, and built**
  (Resolved, "How the six annual goals print"). The "PDF output" section names
  "annual goals" among the surfaces that produce a real PDF file, and module 1
  says the six areas are "printed as one table". **Nothing has built it.** M1's
  own scope line named no PDF and M1 predates the print machinery entirely;
  M4.5 built the three M4 surfaces and M5 the parent ones, and neither was asked
  for this. M6 read the phrase carefully because it had to decide whether it
  meant M6's annual *plan* — it does not; `annual_goals` is M1's table and the
  wording matches it — and so M6 ships no PDF, per its own scope line. But that
  leaves a surface this document promises a file and has not got one, which is
  exactly the shape that created M4.5. It is one document definition on the
  existing contract. Raised at M6 (2026-09-23).

- **Should a trip be able to fill in M5's consent letter?** M5 ships
  *Συγκατάθεση για επίσκεψη / εκδρομή* as one of the seven parent letters, and
  **stores nothing for a filled letter** by a decision of its own. The letter
  asks for six fields — `destination`, `date`, `class`, `hours`, `cost`,
  `escorts` — and a trip now holds **five of them** (`activity` → destination,
  `date`, `class_id`, `cost`, `responsible` → escorts; only `hours` has no
  equivalent). Handing them across would save the teacher typing them twice,
  which is the same argument that shaped everything else in this milestone. M6 does not do it, because it would change M5's
  decision rather than extend it, and because it is entangled with the open
  question about whether a filled letter should persist at all. The trips screen
  points at the letter in a hint instead. Raised at M6 (2026-09-23).

- **Should any of M6's six new surfaces print? — ANSWERED at M10: no**
  (product owner). M6 ships none, because its
  scope line names none and the M2/M3 precedent is that a milestone ships its
  scope line exactly. But four of them are registers of the same shape as the
  ones M4.5 and M5 gave PDFs to — the exam tracker, the trips register, the
  textbook list and the annual plan are all things a teacher hands to a head of
  department or carries to a meeting — and each would be one document definition
  on the existing contract. The progress matrix is the interesting one: it is
  the widest table in the app after the attendance card, and the source prints
  it over two pages. Raised at M6 (2026-09-23).

- **Is an exam's `Βαρύτητα` meant to reach the gradebook?** M6 keeps them
  strictly apart: an exam's weight is a planning note, and M2's percentage
  weights on `grade_column` are what compute an average. That is the safe
  reading — the app never invents a number the teacher did not type — and it is
  what the two source pages look like, since the exam page is a planning
  register and the weights live in the grade registry. But a teacher who writes
  "20%" on an exam in September and then types 20 into a grade column in
  November has said the same thing twice, which is the one thing this milestone
  spent its effort avoiding elsewhere. Linking them would mean an exam
  optionally naming a grade column. Raised at M6 (2026-09-23).

- **Does the Feb–Dec year model cover eleven months or twelve?** Read literally
  it is February to December, which is eleven. The source product's own
  quick-start page promises "53 εβδομάδες και 12 μήνες" for every model. M1
  implements the literal reading (Feb–Dec = 11 months) rather than guessing at a
  wrap into January, because guessing would silently change which months a
  teacher's calendar shows. Raised at M1 (2026-09-19); one line in
  `src/domain/schoolYear.ts` changes it either way.

- **Should an annual goal's status be free text or a fixed vocabulary?** The
  spec lists `status` as a field on each of the six goal areas without saying
  which. The source product leaves the whole area as an open box. M1 ships it as
  free text, matching the source and matching the spec's only explicit statement
  about a status field anywhere (SupportPlan's, which it says is "written by the
  teacher, never computed"). Raised at M1 (2026-09-19).

- **Is the `Email` label meant to stay in English? — ANSWERED at M10: yes, it
  stays `Email` in Greek too** (product owner). It is the only English
  string on the student card; every other label is Greek. It is a common Greek
  loanword, so this may well be deliberate — but it is currently an implicit
  choice rather than a recorded one. Raised at M1 (2026-09-20). *(M9: in the
  English interface it is simply "Email"; the question is about the Greek one
  and is still open.)*

- **Does anything in M4 produce a PDF? — CLOSED.** Answered by the product
  owner on 2026-09-22 (yes, as M4.5) and **delivered by M4.5 on 2026-09-22**:
  the incident log, the absence register and the cross-class support overview
  each export a real PDF, and the filled monthly attendance grid does too. The
  original question is kept below because it is the reasoning M4.5 started from.
  M4 shipped **none**, because its
  delivery-scope line names no PDF export and the precedent is that a milestone
  ships its scope line exactly (M2 built PDFs because its line said so; M3 did
  not because its line did not). But this one is a real conflict rather than
  silence: the spec's module-2 entry says the incident log and the support
  overview are "both printable", and its "PDF output" section names "absence
  logs" and "support plans" among the surfaces that produce a real PDF file.
  **So three of M4's four surfaces are promised a PDF somewhere in this
  document and have not got one.** The product owner's 2026-09-21 ruling that
  the *timetable* needs no PDF is explicitly narrow and does not extend here.
  M4 deliberately left no on-screen note about it — that is the mistake M3 made
  with `timetable.printLater` — so nothing misleading is shown; the surfaces
  simply have no export button. **Recommendation: give the incident log, the
  absence register and the support overview real PDF exports, either as a small
  piece of work of their own or folded into M5, which is already building print
  surfaces.** The app's pagination is its own since M2, so each is a document
  definition rather than new machinery. Raised at M4 (2026-09-21).

- **Should a meeting's minutes print? — ANSWERED at M10: yes, and built**
  (Resolved, "How a meeting's minutes print"). M5 gives a PDF to the letters, the
  message bank, the communication log and the parent-appointment week — every
  surface this document promises one somewhere. It gives **none to the
  staff/council/class meetings**, because nothing in the spec asks for one: the
  "PDF output" section does not name them and M5's scope line names only the
  letters and the bank. But the source product's own ΟΜΑΔΑ page is headed
  *"Πρακτικά, συμφωνίες και ενέργειες"*, and minutes with a list of who agreed
  to do what by when is a thing a teacher hands round. It is one document
  definition on the existing contract and no stored data either way. Raised at
  M5 (2026-09-23) rather than silently decided, which is the M4 precedent.
  **M7's blank *Πρακτικό συνεδρίασης* form is not an answer to this.** It is a
  loose page the teacher fills in by hand or on screen; it does not read a
  stored meeting, and a meeting recorded in *Συνεδριάσεις* still has no PDF.

- **Should a filled letter be saveable?** M5 stores nothing for a
  letter: it is filled and printed in one sitting, and the values live in the
  screen. The risk is that a
  teacher who fills a long newsletter, closes the app and comes back expects to
  find it. Raised at M5 (2026-09-23). **What it would cost now (M7):** no
  migration. M7's `print_form` / `print_form_value` store exactly the shape a
  letter already has — a named record plus a key → value map — and `kind` has
  no `CHECK`, so a letter would be `kind = "letter.welcome"` and so on: seven
  more codes in `PRINT_FORM_KINDS`, and the letters screen gaining M7's saved
  list, *Νέο* button and per-field saving. The same answer settles whether a
  trip fills in the consent letter (M6's question), since a trip could then
  create a saved letter. Still the product owner's call; M7 did not wire it.

- **M4.5's open question about page-level boxes now applies to a second
  register.** The printed communication log lists each line's own stored
  `remarks` in the source page's `ΠΑΡΑΤΗΡΗΣΕΙΣ` box, one attributed line per
  entry — the shape M4.5 resolved for the absence register's two boxes, and it
  inherits the same concern: it reads well for a handful of lines and badly at
  volume. Whatever is decided for the absence register should be decided for
  this one at the same time. Raised at M5 (2026-09-23).

- **Should the absence register's two per-event fields print as page-level
  boxes, or as two more columns?** The source page has eight columns and two
  captioned boxes at its foot, *ΠΡΟΣΟΧΗ · ΣΥΧΝΕΣ ΑΠΟΥΣΙΕΣ* and *ΓΟΝΕΙΣ
  ΕΝΗΜΕΡΩΘΗΚΑΝ · ΕΝΕΡΓΕΙΕΣ*, whose captions are exactly the names of two fields
  M4 stores **per event** because the spec lists them among the event's own
  fields. M4.5 prints them in the boxes, one attributed line per event, verbatim.
  It reads well for a real register of a handful of lines. **It reads badly at
  volume**: a stress fixture of 30 events produced a 30-line follow-up box
  filling most of a page. The alternative is two more columns on an already
  eight-column landscape sheet. Raised at M4.5 (2026-09-22); it is a change to
  one document builder and no stored data either way.

- **Should the incident register have a page-level notes field?** Its source
  page carries a *ΠΡΟΣΘΕΤΕΣ ΣΗΜΕΙΩΣΕΙΣ* box, and nothing in the data model
  corresponds to it. M4.5 prints it **blank**, as ruled space the teacher writes
  in by hand, because filling it would have meant a stored field and M4.5's
  scope line is explicitly "no new data, no new fields, no schema change". If it
  should hold something typed in the app, that is one column and one migration,
  and it belongs to whoever is told to add it. Raised at M4.5 (2026-09-22).

- **The printed support overview has seven columns; the source page has six.**
  The seventh is the screen's *Στήριξη ανά τμήμα*. M4 established that a
  "card-level support flag" is two different things — `Student.sen_status` and
  each class's `Enrollment.support` with its own note — and that the overview
  needs both shown separately; folding them together for print would make the
  paper disagree with the screen, which M4.5's own acceptance criterion forbids.
  So the sheet carries the source's six columns plus that one. Raised at M4.5
  (2026-09-22) as a deliberate departure from the source's column count rather
  than an oversight.

- **Should the absence register offer more kinds than `absence` and
  `late`?** The spec says an absence event has a "kind" without enumerating
  one. The source register has exactly two tick columns, `Απ.` and `Καθ.`, so
  M4 ships those two rather than inventing a third. Early departure
  (πρόωρη αποχώρηση) is the obvious candidate and is a real thing teachers log,
  but adding it would be the app inventing a category the source does not have.
  One entry in `ABSENCE_KINDS` and one string change it. Raised at M4
  (2026-09-21).

- **Is the monthly grid's "δικαιολογημένη" a fourth state or a flag on an
  absence?** The source card's key is `· παρών, α απουσία, κ καθυστέρηση,
  u δικαιολογημένη` — four symbols, one per cell — and the spec names four
  states (present / absent / late / excused). M4 ships them as four mutually
  exclusive codes, matching both readings of the page, so "excused" means "an
  excused absence". The alternative reading is two dimensions (absent, plus a
  justified flag), which would let a *late* arrival be justified too. M4 did
  not take it because the spec asks for four states and because the flag
  reading already exists exactly where the spec puts it —
  `AbsenceEvent.justified`, on the detailed register, which is independent of
  the grid. Raised at M4 (2026-09-21) as a deliberate reading rather than an
  oversight.

- **Where should the per-class pass threshold ("Βάση") live?** M2 gives it, the
  scale's upper bound and the printed sheet's period caption their own
  `class_grading` table keyed by `class_id`, rather than three more columns on
  `class`: it is a gradebook setting, the source registry keeps it in the
  header of each class's grade sheet, and keeping it out of `class` leaves M1's
  table and its round-trip tests untouched. A class with no row reads back as
  the defaults. Raised at M2 (2026-09-20); one migration changes it either way.

- **Should the conduct sheet print as part of the grade-sheet PDF or as its own
  file? — ANSWERED at M10: as part of it, with its own button kept** (Resolved,
  "The grade sheet and the conduct sheet"). M2 ships it as its own, matching the source product, which keeps
  "Συμπεριφορά και στάση" as a separate page — and M7 is the only place the
  spec asks for several pages bundled into one PDF. Raised at M2 (2026-09-20).
  **Now cheap (M7):** `renderPrintBundle()` puts several documents in one file,
  each on its own pages, and the grade sheet and conduct sheet are both
  landscape — so bundling them is one call in `GradesScreen` and no new
  machinery. Still the product owner's call.

- **The source's conduct page rates four things; the data model names one.** The
  PDF's conduct page has columns for *Συμμετοχή, Αυτονομία, Διαγωγή* and
  *Συνέπεια* plus the written overall result, while this spec's `GradeRow` names
  a single six-level conduct rating plus observations — which is also what the
  Excel registry has. M2 ships the data model as written rather than inventing
  three fields or quietly dropping three columns the source has. Raised at M2
  (2026-09-20).

### Carried risks

- **The source package: RESOLVED on 2026-09-24, ahead of publishing the
  repository.** The product owner decided to make the repository public and to
  work only from the development Mac. So:

  - `reference/` is **git-ignored and untracked**; it remains on the dev Mac as
    the working authority, and agents there keep reading it when a decision
    turns on a source page (see `docs/MILESTONE_PROMPT.md` §2).
  - **The history was rewritten** with `git filter-repo` to remove `reference/`
    from every commit — all ten files had arrived in a single commit on
    2026-09-19 and were never removed — and **pushed to a new repository**, not
    force-pushed over the old one: GitHub keeps each pull request's head commit
    under a read-only `refs/pull/N/head` that a force-push cannot reach, so the
    old repository would still have served the files. The old repository is
    kept private as an archive; it holds PRs #1–#13 and every CI run the
    release notes link to.
  - **What is copyrighted, per the product owner (2026-09-24): the planner PDF
    only.** The transcribed letters and message bank in `src/i18n/`, and the
    forms' fixed text, are **not** a copyright concern and are published. That
    is the product owner's call, recorded here because the previous version of
    this entry treated the whole package as third-party work.
  - Nothing in `src/`, `src-tauri/`, `tests/`, the build or CI reads from
    `reference/` — checked again before the rewrite — so a clone without it
    builds and passes every test.

  The original entry, kept for the reasoning: the package was deliberately kept
  in a private repository because it was the authority on wording and layout
  for every milestone, with the history rewrite deferred until "publication, or
  anyone else gaining access — whichever comes first". Publication is that
  trigger, and this is the rewrite it called for.

- **An unsigned Windows build tagged with Mark of the Web will not start without
  the teacher clicking through SmartScreen.** Anything downloaded, emailed, or in
  some configurations delivered by a sync client arrives with that tag.
  **Verified on a real Windows machine on 2026-09-20**: a
  **Confirmed a second time on 2026-09-22**, by the product owner, inside the
  `MilestoneTesting` VM at the M4.5 gate: a `ZoneId=3`-tagged unsigned installer
  was double-clicked from the desktop, SmartScreen appeared, and the app did not
  start until it was clicked through. (The tag was applied deliberately first —
  a locally-built installer carries no `Zone.Identifier` at all, so double-
  clicking one proves nothing. That is worth knowing before anyone tries to
  reproduce this.) The original observation:
  double-click of the MotW-tagged unsigned build shows "Windows protected your
  PC — Microsoft Defender SmartScreen prevented an unrecognised app from
  starting", `Publisher: Unknown publisher`, and the app does not start until
  *More info → Run anyway* — a step a non-technical teacher may well read as
  "this program is dangerous" and stop at. Code signing with an Authenticode
  certificate removes it. **This needs a decision before the app is handed to the
  end user, not at M9**, because it can stop her using the app at all on Windows.
  **M9 (2026-09-25): the product owner confirmed signing is out of scope for
  this release; it is the first item on M9's list of what stands between this
  build and the teacher.** **M10 (2026-09-25): out of M10 too.** v1.0.0 ships
  unsigned. The procedure for whoever signs is `docs/CODE_SIGNING.md`. The
  teacher-facing guide tells her what to expect, and tells her to run the
  `.exe` from the synced folder rather than the installer. So SmartScreen now
  meets the exe she double-clicks, if that file carries Mark of the Web, rather
  than an installer she runs once.

  Two corrections from that run. **First, the CI tripwire does not actually
  measure SmartScreen.** It launches the tagged exe with `Start-Process` and
  treats a non-running process as proof of a block, but on a real machine with
  SmartScreen on, both `Start-Process` and `Shell.InvokeVerb("open")` launch the
  tagged build **cleanly with no dialog**; only a genuine Explorer double-click
  is blocked. A headless runner also has no interactive desktop to show that
  dialog. So the step passes for the wrong reason and would not detect signing
  landing. The earlier claim that CI "confirmed" this behaviour on 2026-09-19 is
  withdrawn; the risk stands on the real-machine observation above.
  **Second, the NSIS installer does not propagate Mark of the Web to what it
  extracts** — the installed `teacher-planner.exe` carries no `Zone.Identifier`.
  So the prompt hits the **installer, once**; the app she launches daily
  afterwards is untagged and starts without a prompt. That makes this a first-run
  barrier rather than a permanent one, though still a real one.

- **A human has now double-clicked this app on Windows from inside a real
  OneDrive folder, including the online-only placeholder case — and it passed.**
  Done at the M1 gate (2026-09-20) on Windows 11 Enterprise 26200, from
  `OneDrive\Ατζέντα Εκπαιδευτικού M1`. The files were forced online-only and
  verified genuinely dehydrated (0 bytes on disk against full logical size,
  `OFFLINE + UNPINNED + RECALL_ON_DATA_ACCESS`), then double-clicked: Windows
  hydrated the exe and the database on demand within 8s, the app opened and
  stayed open, and there was **no hang, no second database and no data loss**
  (database hash byte-identical before and after). **So the leading candidate for
  what killed the previous attempt does not reproduce on OneDrive.**

  **Partly addressed at the M2 gate (2026-09-20): the app has now been run from
  a live Google Drive folder on Windows.** In the `MilestoneTesting` VM, which
  has the Drive client installed, the packaged exe ran from `G:\My Drive\…`,
  created `data/planner.sqlite` and a dated backup there, exported a PDF into
  `exports/`, and left no `-wal`/`-shm` sidecars. That is the first evidence for
  Drive on Windows this project has. **It does not close the criterion**: the
  launch was a scheduled task in the console session rather than a human
  double-click, and the **online-only placeholder case was not driven against
  Drive** — which is the half that matters most, since Drive streams files by a
  different mechanism from OneDrive's and that case is the leading suspect for
  what killed the previous attempt. The rest of what follows still stands.

  **CLOSED on 2026-09-22, at the M4.5 gate.** The product owner drove the
  **Google Drive online-only placeholder case by hand** in the `MilestoneTesting`
  VM — through Drive's own right-click toggle, which is the only way it can be
  driven, since `attrib -P +U` reaches OneDrive's `cldflt` mechanism and Drive
  for Desktop's virtual drive does not implement it. The exe was set online-only
  in `G:\My Drive\…` and **double-clicked**: it streamed down and the app
  opened. The OneDrive folder was checked the same way for contrast, and the
  agent's own instrumented OneDrive run at the same gate proved genuine
  dehydration (0 bytes on disk against full logical size) before launch.

  **So the leading suspect for what killed the previous attempt does not
  reproduce on Google Drive either.** Both halves that were missing — a human
  double-click from a Drive folder, and the placeholder case against Drive — are
  now done. One qualification kept for accuracy: the Drive observation is a
  human one, not instrumented, so nothing measured 0 bytes on disk at the moment
  of that particular click.

  The historical position, kept because it is what three gates were run under:
  **the full test against Google Drive on Windows was not run, and was ACCEPTED
  by the product owner (2026-09-20) as a carried risk rather than a blocker** —
  the same call M0 took on its Windows gap. Drive's streaming implementation is a
  different mechanism, so the OneDrive result does not carry over, and the client
  was not installed on the machine used. The acceptance says the evidence in hand
  is enough to keep building, not that Drive was tested: the M0 acceptance
  criterion names both clients, and this one is still unmet. **It should be
  closed before the app is handed to the teacher**, and gate step 5 stays
  non-skippable for every later milestone.

- **`Νέο τμήμα` overwrites the previously selected class (found 2026-09-20).**
  Pressing it creates a new empty class card but leaves the editor bound to the
  previously selected class, so typing a name and saving — the obvious gesture —
  renames the *existing* class and leaves the new one empty. **`Νέος μαθητής` had
  the identical defect**, where it would have overwritten a whole student card,
  guardians and SEN included. Found by driving the packaged Windows build by
  hand.

  **Fixed on the M1 branch (2026-09-20).** Neither button moved the selection to
  the record it had just created; `Run` now hands back the planner so each can
  select the row the backend assigned an id to. Both existing creation tests
  started from an *empty* planner — the one case where the selection effect
  compensates — which is why 64 component tests missed it. Two regression tests
  now start from a non-empty planner and were confirmed to fail against the
  unfixed code.

  **The lesson worth keeping:** a create-then-edit flow tested only from an empty
  fixture is not tested. Later milestones add the same shape (lesson plans,
  support plans, print forms), so their tests should start from a planner that
  already has a record of that kind selected.

## Engineering process & repo conventions

**Moved.** The repo layout, the branching and commit conventions, the six-step
gate, the sign-off rule and the per-milestone acceptance criteria all live in
[ENGINEERING.md](ENGINEERING.md), and that file is the only copy.

They used to be duplicated here, on the basis that this document is the single
source of truth and that file was "this section, exported". **The two copies
drifted**, which is the reason for the move: M4.5 was inserted into the roadmap
and added its acceptance criteria to the copy here only, so `ENGINEERING.md` —
the file every release note cites in its own gate table, and the one
`MILESTONE_PROMPT.md` sends every agent to — was missing an entire milestone's
criteria from 2026-09-22 until it was noticed after M5. A second copy of a rule
is not a safety net; it is a second thing to forget.

What stays here is what this document is actually for: the functional and
architectural spec above, the **Decisions & open questions** table, and the
**Carried risks**.
