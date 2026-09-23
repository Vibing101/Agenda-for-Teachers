/**
 * Συνεδριάσεις και συσκέψεις — staff, council and class meetings.
 *
 * The source page is "Συνεδρίαση του συλλόγου · Μητρώο συλλόγων διδασκόντων και
 * συνεδριάσεων", a page of cards each carrying `ΗΜΕΡΟΜΗΝΙΑ / ΕΙΔΟΣ / ΔΙΑΡΚΕΙΑ`
 * over a `ΗΜΕΡΗΣΙΑ ΔΙΑΤΑΞΗ · ΣΥΜΦΩΝΙΕΣ · ΕΝΕΡΓΕΙΕΣ` area. That is what this is,
 * with the agreements broken out as rows because the spec names three parts of
 * one — who, what, and by when — and a deadline that is a stored date is what
 * the upcoming panel can read.
 *
 * **A card is edited in place**, as the M4 support plans are: each field
 * carries its own record's id, so "new meeting" moves no selection.
 *
 * `focusId` lets the upcoming-overview panel open straight into a meeting's
 * minutes, which is what the spec asks that panel to do.
 */
import { useMemo } from "react";
import { api } from "../api";
import { Button, DeferredTextField, Panel } from "../components/Fields";
import {
  agreementsOfMeeting,
  allMeetings,
  emptyAgreement,
  emptyMeeting,
  meetingClass,
  type MeetingAgreement,
  type StaffMeeting,
} from "../domain/meetings";
import type { Planner } from "../domain/types";
import { MEETING_KINDS, meetingKindLabel } from "../i18n/vocabularies";
import { useTranslate } from "../i18n/useTranslate";
import type { Run } from "./types";

export default function MeetingsScreen({
  planner,
  run,
  focusId,
}: {
  planner: Planner;
  run: Run;
  /** A meeting the upcoming panel asked to be opened. */
  focusId?: number | null;
}) {
  const t = useTranslate();
  const meetings = useMemo(() => allMeetings(planner), [planner]);

  return (
    <Panel
      headingId="meetings.heading"
      introId="meetings.intro"
      actions={
        <Button
          labelId="meetings.new"
          variant="primary"
          onClick={() => run(() => api.saveStaffMeeting(emptyMeeting()))}
        />
      }
    >
      {meetings.length === 0 ? (
        <p className="muted">{t("meetings.none")}</p>
      ) : (
        <ul className="rows">
          {meetings.map((meeting, index) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              index={index + 1}
              planner={planner}
              run={run}
              focused={focusId === meeting.id}
            />
          ))}
        </ul>
      )}
    </Panel>
  );
}

function MeetingCard({
  meeting,
  index,
  planner,
  run,
  focused,
}: {
  meeting: StaffMeeting;
  index: number;
  planner: Planner;
  run: Run;
  focused: boolean;
}) {
  const t = useTranslate();
  const save = (patch: Partial<StaffMeeting>) =>
    run(() => api.saveStaffMeeting({ ...meeting, ...patch }));
  const agreements = agreementsOfMeeting(planner, meeting.id);
  const schoolClass = meetingClass(planner, meeting);

  return (
    <li>
      <div
        className={focused ? "card selected" : "card"}
        role="group"
        aria-label={t("meetings.entry", { n: index })}
      >
        <div className="row wrap">
          <label className="field">
            <span>{t("meetings.kind")}</span>
            <select
              value={meeting.kind}
              onChange={(e) => save({ kind: e.target.value as StaffMeeting["kind"] })}
            >
              {MEETING_KINDS.map((code) => (
                <option key={code} value={code}>
                  {t(meetingKindLabel(code))}
                </option>
              ))}
            </select>
          </label>
          <DeferredTextField
            labelId="meetings.date"
            type="date"
            value={meeting.date}
            onCommit={(date) => save({ date })}
          />
          <DeferredTextField
            labelId="meetings.clockTime"
            type="time"
            value={meeting.clock_time}
            onCommit={(clock_time) => save({ clock_time })}
          />
          {/* Free text: "90 λεπτά" and "2 ώρες" are both things a teacher
              writes, and the source's own ΔΙΑΡΚΕΙΑ box is a box. */}
          <DeferredTextField
            labelId="meetings.duration"
            value={meeting.duration}
            onCommit={(duration) => save({ duration })}
          />
          {/* Optional, and `ON DELETE SET NULL`: deleting a class does not
              delete the minutes of a meeting that happened. */}
          <label className="field">
            <span>{t("meetings.class")}</span>
            <select
              value={String(schoolClass?.id ?? 0)}
              onChange={(e) => {
                const id = Number(e.target.value);
                save({ class_id: id === 0 ? null : id });
              }}
            >
              <option value="0">{t("meetings.noClass")}</option>
              {planner.classes.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name.trim() || t("common.unnamed")}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="row wrap">
          <DeferredTextField
            labelId="meetings.attendees"
            value={meeting.attendees}
            onCommit={(attendees) => save({ attendees })}
          />
          <DeferredTextField
            labelId="meetings.agenda"
            value={meeting.agenda}
            onCommit={(agenda) => save({ agenda })}
          />
          <DeferredTextField
            labelId="meetings.notes"
            value={meeting.notes}
            onCommit={(notes) => save({ notes })}
          />
          <Button
            labelId="meetings.remove"
            variant="danger"
            onClick={() => run(() => api.deleteStaffMeeting(meeting.id))}
          />
        </div>

        <h3>{t("meetings.agreements")}</h3>
        {agreements.length === 0 ? (
          <p className="muted">{t("meetings.noAgreements")}</p>
        ) : (
          <ul className="rows">
            {agreements.map((agreement, i) => (
              <AgreementRow
                key={agreement.id}
                agreement={agreement}
                index={i + 1}
                run={run}
              />
            ))}
          </ul>
        )}
        <Button
          labelId="meetings.newAgreement"
          onClick={() => run(() => api.saveMeetingAgreement(emptyAgreement(meeting.id)))}
        />
      </div>
    </li>
  );
}

function AgreementRow({
  agreement,
  index,
  run,
}: {
  agreement: MeetingAgreement;
  index: number;
  run: Run;
}) {
  const t = useTranslate();
  const save = (patch: Partial<MeetingAgreement>) =>
    run(() => api.saveMeetingAgreement({ ...agreement, ...patch }));

  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("meetings.agreementEntry", { n: index })}>
        <DeferredTextField
          labelId="meetings.who"
          value={agreement.who}
          onCommit={(who) => save({ who })}
        />
        <DeferredTextField
          labelId="meetings.what"
          value={agreement.what}
          onCommit={(what) => save({ what })}
        />
        <DeferredTextField
          labelId="meetings.deadline"
          type="date"
          value={agreement.deadline}
          onCommit={(deadline) => save({ deadline })}
        />
        <Button
          labelId="meetings.removeAgreement"
          variant="danger"
          onClick={() => run(() => api.deleteMeetingAgreement(agreement.id))}
        />
      </div>
    </li>
  );
}
