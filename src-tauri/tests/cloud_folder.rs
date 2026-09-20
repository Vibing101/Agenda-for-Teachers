//! End-to-end checks against a real folder on disk rather than through the UI.
//!
//! This is a separate integration binary, and deliberately a single test: it
//! sets `TEACHER_PLANNER_DATA_DIR`, which is process-wide, so it must not run
//! alongside another test that reads it.
//!
//! It covers the gate's persistence round-trip (write, quit, relaunch, the data
//! is intact) and M0's change-detection criterion, now carrying real M1 and M2
//! data: a school year, two classes, a student enrolled in both, and that
//! class's gradebook — columns with and without a weight, marks of more than
//! one type, the pass threshold and a conduct rating.

use teacher_planner_lib::model::*;
use teacher_planner_lib::{backup, db, fingerprint::Fingerprint, paths, store};

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

    // --- the teacher sets up her year, a couple of classes and a student ---
    let conn = db::open().unwrap();
    store::save_school_year(
        &conn,
        &SchoolYear {
            year_model: "sep_aug".into(),
            start_date: "2026-09-14".into(),
        },
    )
    .unwrap();

    let class_a = store::save_class(
        &conn,
        &Class {
            id: 0,
            name: "Α1".into(),
            subject: "Μαθηματικά".into(),
            room: "203".into(),
            responsible: "Μ. Νικολάου".into(),
            notes: String::new(),
            position: 0,
            seating_rows: 5,
            seating_cols: 6,
            seating_notes: String::new(),
            slots: vec![ClassSlot {
                id: 0,
                class_id: 0,
                weekday: 1,
                period_label: "2η".into(),
                start_time: "09:20".into(),
                end_time: "10:05".into(),
                room: "203".into(),
            }],
        },
    )
    .unwrap();
    let class_b = store::save_class(
        &conn,
        &Class {
            id: 0,
            name: "Β2".into(),
            subject: "Φυσική".into(),
            room: "Εργαστήριο".into(),
            responsible: String::new(),
            notes: String::new(),
            position: 0,
            seating_rows: 5,
            seating_cols: 6,
            seating_notes: String::new(),
            slots: Vec::new(),
        },
    )
    .unwrap();

    let student = store::save_student(
        &conn,
        &Student {
            id: 0,
            full_name: "Ελένη Παπαδοπούλου".into(),
            register_number: "12345".into(),
            birth_date: "2014-03-07".into(),
            home_language: "Ελληνικά".into(),
            address: "Λευκωσία".into(),
            midyear_enrollment: false,
            guardian1_name: "Άννα Παπαδοπούλου".into(),
            guardian1_phone: "+357 99 123456".into(),
            guardian1_email: "anna@example.com".into(),
            guardian2_name: String::new(),
            guardian2_phone: String::new(),
            guardian2_email: String::new(),
            allergies: "Ξηροί καρποί".into(),
            conditions: "Άσθμα".into(),
            medication: "Σαλβουταμόλη".into(),
            emergency_phone: "+357 22 800800".into(),
            sen_status: "accommodations".into(),
            sen_plan: "ΕΠΕ 04/2026".into(),
            sen_accommodations: "Επιπλέον χρόνος".into(),
            notes: "Μπροστινό θρανίο".into(),
            meeting_notes: "18/09 συνάντηση".into(),
        },
    )
    .unwrap();
    for class_id in [class_a, class_b] {
        store::set_enrollment(
            &conn,
            &Enrollment {
                class_id,
                student_id: student,
                roster_no: 0,
                support: class_id == class_a,
                note: String::new(),
            },
        )
        .unwrap();
    }
    // --- and then her gradebook for that class ---
    store::save_class_grading(
        &conn,
        &ClassGrading {
            class_id: class_a,
            pass_threshold: 12.0,
            scale_max: 20.0,
            period: "Α΄ τρίμηνο".into(),
        },
    )
    .unwrap();
    let mark_column = store::save_grade_column(
        &conn,
        &GradeColumn {
            id: 0,
            class_id: class_a,
            position: 0,
            label: "Διαγώνισμα".into(),
            kind: "numeric".into(),
            weight: Some(60.0),
        },
    )
    .unwrap();
    // Deliberately left unweighted: "not decided yet" has to survive the round
    // trip as blank, because a zero would change every average on the sheet.
    let comment_column = store::save_grade_column(
        &conn,
        &GradeColumn {
            id: 0,
            class_id: class_a,
            position: 1,
            label: "Σχόλιο".into(),
            kind: "comment".into(),
            weight: None,
        },
    )
    .unwrap();
    store::set_grade_value(
        &conn,
        &GradeValue {
            class_id: class_a,
            column_id: mark_column,
            student_id: student,
            value: "17.5".into(),
        },
    )
    .unwrap();
    store::set_grade_value(
        &conn,
        &GradeValue {
            class_id: class_a,
            column_id: comment_column,
            student_id: student,
            value: "Δούλεψε πολύ καλά — χρειάζεται στήριξη στα κλάσματα".into(),
        },
    )
    .unwrap();
    store::save_grade_row(
        &conn,
        &GradeRow {
            class_id: class_a,
            student_id: student,
            conduct: "very_good".into(),
            observations: "Βοηθά τους συμμαθητές της".into(),
            overall_result: "Ικανοποιητική πορεία".into(),
        },
    )
    .unwrap();

    let saved = store::load(&conn).unwrap();
    drop(conn); // the app quits
    let after_write = Fingerprint::of(&paths::db_path()).unwrap();

    // The data file is self-contained at rest: no WAL sidecars for a sync
    // client to carry away separately.
    assert!(!paths::data_dir().join("planner.sqlite-wal").exists());
    assert!(!paths::data_dir().join("planner.sqlite-shm").exists());

    // --- relaunch: a snapshot is taken, and everything is still there ---
    assert!(backup::snapshot_now().unwrap().is_some());
    assert_eq!(backup::count_snapshots(), 1);

    let conn = db::open().unwrap();
    let reloaded = store::load(&conn).unwrap();
    assert_eq!(
        reloaded, saved,
        "every field survives a full quit and relaunch"
    );
    assert_eq!(reloaded.school_year.start_date, "2026-09-14");
    assert_eq!(reloaded.students[0].full_name, "Ελένη Παπαδοπούλου");
    assert_eq!(
        reloaded.enrollments.len(),
        2,
        "the student shows on both class rosters"
    );

    // The gradebook came back whole, including the two things most easily lost
    // in a round trip: an undecided weight, and a written conduct result.
    let grading = reloaded
        .class_gradings
        .iter()
        .find(|g| g.class_id == class_a)
        .unwrap();
    assert_eq!(grading.pass_threshold, 12.0);
    assert_eq!(grading.period, "Α΄ τρίμηνο");
    let weights: Vec<Option<f64>> = reloaded
        .grade_columns
        .iter()
        .filter(|c| c.class_id == class_a)
        .map(|c| c.weight)
        .collect();
    assert_eq!(
        weights,
        vec![Some(60.0), None],
        "a blank weight must not come back as zero"
    );
    assert_eq!(reloaded.grade_values.len(), 2);
    assert!(reloaded
        .grade_values
        .iter()
        .any(|v| v.value == "Δούλεψε πολύ καλά — χρειάζεται στήριξη στα κλάσματα"));
    assert_eq!(reloaded.grade_rows[0].conduct, "very_good");
    assert_eq!(
        reloaded.grade_rows[0].overall_result,
        "Ικανοποιητική πορεία"
    );

    // --- the start date moves, and nothing else does ---
    store::save_school_year(
        &conn,
        &SchoolYear {
            year_model: "sep_aug".into(),
            start_date: "2026-09-07".into(),
        },
    )
    .unwrap();
    let moved = store::load(&conn).unwrap();
    assert_eq!(moved.classes, reloaded.classes);
    assert_eq!(moved.students, reloaded.students);
    assert_eq!(moved.enrollments, reloaded.enrollments);
    assert_eq!(moved.grade_columns, reloaded.grade_columns);
    assert_eq!(moved.grade_values, reloaded.grade_values);
    assert_eq!(moved.grade_rows, reloaded.grade_rows);
    drop(conn);

    // Opening and reading must not disturb the file, or every session would
    // look like a conflict.
    let conn = db::open().unwrap();
    let _ = store::load(&conn).unwrap();
    drop(conn);
    let read_only_pass = Fingerprint::of(&paths::db_path()).unwrap();

    // --- the other device's copy lands while this session is open ---
    let conn = db::open().unwrap();
    store::save_student(
        &conn,
        &Student {
            full_name: "Γραμμένο αλλού".into(),
            ..store::load(&conn).unwrap().students[0].clone()
        },
    )
    .unwrap();
    drop(conn);
    assert_ne!(
        Fingerprint::of(&paths::db_path()).unwrap(),
        read_only_pass,
        "an outside write must be visible as a fingerprint change, which is what blocks the save"
    );
    assert_ne!(after_write, None);

    std::env::remove_var(paths::DATA_DIR_ENV);
}
