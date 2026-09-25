//! Dated snapshots of the data file, and thinning them.
//!
//! Retention, per the spec's resolved table: keep every snapshot from the last
//! 7 days, then one per day out to 30 days, then one per calendar month.
//!
//! **Tuned at M9** — the schedule itself is resolved and unchanged; three
//! things about *taking* a snapshot were not safe or not sensible enough:
//!
//! * **A snapshot is written under a temporary name and renamed into place.**
//!   Before M9 it was copied straight to its final name, so an app killed or a
//!   machine slept mid-copy left a truncated file that looked exactly like a
//!   good snapshot — and thinning could then keep that one as the day's and
//!   delete a good one beside it.
//! * **A snapshot is copied under a read lock**, so it cannot catch a write
//!   half-committed. The 30-minute snapshot runs on its own thread, and a save
//!   landing in the same few milliseconds could otherwise be copied with some
//!   of its pages written and some not — a backup that fails `integrity_check`.
//!   The lock makes the copy wait for the commit, and a commit wait for the
//!   copy. Neither side reports "database is locked" for a wait of
//!   milliseconds, because rusqlite gives every connection a five-second busy
//!   timeout by default — a test holds that, so a change of library that
//!   dropped it would be noticed.
//! * **An automatic snapshot of an unchanged file is skipped.** Launch, the
//!   30-minute timer and a clean quit each used to copy the file whether or not
//!   anything had changed, so an afternoon with the app left open wrote a dozen
//!   identical 400 KB files for the sync client to upload and the schedule to
//!   keep for a week. The button in the storage panel still always writes one,
//!   because the teacher asked for it.

use crate::paths;
use chrono::{DateTime, Datelike, Local, NaiveDateTime, TimeZone};
use rusqlite::Connection;
use std::collections::BTreeSet;
use std::path::{Path, PathBuf};

const STAMP: &str = "%Y-%m-%d-%H%M";
const PREFIX: &str = "planner-";
const SUFFIX: &str = ".sqlite";
/// What a snapshot is called while it is being written. It never parses as a
/// snapshot, so an interrupted one is never counted, kept or thinned — and
/// the next snapshot clears it away.
const PARTIAL: &str = ".partial";

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

/// Copies the current data file into `data/backups/` — **always**, even when
/// the newest snapshot already holds exactly these bytes — then thins old
/// snapshots. This is the storage panel's button: the teacher asked for one.
/// A no-op if there is no data file yet (first run, before anything was saved).
pub fn snapshot_now() -> std::io::Result<Option<PathBuf>> {
    snapshot_in(
        &paths::db_path(),
        &paths::backups_dir(),
        Local::now().naive_local(),
        false,
    )
}

/// The automatic snapshot — at launch, every 30 minutes, and on a clean quit.
/// Skips the copy when the newest snapshot already holds exactly this file
/// (M9), and thins either way.
pub fn snapshot_if_changed() -> std::io::Result<Option<PathBuf>> {
    snapshot_in(
        &paths::db_path(),
        &paths::backups_dir(),
        Local::now().naive_local(),
        true,
    )
}

/// The snapshot itself, over explicit paths and an explicit clock so the rules
/// are testable without the process-wide data folder or a real wait.
///
/// Returns the snapshot that now holds the file: the one written, or — when an
/// unchanged file was skipped — the newest one, which is identical to it.
pub fn snapshot_in(
    db: &Path,
    dir: &Path,
    now: NaiveDateTime,
    only_if_changed: bool,
) -> std::io::Result<Option<PathBuf>> {
    if !db.exists() {
        return Ok(None);
    }
    std::fs::create_dir_all(dir)?;
    remove_partials(dir);

    if only_if_changed {
        if let Some((_, newest)) = list_snapshots(dir)?.pop() {
            if same_bytes(db, &newest)? {
                thin(dir, now)?;
                return Ok(Some(newest));
            }
        }
    }

    let dest = dir.join(snapshot_name(now));
    // Within the same minute the name collides; that snapshot is already current.
    if !dest.exists() {
        copy_consistently(db, &dest)?;
    }
    thin(dir, now)?;
    Ok(Some(dest))
}

/// Copies the data file to `dest` under a read lock, through a temporary name.
///
/// The read transaction takes SQLite's shared lock, which a writer must wait
/// for before it can write a single page of its commit — so the bytes copied
/// are a committed state, never half of one. Opening the connection also rolls
/// back a hot journal left by a crash — the same recovery any open does — so
/// the copy is never of a torn file either. A read transaction writes nothing.
fn copy_consistently(db: &Path, dest: &Path) -> std::io::Result<()> {
    copy_consistently_with(db, dest, |from, to| std::fs::copy(from, to).map(|_| ()))
}

