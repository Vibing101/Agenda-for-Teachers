//! Reading and writing the M1 tables.
//!
//! Every function takes a connection rather than opening its own, so a whole
//! mutation plus the re-read that follows it happens against one open file.
//!
//! There is no `update_week(...)` and no week column anywhere on purpose: the
//! school year's start date is one row in one table, and moving it re-derives
//! week numbers in the UI without touching a single stored record.

use crate::error::AppResult;
use crate::model::*;
use rusqlite::{params, Connection, Row};

// ---------------------------------------------------------------- reading ---

pub fn load(conn: &Connection) -> AppResult<Planner> {
    Ok(Planner {
        school_year: school_year(conn)?,
        grading_periods: grading_periods(conn)?,
        holidays: holidays(conn)?,
        important_dates: important_dates(conn)?,
        annual_goals: annual_goals(conn)?,
        classes: classes(conn)?,
        students: students(conn)?,
        enrollments: enrollments(conn)?,
        seats: seats(conn)?,
        class_gradings: class_gradings(conn)?,
        grade_columns: grade_columns(conn)?,
        grade_values: grade_values(conn)?,
        grade_rows: grade_rows(conn)?,
        timetable_periods: timetable_periods(conn)?,
        timetable_cells: timetable_cells(conn)?,
        lesson_plans: lesson_plans(conn)?,
        agenda_notes: agenda_notes(conn)?,
        attendance_marks: attendance_marks(conn)?,
        absence_events: absence_events(conn)?,
        incidents: incidents(conn)?,
        support_plans: support_plans(conn)?,
        support_goals: support_goals(conn)?,
    })
}

fn collect<T>(
    conn: &Connection,
    sql: &str,
    map: impl Fn(&Row<'_>) -> rusqlite::Result<T>,
) -> AppResult<Vec<T>> {
    let mut stmt = conn.prepare(sql)?;
    let rows = stmt.query_map([], map)?;
    let mut out = Vec::new();
    for row in rows {
        out.push(row?);
    }
    Ok(out)
}

pub fn school_year(conn: &Connection) -> AppResult<SchoolYear> {
    Ok(conn.query_row(
        "SELECT year_model, start_date FROM school_year WHERE id = 1",
        [],
        |r| {
            Ok(SchoolYear {
                year_model: r.get(0)?,
                start_date: r.get(1)?,
            })
        },
    )?)
}

fn grading_periods(conn: &Connection) -> AppResult<Vec<GradingPeriod>> {
    collect(
        conn,
        "SELECT ordinal, name, start_date, end_date, notes
           FROM grading_period ORDER BY ordinal",
        |r| {
            Ok(GradingPeriod {
                ordinal: r.get(0)?,
                name: r.get(1)?,
                start_date: r.get(2)?,
                end_date: r.get(3)?,
                notes: r.get(4)?,
            })
        },
    )
}

fn holidays(conn: &Connection) -> AppResult<Vec<Holiday>> {
    collect(
        conn,
        "SELECT id, name, start_date, end_date, source, notes
           FROM holiday ORDER BY start_date, id",
        |r| {
            Ok(Holiday {
                id: r.get(0)?,
                name: r.get(1)?,
                start_date: r.get(2)?,
                end_date: r.get(3)?,
                source: r.get(4)?,
                notes: r.get(5)?,
            })
        },
    )
}

fn important_dates(conn: &Connection) -> AppResult<Vec<ImportantDate>> {
    collect(
        conn,
        "SELECT id, name, date, kind, notes FROM important_date ORDER BY date, id",
        |r| {
            Ok(ImportantDate {
                id: r.get(0)?,
                name: r.get(1)?,
                date: r.get(2)?,
                kind: r.get(3)?,
                notes: r.get(4)?,
            })
        },
    )
}

fn annual_goals(conn: &Connection) -> AppResult<Vec<AnnualGoal>> {
    let mut found: Vec<AnnualGoal> = collect(
        conn,
        "SELECT area, goal, actions, success_indicators, deadline, status, review
           FROM annual_goal",
        |r| {
            Ok(AnnualGoal {
                area: r.get(0)?,
                goal: r.get(1)?,
                actions: r.get(2)?,
                success_indicators: r.get(3)?,
                deadline: r.get(4)?,
                status: r.get(5)?,
                review: r.get(6)?,
            })
        },
    )?;
    // Always in the order the source product prints them, not alphabetically.
    found.sort_by_key(|g| {
        GOAL_AREAS
            .iter()
            .position(|a| *a == g.area)
            .unwrap_or(usize::MAX)
    });
    Ok(found)
}

fn classes(conn: &Connection) -> AppResult<Vec<Class>> {
    collect(
        conn,
        "SELECT id, name, subject, room, responsible, notes, position,
                seating_rows, seating_cols, seating_notes
           FROM class ORDER BY position, id",
        |r| {
            Ok(Class {
                id: r.get(0)?,
                name: r.get(1)?,
                subject: r.get(2)?,
                room: r.get(3)?,
                responsible: r.get(4)?,
                notes: r.get(5)?,
                position: r.get(6)?,
                seating_rows: r.get(7)?,
                seating_cols: r.get(8)?,
                seating_notes: r.get(9)?,
            })
        },
    )
}

fn students(conn: &Connection) -> AppResult<Vec<Student>> {
    collect(
        conn,
        "SELECT id, full_name, register_number, birth_date, home_language, address,
                midyear_enrollment, guardian1_name, guardian1_phone, guardian1_email,
                guardian2_name, guardian2_phone, guardian2_email, allergies, conditions,
                medication, emergency_phone, sen_status, sen_plan, sen_accommodations,
                notes, meeting_notes
           FROM student ORDER BY full_name, id",
        |r| {
            Ok(Student {
                id: r.get(0)?,
                full_name: r.get(1)?,
                register_number: r.get(2)?,
                birth_date: r.get(3)?,
                home_language: r.get(4)?,
                address: r.get(5)?,
                midyear_enrollment: r.get::<_, i64>(6)? != 0,
                guardian1_name: r.get(7)?,
                guardian1_phone: r.get(8)?,
                guardian1_email: r.get(9)?,
                guardian2_name: r.get(10)?,
                guardian2_phone: r.get(11)?,
                guardian2_email: r.get(12)?,
                allergies: r.get(13)?,
                conditions: r.get(14)?,
                medication: r.get(15)?,
                emergency_phone: r.get(16)?,
                sen_status: r.get(17)?,
                sen_plan: r.get(18)?,
                sen_accommodations: r.get(19)?,
                notes: r.get(20)?,
                meeting_notes: r.get(21)?,
            })
        },
    )
}

fn enrollments(conn: &Connection) -> AppResult<Vec<Enrollment>> {
    collect(
        conn,
        "SELECT class_id, student_id, roster_no, support, note
           FROM enrollment ORDER BY class_id, roster_no, student_id",
        |r| {
            Ok(Enrollment {
                class_id: r.get(0)?,
                student_id: r.get(1)?,
                roster_no: r.get(2)?,
                support: r.get::<_, i64>(3)? != 0,
                note: r.get(4)?,
            })
        },
    )
}

fn seats(conn: &Connection) -> AppResult<Vec<Seat>> {
    collect(
        conn,
        "SELECT class_id, row, col, student_id FROM seat ORDER BY class_id, row, col",
        |r| {
            Ok(Seat {
                class_id: r.get(0)?,
                row: r.get(1)?,
                col: r.get(2)?,
                student_id: r.get(3)?,
            })
        },
    )
}

// ----------------------------------------------------- reading M2 grades ---

/// Every class's grading settings, defaulted for the classes that have none.
///
/// The teacher does not have to visit a class's gradebook for it to have a
/// pass threshold, so the absence of a row means "the defaults", not "no
/// settings". Doing that here rather than in the UI means the frontend, the
/// print view and any later module all see the same numbers.
fn class_gradings(conn: &Connection) -> AppResult<Vec<ClassGrading>> {
    let stored: Vec<ClassGrading> = collect(
        conn,
        "SELECT class_id, pass_threshold, scale_max, period FROM class_grading",
        |r| {
            Ok(ClassGrading {
                class_id: r.get(0)?,
                pass_threshold: r.get(1)?,
                scale_max: r.get(2)?,
                period: r.get(3)?,
            })
        },
    )?;
    let class_ids: Vec<i64> = collect(conn, "SELECT id FROM class ORDER BY position, id", |r| {
        r.get(0)
    })?;
    Ok(class_ids
        .into_iter()
        .map(|id| {
            stored
                .iter()
                .find(|g| g.class_id == id)
                .cloned()
                .unwrap_or_else(|| ClassGrading::default_for(id))
        })
        .collect())
}

fn grade_columns(conn: &Connection) -> AppResult<Vec<GradeColumn>> {
    collect(
        conn,
        "SELECT id, class_id, position, label, kind, weight
           FROM grade_column ORDER BY class_id, position, id",
        |r| {
            Ok(GradeColumn {
                id: r.get(0)?,
                class_id: r.get(1)?,
                position: r.get(2)?,
                label: r.get(3)?,
                kind: r.get(4)?,
                // NULL stays None: an undecided weight is not a zero one.
                weight: r.get(5)?,
            })
        },
    )
}

fn grade_values(conn: &Connection) -> AppResult<Vec<GradeValue>> {
    collect(
        conn,
        "SELECT class_id, column_id, student_id, value
           FROM grade_value ORDER BY class_id, column_id, student_id",
        |r| {
            Ok(GradeValue {
                class_id: r.get(0)?,
                column_id: r.get(1)?,
                student_id: r.get(2)?,
                value: r.get(3)?,
            })
        },
    )
}

fn grade_rows(conn: &Connection) -> AppResult<Vec<GradeRow>> {
    collect(
        conn,
        "SELECT class_id, student_id, conduct, observations, overall_result
           FROM grade_row ORDER BY class_id, student_id",
        |r| {
            Ok(GradeRow {
                class_id: r.get(0)?,
                student_id: r.get(1)?,
                conduct: r.get(2)?,
                observations: r.get(3)?,
                overall_result: r.get(4)?,
            })
        },
    )
}

// ------------------------------------------ reading M3 timetable and plans ---

/// The teacher's named hours, in the order the grid shows them.
fn timetable_periods(conn: &Connection) -> AppResult<Vec<TimetablePeriod>> {
    collect(
        conn,
        "SELECT id, position, name, start_time, end_time
           FROM timetable_period ORDER BY position, id",
        |r| {
            Ok(TimetablePeriod {
                id: r.get(0)?,
                position: r.get(1)?,
                name: r.get(2)?,
                start_time: r.get(3)?,
                end_time: r.get(4)?,
            })
        },
    )
}

/// Every filled cell of the master timetable. An empty cell has no row at all,
/// so a week the teacher has barely filled in costs almost nothing.
fn timetable_cells(conn: &Connection) -> AppResult<Vec<TimetableCell>> {
    collect(
        conn,
        "SELECT period_id, weekday, class_id, subject, room, duty, notes
           FROM timetable_cell ORDER BY period_id, weekday",
        |r| {
            Ok(TimetableCell {
                period_id: r.get(0)?,
                weekday: r.get(1)?,
                // NULL stays None: an hour with no class is a cover, a duty or
                // a free hour, not a link to class zero.
                class_id: r.get(2)?,
                subject: r.get(3)?,
                room: r.get(4)?,
                duty: r.get(5)?,
                notes: r.get(6)?,
            })
        },
    )
}

/// Every weekly lesson plan, ordered by the actual Monday it belongs to.
fn lesson_plans(conn: &Connection) -> AppResult<Vec<LessonPlan>> {
    collect(
        conn,
        "SELECT class_id, week_monday, notes, assessment
           FROM lesson_plan ORDER BY class_id, week_monday",
        |r| {
            Ok(LessonPlan {
                class_id: r.get(0)?,
                week_monday: r.get(1)?,
                notes: r.get(2)?,
                assessment: r.get(3)?,
            })
        },
    )
}

fn agenda_notes(conn: &Connection) -> AppResult<Vec<AgendaNote>> {
    collect(
        conn,
        "SELECT scope, date, body FROM agenda_note ORDER BY scope, date",
        |r| {
            Ok(AgendaNote {
                scope: r.get(0)?,
                date: r.get(1)?,
                body: r.get(2)?,
            })
        },
    )
}

// ------------------------------- reading M4 attendance and behaviour ---

/// Every marked cell of the monthly attendance grid.
///
/// Ordered by date so the grid builds in calendar order. An **unmarked day has
/// no row at all**, which is what makes "she has not said" different from
/// "present".
fn attendance_marks(conn: &Connection) -> AppResult<Vec<AttendanceMark>> {
    collect(
        conn,
        "SELECT class_id, student_id, date, state
           FROM attendance_mark ORDER BY class_id, date, student_id",
        |r| {
            Ok(AttendanceMark {
                class_id: r.get(0)?,
                student_id: r.get(1)?,
                date: r.get(2)?,
                state: r.get(3)?,
            })
        },
    )
}

/// Every line of the detailed absence register.
///
/// Read from its own table with no join to `attendance_mark`, deliberately:
/// the two are independent and nothing derives one from the other.
fn absence_events(conn: &Connection) -> AppResult<Vec<AbsenceEvent>> {
    collect(
        conn,
        "SELECT id, class_id, student_id, date, kind, clock_time, teaching_hour,
                reason, justified, follow_up, frequent_note
           FROM absence_event ORDER BY class_id, date, id",
        |r| {
            Ok(AbsenceEvent {
                id: r.get(0)?,
                class_id: r.get(1)?,
                student_id: r.get(2)?,
                date: r.get(3)?,
                kind: r.get(4)?,
                clock_time: r.get(5)?,
                teaching_hour: r.get(6)?,
                reason: r.get(7)?,
                justified: r.get(8)?,
                follow_up: r.get(9)?,
                frequent_note: r.get(10)?,
            })
        },
    )
}

/// Every behaviour/incident entry, newest-relevant ordering left to the UI.
fn incidents(conn: &Connection) -> AppResult<Vec<Incident>> {
    collect(
        conn,
        "SELECT id, student_id, class_id, date, what_happened, action_taken, parents_informed
           FROM incident ORDER BY date, id",
        |r| {
            Ok(Incident {
                id: r.get(0)?,
                student_id: r.get(1)?,
                // NULL stays None: an incident that belonged to no class in
                // particular is not an incident in class zero.
                class_id: r.get(2)?,
                date: r.get(3)?,
                what_happened: r.get(4)?,
                action_taken: r.get(5)?,
                parents_informed: r.get(6)?,
            })
        },
    )
}

fn support_plans(conn: &Connection) -> AppResult<Vec<SupportPlan>> {
    collect(
        conn,
        "SELECT id, student_id, position, start_date, monitoring_frequency, strengths,
                needs, accommodations, collaboration, status, next_review
           FROM support_plan ORDER BY student_id, position, id",
        |r| {
            Ok(SupportPlan {
                id: r.get(0)?,
                student_id: r.get(1)?,
                position: r.get(2)?,
                start_date: r.get(3)?,
                monitoring_frequency: r.get(4)?,
                strengths: r.get(5)?,
                needs: r.get(6)?,
                accommodations: r.get(7)?,
                collaboration: r.get(8)?,
                status: r.get(9)?,
                next_review: r.get(10)?,
            })
        },
    )
}

fn support_goals(conn: &Connection) -> AppResult<Vec<SupportGoal>> {
    collect(
        conn,
        "SELECT id, plan_id, position, goal, progress, monitored_on
           FROM support_goal ORDER BY plan_id, position, id",
        |r| {
            Ok(SupportGoal {
                id: r.get(0)?,
                plan_id: r.get(1)?,
                position: r.get(2)?,
                goal: r.get(3)?,
                progress: r.get(4)?,
                monitored_on: r.get(5)?,
            })
        },
    )
}

// ---------------------------------------------------------------- writing ---

/// Changes the year model and start date, and nothing else.
///
/// This is the whole of "changing the school year": no other table names a week
/// or a period index, so there is nothing here to cascade into. That is the
/// design that makes M1's first acceptance criterion hold by construction
/// rather than by care.
pub fn save_school_year(conn: &Connection, year: &SchoolYear) -> AppResult<()> {
    conn.execute(
        "UPDATE school_year SET year_model = ?1, start_date = ?2 WHERE id = 1",
        params![year.year_model, year.start_date],
    )?;
    Ok(())
}

pub fn save_grading_periods(conn: &Connection, periods: &[GradingPeriod]) -> AppResult<()> {
    for p in periods {
        conn.execute(
            "UPDATE grading_period
                SET name = ?2, start_date = ?3, end_date = ?4, notes = ?5
              WHERE ordinal = ?1",
            params![p.ordinal, p.name, p.start_date, p.end_date, p.notes],
        )?;
    }
    Ok(())
}

pub fn save_holiday(conn: &Connection, h: &Holiday) -> AppResult<i64> {
    if h.id == 0 {
        conn.execute(
            "INSERT INTO holiday (name, start_date, end_date, source, notes)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![h.name, h.start_date, h.end_date, h.source, h.notes],
        )?;
        Ok(conn.last_insert_rowid())
    } else {
        conn.execute(
            "UPDATE holiday SET name = ?2, start_date = ?3, end_date = ?4,
                                source = ?5, notes = ?6
              WHERE id = ?1",
            params![h.id, h.name, h.start_date, h.end_date, h.source, h.notes],
        )?;
        Ok(h.id)
    }
}

pub fn delete_holiday(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM holiday WHERE id = ?1", [id])?;
    Ok(())
}

pub fn save_important_date(conn: &Connection, d: &ImportantDate) -> AppResult<i64> {
    if d.id == 0 {
        conn.execute(
            "INSERT INTO important_date (name, date, kind, notes) VALUES (?1, ?2, ?3, ?4)",
            params![d.name, d.date, d.kind, d.notes],
        )?;
        Ok(conn.last_insert_rowid())
    } else {
        conn.execute(
            "UPDATE important_date SET name = ?2, date = ?3, kind = ?4, notes = ?5
              WHERE id = ?1",
            params![d.id, d.name, d.date, d.kind, d.notes],
        )?;
        Ok(d.id)
    }
}

pub fn delete_important_date(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM important_date WHERE id = ?1", [id])?;
    Ok(())
}

pub fn save_annual_goal(conn: &Connection, g: &AnnualGoal) -> AppResult<()> {
    conn.execute(
        "UPDATE annual_goal
            SET goal = ?2, actions = ?3, success_indicators = ?4,
                deadline = ?5, status = ?6, review = ?7
          WHERE area = ?1",
        params![
            g.area,
            g.goal,
            g.actions,
            g.success_indicators,
            g.deadline,
            g.status,
            g.review
        ],
    )?;
    Ok(())
}

/// Inserts or updates a class.
///
/// M1 also wrote the class's timetable slots here. M3 moved the teacher's week
/// into one master register (`timetable_cell`), so a class's hours are derived
/// from the cells that link to it and are not written through this function at
/// all — see `db::migrate_to_4`.
pub fn save_class(conn: &Connection, c: &Class) -> AppResult<i64> {
    let id = if c.id == 0 {
        let next: i64 = conn.query_row(
            "SELECT coalesce(max(position), -1) + 1 FROM class",
            [],
            |r| r.get(0),
        )?;
        conn.execute(
            "INSERT INTO class (name, subject, room, responsible, notes, position,
                                seating_rows, seating_cols, seating_notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                c.name,
                c.subject,
                c.room,
                c.responsible,
                c.notes,
                next,
                c.seating_rows,
                c.seating_cols,
                c.seating_notes
            ],
        )?;
        conn.last_insert_rowid()
    } else {
        conn.execute(
            "UPDATE class SET name = ?2, subject = ?3, room = ?4, responsible = ?5,
                              notes = ?6, seating_rows = ?7, seating_cols = ?8,
                              seating_notes = ?9
              WHERE id = ?1",
            params![
                c.id,
                c.name,
                c.subject,
                c.room,
                c.responsible,
                c.notes,
                c.seating_rows,
                c.seating_cols,
                c.seating_notes
            ],
        )?;
        c.id
    };
    Ok(id)
}

