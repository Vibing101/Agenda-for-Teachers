//! Ατζέντα Εκπαιδευτικού — the Rust half of the app.
//!
//! M0 laid the foundation: packaging, file I/O, backups and the
//! changed-on-disk guard, all proven from inside a cloud-synced folder.
//! M1 puts the first real data behind it — school year, classes, students; M2
//! the gradebook; M3 the teacher's master timetable, her weekly lesson plans
//! and her agenda notes; M4 attendance, absence events, behaviour incidents
//! and support plans; M5 the parent communication log, the parent-appointment
//! grid, staff meetings and their agreements.
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
pub mod pdf;
pub mod store;

use error::{AppError, AppResult};
use fingerprint::Fingerprint;
use model::*;
use serde::Serialize;
use std::sync::mpsc::{channel, Sender};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, WebviewUrl, WebviewWindowBuilder};

/// How often a long session snapshots itself, per the spec.
const BACKUP_INTERVAL: Duration = Duration::from_secs(30 * 60);

/// The label of the hidden window a PDF is rendered in. One at a time: an
/// export is a few hundred milliseconds and the teacher pressed one button.
const PRINT_WINDOW: &str = "print";
/// How long an export may take before it is reported as failed rather than
/// leaving the teacher looking at a spinner forever.
const PRINT_TIMEOUT: Duration = Duration::from_secs(60);

/// An export waiting for its print window to say it has rendered.
struct PendingPrint {
    job: pdf::PrintJob,
    /// Where the finished path — or the failure — goes back to `export_pdf`.
    reply: Sender<Result<String, String>>,
}

#[derive(Default)]
pub struct AppState {
    /// The fingerprint of `planner.sqlite` as of our last read or write.
    /// `None` means we have not read the file yet this session.
    last_seen: Mutex<Option<Fingerprint>>,
    /// The export currently being rendered, if any.
    pending_print: Mutex<Option<PendingPrint>>,
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
fn save_class_grading(
    state: tauri::State<'_, AppState>,
    grading: ClassGrading,
) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_class_grading(tx, &grading))
}

#[tauri::command]
fn save_grade_column(state: tauri::State<'_, AppState>, column: GradeColumn) -> AppResult<Planner> {
    mutate(&state, |tx| {
        store::save_grade_column(tx, &column).map(|_| ())
    })
}

#[tauri::command]
fn delete_grade_column(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_grade_column(tx, id))
}

#[tauri::command]
fn set_grade_value(state: tauri::State<'_, AppState>, value: GradeValue) -> AppResult<Planner> {
    mutate(&state, |tx| store::set_grade_value(tx, &value))
}

#[tauri::command]
fn save_grade_row(state: tauri::State<'_, AppState>, row: GradeRow) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_grade_row(tx, &row))
}

// ---------------------------------------- M3: timetable, plans and agenda ---

#[tauri::command]
fn save_timetable_period(
    state: tauri::State<'_, AppState>,
    period: TimetablePeriod,
) -> AppResult<Planner> {
    mutate(&state, |tx| {
        store::save_timetable_period(tx, &period).map(|_| ())
    })
}

#[tauri::command]
fn delete_timetable_period(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_timetable_period(tx, id))
}

#[tauri::command]
fn save_timetable_cell(
    state: tauri::State<'_, AppState>,
    cell: TimetableCell,
) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_timetable_cell(tx, &cell))
}

#[tauri::command]
fn save_lesson_plan(state: tauri::State<'_, AppState>, plan: LessonPlan) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_lesson_plan(tx, &plan))
}

#[tauri::command]
fn save_agenda_note(state: tauri::State<'_, AppState>, note: AgendaNote) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_agenda_note(tx, &note))
}

// ------------------------------- M4: attendance, behaviour and support ---

/// One cell of the monthly attendance grid.
///
/// Reaches `attendance_mark` and nothing else — in particular it never touches
/// the absence-event register, which is independent of it by the spec's own
/// repeated decision and by M4's first acceptance criterion.
#[tauri::command]
fn save_attendance_mark(
    state: tauri::State<'_, AppState>,
    mark: AttendanceMark,
) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_attendance_mark(tx, &mark))
}

