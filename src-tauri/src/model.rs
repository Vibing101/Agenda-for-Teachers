//! The M1 domain types, shared by the SQLite layer and the Tauri commands.
//!
//! Every dated thing here carries an **actual date** (`YYYY-MM-DD`), never a
//! week index. That is the spec's hard-won rule: the teacher may correct the
//! school year's start date in November, and nothing she already wrote may move
//! or disappear because of it. Week numbers are derived for display only.
//!
//! Fixed reference vocabularies (year model, holiday source, important-date
//! type, SEN status, goal area) travel as stable codes, never as display text —
//! the frontend's translation table turns a code into a label. Teacher-entered
//! text is stored exactly as typed and never translated.

use serde::{Deserialize, Serialize};

/// Empty strings rather than `NULL` throughout: a blank field a teacher has not
/// filled in yet and a field she cleared are the same thing to her, and this
/// keeps every round-trip assertion a plain string comparison.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SchoolYear {
    /// `sep_aug` | `jan_dec` | `feb_dec`
    pub year_model: String,
    /// The Monday that week 1 starts on. Empty until the teacher sets it.
    pub start_date: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GradingPeriod {
    /// 1, 2 or 3 — the three periods are a fixed set, so this is the key.
    pub ordinal: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub notes: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Holiday {
    #[serde(default)]
    pub id: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    /// `ministry` | `school`
    pub source: String,
    pub notes: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ImportantDate {
    #[serde(default)]
    pub id: i64,
    pub name: String,
    pub date: String,
    /// `deadline` | `meeting` | `exam_window` | `event` | `other`
    pub kind: String,
    pub notes: String,
}

/// One of the six fixed annual-goal areas. The set never grows, so `area` is
/// the key and there is no create/delete — only edit.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AnnualGoal {
    pub area: String,
    pub goal: String,
    pub actions: String,
    pub success_indicators: String,
    pub deadline: String,
    pub status: String,
    pub review: String,
}

pub const GOAL_AREAS: [&str; 6] = [
    "teaching",
    "development",
    "students",
    "colleagues",
    "parents",
    "wellbeing",
];

/// A class.
///
/// **M1's `slots` field is gone, and deliberately so** (M3). A class's hours are
/// now derived from the master timetable's cells that link to it, rather than
/// being a second register that could disagree with it — see [`TimetableCell`]
/// for the reasoning and `migrate_to_4` for where the old rows went. Nothing
/// writes a class's hours through this struct any more, which is why the field
/// was removed rather than left in place and quietly ignored.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Class {
    #[serde(default)]
    pub id: i64,
    pub name: String,
    pub subject: String,
    pub room: String,
    pub responsible: String,
    pub notes: String,
    #[serde(default)]
    pub position: i64,
    pub seating_rows: i64,
    pub seating_cols: i64,
    pub seating_notes: String,
}

/// Every field on the source product's student card, plus the multi-class
/// membership the spec adds. All of it round-trips through save/reload — that
/// is one of M1's three acceptance criteria.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Student {
    #[serde(default)]
    pub id: i64,
    pub full_name: String,
    pub register_number: String,
    pub birth_date: String,
    pub home_language: String,
    pub address: String,
    pub midyear_enrollment: bool,
    pub guardian1_name: String,
    pub guardian1_phone: String,
    pub guardian1_email: String,
    pub guardian2_name: String,
    pub guardian2_phone: String,
    pub guardian2_email: String,
    pub allergies: String,
    pub conditions: String,
    pub medication: String,
    pub emergency_phone: String,
    /// `none` | `reinforcement` | `accommodations` | `gifted`
    pub sen_status: String,
    pub sen_plan: String,
    pub sen_accommodations: String,
    pub notes: String,
    pub meeting_notes: String,
}

/// A student's membership of one class. A student can hold several of these at
/// once — a subject teacher's "class" is a subject group, not a homeroom.
///
/// `support` and `note` are per-class, matching the source roster page's
/// "τσεκ = στήριξη" column and its short-note column: the same student can be
/// flagged for support in one class and not in another.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Enrollment {
    pub class_id: i64,
    pub student_id: i64,
    pub roster_no: i64,
    pub support: bool,
    pub note: String,
}

/// One occupied seat in a class's room plan. Empty seats are simply absent.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Seat {
    pub class_id: i64,
    pub row: i64,
    pub col: i64,
    pub student_id: i64,
}

