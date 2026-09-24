/**
 * Ευεξία εκπαιδευτικού — dated free-text reflections, and the page's two
 * standing boxes.
 *
 * **There is no rating of any kind on this screen, on purpose.** The source
 * page has five columns for energy, workload, mood, sleep and balance; the
 * spec's Resolved table rules them out ("free text only"). See
 * `domain/wellbeing.ts`.
 *
 * A new reflection is dated `today` — the day the shell read, never the clock
 * — and goes to the top of a newest-first journal. Its week number is derived
 * from the school year's start date as it is displayed.
 */
import { api } from "../api";
import { Button, DeferredTextArea, DeferredTextField, Panel } from "../components/Fields";
import type { Planner } from "../domain/types";
import {
  emptyWellbeingEntry,
  wellbeingJournal,
  wellbeingWeek,
  type WellbeingEntry,
} from "../domain/wellbeing";
import { useTranslate } from "../i18n/useTranslate";
import type { Run } from "./types";

export default function WellbeingScreen({
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
  const entries = wellbeingJournal(planner);
  const note = planner.wellbeing_note;

  return (
    <>
      <Panel
        headingId="wellbeing.heading"
        introId="wellbeing.intro"
        actions={
          <Button
            labelId="wellbeing.new"
            variant="primary"
            onClick={() => run(() => api.saveWellbeingEntry(emptyWellbeingEntry(today)))}
          />
        }
      >
        <p className="note">{t("wellbeing.freeText")}</p>
        {entries.length === 0 ? (
          <p className="muted">{t("wellbeing.none")}</p>
        ) : (
          <>
            <p className="muted">{t("wellbeing.count", { n: entries.length })}</p>
            <ul className="rows">
              {entries.map((entry, i) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  index={i + 1}
                  week={wellbeingWeek(planner, entry)}
                  run={run}
                />
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel headingId="wellbeing.standing">
        <div className="columns">
          <DeferredTextArea
            labelId="wellbeing.sustains"
            value={note.sustains}
            onCommit={(sustains) => run(() => api.saveWellbeingNote({ ...note, sustains }))}
          />
          <DeferredTextArea
            labelId="wellbeing.boundaries"
            value={note.boundaries}
            onCommit={(boundaries) => run(() => api.saveWellbeingNote({ ...note, boundaries }))}
          />
        </div>
      </Panel>
    </>
  );
}

function EntryRow({
  entry,
  index,
  week,
  run,
}: {
  entry: WellbeingEntry;
  index: number;
  week: number | null;
  run: Run;
}) {
  const t = useTranslate();
  const save = (patch: Partial<WellbeingEntry>) =>
    run(() => api.saveWellbeingEntry({ ...entry, ...patch }));
  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("wellbeing.entry", { n: index })}>
        <DeferredTextField
          labelId="common.date"
          type="date"
          value={entry.date}
          onCommit={(date) => save({ date })}
        />
        <span className="tag">
          {week === null ? t("wellbeing.noWeek") : t("wellbeing.week", { n: week })}
        </span>
        <DeferredTextArea
          labelId="wellbeing.notes"
          value={entry.notes}
          rows={3}
          onCommit={(notes) => save({ notes })}
        />
        <Button
          labelId="wellbeing.remove"
          variant="danger"
          onClick={() => run(() => api.deleteWellbeingEntry(entry.id))}
        />
      </div>
    </li>
  );
}
