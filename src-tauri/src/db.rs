//! The SQLite data file.
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
use rusqlite::Connection;
use std::path::Path;

pub const SCHEMA_VERSION: i64 = 1;

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

fn migrate(conn: &Connection) -> AppResult<()> {
    let current: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if current >= SCHEMA_VERSION {
        return Ok(());
    }
    // M0 carries no feature tables yet. `scratch_note` exists so that the
    // milestone's "write data, quit, relaunch, data is still there" criterion
    // is testable against a real write path; M1 replaces it with the real
    // school-year/class/student schema.
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
    conn.pragma_update(None, "user_version", SCHEMA_VERSION)?;
    Ok(())
}

pub fn read_note(conn: &Connection) -> AppResult<String> {
    let body = conn.query_row("SELECT body FROM scratch_note WHERE id = 1", [], |r| {
        r.get(0)
    })?;
    Ok(body)
}

pub fn write_note(conn: &Connection, body: &str) -> AppResult<()> {
    conn.execute(
        "UPDATE scratch_note SET body = ?1, updated_at = datetime('now') WHERE id = 1",
        [body],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_open_creates_the_file_and_the_schema() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("data").join("planner.sqlite");
        assert!(!path.exists());

        let conn = open_at(&path).unwrap();
        assert!(path.exists());
        assert_eq!(read_note(&conn).unwrap(), "");

        let version: i64 = conn
            .pragma_query_value(None, "user_version", |r| r.get(0))
            .unwrap();
        assert_eq!(version, SCHEMA_VERSION);
    }

    #[test]
    fn data_survives_closing_and_reopening() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");

        let conn = open_at(&path).unwrap();
        write_note(&conn, "Α1 — συνάντηση γονέων").unwrap();
        drop(conn); // the app quits

        let conn = open_at(&path).unwrap();
        assert_eq!(read_note(&conn).unwrap(), "Α1 — συνάντηση γονέων");
    }

    #[test]
    fn no_wal_sidecar_files_are_left_behind() {
        // The cloud-sync-safety reason for DELETE journal mode.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let conn = open_at(&path).unwrap();
        write_note(&conn, "x").unwrap();
        drop(conn);

        assert!(!dir.path().join("planner.sqlite-wal").exists());
        assert!(!dir.path().join("planner.sqlite-shm").exists());
    }

    #[test]
    fn reopening_an_existing_file_does_not_reset_it() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let conn = open_at(&path).unwrap();
        write_note(&conn, "keep me").unwrap();
        drop(conn);

        let conn = open_at(&path).unwrap();
        assert_eq!(read_note(&conn).unwrap(), "keep me");
    }
}