/// The whole planner as the UI sees it.
///
/// Loading everything in one go is deliberate: the data is tiny (a teacher, a
/// hundred students), and a single snapshot keeps the frontend's state a plain
/// value rather than a cache that can drift from the file the M0 change
/// detection is guarding.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct Planner {
    pub school_year: SchoolYear,
    pub grading_periods: Vec<GradingPeriod>,
    pub holidays: Vec<Holiday>,
    pub important_dates: Vec<ImportantDate>,
    pub annual_goals: Vec<AnnualGoal>,
    pub classes: Vec<Class>,
    pub students: Vec<Student>,
    pub enrollments: Vec<Enrollment>,
    pub seats: Vec<Seat>,
    pub class_gradings: Vec<ClassGrading>,
    pub grade_columns: Vec<GradeColumn>,
    pub grade_values: Vec<GradeValue>,
    pub grade_rows: Vec<GradeRow>,
    pub timetable_periods: Vec<TimetablePeriod>,
    pub timetable_cells: Vec<TimetableCell>,
    pub lesson_plans: Vec<LessonPlan>,
    pub agenda_notes: Vec<AgendaNote>,
    pub attendance_marks: Vec<AttendanceMark>,
    pub absence_events: Vec<AbsenceEvent>,
    pub incidents: Vec<Incident>,
    pub support_plans: Vec<SupportPlan>,
    pub support_goals: Vec<SupportGoal>,
    pub parent_contacts: Vec<ParentContact>,
    pub parent_appointments: Vec<ParentAppointment>,
    pub staff_meetings: Vec<StaffMeeting>,
    pub meeting_agreements: Vec<MeetingAgreement>,
    pub units: Vec<Unit>,
    pub exams: Vec<Exam>,
    pub lesson_reflections: Vec<LessonReflection>,
    pub trips: Vec<Trip>,
    pub trip_consents: Vec<TripConsent>,
    pub textbooks: Vec<Textbook>,
    pub resources: Vec<Resource>,
}

// ------------------------------------------------------------- M2: grades ---

/// The per-class grading settings M2 introduces.
///
/// These live in their own table rather than as columns on `Class` because
/// they belong to the gradebook, not to the class list: the source registry
/// keeps them in the header of each class's *grade sheet*, and keeping them
/// apart leaves M1's `Class` — and its round-trip tests — untouched.
///
/// A class that has never had its grading settings saved has no row here; the
/// loader supplies the defaults instead, so every class always has settings
/// even before the teacher has opened its gradebook.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ClassGrading {
    pub class_id: i64,
    /// "Βάση" — the lowest passing mark. 10 on the 0–20 Cyprus scale.
    pub pass_threshold: f64,
    pub scale_max: f64,
    /// The free-text period label the source's sheet header carries. This is a
    /// caption on the printed sheet, not the school year's grading periods and
    /// not the progress-check periods (explicitly not in M2).
    pub period: String,
}

pub const DEFAULT_PASS_THRESHOLD: f64 = 10.0;
pub const DEFAULT_SCALE_MAX: f64 = 20.0;

impl ClassGrading {
    pub fn default_for(class_id: i64) -> Self {
        Self {
            class_id,
            pass_threshold: DEFAULT_PASS_THRESHOLD,
            scale_max: DEFAULT_SCALE_MAX,
            period: String::new(),
        }
    }
}

/// One assessment column on a class's gradebook.
///
/// `weight` is one of only two nullable fields in the schema (M3's
/// `timetable_cell.class_id` is the other), and deliberately so:
/// `None` means "the teacher has not decided this column's weight yet" and
/// `Some(0.0)` means "she decided it is worth nothing". They behave differently
/// in the average — blank drops the column out, zero keeps it in and can
/// trigger the plain-average fallback — so collapsing them would be a bug.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct GradeColumn {
    #[serde(default)]
    pub id: i64,
    pub class_id: i64,
    #[serde(default)]
    pub position: i64,
    pub label: String,
    /// `numeric` | `descriptive` | `pass_fail` | `comment`
    pub kind: String,
    /// A percentage, 0–100, or `None` for not yet decided.
    pub weight: Option<f64>,
}

/// One cell. Always text, whatever the column's type: a mark, a descriptive
/// code, `pass`/`fail`, or the teacher's own comment. Parsing a numeric cell
/// into a number happens in the calculation, never at the storage layer, so
/// nothing here ever turns a typo into a zero.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GradeValue {
    pub class_id: i64,
    pub column_id: i64,
    pub student_id: i64,
    pub value: String,
}