/// Deletes a class. Its roster rows, seats and gradebook go with it; the
/// students themselves stay, because they belong to the teacher's year, not to
/// a class. Its hours stay on the master timetable too, with the link emptied —
/// the hour is still in the teacher's week even once the class is gone.
pub fn delete_class(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM class WHERE id = ?1", [id])?;
    Ok(())
}

pub fn save_student(conn: &Connection, s: &Student) -> AppResult<i64> {
    if s.id == 0 {
        conn.execute(
            "INSERT INTO student (full_name, register_number, birth_date, home_language,
                                  address, midyear_enrollment, guardian1_name, guardian1_phone,
                                  guardian1_email, guardian2_name, guardian2_phone,
                                  guardian2_email, allergies, conditions, medication,
                                  emergency_phone, sen_status, sen_plan, sen_accommodations,
                                  notes, meeting_notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15,
                     ?16, ?17, ?18, ?19, ?20, ?21)",
            params![
                s.full_name,
                s.register_number,
                s.birth_date,
                s.home_language,
                s.address,
                s.midyear_enrollment as i64,
                s.guardian1_name,
                s.guardian1_phone,
                s.guardian1_email,
                s.guardian2_name,
                s.guardian2_phone,
                s.guardian2_email,
                s.allergies,
                s.conditions,
                s.medication,
                s.emergency_phone,
                s.sen_status,
                s.sen_plan,
                s.sen_accommodations,
                s.notes,
                s.meeting_notes,
            ],
        )?;
        Ok(conn.last_insert_rowid())
    } else {
        conn.execute(
            "UPDATE student SET full_name = ?1, register_number = ?2, birth_date = ?3,
                                home_language = ?4, address = ?5, midyear_enrollment = ?6,
                                guardian1_name = ?7, guardian1_phone = ?8, guardian1_email = ?9,
                                guardian2_name = ?10, guardian2_phone = ?11, guardian2_email = ?12,
                                allergies = ?13, conditions = ?14, medication = ?15,
                                emergency_phone = ?16, sen_status = ?17, sen_plan = ?18,
                                sen_accommodations = ?19, notes = ?20, meeting_notes = ?21
              WHERE id = ?22",
            params![
                s.full_name,
                s.register_number,
                s.birth_date,
                s.home_language,
                s.address,
                s.midyear_enrollment as i64,
                s.guardian1_name,
                s.guardian1_phone,
                s.guardian1_email,
                s.guardian2_name,
                s.guardian2_phone,
                s.guardian2_email,
                s.allergies,
                s.conditions,
                s.medication,
                s.emergency_phone,
                s.sen_status,
                s.sen_plan,
                s.sen_accommodations,
                s.notes,
                s.meeting_notes,
                s.id,
            ],
        )?;
        Ok(s.id)
    }
}

/// Deletes a student everywhere: the card, every roster she is on, and every
/// seat she occupies. The cascade is what stops a roster row outliving her.
pub fn delete_student(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM student WHERE id = ?1", [id])?;
    Ok(())
}