/// [`copy_consistently`], with the byte copy passed in — so a test can act
/// *during* the copy: try to write to the data file while it runs, or stop it
/// halfway as a killed app would.
fn copy_consistently_with(
    db: &Path,
    dest: &Path,
    copy: impl FnOnce(&Path, &Path) -> std::io::Result<()>,
) -> std::io::Result<()> {
    let io = |e: rusqlite::Error| std::io::Error::other(e);
    let partial = partial_name(dest);
    // rusqlite's default five-second busy timeout lets this wait out a commit.
    let conn = Connection::open(db).map_err(io)?;
    conn.execute_batch("BEGIN").map_err(io)?;
    // A read, to take the shared lock: BEGIN alone takes none. The lock is
    // held until the COMMIT below, i.e. for the whole of the copy.
    let copied = conn
        .query_row("SELECT count(*) FROM sqlite_master", [], |r| {
            r.get::<_, i64>(0)
        })
        .map_err(io)
        .and_then(|_| copy(db, &partial));
    let _ = conn.execute_batch("COMMIT");
    drop(conn);
    if let Err(e) = copied {
        let _ = std::fs::remove_file(&partial);
        return Err(e);
    }
    std::fs::rename(&partial, dest)
}

fn partial_name(dest: &Path) -> PathBuf {
    let mut name = dest.file_name().unwrap_or_default().to_os_string();
    name.push(PARTIAL);
    dest.with_file_name(name)
}

/// Clears away our own interrupted copies. Only names this module makes —
/// `planner-….sqlite.partial` — are touched; anything else in the folder,
/// including a sync client's conflict copies, is left exactly where it is.
fn remove_partials(dir: &Path) {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return;
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let Some(name) = name.to_str() else { continue };
        if name.starts_with(PREFIX) && name.ends_with(&format!("{SUFFIX}{PARTIAL}")) {
            let _ = std::fs::remove_file(entry.path());
        }
    }
}

