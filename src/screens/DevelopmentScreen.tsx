/**
 * Ανάπτυξη και καριέρα — the source's page 224 as one screen: the training
 * log, then `ΣΤΟΧΟΙ ΑΝΑΠΤΥΞΗΣ` and `ΠΡΟΫΠΟΛΟΓΙΣΜΟΣ ΚΑΙ ΣΥΝΟΨΗ`, as the page
 * lays them out.
 *
 * **The development goals live here and only here.** M1's six annual goals are
 * on Έτος, in another section of the app, and this screen neither shows nor
 * reads them — M8's first acceptance criterion says they stay visibly
 * separate and neither is generated from the other.
 *
 * **The budget summary is computed by `trainingSummary()`**, a pure function of
 * the school year, the log and the budget. The screen only lays it out, and
 * takes no `today`: the window is the school year's own dates.
 */
import { api } from "../api";
import {
  Button,
  DeferredNumberField,
  DeferredTextArea,
  DeferredTextField,
  Panel,
} from "../components/Fields";
import { formatDate } from "../domain/dates";
import {
  allDevelopmentGoals,
  emptyDevelopmentGoal,
  emptyTrainingEntry,
  trainingLog,
  trainingSummary,
  type DevelopmentGoal,
  type TrainingEntry,
} from "../domain/development";
import { formatDecimal, formatMoney } from "../domain/numbers";
import type { Planner } from "../domain/types";
import { useTranslate } from "../i18n/useTranslate";
import type { Run } from "./types";

export default function DevelopmentScreen({ planner, run }: { planner: Planner; run: Run }) {
  return (
    <>
      <TrainingPanel entries={trainingLog(planner)} run={run} />
      <GoalsPanel goals={allDevelopmentGoals(planner)} run={run} />
      <BudgetPanel planner={planner} run={run} />
    </>
  );
}

