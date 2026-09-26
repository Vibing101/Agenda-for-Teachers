//! M9's two-device release gate, as a tool: write a known set of records into
//! the data file of a real synced folder, and dump a data file record by record
//! so two devices' copies can be compared.
//!
//! It writes through the **same storage functions the app's commands call**
//! (`db::open`, which migrates, then `store::save_*`), because an agent cannot
//! click in the app. What the app itself did on each device — launch, read the
//! file, snapshot it, block a write — is exercised with the packaged build.
//!
//! ```text
//! TEACHER_PLANNER_DATA_DIR=<synced folder> cargo run --example two_device -- write
//! TEACHER_PLANNER_DATA_DIR=<synced folder> cargo run --example two_device -- write-back
//! cargo run --example two_device -- dump <planner.sqlite>
//! ```
//!
//! `write` is one of everything from M1 to M9 — the same records
//! `tests/cloud_folder.rs` round-trips, including M8's cover and leave on one
//! date and a training line with no cost — so a mismatch on the other device
//! would be a real one. `write-back` is what device 2 writes on the way back:
//! a change to an existing record, a new one in three modules, and the
//! language switched back to Greek.

use teacher_planner_lib::model::*;
use teacher_planner_lib::{db, store};

fn main() {
    let args: Vec<String> = std::env::args().collect();
    match args.get(1).map(String::as_str) {
        Some("write") => {
            let conn = db::open().unwrap();
            write_everything(&conn);
            println!(
                "{}",
                serde_json::to_string(&store::load(&conn).unwrap())
                    .unwrap()
                    .len()
            );
        }
        Some("write-back") => {
            let conn = db::open().unwrap();
            write_back(&conn);
            println!(
                "{}",
                serde_json::to_string(&store::load(&conn).unwrap())
                    .unwrap()
                    .len()
            );
        }
        Some("dump") => {
            let path = std::path::PathBuf::from(args.get(2).expect("dump <planner.sqlite>"));
            let conn = db::open_at(&path).unwrap();
            println!(
                "{}",
                serde_json::to_string_pretty(&store::load(&conn).unwrap()).unwrap()
            );
        }
        _ => eprintln!("usage: two_device write | write-back | dump <planner.sqlite>"),
    }
}

