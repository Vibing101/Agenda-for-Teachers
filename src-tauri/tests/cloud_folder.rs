//! End-to-end checks for M0's acceptance criteria, run against a real folder on
//! disk rather than through the UI.
//!
//! This is a separate integration binary, and deliberately a single test: it
//! sets `TEACHER_PLANNER_DATA_DIR`, which is process-wide, so it must not run
//! alongside another test that reads it.

use teacher_planner_lib::{backup, db, fingerprint::Fingerprint, paths};

#[test]
fn a_session_in_a_cloud_folder_persists_backs_up_and_notices_outside_edits() {
    let folder = tempfile::tempdir().unwrap();
    std::env::set_var(paths::DATA_DIR_ENV, folder.path());

    // --- launch ---
    paths::ensure_dirs().unwrap();
    assert!(paths::data_dir().is_dir());
    assert!(paths::backups_dir().is_dir());
    assert!(paths::exports_dir().is_dir());
    // Nothing to snapshot before the data file exists.
    assert!(backup::snapshot_now().unwrap().is_none());

    // --- the teacher writes something, then quits ---
    let conn = db::open().unwrap();
    db::write_note(&conn, "Α1 — συνάντηση γονέων").unwrap();
    drop(conn);
    let after_write = Fingerprint::of(&paths::db_path()).unwrap();

    // The data file is self-contained at rest: no WAL sidecars for a sync
    // client to carry away separately.
    assert!(!paths::data_dir().join("planner.sqlite-wal").exists());
    assert!(!paths::data_dir().join("planner.sqlite-shm").exists());

    // --- relaunch: a snapshot is taken, and the data is still there ---
    assert!(backup::snapshot_now().unwrap().is_some());
    assert_eq!(backup::count_snapshots(), 1);

    let conn = db::open().unwrap();
    assert_eq!(db::read_note(&conn).unwrap(), "Α1 — συνάντηση γονέων");
    drop(conn);

    // Opening and reading must not disturb the file, or every session would
    // look like a conflict.
    assert_eq!(Fingerprint::of(&paths::db_path()).unwrap(), after_write);

    // --- the other device's copy lands while this session is open ---
    let conn = db::open().unwrap();
    db::write_note(&conn, "written elsewhere").unwrap();
    drop(conn);
    assert_ne!(
        Fingerprint::of(&paths::db_path()).unwrap(),
        after_write,
        "an outside write must be visible as a fingerprint change, which is what blocks the save"
    );

    std::env::remove_var(paths::DATA_DIR_ENV);
}
