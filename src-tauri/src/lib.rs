//! Ατζέντα Εκπαιδευτικού — the Rust half of the app.
//!
//! M0 laid the foundation: packaging, file I/O, backups and the
//! changed-on-disk guard, all proven from inside a cloud-synced folder.
//! M1 puts the first real data behind it — school year, classes, students.
//!
//! Two rules shape the command layer:
//!
//! * **Every mutation re-checks the file's fingerprint first**, so the M0
//!   block-and-reload guarantee now covers real teacher data and not just a
//!   scratch note. There is deliberately no "save anyway".
//! * **Every mutation returns the whole planner**, freshly read back from the
//!   file it just wrote. The frontend therefore never holds a guess about
//!   what is on disk, which is the same reason connections are per-operation.

// Public so the integration tests in `tests/` can drive the same code the
// Tauri commands use.
pub mod backup;
pub mod db;
pub mod error;
pub mod fingerprint;
pub mod model;
pub mod paths;
pub mod store;

use error::{AppError, AppResult};
use fingerprint::Fingerprint;
use model::*;
use serde::Serialize;
use std::sync::Mutex;
use std::time::Duration;

/// How often a long session snapshots itself, per the spec.
const BACKUP_INTERVAL: Duration = Duration::from_secs(30 * 60);

#[derive(Default)]
pub struct AppState {
    /// The fingerprint of `planner.sqlite` as of our last read or write.
    /// `None` means we have not read the file yet this session.
    last_seen: Mutex<Option<Fingerprint>>,
}

#[derive(Serialize)]
pub struct Status {
    app_folder: String,
    db_path: String,
    db_exists: bool,
    schema_version: i64,
    backup_count: usize,
    last_backup: Option<String>,
    /// True when the file on disk no longer matches what we last read, i.e. the
    /// UI should block saving and offer a reload.
    disk_changed: bool,
}

fn current_fingerprint() -> AppResult<Option<Fingerprint>> {
    Ok(Fingerprint::of(&paths::db_path())?)
}

/// True if the file changed since our last read. A file that we have never read
/// is not "changed"; neither is one that has not been created yet.
fn disk_changed(state: &AppState) -> bool {
    let last = state.last_seen.lock().unwrap();
    match (&*last, current_fingerprint().ok().flatten()) {
        (Some(seen), Some(now)) => *seen != now,
        (Some(_), None) => true, // the file vanished underneath us
        (None, _) => false,
    }
}

fn remember_current(state: &AppState) -> AppResult<()> {
    *state.last_seen.lock().unwrap() = current_fingerprint()?;
    Ok(())
}

/// Reads the whole planner and records what the file looked like when we did.
fn read_all(state: &AppState) -> AppResult<Planner> {
    let conn = db::open()?;
    let planner = store::load(&conn)?;
    drop(conn);
    remember_current(state)?;
    Ok(planner)
}