/// The per-(student, class) record that is not a cell.
///
/// `overall_result` is the conduct sheet's written overall result. The spec
/// says it is "kept as a manually-written field, not computed", so nothing in
/// this app ever writes it except the teacher.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct GradeRow {
    pub class_id: i64,
    pub student_id: i64,
    /// A conduct code, or empty when she has not been rated.
    pub conduct: String,
    pub observations: String,
    pub overall_result: String,
}

// -------------------------------------------- M3: timetable and planning ---

/// One named hour of the teacher's week — a row of the master timetable.
///
/// This is the source page's `Ώρα` column: the teacher names her hours once
/// ("1η", "2η", a break, an afternoon slot) with the clock times they run at,
/// and every weekday shares that row. Hours belong to the teacher rather than
/// to a class, which is the whole reason the master timetable exists as its own
/// register — see [`TimetableCell`].
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimetablePeriod {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub position: i64,
    pub name: String,
    pub start_time: String,
    pub end_time: String,
}

/// One cell of the master timetable: what the teacher is doing in hour
/// `period_id` on `weekday`.
///
/// **This is the single register of the teacher's week, and M3 makes it the
/// authority.** M1 shipped a per-class timetable (`class_slot`) that covered
/// the same ground from the other direction; `migrate_to_4` folds those rows
/// into this table and drops it. Two things in the spec force the direction:
/// a cover or a duty has no class at all and so cannot live in a per-class
/// table, and the spec describes the link to a class as *optional* and as
/// something that "fills subject/room" — i.e. the cell is the record and the
/// class is a pointer. A class's own hours are then derived from the cells that
/// point at it, so nothing is typed twice and the Today view — which the spec
/// says reads "from the master timetable" — has one register to read and cannot
/// list the same class twice.
///
/// `class_id` is nullable and `ON DELETE SET NULL`: deleting a class empties
/// the link but keeps the hour, because the hour is still in the teacher's
/// week. `subject` and `room` are overrides — empty means "take it from the
/// linked class" — so a class that meets in the lab on Thursdays says so in
/// that one cell without a second class record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TimetableCell {
    pub period_id: i64,
    /// 1 = Monday … 6 = Saturday, matching the source timetable's grid.
    pub weekday: i64,
    /// The optional link to a class. `None` for a cover, a duty or a free hour.
    pub class_id: Option<i64>,
    pub subject: String,
    pub room: String,
    /// "Αναπληρώσεις και άλλα καθήκοντα" — the cover or duty in this hour.
    pub duty: String,
    pub notes: String,
}

/// The weekly lesson plan for one class.
///
/// **Keyed by `week_monday`, an actual date**, never a week index — the spec's
/// hard-won rule and M3's first acceptance criterion. The teacher may correct
/// the school year's start date in November; that re-derives what *number* this
/// week is called and touches no row here, because no row here knows a number.
///
/// `(class_id, week_monday)` is the whole key, so there is no id to assign and
/// nothing for a "new plan" button to select — which is why the create-then-edit
/// data-loss shape that bit M1 cannot occur here. M6's week-by-class progress
/// matrix reads exactly these rows.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LessonPlan {
    pub class_id: i64,
    /// The Monday of the week this plan is for, `YYYY-MM-DD`.
    pub week_monday: String,
    pub notes: String,
    /// The one optional assessment for the week, as the spec describes it.
    pub assessment: String,
}

/// A day, week or month agenda note, keyed by an actual date.
///
/// `scope` is a stable code (`day` | `week` | `month`) and `date` is the
/// canonical date for that scope: the day itself, the **Monday** of the week, or
/// the **first** of the month. Normalising before the write is the frontend's
/// job (`domain/agenda.ts`), so every note for a week lands on one row however
/// the teacher navigated to it.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AgendaNote {
    /// `day` | `week` | `month`
    pub scope: String,
    pub date: String,
    pub body: String,
}

pub const AGENDA_SCOPES: [&str; 3] = ["day", "week", "month"];

// ------------------------------------------- M4: attendance and behaviour ---

/// One cell of the monthly attendance grid: what one student was on one day
/// of one class.
///
/// **Keyed by `(class_id, student_id, date)` where `date` is an actual date.**
/// There is deliberately no year column, no month column and no day-of-month
/// index: the month grid is a *view* built from these rows by
/// `domain/attendance.ts`, exactly as a week number is derived rather than
/// stored. The source page is one card per month with day columns 1–31, and
/// keying by the column it prints would be the same mistake the spec spent M1
/// ruling out.
///
/// **This table is independent of [`AbsenceEvent`] and nothing derives one from
/// the other.** The spec says so twice, and it is M4's first acceptance
/// criterion: a teacher may mark a student present in the grid on a day she
/// also logged a late arrival as an event, and both stand. There is no sync, no
/// mirror and no count of one taken from the other.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttendanceMark {
    pub class_id: i64,
    pub student_id: i64,
    /// `YYYY-MM-DD`, an actual date.
    pub date: String,
    /// `present` | `absent` | `late` | `excused` — the source page's four
    /// symbols (`·`, `α`, `κ`, `u`) as stable codes.
    pub state: String,
}

