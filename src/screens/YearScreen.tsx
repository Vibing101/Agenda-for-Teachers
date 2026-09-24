/**
 * Έτος — the school year: its start date, periods, holidays, important dates
 * and the six fixed annual goals.
 *
 * The screen's job beyond plain editing is to make the date-keyed design
 * *visible*. Changing the start date re-derives the week numbering in front of
 * the teacher and touches no record, and the panel says so, because "will this
 * wreck what I already typed?" is exactly the fear the source product's own
 * quick-start guide has to answer.
 */
import { useMemo, useState } from "react";
import { api } from "../api";
import { Button, Panel, SelectField, TextArea, TextField } from "../components/Fields";
import { useStoredDraft } from "../components/useStoredDraft";
import { formatDate, isIsoDate } from "../domain/dates";
import { lastWeekStart, firstMonday, monthsOfYear, WEEKS_IN_YEAR } from "../domain/schoolYear";
import type {
  AnnualGoal,
  GradingPeriod,
  Holiday,
  ImportantDate,
  Planner,
  SchoolYear,
} from "../domain/types";
import type { StringId } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import {
  goalAreaLabel,
  holidaySourceLabel,
  HOLIDAY_SOURCES,
  IMPORTANT_DATE_KINDS,
  importantDateKindLabel,
  monthLabel,
  YEAR_MODELS,
  yearModelLabel,
  type HolidaySource,
  type ImportantDateKind,
  type YearModel,
} from "../i18n/vocabularies";
import type { Run } from "./types";

/** The three grading periods are a fixed set, so their names are plain strings. */
const periodHeading = (ordinal: number) => `year.period.${ordinal}` as StringId;

export default function YearScreen({ planner, run }: { planner: Planner; run: Run }) {
  return (
    <>
      <YearSetup year={planner.school_year} run={run} />
      <Periods periods={planner.grading_periods} run={run} />
      <Holidays holidays={planner.holidays} run={run} />
      <ImportantDates dates={planner.important_dates} run={run} />
      <Goals goals={planner.annual_goals} run={run} />
    </>
  );
}

function YearSetup({ year, run }: { year: SchoolYear; run: Run }) {
  const t = useTranslate();
  const [draft, setDraft] = useStoredDraft(year);
  const model = draft.year_model;
  const startDate = draft.start_date;
  const setModel = (year_model: YearModel) => setDraft((d) => ({ ...d, year_model }));
  const setStartDate = (start_date: string) => setDraft((d) => ({ ...d, start_date }));

  // Derived live from the draft, so the teacher sees what she is about to get
  // before she commits to it.
  const monday = firstMonday(startDate);
  const last = lastWeekStart(startDate);
  const months = useMemo(() => monthsOfYear(model, startDate), [model, startDate]);
  const dirty = model !== year.year_model || startDate !== year.start_date;

  return (
    <Panel headingId="year.heading" introId="year.intro">
      <div className="row">
        <SelectField
          labelId="year.model"
          value={model}
          onChange={setModel}
          options={YEAR_MODELS}
          optionLabelId={yearModelLabel}
        />
        <TextField
          labelId="year.startDate"
          hintId="year.startDateHelp"
          type="date"
          value={startDate}
          onChange={setStartDate}
        />
      </div>

      <dl className="derived">
        <dt>{t("year.weeks")}</dt>
        <dd>
          {monday && last
            ? t("year.weeksValue", {
                count: WEEKS_IN_YEAR,
                first: formatDate(monday),
                last: formatDate(last),
              })
            : t("year.startDateMissing")}
        </dd>
        <dt>{t("year.months")}</dt>
        <dd>
          {months.length
            ? months.map((m) => `${t(monthLabel(m.month))} ${m.year}`).join(" · ")
            : t("year.startDateMissing")}
        </dd>
      </dl>

      {monday && <p className="note">{t("year.startDateSnapped", { date: formatDate(monday) })}</p>}
      <p className="note">{t("year.dataIsSafe")}</p>

      <div className="actions">
        <Button
          labelId="common.save"
          variant="primary"
          disabled={!dirty}
          onClick={() =>
            // The Monday is what gets stored, so week 1 always starts on one
            // however the teacher typed it.
            run(() =>
              api.saveSchoolYear({
                year_model: model,
                start_date: isIsoDate(startDate) ? (monday ?? "") : "",
              }),
            )
          }
        />
      </div>
    </Panel>
  );
}