/// One line of the detailed absence register.
///
/// Reaches `absence_event` and nothing else — same reason as above, from the
/// other side.
#[tauri::command]
fn save_absence_event(
    state: tauri::State<'_, AppState>,
    event: AbsenceEvent,
) -> AppResult<Planner> {
    mutate(&state, |tx| {
        store::save_absence_event(tx, &event).map(|_| ())
    })
}

#[tauri::command]
fn delete_absence_event(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_absence_event(tx, id))
}

#[tauri::command]
fn save_incident(state: tauri::State<'_, AppState>, incident: Incident) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_incident(tx, &incident).map(|_| ()))
}

#[tauri::command]
fn delete_incident(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_incident(tx, id))
}

#[tauri::command]
fn save_support_plan(state: tauri::State<'_, AppState>, plan: SupportPlan) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_support_plan(tx, &plan).map(|_| ()))
}

#[tauri::command]
fn delete_support_plan(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_support_plan(tx, id))
}

/// One goal inside a plan.
///
/// Note what this cannot do: `store::save_support_goal` names only
/// `support_goal`, so a goal edit has no path to its plan's teacher-written
/// status. That is M4's second acceptance criterion.
#[tauri::command]
fn save_support_goal(state: tauri::State<'_, AppState>, goal: SupportGoal) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_support_goal(tx, &goal).map(|_| ()))
}

#[tauri::command]
fn delete_support_goal(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_support_goal(tx, id))
}

// ------------------------------------------------- M5: parents and staff ---

/// One line of the parent communication log — a record of what happened.
///
/// Note what this cannot do: `store::save_parent_contact` names only
/// `parent_contact`, so writing a record of a conversation has no path to the
/// appointment grid. **There is deliberately no command that writes both**,
/// which is M5's second acceptance criterion held by construction rather than
/// by care — the same shape M4 used for the attendance grid and the absence
/// register.
#[tauri::command]
fn save_parent_contact(
    state: tauri::State<'_, AppState>,
    contact: ParentContact,
) -> AppResult<Planner> {
    mutate(&state, |tx| {
        store::save_parent_contact(tx, &contact).map(|_| ())
    })
}

#[tauri::command]
fn delete_parent_contact(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_parent_contact(tx, id))
}

/// One booking in the weekly grid. The mirror image of the command above, and
/// just as unable to reach the other table.
#[tauri::command]
fn save_parent_appointment(
    state: tauri::State<'_, AppState>,
    appointment: ParentAppointment,
) -> AppResult<Planner> {
    mutate(&state, |tx| {
        store::save_parent_appointment(tx, &appointment).map(|_| ())
    })
}

#[tauri::command]
fn delete_parent_appointment(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_parent_appointment(tx, id))
}

#[tauri::command]
fn save_staff_meeting(
    state: tauri::State<'_, AppState>,
    meeting: StaffMeeting,
) -> AppResult<Planner> {
    mutate(&state, |tx| {
        store::save_staff_meeting(tx, &meeting).map(|_| ())
    })
}

#[tauri::command]
fn delete_staff_meeting(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_staff_meeting(tx, id))
}

#[tauri::command]
fn save_meeting_agreement(
    state: tauri::State<'_, AppState>,
    agreement: MeetingAgreement,
) -> AppResult<Planner> {
    mutate(&state, |tx| {
        store::save_meeting_agreement(tx, &agreement).map(|_| ())
    })
}

#[tauri::command]
fn delete_meeting_agreement(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_meeting_agreement(tx, id))
}

// ------------------------------- M6: annual planning & the rest of teaching ---

/// Saves one unit — which is one row of the annual plan *and* one unit card,
/// because the source's two pages are two views of one record.
#[tauri::command]
fn save_unit(state: tauri::State<'_, AppState>, unit: Unit) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_unit(tx, &unit).map(|_| ()))
}

#[tauri::command]
fn delete_unit(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_unit(tx, id))
}

