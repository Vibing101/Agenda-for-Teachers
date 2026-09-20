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
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
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
}
