//! The SQLite data file: opening it, and migrating its schema.
//!
//! Two choices here are about surviving a cloud-synced folder rather than about
//! raw speed:
//!
//! * `journal_mode = DELETE` (not WAL). WAL leaves `-wal`/`-shm` sidecar files
//!   holding committed data; a sync client that uploads `planner.sqlite` without
//!   them — or at a different moment — would carry a torn database to the other
//!   device. In DELETE mode the file is self-contained at rest.
//! * `synchronous = FULL`, so a commit is on disk before we report success,
//!   since the app can be quit or the machine slept at any point.
//!
//! Connections are opened per operation and closed again rather than held for
//! the session: it keeps the on-disk file the single source of truth, which is
//! what makes the change-detection check in `fingerprint` meaningful.

use crate::error::AppResult;
use crate::model::GOAL_AREAS;
use rusqlite::{params, Connection};
use std::path::Path;

pub const SCHEMA_VERSION: i64 = 6;

pub fn open_at(db_path: &Path) -> AppResult<Connection> {
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(db_path)?;
    conn.pragma_update(None, "journal_mode", "DELETE")?;
    conn.pragma_update(None, "synchronous", "FULL")?;
    conn.pragma_update(None, "foreign_keys", "ON")?;
    migrate(&conn)?;
    Ok(conn)
}

pub fn open() -> AppResult<Connection> {
    open_at(&crate::paths::db_path())
}

/// Applies every migration the file has not seen yet, in order.
///
/// Each step is kept as it was written, including M0's — a file created by the
/// signed-off M0 build is at `user_version = 1` and must climb from there, so
/// history is added to rather than edited.
fn migrate(conn: &Connection) -> AppResult<()> {
    let mut current: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if current < 1 {
        migrate_to_1(conn)?;
        conn.pragma_update(None, "user_version", 1)?;
        current = 1;
    }
    if current < 2 {
        migrate_to_2(conn)?;
        conn.pragma_update(None, "user_version", 2)?;
        current = 2;
    }
    if current < 3 {
        migrate_to_3(conn)?;
        conn.pragma_update(None, "user_version", 3)?;
        current = 3;
    }
    if current < 4 {
        migrate_to_4(conn)?;
        conn.pragma_update(None, "user_version", 4)?;
        current = 4;
    }
    if current < 5 {
        migrate_to_5(conn)?;
        conn.pragma_update(None, "user_version", 5)?;
        current = 5;
    }
    if current < 6 {
        migrate_to_6(conn)?;
        conn.pragma_update(None, "user_version", 6)?;
    }
    Ok(())
}

/// M0. `scratch_note` was a persistence probe so that milestone's "write data,
/// quit, relaunch, data is still there" criterion had a real write path to test
/// against. M1 drops it — see [`migrate_to_2`].
fn migrate_to_1(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "BEGIN;
         CREATE TABLE IF NOT EXISTS scratch_note (
             id         INTEGER PRIMARY KEY CHECK (id = 1),
             body       TEXT NOT NULL DEFAULT '',
             updated_at TEXT NOT NULL DEFAULT (datetime('now'))
         );
         INSERT OR IGNORE INTO scratch_note (id, body) VALUES (1, '');
         COMMIT;",
    )?;
    Ok(())
}

