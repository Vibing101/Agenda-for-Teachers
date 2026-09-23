/**
 * Ετήσιο πλάνο — the annual plan per class, and the unit cards it is a view of.
 *
 * **One register, two surfaces.** The source keeps *Ετήσιο πλάνο · Ετήσια
 * επισκόπηση ανά μάθημα και τμήμα*, a table of `Περίοδος | Θεματική ενότητα |
 * Δεξιότητες / Κριτήρια | Ώρες | Αξιολόγηση`, and *Ενότητες · Αναλυτικά για
 * κάθε ενότητα*, a card per unit. Every column of the first is a field of the
 * second, so this screen shows the overview table *above* the cards that fill
 * it, and the teacher types a unit's title once.
 *
 * **The header's `ΜΑΘΗΜΑ`, `ΤΑΞΗ` and `ΩΡΕΣ/ΕΒΔ.` are derived**, not fields: the
 * first two from the class card and the third from the master timetable, the
 * same lookup the class card itself uses. So moving a class's hours updates
 * this page with nothing to regenerate.
 *
 * **A unit is edited in place**, like the absence register's and the
 * communication log's rows: each field carries its own unit's id, so
 * `Νέα ενότητα` has no selection to move and M1's create-then-edit defect
 * cannot arise. The regression test still starts from a planner that already
 * holds units.
 */
import { useEffect, useState } from "react";
import { api } from "../api";
import { Button, DeferredTextField, Panel, TextArea } from "../components/Fields";
import { hoursOfClass } from "../domain/timetable";
import type { Planner } from "../domain/types";
import { annualPlan, emptyUnit, hasUnitContent, unitsOfClass, type Unit } from "../domain/units";
import { useTranslate } from "../i18n/useTranslate";
import type { Run } from "./types";