function Periods({ periods, run }: { periods: GradingPeriod[]; run: Run }) {
  const t = useTranslate();
  const [draft, setDraft] = useStoredDraft(periods);

  const update = (ordinal: number, patch: Partial<GradingPeriod>) =>
    setDraft((rows) => rows.map((r) => (r.ordinal === ordinal ? { ...r, ...patch } : r)));

  return (
    <Panel headingId="year.periods">
      <div className="columns">
        {draft.map((p) => (
          <div key={p.ordinal} className="card">
            <h3>{t(periodHeading(p.ordinal))}</h3>
            <TextField
              labelId="year.periodName"
              value={p.name}
              onChange={(name) => update(p.ordinal, { name })}
            />
            <TextField
              labelId="common.from"
              type="date"
              value={p.start_date}
              onChange={(start_date) => update(p.ordinal, { start_date })}
            />
            <TextField
              labelId="common.to"
              type="date"
              value={p.end_date}
              onChange={(end_date) => update(p.ordinal, { end_date })}
            />
            <TextArea
              labelId="common.notes"
              value={p.notes}
              onChange={(notes) => update(p.ordinal, { notes })}
            />
          </div>
        ))}
      </div>
      <div className="actions">
        <Button
          labelId="common.save"
          variant="primary"
          onClick={() => run(() => api.saveGradingPeriods(draft))}
        />
      </div>
    </Panel>
  );
}

const BLANK_HOLIDAY: Holiday = {
  id: 0,
  name: "",
  start_date: "",
  end_date: "",
  source: "ministry",
  notes: "",
};