/// M1 — school year, classes, students.
///
/// Three things are worth reading twice:
///
/// * **Nothing is keyed by week index.** `start_date`, `date`, `birth_date` and
///   the period/holiday ranges are all real dates, so moving the school year's
///   start date re-derives week numbers for display and touches no stored row.
/// * **`enrollment` is a join table**, so one student can sit in several
///   classes at once with a per-class support flag and note.
/// * **Foreign keys cascade on delete and are enforced** (`foreign_keys = ON`
///   in `open_at`), so a roster or seat row can never be written against a
///   student who is not there — the spec asks for that to be rejected at write
///   time rather than left dangling.
fn migrate_to_2(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "BEGIN;

         DROP TABLE IF EXISTS scratch_note;

         CREATE TABLE school_year (
             id          INTEGER PRIMARY KEY CHECK (id = 1),
             year_model  TEXT NOT NULL DEFAULT 'sep_aug',
             start_date  TEXT NOT NULL DEFAULT ''
         );
         INSERT OR IGNORE INTO school_year (id) VALUES (1);

         CREATE TABLE grading_period (
             ordinal    INTEGER PRIMARY KEY CHECK (ordinal BETWEEN 1 AND 3),
             name       TEXT NOT NULL DEFAULT '',
             start_date TEXT NOT NULL DEFAULT '',
             end_date   TEXT NOT NULL DEFAULT '',
             notes      TEXT NOT NULL DEFAULT ''
         );
         INSERT OR IGNORE INTO grading_period (ordinal) VALUES (1), (2), (3);

         CREATE TABLE holiday (
             id         INTEGER PRIMARY KEY,
             name       TEXT NOT NULL DEFAULT '',
             start_date TEXT NOT NULL DEFAULT '',
             end_date   TEXT NOT NULL DEFAULT '',
             source     TEXT NOT NULL DEFAULT 'ministry',
             notes      TEXT NOT NULL DEFAULT ''
         );

         CREATE TABLE important_date (
             id    INTEGER PRIMARY KEY,
             name  TEXT NOT NULL DEFAULT '',
             date  TEXT NOT NULL DEFAULT '',
             kind  TEXT NOT NULL DEFAULT 'other',
             notes TEXT NOT NULL DEFAULT ''
         );

         CREATE TABLE annual_goal (
             area               TEXT PRIMARY KEY,
             goal               TEXT NOT NULL DEFAULT '',
             actions            TEXT NOT NULL DEFAULT '',
             success_indicators TEXT NOT NULL DEFAULT '',
             deadline           TEXT NOT NULL DEFAULT '',
             status             TEXT NOT NULL DEFAULT '',
             review             TEXT NOT NULL DEFAULT ''
         );

         CREATE TABLE class (
             id            INTEGER PRIMARY KEY,
             name          TEXT NOT NULL DEFAULT '',
             subject       TEXT NOT NULL DEFAULT '',
             room          TEXT NOT NULL DEFAULT '',
             responsible   TEXT NOT NULL DEFAULT '',
             notes         TEXT NOT NULL DEFAULT '',
             position      INTEGER NOT NULL DEFAULT 0,
             seating_rows  INTEGER NOT NULL DEFAULT 5,
             seating_cols  INTEGER NOT NULL DEFAULT 6,
             seating_notes TEXT NOT NULL DEFAULT ''
         );

         CREATE TABLE class_slot (
             id           INTEGER PRIMARY KEY,
             class_id     INTEGER NOT NULL REFERENCES class(id) ON DELETE CASCADE,
             weekday      INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 6),
             period_label TEXT NOT NULL DEFAULT '',
             start_time   TEXT NOT NULL DEFAULT '',
             end_time     TEXT NOT NULL DEFAULT '',
             room         TEXT NOT NULL DEFAULT ''
         );
         CREATE INDEX class_slot_by_class ON class_slot(class_id);

         CREATE TABLE student (
             id                 INTEGER PRIMARY KEY,
             full_name          TEXT NOT NULL DEFAULT '',
             register_number    TEXT NOT NULL DEFAULT '',
             birth_date         TEXT NOT NULL DEFAULT '',
             home_language      TEXT NOT NULL DEFAULT '',
             address            TEXT NOT NULL DEFAULT '',
             midyear_enrollment INTEGER NOT NULL DEFAULT 0,
             guardian1_name     TEXT NOT NULL DEFAULT '',
             guardian1_phone    TEXT NOT NULL DEFAULT '',
             guardian1_email    TEXT NOT NULL DEFAULT '',
             guardian2_name     TEXT NOT NULL DEFAULT '',
             guardian2_phone    TEXT NOT NULL DEFAULT '',
             guardian2_email    TEXT NOT NULL DEFAULT '',
             allergies          TEXT NOT NULL DEFAULT '',
             conditions         TEXT NOT NULL DEFAULT '',
             medication         TEXT NOT NULL DEFAULT '',
             emergency_phone    TEXT NOT NULL DEFAULT '',
             sen_status         TEXT NOT NULL DEFAULT 'none',
             sen_plan           TEXT NOT NULL DEFAULT '',
             sen_accommodations TEXT NOT NULL DEFAULT '',
             notes              TEXT NOT NULL DEFAULT '',
             meeting_notes      TEXT NOT NULL DEFAULT ''
         );

         CREATE TABLE enrollment (
             class_id   INTEGER NOT NULL REFERENCES class(id)   ON DELETE CASCADE,
             student_id INTEGER NOT NULL REFERENCES student(id) ON DELETE CASCADE,
             roster_no  INTEGER NOT NULL DEFAULT 0,
             support    INTEGER NOT NULL DEFAULT 0,
             note       TEXT    NOT NULL DEFAULT '',
             PRIMARY KEY (class_id, student_id)
         );
         CREATE INDEX enrollment_by_student ON enrollment(student_id);

         CREATE TABLE seat (
             class_id   INTEGER NOT NULL REFERENCES class(id)   ON DELETE CASCADE,
             row        INTEGER NOT NULL,
             col        INTEGER NOT NULL,
             student_id INTEGER NOT NULL REFERENCES student(id) ON DELETE CASCADE,
             PRIMARY KEY (class_id, row, col)
         );
         CREATE INDEX seat_by_student ON seat(student_id);

         COMMIT;",
    )?;

    // The six goal areas are a fixed set, so they are rows from the start
    // rather than something the teacher creates.
    let mut insert = conn.prepare("INSERT OR IGNORE INTO annual_goal (area) VALUES (?1)")?;
    for area in GOAL_AREAS {
        insert.execute([area])?;
    }
    Ok(())
}

