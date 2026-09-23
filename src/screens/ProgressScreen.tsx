/**
 * Ανάπτυξη ανά τμήμα — the week-by-class progress matrix.
 *
 * **This screen writes nothing, and that is M6's first acceptance criterion.**
 * The criterion is that the matrix "correctly reflects entries made from the
 * per-class weekly plan (M3) **without duplicate data entry**", so every cell
 * here is read from the plan the teacher already wrote on the Εβδομάδα screen,
 * and there is no field on this page to fill. A cell is a link into that week's
 * plan, not an editor of a second copy of it.
 *
 * It is therefore a read-only aggregation view, like the Today view, and takes
 * no `run` at all — a test asserts it reaches storage never.
 *
 * **`Εβδομάδα` is a label, not a key.** The rows come from
 * `domain/progress.ts`, which derives them from the school year's start date.
 * Correcting that date re-labels every row and moves no plan.
 *
 * **`today` is a prop.** It marks the current week and decides which ten weeks
 * the screen opens on; no component here reads the clock.
 */
import { useEffect, useState } from "react";
import { Button, Panel } from "../components/Fields";
import { formatDate } from "../domain/dates";
import {
  PROGRESS_PAGE_WEEKS,
  progressMatrix,
  weekWindowFor,
  writtenCount,
} from "../domain/progress";
import { WEEKS_IN_YEAR } from "../domain/schoolYear";
import type { Planner } from "../domain/types";
import { useTranslate } from "../i18n/useTranslate";
import type { PlanFocus } from "./PlanScreen";

export default function ProgressScreen({
  planner,
  today,
  onOpenPlan,
}: {
  planner: Planner;
  /** The day the shell read from the calendar. Never read here directly. */
  today: string;
  /** Opens one cell's week on the Εβδομάδα screen — where it is written. */
  onOpenPlan: (focus: PlanFocus) => void;
}) {
  const t = useTranslate();
  const [fromWeek, setFromWeek] = useState(() => weekWindowFor(planner, today));

  // Follow the year if its start date is set or corrected while the screen is
  // open, so the window stays where the teacher is rather than where she was.
  useEffect(() => {
    setFromWeek(weekWindowFor(planner, today));
  }, [planner.school_year.start_date, today]); // eslint-disable-line react-hooks/exhaustive-deps

  if (planner.school_year.start_date === "") {
    return (
      <Panel headingId="progress.heading" introId="progress.intro">
        <p className="muted">{t("progress.noStartDate")}</p>
      </Panel>
    );
  }
  if (planner.classes.length === 0) {
    return (
      <Panel headingId="progress.heading" introId="progress.intro">
        <p className="muted">{t("progress.noClasses")}</p>
      </Panel>
    );
  }

  const matrix = progressMatrix(planner, today, fromWeek);
  const lastWeek = Math.min(fromWeek + PROGRESS_PAGE_WEEKS - 1, WEEKS_IN_YEAR);

  return (
    <Panel headingId="progress.heading" introId="progress.intro">
      {/* Says in the app what the criterion says in the document: this grid is
          a second view of the weekly plan, not a second thing to fill in. */}
      <p className="hint">{t("progress.readsPlan")}</p>

      <div className="agenda-bar">
        <div className="agenda-heading">
          <h3>{t("progress.range", { from: fromWeek, to: lastWeek })}</h3>
          <span className="muted">
            {t("progress.written", { n: writtenCount(matrix) })}
          </span>
        </div>
        <div className="actions">
          <Button
            labelId="common.previous"
            disabled={fromWeek <= 1}
            onClick={() => setFromWeek((w) => Math.max(1, w - PROGRESS_PAGE_WEEKS))}
          />
          <Button
            labelId="agenda.jumpToToday"
            variant="primary"
            onClick={() => setFromWeek(weekWindowFor(planner, today))}
          />
          <Button
            labelId="common.next"
            disabled={lastWeek >= WEEKS_IN_YEAR}
            onClick={() =>
              setFromWeek((w) => Math.min(WEEKS_IN_YEAR, w + PROGRESS_PAGE_WEEKS))
            }
          />
        </div>
      </div>

      <table className="grid progress">
        <thead>
          <tr>
            <th scope="col">{t("progress.week")}</th>
            {matrix.classes.map((c) => (
              <th key={c.id} scope="col">
                {c.name.trim() || t("common.unnamed")}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {matrix.rows.map((row) => (
            <tr key={row.monday} className={row.isCurrent ? "current" : undefined}>
              <th scope="row">
                <strong>{t("progress.weekNumber", { n: row.week })}</strong>
                <span className="muted">{formatDate(row.monday)}</span>
                {row.isCurrent && <span className="tag">{t("progress.currentWeek")}</span>}
              </th>
              {row.cells.map((cell) => (
                <td key={cell.classId}>
                  {/* The whole cell opens the week's plan — the one place it is
                      written. Nothing here is an input. The column's own
                      `<th scope="col">` already names the class, so the cell
                      does not repeat it. */}
                  <button
                    type="button"
                    className="cell-link"
                    aria-label={t("progress.openWeek")}
                    onClick={() => onOpenPlan({ classId: cell.classId, date: cell.weekMonday })}
                  >
                    {cell.written ? (
                      <>
                        {/* The teacher's own words, exactly as typed. */}
                        <span className="cell-text">{cell.summary}</span>
                        {cell.hasAssessment && (
                          <span className="tag">{t("progress.assessment")}</span>
                        )}
                      </>
                    ) : (
                      <span className="muted">{t("progress.empty")}</span>
                    )}
                  </button>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
