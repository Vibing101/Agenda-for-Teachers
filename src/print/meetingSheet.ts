/**
 * A meeting's minutes, printed (M10).
 *
 * The question M5 raised — "should a meeting's minutes print?" — answered yes by
 * the product owner on 2026-09-25. The source's own ΟΜΑΔΑ page is headed
 * *"Πρακτικά, συμφωνίες και ενέργειες"*, and minutes with a list of who agreed
 * to do what by when are a thing a teacher hands round.
 *
 * **Laid out as M7's blank *Πρακτικό συνεδρίασης* form is**, because that form
 * is the source's own minutes page: a row of fields (kind, date, time), who was
 * there, the agenda, then the agreements. The difference is what fills it —
 * this reads a meeting stored in *Συνεδριάσεις*, the blank form reads nothing,
 * and neither knows about the other (M7's Resolved row).
 *
 * **It reads the screen's own selectors** (M4.5's rule): the meeting is the one
 * `allMeetings()` puts on the card, its agreements are `agreementsOfMeeting()`
 * in the card's order, its class is `meetingClass()`. Every value is the
 * teacher's, verbatim; the kind is a code turned into its label; dates are
 * formatted by the app. Nothing is counted or summarised.
 *
 * Portrait, like the blank form and the letters. The agreements are the one
 * register on the page, so they are its table, and the fields and areas above
 * it are `lead` blocks — the contract's one M10 addition.
 */
import { formatDate } from "../domain/dates";
import { agreementsOfMeeting, meetingClass, type StaffMeeting } from "../domain/meetings";
import type { Planner } from "../domain/types";
import type { Translate } from "../i18n";
import { meetingKindLabel } from "../i18n/vocabularies";
import { renderPrintDocument, type PrintCell, type TableDocument } from "./document";
import { printFooter } from "./sheetParts";

export function minutesDocument(
  t: Translate,
  planner: Planner,
  meeting: StaffMeeting,
  today: string,
): TableDocument {
  const agreements = agreementsOfMeeting(planner, meeting.id);
  const schoolClass = meetingClass(planner, meeting);

  const head: PrintCell[] = [
    { text: t("meetings.who"), width: "26%" },
    { text: t("meetings.what"), width: "56%" },
    { text: t("meetings.deadline"), width: "18%", nowrap: true },
  ];
  const rows: PrintCell[][] = agreements.map((a) => [
    { text: a.who },
    { text: a.what },
    { text: a.deadline ? formatDate(a.deadline) : "", nowrap: true },
  ]);

  return {
    title: t("minutes.title"),
    subtitle: t("minutes.subtitle"),
    meta: [],
    lead: [
      {
        kind: "fields",
        tight: true,
        fields: [
          { label: t("minutes.kind"), value: t(meetingKindLabel(meeting.kind)), grow: 2 },
          { label: t("minutes.date"), value: meeting.date ? formatDate(meeting.date) : "" },
          { label: t("minutes.time"), value: meeting.clock_time },
          { label: t("minutes.duration"), value: meeting.duration },
          { label: t("minutes.class"), value: schoolClass?.name.trim() ?? "" },
        ],
      },
      { kind: "area", caption: t("minutes.present"), text: meeting.attendees, rows: 2 },
      { kind: "area", caption: t("minutes.agenda"), text: meeting.agenda, rows: 5 },
    ],
    table: { head, rows },
    blocks: [{ kind: "area", caption: t("minutes.notes"), text: meeting.notes, rows: 3 }],
    // Said in words rather than left as a bare header row, so an empty table
    // on the paper reads as "none were recorded", not as a failed print.
    note: agreements.length === 0 ? t("minutes.noAgreements") : undefined,
    footer: printFooter(t, today),
  };
}

export function minutesHtml(
  t: Translate,
  planner: Planner,
  meeting: StaffMeeting,
  today: string,
): string {
  return renderPrintDocument(minutesDocument(t, planner, meeting, today), false);
}
