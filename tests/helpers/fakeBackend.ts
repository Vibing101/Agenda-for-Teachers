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
  AnnualGoal,
  ClassGrading,
  Enrollment,
  GradeColumn,
  GradeRow,
  GradeValue,
  GradingPeriod,
  Holiday,
  ImportantDate,
  Planner,
  SchoolClass,
  SchoolYear,
  Seat,
  Student,
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
          schema_version: 2,
          backup_count: 2,
          last_backup: "2026-09-19T07:30:00+03:00",
          disk_changed: diskChanged,
        };
      }
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
          c.slots = c.slots.map((s) => ({ ...s, class_id: c.id }));
          planner.classes = upsert(planner.classes, c, (x) => x.id);
          break;
        }
        case "delete_class":
          planner.classes = planner.classes.filter((c) => c.id !== args.id);
          planner.enrollments = planner.enrollments.filter((e) => e.class_id !== args.id);
          planner.seats = planner.seats.filter((s) => s.class_id !== args.id);
          break;
        case "save_student": {
          const s = { ...(args.student as Student) };
          if (s.id === 0) s.id = nextId++;
          planner.students = upsert(planner.students, s, (x) => x.id);
          planner.students.sort((a, b) => a.full_name.localeCompare(b.full_name, "el"));
          break;
        }
        case "delete_student":
          planner.students = planner.students.filter((s) => s.id !== args.id);
          planner.enrollments = planner.enrollments.filter((e) => e.student_id !== args.id);
          planner.seats = planner.seats.filter((s) => s.student_id !== args.id);
          break;
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