/// Puts a student on a class's roster, or updates her row on it.
///
/// Called once per class, so the same student ends up on as many rosters as she
/// attends — with her own support flag and note on each.
pub fn set_enrollment(conn: &Connection, e: &Enrollment) -> AppResult<()> {
    let roster_no = if e.roster_no > 0 {
        e.roster_no
    } else {
        conn.query_row(
            "SELECT coalesce(max(roster_no), 0) + 1 FROM enrollment WHERE class_id = ?1",
            [e.class_id],
            |r| r.get(0),
        )?
    };
    conn.execute(
        "INSERT INTO enrollment (class_id, student_id, roster_no, support, note)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (class_id, student_id)
         DO UPDATE SET roster_no = excluded.roster_no,
                       support   = excluded.support,
                       note      = excluded.note",
        params![
            e.class_id,
            e.student_id,
            roster_no,
            e.support as i64,
            e.note
        ],
    )?;
    Ok(())
}

/// Takes a student off one class's roster, leaving her other classes alone.
/// Her seat in that room goes too — a seat is a position on that roster.
pub fn remove_enrollment(conn: &Connection, class_id: i64, student_id: i64) -> AppResult<()> {
    conn.execute(
        "DELETE FROM enrollment WHERE class_id = ?1 AND student_id = ?2",
        params![class_id, student_id],
    )?;
    conn.execute(
        "DELETE FROM seat WHERE class_id = ?1 AND student_id = ?2",
        params![class_id, student_id],
    )?;
    Ok(())
}

/// Replaces a class's seating plan: grid size, notes and every occupied seat.
pub fn save_seating(
    conn: &Connection,
    class_id: i64,
    rows: i64,
    cols: i64,
    notes: &str,
    seats: &[Seat],
) -> AppResult<()> {
    conn.execute(
        "UPDATE class SET seating_rows = ?2, seating_cols = ?3, seating_notes = ?4
          WHERE id = ?1",
        params![class_id, rows, cols, notes],
    )?;
    conn.execute("DELETE FROM seat WHERE class_id = ?1", [class_id])?;
    for seat in seats {
        conn.execute(
            "INSERT INTO seat (class_id, row, col, student_id) VALUES (?1, ?2, ?3, ?4)",
            params![class_id, seat.row, seat.col, seat.student_id],
        )?;
    }
    Ok(())
}

// ----------------------------------------------------- writing M2 grades ---

pub fn save_class_grading(conn: &Connection, g: &ClassGrading) -> AppResult<()> {
    conn.execute(
        "INSERT INTO class_grading (class_id, pass_threshold, scale_max, period)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (class_id)
         DO UPDATE SET pass_threshold = excluded.pass_threshold,
                       scale_max      = excluded.scale_max,
                       period         = excluded.period",
        params![g.class_id, g.pass_threshold, g.scale_max, g.period],
    )?;
    Ok(())
}

/// Inserts or updates one gradebook column.
///
/// A new column goes on the end of its own class's sheet. `weight` is written
/// through as it arrives, `NULL` included — that is the difference between a
/// column the teacher has not weighted yet and one she weighted at zero.
pub fn save_grade_column(conn: &Connection, c: &GradeColumn) -> AppResult<i64> {
    if c.id == 0 {
        let next: i64 = conn.query_row(
            "SELECT coalesce(max(position), -1) + 1 FROM grade_column WHERE class_id = ?1",
            [c.class_id],
            |r| r.get(0),
        )?;
        conn.execute(
            "INSERT INTO grade_column (class_id, position, label, kind, weight)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![c.class_id, next, c.label, c.kind, c.weight],
        )?;
        Ok(conn.last_insert_rowid())
    } else {
        conn.execute(
            "UPDATE grade_column SET label = ?2, kind = ?3, weight = ?4, position = ?5
              WHERE id = ?1",
            params![c.id, c.label, c.kind, c.weight, c.position],
        )?;
        Ok(c.id)
    }
}

/// Deletes a column and, by cascade, every mark entered under it.
pub fn delete_grade_column(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM grade_column WHERE id = ?1", [id])?;
    Ok(())
}

/// Writes one cell.
///
/// Clearing a cell **deletes** its row rather than storing an empty string, so
/// "no mark" is the absence of a record at every layer. It is also why a blank
/// can never be read back as a zero.
pub fn set_grade_value(conn: &Connection, v: &GradeValue) -> AppResult<()> {
    if v.value.trim().is_empty() {
        conn.execute(
            "DELETE FROM grade_value WHERE column_id = ?1 AND student_id = ?2",
            params![v.column_id, v.student_id],
        )?;
        return Ok(());
    }
    conn.execute(
        "INSERT INTO grade_value (class_id, column_id, student_id, value)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (column_id, student_id)
         DO UPDATE SET value = excluded.value, class_id = excluded.class_id",
        params![v.class_id, v.column_id, v.student_id, v.value],
    )?;
    Ok(())
}

/// Writes a student's conduct, observations and written overall result.
///
/// `overall_result` is stored exactly as typed and is never derived from the
/// conduct level or from any mark — the spec keeps it a teacher-written field.
pub fn save_grade_row(conn: &Connection, r: &GradeRow) -> AppResult<()> {
    conn.execute(
        "INSERT INTO grade_row (class_id, student_id, conduct, observations, overall_result)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (class_id, student_id)
         DO UPDATE SET conduct        = excluded.conduct,
                       observations   = excluded.observations,
                       overall_result = excluded.overall_result",
        params![
            r.class_id,
            r.student_id,
            r.conduct,
            r.observations,
            r.overall_result
        ],
    )?;
    Ok(())
}

// ------------------------------------------ writing M3 timetable and plans ---

/// Inserts or updates one named hour of the teacher's week.
///
/// A new hour goes on the end of the grid. Nothing here touches its cells, so
/// renaming "3η" or correcting its clock times leaves every lesson placed in it
/// exactly where it was.
pub fn save_timetable_period(conn: &Connection, p: &TimetablePeriod) -> AppResult<i64> {
    if p.id == 0 {
        let next: i64 = conn.query_row(
            "SELECT coalesce(max(position), -1) + 1 FROM timetable_period",
            [],
            |r| r.get(0),
        )?;
        conn.execute(
            "INSERT INTO timetable_period (position, name, start_time, end_time)
             VALUES (?1, ?2, ?3, ?4)",
            params![next, p.name, p.start_time, p.end_time],
        )?;
        Ok(conn.last_insert_rowid())
    } else {
        conn.execute(
            "UPDATE timetable_period SET name = ?2, start_time = ?3, end_time = ?4, position = ?5
              WHERE id = ?1",
            params![p.id, p.name, p.start_time, p.end_time, p.position],
        )?;
        Ok(p.id)
    }
}

/// Deletes an hour and, by cascade, every cell the teacher filled in on it.
pub fn delete_timetable_period(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM timetable_period WHERE id = ?1", [id])?;
    Ok(())
}

/// Writes one cell of the master timetable.
///
/// A cell with nothing in it — no class, no subject, no room, no duty, no note —
/// is **deleted** rather than stored blank, so "the teacher is free then" is the
/// absence of a row at every layer. Same rule as a cleared grade cell.
pub fn save_timetable_cell(conn: &Connection, c: &TimetableCell) -> AppResult<()> {
    let empty = c.class_id.is_none()
        && c.subject.trim().is_empty()
        && c.room.trim().is_empty()
        && c.duty.trim().is_empty()
        && c.notes.trim().is_empty();
    if empty {
        conn.execute(
            "DELETE FROM timetable_cell WHERE period_id = ?1 AND weekday = ?2",
            params![c.period_id, c.weekday],
        )?;
        return Ok(());
    }
    conn.execute(
        "INSERT INTO timetable_cell (period_id, weekday, class_id, subject, room, duty, notes)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT (period_id, weekday)
         DO UPDATE SET class_id = excluded.class_id,
                       subject  = excluded.subject,
                       room     = excluded.room,
                       duty     = excluded.duty,
                       notes    = excluded.notes",
        params![
            c.period_id,
            c.weekday,
            c.class_id,
            c.subject,
            c.room,
            c.duty,
            c.notes
        ],
    )?;
    Ok(())
}

/// Writes one class's plan for one week.
///
/// The key is `(class_id, week_monday)` — an actual date, never a week index —
/// so this is an upsert with no id to hand back and nothing for the caller to
/// select afterwards. A plan emptied of both its notes and its assessment is
/// deleted, so an untouched week is an absent row and M6's progress matrix can
/// read "nothing entered" as exactly that.
pub fn save_lesson_plan(conn: &Connection, p: &LessonPlan) -> AppResult<()> {
    if p.notes.trim().is_empty() && p.assessment.trim().is_empty() {
        conn.execute(
            "DELETE FROM lesson_plan WHERE class_id = ?1 AND week_monday = ?2",
            params![p.class_id, p.week_monday],
        )?;
        return Ok(());
    }
    conn.execute(
        "INSERT INTO lesson_plan (class_id, week_monday, notes, assessment)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (class_id, week_monday)
         DO UPDATE SET notes = excluded.notes, assessment = excluded.assessment",
        params![p.class_id, p.week_monday, p.notes, p.assessment],
    )?;
    Ok(())
}

/// Writes one day, week or month agenda note, keyed by an actual date.
///
/// Emptying a note deletes it, for the same reason as above. `date` arrives
/// already normalised for its scope (the Monday of a week, the first of a
/// month) — see `domain/agenda.ts`.
pub fn save_agenda_note(conn: &Connection, n: &AgendaNote) -> AppResult<()> {
    if n.body.trim().is_empty() {
        conn.execute(
            "DELETE FROM agenda_note WHERE scope = ?1 AND date = ?2",
            params![n.scope, n.date],
        )?;
        return Ok(());
    }
    conn.execute(
        "INSERT INTO agenda_note (scope, date, body) VALUES (?1, ?2, ?3)
         ON CONFLICT (scope, date) DO UPDATE SET body = excluded.body",
        params![n.scope, n.date, n.body],
    )?;
    Ok(())
}

// ------------------------------- writing M4 attendance and behaviour ---

/// Writes one cell of the monthly attendance grid.
///
/// Clearing a cell **deletes** its row rather than storing an empty state, the
/// same rule as a cleared grade cell and an emptied timetable cell: a day the
/// teacher has not marked is the absence of a row at every layer. It is also
/// why an unmarked day can never read back as "present".
///
/// **Nothing here touches `absence_event`.** The two registers are independent
/// by the spec's own repeated decision, so marking a day in the grid writes one
/// row in one table and reaches nothing else.
pub fn save_attendance_mark(conn: &Connection, m: &AttendanceMark) -> AppResult<()> {
    if m.state.trim().is_empty() {
        conn.execute(
            "DELETE FROM attendance_mark WHERE class_id = ?1 AND student_id = ?2 AND date = ?3",
            params![m.class_id, m.student_id, m.date],
        )?;
        return Ok(());
    }
    conn.execute(
        "INSERT INTO attendance_mark (class_id, student_id, date, state)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (class_id, student_id, date) DO UPDATE SET state = excluded.state",
        params![m.class_id, m.student_id, m.date, m.state],
    )?;
    Ok(())
}

/// Inserts or updates one line of the detailed absence register.
///
/// A blank row is **kept**, unlike an emptied attendance cell: the teacher
/// pressed "new absence" and is about to fill it in, so deleting it on save
/// would make it vanish as she typed. Removing one is an explicit delete.
///
/// **Nothing here touches `attendance_mark`**, for the same reason as above.
pub fn save_absence_event(conn: &Connection, e: &AbsenceEvent) -> AppResult<i64> {
    if e.id == 0 {
        conn.execute(
            "INSERT INTO absence_event (class_id, student_id, date, kind, clock_time,
                                        teaching_hour, reason, justified, follow_up, frequent_note)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                e.class_id,
                e.student_id,
                e.date,
                e.kind,
                e.clock_time,
                e.teaching_hour,
                e.reason,
                e.justified,
                e.follow_up,
                e.frequent_note
            ],
        )?;
        Ok(conn.last_insert_rowid())
    } else {
        conn.execute(
            "UPDATE absence_event
                SET class_id = ?2, student_id = ?3, date = ?4, kind = ?5, clock_time = ?6,
                    teaching_hour = ?7, reason = ?8, justified = ?9, follow_up = ?10,
                    frequent_note = ?11
              WHERE id = ?1",
            params![
                e.id,
                e.class_id,
                e.student_id,
                e.date,
                e.kind,
                e.clock_time,
                e.teaching_hour,
                e.reason,
                e.justified,
                e.follow_up,
                e.frequent_note
            ],
        )?;
        Ok(e.id)
    }
}