/// M2 — the gradebook, conduct, and the per-class grading settings.
///
/// Three things are worth reading twice:
///
/// * **`grade_column.weight` is the only nullable column M2 adds.** A
///   `NULL` weight means the teacher has not decided it yet and the column
///   takes no part in the average; `0` means she decided it is worth nothing,
///   which keeps it in and can trigger the plain-average fallback. Storing a
///   blank as `0` would silently change results, so the distinction is carried
///   all the way down to the file.
/// * **A cell is text, whatever the column's type.** Marks, the descriptive
///   Α–Δ codes, pass/fail and free comments share one table; turning a numeric
///   cell into a number is the calculation's job, so a typo can never be
///   rounded into a mark at write time.
/// * **The grading settings are their own table, keyed by class.** They belong
///   to the gradebook rather than to the class list, and keeping them out of
///   `class` leaves M1's table and its round-trip tests untouched. A class with
///   no row here is read back with the defaults.
fn migrate_to_3(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "BEGIN;

         CREATE TABLE class_grading (
             class_id       INTEGER PRIMARY KEY REFERENCES class(id) ON DELETE CASCADE,
             pass_threshold REAL NOT NULL DEFAULT 10,
             scale_max      REAL NOT NULL DEFAULT 20,
             period         TEXT NOT NULL DEFAULT ''
         );

         CREATE TABLE grade_column (
             id       INTEGER PRIMARY KEY,
             class_id INTEGER NOT NULL REFERENCES class(id) ON DELETE CASCADE,
             position INTEGER NOT NULL DEFAULT 0,
             label    TEXT NOT NULL DEFAULT '',
             kind     TEXT NOT NULL DEFAULT 'numeric',
             weight   REAL
         );
         CREATE INDEX grade_column_by_class ON grade_column(class_id);

         CREATE TABLE grade_value (
             class_id   INTEGER NOT NULL REFERENCES class(id)        ON DELETE CASCADE,
             column_id  INTEGER NOT NULL REFERENCES grade_column(id) ON DELETE CASCADE,
             student_id INTEGER NOT NULL REFERENCES student(id)      ON DELETE CASCADE,
             value      TEXT NOT NULL DEFAULT '',
             PRIMARY KEY (column_id, student_id)
         );
         CREATE INDEX grade_value_by_student ON grade_value(student_id);
         CREATE INDEX grade_value_by_class ON grade_value(class_id);

         CREATE TABLE grade_row (
             class_id       INTEGER NOT NULL REFERENCES class(id)   ON DELETE CASCADE,
             student_id     INTEGER NOT NULL REFERENCES student(id) ON DELETE CASCADE,
             conduct        TEXT NOT NULL DEFAULT '',
             observations   TEXT NOT NULL DEFAULT '',
             overall_result TEXT NOT NULL DEFAULT '',
             PRIMARY KEY (class_id, student_id)
         );
         CREATE INDEX grade_row_by_student ON grade_row(student_id);

         COMMIT;",
    )?;
    Ok(())
}

/// M3 — the master timetable, weekly lesson plans, and agenda notes.
///
/// Four things are worth reading twice:
///
/// * **The master timetable replaces `class_slot` rather than sitting beside
///   it.** M1 gave each class its own weekly slots; M3 needs the teacher's own
///   week, which also has to hold covers, duties and free hours that belong to
///   no class at all. Two registers covering the same ground would mean typing
///   a lesson twice and would let the Today view list the same class twice, so
///   there is one register: `timetable_cell`. Every `class_slot` row is folded
///   into it below and the table is dropped — a class's hours are now derived
///   from the cells that point at it.
/// * **No row here carries a week index.** A lesson plan is keyed by
///   `week_monday`, the actual Monday of its week, and an agenda note by an
///   actual date. Moving the school year's start date re-derives what a week is
///   *called* and touches nothing stored. That is M3's first acceptance
///   criterion, held by construction.
/// * **`timetable_cell.class_id` is nullable and `ON DELETE SET NULL`.**
///   Deleting a class empties the link but keeps the hour, because the hour is
///   still in the teacher's week — and the cell's own duty, room and notes
///   survive with it. This is the second (and last) nullable column in the
///   schema.
/// * **Neither new keyed table has an id.** `lesson_plan` is keyed by
///   `(class_id, week_monday)` and `agenda_note` by `(scope, date)`, so there is
///   no generated id for a "new record" button to have to select — the
///   create-then-edit defect that bit M1 has no room to occur in them.
fn migrate_to_4(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "BEGIN;

         CREATE TABLE timetable_period (
             id         INTEGER PRIMARY KEY,
             position   INTEGER NOT NULL DEFAULT 0,
             name       TEXT NOT NULL DEFAULT '',
             start_time TEXT NOT NULL DEFAULT '',
             end_time   TEXT NOT NULL DEFAULT ''
         );

         CREATE TABLE timetable_cell (
             period_id INTEGER NOT NULL REFERENCES timetable_period(id) ON DELETE CASCADE,
             weekday   INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 6),
             class_id  INTEGER REFERENCES class(id) ON DELETE SET NULL,
             subject   TEXT NOT NULL DEFAULT '',
             room      TEXT NOT NULL DEFAULT '',
             duty      TEXT NOT NULL DEFAULT '',
             notes     TEXT NOT NULL DEFAULT '',
             PRIMARY KEY (period_id, weekday)
         );
         CREATE INDEX timetable_cell_by_class ON timetable_cell(class_id);

         CREATE TABLE lesson_plan (
             class_id    INTEGER NOT NULL REFERENCES class(id) ON DELETE CASCADE,
             week_monday TEXT NOT NULL,
             notes       TEXT NOT NULL DEFAULT '',
             assessment  TEXT NOT NULL DEFAULT '',
             PRIMARY KEY (class_id, week_monday)
         );
         CREATE INDEX lesson_plan_by_week ON lesson_plan(week_monday);

         CREATE TABLE agenda_note (
             scope TEXT NOT NULL CHECK (scope IN ('day', 'week', 'month')),
             date  TEXT NOT NULL,
             body  TEXT NOT NULL DEFAULT '',
             PRIMARY KEY (scope, date)
         );

         COMMIT;",
    )?;

    carry_class_slots_into_the_timetable(conn)?;
    conn.execute_batch("DROP TABLE IF EXISTS class_slot;")?;
    Ok(())
}

