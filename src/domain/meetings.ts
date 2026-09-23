/**
 * Staff, council and class meetings, and the upcoming-overview panel.
 *
 * The source pages are "Ομάδα · συνεδριάσεις και συσκέψεις" and "Συνεδρίαση του
 * συλλόγου · Μητρώο συλλόγων διδασκόντων και συνεδριάσεων", whose cards carry
 * `ΗΜΕΡΟΜΗΝΙΑ / ΕΙΔΟΣ / ΔΙΑΡΚΕΙΑ` over a `ΗΜΕΡΗΣΙΑ ΔΙΑΤΑΞΗ · ΣΥΜΦΩΝΙΕΣ ·
 * ΕΝΕΡΓΕΙΕΣ` area.
 *
 * **The agreements are rows, not a paragraph.** The spec asks for "agreements
 * (who/what/deadline)" — three named parts, one of them a date — so they are a
 * table of their own. A deadline that is a stored date is what lets the
 * upcoming panel show an action falling due, which a paragraph could not.
 *
 * **"Today" is an argument here, never a clock read.** [`upcomingOverview`] is
 * a pure function of the planner and the day, which is the only way the panel
 * can be tested on a chosen date and the reason the shell passes the day down
 * rather than a screen reaching for `new Date()`.
 */
import { addDays } from "./dates";
import { appointmentStudent, type ParentAppointment } from "./parents";
import type { Planner, SchoolClass, Student } from "./types";
import type { MeetingKind } from "../i18n/vocabularies";

/** One meeting — staff, class council, or a class's own. */
export interface StaffMeeting {
  id: number;
  position: number;
  kind: MeetingKind;
  date: string;
  clock_time: string;
  /** Free text: "90 λεπτά" and "2 ώρες" are both things a teacher writes. */
  duration: string;
  attendees: string;
  agenda: string;
  /** Optional. `null` when it belonged to no class in particular. */
  class_id: number | null;
  notes: string;
}

/** One agreement out of a meeting: who does what, by when. */
export interface MeetingAgreement {
  id: number;
  meeting_id: number;
  position: number;
  who: string;
  what: string;
  deadline: string;
}

export function emptyMeeting(): StaffMeeting {
  return {
    id: 0,
    position: 0,
    kind: "staff",
    date: "",
    clock_time: "",
    duration: "",
    attendees: "",
    agenda: "",
    class_id: null,
    notes: "",
  };
}

export function emptyAgreement(meetingId: number): MeetingAgreement {
  return { id: 0, meeting_id: meetingId, position: 0, who: "", what: "", deadline: "" };
}

/**
 * Every meeting, newest first, with undated ones at the front where a card the
 * teacher has just created belongs while she fills it in.
 */
export function allMeetings(planner: Planner): StaffMeeting[] {
  return [...planner.staff_meetings].sort((a, b) => {
    if (!a.date && !b.date) return b.id - a.id;
    if (!a.date) return -1;
    if (!b.date) return 1;
    return b.date.localeCompare(a.date) || b.clock_time.localeCompare(a.clock_time);
  });
}

/** The agreements of one meeting, in the order the teacher wrote them. */
export function agreementsOfMeeting(planner: Planner, meetingId: number): MeetingAgreement[] {
  return planner.meeting_agreements
    .filter((a) => a.meeting_id === meetingId)
    .sort((a, b) => a.position - b.position || a.id - b.id);
}

/** The class a meeting was about, if it named one and it still exists. */
export function meetingClass(planner: Planner, meeting: StaffMeeting): SchoolClass | null {
  if (meeting.class_id === null) return null;
  return planner.classes.find((c) => c.id === meeting.class_id) ?? null;
}

// ------------------------------------------------- the upcoming overview ---

/**
 * How far ahead the panel looks, and how far back it still counts a meeting as
 * worth showing.
 *
 * The spec asks for "upcoming appointments with upcoming/recent meetings in one
 * glance". Seven days forward is M5's own acceptance criterion; the backward
 * window is what makes "recent" mean anything, and is deliberately shorter —
 * a meeting three days ago whose agreements are still open is the one a teacher
 * wants in front of her, not last month's.
 */
export const UPCOMING_DAYS = 7;
export const RECENT_DAYS = 7;

export type UpcomingKind = "appointment" | "meeting";

/**
 * One line of the panel: an appointment or a meeting, reduced to what the panel
 * shows and carrying the id needed to open it.
 *
 * `past` is what the source page distinguishes by putting "upcoming" and
 * "recent" in one box: the same list, with the ones already held marked.
 */
export interface UpcomingItem {
  kind: UpcomingKind;
  id: number;
  date: string;
  clockTime: string;
  /** The guardian, or the meeting's kind label resolved by the caller. */
  who: string;
  /** The topic or the agenda — whatever the teacher typed, never translated. */
  what: string;
  /** True for a meeting that has already happened and is shown as recent. */
  past: boolean;
}

/**
 * What the upcoming-overview panel shows on a given day.
 *
 * **A pure function of the planner and the day**, which is the whole reason it
 * is here rather than in the screen: M5's third acceptance criterion is about a
 * chosen date on a test dataset, and a selector that read the clock could not
 * be checked against one.
 *
 * The two halves are gathered independently and only *concatenated* — nothing
 * about an appointment is derived from a meeting or the other way round, so
 * this function does not breach the independence the rest of `parents.ts`
 * holds. A merged list for the eye is not a merged record.
 *
 * Appointments look **forward only**: a booking that has been and gone belongs
 * in the log, not in a panel headed "what is coming". Meetings look forward and
 * back, because the spec asks for "upcoming *and recent*" ones and the panel's
 * job is to open their minutes.
 */
export function upcomingOverview(
  planner: Planner,
  today: string,
  days: number = UPCOMING_DAYS,
): UpcomingItem[] {
  const horizon = addDays(today, days);
  const earliest = addDays(today, -RECENT_DAYS);

  const appointments: UpcomingItem[] = planner.parent_appointments
    .filter((a) => a.date && a.date >= today && a.date <= horizon)
    // A cancelled slot is not something coming up.
    .filter((a) => a.status !== "cancelled")
    .map((a) => ({
      kind: "appointment" as const,
      id: a.id,
      date: a.date,
      clockTime: a.clock_time,
      who: a.guardian,
      what: a.topic,
      past: false,
    }));

  const meetings: UpcomingItem[] = planner.staff_meetings
    .filter((m) => m.date && m.date >= earliest && m.date <= horizon)
    .map((m) => ({
      kind: "meeting" as const,
      id: m.id,
      date: m.date,
      clockTime: m.clock_time,
      who: "",
      what: m.agenda,
      past: m.date < today,
    }));

  return [...appointments, ...meetings].sort(
    (a, b) => a.date.localeCompare(b.date) || a.clockTime.localeCompare(b.clockTime),
  );
}

/**
 * The guardian an upcoming appointment is with, and the student it is about —
 * resolved for display only, by the panel, at the moment it draws.
 */
export function appointmentSubject(
  planner: Planner,
  appointment: ParentAppointment,
): { guardian: string; student: Student | null } {
  return { guardian: appointment.guardian, student: appointmentStudent(planner, appointment) };
}