pub fn delete_absence_event(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM absence_event WHERE id = ?1", [id])?;
    Ok(())
}

/// Inserts or updates one behaviour/incident entry.
///
/// The entry belongs to the **student**, so it follows her across every class
/// she is enrolled in. `class_id` is an optional note of where it happened and
/// may be `NULL`.
pub fn save_incident(conn: &Connection, i: &Incident) -> AppResult<i64> {
    if i.id == 0 {
        conn.execute(
            "INSERT INTO incident (student_id, class_id, date, what_happened,
                                   action_taken, parents_informed)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                i.student_id,
                i.class_id,
                i.date,
                i.what_happened,
                i.action_taken,
                i.parents_informed
            ],
        )?;
        Ok(conn.last_insert_rowid())
    } else {
        conn.execute(
            "UPDATE incident
                SET student_id = ?2, class_id = ?3, date = ?4, what_happened = ?5,
                    action_taken = ?6, parents_informed = ?7
              WHERE id = ?1",
            params![
                i.id,
                i.student_id,
                i.class_id,
                i.date,
                i.what_happened,
                i.action_taken,
                i.parents_informed
            ],
        )?;
        Ok(i.id)
    }
}

pub fn delete_incident(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM incident WHERE id = ?1", [id])?;
    Ok(())
}

/// Inserts or updates one support plan.
///
/// A new plan goes on the end of that student's own list. **`status` is written
/// through exactly as it arrives and is never derived from anything** — and
/// note that this statement cannot reach `support_goal` at all, which is why
/// editing a goal can never overwrite a plan's status.
pub fn save_support_plan(conn: &Connection, p: &SupportPlan) -> AppResult<i64> {
    if p.id == 0 {
        let next: i64 = conn.query_row(
            "SELECT coalesce(max(position), -1) + 1 FROM support_plan WHERE student_id = ?1",
            [p.student_id],
            |r| r.get(0),
        )?;
        conn.execute(
            "INSERT INTO support_plan (student_id, position, start_date, monitoring_frequency,
                                       strengths, needs, accommodations, collaboration,
                                       status, next_review)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            params![
                p.student_id,
                next,
                p.start_date,
                p.monitoring_frequency,
                p.strengths,
                p.needs,
                p.accommodations,
                p.collaboration,
                p.status,
                p.next_review
            ],
        )?;
        Ok(conn.last_insert_rowid())
    } else {
        conn.execute(
            "UPDATE support_plan
                SET start_date = ?2, monitoring_frequency = ?3, strengths = ?4, needs = ?5,
                    accommodations = ?6, collaboration = ?7, status = ?8, next_review = ?9,
                    position = ?10
              WHERE id = ?1",
            params![
                p.id,
                p.start_date,
                p.monitoring_frequency,
                p.strengths,
                p.needs,
                p.accommodations,
                p.collaboration,
                p.status,
                p.next_review,
                p.position
            ],
        )?;
        Ok(p.id)
    }
}

/// Deletes a plan and, by cascade, its goals.
pub fn delete_support_plan(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM support_plan WHERE id = ?1", [id])?;
    Ok(())
}

/// Inserts or updates one goal inside a plan.
///
/// **This statement names only `support_goal`.** A plan's teacher-written
/// status is in another table and cannot be reached from here — M4's second
/// acceptance criterion, held by construction rather than by care.
pub fn save_support_goal(conn: &Connection, g: &SupportGoal) -> AppResult<i64> {
    if g.id == 0 {
        let next: i64 = conn.query_row(
            "SELECT coalesce(max(position), -1) + 1 FROM support_goal WHERE plan_id = ?1",
            [g.plan_id],
            |r| r.get(0),
        )?;
        conn.execute(
            "INSERT INTO support_goal (plan_id, position, goal, progress, monitored_on)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![g.plan_id, next, g.goal, g.progress, g.monitored_on],
        )?;
        Ok(conn.last_insert_rowid())
    } else {
        conn.execute(
            "UPDATE support_goal SET goal = ?2, progress = ?3, monitored_on = ?4, position = ?5
              WHERE id = ?1",
            params![g.id, g.goal, g.progress, g.monitored_on, g.position],
        )?;
        Ok(g.id)
    }
}

pub fn delete_support_goal(conn: &Connection, id: i64) -> AppResult<()> {
    conn.execute("DELETE FROM support_goal WHERE id = ?1", [id])?;
    Ok(())
}

#[cfg(test)]
pub mod tests_support {
    use super::*;

    pub fn sample_class() -> Class {
        Class {
            id: 0,
            name: "Α1".into(),
            subject: "Μαθηματικά".into(),
            room: "203".into(),
            responsible: "Μ. Νικολάου".into(),
            notes: "Διπλή ώρα την Τρίτη".into(),
            position: 0,
            seating_rows: 5,
            seating_cols: 6,
            seating_notes: "Ομάδες των τεσσάρων".into(),
        }
    }

    /// The 3rd hour on a Tuesday — the hour M1's `sample_class` used to carry
    /// as its own slot, now a row of the teacher's master timetable.
    pub fn sample_period() -> TimetablePeriod {
        TimetablePeriod {
            id: 0,
            position: 0,
            name: "3η".into(),
            start_time: "10:15".into(),
            end_time: "11:00".into(),
        }
    }

    /// A card with every single field filled in — the fixture M1's
    /// round-trip criterion is checked against.
    pub fn sample_student() -> Student {
        Student {
            id: 0,
            full_name: "Ελένη Παπαδοπούλου".into(),
            register_number: "12345".into(),
            birth_date: "2014-03-07".into(),
            home_language: "Ελληνικά".into(),
            address: "Λεωφ. Αρχ. Μακαρίου Γ΄ 12, Λευκωσία".into(),
            midyear_enrollment: true,
            guardian1_name: "Άννα Παπαδοπούλου".into(),
            guardian1_phone: "+357 99 123456".into(),
            guardian1_email: "anna@example.com".into(),
            guardian2_name: "Γιώργος Παπαδόπουλος".into(),
            guardian2_phone: "+357 99 654321".into(),
            guardian2_email: "giorgos@example.com".into(),
            allergies: "Ξηροί καρποί".into(),
            conditions: "Άσθμα — εισπνεόμενο στη σχολική τσάντα".into(),
            medication: "Σαλβουταμόλη".into(),
            emergency_phone: "+357 22 800800".into(),
            sen_status: "accommodations".into(),
            sen_plan: "ΕΠΕ, γνωμάτευση ΚΕΔΑΣΥ 04/2026".into(),
            sen_accommodations: "Επιπλέον χρόνος στις γραπτές εργασίες".into(),
            notes: "Δουλεύει καλύτερα σε μικρή ομάδα".into(),
            meeting_notes: "18/09: συνάντηση με τη μητέρα".into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::tests_support::*;
    use super::*;
    use crate::db;

    fn open() -> (tempfile::TempDir, Connection) {
        let dir = tempfile::tempdir().unwrap();
        let conn = db::open_at(&dir.path().join("planner.sqlite")).unwrap();
        (dir, conn)
    }

    #[test]
    fn every_student_field_round_trips_through_save_and_reload() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");

        let conn = db::open_at(&path).unwrap();
        let mut expected = sample_student();
        expected.id = save_student(&conn, &expected).unwrap();
        drop(conn); // the app quits

        let conn = db::open_at(&path).unwrap();
        let loaded = load(&conn).unwrap();
        assert_eq!(loaded.students, vec![expected]);
    }

    #[test]
    fn a_student_belongs_to_two_classes_at_once_and_appears_in_both_rosters() {
        let (_dir, conn) = open();

        let mut a = sample_class();
        a.name = "Α1".into();
        let class_a = save_class(&conn, &a).unwrap();
        let mut b = sample_class();
        b.name = "Β2".into();
        let class_b = save_class(&conn, &b).unwrap();

        let student = save_student(&conn, &sample_student()).unwrap();
        // The same student, flagged for support in one class but not the other.
        set_enrollment(
            &conn,
            &Enrollment {
                class_id: class_a,
                student_id: student,
                roster_no: 0,
                support: true,
                note: "Ενισχυτική δύο φορές την εβδομάδα".into(),
            },
        )
        .unwrap();
        set_enrollment(
            &conn,
            &Enrollment {
                class_id: class_b,
                student_id: student,
                roster_no: 0,
                support: false,
                note: String::new(),
            },
        )
        .unwrap();

        let planner = load(&conn).unwrap();
        let in_a: Vec<_> = planner
            .enrollments
            .iter()
            .filter(|e| e.class_id == class_a)
            .collect();
        let in_b: Vec<_> = planner
            .enrollments
            .iter()
            .filter(|e| e.class_id == class_b)
            .collect();
        assert_eq!(in_a.len(), 1);
        assert_eq!(in_b.len(), 1);
        assert_eq!(in_a[0].student_id, student);
        assert_eq!(in_b[0].student_id, student);
        assert!(in_a[0].support);
        assert!(
            !in_b[0].support,
            "the support flag is per class, not per student"
        );
    }

    #[test]
    fn leaving_one_class_leaves_the_other_membership_alone() {
        let (_dir, conn) = open();
        let a = save_class(&conn, &sample_class()).unwrap();
        let b = save_class(&conn, &sample_class()).unwrap();
        let s = save_student(&conn, &sample_student()).unwrap();
        for class_id in [a, b] {
            set_enrollment(
                &conn,
                &Enrollment {
                    class_id,
                    student_id: s,
                    roster_no: 0,
                    support: false,
                    note: String::new(),
                },
            )
            .unwrap();
        }

        remove_enrollment(&conn, a, s).unwrap();

        let planner = load(&conn).unwrap();
        assert_eq!(planner.enrollments.len(), 1);
        assert_eq!(planner.enrollments[0].class_id, b);
        assert_eq!(
            planner.students.len(),
            1,
            "the student herself is untouched"
        );
    }

    #[test]
    fn deleting_a_class_keeps_its_students() {
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        let student_id = save_student(&conn, &sample_student()).unwrap();
        set_enrollment(
            &conn,
            &Enrollment {
                class_id,
                student_id,
                roster_no: 1,
                support: false,
                note: String::new(),
            },
        )
        .unwrap();
        save_seating(
            &conn,
            class_id,
            5,
            6,
            "",
            &[Seat {
                class_id,
                row: 0,
                col: 0,
                student_id,
            }],
        )
        .unwrap();

        delete_class(&conn, class_id).unwrap();

        let planner = load(&conn).unwrap();
        assert!(planner.classes.is_empty());
        assert!(planner.enrollments.is_empty());
        assert!(planner.seats.is_empty());
        assert_eq!(planner.students.len(), 1);
    }

    #[test]
    fn deleting_a_student_leaves_no_dangling_roster_or_seat_row() {
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        let student_id = save_student(&conn, &sample_student()).unwrap();
        set_enrollment(
            &conn,
            &Enrollment {
                class_id,
                student_id,
                roster_no: 1,
                support: false,
                note: String::new(),
            },
        )
        .unwrap();
        save_seating(
            &conn,
            class_id,
            5,
            6,
            "",
            &[Seat {
                class_id,
                row: 1,
                col: 2,
                student_id,
            }],
        )
        .unwrap();

        delete_student(&conn, student_id).unwrap();

        let planner = load(&conn).unwrap();
        assert!(planner.enrollments.is_empty());
        assert!(planner.seats.is_empty());
        assert_eq!(planner.classes.len(), 1, "the class survives its student");
    }

    #[test]
    fn a_roster_row_for_a_student_who_does_not_exist_is_rejected() {
        // The spec asks for this to fail at write time rather than dangle.
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        let err = set_enrollment(
            &conn,
            &Enrollment {
                class_id,
                student_id: 9999,
                roster_no: 1,
                support: false,
                note: String::new(),
            },
        );
        assert!(
            err.is_err(),
            "a foreign key violation must surface as an error"
        );
    }

    // ------------------------------------------- M3: timetable and planning ---

    /// M1 wrote a class's hours through `save_class`; M3 replaced that with one
    /// master register. This is the same guarantee as the M1 test it supersedes
    /// — a class's hours are whatever the grid says and nothing stale survives
    /// — asserted at the register that now owns them.
    #[test]
    fn a_class_hour_lives_on_the_master_timetable_and_moves_when_the_cell_does() {
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        let period_id = save_timetable_period(&conn, &sample_period()).unwrap();

        save_timetable_cell(
            &conn,
            &TimetableCell {
                period_id,
                weekday: 2,
                class_id: Some(class_id),
                subject: String::new(),
                room: "203".into(),
                duty: String::new(),
                notes: String::new(),
            },
        )
        .unwrap();

        let cells = load(&conn).unwrap().timetable_cells;
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].class_id, Some(class_id));
        assert_eq!(cells[0].weekday, 2);

