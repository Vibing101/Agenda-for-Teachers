//! M0 — shell & persistence.
//!
//! No feature UI yet: this milestone exists to prove that packaging, file I/O,
//! backups and change-detection survive being run from a cloud-synced folder,
//! because that foundation is what broke in the previous attempt.

// Public so the integration tests in `tests/` can drive the same code the
// Tauri commands use.
pub mod backup;
pub mod db;
pub mod error;
pub mod fingerprint;
pub mod paths;

use error::{AppError, AppResult};
use fingerprint::Fingerprint;
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

#[derive(Serialize)]
pub struct Loaded {
    note: String,
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
fn load(state: tauri::State<'_, AppState>) -> AppResult<Loaded> {
    let conn = db::open()?;
    let note = db::read_note(&conn)?;
    drop(conn);
    remember_current(&state)?;
    Ok(Loaded { note })
}

#[tauri::command]
fn save(state: tauri::State<'_, AppState>, note: String) -> AppResult<()> {
    // The whole point of M0's safety net: refuse rather than overwrite.
    if disk_changed(&state) {
        return Err(AppError::DiskChanged);
    }
    let conn = db::open()?;
    db::write_note(&conn, &note)?;
    drop(conn);
    remember_current(&state)?;
    Ok(())
}

/// Accepts whatever is now on disk as the truth and re-reads it. This is the
/// only way out of the blocked state — there is deliberately no "save anyway".
#[tauri::command]
fn reload(state: tauri::State<'_, AppState>) -> AppResult<Loaded> {
    let conn = db::open()?;
    let note = db::read_note(&conn)?;
    drop(conn);
    remember_current(&state)?;
    Ok(Loaded { note })
}

#[tauri::command]
fn make_backup() -> AppResult<Option<String>> {
    Ok(backup::snapshot_now()?.map(|p| p.display().to_string()))
}

pub fn run() {
    if let Err(e) = paths::ensure_dirs() {
        eprintln!("could not create the app's data folders: {e}");
    }
    // Snapshot on launch, before anything has a chance to write.
    if let Err(e) = backup::snapshot_now() {
        eprintln!("launch backup failed: {e}");
    }

    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            status,
            load,
            save,
            reload,
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
        db::write_note(&conn, "written by this session").unwrap();
        drop(conn);
        let seen = Fingerprint::of(&path).unwrap();

        // Another device's copy lands in the folder while we were idle.
        let conn = db::open_at(&path).unwrap();
        db::write_note(&conn, "written by the other device").unwrap();
        drop(conn);
        let now = Fingerprint::of(&path).unwrap();

        assert_ne!(seen, now);
    }

    #[test]
    fn an_untouched_file_does_not_look_changed() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("planner.sqlite");
        let conn = db::open_at(&path).unwrap();
        db::write_note(&conn, "x").unwrap();
        drop(conn);

        let a = Fingerprint::of(&path).unwrap();
        let conn = db::open_at(&path).unwrap(); // a plain read
        let _ = db::read_note(&conn).unwrap();
        drop(conn);
        let b = Fingerprint::of(&path).unwrap();

        assert_eq!(a, b, "opening and reading must not alter the file");
    }
}
