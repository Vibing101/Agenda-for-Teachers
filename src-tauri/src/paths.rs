//! Where the app keeps its files.
//!
//! The spec puts `data/` and `exports/` next to the app binary inside the user's
//! cloud-synced folder, so everything travels together when the folder syncs.
//! On macOS the binary lives inside `Teacher Planner.app/Contents/MacOS/`, so the
//! folder we want is the one *containing* the bundle, not the one containing the
//! executable.

use std::path::{Path, PathBuf};

/// Overrides the resolved app folder. Used by tests and by `cargo tauri dev`,
/// where the executable sits under `src-tauri/target/` rather than in the
/// user's cloud folder.
pub const DATA_DIR_ENV: &str = "TEACHER_PLANNER_DATA_DIR";

/// Walks up from the executable path to the folder the user actually sees.
///
/// Split out from [`app_folder`] so it can be unit-tested on any OS without a
/// real bundle on disk.
pub fn app_folder_for_exe(exe: &Path) -> PathBuf {
    let start = exe.parent().unwrap_or(Path::new("."));
    for ancestor in start.ancestors() {
        if ancestor.extension().and_then(|e| e.to_str()) == Some("app") {
            // `Foo.app/Contents/MacOS` -> the folder holding `Foo.app`.
            return ancestor.parent().unwrap_or(ancestor).to_path_buf();
        }
    }
    start.to_path_buf()
}

/// The folder the app treats as its home: the cloud-synced folder in production.
pub fn app_folder() -> PathBuf {
    if let Some(dir) = std::env::var_os(DATA_DIR_ENV) {
        return PathBuf::from(dir);
    }
    match std::env::current_exe() {
        Ok(exe) => app_folder_for_exe(&exe),
        Err(_) => PathBuf::from("."),
    }
}

pub fn data_dir() -> PathBuf {
    app_folder().join("data")
}

pub fn backups_dir() -> PathBuf {
    data_dir().join("backups")
}

pub fn exports_dir() -> PathBuf {
    app_folder().join("exports")
}

pub fn db_path() -> PathBuf {
    data_dir().join("planner.sqlite")
}

/// Creates `data/`, `data/backups/` and `exports/` if they are not there yet.
pub fn ensure_dirs() -> std::io::Result<()> {
    std::fs::create_dir_all(backups_dir())?;
    std::fs::create_dir_all(exports_dir())?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn macos_bundle_resolves_to_folder_containing_the_bundle() {
        let exe =
            Path::new("/Users/t/Drive/Agenda/Teacher Planner.app/Contents/MacOS/teacher-planner");
        assert_eq!(
            app_folder_for_exe(exe),
            PathBuf::from("/Users/t/Drive/Agenda")
        );
    }

    #[test]
    fn plain_executable_resolves_to_its_own_folder() {
        let exe = Path::new("/Users/t/Drive/Agenda/teacher-planner.exe");
        assert_eq!(
            app_folder_for_exe(exe),
            PathBuf::from("/Users/t/Drive/Agenda")
        );
    }

    #[test]
    fn a_dot_app_component_deeper_in_the_path_still_resolves_the_outermost_bundle() {
        // A folder literally named `X.app` above the bundle must not win over the
        // real bundle; `ancestors()` hits the innermost one first, which is right.
        let exe = Path::new("/Users/t/X.app/Teacher Planner.app/Contents/MacOS/tp");
        assert_eq!(app_folder_for_exe(exe), PathBuf::from("/Users/t/X.app"));
    }
}