        // Clearing the cell leaves no row behind, so the hour reads as free.
        save_timetable_cell(
            &conn,
            &TimetableCell {
                period_id,
                weekday: 2,
                class_id: None,
                subject: String::new(),
                room: String::new(),
                duty: String::new(),
                notes: String::new(),
            },
        )
        .unwrap();
        assert!(load(&conn).unwrap().timetable_cells.is_empty());
        // The hour itself stays: it is still in the teacher's week.
        assert_eq!(load(&conn).unwrap().timetable_periods.len(), 1);
    }

    /// A cover or a duty is exactly the case a per-class timetable could not
    /// hold, and is the reason the master timetable is its own register.
    #[test]
    fn a_cell_can_hold_a_duty_with_no_class_at_all() {
        let (_dir, conn) = open();
        let period_id = save_timetable_period(&conn, &sample_period()).unwrap();
        save_timetable_cell(
            &conn,
            &TimetableCell {
                period_id,
                weekday: 5,
                class_id: None,
                subject: String::new(),
                room: String::new(),
                duty: "Εφημερία στο προαύλιο".into(),
                notes: String::new(),
            },
        )
        .unwrap();

        let cells = load(&conn).unwrap().timetable_cells;
        assert_eq!(cells.len(), 1);
        assert_eq!(cells[0].class_id, None);
        assert_eq!(cells[0].duty, "Εφημερία στο προαύλιο");
    }

    /// Renaming an hour or correcting its clock times must not disturb the
    /// lessons already placed in it.
    #[test]
    fn renaming_an_hour_leaves_every_lesson_placed_in_it_alone() {
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        let mut period = sample_period();
        period.id = save_timetable_period(&conn, &period).unwrap();
        save_timetable_cell(
            &conn,
            &TimetableCell {
                period_id: period.id,
                weekday: 2,
                class_id: Some(class_id),
                subject: String::new(),
                room: String::new(),
                duty: String::new(),
                notes: "Διπλή ώρα".into(),
            },
        )
        .unwrap();

        period.name = "4η".into();
        period.start_time = "11:10".into();
        save_timetable_period(&conn, &period).unwrap();

        let planner = load(&conn).unwrap();
        assert_eq!(planner.timetable_periods[0].name, "4η");
        assert_eq!(planner.timetable_periods[0].start_time, "11:10");
        assert_eq!(planner.timetable_cells.len(), 1);
        assert_eq!(planner.timetable_cells[0].class_id, Some(class_id));
        assert_eq!(planner.timetable_cells[0].notes, "Διπλή ώρα");
    }

    /// Deleting an hour is the teacher saying the hour is not in her week; its
    /// cells go with it. Deleting a *class* is a different statement, covered
    /// below.
    #[test]
    fn deleting_an_hour_takes_its_cells_with_it() {
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        let period_id = save_timetable_period(&conn, &sample_period()).unwrap();
        save_timetable_cell(
            &conn,
            &TimetableCell {
                period_id,
                weekday: 1,
                class_id: Some(class_id),
                subject: String::new(),
                room: String::new(),
                duty: String::new(),
                notes: String::new(),
            },
        )
        .unwrap();

        delete_timetable_period(&conn, period_id).unwrap();
        let planner = load(&conn).unwrap();
        assert!(planner.timetable_periods.is_empty());
        assert!(planner.timetable_cells.is_empty());
        assert_eq!(planner.classes.len(), 1, "the class itself is untouched");
    }

    /// Deleting a class empties the link and keeps the hour, with the cell's own
    /// duty and notes intact — the hour is still in the teacher's week.
    #[test]
    fn deleting_a_class_empties_its_cells_without_removing_the_hour() {
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        let period_id = save_timetable_period(&conn, &sample_period()).unwrap();
        save_timetable_cell(
            &conn,
            &TimetableCell {
                period_id,
                weekday: 3,
                class_id: Some(class_id),
                subject: String::new(),
                room: "203".into(),
                duty: String::new(),
                notes: "Εργαστήριο".into(),
            },
        )
        .unwrap();

        delete_class(&conn, class_id).unwrap();

        let planner = load(&conn).unwrap();
        assert_eq!(planner.timetable_periods.len(), 1);
        assert_eq!(planner.timetable_cells.len(), 1);
        assert_eq!(planner.timetable_cells[0].class_id, None);
        assert_eq!(planner.timetable_cells[0].room, "203");
        assert_eq!(planner.timetable_cells[0].notes, "Εργαστήριο");
    }

    #[test]
    fn a_lesson_plan_round_trips_and_is_keyed_by_its_monday() {
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();

        save_lesson_plan(
            &conn,
            &LessonPlan {
                class_id,
                week_monday: "2026-11-02".into(),
                notes: "Κεφάλαιο 4: εξισώσεις".into(),
                assessment: "Ολιγόλεπτο διαγώνισμα την Πέμπτη".into(),
            },
        )
        .unwrap();

        let plans = load(&conn).unwrap().lesson_plans;
        assert_eq!(plans.len(), 1);
        assert_eq!(plans[0].week_monday, "2026-11-02");
        assert_eq!(plans[0].notes, "Κεφάλαιο 4: εξισώσεις");
        assert_eq!(plans[0].assessment, "Ολιγόλεπτο διαγώνισμα την Πέμπτη");
    }

    /// Two weeks of the same class are two rows, and saving one leaves the other
    /// alone — the upsert keys on `(class, Monday)`, not on the class.
    #[test]
    fn each_week_of_a_class_is_its_own_plan() {
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        for (monday, notes) in [("2026-09-14", "Εισαγωγή"), ("2026-09-21", "Κλάσματα")]
        {
            save_lesson_plan(
                &conn,
                &LessonPlan {
                    class_id,
                    week_monday: monday.into(),
                    notes: notes.into(),
                    assessment: String::new(),
                },
            )
            .unwrap();
        }

        let plans = load(&conn).unwrap().lesson_plans;
        assert_eq!(plans.len(), 2);
        assert_eq!(plans[0].notes, "Εισαγωγή");
        assert_eq!(plans[1].notes, "Κλάσματα");
    }

    /// M3's first acceptance criterion at the storage layer: the start date is
    /// one field on one row and no other table names a week, so moving it can
    /// only re-label weeks — it cannot touch a plan or a note.
    #[test]
    fn moving_the_school_year_start_date_leaves_every_plan_and_note_where_it_was() {
        let (_dir, conn) = open();
        save_school_year(
            &conn,
            &SchoolYear {
                year_model: "sep_aug".into(),
                start_date: "2026-09-14".into(),
            },
        )
        .unwrap();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        save_lesson_plan(
            &conn,
            &LessonPlan {
                class_id,
                week_monday: "2026-11-02".into(),
                notes: "Κεφάλαιο 4".into(),
                assessment: "Τεστ".into(),
            },
        )
        .unwrap();
        for (scope, date, body) in [
            ("day", "2026-11-05", "Συνάντηση με τη μητέρα"),
            ("week", "2026-11-02", "Εβδομάδα επανάληψης"),
            ("month", "2026-11-01", "Εστίαση: ανάγνωση"),
        ] {
            save_agenda_note(
                &conn,
                &AgendaNote {
                    scope: scope.into(),
                    date: date.into(),
                    body: body.into(),
                },
            )
            .unwrap();
        }
        let before = load(&conn).unwrap();

        // The teacher realises the year actually started a week earlier, and
        // switches the model while she is in there.
        save_school_year(
            &conn,
            &SchoolYear {
                year_model: "jan_dec".into(),
                start_date: "2026-09-07".into(),
            },
        )
        .unwrap();

        let after = load(&conn).unwrap();
        assert_ne!(before.school_year, after.school_year);
        assert_eq!(
            before.lesson_plans, after.lesson_plans,
            "a plan is keyed by an actual Monday, so nothing about it can move"
        );
        assert_eq!(before.agenda_notes, after.agenda_notes);
        assert_eq!(before.timetable_periods, after.timetable_periods);
        assert_eq!(before.timetable_cells, after.timetable_cells);
    }

    /// The same rule as a cleared grade cell: emptying a record removes it, so
    /// "nothing entered for this week" is an absent row at every layer — which
    /// is what M6's progress matrix will read.
    #[test]
    fn emptying_a_plan_or_a_note_removes_the_row_rather_than_storing_a_blank() {
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        let plan = LessonPlan {
            class_id,
            week_monday: "2026-09-14".into(),
            notes: "Εισαγωγή".into(),
            assessment: String::new(),
        };
        save_lesson_plan(&conn, &plan).unwrap();
        assert_eq!(load(&conn).unwrap().lesson_plans.len(), 1);
        save_lesson_plan(
            &conn,
            &LessonPlan {
                notes: String::new(),
                ..plan
            },
        )
        .unwrap();
        assert!(load(&conn).unwrap().lesson_plans.is_empty());

        let note = AgendaNote {
            scope: "week".into(),
            date: "2026-09-14".into(),
            body: "Καλή αρχή".into(),
        };
        save_agenda_note(&conn, &note).unwrap();
        assert_eq!(load(&conn).unwrap().agenda_notes.len(), 1);
        save_agenda_note(
            &conn,
            &AgendaNote {
                body: "   ".into(),
                ..note
            },
        )
        .unwrap();
        assert!(load(&conn).unwrap().agenda_notes.is_empty());
    }

    /// Each scope keeps its own note for the same date without either standing
    /// on the other: the key is `(scope, date)`.
    #[test]
    fn the_three_agenda_scopes_are_independent_records() {
        let (_dir, conn) = open();
        for scope in ["day", "week", "month"] {
            save_agenda_note(
                &conn,
                &AgendaNote {
                    scope: scope.into(),
                    date: "2026-09-14".into(),
                    body: format!("σημείωση {scope}"),
                },
            )
            .unwrap();
        }
        let notes = load(&conn).unwrap().agenda_notes;
        assert_eq!(notes.len(), 3);
        assert_eq!(
            notes.iter().find(|n| n.scope == "week").unwrap().body,
            "σημείωση week"
        );
    }

    /// A plan for a class that is not there must be refused at write time, not
    /// left dangling — the same rule the spec sets for a student reference.
    #[test]
    fn a_plan_for_a_class_that_does_not_exist_is_refused() {
        let (_dir, conn) = open();
        let failed = save_lesson_plan(
            &conn,
            &LessonPlan {
                class_id: 9999,
                week_monday: "2026-09-14".into(),
                notes: "Κάτι".into(),
                assessment: String::new(),
            },
        );
        assert!(failed.is_err());
    }

    #[test]
    fn roster_numbers_are_handed_out_in_order_within_a_class() {
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        for _ in 0..3 {
            let student_id = save_student(&conn, &sample_student()).unwrap();
            set_enrollment(
                &conn,
                &Enrollment {
                    class_id,
                    student_id,
                    roster_no: 0,
                    support: false,
                    note: String::new(),
                },
            )
            .unwrap();
        }
        let numbers: Vec<i64> = load(&conn)
            .unwrap()
            .enrollments
            .iter()
            .map(|e| e.roster_no)
            .collect();
        assert_eq!(numbers, vec![1, 2, 3]);
    }

    /// M1's first acceptance criterion, at the storage layer: the start date is
    /// a field on one row and moving it reaches nothing else.
    #[test]
    fn moving_the_school_year_start_date_changes_no_other_record() {
        let (_dir, conn) = open();

        save_school_year(
            &conn,
            &SchoolYear {
                year_model: "sep_aug".into(),
                start_date: "2026-09-14".into(),
            },
        )
        .unwrap();
        save_grading_periods(
            &conn,
            &[GradingPeriod {
                ordinal: 1,
                name: "Πρώτη περίοδος".into(),
                start_date: "2026-09-14".into(),
                end_date: "2026-12-19".into(),
                notes: "Έλεγχος προόδου 10/12".into(),
            }],
        )
        .unwrap();
        save_holiday(
            &conn,
            &Holiday {
                id: 0,
                name: "Διακοπές Χριστουγέννων".into(),
                start_date: "2026-12-24".into(),
                end_date: "2027-01-06".into(),
                source: "ministry".into(),
                notes: String::new(),
            },
        )
        .unwrap();
        save_important_date(
            &conn,
            &ImportantDate {
                id: 0,
                name: "Συνάντηση γονέων".into(),
                date: "2026-11-05".into(),
                kind: "meeting".into(),
                notes: String::new(),
            },
        )
        .unwrap();
        save_annual_goal(
            &conn,
            &AnnualGoal {
                area: "teaching".into(),
                goal: "Περισσότερη διαφοροποίηση".into(),
                actions: "Δύο επίπεδα φύλλων εργασίας".into(),
                success_indicators: "Όλοι ολοκληρώνουν".into(),
                deadline: "2027-05-29".into(),
                status: "Σε εξέλιξη".into(),
                review: String::new(),
            },
        )
        .unwrap();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        let student_id = save_student(&conn, &sample_student()).unwrap();
        set_enrollment(
            &conn,
            &Enrollment {
                class_id,
                student_id,
                roster_no: 1,
                support: true,
                note: "Καθιστή μπροστά".into(),
            },
        )
        .unwrap();
        save_seating(
            &conn,
            class_id,
            5,
            6,
            "Ομάδες",
            &[Seat {
                class_id,
                row: 0,
                col: 1,
                student_id,
            }],
        )
        .unwrap();

        let before = load(&conn).unwrap();

        // The teacher realises the year actually started a week earlier, and
        // switches the year model at the same time.
        save_school_year(
            &conn,
            &SchoolYear {
                year_model: "jan_dec".into(),
                start_date: "2026-09-07".into(),
            },
        )
        .unwrap();

        let after = load(&conn).unwrap();
        assert_ne!(before.school_year, after.school_year);
        assert_eq!(before.grading_periods, after.grading_periods);
        assert_eq!(before.holidays, after.holidays);
        assert_eq!(before.important_dates, after.important_dates);
        assert_eq!(before.annual_goals, after.annual_goals);
        assert_eq!(before.classes, after.classes);
        assert_eq!(before.students, after.students);
        assert_eq!(before.enrollments, after.enrollments);
        assert_eq!(before.seats, after.seats);
    }

    #[test]
    fn the_six_goal_areas_are_returned_in_the_source_products_order() {
        let (_dir, conn) = open();
        let areas: Vec<String> = load(&conn)
            .unwrap()
            .annual_goals
            .into_iter()
            .map(|g| g.area)
            .collect();
        assert_eq!(areas, GOAL_AREAS.map(String::from).to_vec());
    }

    #[test]
    fn a_holiday_and_an_important_date_can_be_edited_and_deleted() {
        let (_dir, conn) = open();
        let id = save_holiday(
            &conn,
            &Holiday {
                id: 0,
                name: "Ενδιάμεσες αργίες".into(),
                start_date: "2026-10-28".into(),
                end_date: "2026-10-28".into(),
                source: "school".into(),
                notes: String::new(),
            },
        )
        .unwrap();
        save_holiday(
            &conn,
            &Holiday {
                id,
                name: "Επίσημη αργία".into(),
                start_date: "2026-10-28".into(),
                end_date: "2026-10-29".into(),
                source: "ministry".into(),
                notes: "Διήμερο".into(),
            },
        )
        .unwrap();
        let h = &load(&conn).unwrap().holidays[0];
        assert_eq!(h.name, "Επίσημη αργία");
        assert_eq!(h.source, "ministry");
        assert_eq!(h.end_date, "2026-10-29");

        delete_holiday(&conn, id).unwrap();
        assert!(load(&conn).unwrap().holidays.is_empty());
    }

    #[test]
    fn saving_a_seating_plan_replaces_the_previous_one() {
        let (_dir, conn) = open();
        let class_id = save_class(&conn, &sample_class()).unwrap();
        let a = save_student(&conn, &sample_student()).unwrap();
        let b = save_student(&conn, &sample_student()).unwrap();

        save_seating(
            &conn,
            class_id,
            5,
            6,
            "",
            &[Seat {
                class_id,
                row: 0,
                col: 0,
                student_id: a,
            }],
        )
        .unwrap();
        save_seating(
            &conn,
            class_id,
            4,
            4,
            "Κύκλος",
            &[Seat {
                class_id,
                row: 3,
                col: 3,
                student_id: b,
            }],
        )
        .unwrap();

        let planner = load(&conn).unwrap();
        assert_eq!(planner.seats.len(), 1);
        assert_eq!(planner.seats[0].student_id, b);
        assert_eq!(planner.classes[0].seating_rows, 4);
        assert_eq!(planner.classes[0].seating_cols, 4);
        assert_eq!(planner.classes[0].seating_notes, "Κύκλος");
    }
    // ------------------------------------------------------- M2: grades ---

    /// Sets up one class with one student on its roster, which is what every
    /// gradebook test below starts from.
    fn class_with_one_student(conn: &Connection) -> (i64, i64) {
        let class_id = save_class(conn, &sample_class()).unwrap();
        let student_id = save_student(conn, &sample_student()).unwrap();
        set_enrollment(
            conn,
            &Enrollment {
                class_id,
                student_id,
                roster_no: 1,
                support: false,
                note: String::new(),
            },
        )
        .unwrap();
        (class_id, student_id)
    }

    fn column(class_id: i64, label: &str, kind: &str, weight: Option<f64>) -> GradeColumn {
        GradeColumn {
            id: 0,
            class_id,
            position: 0,
            label: label.into(),
            kind: kind.into(),
            weight,
        }
    }

    #[test]
    fn a_blank_weight_survives_the_round_trip_as_blank_and_not_as_zero() {
        // The distinction the whole calculation rests on: `None` means the
        // teacher has not decided, `Some(0.0)` means she decided zero. If the
        // file collapsed them, every average over a half-weighted sheet would
        // change silently.
        let (_dir, conn) = open();
        let (class_id, _) = class_with_one_student(&conn);
        save_grade_column(&conn, &column(class_id, "Διαγώνισμα", "numeric", None)).unwrap();
        save_grade_column(&conn, &column(class_id, "Εργασία", "numeric", Some(0.0))).unwrap();

        let columns = load(&conn).unwrap().grade_columns;
        assert_eq!(columns[0].weight, None);
        assert_eq!(columns[1].weight, Some(0.0));
    }

    #[test]
    fn every_grade_type_round_trips_through_save_and_reload() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let conn = db::open_at(&path).unwrap();
        let (class_id, student_id) = class_with_one_student(&conn);

        let kinds = [
            ("numeric", "17.5"),
            ("descriptive", "b"),
            ("pass_fail", "pass"),
            (
                "comment",
                "Δούλεψε πολύ καλά — χρειάζεται λίγη στήριξη στα κλάσματα",
            ),
        ];
        for (kind, value) in kinds {
            let column_id =
                save_grade_column(&conn, &column(class_id, kind, kind, Some(25.0))).unwrap();
            set_grade_value(
                &conn,
                &GradeValue {
                    class_id,
                    column_id,
                    student_id,
                    value: value.to_string(),
                },
            )
            .unwrap();
        }
        drop(conn); // the app quits

        let conn = db::open_at(&path).unwrap();
        let planner = load(&conn).unwrap();
        let stored: Vec<&str> = planner
            .grade_values
            .iter()
            .map(|v| v.value.as_str())
            .collect();
        for (_, value) in kinds {
            assert!(stored.contains(&value), "{value} did not come back");
        }
    }

    #[test]
    fn clearing_a_cell_removes_it_rather_than_storing_an_empty_mark() {
        let (_dir, conn) = open();
        let (class_id, student_id) = class_with_one_student(&conn);
        let column_id =
            save_grade_column(&conn, &column(class_id, "Τεστ", "numeric", Some(50.0))).unwrap();
        let cell = |value: &str| GradeValue {
            class_id,
            column_id,
            student_id,
            value: value.to_string(),
        };

        set_grade_value(&conn, &cell("14")).unwrap();
        assert_eq!(load(&conn).unwrap().grade_values.len(), 1);

        set_grade_value(&conn, &cell("")).unwrap();
        assert!(
            load(&conn).unwrap().grade_values.is_empty(),
            "a cleared cell must leave no row behind, so 'no mark' is never read back as a mark"
        );
    }

    #[test]
    fn deleting_a_column_takes_its_marks_with_it_and_leaves_the_others_alone() {
        let (_dir, conn) = open();
        let (class_id, student_id) = class_with_one_student(&conn);
        let first =
            save_grade_column(&conn, &column(class_id, "Α", "numeric", Some(50.0))).unwrap();
        let second =
            save_grade_column(&conn, &column(class_id, "Β", "numeric", Some(50.0))).unwrap();
        for column_id in [first, second] {
            set_grade_value(
                &conn,
                &GradeValue {
                    class_id,
                    column_id,
                    student_id,
                    value: "12".into(),
                },
            )
            .unwrap();
        }

        delete_grade_column(&conn, first).unwrap();
        let planner = load(&conn).unwrap();
        assert_eq!(planner.grade_columns.len(), 1);
        assert_eq!(planner.grade_values.len(), 1);
        assert_eq!(planner.grade_values[0].column_id, second);
    }

    #[test]
    fn a_class_with_no_saved_settings_still_has_the_default_threshold() {
        let (_dir, conn) = open();
        let (class_id, _) = class_with_one_student(&conn);
        let grading = &load(&conn).unwrap().class_gradings[0];
        assert_eq!(grading.class_id, class_id);
        assert_eq!(grading.pass_threshold, DEFAULT_PASS_THRESHOLD);
        assert_eq!(grading.scale_max, DEFAULT_SCALE_MAX);
    }

    #[test]
    fn the_pass_threshold_round_trips_and_is_per_class() {
        let (_dir, conn) = open();
        let a = save_class(&conn, &sample_class()).unwrap();
        let mut second = sample_class();
        second.name = "Β2".into();
        let b = save_class(&conn, &second).unwrap();

        save_class_grading(
            &conn,
            &ClassGrading {
                class_id: a,
                pass_threshold: 12.0,
                scale_max: 20.0,
                period: "Α΄ τρίμηνο".into(),
            },
        )
        .unwrap();

        let gradings = load(&conn).unwrap().class_gradings;
        let for_a = gradings.iter().find(|g| g.class_id == a).unwrap();
        let for_b = gradings.iter().find(|g| g.class_id == b).unwrap();
        assert_eq!(for_a.pass_threshold, 12.0);
        assert_eq!(for_a.period, "Α΄ τρίμηνο");
        assert_eq!(
            for_b.pass_threshold, DEFAULT_PASS_THRESHOLD,
            "one class's threshold must not move another's"
        );
    }

    #[test]
    fn conduct_and_the_written_overall_result_round_trip_untouched() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let conn = db::open_at(&path).unwrap();
        let (class_id, student_id) = class_with_one_student(&conn);

        let row = GradeRow {
            class_id,
            student_id,
            conduct: "needs_support".into(),
            observations: "Δυσκολεύεται στη συγκέντρωση μετά το διάλειμμα".into(),
            overall_result: "Ικανοποιητική πορεία με περιθώρια βελτίωσης".into(),
        };
        save_grade_row(&conn, &row).unwrap();
        drop(conn);

        let conn = db::open_at(&path).unwrap();
        assert_eq!(load(&conn).unwrap().grade_rows, vec![row]);
    }

    #[test]
    fn a_mark_cannot_be_written_against_a_student_who_is_not_there() {
        // The same rule M1 established for roster rows, now for cells: an
        // orphaned reference is rejected at write time rather than dangling.
        let (_dir, conn) = open();
        let (class_id, _) = class_with_one_student(&conn);
        let column_id =
            save_grade_column(&conn, &column(class_id, "Τεστ", "numeric", Some(50.0))).unwrap();

        let orphan = set_grade_value(
            &conn,
            &GradeValue {
                class_id,
                column_id,
                student_id: 9999,
                value: "10".into(),
            },
        );
        assert!(orphan.is_err());
    }

    #[test]
    fn deleting_a_student_takes_her_marks_and_her_conduct_with_her() {
        let (_dir, conn) = open();
        let (class_id, student_id) = class_with_one_student(&conn);
        let column_id =
            save_grade_column(&conn, &column(class_id, "Τεστ", "numeric", Some(50.0))).unwrap();
        set_grade_value(
            &conn,
            &GradeValue {
                class_id,
                column_id,
                student_id,
                value: "18".into(),
            },
        )
        .unwrap();
        save_grade_row(
            &conn,
            &GradeRow {
                class_id,
                student_id,
                conduct: "good".into(),
                observations: String::new(),
                overall_result: String::new(),
            },
        )
        .unwrap();

        delete_student(&conn, student_id).unwrap();
        let planner = load(&conn).unwrap();
        assert!(planner.grade_values.is_empty());
        assert!(planner.grade_rows.is_empty());
        assert_eq!(planner.grade_columns.len(), 1, "the column is the class's");
    }

    #[test]
    fn deleting_a_class_takes_its_whole_gradebook_with_it() {
        let (_dir, conn) = open();
        let (class_id, student_id) = class_with_one_student(&conn);
        let column_id =
            save_grade_column(&conn, &column(class_id, "Τεστ", "numeric", Some(50.0))).unwrap();
        set_grade_value(
            &conn,
            &GradeValue {
                class_id,
                column_id,
                student_id,
                value: "18".into(),
            },
        )
        .unwrap();
        save_class_grading(&conn, &ClassGrading::default_for(class_id)).unwrap();

        delete_class(&conn, class_id).unwrap();
        let planner = load(&conn).unwrap();
        assert!(planner.grade_columns.is_empty());
        assert!(planner.grade_values.is_empty());
        assert!(planner.class_gradings.is_empty());
        assert_eq!(planner.students.len(), 1, "the student is the year's");
    }

    #[test]
    fn columns_come_back_in_the_order_they_were_added_within_each_class() {
        let (_dir, conn) = open();
        let a = save_class(&conn, &sample_class()).unwrap();
        let mut second = sample_class();
        second.name = "Β2".into();
        let b = save_class(&conn, &second).unwrap();

        for label in ["Πρώτο", "Δεύτερο", "Τρίτο"] {
            save_grade_column(&conn, &column(a, label, "numeric", None)).unwrap();
        }
        save_grade_column(&conn, &column(b, "Μόνο", "numeric", None)).unwrap();

        let columns = load(&conn).unwrap().grade_columns;
        let for_a: Vec<&str> = columns
            .iter()
            .filter(|c| c.class_id == a)
            .map(|c| c.label.as_str())
            .collect();
        assert_eq!(for_a, vec!["Πρώτο", "Δεύτερο", "Τρίτο"]);
        assert_eq!(columns.iter().filter(|c| c.class_id == b).count(), 1);
    }

    // ------------------------- M4: attendance, behaviour and support ---

    /// A class with one student on its roster, which every M4 test needs.
    fn class_with_student(conn: &Connection) -> (i64, i64) {
        let class_id = save_class(conn, &tests_support::sample_class()).unwrap();
        let student_id = save_student(conn, &tests_support::sample_student()).unwrap();
        set_enrollment(
            conn,
            &Enrollment {
                class_id,
                student_id,
                roster_no: 1,
                support: false,
                note: String::new(),
            },
        )
        .unwrap();
        (class_id, student_id)
    }

    fn an_event(class_id: i64, student_id: i64) -> AbsenceEvent {
        AbsenceEvent {
            id: 0,
            class_id,
            student_id,
            date: "2026-11-05".into(),
            kind: "late".into(),
            clock_time: "08:35".into(),
            teaching_hour: "1η".into(),
            reason: "Καθυστέρηση λεωφορείου".into(),
            justified: true,
            follow_up: "informed".into(),
            frequent_note: "Τρίτη φορά αυτόν τον μήνα".into(),
        }
    }

    /// **M4's first acceptance criterion, at the storage layer.**
    ///
    /// The monthly grid and the detailed register are independent: the same
    /// student on the same date is marked `present` in one and logged as a late
    /// arrival in the other, and neither write disturbs the other. Nothing in
    /// the app derives one from the other, so this is what "both stand" means
    /// on disk.
    #[test]
    fn the_attendance_grid_and_the_absence_log_hold_different_data_for_one_student_and_date() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::db::open_at(&dir.path().join("planner.sqlite")).unwrap();
        let (class_id, student_id) = class_with_student(&conn);
        let date = "2026-11-05";

        // The grid says she was there.
        save_attendance_mark(
            &conn,
            &AttendanceMark {
                class_id,
                student_id,
                date: date.into(),
                state: "present".into(),
            },
        )
        .unwrap();
        // The register says she arrived late, justified, parents informed.
        save_absence_event(&conn, &an_event(class_id, student_id)).unwrap();

        let planner = load(&conn).unwrap();
        assert_eq!(planner.attendance_marks.len(), 1);
        assert_eq!(planner.attendance_marks[0].state, "present");
        assert_eq!(planner.absence_events.len(), 1);
        assert_eq!(planner.absence_events[0].kind, "late");
        assert_eq!(planner.absence_events[0].date, date);

        // Changing the grid cell leaves the event byte-for-byte alone …
        let event_before = planner.absence_events[0].clone();
        save_attendance_mark(
            &conn,
            &AttendanceMark {
                class_id,
                student_id,
                date: date.into(),
                state: "absent".into(),
            },
        )
        .unwrap();
        let planner = load(&conn).unwrap();
        assert_eq!(planner.absence_events, vec![event_before.clone()]);
        assert_eq!(planner.attendance_marks[0].state, "absent");

        // … and editing the event leaves the grid cell alone.
        save_absence_event(
            &conn,
            &AbsenceEvent {
                reason: "Ιατρικό ραντεβού".into(),
                ..event_before.clone()
            },
        )
        .unwrap();
        let planner = load(&conn).unwrap();
        assert_eq!(planner.attendance_marks[0].state, "absent");
        assert_eq!(planner.absence_events[0].reason, "Ιατρικό ραντεβού");

        // Deleting the event does not remove the mark, and clearing the mark
        // does not remove an event. Neither is derived from the other.
        delete_absence_event(&conn, event_before.id).unwrap();
        let planner = load(&conn).unwrap();
        assert!(planner.absence_events.is_empty());
        assert_eq!(planner.attendance_marks.len(), 1, "the grid cell survives");

        save_absence_event(&conn, &an_event(class_id, student_id)).unwrap();
        save_attendance_mark(
            &conn,
            &AttendanceMark {
                class_id,
                student_id,
                date: date.into(),
                state: String::new(),
            },
        )
        .unwrap();
        let planner = load(&conn).unwrap();
        assert!(
            planner.attendance_marks.is_empty(),
            "an emptied cell is deleted"
        );
        assert_eq!(planner.absence_events.len(), 1, "the event survives");
    }

    /// The schema itself carries no month, no year and no day-of-month column,
    /// so the month grid cannot be anything but a view over actual dates. This
    /// is the same check M1 and M3 make for week numbers, at the table M4 was
    /// most likely to key by the column it prints.
    #[test]
    fn no_attendance_column_is_a_month_a_year_or_a_day_index() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::db::open_at(&dir.path().join("planner.sqlite")).unwrap();
        let columns: Vec<String> = collect(
            &conn,
            "SELECT name FROM pragma_table_info('attendance_mark')",
            |r| r.get(0),
        )
        .unwrap();
        assert_eq!(columns, vec!["class_id", "student_id", "date", "state"]);
    }

    /// The other half of the date rule: moving the school year's start date
    /// leaves every M4 record exactly where it was, because none of them knows
    /// a week or a month number.
    #[test]
    fn moving_the_school_year_start_date_leaves_every_m4_record_where_it_was() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::db::open_at(&dir.path().join("planner.sqlite")).unwrap();
        let (class_id, student_id) = class_with_student(&conn);

        save_attendance_mark(
            &conn,
            &AttendanceMark {
                class_id,
                student_id,
                date: "2026-11-05".into(),
                state: "absent".into(),
            },
        )
        .unwrap();
        save_absence_event(&conn, &an_event(class_id, student_id)).unwrap();
        save_incident(
            &conn,
            &Incident {
                id: 0,
                student_id,
                class_id: Some(class_id),
                date: "2026-11-05".into(),
                what_happened: "Διαφωνία στο διάλειμμα".into(),
                action_taken: "Συζήτηση με τους δύο μαθητές".into(),
                parents_informed: true,
            },
        )
        .unwrap();
        let plan_id = save_support_plan(&conn, &a_plan(student_id)).unwrap();
        save_support_goal(&conn, &a_goal(plan_id)).unwrap();

        let before = load(&conn).unwrap();
        save_school_year(
            &conn,
            &SchoolYear {
                year_model: "feb_dec".into(),
                start_date: "2026-09-07".into(),
            },
        )
        .unwrap();
        let after = load(&conn).unwrap();

        assert_eq!(before.attendance_marks, after.attendance_marks);
        assert_eq!(before.absence_events, after.absence_events);
        assert_eq!(before.incidents, after.incidents);
        assert_eq!(before.support_plans, after.support_plans);
        assert_eq!(before.support_goals, after.support_goals);
    }

    fn a_plan(student_id: i64) -> SupportPlan {
        SupportPlan {
            id: 0,
            student_id,
            position: 0,
            start_date: "2026-10-01".into(),
            monitoring_frequency: "Κάθε δεύτερη εβδομάδα".into(),
            strengths: "Ισχυρή προφορική έκφραση".into(),
            needs: "Δυσκολία στην αποκωδικοποίηση".into(),
            accommodations: "Επιπλέον χρόνος, μεγαλύτερη γραμματοσειρά".into(),
            collaboration: "Συνεργασία με τη λογοθεραπεύτρια".into(),
            status: "Σε εφαρμογή — αναθεώρηση τον Ιανουάριο".into(),
            next_review: "2027-01-15".into(),
        }
    }

    fn a_goal(plan_id: i64) -> SupportGoal {
        SupportGoal {
            id: 0,
            plan_id,
            position: 0,
            goal: "Ανάγνωση κειμένου 80 λέξεων χωρίς βοήθεια".into(),
            progress: "in_progress".into(),
            monitored_on: "2026-11-20".into(),
        }
    }

    /// **M4's second acceptance criterion, at the storage layer.**
    ///
    /// A plan's `status` is teacher-written and never computed. Writing a goal —
    /// adding one, rating one, dating one, deleting one — cannot reach it,
    /// because `save_support_goal` names only `support_goal`.
    #[test]
    fn a_plans_status_is_never_touched_by_writing_its_goals() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::db::open_at(&dir.path().join("planner.sqlite")).unwrap();
        let (_class_id, student_id) = class_with_student(&conn);
        let plan_id = save_support_plan(&conn, &a_plan(student_id)).unwrap();
        let written = load(&conn).unwrap().support_plans[0].clone();
        assert_eq!(written.status, "Σε εφαρμογή — αναθεώρηση τον Ιανουάριο");

        // Add a goal.
        let goal_id = save_support_goal(&conn, &a_goal(plan_id)).unwrap();
        assert_eq!(load(&conn).unwrap().support_plans, vec![written.clone()]);

        // Rate it as fully met — the rating a naive implementation would be
        // tempted to roll up into the plan's status.
        save_support_goal(
            &conn,
            &SupportGoal {
                id: goal_id,
                progress: "met".into(),
                ..a_goal(plan_id)
            },
        )
        .unwrap();
        assert_eq!(load(&conn).unwrap().support_plans, vec![written.clone()]);

        // Add a second goal and delete the first.
        save_support_goal(&conn, &a_goal(plan_id)).unwrap();
        delete_support_goal(&conn, goal_id).unwrap();
        let after = load(&conn).unwrap();
        assert_eq!(after.support_plans, vec![written.clone()]);
        assert_eq!(after.support_goals.len(), 1);

        // And with every goal gone, the status still says what she typed.
        delete_support_goal(&conn, after.support_goals[0].id).unwrap();
        let after = load(&conn).unwrap();
        assert!(after.support_goals.is_empty());
        assert_eq!(after.support_plans, vec![written]);
    }

    /// Every M4 field survives a save and a reload, the same round-trip M1's
    /// third criterion asks of the student card.
    #[test]
    fn every_m4_field_round_trips() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let conn = crate::db::open_at(&path).unwrap();
        let (class_id, student_id) = class_with_student(&conn);

        save_absence_event(&conn, &an_event(class_id, student_id)).unwrap();
        let incident = Incident {
            id: 0,
            student_id,
            class_id: None,
            date: "2026-12-01".into(),
            what_happened: "Άρνηση συμμετοχής στην ομαδική εργασία".into(),
            action_taken: "Αλλαγή ομάδας και σύντομη συζήτηση".into(),
            parents_informed: false,
        };
        save_incident(&conn, &incident).unwrap();
        let plan_id = save_support_plan(&conn, &a_plan(student_id)).unwrap();
        save_support_goal(&conn, &a_goal(plan_id)).unwrap();
        drop(conn);

        // Reopened from disk, as a relaunch would.
        let conn = crate::db::open_at(&path).unwrap();
        let planner = load(&conn).unwrap();

        let e = &planner.absence_events[0];
        assert_eq!(e.date, "2026-11-05");
        assert_eq!(e.kind, "late");
        assert_eq!(e.clock_time, "08:35");
        assert_eq!(e.teaching_hour, "1η");
        assert_eq!(e.reason, "Καθυστέρηση λεωφορείου");
        assert!(e.justified);
        assert_eq!(e.follow_up, "informed");
        assert_eq!(e.frequent_note, "Τρίτη φορά αυτόν τον μήνα");

        let i = &planner.incidents[0];
        assert_eq!(i.class_id, None, "an incident need not belong to a class");
        assert_eq!(i.what_happened, "Άρνηση συμμετοχής στην ομαδική εργασία");
        assert_eq!(i.action_taken, "Αλλαγή ομάδας και σύντομη συζήτηση");
        assert!(!i.parents_informed);

        let p = &planner.support_plans[0];
        assert_eq!(p.start_date, "2026-10-01");
        assert_eq!(p.monitoring_frequency, "Κάθε δεύτερη εβδομάδα");
        assert_eq!(p.strengths, "Ισχυρή προφορική έκφραση");
        assert_eq!(p.needs, "Δυσκολία στην αποκωδικοποίηση");
        assert_eq!(
            p.accommodations,
            "Επιπλέον χρόνος, μεγαλύτερη γραμματοσειρά"
        );
        assert_eq!(p.collaboration, "Συνεργασία με τη λογοθεραπεύτρια");
        assert_eq!(p.status, "Σε εφαρμογή — αναθεώρηση τον Ιανουάριο");
        assert_eq!(p.next_review, "2027-01-15");

        let g = &planner.support_goals[0];
        assert_eq!(g.goal, "Ανάγνωση κειμένου 80 λέξεων χωρίς βοήθεια");
        assert_eq!(g.progress, "in_progress");
        assert_eq!(g.monitored_on, "2026-11-20");
    }

    /// A blank absence event, incident, plan and goal are all **kept**, unlike
    /// an emptied attendance cell. The teacher pressed a button to create them
    /// and is about to type into them; deleting them on save would make a new
    /// record vanish the instant it appeared.
    #[test]
    fn a_blank_new_record_is_kept_even_though_an_emptied_grid_cell_is_deleted() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::db::open_at(&dir.path().join("planner.sqlite")).unwrap();
        let (class_id, student_id) = class_with_student(&conn);

        save_absence_event(
            &conn,
            &AbsenceEvent {
                id: 0,
                class_id,
                student_id,
                date: String::new(),
                kind: "absence".into(),
                clock_time: String::new(),
                teaching_hour: String::new(),
                reason: String::new(),
                justified: false,
                follow_up: String::new(),
                frequent_note: String::new(),
            },
        )
        .unwrap();
        save_incident(
            &conn,
            &Incident {
                id: 0,
                student_id,
                class_id: None,
                date: String::new(),
                what_happened: String::new(),
                action_taken: String::new(),
                parents_informed: false,
            },
        )
        .unwrap();
        let plan_id = save_support_plan(
            &conn,
            &SupportPlan {
                id: 0,
                student_id,
                position: 0,
                start_date: String::new(),
                monitoring_frequency: String::new(),
                strengths: String::new(),
                needs: String::new(),
                accommodations: String::new(),
                collaboration: String::new(),
                status: String::new(),
                next_review: String::new(),
            },
        )
        .unwrap();
        save_support_goal(
            &conn,
            &SupportGoal {
                id: 0,
                plan_id,
                position: 0,
                goal: String::new(),
                progress: String::new(),
                monitored_on: String::new(),
            },
        )
        .unwrap();

        let planner = load(&conn).unwrap();
        assert_eq!(planner.absence_events.len(), 1);
        assert_eq!(planner.incidents.len(), 1);
        assert_eq!(planner.support_plans.len(), 1);
        assert_eq!(planner.support_goals.len(), 1);
    }

    /// Deleting a class empties an incident's optional class link but keeps the
    /// incident, because the incident belongs to the student and something did
    /// happen. Its absence events and attendance marks, which are per class,
    /// go with the class.
    #[test]
    fn deleting_a_class_keeps_the_incident_and_empties_its_link() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::db::open_at(&dir.path().join("planner.sqlite")).unwrap();
        let (class_id, student_id) = class_with_student(&conn);
        save_attendance_mark(
            &conn,
            &AttendanceMark {
                class_id,
                student_id,
                date: "2026-11-05".into(),
                state: "absent".into(),
            },
        )
        .unwrap();
        save_absence_event(&conn, &an_event(class_id, student_id)).unwrap();
        save_incident(
            &conn,
            &Incident {
                id: 0,
                student_id,
                class_id: Some(class_id),
                date: "2026-11-05".into(),
                what_happened: "Διαφωνία στο διάλειμμα".into(),
                action_taken: "Συζήτηση".into(),
                parents_informed: true,
            },
        )
        .unwrap();

        delete_class(&conn, class_id).unwrap();
        let planner = load(&conn).unwrap();
        assert!(planner.attendance_marks.is_empty());
        assert!(planner.absence_events.is_empty());
        assert_eq!(planner.incidents.len(), 1, "the incident still happened");
        assert_eq!(planner.incidents[0].class_id, None);
        assert_eq!(planner.incidents[0].what_happened, "Διαφωνία στο διάλειμμα");
    }

    /// Deleting a student takes her support plans and their goals with her, so
    /// nothing is left pointing at a student who is not there.
    #[test]
    fn deleting_a_student_cascades_through_her_plans_to_their_goals() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::db::open_at(&dir.path().join("planner.sqlite")).unwrap();
        let (_class_id, student_id) = class_with_student(&conn);
        let plan_id = save_support_plan(&conn, &a_plan(student_id)).unwrap();
        save_support_goal(&conn, &a_goal(plan_id)).unwrap();

        delete_student(&conn, student_id).unwrap();
        let planner = load(&conn).unwrap();
        assert!(planner.support_plans.is_empty());
        assert!(planner.support_goals.is_empty());
        assert!(planner.incidents.is_empty());
    }

    /// The file refuses an attendance state it does not know, so a typo cannot
    /// be read back as a fifth kind of day.
    #[test]
    fn the_file_refuses_an_attendance_state_it_does_not_know() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::db::open_at(&dir.path().join("planner.sqlite")).unwrap();
        let (class_id, student_id) = class_with_student(&conn);
        let bad = conn.execute(
            "INSERT INTO attendance_mark (class_id, student_id, date, state)
             VALUES (?1, ?2, '2026-11-05', 'maybe')",
            params![class_id, student_id],
        );
        assert!(bad.is_err());
    }

    /// Several plans per student, each with their own goals, and a new plan
    /// lands on the end of that student's list rather than on another's.
    #[test]
    fn a_student_can_hold_several_plans_each_with_their_own_goals() {
        let dir = tempfile::tempdir().unwrap();
        let conn = crate::db::open_at(&dir.path().join("planner.sqlite")).unwrap();
        let (_class_id, student_id) = class_with_student(&conn);

        let first = save_support_plan(&conn, &a_plan(student_id)).unwrap();
        let second = save_support_plan(
            &conn,
            &SupportPlan {
                status: "Ολοκληρώθηκε".into(),
                ..a_plan(student_id)
            },
        )
        .unwrap();
        save_support_goal(&conn, &a_goal(first)).unwrap();
        save_support_goal(&conn, &a_goal(second)).unwrap();
        save_support_goal(&conn, &a_goal(second)).unwrap();

        let planner = load(&conn).unwrap();
        assert_eq!(planner.support_plans.len(), 2);
        assert_eq!(planner.support_plans[0].position, 0);
        assert_eq!(planner.support_plans[1].position, 1);
        assert_eq!(
            planner
                .support_goals
                .iter()
                .filter(|g| g.plan_id == second)
                .count(),
            2
        );
        // Deleting the second plan takes only its own goals.
        delete_support_plan(&conn, second).unwrap();
        let planner = load(&conn).unwrap();
        assert_eq!(planner.support_plans.len(), 1);
        assert_eq!(planner.support_goals.len(), 1);
        assert_eq!(planner.support_goals[0].plan_id, first);
    }
}