/// Whether two files hold exactly the same bytes. A file read mid-write can
/// only compare unequal, which errs on the side of taking the snapshot.
fn same_bytes(a: &Path, b: &Path) -> std::io::Result<bool> {
    if std::fs::metadata(a)?.len() != std::fs::metadata(b)?.len() {
        return Ok(false);
    }
    Ok(std::fs::read(a)? == std::fs::read(b)?)
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
    use std::time::Duration;

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

    // ------------------------------------------------ M9: tuning, checked ---

    fn a_data_file(dir: &Path) -> PathBuf {
        let db = dir.join("planner.sqlite");
        let conn = crate::db::open_at(&db).unwrap();
        conn.execute("UPDATE school_year SET start_date = '2026-09-14'", [])
            .unwrap();
        db
    }

    fn snapshots_in(dir: &Path) -> Vec<String> {
        let mut names: Vec<String> = std::fs::read_dir(dir)
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        names.sort();
        names
    }

    #[test]
    fn an_interrupted_copy_is_never_mistaken_for_a_snapshot_and_is_cleared_away() {
        assert_eq!(timestamp_of("planner-2026-09-19-0730.sqlite.partial"), None);

        let dir = tempfile::tempdir().unwrap();
        let db = a_data_file(dir.path());
        let backups = dir.path().join("backups");
        std::fs::create_dir_all(&backups).unwrap();
        // What a copy killed halfway through leaves behind, plus two files that
        // are not ours: a sync client's conflict copy and a stray note.
        std::fs::write(
            backups.join("planner-2026-09-19-0730.sqlite.partial"),
            b"half",
        )
        .unwrap();
        std::fs::write(backups.join("planner-2026-09-19-0730 (1).sqlite"), b"x").unwrap();
        std::fs::write(backups.join("notes.txt"), b"x").unwrap();

        snapshot_in(&db, &backups, at("2026-09-19 12:00"), false).unwrap();

        assert_eq!(
            snapshots_in(&backups),
            vec![
                "notes.txt",
                "planner-2026-09-19-0730 (1).sqlite",
                "planner-2026-09-19-1200.sqlite",
            ]
        );
        assert_eq!(
            std::fs::read(backups.join("planner-2026-09-19-1200.sqlite")).unwrap(),
            std::fs::read(&db).unwrap()
        );
    }

    #[test]
    fn an_unchanged_file_is_not_snapshotted_again_automatically_but_is_on_request() {
        let dir = tempfile::tempdir().unwrap();
        let db = a_data_file(dir.path());
        let backups = dir.path().join("backups");

        snapshot_in(&db, &backups, at("2026-09-19 08:00"), true).unwrap();
        // The 30-minute timer and a quit, with nothing saved in between.
        let kept = snapshot_in(&db, &backups, at("2026-09-19 08:30"), true).unwrap();
        snapshot_in(&db, &backups, at("2026-09-19 09:00"), true).unwrap();
        assert_eq!(
            snapshots_in(&backups),
            vec!["planner-2026-09-19-0800.sqlite"]
        );
        assert_eq!(kept, Some(backups.join("planner-2026-09-19-0800.sqlite")));

        // The button always writes: the teacher asked for one.
        snapshot_in(&db, &backups, at("2026-09-19 09:15"), false).unwrap();
        assert_eq!(snapshots_in(&backups).len(), 2);

        // A save, and the next automatic snapshot takes it.
        let conn = crate::db::open_at(&db).unwrap();
        conn.execute("UPDATE school_year SET start_date = '2026-09-07'", [])
            .unwrap();
        drop(conn);
        snapshot_in(&db, &backups, at("2026-09-19 09:30"), true).unwrap();
        assert_eq!(
            snapshots_in(&backups),
            vec![
                "planner-2026-09-19-0800.sqlite",
                "planner-2026-09-19-0915.sqlite",
                "planner-2026-09-19-0930.sqlite",
            ]
        );
    }

    /// **A snapshot never copies a write half-done: the data file cannot be
    /// written while the copy runs.** The copy step tries to write to the file
    /// itself, from another connection that will not wait — and is refused,
    /// because the snapshot holds the shared lock for the whole copy.
    #[test]
    fn no_save_can_write_to_the_file_while_a_snapshot_copies_it() {
        let dir = tempfile::tempdir().unwrap();
        let db = a_data_file(dir.path());
        let dest = dir.path().join("planner-2026-09-19-1200.sqlite");

        let mut written_during_copy = None;
        copy_consistently_with(&db, &dest, |from, to| {
            let other = Connection::open(from).unwrap();
            other.busy_timeout(Duration::from_millis(0)).unwrap();
            written_during_copy = Some(
                other
                    .execute("UPDATE school_year SET start_date = '2027-01-04'", [])
                    .is_ok(),
            );
            std::fs::copy(from, to).map(|_| ())
        })
        .unwrap();

        assert_eq!(
            written_during_copy,
            Some(false),
            "a write got in during the copy"
        );
        assert_eq!(std::fs::read(&dest).unwrap(), std::fs::read(&db).unwrap());
    }

    /// **A save that meets a snapshot waits for it rather than failing.** A
    /// reader holding the shared lock — as a snapshot does for the milliseconds
    /// of its copy — makes an ordinary `db::open_at` write wait, then succeed.
    /// This holds rusqlite's default busy timeout, which nothing in this app
    /// sets explicitly: M9 added a call to set it and then found, by removing
    /// the call and watching this test still pass, that it was the default.
    #[test]
    fn a_save_waits_for_a_snapshot_rather_than_failing() {
        let dir = tempfile::tempdir().unwrap();
        let db = a_data_file(dir.path());

        let reader = Connection::open(&db).unwrap();
        reader.execute_batch("BEGIN").unwrap();
        let _: i64 = reader
            .query_row("SELECT count(*) FROM sqlite_master", [], |r| r.get(0))
            .unwrap();
        let release = std::thread::spawn(move || {
            std::thread::sleep(Duration::from_millis(300));
            reader.execute_batch("COMMIT").unwrap();
        });

        let writer = crate::db::open_at(&db).unwrap();
        let saved = writer.execute("UPDATE school_year SET start_date = '2026-09-21'", []);
        release.join().unwrap();
        assert!(
            saved.is_ok(),
            "the save failed instead of waiting: {saved:?}"
        );
    }

    /// **A copy stopped halfway never leaves a file under a snapshot's name.**
    /// The copy writes half the bytes and the app dies (a panic stands in for
    /// the kill: nothing after it runs). What is left in the folder must not
    /// parse as a snapshot — and the next snapshot clears it away.
    #[test]
    fn a_copy_stopped_halfway_leaves_nothing_that_looks_like_a_snapshot() {
        let dir = tempfile::tempdir().unwrap();
        let db = a_data_file(dir.path());
        let backups = dir.path().join("backups");
        std::fs::create_dir_all(&backups).unwrap();
        let dest = backups.join("planner-2026-09-19-1200.sqlite");

        let killed = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = copy_consistently_with(&db, &dest, |from, to| {
                let bytes = std::fs::read(from).unwrap();
                std::fs::write(to, &bytes[..bytes.len() / 2]).unwrap();
                panic!("the app was killed mid-copy");
            });
        }));
        assert!(killed.is_err());
        assert!(list_snapshots(&backups).unwrap().is_empty());
        assert!(!dest.exists());

        snapshot_in(&db, &backups, at("2026-09-19 12:01"), false).unwrap();
        assert_eq!(
            snapshots_in(&backups),
            vec!["planner-2026-09-19-1201.sqlite"]
        );
    }

    /// Month boundaries are calendar months, not 30-day blocks: the last
    /// snapshot of 31 January and the first of 1 February are one minute apart
    /// and both survive as their months' keepers.
    #[test]
    fn a_month_boundary_is_the_calendar_month() {
        let now = at("2026-09-19 12:00");
        let stamps = vec![
            at("2026-01-30 10:00"),
            at("2026-01-31 23:59"),
            at("2026-02-01 00:00"),
            at("2026-02-01 00:01"),
        ];
        let mut deleted = snapshots_to_delete(now, &stamps);
        deleted.sort_unstable();
        assert_eq!(
            deleted,
            vec![at("2026-01-30 10:00"), at("2026-02-01 00:00")]
        );
    }

    /// The day bucket's edges: an age of 6 days 23 hours keeps everything, and
    /// 7 days exactly starts thinning to one per day.
    #[test]
    fn the_seven_and_thirty_day_edges() {
        let now = at("2026-09-19 12:00");
        let inside = vec![at("2026-09-12 13:00"), at("2026-09-12 14:00")];
        assert!(snapshots_to_delete(now, &inside).is_empty());
        let edge = vec![at("2026-09-12 11:00"), at("2026-09-12 12:00")];
        assert_eq!(
            snapshots_to_delete(now, &edge),
            vec![at("2026-09-12 11:00")]
        );
    }

    /// **What thinning guarantees, whatever clock it runs by and however
    /// many devices run it.** Checked over two years of snapshots, thinned by
    /// two devices in turn — one with a correct clock, one whose clock drifts
    /// hours behind and, on one pass, is set a whole year ahead — with each
    /// device's deletions carried to the other, as the sync client would.
    ///
    /// * **The newest snapshot of every calendar month survives every pass,
    ///   at any clock.** This is the promise that holds unconditionally.
    /// * Relative to each pass's own clock, the newest snapshot of every day in
    ///   the last 30 days survives, and everything from the last 7 days does.
    ///
    /// **Two things it does not guarantee, both found by earlier versions of
    /// this test and both recorded in the M9 note rather than hidden:**
    ///
    /// * *What is deleted does not only grow with time.* An older snapshot of a
    ///   day, thinned away while the day was in the one-per-day tier, is one a
    ///   fresh pass a day later would briefly have kept as its month's
    ///   representative. Nothing the schedule promises is lost — a newer
    ///   snapshot of the same day always survives — but the result depends on
    ///   when thinning ran.
    /// * *A clock set forward is not undone by setting it back.* The pass that
    ///   runs a year ahead thins everything that exists to one per month, and
    ///   the fine-grained snapshots it removed do not come back. Only the
    ///   monthly promise survives it; the day and week tiers start again from
    ///   the snapshots taken afterwards. Any schedule keyed on the clock has
    ///   this property; the one mitigation M0 took — never deleting a snapshot
    ///   stamped in the future — is what protects the *other* device's files.
    #[test]
    fn thinning_keeps_its_promises_across_two_devices_and_a_wrong_clock() {
        let mut stamps = Vec::new();
        let mut t = at("2025-01-01 08:00");
        let mut seed: u64 = 7;
        let mut next = || {
            seed = seed
                .wrapping_mul(6364136223846793005)
                .wrapping_add(1442695040888963407);
            (seed >> 33) as i64
        };
        while t < at("2026-12-31 00:00") {
            stamps.push(t);
            t += chrono::Duration::minutes(180 + next() % 900);
        }

        let newest_by = |set: &[NaiveDateTime], key: &dyn Fn(&NaiveDateTime) -> (i32, u32)| {
            let mut by: std::collections::BTreeMap<(i32, u32), NaiveDateTime> = Default::default();
            for s in set {
                let e = by.entry(key(s)).or_insert(*s);
                if s > e {
                    *e = *s;
                }
            }
            by.into_values().collect::<Vec<_>>()
        };

        let mut left = stamps.clone();
        let mut real = at("2025-02-01 12:00");
        let mut wrong_clock_at: Option<NaiveDateTime> = None;
        let mut pass = 0;
        while real < at("2027-03-01 00:00") {
            let now = match pass % 2 {
                0 => real,
                _ if pass == 101 => real + chrono::Duration::days(365),
                _ => real - chrono::Duration::minutes(next() % 600),
            };
            if pass == 101 {
                wrong_clock_at = Some(real);
            }
            // What has been written by now, in real time — a device cannot see
            // a snapshot that has not been taken yet, whatever its clock says.
            let created: Vec<_> = stamps.iter().copied().filter(|s| *s <= real).collect();
            let delivered: Vec<_> = left.iter().copied().filter(|s| *s <= real).collect();
            let doomed = snapshots_to_delete(now, &delivered);
            left.retain(|s| !doomed.contains(s));
            let alive = |s: &NaiveDateTime| left.contains(s);

            for s in newest_by(&created, &|s| (s.year(), s.month())) {
                assert!(
                    alive(&s),
                    "pass {pass} at {now}: the newest of its month, {s}, is gone"
                );
            }
            // The finer promises, for what the wrong clock has not already thinned.
            let judged: Vec<_> = created
                .iter()
                .copied()
                .filter(|s| wrong_clock_at.is_none_or(|w| pass == 101 || *s > w))
                .collect();
            for s in newest_by(&judged, &|s| (s.year(), s.ordinal())) {
                if (now - s).num_days() < 30 {
                    assert!(
                        alive(&s),
                        "pass {pass} at {now}: the newest of its day, {s}, is gone"
                    );
                }
            }
            for s in &judged {
                if (now - *s).num_days() < 7 {
                    assert!(
                        alive(s),
                        "pass {pass} at {now}: {s}, under a week old, is gone"
                    );
                }
            }
            real += chrono::Duration::hours(13 + next() % 40);
            pass += 1;
        }
        assert!(wrong_clock_at.is_some(), "the wrong-clock pass ran");
    }

    /// The wrong clock's cost, stated as a test rather than a sentence: one
    /// pass a year ahead leaves exactly one snapshot per month of what existed.
    #[test]
    fn a_clock_a_year_ahead_thins_what_exists_to_one_per_month() {
        let real = at("2026-09-19 12:00");
        let stamps: Vec<NaiveDateTime> = (0..40)
            .map(|d| real - chrono::Duration::hours(d * 10))
            .collect();
        let doomed = snapshots_to_delete(real + chrono::Duration::days(365), &stamps);
        let left: Vec<_> = stamps
            .iter()
            .copied()
            .filter(|s| !doomed.contains(s))
            .collect();
        // Forty snapshots over sixteen days, all in September: one survives,
        // and it is the newest.
        assert_eq!(left, vec![real]);
    }

    /// Two devices, the second a few minutes behind, each thinning the folder
    /// the sync client gives it: the survivors agree once both have thinned.
    #[test]
    fn two_devices_thinning_one_folder_agree() {
        let stamps: Vec<NaiveDateTime> = (0..60)
            .map(|d| at("2026-07-01 08:00") + chrono::Duration::hours(d * 20))
            .collect();
        let mac_now = at("2026-09-19 12:00");
        let pc_now = at("2026-09-19 11:56");

        let after_mac: Vec<_> = {
            let doomed = snapshots_to_delete(mac_now, &stamps);
            stamps
                .iter()
                .copied()
                .filter(|s| !doomed.contains(s))
                .collect()
        };
        // The PC receives the Mac's deletions and thins what is left.
        let after_both: Vec<_> = {
            let doomed = snapshots_to_delete(pc_now, &after_mac);
            after_mac
                .iter()
                .copied()
                .filter(|s| !doomed.contains(s))
                .collect()
        };
        // The other order.
        let after_pc: Vec<_> = {
            let doomed = snapshots_to_delete(pc_now, &stamps);
            stamps
                .iter()
                .copied()
                .filter(|s| !doomed.contains(s))
                .collect()
        };
        let after_both_other_way: Vec<_> = {
            let doomed = snapshots_to_delete(mac_now, &after_pc);
            after_pc
                .iter()
                .copied()
                .filter(|s| !doomed.contains(s))
                .collect()
        };
        assert_eq!(after_both, after_mac, "the PC deletes nothing the Mac kept");
        assert_eq!(after_both, after_both_other_way);
    }
}