/// Note what this cannot do: `store::save_exam` names only `exam`, so planning
/// an assessment has no path to the gradebook's own percentage weights.
#[tauri::command]
fn save_exam(state: tauri::State<'_, AppState>, exam: Exam) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_exam(tx, &exam).map(|_| ()))
}

#[tauri::command]
fn delete_exam(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_exam(tx, id))
}

/// A reflection is written after the lesson. **There is deliberately no command
/// that writes both this and a lesson plan**, which is what keeps the progress
/// matrix a view over what the teacher planned rather than a merge of two
/// things she typed.
#[tauri::command]
fn save_lesson_reflection(
    state: tauri::State<'_, AppState>,
    reflection: LessonReflection,
) -> AppResult<Planner> {
    mutate(&state, |tx| {
        store::save_lesson_reflection(tx, &reflection).map(|_| ())
    })
}

#[tauri::command]
fn delete_lesson_reflection(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_lesson_reflection(tx, id))
}

#[tauri::command]
fn save_trip(state: tauri::State<'_, AppState>, trip: Trip) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_trip(tx, &trip).map(|_| ()))
}

#[tauri::command]
fn delete_trip(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_trip(tx, id))
}

/// One student's consent for one trip. A blank one is removed rather than
/// stored, so the register's derived count never includes a cell the teacher
/// cleared.
#[tauri::command]
fn set_trip_consent(state: tauri::State<'_, AppState>, consent: TripConsent) -> AppResult<Planner> {
    mutate(&state, |tx| store::set_trip_consent(tx, &consent))
}

#[tauri::command]
fn save_textbook(state: tauri::State<'_, AppState>, textbook: Textbook) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_textbook(tx, &textbook).map(|_| ()))
}

#[tauri::command]
fn delete_textbook(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_textbook(tx, id))
}

#[tauri::command]
fn save_resource(state: tauri::State<'_, AppState>, resource: Resource) -> AppResult<Planner> {
    mutate(&state, |tx| store::save_resource(tx, &resource).map(|_| ()))
}

#[tauri::command]
fn delete_resource(state: tauri::State<'_, AppState>, id: i64) -> AppResult<Planner> {
    mutate(&state, |tx| store::delete_resource(tx, id))
}

// ------------------------------------------------------------ PDF export ---

/// Writes one document to `exports/` as a real PDF and returns its path.
///
/// The document arrives as HTML built by the frontend, because that is where
/// every user-facing string lives. What happens here is the part the frontend
/// cannot do:
///
/// 1. a hidden window is opened on the app's own page with `?print=1`;
/// 2. that window asks for the job, renders it, waits for its fonts, and calls
///    [`print_ready`];
/// 3. the platform's own print-to-PDF writes the file, and the window closes.
///
/// It is `async` on purpose: it blocks waiting for step 3, and a synchronous
/// command would block the thread the window it is waiting for has to run on.
#[tauri::command]
async fn export_pdf(
    app: tauri::AppHandle,
    file_name: String,
    html: String,
    landscape: bool,
) -> AppResult<String> {
    paths::ensure_dirs()?;
    let target = pdf::target_path(&paths::exports_dir(), &file_name);
    run_export(app, html, landscape, target).await
}

