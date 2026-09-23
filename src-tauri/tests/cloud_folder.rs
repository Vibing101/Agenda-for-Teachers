//! End-to-end checks against a real folder on disk rather than through the UI.
//!
//! This is a separate integration binary, and deliberately a single test: it
//! sets `TEACHER_PLANNER_DATA_DIR`, which is process-wide, so it must not run
//! alongside another test that reads it.
//!
//! It covers the gate's persistence round-trip (write, quit, relaunch, the data
//! is intact) and M0's change-detection criterion, now carrying real M1 and M2
//! data: a school year, two classes, a student enrolled in both, that class's
//! gradebook — columns with and without a weight, marks of more than one type,
//! the pass threshold and a conduct rating — and, from M3, the teacher's master
//! timetable, a weekly lesson plan and all three scopes of agenda note. M4 adds
//! its own: an attendance mark and an absence event **on the same student and
//! the same date**, a behaviour incident, and a support plan with goals.

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

    // --- her week, her plan for it, and her notes (M3) ---
    // The hour class Α1 used to carry as its own slot is now a row of the
    // teacher's master timetable, with the class linked from one cell of it and
    // a playground duty in another that belongs to no class at all.
    let second_hour = store::save_timetable_period(
        &conn,
        &TimetablePeriod {
            id: 0,
            position: 0,
            name: "2η".into(),
            start_time: "09:20".into(),
            end_time: "10:05".into(),
        },
    )
    .unwrap();
    store::save_timetable_cell(
        &conn,
        &TimetableCell {
            period_id: second_hour,
            weekday: 1,
            class_id: Some(class_a),
            subject: String::new(),
            room: "203".into(),
            duty: String::new(),
            notes: String::new(),
        },
    )
    .unwrap();
    store::save_timetable_cell(
        &conn,
        &TimetableCell {
            period_id: second_hour,
            weekday: 5,
            class_id: None,
            subject: String::new(),
            room: String::new(),
            duty: "Εφημερία στο προαύλιο".into(),
            notes: "Μαζί με τη Μ. Νικολάου".into(),
        },
    )
    .unwrap();
    // A plan keyed by the Monday of a week in November — the row the start-date
    // change further down must not be able to touch.
    store::save_lesson_plan(
        &conn,
        &LessonPlan {
            class_id: class_a,
            week_monday: "2026-11-02".into(),
            notes: "Κεφάλαιο 4: εξισώσεις πρώτου βαθμού".into(),
            assessment: "Ολιγόλεπτο διαγώνισμα την Πέμπτη".into(),
        },
    )
    .unwrap();
    for (scope, date, body) in [
        ("day", "2026-11-05", "Συνάντηση με τη μητέρα στις 13:30"),
        (
            "week",
            "2026-11-02",
            "Εβδομάδα επανάληψης πριν το διαγώνισμα",
        ),
        (
            "month",
            "2026-11-01",
            "Εστίαση του μήνα: ανάγνωση στο σπίτι",
        ),
    ] {
        store::save_agenda_note(
            &conn,
            &AgendaNote {
                scope: scope.into(),
                date: date.into(),
                body: body.into(),
            },
        )
        .unwrap();
    }

    // --- her attendance, an incident and a support plan (M4) ---
    // The mark and the event are for the SAME student on the SAME date, and
    // they disagree: the grid says she was there, the register logs a late
    // arrival. M4's first acceptance criterion is that both survive intact.
    store::save_attendance_mark(
        &conn,
        &AttendanceMark {
            class_id: class_a,
            student_id: student,
            date: "2026-11-05".into(),
            state: "present".into(),
        },
    )
    .unwrap();
    store::save_absence_event(
        &conn,
        &AbsenceEvent {
            id: 0,
            class_id: class_a,
            student_id: student,
            date: "2026-11-05".into(),
            kind: "late".into(),
            clock_time: "08:35".into(),
            teaching_hour: "1η".into(),
            reason: "Καθυστέρηση λεωφορείου".into(),
            justified: true,
            follow_up: "informed".into(),
            frequent_note: "Τρίτη φορά αυτόν τον μήνα".into(),
        },
    )
    .unwrap();
    store::save_incident(
        &conn,
        &Incident {
            id: 0,
            student_id: student,
            class_id: Some(class_a),
            date: "2026-11-06".into(),
            what_happened: "Διαφωνία στο διάλειμμα".into(),
            action_taken: "Συζήτηση με τους δύο μαθητές".into(),
            parents_informed: true,
        },
    )
    .unwrap();
    let plan_id = store::save_support_plan(
        &conn,
        &SupportPlan {
            id: 0,
            student_id: student,
            position: 0,
            start_date: "2026-10-01".into(),
            monitoring_frequency: "Κάθε δεύτερη εβδομάδα".into(),
            strengths: "Ισχυρή προφορική έκφραση".into(),
            needs: "Δυσκολία στην αποκωδικοποίηση".into(),
            accommodations: "Επιπλέον χρόνος στις γραπτές εργασίες".into(),
            collaboration: "Συνεργασία με τη λογοθεραπεύτρια".into(),
            status: "Σε εφαρμογή — αναθεώρηση τον Ιανουάριο".into(),
            next_review: "2027-01-15".into(),
        },
    )
    .unwrap();
    store::save_support_goal(
        &conn,
        &SupportGoal {
            id: 0,
            plan_id,
            position: 0,
            goal: "Ανάγνωση κειμένου 80 λέξεων χωρίς βοήθεια".into(),
            progress: "in_progress".into(),
            monitored_on: "2026-11-20".into(),
        },
    )
    .unwrap();

    // M5 — and the pair this milestone is judged on: **a booking and a record
    // of what happened, for the same guardian on the same date.** They are in
    // two tables that cannot reach each other, so both must survive the quit
    // and come back disagreeing about nothing, because neither knows the other
    // exists.
    store::save_parent_contact(
        &conn,
        &ParentContact {
            id: 0,
            student_id: student,
            date: "2026-11-05".into(),
            guardian: "Άννα Παπαδοπούλου".into(),
            format: "phone".into(),
            reason: "Συχνές καθυστερήσεις το πρωί".into(),
            agreements: "Θα φεύγουν δέκα λεπτά νωρίτερα".into(),
            outcome: "Συνεννοηθήκαμε ήρεμα".into(),
            next_step: "Επανεξέταση σε δύο εβδομάδες".into(),
            remarks: "Η μητέρα δουλεύει βάρδιες".into(),
        },
    )
    .unwrap();
    store::save_parent_appointment(
        &conn,
        &ParentAppointment {
            id: 0,
            date: "2026-11-05".into(),
            clock_time: "13:30".into(),
            student_id: Some(student),
            guardian: "Άννα Παπαδοπούλου".into(),
            mode: "in_person".into(),
            place: "Αίθουσα 203".into(),
            status: "confirmed".into(),
            topic: "Πρόοδος στα Μαθηματικά".into(),
            outcome: "".into(),
        },
    )
    .unwrap();
    let meeting_id = store::save_staff_meeting(
        &conn,
        &StaffMeeting {
            id: 0,
            position: 0,
            kind: "council".into(),
            date: "2026-11-09".into(),
            clock_time: "14:00".into(),
            duration: "90 λεπτά".into(),
            attendees: "Όλοι οι διδάσκοντες του τμήματος".into(),
            agenda: "Πρόοδος τμήματος · δύο περιστατικά".into(),
            class_id: Some(class_a),
            notes: "Τα πρακτικά κρατήθηκαν από τη Μ. Νικολάου".into(),
        },
    )
    .unwrap();
    store::save_meeting_agreement(
        &conn,
        &MeetingAgreement {
            id: 0,
            meeting_id,
            position: 0,
            who: "Μ. Νικολάου".into(),
            what: "Επικοινωνία με τους γονείς δύο μαθητών".into(),
            deadline: "2026-11-16".into(),
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

    // The week, the plan and the notes came back whole — including the duty
    // cell with no class on it, which is the case a per-class timetable could
    // not have held at all.
    assert_eq!(reloaded.timetable_periods.len(), 1);
    assert_eq!(reloaded.timetable_periods[0].name, "2η");
    assert_eq!(reloaded.timetable_periods[0].start_time, "09:20");
    assert_eq!(reloaded.timetable_cells.len(), 2);
    let monday_cell = reloaded
        .timetable_cells
        .iter()
        .find(|c| c.weekday == 1)
        .unwrap();
    assert_eq!(monday_cell.class_id, Some(class_a));
    assert_eq!(monday_cell.room, "203");
    let duty_cell = reloaded
        .timetable_cells
        .iter()
        .find(|c| c.weekday == 5)
        .unwrap();
    assert_eq!(duty_cell.class_id, None);
    assert_eq!(duty_cell.duty, "Εφημερία στο προαύλιο");

    assert_eq!(reloaded.lesson_plans.len(), 1);
    assert_eq!(reloaded.lesson_plans[0].week_monday, "2026-11-02");
    assert_eq!(
        reloaded.lesson_plans[0].notes,
        "Κεφάλαιο 4: εξισώσεις πρώτου βαθμού"
    );
    assert_eq!(
        reloaded.lesson_plans[0].assessment,
        "Ολιγόλεπτο διαγώνισμα την Πέμπτη"
    );
    assert_eq!(reloaded.agenda_notes.len(), 3);

    // M4, read back from the file after a full quit and relaunch.
    //
    // The pair that matters: the grid still says `present` on 05.11 and the
    // register still logs a late arrival on 05.11, for the same student. The
    // two registers are independent and nothing derives one from the other, so
    // both have to be here, unchanged and disagreeing.
    assert_eq!(reloaded.attendance_marks.len(), 1);
    assert_eq!(reloaded.attendance_marks[0].date, "2026-11-05");
    assert_eq!(reloaded.attendance_marks[0].state, "present");
    assert_eq!(reloaded.absence_events.len(), 1);
    let event = &reloaded.absence_events[0];
    assert_eq!(event.date, "2026-11-05");
    assert_eq!(event.kind, "late");
    assert_eq!(event.clock_time, "08:35");
    assert_eq!(event.teaching_hour, "1η");
    assert_eq!(event.reason, "Καθυστέρηση λεωφορείου");
    assert!(event.justified);
    assert_eq!(event.follow_up, "informed");
    assert_eq!(event.frequent_note, "Τρίτη φορά αυτόν τον μήνα");
    assert_eq!(
        event.student_id, reloaded.attendance_marks[0].student_id,
        "the disagreement is about one student, which is the whole point"
    );

    assert_eq!(reloaded.incidents.len(), 1);
    assert_eq!(
        reloaded.incidents[0].what_happened,
        "Διαφωνία στο διάλειμμα"
    );
    assert_eq!(
        reloaded.incidents[0].action_taken,
        "Συζήτηση με τους δύο μαθητές"
    );
    assert!(reloaded.incidents[0].parents_informed);

    assert_eq!(reloaded.support_plans.len(), 1);
    let plan = &reloaded.support_plans[0];
    assert_eq!(plan.start_date, "2026-10-01");
    assert_eq!(plan.monitoring_frequency, "Κάθε δεύτερη εβδομάδα");
    assert_eq!(plan.strengths, "Ισχυρή προφορική έκφραση");
    assert_eq!(plan.needs, "Δυσκολία στην αποκωδικοποίηση");
    assert_eq!(plan.accommodations, "Επιπλέον χρόνος στις γραπτές εργασίες");
    assert_eq!(plan.collaboration, "Συνεργασία με τη λογοθεραπεύτρια");
    assert_eq!(plan.status, "Σε εφαρμογή — αναθεώρηση τον Ιανουάριο");
    assert_eq!(plan.next_review, "2027-01-15");
    assert_eq!(reloaded.support_goals.len(), 1);
    assert_eq!(reloaded.support_goals[0].progress, "in_progress");
    assert_eq!(reloaded.support_goals[0].monitored_on, "2026-11-20");
    assert_eq!(
        reloaded
            .agenda_notes
            .iter()
            .find(|n| n.scope == "month")
            .unwrap()
            .body,
        "Εστίαση του μήνα: ανάγνωση στο σπίτι"
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
    // M5, read back after the quit. Both halves of the contested pair, and
    // every field of each.
    assert_eq!(reloaded.parent_contacts.len(), 1);
    let contact = &reloaded.parent_contacts[0];
    assert_eq!(contact.date, "2026-11-05");
    assert_eq!(contact.guardian, "Άννα Παπαδοπούλου");
    assert_eq!(contact.format, "phone");
    assert_eq!(contact.reason, "Συχνές καθυστερήσεις το πρωί");
    assert_eq!(contact.agreements, "Θα φεύγουν δέκα λεπτά νωρίτερα");
    assert_eq!(contact.outcome, "Συνεννοηθήκαμε ήρεμα");
    assert_eq!(contact.next_step, "Επανεξέταση σε δύο εβδομάδες");
    assert_eq!(contact.remarks, "Η μητέρα δουλεύει βάρδιες");

    assert_eq!(reloaded.parent_appointments.len(), 1);
    let appointment = &reloaded.parent_appointments[0];
    assert_eq!(appointment.date, "2026-11-05");
    assert_eq!(appointment.clock_time, "13:30");
    assert_eq!(appointment.mode, "in_person");
    assert_eq!(appointment.place, "Αίθουσα 203");
    assert_eq!(appointment.status, "confirmed");
    assert_eq!(appointment.topic, "Πρόοδος στα Μαθηματικά");
    assert_eq!(
        appointment.outcome, "",
        "a booking that has not happened yet has no outcome, and that is not a defect"
    );
    // The point of the pair: same guardian, same day, two independent records.
    assert_eq!(appointment.date, contact.date);
    assert_eq!(appointment.guardian, contact.guardian);
    assert_eq!(appointment.student_id, Some(contact.student_id));

    assert_eq!(reloaded.staff_meetings.len(), 1);
    let meeting = &reloaded.staff_meetings[0];
    assert_eq!(meeting.kind, "council");
    assert_eq!(meeting.date, "2026-11-09");
    assert_eq!(meeting.clock_time, "14:00");
    assert_eq!(meeting.duration, "90 λεπτά");
    assert_eq!(meeting.attendees, "Όλοι οι διδάσκοντες του τμήματος");
    assert_eq!(meeting.agenda, "Πρόοδος τμήματος · δύο περιστατικά");
    assert_eq!(meeting.notes, "Τα πρακτικά κρατήθηκαν από τη Μ. Νικολάου");
    assert_eq!(reloaded.meeting_agreements.len(), 1);
    assert_eq!(reloaded.meeting_agreements[0].who, "Μ. Νικολάου");
    assert_eq!(reloaded.meeting_agreements[0].deadline, "2026-11-16");

    assert_eq!(moved.classes, reloaded.classes);
    assert_eq!(moved.students, reloaded.students);
    assert_eq!(moved.enrollments, reloaded.enrollments);
    assert_eq!(moved.grade_columns, reloaded.grade_columns);
    assert_eq!(moved.grade_values, reloaded.grade_values);
    assert_eq!(moved.grade_rows, reloaded.grade_rows);
    // M3's first acceptance criterion, end to end against a real file: the
    // week of 2 November is called a different week number now, and the plan
    // entered against it has not moved, changed or disappeared.
    assert_eq!(
        moved.lesson_plans, reloaded.lesson_plans,
        "a lesson plan is keyed by its actual Monday, not by a week index"
    );
    assert_eq!(moved.agenda_notes, reloaded.agenda_notes);
    assert_eq!(moved.timetable_periods, reloaded.timetable_periods);
    assert_eq!(moved.timetable_cells, reloaded.timetable_cells);
    // M4's records are keyed by actual dates too — a mark by its day, an event
    // and an incident by theirs — so moving the school year leaves them alone.
    assert_eq!(
        moved.attendance_marks, reloaded.attendance_marks,
        "an attendance mark is keyed by its actual date, not by a month index"
    );
    assert_eq!(moved.absence_events, reloaded.absence_events);
    assert_eq!(moved.incidents, reloaded.incidents);
    assert_eq!(moved.support_plans, reloaded.support_plans);
    assert_eq!(moved.support_goals, reloaded.support_goals);
    // M5's records are keyed by actual dates too — a contact by the day it
    // happened, an appointment by the day it is booked for, a meeting by the
    // day it sat — so moving the school year leaves all four alone.
    assert_eq!(moved.parent_contacts, reloaded.parent_contacts);
    assert_eq!(moved.parent_appointments, reloaded.parent_appointments);
    assert_eq!(moved.staff_meetings, reloaded.staff_meetings);
    assert_eq!(moved.meeting_agreements, reloaded.meeting_agreements);
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