function TrainingPanel({ entries, run }: { entries: TrainingEntry[]; run: Run }) {
  const t = useTranslate();
  return (
    <Panel
      headingId="training.heading"
      introId="training.intro"
      actions={
        <Button
          labelId="training.new"
          variant="primary"
          onClick={() => run(() => api.saveTrainingEntry(emptyTrainingEntry()))}
        />
      }
    >
      {entries.length === 0 ? (
        <p className="muted">{t("training.none")}</p>
      ) : (
        <>
          <p className="muted">{t("training.count", { n: entries.length })}</p>
          <ul className="rows">
            {entries.map((entry, i) => (
              <TrainingRow key={entry.id} entry={entry} index={i + 1} run={run} />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function TrainingRow({ entry, index, run }: { entry: TrainingEntry; index: number; run: Run }) {
  const t = useTranslate();
  const save = (patch: Partial<TrainingEntry>) =>
    run(() => api.saveTrainingEntry({ ...entry, ...patch }));
  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("training.entry", { n: index })}>
        <DeferredTextField
          labelId="common.date"
          type="date"
          value={entry.date}
          onCommit={(date) => save({ date })}
        />
        <DeferredTextField
          labelId="training.activity"
          value={entry.activity}
          onCommit={(activity) => save({ activity })}
        />
        <DeferredTextField
          labelId="training.organiser"
          value={entry.organiser}
          onCommit={(organiser) => save({ organiser })}
        />
        <DeferredNumberField
          labelId="training.hours"
          value={entry.hours}
          format={formatDecimal}
          onCommit={(hours) => save({ hours })}
        />
        <DeferredTextField labelId="training.format" value={entry.format} onCommit={(format) => save({ format })} />
        <DeferredNumberField
          labelId="training.cost"
          value={entry.cost}
          format={formatMoney}
          onCommit={(cost) => save({ cost })}
        />
        <DeferredTextField
          labelId="training.certificate"
          value={entry.certificate}
          onCommit={(certificate) => save({ certificate })}
        />
        <Button
          labelId="training.remove"
          variant="danger"
          onClick={() => run(() => api.deleteTrainingEntry(entry.id))}
        />
      </div>
    </li>
  );
}

function GoalsPanel({ goals, run }: { goals: DevelopmentGoal[]; run: Run }) {
  const t = useTranslate();
  return (
    <Panel
      headingId="devgoals.heading"
      introId="devgoals.intro"
      actions={
        <Button
          labelId="devgoals.new"
          variant="primary"
          onClick={() => run(() => api.saveDevelopmentGoal(emptyDevelopmentGoal()))}
        />
      }
    >
      <p className="note">{t("devgoals.separate")}</p>
      {goals.length === 0 ? (
        <p className="muted">{t("devgoals.none")}</p>
      ) : (
        <ul className="rows">
          {goals.map((goal, i) => (
            <GoalRow key={goal.id} goal={goal} index={i + 1} run={run} />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function GoalRow({ goal, index, run }: { goal: DevelopmentGoal; index: number; run: Run }) {
  const t = useTranslate();
  const save = (patch: Partial<DevelopmentGoal>) =>
    run(() => api.saveDevelopmentGoal({ ...goal, ...patch }));
  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("devgoals.entry", { n: index })}>
        <DeferredTextArea labelId="devgoals.goal" value={goal.goal} onCommit={(v) => save({ goal: v })} />
        {/* Free text, like an annual goal's status: the source's box enumerates nothing. */}
        <DeferredTextField labelId="devgoals.status" value={goal.status} onCommit={(status) => save({ status })} />
        <DeferredTextArea
          labelId="devgoals.progress"
          value={goal.progress}
          onCommit={(progress) => save({ progress })}
        />
        <DeferredTextArea labelId="devgoals.notes" value={goal.notes} onCommit={(notes) => save({ notes })} />
        <Button
          labelId="devgoals.remove"
          variant="danger"
          onClick={() => run(() => api.deleteDevelopmentGoal(goal.id))}
        />
      </div>
    </li>
  );
}

function BudgetPanel({ planner, run }: { planner: Planner; run: Run }) {
  const t = useTranslate();
  const budget = planner.development_budget;
  const s = trainingSummary(planner);
  const left = [
    s.uncosted > 0 && t("budget.uncosted", { n: s.uncosted }),
    s.unhoured > 0 && t("budget.unhoured", { n: s.unhoured }),
    s.outside > 0 && t("budget.outside", { n: s.outside }),
    s.undated > 0 && t("budget.undated", { n: s.undated }),
  ].filter((x): x is string => typeof x === "string");

  return (
    <Panel headingId="budget.heading" introId="budget.intro">
      <div className="row wrap">
        <DeferredNumberField
          labelId="budget.amount"
          value={budget.amount}
          format={formatMoney}
          onCommit={(amount) => run(() => api.saveDevelopmentBudget({ ...budget, amount }))}
        />
        <DeferredTextArea
          labelId="budget.notes"
          value={budget.notes}
          onCommit={(notes) => run(() => api.saveDevelopmentBudget({ ...budget, notes }))}
        />
      </div>
      <dl className="derived" aria-label={t("budget.heading")}>
        <dt>{t("budget.window")}</dt>
        <dd>
          {s.window
            ? t("budget.windowValue", { from: formatDate(s.window.from), to: formatDate(s.window.to) })
            : t("budget.noWindow")}
        </dd>
        <dt>{t("budget.spent")}</dt>
        <dd>{t("budget.spentValue", { amount: formatMoney(s.spent), n: s.costed })}</dd>
        <dt>{t("budget.hours")}</dt>
        <dd>{t("budget.hoursValue", { hours: formatDecimal(s.hours) })}</dd>
        <dt>{t("budget.remaining")}</dt>
        <dd>
          {s.remaining === null
            ? t("budget.noBudget")
            : s.remaining < 0
              ? t("budget.over", { amount: formatMoney(-s.remaining) })
              : t("budget.remainingValue", { amount: formatMoney(s.remaining) })}
        </dd>
        <dt>{t("budget.left")}</dt>
        <dd>{left.length ? left.join(" · ") : t("budget.nothingLeft")}</dd>
      </dl>
    </Panel>
  );
}