#[allow(unused_variables)]
fn write_everything(conn: &rusqlite::Connection) {
    // --- the teacher sets up her year, a couple of classes and a student ---
    store::save_school_year(
        conn,
        &SchoolYear {
            year_model: "sep_aug".into(),
            start_date: "2026-09-14".into(),
        },
    )
    .unwrap();

    let class_a = store::save_class(
        conn,
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
        conn,
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
        conn,
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
            conn,
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
        conn,
        &ClassGrading {
            class_id: class_a,
            pass_threshold: 12.0,
            scale_max: 20.0,
            period: "Α΄ τρίμηνο".into(),
        },
    )
    .unwrap();
    let mark_column = store::save_grade_column(
        conn,
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
        conn,
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
        conn,
        &GradeValue {
            class_id: class_a,
            column_id: mark_column,
            student_id: student,
            value: "17.5".into(),
        },
    )
    .unwrap();
    store::set_grade_value(
        conn,
        &GradeValue {
            class_id: class_a,
            column_id: comment_column,
            student_id: student,
            value: "Δούλεψε πολύ καλά — χρειάζεται στήριξη στα κλάσματα".into(),
        },
    )
    .unwrap();
    store::save_grade_row(
        conn,
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
        conn,
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
        conn,
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
        conn,
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
        conn,
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
            conn,
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
        conn,
        &AttendanceMark {
            class_id: class_a,
            student_id: student,
            date: "2026-11-05".into(),
            period_id: 0,
            state: "present".into(),
        },
    )
    .unwrap();
    store::save_absence_event(
        conn,
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
        conn,
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
        conn,
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
        conn,
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
        conn,
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
        conn,
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
        conn,
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
        conn,
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

    // M6 — the annual plan and the rest of teaching. The unit is the annual
    // plan's row and the unit card at once; the exam, the trip, the reflection,
    // the textbook and the resource are the five lists that grow all year.
    //
    // **No progress-matrix row is written here, and none exists.** The matrix
    // is a view over the lesson plan above, so what proves it survives a quit
    // is that the *plan* does.
    store::save_unit(
        conn,
        &Unit {
            id: 0,
            class_id: class_a,
            position: 0,
            title: "Εξισώσεις πρώτου βαθμού".into(),
            period: "Α΄ τρίμηνο".into(),
            hours: "12".into(),
            deadlines: "Παράδοση εργασιών 20.11.2026".into(),
            objectives: "Να λύνουν εξίσωση με έναν άγνωστο".into(),
            skills: "Αλγεβρικός χειρισμός · έλεγχος λύσης".into(),
            methods: "Ομαδοσυνεργατική · φύλλα εργασίας".into(),
            assessment: "Ολιγόλεπτο διαγώνισμα και εργασία".into(),
            content: "Κεφάλαιο 4, ενότητες 4.1–4.4".into(),
            materials: "Διαδραστικός πίνακας, φυλλάδια".into(),
            differentiation: "Επιπλέον χρόνος · φύλλο με βήματα".into(),
            review: "Πήγε καλά· χρειάζεται μία ώρα παραπάνω".into(),
        },
    )
    .unwrap();
    store::save_exam(
        conn,
        &Exam {
            id: 0,
            class_id: Some(class_a),
            date: "2026-11-19".into(),
            kind: "Ολιγόλεπτο διαγώνισμα".into(),
            scope: "Κεφάλαιο 4, ενότητες 4.1–4.3".into(),
            weight: "20%".into(),
            collaboration: "Κοινό θέμα με τη Μ. Νικολάου".into(),
        },
    )
    .unwrap();
    store::save_lesson_reflection(
        conn,
        &LessonReflection {
            id: 0,
            class_id: Some(class_a),
            date: "2026-11-05".into(),
            notes: "Το παιχνίδι ρόλων δούλεψε· λιγότερη θεωρία στην αρχή".into(),
        },
    )
    .unwrap();
    let trip_id = store::save_trip(
        conn,
        &Trip {
            id: 0,
            position: 0,
            date: "2026-12-04".into(),
            activity: "Επίσκεψη στο Αρχαιολογικό Μουσείο".into(),
            class_id: Some(class_a),
            responsible: "Μ. Νικολάου".into(),
            transport: "Λεωφορείο του σχολείου".into(),
            cost: "5 ευρώ ανά μαθητή".into(),
            checklist: "Συγκαταθέσεις · φαγητό · φαρμακείο".into(),
            evaluation: "Πολύ καλή ανταπόκριση".into(),
        },
    )
    .unwrap();
    store::set_trip_consent(
        conn,
        &TripConsent {
            trip_id,
            student_id: student,
            state: "given".into(),
            note: "Παραδόθηκε 28.11".into(),
        },
    )
    .unwrap();
    store::save_textbook(
        conn,
        &Textbook {
            id: 0,
            position: 0,
            subject: "Μαθηματικά".into(),
            title: "Μαθηματικά Β΄ Γυμνασίου".into(),
            publisher: "ΥΑΠ".into(),
            isbn: "978-9963-0-0000-1".into(),
            level: "Β΄ Γυμνασίου".into(),
            price: "δωρεάν".into(),
            status: "Σε χρήση".into(),
            remarks: "Δύο αντίτυπα λείπουν".into(),
        },
    )
    .unwrap();
    store::save_resource(
        conn,
        &Resource {
            id: 0,
            category: "websites".into(),
            position: 0,
            title: "GeoGebra".into(),
            detail: "https://www.geogebra.org".into(),
            notes: "Για τη γεωμετρία".into(),
        },
    )
    .unwrap();

    // M7 — a saved print form, and the substitute folder's own texts in all
    // three states: written, cleared, and (by having no row) untouched.
    //
    // **No seat, roster or week is written for the folder here, and none
    // exists to write.** The folder reads M1's seating and M3's plan live, so
    // what proves it survives a quit is that *they* do — which the M1 and M3
    // halves of this test already assert.
    let form_id = store::save_print_form(
        conn,
        &PrintForm {
            id: 0,
            kind: "minutes".into(),
            name: "Σύλλογος Νοεμβρίου".into(),
            created: "2026-11-09".into(),
            updated: "2026-11-09".into(),
            values: Default::default(),
        },
    )
    .unwrap();
    store::set_print_form_value(conn, form_id, "kind", "Σύλλογος Διδασκόντων", "2026-11-09")
        .unwrap();
    store::set_print_form_value(
        conn,
        form_id,
        "agenda",
        "1. Πρόοδος\n2. Εκδρομή",
        "2026-11-09",
    )
    .unwrap();
    store::set_substitute_text(conn, Some(class_a), "rules", "Μπαίνουμε με τη σειρά.").unwrap();
    store::set_substitute_text(conn, Some(class_a), "materials", "").unwrap();
    store::set_substitute_text(conn, None, "contact.principal", "Α. Νικολάου · 22 123456").unwrap();

    // M8 — one of everything: a staff contact, a cover and a leave **on the
    // same date**, a development goal, a training line with a comma-typed cost
    // already parsed to 12.5 and a blank one left as "not entered", the
    // budget, a wellbeing reflection and the page's two standing boxes.
    store::save_staff_contact(
        conn,
        &StaffContact {
            id: 0,
            position: 0,
            full_name: "Άννα Παπαδοπούλου".into(),
            role: "Υποδιευθύντρια".into(),
            phone: "22 123456".into(),
            email: "anna@school.example".into(),
        },
    )
    .unwrap();
    store::save_cover_record(
        conn,
        &CoverRecord {
            id: 0,
            date: "2026-11-12".into(),
            class_name: "Γ2".into(),
            covered: "Ιστορία, κεφ. 3".into(),
            teacher: "Κ. Γεωργίου".into(),
            notes: "Υπέγραψε ο υποδιευθυντής".into(),
        },
    )
    .unwrap();
    store::save_leave_record(
        conn,
        &LeaveRecord {
            id: 0,
            date: "2026-11-12".into(),
            reason: "Άδεια ασθενείας".into(),
            documents: "Ιατρικό πιστοποιητικό".into(),
        },
    )
    .unwrap();
    store::save_development_goal(
        conn,
        &DevelopmentGoal {
            id: 0,
            position: 0,
            goal: "Πιστοποίηση ΤΠΕ Β".into(),
            status: "Σε εξέλιξη".into(),
            progress: "2 από 4 ενότητες".into(),
            notes: "Εξετάσεις τον Μάρτιο".into(),
        },
    )
    .unwrap();
    for (cost, hours) in [(Some(12.5), Some(1.5)), (None, None)] {
        store::save_training_entry(
            conn,
            &TrainingEntry {
                id: 0,
                date: "2026-10-17".into(),
                activity: "Διαφοροποιημένη διδασκαλία".into(),
                organiser: "Παιδαγωγικό Ινστιτούτο".into(),
                hours,
                format: "Διαδικτυακό".into(),
                cost,
                certificate: "Αναμένεται".into(),
            },
        )
        .unwrap();
    }
    store::save_development_budget(
        conn,
        &DevelopmentBudget {
            amount: Some(300.0),
            notes: "Καλύπτει το σχολείο το μισό".into(),
        },
    )
    .unwrap();
    store::save_wellbeing_entry(
        conn,
        &WellbeingEntry {
            id: 0,
            date: "2026-11-13".into(),
            notes: "Βοήθησε το περπάτημα".into(),
        },
    )
    .unwrap();
    store::save_wellbeing_note(
        conn,
        &WellbeingNote {
            sustains: "Κολύμπι".into(),
            boundaries: "Όχι email μετά τις 8".into(),
        },
    )
    .unwrap();
    // M9 — the teacher switches the interface to English. It is stored in the
    // file, so it must come back after the quit like everything else, and it
    // must not move when the start date does.
    store::save_locale(conn, "en").unwrap();
}

/// Device 2's writes, on the way back: an edit, three new records, and the
/// language back to Greek. Each is something device 1 must then show.
fn write_back(conn: &rusqlite::Connection) {
    let planner = store::load(conn).unwrap();
    let mut class = planner.classes[0].clone();
    class.room = "Εργαστήριο 2 (από το PC)".into();
    store::save_class(conn, &class).unwrap();
    store::save_cover_record(
        conn,
        &CoverRecord {
            id: 0,
            date: "2026-11-19".into(),
            class_name: "Β3".into(),
            covered: "Γραμμένο στο PC".into(),
            teacher: "Α. Νικολάου".into(),
            notes: String::new(),
        },
    )
    .unwrap();
    store::save_staff_contact(
        conn,
        &StaffContact {
            id: 0,
            position: 9,
            full_name: "Επαφή από το PC".into(),
            role: "Γραμματεία".into(),
            phone: "22 000000".into(),
            email: "pc@example.org".into(),
        },
    )
    .unwrap();
    store::save_wellbeing_entry(
        conn,
        &WellbeingEntry {
            id: 0,
            date: "2026-11-20".into(),
            notes: "Γραμμένο στο PC".into(),
        },
    )
    .unwrap();
    store::save_locale(conn, "el").unwrap();
}