pub const ATTENDANCE_STATES: [&str; 4] = ["present", "absent", "late", "excused"];

/// One line of the detailed absence register — the source's "μία γραμμή για
/// κάθε απουσία ή καθυστέρηση".
///
/// It has a generated id and a "new record" button, unlike M3's keyed rows, so
/// this is one of the four places M4 reintroduces the create-then-edit shape
/// that cost M1 a data-loss bug. The screen edits these **in place, as a list
/// of rows**, rather than through one editor bound to a selected record, which
/// is what removes the shape rather than merely testing around it.
///
/// A blank row is **kept**, not deleted: the teacher pressed a button to make
/// it and is about to type into it. That is the deliberate exception to the
/// delete-when-empty rule M2 and M3 follow for their keyed cells.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AbsenceEvent {
    #[serde(default)]
    pub id: i64,
    pub class_id: i64,
    pub student_id: i64,
    pub date: String,
    /// `absence` | `late` — the source register's `Απ.` and `Καθ.` columns.
    pub kind: String,
    /// The clock time, as the source's `Ώρα` column.
    pub clock_time: String,
    /// Which teaching hour of the day, as the teacher names her hours.
    pub teaching_hour: String,
    pub reason: String,
    /// The source's `Δικ.` column — justified independently of anything else.
    pub justified: bool,
    /// `` | `pending` | `informed` | `resolved`, from the source page's
    /// "ΓΟΝΕΙΣ ΕΝΗΜΕΡΩΘΗΚΑΝ · ΕΝΕΡΓΕΙΕΣ" box. Empty means she has not said.
    pub follow_up: String,
    /// The source page's "ΠΡΟΣΟΧΗ · ΣΥΧΝΕΣ ΑΠΟΥΣΙΕΣ" note, per event rather
    /// than per page — the spec lists it among the event's own fields.
    pub frequent_note: String,
}

pub const ABSENCE_KINDS: [&str; 2] = ["absence", "late"];
pub const FOLLOW_UP_STATUSES: [&str; 3] = ["pending", "informed", "resolved"];

/// One dated behaviour/incident entry.
///
/// **It hangs off the student, not the class**, which is what the spec means by
/// "cross-class (follows the student)": the same entry is visible from every
/// class the student is enrolled in, and stays with her if she leaves one.
/// `class_id` is an optional note of *where it happened* — the source
/// register's `Τάξη` column — and is `ON DELETE SET NULL`, so deleting a class
/// never deletes a record of something that happened.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Incident {
    #[serde(default)]
    pub id: i64,
    pub student_id: i64,
    /// Where it happened. `None` when it belonged to no class in particular.
    pub class_id: Option<i64>,
    pub date: String,
    /// The source register's "Τι συνέβη".
    pub what_happened: String,
    /// The source register's "Ενέργεια που έγινε".
    pub action_taken: String,
    /// The source register's "Γονείς ενημερώθηκαν".
    pub parents_informed: bool,
}

/// One support plan for one student — the spec's `SupportPlan`, 0..n per
/// student.
///
/// **`status` is written by the teacher and never computed.** Nothing in this
/// app derives it, and in particular no change to a plan's goals touches it —
/// that is M4's second acceptance criterion, and the reason `status` lives on
/// this row while progress ratings live on [`SupportGoal`] rows in a separate
/// table. The two cannot be written by the same statement.
///
/// This is *not* the ΕΠΕ box M1 put on the student card. That box
/// (`Student.sen_status`, `sen_plan`, `sen_accommodations`) is the source
/// product's own single-box summary and stays exactly where it was; a
/// `SupportPlan` is the spec's richer, repeatable record. The cross-class
/// overview merges both — see `domain/support.ts`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SupportPlan {
    #[serde(default)]
    pub id: i64,
    pub student_id: i64,
    #[serde(default)]
    pub position: i64,
    pub start_date: String,
    pub monitoring_frequency: String,
    /// The spec's "strengths & needs", kept as two fields — see the release
    /// note. Splitting loses nothing; merging would.
    pub strengths: String,
    pub needs: String,
    pub accommodations: String,
    /// Parent and specialist collaboration notes.
    pub collaboration: String,
    /// Teacher-written. Never computed, never touched by a goal.
    pub status: String,
    /// The next review date, which the cross-class overview shows beside the
    /// status. Named in the spec's overview line rather than its field list.
    pub next_review: String,
}