/// Runs one mutation against the data file and hands back the result of
/// re-reading it.
///
/// The fingerprint check happens *before* the write, so a file that the cloud
/// sync replaced underneath us is never overwritten — the caller gets
/// `disk_changed` and the UI offers a reload instead.
///
/// The mutation runs inside a transaction: the app can be quit or the machine
/// slept mid-save, and a half-written roster is exactly the kind of damage the
/// spec asks SQLite to rule out.
fn mutate<F>(state: &AppState, apply: F) -> AppResult<Planner>
where
    F: FnOnce(&rusqlite::Transaction<'_>) -> AppResult<()>,
{
    if disk_changed(state) {
        return Err(AppError::DiskChanged);
    }
    let mut conn = db::open()?;
    {
        let tx = conn.transaction()?;
        apply(&tx)?;
        tx.commit()?;
    }
    let planner = store::load(&conn)?;
    drop(conn);
    remember_current(state)?;
    Ok(planner)
}

#[tauri::command]
fn status(state: tauri::State<'_, AppState>) -> AppResult<Status> {
    let db_path = paths::db_path();
    let conn = db::open()?;
    let schema_version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    Ok(Status {
        app_folder: paths::app_folder().display().to_string(),
        db_path: db_path.display().to_string(),
        db_exists: db_path.exists(),
        schema_version,
        backup_count: backup::count_snapshots(),
        last_backup: backup::latest_snapshot_iso(),
        disk_changed: disk_changed(&state),
    })
}

#[tauri::command]
fn load(state: tauri::State<'_, AppState>) -> AppResult<Planner> {
    read_all(&state)
}

/// Accepts whatever is now on disk as the truth and re-reads it. This is the
/// only way out of the blocked state — there is deliberately no "save anyway".
#[tauri::command]
fn reload(state: tauri::State<'_, AppState>) -> AppResult<Planner> {
    read_all(&state)
}

#[tauri::command]
fn save_school_year(state: tauri::State<'_, AppState>, year: SchoolYear) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_school_year(tx, &year))
}

#[tauri::command]
fn save_grading_periods(
    state: tauri::State<'_, AppState>,
    periods: Vec<GradingPeriod>,
) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_grading_periods(tx, &periods))
}

#[tauri::command]
fn save_holiday(state: tauri::State<'_, AppState>, holiday: Holiday) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_holiday(tx, &holiday).map(|_| ()))
}

#[tauri::command]
fn delete_holiday(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_holiday(tx, id))
}

#[tauri::command]
fn save_important_date(
    state: tauri::State<'_, AppState>,
    date: ImportantDate,
) -> AppResult<Planner> {
    mutate(&state, |tx| {
        store::save_important_date(tx, &date).map(|_| ())
    })
}

#[tauri::command]
fn delete_important_date(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_important_date(tx, id))
}

#[tauri::command]
fn save_annual_goal(state: tauri::State<'_, AppState>, goal: AnnualGoal) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_annual_goal(tx, &goal))
}

#[tauri::command]
fn save_class(state: tauri::State<'_, AppState>, class: Class) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_class(tx, &class).map(|_| ()))
}

#[tauri::command]
fn delete_class(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_class(tx, id))
}

#[tauri::command]
fn save_student(state: tauri::State<'_, AppState>, student: Student) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_student(tx, &student).map(|_| ()))
}

#[tauri::command]
fn delete_student(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_student(tx, id))
}

#[tauri::command]
fn set_enrollment(state: tauri::State<'_, AppState>, enrollment: Enrollment) -> AppResult<Planner> {
    mutate(&state, |tx| store::set_enrollment(tx, &enrollment))
}

#[tauri::command]
fn remove_enrollment(
    state: tauri::State<'_, AppState>,
    class_id: i64,
    student_id: i64,
) -> AppResult<Planner> {
    mutate(&state, |tx| {
        store::remove_enrollment(tx, class_id, student_id)
    })
}

#[tauri::command]
fn save_seating(
    state: tauri::State<'_, AppState>,
    class_id: i64,
    rows: i64,
    cols: i64,
    notes: String,
    seats: Vec<Seat>,
) -> AppResult<Planner> {
    mutate(&state, |tx| {
        store::save_seating(tx, class_id, rows, cols, &notes, &seats)
    })
}

#[tauri::command]
fn make_backup() -> AppResult<Option<String>> {
    Ok(backup::snapshot_now()?.map(|p| p.display().to_string()))
}

