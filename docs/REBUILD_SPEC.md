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
- **AttendanceRecord** — monthly grid per class: present / absent / late / excused per student per day.
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

- **What's translated:** every UI label, button, menu, column header, validation message, the 7 letter templates, and the 150-message bank (each message needs both a Greek and an English version — the Greek content already exists from the source package; English versions need to be authored, not machine-translated, given these are meant to be sent to parents).
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
| If PDF export proves blocked at M2 | **Ship the gradebook, defer the PDF.** If the WebView print-to-PDF path cannot be made to work, M2 lands with the weighted gradebook, all four grade types, conduct and the summary roll-ups — fully tested — and PDF export becomes its own piece of work with its own gate. Decided 2026-09-20. The reasoning: the weighting logic is what later milestones depend on, and it should not be held hostage to a platform rendering problem. This is a fallback, not permission to skip the attempt |

| How the WebView print-to-PDF path is actually done | **`createPDF` plus app-side pagination on macOS; `PrintToPdf` on Windows** (M2). AppKit's print pipeline (`printOperationWithPrintInfo:`) does not work against wry's webview — its print view is zero-sized and renders nothing, so the job emits blank pages indefinitely; that was tried hidden and visible, with default and explicit settings, with the print view's frame forced, and run both directly and modally. WebKit's `createPDFWithConfiguration:` does render the whole document and embeds its fonts, but does not paginate. So the app lays each sheet out into fixed A4 blocks, macOS captures one rectangle per block and PDFKit assembles them, and WebView2 paginates the same blocks itself. The spec's resolved approach stands — this is how it is done |
| Who decides where a printed sheet breaks | **The app, not the rendering engine** (M2). The print window measures the rendered rows and places them into A4 blocks, repeating the sheet header and the column headers and never splitting a row. Forced by the above. It gives both platforms the same page structure and the same A4 sheet; it does not make the break points identical, because row heights come from each platform's own text measurement — at the M2 gate a 45-row roster was five pages on macOS and six on Windows, differing only in whether the closing note shared the last page |

### Open — flag back rather than silently decide

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

- **Is the `Email` label meant to stay in English?** It is the only English
  string on the student card; every other label is Greek. It is a common Greek
  loanword, so this may well be deliberate — but it is currently an implicit
  choice rather than a recorded one. Raised at M1 (2026-09-20).

- **Where should the per-class pass threshold ("Βάση") live?** M2 gives it, the
  scale's upper bound and the printed sheet's period caption their own
  `class_grading` table keyed by `class_id`, rather than three more columns on
  `class`: it is a gradebook setting, the source registry keeps it in the
  header of each class's grade sheet, and keeping it out of `class` leaves M1's
  table and its round-trip tests untouched. A class with no row reads back as
  the defaults. Raised at M2 (2026-09-20); one migration changes it either way.

- **Should the conduct sheet print as part of the grade-sheet PDF or as its own
  file?** M2 ships it as its own, matching the source product, which keeps
  "Συμπεριφορά και στάση" as a separate page — and M7 is the only place the
  spec asks for several pages bundled into one PDF. Raised at M2 (2026-09-20).
  Now that pagination is the app's own, merging the two is a small change.

- **The source's conduct page rates four things; the data model names one.** The
  PDF's conduct page has columns for *Συμμετοχή, Αυτονομία, Διαγωγή* and
  *Συνέπεια* plus the written overall result, while this spec's `GradeRow` names
  a single six-level conduct rating plus observations — which is also what the
  Excel registry has. M2 ships the data model as written rather than inventing
  three fields or quietly dropping three columns the source has. Raised at M2
  (2026-09-20).

### Carried risks

- **An unsigned Windows build tagged with Mark of the Web will not start without
  the teacher clicking through SmartScreen.** Anything downloaded, emailed, or in
  some configurations delivered by a sync client arrives with that tag.
  **Verified on a real Windows machine on 2026-09-20**: a
  double-click of the MotW-tagged unsigned build shows "Windows protected your
  PC — Microsoft Defender SmartScreen prevented an unrecognised app from
  starting", `Publisher: Unknown publisher`, and the app does not start until
  *More info → Run anyway* — a step a non-technical teacher may well read as
  "this program is dangerous" and stop at. Code signing with an Authenticode
  certificate removes it. **This needs a decision before the app is handed to the
  end user, not at M9**, because it can stop her using the app at all on Windows.

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

  **The full test against Google Drive on Windows was not run, and is ACCEPTED
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

### Repo layout

```
/
├─ src-tauri/          ← Rust backend: file I/O, SQLite, backup job, PDF trigger
├─ src/                 ← frontend (framework choice left to the implementing agent; keep it boring)
├─ reference/            ← the source PDF package (letters, message bank, print templates, quick-start guide) and the Excel grade registry — read-only inputs, never generated output
├─ docs/
│   ├─ REBUILD_SPEC.md      ← this document, exported and kept in sync
│   ├─ ENGINEERING.md       ← this section, exported
│   └─ milestones/           ← one short dated release note per milestone, matching the acceptance criteria below
├─ tests/
└─ .github/workflows/     ← CI: build + test on both Windows and macOS runners
```

### Branching & commits

