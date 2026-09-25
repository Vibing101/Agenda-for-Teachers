/**
 * An in-memory stand-in for the Rust command layer.
 *
 * Component tests drive the real screens through the real `api` module; only
 * the `invoke` bridge is replaced. The fake keeps the two behaviours the UI
 * actually depends on:
 *
 * * every mutation returns the **whole** planner, as the Rust side does after
 *   re-reading the file it just wrote, and
 * * a mutation raises `disk_changed` once the file is marked as changed,
 *   which is what drives the block-and-reload panel.
 *
 * It is deliberately not a second implementation of the storage rules — the
 * Rust tests own those. It is just enough to let a screen be exercised end to
 * end.
 */
import type {
  AbsenceEvent,
  AgendaNote,
  AnnualGoal,
  AttendanceMark,
  ClassGrading,
  Enrollment,
  Exam,
  GradeColumn,
  GradeRow,
  GradeValue,
  GradingPeriod,
  Holiday,
  ImportantDate,
  Incident,
  LessonPlan,
  LessonReflection,
  MeetingAgreement,
  ParentAppointment,
  ParentContact,
  Planner,
  PrintForm,
  PrintFormValue,
  Resource,
  SchoolClass,
  SchoolYear,
  Seat,
  StaffMeeting,
  Student,
  SupportGoal,
  SupportPlan,
  Textbook,
  TimetableCell,
  TimetablePeriod,
  Trip,
  TripConsent,
  Unit,
  StaffContact,
  CoverRecord,
  LeaveRecord,
  DevelopmentGoal,
  TrainingEntry,
  DevelopmentBudget,
  WellbeingEntry,
  WellbeingNote,
} from "../../src/domain/types";
import { GOAL_AREAS } from "../../src/i18n/vocabularies";

export function emptyPlanner(): Planner {
  return {
    school_year: { year_model: "sep_aug", start_date: "" },
    grading_periods: [1, 2, 3].map((ordinal) => ({
      ordinal,
      name: "",
      start_date: "",
      end_date: "",
      notes: "",
    })),
    holidays: [],
    important_dates: [],
    annual_goals: GOAL_AREAS.map((area) => ({
      area,
      goal: "",
      actions: "",
      success_indicators: "",
      deadline: "",
      status: "",
      review: "",
    })),
    classes: [],
    students: [],
    enrollments: [],
    seats: [],
    class_gradings: [],
    grade_columns: [],
    grade_values: [],
    grade_rows: [],
    timetable_periods: [],
    timetable_cells: [],
    lesson_plans: [],
    agenda_notes: [],
    attendance_marks: [],
    absence_events: [],
    incidents: [],
    support_plans: [],
    support_goals: [],
    parent_contacts: [],
    parent_appointments: [],
    staff_meetings: [],
    meeting_agreements: [],
    units: [],
    exams: [],
    lesson_reflections: [],
    trips: [],
    trip_consents: [],
    textbooks: [],
    resources: [],
    print_forms: [],
    substitute_texts: [],
    substitute_school_texts: [],
    staff_contacts: [],
    cover_records: [],
    leave_records: [],
    development_goals: [],
    training_entries: [],
    development_budget: { amount: null, notes: "" },
    wellbeing_entries: [],
    wellbeing_note: { sustains: "", boundaries: "" },
    preferences: { locale: "el" },
  };
}

export interface FakeBackend {
  planner: Planner;
  /** Simulates the other device's copy landing in the folder. */
  markDiskChanged(): void;
  calls: { command: string; args: Record<string, unknown> }[];
  handle(command: string, args?: Record<string, unknown>): unknown;
}