/// One goal inside a support plan, with its own progress rating and monitoring
/// date, as the spec's `SupportPlan` entry asks for.
///
/// Writing one of these **never** touches its plan's `status`: they are
/// separate tables, separate commands and separate statements. M4's second
/// acceptance criterion is held by that construction, not by care.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SupportGoal {
    #[serde(default)]
    pub id: i64,
    pub plan_id: i64,
    #[serde(default)]
    pub position: i64,
    pub goal: String,
    /// `` | `not_started` | `in_progress` | `partly_met` | `met` |
    /// `needs_review`. A rating is a scale, unlike the plan's written status.
    pub progress: String,
    /// The date this goal was last looked at.
    pub monitored_on: String,
}

pub const GOAL_PROGRESS: [&str; 5] = [
    "not_started",
    "in_progress",
    "partly_met",
    "met",
    "needs_review",
];

// ------------------------------------------------- M5: parents and staff ---

/// One line of the parent communication log — the source's "Επικοινωνία με
/// τους γονείς · Μητρώο επικοινωνιών · κατάλληλο για επίσημη τεκμηρίωση".
///
/// **This is a record of what happened.** The booking of a future meeting is
/// [`ParentAppointment`], which is a different table with no key in common and
/// no statement that writes both. The spec says so in as many words — "a
/// booking vs. a record of what happened" — and M5's second acceptance
/// criterion is that the two coexist for the same guardian and date without
/// either touching the other. That is held by construction, exactly as M4 held
/// the attendance grid against the absence register.
///
/// `guardian` is free text rather than a link to one of the student card's two
/// guardian slots: the person who actually rang may be a grandparent, a lawyer
/// or an interpreter, and the source column is headed simply "Ποιος".
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParentContact {
    #[serde(default)]
    pub id: i64,
    pub student_id: i64,
    pub date: String,
    /// The source column "Ποιος" — who was spoken to.
    pub guardian: String,
    /// `meeting` | `phone` | `email` | `message` | `note` — the source's "Μορφή".
    pub format: String,
    /// The source's "Αιτία". Kept apart from `agreements` because the spec asks
    /// for exactly that split.
    pub reason: String,
    /// The source's "Συμφωνίες".
    pub agreements: String,
    pub outcome: String,
    /// The source's "Επόμενα".
    pub next_step: String,
    /// The page-level "ΠΑΡΑΤΗΡΗΣΕΙΣ" box, stored per line and printed
    /// attributed — the shape M4.5 resolved for a source page's captioned box.
    pub remarks: String,
}

pub const CONTACT_FORMATS: [&str; 5] = ["meeting", "phone", "email", "message", "note"];

/// One booking in the weekly parent-appointment grid — the source's
/// "Συναντήσεις με γονείς · Οι εβδομαδιαίες συναντήσεις", an Ώρα ×
/// Δευτέρα–Παρασκευή grid.
///
/// **Keyed by an actual date, never by a weekday index**, for the reason this
/// project has kept every dated thing that way since M1: the week grid is a
/// *view*, built by `domain/appointments.ts` from the Monday it is asked for,
/// and moving the school year's start date moves nothing that is stored.
///
/// Independent of [`ParentContact`] — see that type.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ParentAppointment {
    #[serde(default)]
    pub id: i64,
    /// `YYYY-MM-DD`. The grid's column.
    pub date: String,
    /// `HH:MM`. The grid's row.
    pub clock_time: String,
    /// Optional: a slot may be booked for a guardian before it is clear which
    /// child it is about, and the source's cell is free text.
    pub student_id: Option<i64>,
    pub guardian: String,
    /// `in_person` | `phone` | `online`
    pub mode: String,
    pub place: String,
    /// `proposed` | `confirmed` | `done` | `cancelled`
    pub status: String,
    pub topic: String,
    pub outcome: String,
}

pub const APPOINTMENT_MODES: [&str; 3] = ["in_person", "phone", "online"];
pub const APPOINTMENT_STATUSES: [&str; 4] = ["proposed", "confirmed", "done", "cancelled"];

