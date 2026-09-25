/**
 * Προγραμματισμένες εξετάσεις — the exam tracker.
 *
 * The source page is a register with columns `Ημερομηνία | Τάξη | Μάθημα |
 * Είδος εξέτασης | Τι εξετάζεται | Βαρύτητα` over a page-level `ΣΥΝΕΡΓΑΣΙΑ ΚΑΙ
 * ΣΥΜΒΟΥΛΕΥΤΙΚΗ` box, which is stored per record here — the shape M4.5 settled.
 *
 * **`Μάθημα` is not a field.** It is the linked class's own subject, shown
 * read-only, so a class renamed in one place is renamed everywhere.
 *
 * **`Βαρύτητα` is a planning note and computes nothing.** M2's percentage
 * weights live on a grade column and are what produce an average; the screen
 * says so under the field rather than leaving the teacher to guess, and no call
 * here can reach the gradebook.
 *
 * Rows are edited in place, so `Νέα εξέταση` has no selection to move.
 */
import { useMemo, useState } from "react";
import { api } from "../api";
import { Button, DeferredTextField, Panel } from "../components/Fields";
import { formatDate } from "../domain/dates";
import {
  allExams,
  emptyExam,
  examClass,
  filteredExams,
  upcomingExams,
  type Exam,
} from "../domain/exams";
import type { Planner } from "../domain/types";
import { countOf } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import type { Run } from "./types";

export default function ExamsScreen({
  planner,
  run,
  today,
}: {
  planner: Planner;
  run: Run;
  /** The day the shell read from the calendar. Never read here directly. */
  today: string;
}) {
  const t = useTranslate();
  /** 0 means "all", so a filter never hides a row it cannot name. */
  const [classFilter, setClassFilter] = useState(0);

  const filter = useMemo(() => ({ classId: classFilter }), [classFilter]);
  /** The rows on screen, through the one selector any printed sheet would use. */
  const shown = useMemo(() => filteredExams(planner, filter), [planner, filter]);
  const upcoming = useMemo(() => upcomingExams(planner, today), [planner, today]);
  const all = allExams(planner);

  return (
    <>
      <Panel
        headingId="exams.heading"
        introId="exams.intro"
        actions={
          <Button
            labelId="exams.new"
            variant="primary"
            onClick={() => run(() => api.saveExam(emptyExam(classFilter || null)))}
          />
        }
      >
        <label className="field">
          <span>{t("exams.filterClass")}</span>
          <select
            value={String(classFilter)}
            onChange={(e) => setClassFilter(Number(e.target.value))}
          >
            <option value="0">{t("exams.filterAll")}</option>
            {planner.classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name.trim() || t("common.unnamed")}
              </option>
            ))}
          </select>
        </label>

        {all.length === 0 ? (
          <p className="muted">{t("exams.none")}</p>
        ) : shown.length === 0 ? (
          <p className="muted">{t("exams.noMatches")}</p>
        ) : (
          <>
            <p className="muted">{countOf(t, "exams.count", shown.length)}</p>
            <ul className="rows">
              {shown.map((exam, index) => (
                <ExamRow
                  key={exam.id}
                  exam={exam}
                  index={index + 1}
                  planner={planner}
                  run={run}
                />
              ))}
            </ul>
          </>
        )}
      </Panel>

      {/* A year's register read forwards is not the same question as "what is
          coming". The window is a pure function of the day the shell read. */}
      <Panel headingId="exams.upcoming">
        {upcoming.length === 0 ? (
          <p className="muted">{t("exams.upcomingNone")}</p>
        ) : (
          <ul className="rows">
            {upcoming.map((exam) => {
              const cls = examClass(planner, exam);
              return (
                <li key={exam.id}>
                  <strong>{formatDate(exam.date)}</strong>{" "}
                  {cls?.name.trim() || t("exams.noClass")}
                  {exam.kind && <span className="muted"> · {exam.kind}</span>}
                  {exam.scope && <span className="muted"> · {exam.scope}</span>}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}

function ExamRow({
  exam,
  index,
  planner,
  run,
}: {
  exam: Exam;
  index: number;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  // Every patch carries this row's own id, so one exam can never write another.
  const save = (patch: Partial<Exam>) => run(() => api.saveExam({ ...exam, ...patch }));
  const cls = examClass(planner, exam);

  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("exams.entry", { n: index })}>
        <DeferredTextField
          labelId="common.date"
          type="date"
          value={exam.date}
          onCommit={(date) => save({ date })}
        />
        <label className="field">
          <span>{t("exams.class")}</span>
          <select
            value={String(exam.class_id ?? 0)}
            onChange={(e) => {
              const id = Number(e.target.value);
              save({ class_id: id === 0 ? null : id });
            }}
          >
            <option value="0">{t("exams.noClass")}</option>
            {planner.classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name.trim() || t("common.unnamed")}
              </option>
            ))}
          </select>
        </label>
        {/* Looked up, not stored: the class's own subject. */}
        <div className="field">
          <span>{t("exams.subject")}</span>
          <p className="muted">{cls?.subject.trim() || "—"}</p>
        </div>
        <DeferredTextField
          labelId="exams.kind"
          value={exam.kind}
          onCommit={(kind) => save({ kind })}
        />
        <DeferredTextField
          labelId="exams.scope"
          value={exam.scope}
          onCommit={(scope) => save({ scope })}
        />
        <DeferredTextField
          labelId="exams.weight"
          value={exam.weight}
          onCommit={(weight) => save({ weight })}
        />
        <DeferredTextField
          labelId="exams.collaboration"
          value={exam.collaboration}
          onCommit={(collaboration) => save({ collaboration })}
        />
        <Button
          labelId="exams.remove"
          variant="danger"
          onClick={() => run(() => api.deleteExam(exam.id))}
        />
      </div>
      <p className="hint">{t("exams.weightHint")}</p>
    </li>
  );
}