function Holidays({ holidays, run }: { holidays: Holiday[]; run: Run }) {
  const t = useTranslate();
  const [draft, setDraft] = useState<Holiday>(BLANK_HOLIDAY);

  return (
    <Panel headingId="year.holidays" introId="year.holidaysIntro">
      {holidays.length === 0 ? (
        <p className="muted">{t("year.noHolidays")}</p>
      ) : (
        <ul className="rows">
          {holidays.map((h) => (
            <li key={h.id}>
              <span className="grow">{h.name}</span>
              <span className="muted">
                {formatDate(h.start_date)} – {formatDate(h.end_date)}
              </span>
              <span className="tag">{t(holidaySourceLabel(h.source))}</span>
              <Button
                labelId="common.delete"
                variant="danger"
                onClick={() => run(() => api.deleteHoliday(h.id))}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="row">
        <TextField
          labelId="year.holidayName"
          value={draft.name}
          onChange={(name) => setDraft((d) => ({ ...d, name }))}
        />
        <TextField
          labelId="common.from"
          type="date"
          value={draft.start_date}
          onChange={(start_date) => setDraft((d) => ({ ...d, start_date }))}
        />
        <TextField
          labelId="common.to"
          type="date"
          value={draft.end_date}
          onChange={(end_date) => setDraft((d) => ({ ...d, end_date }))}
        />
        <SelectField<HolidaySource>
          labelId="year.holidaySource"
          value={draft.source}
          onChange={(source) => setDraft((d) => ({ ...d, source }))}
          options={HOLIDAY_SOURCES}
          optionLabelId={holidaySourceLabel}
        />
      </div>
      <div className="actions">
        <Button
          labelId="year.addHoliday"
          disabled={!draft.name.trim()}
          onClick={async () => {
            await run(() => api.saveHoliday(draft));
            setDraft(BLANK_HOLIDAY);
          }}
        />
      </div>
    </Panel>
  );
}

const BLANK_DATE: ImportantDate = { id: 0, name: "", date: "", kind: "other", notes: "" };

function ImportantDates({ dates, run }: { dates: ImportantDate[]; run: Run }) {
  const t = useTranslate();
  const [draft, setDraft] = useState<ImportantDate>(BLANK_DATE);

  return (
    <Panel headingId="year.importantDates" introId="year.importantDatesIntro">
      {dates.length === 0 ? (
        <p className="muted">{t("year.noImportantDates")}</p>
      ) : (
        <ul className="rows">
          {dates.map((d) => (
            <li key={d.id}>
              <span className="grow">{d.name}</span>
              <span className="muted">{formatDate(d.date)}</span>
              <span className="tag">{t(importantDateKindLabel(d.kind))}</span>
              <Button
                labelId="common.delete"
                variant="danger"
                onClick={() => run(() => api.deleteImportantDate(d.id))}
              />
            </li>
          ))}
        </ul>
      )}

      <div className="row">
        <TextField
          labelId="year.importantDateName"
          value={draft.name}
          onChange={(name) => setDraft((d) => ({ ...d, name }))}
        />
        <TextField
          labelId="common.date"
          type="date"
          value={draft.date}
          onChange={(date) => setDraft((d) => ({ ...d, date }))}
        />
        <SelectField<ImportantDateKind>
          labelId="year.importantDateKind"
          value={draft.kind}
          onChange={(kind) => setDraft((d) => ({ ...d, kind }))}
          options={IMPORTANT_DATE_KINDS}
          optionLabelId={importantDateKindLabel}
        />
      </div>
      <div className="actions">
        <Button
          labelId="year.addImportantDate"
          disabled={!draft.name.trim()}
          onClick={async () => {
            await run(() => api.saveImportantDate(draft));
            setDraft(BLANK_DATE);
          }}
        />
      </div>
    </Panel>
  );
}

function Goals({ goals, run }: { goals: AnnualGoal[]; run: Run }) {
  const t = useTranslate();
  const [draft, setDraft] = useStoredDraft(goals);

  const update = (area: string, patch: Partial<AnnualGoal>) =>
    setDraft((rows) => rows.map((r) => (r.area === area ? { ...r, ...patch } : r)));

  return (
    <Panel headingId="year.goals" introId="year.goalsIntro">
      {/* M8: the open-ended development goals are elsewhere, on purpose. */}
      <p className="note">{t("year.goalsSeparate")}</p>
      <div className="columns">
        {draft.map((g) => (
          <div key={g.area} className="card">
            <h3>{t(goalAreaLabel(g.area))}</h3>
            <TextArea
              labelId="year.goal"
              value={g.goal}
              onChange={(goal) => update(g.area, { goal })}
            />
            <TextArea
              labelId="year.goalActions"
              value={g.actions}
              onChange={(actions) => update(g.area, { actions })}
            />
            <TextArea
              labelId="year.goalIndicators"
              value={g.success_indicators}
              onChange={(success_indicators) => update(g.area, { success_indicators })}
            />
            <TextField
              labelId="year.goalDeadline"
              type="date"
              value={g.deadline}
              onChange={(deadline) => update(g.area, { deadline })}
            />
            {/* Free text, not a fixed vocabulary: the source product leaves this
                open, and the spec only fixes a status vocabulary for support
                plans (M4), which it also says stays teacher-written. */}
            <TextField
              labelId="year.goalStatus"
              value={g.status}
              onChange={(status) => update(g.area, { status })}
            />
            <TextArea
              labelId="year.goalReview"
              value={g.review}
              onChange={(review) => update(g.area, { review })}
            />
            <div className="actions">
              <Button
                labelId="common.save"
                variant="primary"
                onClick={() => run(() => api.saveAnnualGoal(g))}
              />
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