/// One staff, council or class meeting — the source's "Ομάδα · συνεδριάσεις
/// και συσκέψεις", whose cards carry ΗΜΕΡΟΜΗΝΙΑ / ΕΙΔΟΣ / ΔΙΑΡΚΕΙΑ over a
/// ΗΜΕΡΗΣΙΑ ΔΙΑΤΑΞΗ · ΣΥΜΦΩΝΙΕΣ · ΕΝΕΡΓΕΙΕΣ area.
///
/// The agreements the spec asks for — who, what and by when — are rows of
/// [`MeetingAgreement`] rather than one text field, because the spec names
/// three parts and a deadline is a date the upcoming panel can read.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct StaffMeeting {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub position: i64,
    /// `staff` | `council` | `class`
    pub kind: String,
    pub date: String,
    pub clock_time: String,
    /// Free text: "90 λεπτά" and "2 ώρες" are both things a teacher writes.
    pub duration: String,
    pub attendees: String,
    pub agenda: String,
    /// The optional class a class-council meeting is about. `ON DELETE SET
    /// NULL`, like an incident's: deleting a class does not delete the minutes
    /// of a meeting that happened.
    pub class_id: Option<i64>,
    pub notes: String,
}

pub const MEETING_KINDS: [&str; 3] = ["staff", "council", "class"];

/// One agreement out of a meeting: who does what, by when.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct MeetingAgreement {
    #[serde(default)]
    pub id: i64,
    pub meeting_id: i64,
    #[serde(default)]
    pub position: i64,
    /// The person who took it on.
    pub who: String,
    pub what: String,
    pub deadline: String,
}

// ------------------------------- M6: annual planning & the rest of teaching ---

/// One teaching unit of a class — the source's *Ενότητες · Αναλυτικά για κάθε
/// ενότητα* card, whose fields are `ΤΙΤΛΟΣ ΕΝΟΤΗΤΑΣ / ΜΑΘΗΜΑ / ΤΑΞΗ / ΑΡΙΘΜΟΣ
/// ΩΡΩΝ / ΠΡΟΘΕΣΜΙΕΣ`, then `ΔΙΔΑΚΤΙΚΟΙ ΣΤΟΧΟΙ`, `ΜΕΘΟΔΟΙ ΚΑΙ ΜΟΡΦΕΣ ΕΡΓΑΣΙΑΣ`,
/// `ΒΑΘΜΟΙ`, `ΠΕΡΙΕΧΟΜΕΝΟ`, `ΥΛΙΚΑ`, `ΕΞΑΤΟΜΙΚΕΥΣΗ` and `ΑΝΑΚΕΦΑΛΑΙΩΣΗ
/// ΕΝΟΤΗΤΑΣ`.
///
/// **This is also the annual plan.** The source keeps two pages — *Ετήσιο
/// πλάνο*, a table whose columns are `Περίοδος | Θεματική ενότητα | Δεξιότητες
/// / Κριτήρια | Ώρες | Αξιολόγηση`, and the unit cards above — and every column
/// of the first is a field of the second. Storing them apart would make the
/// teacher type a unit's title and its hours twice, which is precisely what
/// M6's first acceptance criterion forbids for the progress matrix and is no
/// better here. So there is **one register**: the annual plan is a *view* of a
/// class's units in order, and the unit card is the full record.
///
/// `ΜΑΘΗΜΑ` and `ΤΑΞΗ` are not stored: they are the class's own, looked up at
/// display time the way a timetable cell looks up its class's subject and room.
/// `ΩΡΕΣ/ΕΒΔ.` on the annual plan's header is derived from the master
/// timetable for the same reason.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Unit {
    #[serde(default)]
    pub id: i64,
    pub class_id: i64,
    #[serde(default)]
    pub position: i64,
    /// `ΤΙΤΛΟΣ ΕΝΟΤΗΤΑΣ`, and the annual plan's `Θεματική ενότητα`.
    pub title: String,
    /// The annual plan's `Περίοδος`. Free text — a unit may straddle two of the
    /// school year's grading periods, and the source's cell is a blank box.
    pub period: String,
    /// `ΑΡΙΘΜΟΣ ΩΡΩΝ`, and the annual plan's `Ώρες`.
    pub hours: String,
    /// `ΠΡΟΘΕΣΜΙΕΣ`.
    pub deadlines: String,
    /// `ΔΙΔΑΚΤΙΚΟΙ ΣΤΟΧΟΙ`.
    pub objectives: String,
    /// The annual plan's `Δεξιότητες / Κριτήρια`. Kept apart from
    /// [`Unit::objectives`] because the two source pages head them differently
    /// and merging would lose a distinction the teacher made — the same call
    /// M4 took on a support plan's strengths and needs.
    pub skills: String,
    /// `ΜΕΘΟΔΟΙ ΚΑΙ ΜΟΡΦΕΣ ΕΡΓΑΣΙΑΣ`.
    pub methods: String,
    /// `ΒΑΘΜΟΙ` on the card and `Αξιολόγηση` on the annual plan — one field,
    /// because both ask how this unit is assessed.
    pub assessment: String,
    /// `ΠΕΡΙΕΧΟΜΕΝΟ`.
    pub content: String,
    /// `ΥΛΙΚΑ`. The unit's own list, distinct from [`Resource`], which is the
    /// teacher's standing library rather than one unit's materials.
    pub materials: String,
    /// `ΕΞΑΤΟΜΙΚΕΥΣΗ`.
    pub differentiation: String,
    /// `ΑΝΑΚΕΦΑΛΑΙΩΣΗ ΕΝΟΤΗΤΑΣ` — the spec's "review".
    pub review: String,
}