/// M4 — attendance, absence events, behaviour incidents and support plans.
///
/// Four things are worth reading twice:
///
/// * **`attendance_mark` is keyed by an actual date, not by a month and a day
///   column.** The source page is one printed card per month with columns 1–31,
///   and keying the table that way — `(class, year, month)` with 31 columns, or
///   a day-of-month index — is the obvious shortcut and the same mistake the
///   spec spent M1 ruling out. A cell is `(class, student, date)`; the month
///   grid is a *view* `domain/attendance.ts` builds with M3's `monthGrid()`.
/// * **`attendance_mark` and `absence_event` are independent, and nothing here
///   joins them.** The spec says so twice and it is M4's first acceptance
///   criterion: no trigger, no view, no shared key, no count of one taken from
///   the other. The same student on the same date can carry a `present` mark
///   and a logged late arrival, and both stand.
/// * **`support_plan.status` and `support_goal.progress` are in different
///   tables**, so no statement that writes a goal can reach a plan's status.
///   That is M4's second acceptance criterion, held by construction.
/// * **Three of the four new record tables carry a generated id**, which
///   reintroduces the create-then-edit shape that cost M1 a data-loss bug.
///   Storage cannot defend against that — the screens do, by editing rows in
///   place rather than through an editor bound to a selection, and the one
///   place that genuinely needs a selection selects the row the id came back
///   on. See `SupportScreen` and its tests.
///
/// Note the deliberate departure from the delete-when-empty rule M2's grade
/// cells and M3's timetable cells follow: an emptied **`attendance_mark` is
/// deleted**, because an unmarked day is the absence of a row, but a blank
/// absence event, incident, plan or goal is **kept**, because the teacher
/// pressed a button to create it and is about to type into it. Deleting those
/// on save would make a new record vanish the instant it appeared.
fn migrate_to_5(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "BEGIN;

         CREATE TABLE attendance_mark (
             class_id   INTEGER NOT NULL REFERENCES class(id)   ON DELETE CASCADE,
             student_id INTEGER NOT NULL REFERENCES student(id) ON DELETE CASCADE,
             date       TEXT NOT NULL,
             state      TEXT NOT NULL
                        CHECK (state IN ('present', 'absent', 'late', 'excused')),
             PRIMARY KEY (class_id, student_id, date)
         );
         CREATE INDEX attendance_mark_by_date ON attendance_mark(date);
         CREATE INDEX attendance_mark_by_student ON attendance_mark(student_id);

         CREATE TABLE absence_event (
             id            INTEGER PRIMARY KEY,
             class_id      INTEGER NOT NULL REFERENCES class(id)   ON DELETE CASCADE,
             student_id    INTEGER NOT NULL REFERENCES student(id) ON DELETE CASCADE,
             date          TEXT NOT NULL DEFAULT '',
             kind          TEXT NOT NULL DEFAULT 'absence',
             clock_time    TEXT NOT NULL DEFAULT '',
             teaching_hour TEXT NOT NULL DEFAULT '',
             reason        TEXT NOT NULL DEFAULT '',
             justified     INTEGER NOT NULL DEFAULT 0,
             follow_up     TEXT NOT NULL DEFAULT '',
             frequent_note TEXT NOT NULL DEFAULT ''
         );
         CREATE INDEX absence_event_by_class ON absence_event(class_id);
         CREATE INDEX absence_event_by_student ON absence_event(student_id);

         CREATE TABLE incident (
             id               INTEGER PRIMARY KEY,
             student_id       INTEGER NOT NULL REFERENCES student(id) ON DELETE CASCADE,
             class_id         INTEGER REFERENCES class(id) ON DELETE SET NULL,
             date             TEXT NOT NULL DEFAULT '',
             what_happened    TEXT NOT NULL DEFAULT '',
             action_taken     TEXT NOT NULL DEFAULT '',
             parents_informed INTEGER NOT NULL DEFAULT 0
         );
         CREATE INDEX incident_by_student ON incident(student_id);

         CREATE TABLE support_plan (
             id                   INTEGER PRIMARY KEY,
             student_id           INTEGER NOT NULL REFERENCES student(id) ON DELETE CASCADE,
             position             INTEGER NOT NULL DEFAULT 0,
             start_date           TEXT NOT NULL DEFAULT '',
             monitoring_frequency TEXT NOT NULL DEFAULT '',
             strengths            TEXT NOT NULL DEFAULT '',
             needs                TEXT NOT NULL DEFAULT '',
             accommodations       TEXT NOT NULL DEFAULT '',
             collaboration        TEXT NOT NULL DEFAULT '',
             status               TEXT NOT NULL DEFAULT '',
             next_review          TEXT NOT NULL DEFAULT ''
         );
         CREATE INDEX support_plan_by_student ON support_plan(student_id);

         CREATE TABLE support_goal (
             id           INTEGER PRIMARY KEY,
             plan_id      INTEGER NOT NULL REFERENCES support_plan(id) ON DELETE CASCADE,
             position     INTEGER NOT NULL DEFAULT 0,
             goal         TEXT NOT NULL DEFAULT '',
             progress     TEXT NOT NULL DEFAULT '',
             monitored_on TEXT NOT NULL DEFAULT ''
         );
         CREATE INDEX support_goal_by_plan ON support_goal(plan_id);

         COMMIT;",
    )?;
    Ok(())
}