pub fn run() {
    if let Err(e) = paths::ensure_dirs() {
        eprintln!("could not create the app's data folders: {e}");
    }
    // Snapshot on launch, before anything has a chance to write. From M1 on
    // this also means the pre-migration file is preserved: if the schema step
    // to a new milestone ever goes wrong, the teacher's last good file is
    // sitting in `data/backups/`.
    if let Err(e) = backup::snapshot_now() {
        eprintln!("launch backup failed: {e}");
    }
    // Create and migrate the data file now rather than lazily on the first
    // command, so it exists as soon as the app does. This is also what makes a
    // headless smoke test meaningful: the file appearing proves the app really
    // resolved its folder and wrote to it.
    if let Err(e) = db::open() {
        eprintln!("could not open the data file: {e}");
    }

    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            status,
            load,
            reload,
            save_school_year,
            save_grading_periods,
            save_holiday,
            delete_holiday,
            save_important_date,
            delete_important_date,
            save_annual_goal,
            save_class,
            delete_class,
            save_student,
            delete_student,
            set_enrollment,
            remove_enrollment,
            save_seating,
            make_backup
        ])
        .setup(|_app| {
            std::thread::spawn(|| loop {
                std::thread::sleep(BACKUP_INTERVAL);
                if let Err(e) = backup::snapshot_now() {
                    eprintln!("periodic backup failed: {e}");
                }
            });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the application")
        .run(|_app, event| {
            // Snapshot on a clean shutdown too.
            if let tauri::RunEvent::ExitRequested { .. } = event {
                if let Err(e) = backup::snapshot_now() {
                    eprintln!("shutdown backup failed: {e}");
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::store::tests_support::sample_student;

    #[test]
    fn a_session_that_never_read_the_file_is_not_blocked() {
        let state = AppState::default();
        assert!(!disk_changed(&state));
    }

    #[test]
    fn disk_change_is_detected_by_comparing_fingerprints() {
        // The command layer needs a Tauri runtime, so the decision itself is
        // exercised here through the same comparison `disk_changed` performs.
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");

        let conn = db::open_at(&path).unwrap();
        store::save_student(&conn, &sample_student()).unwrap();
        drop(conn);
        let seen = Fingerprint::of(&path).unwrap();

        // Another device's copy lands in the folder while we were idle.
        let conn = db::open_at(&path).unwrap();
        store::save_student(&conn, &sample_student()).unwrap();
        drop(conn);
        let now = Fingerprint::of(&path).unwrap();

        assert_ne!(seen, now);
    }

    #[test]
    fn an_untouched_file_does_not_look_changed() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let conn = db::open_at(&path).unwrap();
        store::save_student(&conn, &sample_student()).unwrap();
        drop(conn);

        let a = Fingerprint::of(&path).unwrap();
        let conn = db::open_at(&path).unwrap(); // a plain read
        let _ = store::load(&conn).unwrap();
        drop(conn);
        let b = Fingerprint::of(&path).unwrap();

        assert_eq!(a, b, "opening and reading must not alter the file");
    }

    /// A failed mutation must leave the file exactly as it was, or a teacher
    /// could lose a roster to a typo in one row of it. This is the reason
    /// `mutate` wraps its work in a transaction.
    #[test]
    fn a_mutation_that_fails_partway_rolls_the_whole_thing_back() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let mut conn = db::open_at(&path).unwrap();
        let class_id = store::save_class(&conn, &store::tests_support::sample_class()).unwrap();

        let tx = conn.transaction().unwrap();
        let student_id = store::save_student(&tx, &sample_student()).unwrap();
        store::set_enrollment(
            &tx,
            &Enrollment {
                class_id,
                student_id,
                roster_no: 1,
                support: false,
                note: String::new(),
            },
        )
        .unwrap();
        // The row that cannot be written: no such student.
        let failed = store::set_enrollment(
            &tx,
            &Enrollment {
                class_id,
                student_id: 9999,
                roster_no: 2,
                support: false,
                note: String::new(),
            },
        );
        assert!(failed.is_err());
        drop(tx); // as `mutate` does when `apply` returns an error: no commit

        let planner = store::load(&conn).unwrap();
        assert!(
            planner.students.is_empty(),
            "the student written earlier in the same transaction must roll back too"
        );
        assert!(planner.enrollments.is_empty());
        assert_eq!(
            planner.classes.len(),
            1,
            "the class committed earlier stays"
        );
    }
}