/// One planned assessment — the source's *Προγραμματισμένες εξετάσεις ·
/// Εξετάσεις κατανεμημένες σε όλη τη χρονιά*, whose columns are `Ημερομηνία |
/// Τάξη | Μάθημα | Είδος εξέτασης | Τι εξετάζεται | Βαρύτητα` over a page-level
/// `ΣΥΝΕΡΓΑΣΙΑ ΚΑΙ ΣΥΜΒΟΥΛΕΥΤΙΚΗ` box.
///
/// **This is a plan, not a mark.** `weight` is the teacher's note of how much
/// this assessment is meant to count, written while she is spreading the year's
/// exams out; it is deliberately *not* wired to M2's percentage-weighted
/// gradebook, whose weights live on `grade_column` and are what actually
/// computes an average. Nothing here reaches that table.
///
/// `Μάθημα` is not stored — it is the linked class's own subject, looked up at
/// display time, as a timetable cell's is.
///
/// `kind` is free text rather than a fixed vocabulary: the source page is a
/// blank form that enumerates nothing, and what counts as a kind of assessment
/// differs by subject. This app does not invent a category the source does not
/// have — the rule M4 followed on absence kinds.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Exam {
    #[serde(default)]
    pub id: i64,
    /// `ON DELETE SET NULL`: a scheduled assessment is still a thing that was
    /// planned after the class it was planned for is gone, exactly as an
    /// incident and a meeting are.
    pub class_id: Option<i64>,
    pub date: String,
    /// `Είδος εξέτασης`.
    pub kind: String,
    /// `Τι εξετάζεται`.
    pub scope: String,
    /// `Βαρύτητα`, as the teacher writes it. See this type's own note.
    pub weight: String,
    /// The page's `ΣΥΝΕΡΓΑΣΙΑ ΚΑΙ ΣΥΜΒΟΥΛΕΥΤΙΚΗ` box, stored per record and
    /// printed attributed — the shape M4.5 resolved for a captioned box.
    pub collaboration: String,
}

/// One dated reflection on a lesson — the source's *Αναστοχασμός μαθημάτων ·
/// Σημειώσεις για μαθήματα, μεθόδους και ιδέες*, whose cards carry
/// `ΗΜΕΡΟΜΗΝΙΑ / ΜΑΘΗΜΑ / ΤΑΞΗ` over one box captioned `ΤΙ ΛΕΙΤΟΥΡΓΗΣΕ · ΤΙ ΘΑ
/// ΑΛΛΑΞΩ`.
///
/// One text field, because the source has one box — the two halves of its
/// caption are a prompt to the teacher, not two stored things.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct LessonReflection {
    #[serde(default)]
    pub id: i64,
    /// `ON DELETE SET NULL`. The lesson happened; the class may since be gone.
    pub class_id: Option<i64>,
    pub date: String,
    pub notes: String,
}

