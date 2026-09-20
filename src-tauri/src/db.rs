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
use rusqlite::Connection;
use std::path::Path;

pub const SCHEMA_VERSION: i64 = 2;

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
        assert_eq!(version, 2);
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
}