- `main` is always releasable. Work happens on short-lived branches named `m<N>-<slug>` (e.g. `m2-grades`), one per milestone or a clear sub-slice of one.
- Commit messages state what changed and why in one line; a commit that only makes tests pass again references the milestone it belongs to.
- One pull request per milestone (or per sub-slice, for the larger milestones like M6). No PR merges with failing CI.

### The gate every milestone must pass before it's called done

1. **Typecheck** clean.
2. **Lint** clean.
3. **Automated tests pass** — unit tests for any calculation logic (the grade-weighting formula above all), component/integration tests for the module's screens, and a persistence round-trip test (write data, close, reopen, data is intact).
4. **Packaged build succeeds on both Windows and macOS**, structurally verified (the app actually launches from a double-click, not just "the build command exited 0").
5. **Manual launch test from inside a simulated cloud-sync folder** on both OSes — this is the specific failure mode that killed the previous attempt, so it is a named, non-skippable step every milestone, not just at the end of the project.
6. **A short dated release note** goes in `docs/milestones/`, recording what shipped, what was decided (if a milestone touched anything the rebuild spec left open), and the result of steps 1-5 — following the previous project's own practice of writing this down per release rather than only trusting green CI.

### Milestone sign-off

A milestone is "done" only when its specific acceptance criteria (below) are met **and** the gate above passes. The implementing agent posts the release note and a one-line summary; the product owner reviews before the branch merges to `main`. Agents should surface any spec ambiguity they hit as a question in the PR description rather than silently deciding — the rebuild spec's "Decisions & open questions" table is the model to follow: resolved calls get recorded, not re-litigated by the next agent to touch the code.

## Acceptance criteria per milestone

Each milestone's generic gate (above) still applies; these are what's specific to that milestone's own content.

**M0 — Shell & persistence**
- App launches by double-click on both Windows and macOS from inside a folder actively synced by both Google Drive and OneDrive (test both, not just one).
- Data written, then a full app quit and relaunch, still shows the data.
- A backup snapshot exists in `data/backups/` after a session; an old backup is thinned per the retention schedule once enough time/snapshots have passed.
- Manually editing the data file's bytes while the app is closed, then reopening the app, triggers the "disk changed" block-and-reload behavior rather than a silent overwrite.

**M1 — School year, classes, students**
- Changing the school-year start date after data exists does not move or delete any already-entered record.
- A student can belong to two classes at once and shows correctly in both rosters.
- Every field in the Student data-model entry (guardians, health/emergency, SEN status) round-trips through save/reload.

**M2 — Grades**
- The weighted-average formula matches the spec's worked examples exactly, including: a row with some columns still blank, a row where entered weights don't sum to 100, and the all-zero-weight fallback to plain average.
- The running-weight-total warning appears/disappears correctly as columns are edited; no save is ever blocked by it.
- A generated grade-sheet PDF opens and renders Greek characters correctly (not just Latin).
- Class and year summary numbers match a hand-computed check on a test dataset.

**M3 — Weekly planning & timetable**
- A lesson plan entered against a specific date survives a school-year start-date change (it's keyed by date, not week-index).
- The Today view correctly shows only today's scheduled classes on a spot-checked date.

**M4 — Attendance & behavior**
- The monthly attendance grid and the detailed absence-event log can hold different, non-derived data for the same student/date without either overwriting the other.
- A support plan's status field is never overwritten by changes to its goals (status stays teacher-written).
- The cross-class support overview correctly reflects a plan change made in a single class.

**M5 — Parents & staff**
- All 7 letters and a sample across all 15 message-bank categories generate a correctly-formatted, Greek-rendering PDF with every placeholder filled and none left as `[BRACKETS]`.
- A parent appointment and a parent-contact-log entry for the same guardian/date coexist independently.
- The upcoming-overview panel correctly surfaces both appointments and meetings due in the next 7 days on a test dataset.

**M6 — Annual planning & the rest of teaching**
- The week-by-class progress matrix correctly reflects entries made from the per-class weekly plan (M3) without duplicate data entry.
- An exam, a trip, a textbook, and a resource entry each round-trip through save/reload with every field intact.

**M7 — Print forms & substitute folder**
- All 11 print forms can be filled, saved under a custom name, reopened, and re-edited.
- The substitute folder's seating plan reflects a live edit made in the Classes module without needing regeneration — i.e. it reads live data, it isn't a stale copy.
- The substitute folder exports as one combined multi-page PDF, not 5 separate files.

**M8 — Development, wellbeing, staff directory, covers/leave**
- Development goals (open-ended) and the 6 fixed annual-goal areas (from M1's school-year setup) remain visibly separate and neither is generated from the other.
- A cover-taught record and a leave record for the same date coexist as separate entries.

**M9 — Bilingual pass & polish**
- Every UI string, all 7 letters, and all 150 messages have both a Greek and an English version; switching the language toggle changes all of them, with no string left showing a placeholder or the wrong language.
- A side-by-side check of at least 3 PDF outputs against the source product's equivalent page confirms acceptable layout fidelity (page size, general structure, Greek rendering) — a judgment call for the product owner to sign off on, not an automated check.
- The real two-device test passes: write data on a simulated "device 1", let a real cloud-sync client (Drive or OneDrive) finish syncing, launch on "device 2", confirm the data is there and correct.