export function createFakeBackend(initial: Planner = emptyPlanner()): FakeBackend {
  const planner: Planner = structuredClone(initial);
  let diskChanged = false;
  let nextId = 1000;
  const calls: { command: string; args: Record<string, unknown> }[] = [];

  const snapshot = () => structuredClone(planner);

  const backend: FakeBackend = {
    get planner() {
      return planner;
    },
    calls,
    markDiskChanged() {
      diskChanged = true;
    },
    handle(command, args = {}) {
      calls.push({ command, args });

      if (command === "status") {
        return {
          app_folder: "/Drive/Ατζέντα",
          db_path: "/Drive/Ατζέντα/data/planner.sqlite",
          db_exists: true,
          schema_version: 10,
          backup_count: 2,
          last_backup: "2026-09-19T07:30:00+03:00",
          disk_changed: diskChanged,
        };
      }
      if (command === "set_window_title") return null;
      if (command === "make_backup") return "/Drive/Ατζέντα/data/backups/planner-2026-09-19-0730.sqlite";
      if (command === "load") return snapshot();
      if (command === "reload") {
        diskChanged = false;
        return snapshot();
      }

      if (diskChanged) {
        throw { code: "disk_changed", message: "the data file changed on disk" };
      }

      switch (command) {
        case "save_school_year":
          planner.school_year = args.year as SchoolYear;
          break;
        case "save_grading_periods":
          planner.grading_periods = args.periods as GradingPeriod[];
          break;
        case "save_holiday": {
          const h = { ...(args.holiday as Holiday) };
          if (h.id === 0) h.id = nextId++;
          planner.holidays = upsert(planner.holidays, h, (x) => x.id);
          break;
        }
        case "delete_holiday":
          planner.holidays = planner.holidays.filter((h) => h.id !== args.id);
          break;
        case "save_important_date": {
          const d = { ...(args.date as ImportantDate) };
          if (d.id === 0) d.id = nextId++;
          planner.important_dates = upsert(planner.important_dates, d, (x) => x.id);
          break;
        }
        case "delete_important_date":
          planner.important_dates = planner.important_dates.filter((d) => d.id !== args.id);
          break;
        case "save_annual_goal":
          planner.annual_goals = upsert(
            planner.annual_goals,
            args.goal as AnnualGoal,
            (g) => g.area,
          );
          break;
        case "save_class": {
          const c = { ...(args.class as SchoolClass) };
          if (c.id === 0) c.id = nextId++;
          planner.classes = upsert(planner.classes, c, (x) => x.id);
          break;
        }
        case "delete_class":
          planner.classes = planner.classes.filter((c) => c.id !== args.id);
          planner.enrollments = planner.enrollments.filter((e) => e.class_id !== args.id);
          planner.seats = planner.seats.filter((s) => s.class_id !== args.id);
          planner.lesson_plans = planner.lesson_plans.filter((p) => p.class_id !== args.id);
          // The class's substitute folder texts go with it, as the schema's
          // cascade does. The school-wide ones are nobody's to delete.
          planner.substitute_texts = planner.substitute_texts.filter(
            (s) => s.class_id !== args.id,
          );
          // Attendance and absence events are per class and cascade with it.
          planner.attendance_marks = planner.attendance_marks.filter(
            (m) => m.class_id !== args.id,
          );
          planner.absence_events = planner.absence_events.filter((e) => e.class_id !== args.id);
          // An incident belongs to the student, so it survives with its link
          // emptied — the schema's ON DELETE SET NULL.
          planner.incidents = planner.incidents.map((i) =>
            i.class_id === args.id ? { ...i, class_id: null } : i,
          );
          // As the schema's ON DELETE SET NULL does: the hour stays in the
          // teacher's week, with the link to the class emptied.
          planner.timetable_cells = planner.timetable_cells.map((cell) =>
            cell.class_id === args.id ? { ...cell, class_id: null } : cell,
          );
          break;
        case "save_student": {
          const s = { ...(args.student as Student) };
          if (s.id === 0) s.id = nextId++;
          planner.students = upsert(planner.students, s, (x) => x.id);
          planner.students.sort((a, b) => a.full_name.localeCompare(b.full_name, "el"));
          break;
        }
        case "delete_student": {
          planner.students = planner.students.filter((s) => s.id !== args.id);
          planner.enrollments = planner.enrollments.filter((e) => e.student_id !== args.id);
          planner.seats = planner.seats.filter((s) => s.student_id !== args.id);
          // As the schema's cascades do, through her plans to their goals.
          planner.attendance_marks = planner.attendance_marks.filter(
            (m) => m.student_id !== args.id,
          );
          planner.absence_events = planner.absence_events.filter((e) => e.student_id !== args.id);
          planner.incidents = planner.incidents.filter((i) => i.student_id !== args.id);
          const goneplans = new Set(
            planner.support_plans.filter((p) => p.student_id === args.id).map((p) => p.id),
          );
          planner.support_plans = planner.support_plans.filter((p) => p.student_id !== args.id);
          planner.support_goals = planner.support_goals.filter((g) => !goneplans.has(g.plan_id));
          break;
        }
        case "set_enrollment": {
          const e = { ...(args.enrollment as Enrollment) };
          if (e.roster_no <= 0) {
            e.roster_no =
              planner.enrollments.filter((x) => x.class_id === e.class_id).length + 1;
          }
          planner.enrollments = upsert(
            planner.enrollments,
            e,
            (x) => `${x.class_id}:${x.student_id}`,
          );
          break;
        }
        case "remove_enrollment":
          planner.enrollments = planner.enrollments.filter(
            (e) => !(e.class_id === args.classId && e.student_id === args.studentId),
          );
          planner.seats = planner.seats.filter(
            (s) => !(s.class_id === args.classId && s.student_id === args.studentId),
          );
          break;
        case "save_seating": {
          const classId = args.classId as number;
          planner.classes = planner.classes.map((c) =>
            c.id === classId
              ? {
                  ...c,
                  seating_rows: args.rows as number,
                  seating_cols: args.cols as number,
                  seating_notes: args.notes as string,
                }
              : c,
          );
          planner.seats = [
            ...planner.seats.filter((s) => s.class_id !== classId),
            ...(args.seats as Seat[]),
          ];
          break;
        }
        case "save_class_grading":
          planner.class_gradings = upsert(
            planner.class_gradings,
            args.grading as ClassGrading,
            (g) => g.class_id,
          );
          break;
        case "save_grade_column": {
          const c = { ...(args.column as GradeColumn) };
          if (c.id === 0) c.id = nextId++;
          planner.grade_columns = upsert(planner.grade_columns, c, (x) => x.id);
          break;
        }
        case "delete_grade_column":
          planner.grade_columns = planner.grade_columns.filter((c) => c.id !== args.id);
          // As the real schema's cascade does.
          planner.grade_values = planner.grade_values.filter((v) => v.column_id !== args.id);
          break;
        case "set_grade_value": {
          const v = args.value as GradeValue;
          // Clearing a cell removes it, exactly as the storage layer does, so
          // "no mark" is an absent row everywhere.
          planner.grade_values = planner.grade_values.filter(
            (x) => !(x.column_id === v.column_id && x.student_id === v.student_id),
          );
          if (v.value.trim() !== "") planner.grade_values = [...planner.grade_values, v];
          break;
        }
        case "save_grade_row":
          planner.grade_rows = upsert(
            planner.grade_rows,
            args.row as GradeRow,
            (r) => `${r.class_id}:${r.student_id}`,
          );
          break;
        case "save_timetable_period": {
          const p = { ...(args.period as TimetablePeriod) };
          if (p.id === 0) {
            p.id = nextId++;
            p.position = planner.timetable_periods.length;
          }
          planner.timetable_periods = upsert(planner.timetable_periods, p, (x) => x.id);
          break;
        }
        case "delete_timetable_period":
          planner.timetable_periods = planner.timetable_periods.filter((p) => p.id !== args.id);
          // As the schema's cascade does.
          planner.timetable_cells = planner.timetable_cells.filter(
            (c) => c.period_id !== args.id,
          );
          break;
        case "save_timetable_cell": {
          const cell = args.cell as TimetableCell;
          // An emptied cell is deleted rather than stored blank, exactly as the
          // storage layer does, so "free hour" is an absent row everywhere.
          const empty =
            cell.class_id === null &&
            cell.subject.trim() === "" &&
            cell.room.trim() === "" &&
            cell.duty.trim() === "" &&
            cell.notes.trim() === "";
          planner.timetable_cells = planner.timetable_cells.filter(
            (c) => !(c.period_id === cell.period_id && c.weekday === cell.weekday),
          );
          if (!empty) planner.timetable_cells = [...planner.timetable_cells, cell];
          break;
        }
        case "save_lesson_plan": {
          const plan = args.plan as LessonPlan;
          planner.lesson_plans = planner.lesson_plans.filter(
            (p) => !(p.class_id === plan.class_id && p.week_monday === plan.week_monday),
          );
          if (plan.notes.trim() !== "" || plan.assessment.trim() !== "") {
            planner.lesson_plans = [...planner.lesson_plans, plan];
          }
          break;
        }
        case "save_agenda_note": {
          const note = args.note as AgendaNote;
          planner.agenda_notes = planner.agenda_notes.filter(
            (n) => !(n.scope === note.scope && n.date === note.date),
          );
          if (note.body.trim() !== "") {
            planner.agenda_notes = [...planner.agenda_notes, note];
          }
          break;
        }
        // ----------------------------- M4: attendance and behaviour ---
        case "save_attendance_mark": {
          const mark = args.mark as AttendanceMark;
          // An emptied cell is deleted rather than stored blank, exactly as the
          // storage layer does. Nothing here touches `absence_events` — the two
          // registers are independent by the spec's own decision.
          planner.attendance_marks = planner.attendance_marks.filter(
            (m) =>
              !(
                m.class_id === mark.class_id &&
                m.student_id === mark.student_id &&
                m.date === mark.date
              ),
          );
          if (mark.state.trim() !== "") {
            planner.attendance_marks = [...planner.attendance_marks, mark];
          }
          break;
        }
        case "save_absence_event": {
          // A blank event is KEPT, unlike an emptied grid cell: the teacher
          // pressed a button to create it and is about to type into it.
          const e = { ...(args.event as AbsenceEvent) };
          if (e.id === 0) e.id = nextId++;
          planner.absence_events = upsert(planner.absence_events, e, (x) => x.id);
          break;
        }
        case "delete_absence_event":
          planner.absence_events = planner.absence_events.filter((e) => e.id !== args.id);
          break;
        case "save_incident": {
          const i = { ...(args.incident as Incident) };
          if (i.id === 0) i.id = nextId++;
          planner.incidents = upsert(planner.incidents, i, (x) => x.id);
          break;
        }
        case "delete_incident":
          planner.incidents = planner.incidents.filter((i) => i.id !== args.id);
          break;
        case "save_support_plan": {
          const p = { ...(args.plan as SupportPlan) };
          if (p.id === 0) {
            p.id = nextId++;
            p.position = planner.support_plans.filter(
              (x) => x.student_id === p.student_id,
            ).length;
          }
          planner.support_plans = upsert(planner.support_plans, p, (x) => x.id);
          break;
        }
        case "delete_support_plan":
          planner.support_plans = planner.support_plans.filter((p) => p.id !== args.id);
          // As the schema's cascade does.
          planner.support_goals = planner.support_goals.filter((g) => g.plan_id !== args.id);
          break;
        case "save_support_goal": {
          // Writes a goal and only a goal: there is no path from here to its
          // plan's teacher-written status, exactly as in the Rust layer.
          const g = { ...(args.goal as SupportGoal) };
          if (g.id === 0) {
            g.id = nextId++;
            g.position = planner.support_goals.filter((x) => x.plan_id === g.plan_id).length;
          }
          planner.support_goals = upsert(planner.support_goals, g, (x) => x.id);
          break;
        }
        case "delete_support_goal":
          planner.support_goals = planner.support_goals.filter((g) => g.id !== args.id);
          break;
        // M5. The two halves of the parent module are written by two commands
        // that each touch one array, exactly as the Rust side does — there is
        // deliberately no case here that writes both.
        case "save_parent_contact": {
          const c = { ...(args.contact as ParentContact) };
          if (c.id === 0) c.id = nextId++;
          planner.parent_contacts = upsert(planner.parent_contacts, c, (x) => x.id);
          break;
        }
        case "delete_parent_contact":
          planner.parent_contacts = planner.parent_contacts.filter((c) => c.id !== args.id);
          break;
        case "save_parent_appointment": {
          const a = { ...(args.appointment as ParentAppointment) };
          if (a.id === 0) a.id = nextId++;
          planner.parent_appointments = upsert(planner.parent_appointments, a, (x) => x.id);
          break;
        }
        case "delete_parent_appointment":
          planner.parent_appointments = planner.parent_appointments.filter(
            (a) => a.id !== args.id,
          );
          break;
        case "save_staff_meeting": {
          const m = { ...(args.meeting as StaffMeeting) };
          if (m.id === 0) {
            m.id = nextId++;
            m.position = planner.staff_meetings.length;
          }
          planner.staff_meetings = upsert(planner.staff_meetings, m, (x) => x.id);
          break;
        }
        case "delete_staff_meeting":
          planner.staff_meetings = planner.staff_meetings.filter((m) => m.id !== args.id);
          // As the schema's cascade does.
          planner.meeting_agreements = planner.meeting_agreements.filter(
            (a) => a.meeting_id !== args.id,
          );
          break;
        case "save_meeting_agreement": {
          const a = { ...(args.agreement as MeetingAgreement) };
          if (a.id === 0) {
            a.id = nextId++;
            a.position = planner.meeting_agreements.filter(
              (x) => x.meeting_id === a.meeting_id,
            ).length;
          }
          planner.meeting_agreements = upsert(planner.meeting_agreements, a, (x) => x.id);
          break;
        }
        case "delete_meeting_agreement":
          planner.meeting_agreements = planner.meeting_agreements.filter((a) => a.id !== args.id);
          break;
        // M6. Seven commands, seven arrays — and **no case that writes a
        // progress-matrix cell**, because there is no such table: the matrix is
        // a view over `save_lesson_plan` above. A test asserts that the matrix
        // screen reaches storage through the lesson plan and nothing else.
        case "save_unit": {
          const u = { ...(args.unit as Unit) };
          if (u.id === 0) {
            u.id = nextId++;
            u.position = planner.units.filter((x) => x.class_id === u.class_id).length;
          }
          planner.units = upsert(planner.units, u, (x) => x.id);
          break;
        }
        case "delete_unit":
          planner.units = planner.units.filter((u) => u.id !== args.id);
          break;
        case "save_exam": {
          const e = { ...(args.exam as Exam) };
          if (e.id === 0) e.id = nextId++;
          planner.exams = upsert(planner.exams, e, (x) => x.id);
          break;
        }
        case "delete_exam":
          planner.exams = planner.exams.filter((e) => e.id !== args.id);
          break;
        case "save_lesson_reflection": {
          const r = { ...(args.reflection as LessonReflection) };
          if (r.id === 0) r.id = nextId++;
          planner.lesson_reflections = upsert(planner.lesson_reflections, r, (x) => x.id);
          break;
        }
        case "delete_lesson_reflection":
          planner.lesson_reflections = planner.lesson_reflections.filter(
            (r) => r.id !== args.id,
          );
          break;
        case "save_trip": {
          const t = { ...(args.trip as Trip) };
          if (t.id === 0) {
            t.id = nextId++;
            t.position = planner.trips.length;
          }
          planner.trips = upsert(planner.trips, t, (x) => x.id);
          break;
        }
        case "delete_trip":
          planner.trips = planner.trips.filter((t) => t.id !== args.id);
          // As the schema's cascade does.
          planner.trip_consents = planner.trip_consents.filter((c) => c.trip_id !== args.id);
          break;
        case "set_trip_consent": {
          const c = { ...(args.consent as TripConsent) };
          const matches = (x: TripConsent) =>
            x.trip_id === c.trip_id && x.student_id === c.student_id;
          // A cleared consent is removed, as the Rust side does: an unrecorded
          // one is the absence of a row, not a third state.
          planner.trip_consents =
            c.state === "" && c.note === ""
              ? planner.trip_consents.filter((x) => !matches(x))
              : planner.trip_consents.some(matches)
                ? planner.trip_consents.map((x) => (matches(x) ? c : x))
                : [...planner.trip_consents, c];
          break;
        }
        case "save_textbook": {
          const b = { ...(args.textbook as Textbook) };
          if (b.id === 0) {
            b.id = nextId++;
            b.position = planner.textbooks.length;
          }
          planner.textbooks = upsert(planner.textbooks, b, (x) => x.id);
          break;
        }
        case "delete_textbook":
          planner.textbooks = planner.textbooks.filter((b) => b.id !== args.id);
          break;
        case "save_resource": {
          const r = { ...(args.resource as Resource) };
          if (r.id === 0) {
            r.id = nextId++;
            r.position = planner.resources.filter((x) => x.category === r.category).length;
          }
          planner.resources = upsert(planner.resources, r, (x) => x.id);
          break;
        }
        case "delete_resource":
          planner.resources = planner.resources.filter((r) => r.id !== args.id);
          break;
        // M7. A print form is written in two ways that never overlap: its head
        // (kind, name, dates) and one value at a time — so a rename can never
        // write back a stale copy of the values, exactly as the Rust side.
        case "save_print_form": {
          const f = args.form as PrintForm;
          if (f.id === 0) {
            planner.print_forms = [...planner.print_forms, { ...f, id: nextId++, values: {} }];
          } else {
            planner.print_forms = planner.print_forms.map((x) =>
              x.id === f.id
                ? { ...x, kind: f.kind, name: f.name, created: f.created, updated: f.updated }
                : x,
            );
          }
          break;
        }
        case "set_print_form_value": {
          const v = { form_id: args.formId, field: args.field, value: args.value } as PrintFormValue;
          planner.print_forms = planner.print_forms.map((x) => {
            if (x.id !== v.form_id) return x;
            const values = { ...x.values };
            // An emptied field is removed, not stored blank.
            if (v.value === "") delete values[v.field];
            else values[v.field] = v.value;
            return { ...x, values, updated: args.today as string };
          });
          break;
        }
        case "delete_print_form":
          planner.print_forms = planner.print_forms.filter((f) => f.id !== args.id);
          break;
        case "set_substitute_text": {
          // Stored even when empty: an empty row is "she cleared it", which is
          // not the same as no row, "she has not touched it".
          const classId = args.classId as number | null;
          const field = args.field as string;
          const value = args.value as string;
          if (classId === null) {
            planner.substitute_school_texts = [
              ...planner.substitute_school_texts.filter((s) => s.field !== field),
              { field, value },
            ];
          } else {
            planner.substitute_texts = [
              ...planner.substitute_texts.filter(
                (s) => !(s.class_id === classId && s.field === field),
              ),
              { class_id: classId, field, value },
            ];
          }
          break;
        }
        case "reset_substitute_text": {
          const classId = args.classId as number | null;
          if (classId === null) {
            planner.substitute_school_texts = planner.substitute_school_texts.filter(
              (s) => s.field !== args.field,
            );
          } else {
            planner.substitute_texts = planner.substitute_texts.filter(
              (s) => !(s.class_id === classId && s.field === args.field),
            );
          }
          break;
        }
        case "save_staff_contact": {
          const c = { ...(args.contact as StaffContact) };
          if (c.id === 0) {
            c.id = nextId++;
            c.position = planner.staff_contacts.length;
          }
          planner.staff_contacts = upsert(planner.staff_contacts, c, (x) => x.id);
          break;
        }
        case "delete_staff_contact":
          planner.staff_contacts = planner.staff_contacts.filter((c) => c.id !== args.id);
          break;
        // The two registers of *Αναπλήρωση και άδειες*: each command touches
        // its own array and nothing else, as the Rust side does.
        case "save_cover_record": {
          const r = { ...(args.record as CoverRecord) };
          if (r.id === 0) r.id = nextId++;
          planner.cover_records = upsert(planner.cover_records, r, (x) => x.id);
          break;
        }
        case "delete_cover_record":
          planner.cover_records = planner.cover_records.filter((r) => r.id !== args.id);
          break;
        case "save_leave_record": {
          const r = { ...(args.record as LeaveRecord) };
          if (r.id === 0) r.id = nextId++;
          planner.leave_records = upsert(planner.leave_records, r, (x) => x.id);
          break;
        }
        case "delete_leave_record":
          planner.leave_records = planner.leave_records.filter((r) => r.id !== args.id);
          break;
        case "save_development_goal": {
          const g = { ...(args.goal as DevelopmentGoal) };
          if (g.id === 0) {
            g.id = nextId++;
            g.position = planner.development_goals.length;
          }
          planner.development_goals = upsert(planner.development_goals, g, (x) => x.id);
          break;
        }
        case "delete_development_goal":
          planner.development_goals = planner.development_goals.filter((g) => g.id !== args.id);
          break;
        case "save_training_entry": {
          const e = { ...(args.entry as TrainingEntry) };
          if (e.id === 0) e.id = nextId++;
          planner.training_entries = upsert(planner.training_entries, e, (x) => x.id);
          break;
        }
        case "delete_training_entry":
          planner.training_entries = planner.training_entries.filter((e) => e.id !== args.id);
          break;
        case "save_development_budget":
          planner.development_budget = { ...(args.budget as DevelopmentBudget) };
          break;
        case "save_wellbeing_entry": {
          const e = { ...(args.entry as WellbeingEntry) };
          if (e.id === 0) e.id = nextId++;
          planner.wellbeing_entries = upsert(planner.wellbeing_entries, e, (x) => x.id);
          break;
        }
        case "delete_wellbeing_entry":
          planner.wellbeing_entries = planner.wellbeing_entries.filter((e) => e.id !== args.id);
          break;
        case "save_wellbeing_note":
          planner.wellbeing_note = { ...(args.note as WellbeingNote) };
          break;
        case "save_locale":
          // The Rust side refuses a language it does not know; so does this.
          if (args.locale !== "el" && args.locale !== "en") throw new Error("unknown language");
          planner.preferences = { locale: String(args.locale) };
          break;
        case "export_pdf":
          // The real export opens a hidden window and drives the platform's
          // print pipeline; there is no webview here, so the fake only records
          // that it was asked and hands back the path it would have written.
          return `/Drive/Ατζέντα/exports/${String(args.fileName)}.pdf`;
        default:
          throw new Error(`unexpected command ${command}`);
      }
      return snapshot();
    },
  };
  return backend;
}

function upsert<T, K>(rows: T[], row: T, key: (row: T) => K): T[] {
  const index = rows.findIndex((r) => key(r) === key(row));
  if (index === -1) return [...rows, row];
  const copy = [...rows];
  copy[index] = row;
  return copy;
}
