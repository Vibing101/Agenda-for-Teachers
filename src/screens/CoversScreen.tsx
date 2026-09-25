/**
 * Αναπλήρωση και άδειες — two registers on one page, as on the source, and
 * **nothing shared between them**.
 *
 * Each panel renders from its own selector, each row saves through its own
 * command, and neither panel is handed the other's records. A cover she taught
 * and a leave she took on the same day are two unrelated lines — M8's second
 * acceptance criterion. The page takes no `today`: nothing here depends on
 * the calendar, and a new line starts undated at the top, as M6's exams do.
 */
import { api } from "../api";
import { Button, DeferredTextField, Panel } from "../components/Fields";
import {
  coverRegister,
  emptyCoverRecord,
  emptyLeaveRecord,
  leaveRegister,
  type CoverRecord,
  type LeaveRecord,
} from "../domain/covers";
import type { Planner } from "../domain/types";
import { countOf } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import type { Run } from "./types";

export default function CoversScreen({ planner, run }: { planner: Planner; run: Run }) {
  return (
    <>
      <CoverPanel covers={coverRegister(planner)} run={run} />
      <LeavePanel leaves={leaveRegister(planner)} run={run} />
    </>
  );
}

function CoverPanel({ covers, run }: { covers: CoverRecord[]; run: Run }) {
  const t = useTranslate();
  return (
    <Panel
      headingId="covers.heading"
      introId="covers.intro"
      actions={
        <Button
          labelId="covers.new"
          variant="primary"
          onClick={() => run(() => api.saveCoverRecord(emptyCoverRecord()))}
        />
      }
    >
      {covers.length === 0 ? (
        <p className="muted">{t("covers.none")}</p>
      ) : (
        <>
          <p className="muted">{countOf(t, "covers.count", covers.length)}</p>
          <ul className="rows">
            {covers.map((record, i) => (
              <CoverRow key={record.id} record={record} index={i + 1} run={run} />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function CoverRow({ record, index, run }: { record: CoverRecord; index: number; run: Run }) {
  const t = useTranslate();
  const save = (patch: Partial<CoverRecord>) =>
    run(() => api.saveCoverRecord({ ...record, ...patch }));
  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("covers.entry", { n: index })}>
        <DeferredTextField
          labelId="common.date"
          type="date"
          value={record.date}
          onCommit={(date) => save({ date })}
        />
        <DeferredTextField
          labelId="covers.class"
          value={record.class_name}
          onCommit={(class_name) => save({ class_name })}
        />
        <DeferredTextField
          labelId="covers.covered"
          value={record.covered}
          onCommit={(covered) => save({ covered })}
        />
        <DeferredTextField
          labelId="covers.teacher"
          value={record.teacher}
          onCommit={(teacher) => save({ teacher })}
        />
        <DeferredTextField labelId="covers.notes" value={record.notes} onCommit={(notes) => save({ notes })} />
        <Button
          labelId="covers.remove"
          variant="danger"
          onClick={() => run(() => api.deleteCoverRecord(record.id))}
        />
      </div>
    </li>
  );
}

function LeavePanel({ leaves, run }: { leaves: LeaveRecord[]; run: Run }) {
  const t = useTranslate();
  return (
    <Panel
      headingId="leave.heading"
      introId="leave.intro"
      actions={
        <Button
          labelId="leave.new"
          variant="primary"
          onClick={() => run(() => api.saveLeaveRecord(emptyLeaveRecord()))}
        />
      }
    >
      {leaves.length === 0 ? (
        <p className="muted">{t("leave.none")}</p>
      ) : (
        <>
          <p className="muted">{countOf(t, "leave.count", leaves.length)}</p>
          <ul className="rows">
            {leaves.map((record, i) => (
              <LeaveRow key={record.id} record={record} index={i + 1} run={run} />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function LeaveRow({ record, index, run }: { record: LeaveRecord; index: number; run: Run }) {
  const t = useTranslate();
  const save = (patch: Partial<LeaveRecord>) =>
    run(() => api.saveLeaveRecord({ ...record, ...patch }));
  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("leave.entry", { n: index })}>
        <DeferredTextField
          labelId="common.date"
          type="date"
          value={record.date}
          onCommit={(date) => save({ date })}
        />
        <DeferredTextField labelId="leave.reason" value={record.reason} onCommit={(reason) => save({ reason })} />
        <DeferredTextField
          labelId="leave.documents"
          value={record.documents}
          onCommit={(documents) => save({ documents })}
        />
        <Button
          labelId="leave.remove"
          variant="danger"
          onClick={() => run(() => api.deleteLeaveRecord(record.id))}
        />
      </div>
    </li>
  );
}
