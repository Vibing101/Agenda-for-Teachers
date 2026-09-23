/**
 * Επικοινωνία με τους γονείς — the parent communication log.
 *
 * The source page is a flat register "κατάλληλο για επίσημη τεκμηρίωση" with
 * columns `Ημερομηνία | Μαθητής | Ποιος | Μορφή | Αιτία | Συμφωνίες | Επόμενα`
 * and a page-level `ΠΑΡΑΤΗΡΗΣΕΙΣ` box. That is what this is.
 *
 * **This is the record of what happened. It is not the booking.** The weekly
 * appointment grid is a separate screen over a separate table, and there is no
 * call on this screen that writes one — the spec's own distinction, and M5's
 * second acceptance criterion.
 *
 * **Rows are edited in place**, like the absence register's and the incident
 * log's: each field carries its own row's id, so "new contact" has no selection
 * to move and the shape that cost M1 a data-loss bug does not arise. The
 * regression test still starts from a planner that already holds contacts.
 */
import { useMemo, useState } from "react";
import { api } from "../api";
import { ExportButton } from "../components/ExportButton";
import { Button, DeferredTextField, Panel } from "../components/Fields";
import { formatDate } from "../domain/dates";
import {
  allContacts,
  contactStudent,
  emptyContact,
  filteredContacts,
  type ParentContact,
} from "../domain/parents";
import type { Planner } from "../domain/types";
import { CONTACT_FORMATS, contactFormatLabel } from "../i18n/vocabularies";
import { useTranslate } from "../i18n/useTranslate";
import { contactLogHtml } from "../print/parentSheets";
import type { Run } from "./types";

export default function ContactsScreen({
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
  const [studentFilter, setStudentFilter] = useState(0);
  const [classFilter, setClassFilter] = useState(0);

  const filter = useMemo(
    () => ({ studentId: studentFilter, classId: classFilter }),
    [studentFilter, classFilter],
  );
  /**
   * The rows on screen — and, through the same selector, the rows on the
   * printed sheet. One definition, so the paper cannot disagree with the
   * screen for the same filter.
   */
  const shown = useMemo(() => filteredContacts(planner, filter), [planner, filter]);

  const all = allContacts(planner);
  const filterClass = planner.classes.find((c) => c.id === classFilter);

  return (
    <Panel
      headingId="contacts.heading"
      introId="contacts.intro"
      actions={
        <>
          <Button
            labelId="contacts.new"
            variant="primary"
            disabled={planner.students.length === 0}
            onClick={() =>
              run(() => api.saveParentContact(emptyContact(studentFilter || planner.students[0].id)))
            }
          />
          {/* Prints exactly what the filter above is showing, and names that
              filter on the sheet's own header. */}
          <ExportButton
            labelId="contacts.export"
            fileName={t("contacts.fileName", {
              scope: filterClass?.name.trim() || t("print.filterAll"),
              date: formatDate(today),
            })}
            html={() => contactLogHtml(t, planner, filter, today)}
          />
        </>
      }
    >
      {planner.students.length === 0 ? (
        <p className="muted">{t("contacts.noStudents")}</p>
      ) : (
        <>
          {/* Names are the teacher's own text, so these are plain selects. */}
          <div className="row">
            <label className="field">
              <span>{t("contacts.filterStudent")}</span>
              <select
                value={String(studentFilter)}
                onChange={(e) => setStudentFilter(Number(e.target.value))}
              >
                <option value="0">{t("contacts.filterAll")}</option>
                {planner.students.map((s) => (
                  <option key={s.id} value={String(s.id)}>
                    {s.full_name.trim() || t("common.unnamed")}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>{t("contacts.filterClass")}</span>
              <select
                value={String(classFilter)}
                onChange={(e) => setClassFilter(Number(e.target.value))}
              >
                <option value="0">{t("contacts.filterAll")}</option>
                {planner.classes.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name.trim() || t("common.unnamed")}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <p className="muted">{t("contacts.independent")}</p>

          {all.length === 0 ? (
            <p className="muted">{t("contacts.none")}</p>
          ) : shown.length === 0 ? (
            <p className="muted">{t("contacts.noMatches")}</p>
          ) : (
            <>
              <p className="muted">{t("contacts.count", { n: shown.length })}</p>
              <ul className="rows">
                {shown.map((contact, index) => (
                  <ContactRow
                    key={contact.id}
                    contact={contact}
                    index={index + 1}
                    planner={planner}
                    run={run}
                  />
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

function ContactRow({
  contact,
  index,
  planner,
  run,
}: {
  contact: ParentContact;
  index: number;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  // Every patch carries this row's own id, so one entry can never write another.
  const save = (patch: Partial<ParentContact>) =>
    run(() => api.saveParentContact({ ...contact, ...patch }));
  const student = contactStudent(planner, contact);

  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("contacts.entry", { n: index })}>
        <DeferredTextField
          labelId="common.date"
          type="date"
          value={contact.date}
          onCommit={(date) => save({ date })}
        />
        <label className="field">
          <span>{t("contacts.student")}</span>
          <select
            value={String(student?.id ?? contact.student_id)}
            onChange={(e) => save({ student_id: Number(e.target.value) })}
          >
            {planner.students.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.full_name.trim() || t("common.unnamed")}
              </option>
            ))}
          </select>
        </label>
        {/* Free text rather than a pick from the card's two guardian slots: the
            person who actually rang may be a grandparent or an interpreter, and
            the source column is headed simply "Ποιος". */}
        <DeferredTextField
          labelId="contacts.guardian"
          value={contact.guardian}
          onCommit={(guardian) => save({ guardian })}
        />
        <label className="field">
          <span>{t("contacts.format")}</span>
          <select
            value={contact.format}
            onChange={(e) =>
              save({ format: e.target.value as ParentContact["format"] })
            }
          >
            {CONTACT_FORMATS.map((code) => (
              <option key={code} value={code}>
                {t(contactFormatLabel(code))}
              </option>
            ))}
          </select>
        </label>
        {/* The spec asks for the reason and the agreements to be kept apart
            from the overall remarks, so they are three fields, not one. */}
        <DeferredTextField
          labelId="contacts.reason"
          value={contact.reason}
          onCommit={(reason) => save({ reason })}
        />
        <DeferredTextField
          labelId="contacts.agreements"
          value={contact.agreements}
          onCommit={(agreements) => save({ agreements })}
        />
        <DeferredTextField
          labelId="contacts.outcome"
          value={contact.outcome}
          onCommit={(outcome) => save({ outcome })}
        />
        <DeferredTextField
          labelId="contacts.nextStep"
          value={contact.next_step}
          onCommit={(next_step) => save({ next_step })}
        />
        <DeferredTextField
          labelId="contacts.remarks"
          value={contact.remarks}
          onCommit={(remarks) => save({ remarks })}
        />
        <Button
          labelId="contacts.remove"
          variant="danger"
          onClick={() => run(() => api.deleteParentContact(contact.id))}
        />
      </div>
    </li>
  );
}
