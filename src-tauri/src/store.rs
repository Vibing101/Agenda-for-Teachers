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
    let mut classes: Vec<Class> = collect(
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
                slots: Vec::new(),
            })
        },
    )?;

    let slots: Vec<ClassSlot> = collect(
        conn,
        "SELECT id, class_id, weekday, period_label, start_time, end_time, room
           FROM class_slot ORDER BY weekday, start_time, id",
        |r| {
            Ok(ClassSlot {
                id: r.get(0)?,
                class_id: r.get(1)?,
                weekday: r.get(2)?,
                period_label: r.get(3)?,
                start_time: r.get(4)?,
                end_time: r.get(5)?,
                room: r.get(6)?,
            })
        },
    )?;
    for slot in slots {
        if let Some(class) = classes.iter_mut().find(|c| c.id == slot.class_id) {
            class.slots.push(slot);
        }
    }
    Ok(classes)
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

/// Inserts or updates a class along with its timetable slots.
///
/// Slots are replaced wholesale rather than diffed: there are a handful per
/// class, the whole thing arrives from one form, and replacing avoids the class
/// of bug where a removed row quietly survives.
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

    conn.execute("DELETE FROM class_slot WHERE class_id = ?1", [id])?;
    for slot in &c.slots {
        conn.execute(
            "INSERT INTO class_slot (class_id, weekday, period_label, start_time, end_time, room)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                id,
                slot.weekday,
                slot.period_label,
                slot.start_time,
                slot.end_time,
                slot.room
            ],
        )?;
    }
    Ok(id)
}

/// Deletes a class. Its slots, roster rows and seats go with it; the students
/// themselves stay, because they belong to the teacher's year, not to a class.
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
            slots: vec![ClassSlot {
                id: 0,
                class_id: 0,
                weekday: 2,
                period_label: "3η".into(),
                start_time: "10:15".into(),
                end_time: "11:00".into(),
                room: "203".into(),
            }],
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

    #[test]
    fn saving_a_class_replaces_its_timetable_slots_rather_than_appending() {
        let (_dir, conn) = open();
        let mut class = sample_class();
        class.id = save_class(&conn, &class).unwrap();
        assert_eq!(load(&conn).unwrap().classes[0].slots.len(), 1);

        class.slots.clear();
        save_class(&conn, &class).unwrap();
        assert!(load(&conn).unwrap().classes[0].slots.is_empty());
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
}