export default function AnnualPlanScreen({ planner, run }: { planner: Planner; run: Run }) {
  const t = useTranslate();
  const [selectedId, setSelectedId] = useState<number | null>(planner.classes[0]?.id ?? null);

  useEffect(() => {
    if (planner.classes.length === 0) setSelectedId(null);
    else if (!planner.classes.some((c) => c.id === selectedId)) {
      setSelectedId(planner.classes[0].id);
    }
  }, [planner.classes, selectedId]);

  const selected = planner.classes.find((c) => c.id === selectedId) ?? null;

  return (
    <>
      <Panel headingId="annual.heading" introId="annual.intro">
        {planner.classes.length === 0 ? (
          <p className="muted">{t("annual.noClasses")}</p>
        ) : (
          <ul className="chips">
            {planner.classes.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  className={c.id === selectedId ? "chip selected" : "chip"}
                  onClick={() => setSelectedId(c.id)}
                >
                  <strong>{c.name.trim() || t("common.unnamed")}</strong>
                  <span className="muted">{c.subject}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {selected && (
        <>
          <Panel headingId="annual.overview">
            {/* The source page's own header row. Every value is looked up. */}
            <dl className="meta">
              <dt>{t("annual.subject")}</dt>
              <dd>{selected.subject.trim() || "—"}</dd>
              <dt>{t("annual.class")}</dt>
              <dd>{selected.name.trim() || t("common.unnamed")}</dd>
              <dt>{t("annual.hoursPerWeek")}</dt>
              <dd>
                {hoursOfClass(planner, selected.id).length} ·{" "}
                <span className="muted">{t("annual.hoursDerived")}</span>
              </dd>
            </dl>

            {annualPlan(planner, selected.id).length === 0 ? (
              <p className="muted">{t("annual.empty")}</p>
            ) : (
              <table className="grid">
                <thead>
                  <tr>
                    <th scope="col">{t("annual.colPeriod")}</th>
                    <th scope="col">{t("annual.colTitle")}</th>
                    <th scope="col">{t("annual.colSkills")}</th>
                    <th scope="col">{t("annual.colHours")}</th>
                    <th scope="col">{t("annual.colAssessment")}</th>
                  </tr>
                </thead>
                <tbody>
                  {annualPlan(planner, selected.id).map((row) => (
                    <tr key={row.unit.id}>
                      <td>{row.period}</td>
                      <td>{row.title || t("annual.blankUnit")}</td>
                      <td>{row.skills}</td>
                      <td>{row.hours}</td>
                      <td>{row.assessment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Panel>

          <Panel
            headingId="annual.units"
            introId="annual.unitsIntro"
            actions={
              <Button
                labelId="annual.newUnit"
                variant="primary"
                onClick={() => run(() => api.saveUnit(emptyUnit(selected.id)))}
              />
            }
          >
            {unitsOfClass(planner, selected.id).length === 0 ? (
              <p className="muted">{t("annual.empty")}</p>
            ) : (
              <ul className="rows">
                {unitsOfClass(planner, selected.id).map((unit, index) => (
                  <UnitCard key={unit.id} unit={unit} index={index + 1} run={run} />
                ))}
              </ul>
            )}
          </Panel>
        </>
      )}
    </>
  );
}

function UnitCard({ unit, index, run }: { unit: Unit; index: number; run: Run }) {
  const t = useTranslate();
  // Every patch carries this unit's own id, so one card can never write another.
  const save = (patch: Partial<Unit>) => run(() => api.saveUnit({ ...unit, ...patch }));

  return (
    <li>
      <section className="card" aria-label={t("annual.unitNumber", { n: index })}>
        <div className="panel-head">
          <h3>{t("annual.unitNumber", { n: index })}</h3>
          <Button
            labelId="annual.removeUnit"
            variant="danger"
            onClick={() => run(() => api.deleteUnit(unit.id))}
          />
        </div>
        {!hasUnitContent(unit) && <p className="muted">{t("annual.blankUnit")}</p>}

        {/* The source card's own head row. */}
        <div className="row wrap">
          <DeferredTextField
            labelId="unit.title"
            value={unit.title}
            onCommit={(title) => save({ title })}
          />
          <DeferredTextField
            labelId="unit.period"
            value={unit.period}
            onCommit={(period) => save({ period })}
          />
          <DeferredTextField
            labelId="unit.hours"
            value={unit.hours}
            onCommit={(hours) => save({ hours })}
          />
          <DeferredTextField
            labelId="unit.deadlines"
            value={unit.deadlines}
            onCommit={(deadlines) => save({ deadlines })}
          />
        </div>

        {/* ΔΙΔΑΚΤΙΚΟΙ ΣΤΟΧΟΙ · ΜΕΘΟΔΟΙ ΚΑΙ ΜΟΡΦΕΣ ΕΡΓΑΣΙΑΣ · ΒΑΘΜΟΙ, plus the
            annual plan's own Δεξιότητες / Κριτήρια, which the source heads
            differently from the goals and so is kept apart from them. */}
        <div className="row wrap">
          <UnitArea labelId="unit.objectives" value={unit.objectives} onSave={(v) => save({ objectives: v })} />
          <UnitArea labelId="unit.skills" value={unit.skills} onSave={(v) => save({ skills: v })} />
          <UnitArea labelId="unit.methods" value={unit.methods} onSave={(v) => save({ methods: v })} />
          <UnitArea
            labelId="unit.assessment"
            value={unit.assessment}
            onSave={(v) => save({ assessment: v })}
          />
        </div>

        {/* ΠΕΡΙΕΧΟΜΕΝΟ · ΥΛΙΚΑ · ΕΞΑΤΟΜΙΚΕΥΣΗ */}
        <div className="row wrap">
          <UnitArea labelId="unit.content" value={unit.content} onSave={(v) => save({ content: v })} />
          <UnitArea
            labelId="unit.materials"
            value={unit.materials}
            onSave={(v) => save({ materials: v })}
          />
          <UnitArea
            labelId="unit.differentiation"
            value={unit.differentiation}
            onSave={(v) => save({ differentiation: v })}
          />
        </div>

        {/* ΑΝΑΚΕΦΑΛΑΙΩΣΗ ΕΝΟΤΗΤΑΣ — the spec's "review". */}
        <UnitArea labelId="unit.review" value={unit.review} onSave={(v) => save({ review: v })} />
      </section>
    </li>
  );
}

/**
 * A multi-line unit field that commits on blur.
 *
 * The same rule the deferred text field follows, and for the same reason: a
 * write per keystroke would mean a file write and a fingerprint re-check for
 * every letter of a paragraph.
 */
function UnitArea({
  labelId,
  value,
  onSave,
}: {
  labelId: Parameters<typeof TextArea>[0]["labelId"];
  value: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <div
      onBlur={() => {
        if (draft !== value) onSave(draft);
      }}
    >
      <TextArea labelId={labelId} value={draft} onChange={setDraft} />
    </div>
  );
}
