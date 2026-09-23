/**
 * Αναστοχασμός μαθημάτων — the lesson reflection log.
 *
 * The source's cards carry `ΗΜΕΡΟΜΗΝΙΑ` and `ΜΑΘΗΜΑ / ΤΑΞΗ` over one box
 * captioned `ΤΙ ΛΕΙΤΟΥΡΓΗΣΕ · ΤΙ ΘΑ ΑΛΛΑΞΩ`. One box, so one field: the
 * caption's two halves are a prompt, not two stored values.
 *
 * **A reflection is not a lesson plan.** The progress matrix reads the plan and
 * never this, so what the teacher writes here cannot appear in the grid as if
 * she had planned it.
 *
 * Rows are edited in place, so `Νέα σημείωση` has no selection to move.
 */
import { useMemo, useState } from "react";
import { api } from "../api";
import { Button, DeferredTextField, Panel, TextArea } from "../components/Fields";
import {
  allReflections,
  emptyReflection,
  filteredReflections,
  type LessonReflection,
} from "../domain/reflections";
import type { Planner } from "../domain/types";
import { useTranslate } from "../i18n/useTranslate";
import type { Run } from "./types";

export default function ReflectionsScreen({ planner, run }: { planner: Planner; run: Run }) {
  const t = useTranslate();
  const [classFilter, setClassFilter] = useState(0);

  const filter = useMemo(() => ({ classId: classFilter }), [classFilter]);
  const shown = useMemo(() => filteredReflections(planner, filter), [planner, filter]);
  const all = allReflections(planner);

  return (
    <Panel
      headingId="reflections.heading"
      introId="reflections.intro"
      actions={
        <Button
          labelId="reflections.new"
          variant="primary"
          onClick={() => run(() => api.saveLessonReflection(emptyReflection(classFilter || null)))}
        />
      }
    >
      <label className="field">
        <span>{t("reflections.filterClass")}</span>
        <select
          value={String(classFilter)}
          onChange={(e) => setClassFilter(Number(e.target.value))}
        >
          <option value="0">{t("reflections.filterAll")}</option>
          {planner.classes.map((c) => (
            <option key={c.id} value={String(c.id)}>
              {c.name.trim() || t("common.unnamed")}
            </option>
          ))}
        </select>
      </label>

      {all.length === 0 ? (
        <p className="muted">{t("reflections.none")}</p>
      ) : shown.length === 0 ? (
        <p className="muted">{t("reflections.noMatches")}</p>
      ) : (
        <>
          <p className="muted">{t("reflections.count", { n: shown.length })}</p>
          <ul className="rows">
            {shown.map((reflection, index) => (
              <ReflectionRow
                key={reflection.id}
                reflection={reflection}
                index={index + 1}
                planner={planner}
                run={run}
              />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function ReflectionRow({
  reflection,
  index,
  planner,
  run,
}: {
  reflection: LessonReflection;
  index: number;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  // Every patch carries this row's own id.
  const save = (patch: Partial<LessonReflection>) =>
    run(() => api.saveLessonReflection({ ...reflection, ...patch }));
  const [draft, setDraft] = useState(reflection.notes);
  const [lastStored, setLastStored] = useState(reflection.notes);
  if (reflection.notes !== lastStored) {
    setLastStored(reflection.notes);
    setDraft(reflection.notes);
  }

  return (
    <li>
      <div
        className="row wrap"
        role="group"
        aria-label={t("reflections.entry", { n: index })}
      >
        <DeferredTextField
          labelId="common.date"
          type="date"
          value={reflection.date}
          onCommit={(date) => save({ date })}
        />
        <label className="field">
          <span>{t("reflections.class")}</span>
          <select
            value={String(reflection.class_id ?? 0)}
            onChange={(e) => {
              const id = Number(e.target.value);
              save({ class_id: id === 0 ? null : id });
            }}
          >
            <option value="0">{t("reflections.noClass")}</option>
            {planner.classes.map((c) => (
              <option key={c.id} value={String(c.id)}>
                {c.name.trim() || t("common.unnamed")}
              </option>
            ))}
          </select>
        </label>
        <Button
          labelId="reflections.remove"
          variant="danger"
          onClick={() => run(() => api.deleteLessonReflection(reflection.id))}
        />
      </div>
      {/* Commits on blur, like every other multi-line field in the app. */}
      <div
        onBlur={() => {
          if (draft !== reflection.notes) save({ notes: draft });
        }}
      >
        <TextArea
          labelId="reflections.notes"
          value={draft}
          onChange={setDraft}
          rows={4}
        />
      </div>
    </li>
  );
}