/// M5 — parents and staff.
///
/// Four tables, all purely additive: nothing M0–M4 wrote is touched, so a data
/// file from any previously shipped build climbs to 6 and keeps every row.
///
/// **`parent_contact` and `parent_appointment` are deliberately unrelated.**
/// The spec calls one "a booking" and the other "a record of what happened",
/// and M5's second acceptance criterion is that both can exist for the same
/// guardian on the same date without either disturbing the other. So there is
/// **no foreign key between them, no shared key beyond the student both may
/// name, no trigger and no view** — the same construction M4 used to keep the
/// attendance grid independent of the absence register, and for the same
/// reason: two tables that cannot reach each other cannot overwrite each other.
///
/// `parent_appointment.date` is an actual date, not a weekday index, so the
/// Monday–Friday grid is a view over a chosen week rather than a stored shape.
/// That is M1's rule and M4's precedent, and it is what makes a booking survive
/// a change to the school year's start date.
fn migrate_to_6(conn: &Connection) -> AppResult<()> {
    conn.execute_batch(
        "BEGIN;

         CREATE TABLE parent_contact (
             id         INTEGER PRIMARY KEY,
             student_id INTEGER NOT NULL REFERENCES student(id) ON DELETE CASCADE,
             date       TEXT NOT NULL DEFAULT '',
             guardian   TEXT NOT NULL DEFAULT '',
             format     TEXT NOT NULL DEFAULT 'meeting',
             reason     TEXT NOT NULL DEFAULT '',
             agreements TEXT NOT NULL DEFAULT '',
             outcome    TEXT NOT NULL DEFAULT '',
             next_step  TEXT NOT NULL DEFAULT '',
             remarks    TEXT NOT NULL DEFAULT ''
         );
         CREATE INDEX parent_contact_by_student ON parent_contact(student_id);
         CREATE INDEX parent_contact_by_date ON parent_contact(date);

         CREATE TABLE parent_appointment (
             id         INTEGER PRIMARY KEY,
             date       TEXT NOT NULL DEFAULT '',
             clock_time TEXT NOT NULL DEFAULT '',
             student_id INTEGER REFERENCES student(id) ON DELETE SET NULL,
             guardian   TEXT NOT NULL DEFAULT '',
             mode       TEXT NOT NULL DEFAULT 'in_person',
             place      TEXT NOT NULL DEFAULT '',
             status     TEXT NOT NULL DEFAULT 'proposed',
             topic      TEXT NOT NULL DEFAULT '',
             outcome    TEXT NOT NULL DEFAULT ''
         );
         CREATE INDEX parent_appointment_by_date ON parent_appointment(date);

         CREATE TABLE staff_meeting (
             id         INTEGER PRIMARY KEY,
             position   INTEGER NOT NULL DEFAULT 0,
             kind       TEXT NOT NULL DEFAULT 'staff',
             date       TEXT NOT NULL DEFAULT '',
             clock_time TEXT NOT NULL DEFAULT '',
             duration   TEXT NOT NULL DEFAULT '',
             attendees  TEXT NOT NULL DEFAULT '',
             agenda     TEXT NOT NULL DEFAULT '',
             class_id   INTEGER REFERENCES class(id) ON DELETE SET NULL,
             notes      TEXT NOT NULL DEFAULT ''
         );
         CREATE INDEX staff_meeting_by_date ON staff_meeting(date);

         CREATE TABLE meeting_agreement (
             id         INTEGER PRIMARY KEY,
             meeting_id INTEGER NOT NULL REFERENCES staff_meeting(id) ON DELETE CASCADE,
             position   INTEGER NOT NULL DEFAULT 0,
             who        TEXT NOT NULL DEFAULT '',
             what       TEXT NOT NULL DEFAULT '',
             deadline   TEXT NOT NULL DEFAULT ''
         );
         CREATE INDEX meeting_agreement_by_meeting ON meeting_agreement(meeting_id);

         COMMIT;",
    )?;
    Ok(())
}