/// The body of an export, shared by the command and the print self-test.
async fn run_export(
    app: tauri::AppHandle,
    html: String,
    landscape: bool,
    target: std::path::PathBuf,
) -> AppResult<String> {
    let (reply, outcome) = channel();
    {
        // Scoped so the guard — and the borrow of the app's state — is gone
        // before the first await.
        let state = app.state::<AppState>();
        let mut pending = state.pending_print.lock().unwrap();
        if pending.is_some() {
            return Err(AppError::Pdf("another export is still running".into()));
        }
        *pending = Some(PendingPrint {
            job: pdf::PrintJob {
                html,
                landscape,
                target: target.clone(),
            },
            reply,
        });
    }

    // A window left over from an export that failed badly would stop the next
    // one from ever rendering, so clear it first.
    if let Some(stale) = app.get_webview_window(PRINT_WINDOW) {
        let _ = stale.close();
    }

    let built = WebviewWindowBuilder::new(
        &app,
        PRINT_WINDOW,
        WebviewUrl::App("index.html?print=1".into()),
    )
    // Hidden: the teacher pressed "export", not "open a window". The document
    // is still laid out and captured — a hidden window renders, it just does
    // not run animation frames, which is why the print window waits on a timer
    // rather than on `requestAnimationFrame`.
    .visible(false)
    .build();
    if let Err(e) = built {
        app.state::<AppState>().pending_print.lock().unwrap().take();
        return Err(e.into());
    }

    // `recv_timeout` blocks, so it goes to a blocking thread rather than
    // holding an async worker.
    let result = tauri::async_runtime::spawn_blocking(move || outcome.recv_timeout(PRINT_TIMEOUT))
        .await
        .map_err(|e| AppError::Pdf(e.to_string()))?;

    match result {
        Ok(Ok(path)) => Ok(path),
        Ok(Err(message)) => Err(AppError::Pdf(message)),
        Err(_) => {
            app.state::<AppState>().pending_print.lock().unwrap().take();
            if let Some(window) = app.get_webview_window(PRINT_WINDOW) {
                let _ = window.close();
            }
            Err(AppError::Pdf(
                "the print window did not answer in time".into(),
            ))
        }
    }
}

/// What the hidden print window renders. Called by it, not by a screen.
#[tauri::command]
fn print_job(state: tauri::State<'_, AppState>) -> AppResult<String> {
    state
        .pending_print
        .lock()
        .unwrap()
        .as_ref()
        .map(|p| p.job.html.clone())
        .ok_or_else(|| AppError::Pdf("there is no document waiting to be printed".into()))
}

/// Called by the print window once its document is laid out and its fonts are
/// loaded, with the number of A4 pages it laid the document out onto.
///
/// Waiting for the frontend to say "ready" rather than guessing with a sleep is
/// what makes Greek safe here: `document.fonts.ready` has resolved by the time
/// this is called, so a page is never captured mid-fallback-font — which is the
/// classic way Greek text ends up drawn in a face that has none of it.
#[tauri::command]
async fn print_ready(
    app: tauri::AppHandle,
    state: tauri::State<'_, AppState>,
    pages: usize,
) -> AppResult<()> {
    let pending = {
        let state = state.pending_print.lock().unwrap().take();
        state.ok_or_else(|| AppError::Pdf("nothing was waiting to be printed".into()))?
    };

    let outcome = render_pages(&app, &pending.job, pages)
        .map(|()| pending.job.target.display().to_string())
        .map_err(|e| e.to_string());

    if let Some(window) = app.get_webview_window(PRINT_WINDOW) {
        let _ = window.close();
    }
    let _ = pending.reply.send(outcome);
    // Whatever happened, the export that is waiting has already been told; a
    // second report through this command's own result would only surface the
    // same failure twice, in the window that is closing.
    Ok(())
}

/// Turns the laid-out print window into the finished file.
///
/// On macOS that is one capture per page and then an assemble; on Windows
/// WebView2 paginates the same page-sized blocks itself and writes the file in
/// one call. Either way the pages are the ones the app laid out, so the two
/// platforms produce the same document.
fn render_pages(app: &tauri::AppHandle, job: &pdf::PrintJob, pages: usize) -> AppResult<()> {
    let window = app
        .get_webview_window(PRINT_WINDOW)
        .ok_or_else(|| AppError::Pdf("the print window closed too early".into()))?;

    #[cfg(target_os = "macos")]
    {
        if pages == 0 {
            return Err(AppError::Pdf("the document had no pages".into()));
        }
        let mut captured: Vec<Vec<u8>> = Vec::with_capacity(pages);
        for page in 0..pages {
            let (send, receive) = channel();
            let job = job.clone();
            let (started_tx, started_rx) = channel();
            window.with_webview(move |webview| {
                let started = pdf::capture_page(webview.inner(), &job, page, send);
                let _ = started_tx.send(started.map_err(|e| e.to_string()));
            })?;
            started_rx
                .recv_timeout(PRINT_TIMEOUT)
                .map_err(|_| AppError::Pdf("the capture never started".into()))?
                .map_err(AppError::Pdf)?;
            // The handler fires on the main thread's run loop, which is free
            // to run because this is not on it.
            let bytes = receive
                .recv_timeout(PRINT_TIMEOUT)
                .map_err(|_| AppError::Pdf("a page was never captured".into()))?
                .map_err(AppError::Pdf)?;
            captured.push(bytes);
        }
        pdf::merge_pages(captured, &job.target)
    }

    #[cfg(target_os = "windows")]
    {
        let _ = pages;
        let job = job.clone();
        let (send, receive) = channel();
        window.with_webview(move |webview| {
            let _ = send.send(
                pdf::capture(webview.controller(), webview.environment(), &job)
                    .map_err(|e| e.to_string()),
            );
        })?;
        receive
            .recv_timeout(PRINT_TIMEOUT)
            .map_err(|_| AppError::Pdf("the print pipeline never finished".into()))?
            .map_err(AppError::Pdf)
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        let _ = (window, job, pages);
        Err(AppError::Pdf(
            "PDF export is not implemented on this platform".into(),
        ))
    }
}

