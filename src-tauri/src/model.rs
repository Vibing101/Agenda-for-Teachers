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

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ClassSlot {
    #[serde(default)]
    pub id: i64,
    #[serde(default)]
    pub class_id: i64,
    /// 1 = Monday … 6 = Saturday, matching the source timetable's grid.
    pub weekday: i64,
    pub period_label: String,
    pub start_time: String,
    pub end_time: String,
    pub room: String,
}

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
    #[serde(default)]
    pub slots: Vec<ClassSlot>,
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
/// `weight` is the one nullable field in the whole schema, and deliberately so:
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
