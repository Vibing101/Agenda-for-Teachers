//! Dated snapshots of the data file, and thinning them.
//!
//! Retention, per the spec's resolved table: keep every snapshot from the last
//! 7 days, then one per day out to 30 days, then one per calendar month.

use crate::paths;
use chrono::{DateTime, Datelike, Local, NaiveDateTime, TimeZone};
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

const STAMP: &str = "%Y-%m-%d-%H%M";
const PREFIX: &str = "planner-";
const SUFFIX: &str = ".sqlite";

/// Parses the timestamp back out of a snapshot filename.
/// Returns `None` for anything that is not one of our snapshots, so a stray
/// file in `backups/` is left alone rather than deleted.
pub fn timestamp_of(file_name: &str) -> Option<NaiveDateTime> {
    let stamp = file_name.strip_prefix(PREFIX)?.strip_suffix(SUFFIX)?;
    NaiveDateTime::parse_from_str(stamp, STAMP).ok()
}

pub fn snapshot_name(at: NaiveDateTime) -> String {
    format!("{PREFIX}{}{SUFFIX}", at.format(STAMP))
}

/// Decides which snapshots to delete. Pure over the input list so the retention
/// rule is unit-testable without touching the disk or waiting 30 days.
///
/// `now` is the reference point; `stamps` is every snapshot currently on disk.
pub fn snapshots_to_delete(now: NaiveDateTime, stamps: &[NaiveDateTime]) -> Vec<NaiveDateTime> {
    let mut keep: BTreeSet<NaiveDateTime> = BTreeSet::new();
    // Newest first, so the first snapshot seen for a given day/month is the one kept.
    let mut sorted: Vec<NaiveDateTime> = stamps.to_vec();
    sorted.sort_unstable();
    sorted.reverse();

    let mut kept_days: BTreeSet<(i32, u32)> = BTreeSet::new();
    let mut kept_months: BTreeSet<(i32, u32)> = BTreeSet::new();

    for &s in &sorted {
        let age_days = (now - s).num_days();
        if age_days < 0 {
            // A snapshot stamped in the future (clock skew across devices, or a
            // sync writing an older machine's file). Keep it; deleting data
            // because of a clock difference would be the worse failure.
            keep.insert(s);
        } else if age_days < 7 {
            keep.insert(s);
        } else if age_days < 30 {
            if kept_days.insert((s.year(), s.ordinal())) {
                keep.insert(s);
            }
        } else if kept_months.insert((s.year(), s.month())) {
            keep.insert(s);
        }
    }

    sorted.into_iter().filter(|s| !keep.contains(s)).collect()
}

fn list_snapshots(dir: &Path) -> std::io::Result<Vec<(NaiveDateTime, PathBuf)>> {
    let mut out = Vec::new();
    let entries = match std::fs::read_dir(dir) {
        Ok(e) => e,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(out),
        Err(e) => return Err(e),
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if let Some(ts) = timestamp_of(name) {
            out.push((ts, entry.path()));
        }
    }
    out.sort_by_key(|(ts, _)| *ts);
    Ok(out)
}

/// Copies the current data file into `data/backups/`, then thins old snapshots.
/// A no-op if there is no data file yet (first run, before anything was saved).
pub fn snapshot_now() -> std::io::Result<Option<PathBuf>> {
    let db = paths::db_path();
    if !db.exists() {
        return Ok(None);
    }
    let dir = paths::backups_dir();
    std::fs::create_dir_all(&dir)?;

    let now = Local::now().naive_local();
    let dest = dir.join(snapshot_name(now));
    // Within the same minute the name collides; that snapshot is already current.
    if !dest.exists() {
        std::fs::copy(&db, &dest)?;
    }
    thin(&dir, now)?;
    Ok(Some(dest))
}

fn thin(dir: &Path, now: NaiveDateTime) -> std::io::Result<()> {
    let snapshots = list_snapshots(dir)?;
    let stamps: Vec<NaiveDateTime> = snapshots.iter().map(|(ts, _)| *ts).collect();
    let doomed = snapshots_to_delete(now, &stamps);
    for (ts, path) in &snapshots {
        if doomed.contains(ts) {
            // A snapshot we fail to delete is not worth aborting the app over.
            let _ = std::fs::remove_file(path);
        }
    }
    Ok(())
}

pub fn count_snapshots() -> usize {
    list_snapshots(&paths::backups_dir())
        .map(|v| v.len())
        .unwrap_or(0)
}

