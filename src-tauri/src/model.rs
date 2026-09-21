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