/// Folds every M1 `class_slot` row into the master timetable, losing none.
///
/// A slot's `(period_label, start_time, end_time)` becomes an hour, and the slot
/// itself becomes that hour's cell on its weekday, linked to its class. Hours
/// are created in clock order so the migrated grid reads top to bottom.
///
/// The case that needs care is a **collision**: M1 let the teacher give two
/// classes the same label and times on the same weekday, which the new grid
/// cannot hold in one cell. Rather than drop one — silent data loss being the
/// one thing this project will not do in a migration — the second slot gets its
/// own hour row with the same name and times, so it is still on the grid and
/// visible as a duplicate the teacher can tidy up.
fn carry_class_slots_into_the_timetable(conn: &Connection) -> AppResult<()> {
    let exists: i64 = conn.query_row(
        "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = 'class_slot'",
        [],
        |r| r.get(0),
    )?;
    if exists == 0 {
        return Ok(());
    }

    struct Slot {
        class_id: i64,
        weekday: i64,
        label: String,
        start: String,
        end: String,
        room: String,
    }
    let slots: Vec<Slot> = {
        let mut stmt = conn.prepare(
            "SELECT class_id, weekday, period_label, start_time, end_time, room
               FROM class_slot
              ORDER BY start_time, period_label, class_id, id",
        )?;
        let rows = stmt.query_map([], |r| {
            Ok(Slot {
                class_id: r.get(0)?,
                weekday: r.get(1)?,
                label: r.get(2)?,
                start: r.get(3)?,
                end: r.get(4)?,
                room: r.get(5)?,
            })
        })?;
        let mut out = Vec::new();
        for row in rows {
            out.push(row?);
        }
        out
    };
    if slots.is_empty() {
        return Ok(());
    }

    // (name, start, end) -> the hours created for it, in creation order. A
    // second hour is only added for that triple when a weekday collides.
    let mut hours: Vec<((String, String, String), Vec<i64>)> = Vec::new();
    let mut taken: Vec<(i64, i64)> = Vec::new();
    let mut next_position: i64 = 0;

    for slot in &slots {
        let key = (slot.label.clone(), slot.start.clone(), slot.end.clone());
        let created = match hours.iter().position(|(k, _)| *k == key) {
            Some(index) => &mut hours[index].1,
            None => {
                hours.push((key, Vec::new()));
                &mut hours.last_mut().unwrap().1
            }
        };

        let free = created
            .iter()
            .copied()
            .find(|id| !taken.contains(&(*id, slot.weekday)));
        let period_id = match free {
            Some(id) => id,
            None => {
                conn.execute(
                    "INSERT INTO timetable_period (position, name, start_time, end_time)
                     VALUES (?1, ?2, ?3, ?4)",
                    params![next_position, slot.label, slot.start, slot.end],
                )?;
                next_position += 1;
                let id = conn.last_insert_rowid();
                created.push(id);
                id
            }
        };

        conn.execute(
            "INSERT INTO timetable_cell (period_id, weekday, class_id, subject, room, duty, notes)
             VALUES (?1, ?2, ?3, '', ?4, '', '')",
            params![period_id, slot.weekday, slot.class_id, slot.room],
        )?;
        taken.push((period_id, slot.weekday));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store;

    #[test]
    fn first_open_creates_the_file_and_the_schema() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data").join("planner.sqlite");
        assert!(!path.exists());

        let conn = open_at(&path).unwrap();
        assert!(path.exists());

        let version: i64 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
    }

    #[test]
    fn a_fresh_file_starts_with_the_fixed_rows_and_nothing_else() {
        let dir = tempfile::tempdir().unwrap();
        let conn = open_at(&dir.path().join("planner.sqlite")).unwrap();
        let planner = store::load(&conn).unwrap();

        assert_eq!(planner.grading_periods.len(), 3);
        assert_eq!(planner.annual_goals.len(), 6);
        assert_eq!(planner.school_year.start_date, "");
        assert_eq!(planner.school_year.year_model, "sep_aug");
        assert!(planner.classes.is_empty());
        assert!(planner.students.is_empty());
    }

    #[test]
    fn an_m0_file_migrates_forward_without_being_recreated() {
        // Exactly what a teacher who has been running the M0 build has on disk.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let conn = Connection::open(&path).unwrap();
        migrate_to_1(&conn).unwrap();
        conn.pragma_update(None, "user_version", 1).unwrap();
        conn.execute("UPDATE scratch_note SET body = 'Α1'", [])
            .unwrap();
        drop(conn);

        let conn = open_at(&path).unwrap();
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
        // The M0 probe table is gone, replaced by the real schema.
        let scratch: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name = 'scratch_note'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(scratch, 0);
        assert_eq!(store::load(&conn).unwrap().annual_goals.len(), 6);
    }

    #[test]
    fn migrating_twice_is_a_no_op() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let conn = open_at(&path).unwrap();
        let id = store::save_class(&conn, &crate::store::tests_support::sample_class()).unwrap();
        drop(conn);

        let conn = open_at(&path).unwrap();
        assert_eq!(store::load(&conn).unwrap().classes.len(), 1);
        assert_eq!(store::load(&conn).unwrap().classes[0].id, id);
    }

    /// The migration M3 has to get right: a data file from the signed-off M2
    /// build carries the teacher's week as `class_slot` rows, and every one of
    /// them must arrive on the master timetable. Losing one would be losing an
    /// hour of her week silently.
    #[test]
    fn m1_class_slots_are_carried_onto_the_master_timetable() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");

        // A file as the M2 build left it, with two classes and three slots.
        let conn = Connection::open(&path).unwrap();
        migrate_to_1(&conn).unwrap();
        migrate_to_2(&conn).unwrap();
        migrate_to_3(&conn).unwrap();
        conn.pragma_update(None, "user_version", 3).unwrap();
        conn.execute_batch(
            "INSERT INTO class (id, name, subject, room) VALUES
                 (1, 'Α1', 'Μαθηματικά', '203'),
                 (2, 'Β2', 'Φυσική', 'Εργαστήριο');
             INSERT INTO class_slot (class_id, weekday, period_label, start_time, end_time, room)
             VALUES (1, 1, '2η', '09:20', '10:05', '203'),
                    (1, 3, '2η', '09:20', '10:05', '203'),
                    (2, 2, '4η', '11:10', '11:55', 'Εργαστήριο');",
        )
        .unwrap();
        drop(conn);

        let conn = open_at(&path).unwrap();
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);

        let planner = store::load(&conn).unwrap();
        // Two distinct hours — the 2nd, shared by Monday and Wednesday, and the
        // 4th — rather than one row per slot.
        assert_eq!(planner.timetable_periods.len(), 2);
        let second = planner
            .timetable_periods
            .iter()
            .find(|p| p.name == "2η")
            .unwrap();
        assert_eq!(second.start_time, "09:20");
        assert_eq!(second.end_time, "10:05");

        assert_eq!(planner.timetable_cells.len(), 3, "no slot may be dropped");
        let on = |weekday: i64| {
            planner
                .timetable_cells
                .iter()
                .find(|c| c.weekday == weekday)
                .unwrap()
        };
        assert_eq!(on(1).class_id, Some(1));
        assert_eq!(on(1).period_id, second.id);
        assert_eq!(on(3).class_id, Some(1));
        assert_eq!(on(3).period_id, second.id);
        assert_eq!(on(2).class_id, Some(2));
        assert_eq!(on(2).room, "Εργαστήριο");

        // Hours are ordered by the clock, so the migrated grid reads downwards.
        assert_eq!(planner.timetable_periods[0].name, "2η");
        assert_eq!(planner.timetable_periods[1].name, "4η");

        // The old table is gone, so there is only one register of the week.
        let left: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE name = 'class_slot'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(left, 0);
    }

    /// M1 allowed two classes at the same label, times and weekday; the grid
    /// holds one lesson per cell. Rather than drop one, the collision gets its
    /// own hour row — visible, and still the teacher's data.
    #[test]
    fn two_classes_colliding_on_one_hour_both_survive_the_migration() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");

        let conn = Connection::open(&path).unwrap();
        migrate_to_1(&conn).unwrap();
        migrate_to_2(&conn).unwrap();
        migrate_to_3(&conn).unwrap();
        conn.pragma_update(None, "user_version", 3).unwrap();
        conn.execute_batch(
            "INSERT INTO class (id, name) VALUES (1, 'Α1'), (2, 'Β2');
             INSERT INTO class_slot (class_id, weekday, period_label, start_time, end_time, room)
             VALUES (1, 1, '1η', '08:30', '09:15', '203'),
                    (2, 1, '1η', '08:30', '09:15', '204');",
        )
        .unwrap();
        drop(conn);

        let conn = open_at(&path).unwrap();
        let planner = store::load(&conn).unwrap();
        assert_eq!(
            planner.timetable_cells.len(),
            2,
            "neither class may be dropped for colliding"
        );
        assert_eq!(
            planner.timetable_periods.len(),
            2,
            "the second lesson gets its own hour rather than overwriting the first"
        );
        let linked: Vec<Option<i64>> = planner.timetable_cells.iter().map(|c| c.class_id).collect();
        assert!(linked.contains(&Some(1)) && linked.contains(&Some(2)));
        // Both rows describe the same hour of the day, so the teacher can see
        // what happened and tidy it up.
        assert!(planner.timetable_periods.iter().all(|p| p.name == "1η"));
    }

    /// A file with no timetable at all climbs cleanly — the common case for a
    /// teacher who never filled her class cards' slots in.
    #[test]
    fn a_file_with_no_class_slots_migrates_without_inventing_hours() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let conn = Connection::open(&path).unwrap();
        migrate_to_1(&conn).unwrap();
        migrate_to_2(&conn).unwrap();
        conn.pragma_update(None, "user_version", 2).unwrap();
        drop(conn);

        let conn = open_at(&path).unwrap();
        let planner = store::load(&conn).unwrap();
        assert!(planner.timetable_periods.is_empty());
        assert!(planner.timetable_cells.is_empty());
        assert!(planner.lesson_plans.is_empty());
        assert!(planner.agenda_notes.is_empty());
    }

    /// The `(scope, date)` key is not enough on its own — a typo'd scope must be
    /// refused by the file rather than read back as a fourth kind of note.
    #[test]
    fn the_file_refuses_an_agenda_scope_it_does_not_know() {
        let dir = tempfile::tempdir().unwrap();
        let conn = open_at(&dir.path().join("planner.sqlite")).unwrap();
        let bad = conn.execute(
            "INSERT INTO agenda_note (scope, date, body) VALUES ('term', '2026-09-14', 'x')",
            [],
        );
        assert!(bad.is_err());
    }

    #[test]
    fn no_wal_sidecar_files_are_left_behind() {
        // The cloud-sync-safety reason for DELETE journal mode.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let conn = open_at(&path).unwrap();
        store::save_student(&conn, &crate::store::tests_support::sample_student()).unwrap();
        drop(conn);

        assert!(!dir.path().join("planner.sqlite-wal").exists());
        assert!(!dir.path().join("planner.sqlite-shm").exists());
    }

    /// A data file as the signed-off M3 build left it climbs to the current
    /// schema with every M3 record still in place and every later milestone's
    /// tables present. M4 and M5 both only add tables, so this is the whole of
    /// what the step has to prove.
    ///
    /// Kept climbing from **M3** rather than being re-pointed at the newest
    /// version each milestone: the rule is that a file from *any* previously
    /// shipped build climbs, and the oldest one still exercises every step.
    #[test]
    fn an_m3_file_climbs_to_the_current_schema_without_losing_anything() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");

        let conn = Connection::open(&path).unwrap();
        migrate_to_1(&conn).unwrap();
        migrate_to_2(&conn).unwrap();
        migrate_to_3(&conn).unwrap();
        migrate_to_4(&conn).unwrap();
        conn.pragma_update(None, "user_version", 4).unwrap();
        conn.execute_batch(
            "INSERT INTO class (id, name, subject) VALUES (1, 'Α1', 'Μαθηματικά');
             INSERT INTO student (id, full_name) VALUES (1, 'Ελένη Παπαδοπούλου');
             INSERT INTO enrollment (class_id, student_id, roster_no) VALUES (1, 1, 1);
             INSERT INTO timetable_period (id, position, name) VALUES (1, 0, '1η');
             INSERT INTO timetable_cell (period_id, weekday, class_id) VALUES (1, 1, 1);
             INSERT INTO lesson_plan (class_id, week_monday, notes)
             VALUES (1, '2026-11-02', 'Κεφάλαιο 4');
             INSERT INTO agenda_note (scope, date, body)
             VALUES ('week', '2026-11-02', 'Εβδομάδα επανάληψης');",
        )
        .unwrap();
        drop(conn);

        let conn = open_at(&path).unwrap();
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
        assert_eq!(version, 6);

        let planner = store::load(&conn).unwrap();
        // Everything M3 wrote is still there, untouched.
        assert_eq!(planner.classes.len(), 1);
        assert_eq!(planner.students.len(), 1);
        assert_eq!(planner.timetable_cells.len(), 1);
        assert_eq!(planner.lesson_plans[0].notes, "Κεφάλαιο 4");
        assert_eq!(planner.agenda_notes[0].body, "Εβδομάδα επανάληψης");
        // And the M4 tables exist and are empty, rather than being invented
        // from anything that was already on the file.
        assert!(planner.attendance_marks.is_empty());
        assert!(planner.absence_events.is_empty());
        assert!(planner.incidents.is_empty());
        assert!(planner.support_plans.is_empty());
        assert!(planner.support_goals.is_empty());
        // And M5's, likewise invented from nothing.
        assert!(planner.parent_contacts.is_empty());
        assert!(planner.parent_appointments.is_empty());
        assert!(planner.staff_meetings.is_empty());
        assert!(planner.meeting_agreements.is_empty());

        for table in [
            "attendance_mark",
            "absence_event",
            "incident",
            "support_plan",
            "support_goal",
            "parent_contact",
            "parent_appointment",
            "staff_meeting",
            "meeting_agreement",
        ] {
            let present: i64 = conn
                .query_row(
                    "SELECT count(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                    [table],
                    |r| r.get(0),
                )
                .unwrap();
            assert_eq!(present, 1, "{table} should exist at the current schema");
        }
    }

    /// A data file as the **signed-off M4.5 build** left it — `user_version =
    /// 5`, with real M4 rows on it — climbs to 6 and keeps every one of them.
    ///
    /// This is the case the teacher actually meets: she has been using the last
    /// shipped build and her file has data in it. The M3 test above proves the
    /// whole ladder still runs; this proves the top rung does not disturb the
    /// records the previous milestone wrote.
    #[test]
    fn an_m4_file_with_data_on_it_climbs_to_6_and_keeps_every_row() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");

        let conn = Connection::open(&path).unwrap();
        migrate_to_1(&conn).unwrap();
        migrate_to_2(&conn).unwrap();
        migrate_to_3(&conn).unwrap();
        migrate_to_4(&conn).unwrap();
        migrate_to_5(&conn).unwrap();
        conn.pragma_update(None, "user_version", 5).unwrap();
        conn.execute_batch(
            "INSERT INTO class (id, name, subject) VALUES (1, 'Α1', 'Μαθηματικά');
             INSERT INTO student (id, full_name) VALUES (1, 'Ελένη Παπαδοπούλου');
             INSERT INTO enrollment (class_id, student_id, roster_no) VALUES (1, 1, 1);
             INSERT INTO attendance_mark (class_id, student_id, date, state)
             VALUES (1, 1, '2026-11-05', 'present');
             INSERT INTO absence_event (class_id, student_id, date, kind, reason)
             VALUES (1, 1, '2026-11-05', 'late', 'Λεωφορείο');
             INSERT INTO incident (student_id, class_id, date, what_happened)
             VALUES (1, 1, '2026-11-06', 'Διαφωνία στο διάλειμμα');
             INSERT INTO support_plan (id, student_id, position, status)
             VALUES (1, 1, 0, 'Δουλεύει καλά με τον νέο ρυθμό');
             INSERT INTO support_goal (plan_id, position, goal, progress)
             VALUES (1, 0, 'Ανάγνωση δέκα λεπτά τη μέρα', 'in_progress');",
        )
        .unwrap();
        drop(conn);

        let conn = open_at(&path).unwrap();
        let version: i64 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, 6);

        let planner = store::load(&conn).unwrap();
        // Every M4 row, exactly as it was written.
        assert_eq!(planner.attendance_marks.len(), 1);
        assert_eq!(planner.attendance_marks[0].state, "present");
        assert_eq!(planner.absence_events.len(), 1);
        assert_eq!(planner.absence_events[0].reason, "Λεωφορείο");
        assert_eq!(planner.incidents[0].what_happened, "Διαφωνία στο διάλειμμα");
        assert_eq!(
            planner.support_plans[0].status, "Δουλεύει καλά με τον νέο ρυθμό",
            "a teacher-written status is not something a migration may touch"
        );
        assert_eq!(planner.support_goals[0].progress, "in_progress");
        // The contested M4 pair is still contested: a mark and an event on the
        // same day for the same student, both present, neither derived.
        assert_eq!(
            planner.attendance_marks[0].date,
            planner.absence_events[0].date
        );

        // And M5's tables are there and empty.
        assert!(planner.parent_contacts.is_empty());
        assert!(planner.parent_appointments.is_empty());
        assert!(planner.staff_meetings.is_empty());
        assert!(planner.meeting_agreements.is_empty());
    }
}