pub fn latest_snapshot_iso() -> Option<String> {
    let snapshots = list_snapshots(&paths::backups_dir()).ok()?;
    let (ts, _) = snapshots.last()?;
    Some(
        Local
            .from_local_datetime(ts)
            .single()
            .map(|dt: DateTime<Local>| dt.to_rfc3339())
            .unwrap_or_else(|| ts.to_string()),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    fn at(s: &str) -> NaiveDateTime {
        NaiveDateTime::parse_from_str(s, "%Y-%m-%d %H:%M").unwrap()
    }

    #[test]
    fn filename_round_trips() {
        let ts = at("2026-09-19 07:30");
        assert_eq!(snapshot_name(ts), "planner-2026-09-19-0730.sqlite");
        assert_eq!(timestamp_of("planner-2026-09-19-0730.sqlite"), Some(ts));
    }

    #[test]
    fn unrelated_files_are_not_recognised_as_snapshots() {
        assert_eq!(timestamp_of("planner.sqlite"), None);
        assert_eq!(timestamp_of("notes.txt"), None);
        assert_eq!(timestamp_of("planner-not-a-date.sqlite"), None);
    }

    #[test]
    fn everything_inside_seven_days_is_kept() {
        let now = at("2026-09-19 12:00");
        let stamps = vec![
            at("2026-09-19 09:00"),
            at("2026-09-19 11:00"),
            at("2026-09-18 08:00"),
            at("2026-09-14 08:00"),
        ];
        assert!(snapshots_to_delete(now, &stamps).is_empty());
    }

    #[test]
    fn between_seven_and_thirty_days_thins_to_one_per_day() {
        let now = at("2026-09-19 12:00");
        let stamps = vec![
            at("2026-09-01 08:00"),
            at("2026-09-01 13:00"),
            at("2026-09-01 19:00"),
            at("2026-09-02 09:00"),
        ];
        let deleted = snapshots_to_delete(now, &stamps);
        // Newest of each day survives.
        assert_eq!(
            deleted,
            vec![at("2026-09-01 13:00"), at("2026-09-01 08:00")]
        );
    }

    #[test]
    fn beyond_thirty_days_thins_to_one_per_month() {
        let now = at("2026-09-19 12:00");
        let stamps = vec![
            at("2026-05-02 08:00"),
            at("2026-05-20 08:00"),
            at("2026-06-03 08:00"),
            at("2026-06-28 08:00"),
        ];
        let mut deleted = snapshots_to_delete(now, &stamps);
        deleted.sort_unstable();
        assert_eq!(
            deleted,
            vec![at("2026-05-02 08:00"), at("2026-06-03 08:00")]
        );
    }

    #[test]
    fn future_stamped_snapshots_are_never_deleted() {
        let now = at("2026-09-19 12:00");
        let stamps = vec![at("2026-12-01 08:00"), at("2026-12-02 08:00")];
        assert!(snapshots_to_delete(now, &stamps).is_empty());
    }

    #[test]
    fn thinning_is_idempotent() {
        let now = at("2026-09-19 12:00");
        let stamps = vec![
            at("2026-09-01 08:00"),
            at("2026-09-01 13:00"),
            at("2026-05-02 08:00"),
            at("2026-05-20 08:00"),
            at("2026-09-18 08:00"),
        ];
        let doomed = snapshots_to_delete(now, &stamps);
        let survivors: Vec<NaiveDateTime> = stamps
            .iter()
            .copied()
            .filter(|s| !doomed.contains(s))
            .collect();
        assert!(snapshots_to_delete(now, &survivors).is_empty());
    }

    #[test]
    fn snapshot_and_thin_against_a_real_directory() {
        let dir = tempfile::tempdir().unwrap();
        for name in [
            "planner-2026-09-19-0900.sqlite", // today
            "planner-2026-09-01-0800.sqlite", // 18 days -> daily bucket
            "planner-2026-09-01-1300.sqlite", // same day, newer
            "planner-keep-me.txt",            // not ours
        ] {
            std::fs::write(dir.path().join(name), b"x").unwrap();
        }
        thin(dir.path(), at("2026-09-19 12:00")).unwrap();

        assert!(dir.path().join("planner-2026-09-19-0900.sqlite").exists());
        assert!(dir.path().join("planner-2026-09-01-1300.sqlite").exists());
        assert!(!dir.path().join("planner-2026-09-01-0800.sqlite").exists());
        assert!(dir.path().join("planner-keep-me.txt").exists());
    }
}