#[tauri::command]
fn make_backup() -> AppResult<Option<String>> {
    Ok(backup::snapshot_now()?.map(|p| p.display().to_string()))
}

/// The print self-test: render one HTML file to one PDF and exit.
///
/// Set `TEACHER_PLANNER_PRINT_SELFTEST_HTML` and
/// `TEACHER_PLANNER_PRINT_SELFTEST_PDF` and the app starts, drives the *same*
/// export path a button does, reports what happened on stdout and quits.
///
/// It exists because of a gap in how this project is verified: an agent can
/// build and launch the app on either OS but cannot click in it, and the one
/// thing M2 must prove — that a real PDF comes out and that Greek renders in
/// it — lives behind a button. The document is supplied by the caller rather
/// than baked in here, which keeps every Greek string out of the Rust side and
/// makes this a genuine end-to-end test of the print pipeline rather than a
/// test of a fixture.
fn print_self_test(app: &tauri::AppHandle) -> Option<()> {
    let html_path = std::env::var_os("TEACHER_PLANNER_PRINT_SELFTEST_HTML")?;
    let pdf_path = std::env::var_os("TEACHER_PLANNER_PRINT_SELFTEST_PDF")?;
    let landscape = std::env::var("TEACHER_PLANNER_PRINT_SELFTEST_PORTRAIT").is_err();
    let app = app.clone();

    tauri::async_runtime::spawn(async move {
        let code = match std::fs::read_to_string(&html_path) {
            Err(e) => {
                eprintln!("print self-test: could not read the document: {e}");
                2
            }
            Ok(html) => {
                match run_export(
                    app.clone(),
                    html,
                    landscape,
                    std::path::PathBuf::from(&pdf_path),
                )
                .await
                {
                    Ok(path) => {
                        println!("print self-test: wrote {path}");
                        0
                    }
                    Err(e) => {
                        eprintln!("print self-test: {e}");
                        1
                    }
                }
            }
        };
        app.exit(code);
    });
    Some(())
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
            save_class_grading,
            save_grade_column,
            delete_grade_column,
            set_grade_value,
            save_grade_row,
            save_timetable_period,
            delete_timetable_period,
            save_timetable_cell,
            save_lesson_plan,
            save_agenda_note,
            save_attendance_mark,
            save_absence_event,
            delete_absence_event,
            save_incident,
            delete_incident,
            save_support_plan,
            delete_support_plan,
            save_support_goal,
            delete_support_goal,
            save_parent_contact,
            delete_parent_contact,
            save_parent_appointment,
            delete_parent_appointment,
            save_staff_meeting,
            delete_staff_meeting,
            save_meeting_agreement,
            delete_meeting_agreement,
            save_unit,
            delete_unit,
            save_exam,
            delete_exam,
            save_lesson_reflection,
            delete_lesson_reflection,
            save_trip,
            delete_trip,
            set_trip_consent,
            save_textbook,
            delete_textbook,
            save_resource,
            delete_resource,
            export_pdf,
            print_job,
            print_ready,
            make_backup
        ])
        .setup(|app| {
            print_self_test(&app.handle().clone());
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