/// One trip or visit — the source's *Εκδρομές και επισκέψεις*, whose columns
/// are `Ημερομηνία | Στόχος / Δραστηριότητα | Τάξη | Υπεύθυνος | Μεταφορά |
/// Έξοδο | Συγκαταθέσεις` over `ΛΙΣΤΑ ΕΛΕΓΧΟΥ` and `ΣΗΜΕΙΩΣΕΙΣ ΚΑΙ
/// ΑΞΙΟΛΟΓΗΣΗ`.
///
/// **`Συγκαταθέσεις` is not a field here.** The spec asks for per-student
/// consent tracking, so the consents are rows of [`TripConsent`] and the
/// register's column is *derived* from them — the same construction as every
/// other grid in this app. A number the teacher typed could disagree with the
/// list she ticked; a derived one cannot.
///
/// The checklist and the evaluation are per trip rather than per page, because
/// the spec puts them on the trip and one page-level box cannot serve a year's
/// worth of visits.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Trip {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub position: i64,
    pub date: String,
    /// `Στόχος / Δραστηριότητα`.
    pub activity: String,
    /// `ON DELETE SET NULL`, as an incident's is.
    pub class_id: Option<i64>,
    /// `Υπεύθυνος` — free text, since it may be a colleague this app has no
    /// record of until M8 builds the staff directory.
    pub responsible: String,
    pub transport: String,
    /// `Έξοδο`, as the teacher writes it.
    pub cost: String,
    /// `ΛΙΣΤΑ ΕΛΕΓΧΟΥ`.
    pub checklist: String,
    /// `ΣΗΜΕΙΩΣΕΙΣ ΚΑΙ ΑΞΙΟΛΟΓΗΣΗ` — the spec's post-trip evaluation.
    pub evaluation: String,
}

/// One student's consent for one trip.
///
/// **Two states, and no row means "not recorded yet."** That is M4's rule for
/// the attendance grid restated: an unmarked cell is the absence of a row, not
/// a third code. Clearing a consent deletes it, so "she has not answered" and
/// "I have not asked" are the same blank the paper form has.
///
/// The first join between a trip-like record and the roster since M1's
/// `enrollment`, and it is keyed the same way: by the pair, with no generated
/// id and therefore no create-then-edit selection to get wrong.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TripConsent {
    pub trip_id: i64,
    pub student_id: i64,
    /// `given` | `refused`
    pub state: String,
    pub note: String,
}

pub const CONSENT_STATES: [&str; 2] = ["given", "refused"];

/// One line of the source's *Σχολικά βιβλία και υλικά*, whose columns are
/// `Μάθημα | Τίτλος | Εκδόσεις | ISBN | Επίπεδο | Τιμή | Κατάσταση` over a
/// `ΠΑΡΑΤΗΡΗΣΕΙΣ` box.
///
/// A reference list the teacher maintains, closer to M1's holidays than to a
/// lesson plan: it hangs off no class and no week. `subject` is therefore free
/// text rather than a link — a textbook belongs to a subject, and the same book
/// serves every class that is taught it.
///
/// `status` and `price` are free text, for the reason given on [`Exam::kind`]:
/// the source page enumerates nothing, and a teacher writes "δωρεάν" in a price
/// box as readily as a number.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Textbook {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub position: i64,
    pub subject: String,
    pub title: String,
    /// `Εκδόσεις` — the spec's "publisher".
    pub publisher: String,
    pub isbn: String,
    /// `Επίπεδο`.
    pub level: String,
    pub price: String,
    /// `Κατάσταση`.
    pub status: String,
    /// The page's `ΠΑΡΑΤΗΡΗΣΕΙΣ` box, stored per line and printed attributed.
    pub remarks: String,
}

/// One entry in the teacher's standing library — the source's *Υλικά και πηγές
/// · Ιστότοποι, εφαρμογές, βιβλία και ταινίες*.
///
/// **The six categories are the source page's own six boxes**, which are about
/// what a resource *is*: `ΙΣΤΟΤΟΠΟΙ ΚΑΙ ΠΛΑΤΦΟΡΜΕΣ`, `ΕΦΑΡΜΟΓΕΣ`, `ΒΙΒΛΙΑ ΚΑΙ
/// ΚΕΙΜΕΝΑ`, `ΒΙΝΤΕΟ ΚΑΙ ΗΧΟΣ`, `ΒΟΗΘΗΜΑΤΑ ΣΤΗΝ ΤΑΞΗ`, `ΑΛΛΕΣ ΠΗΓΕΣ`. The
/// rebuild spec names a different six — own / school / shared / borrowed /
/// digital / other, which are about who a resource *belongs to* — and calls
/// them "the six source categories", which the source page contradicts. The
/// page wins on a question of what is on the page. **Raised for the product
/// owner rather than settled quietly; see the release note.**
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Resource {
    #[serde(default)]
    pub id: i64,
    /// One of [`RESOURCE_CATEGORIES`].
    pub category: String,
    #[serde(default)]
    pub position: i64,
    pub title: String,
    /// Where it is — a link, a shelf, a cupboard.
    pub detail: String,
    pub notes: String,
}

pub const RESOURCE_CATEGORIES: [&str; 6] =
    ["websites", "apps", "books", "video", "classroom", "other"];
