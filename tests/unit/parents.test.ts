/**
 * The M5 selectors: the communication log, the appointment week, and the
 * upcoming-overview panel.
 *
 * Two of M5's three acceptance criteria are checked here — independence, and
 * the seven-day window on a test dataset. The third, that no placeholder
 * reaches a PDF, is in `printLetters.test.ts`.
 *
 * **Independence is checked as insensitivity, not as a count.** Asserting "the
 * log still has two rows" would pass against code that rebuilt those rows out
 * of the appointment table. Asserting that the log's *whole output* compares
 * equal after a pile of bookings is written catches that, and catches anything
 * else a later edit might wire between the two. It is the shape M4.5 proved,
 * and each of these was confirmed to fail against deliberately broken code
 * before it was trusted — see the release note.
 */
import { describe, expect, it } from "vitest";
import {
  allContacts,
  appointmentWeek,
  cellKey,
  filteredContacts,
  NO_CONTACT_FILTER,
  weekDays,
} from "../../src/domain/parents";
import { upcomingOverview, UPCOMING_DAYS } from "../../src/domain/meetings";
import type { ParentAppointment, ParentContact, Planner } from "../../src/domain/types";
import {
  A1,
  ANNA,
  CONTESTED_DAY,
  ELENI,
  KOSTAS,
  MEETING_FAR,
  MEETING_RECENT,
  MEETING_SOON,
  NIKOS,
  parentsFixture,
  TODAY,
  WEEK_MONDAY,
} from "../helpers/parentsFixture";

describe("the communication log", () => {
  it("reads newest first, with an undated line at the front", () => {
    const planner = parentsFixture();
    planner.parent_contacts.push({
      id: 199,
      student_id: ELENI,
      date: "",
      guardian: "",
      format: "meeting",
      reason: "",
      agreements: "",
      outcome: "",
      next_step: "",
      remarks: "",
    });
    // A line just created has no date yet and belongs where she is typing.
    expect(allContacts(planner).map((c) => c.id)).toEqual([199, 101, 102]);
  });

  it("filters by student without touching what is stored", () => {
    const planner = parentsFixture();
    const shown = filteredContacts(planner, { studentId: ELENI, classId: 0 });
    expect(shown.map((c) => c.id)).toEqual([101]);
    expect(planner.parent_contacts).toHaveLength(2);
  });

  /**
   * A class filter matches the class's *roster*, not anything stored on the
   * contact — a contact is about a student, and a student may sit in two
   * classes. Κώστας is in Β2 only and has no contacts at all, so filtering to
   * Β2 empties the register rather than falling back to everything.
   */
  it("filters by the class roster, so a cross-class student still appears", () => {
    const planner = parentsFixture();
    expect(filteredContacts(planner, { studentId: 0, classId: A1 }).map((c) => c.id)).toEqual([
      101, 102,
    ]);
    expect(filteredContacts(planner, { studentId: 0, classId: 2 })).toEqual([]);
    expect(filteredContacts(planner, { studentId: KOSTAS, classId: 0 })).toEqual([]);
  });
});

describe("the appointment week", () => {
  it("is Monday to Friday, derived from any day in that week", () => {
    expect(weekDays(WEEK_MONDAY)).toEqual([
      "2026-11-02",
      "2026-11-03",
      "2026-11-04",
      "2026-11-05",
      "2026-11-06",
    ]);
    // Any day in the week gives the same five — the grid is a view over a week,
    // not a stored shape.
    expect(weekDays("2026-11-05")).toEqual(weekDays(WEEK_MONDAY));
  });

  it("has a row per clock time the week actually uses, in order", () => {
    const week = appointmentWeek(parentsFixture(), WEEK_MONDAY);
    expect(week.times).toEqual(["09:15", "13:30"]);
    // 13:30 is used on two different days: one row, two columns.
    expect(week.cells.get(cellKey(CONTESTED_DAY, "13:30"))?.id).toBe(201);
    expect(week.cells.get(cellKey("2026-11-06", "13:30"))?.id).toBe(203);
    expect(week.cells.get(cellKey("2026-11-02", "13:30"))).toBeUndefined();
  });

  it("leaves out the bookings of neighbouring weeks", () => {
    const week = appointmentWeek(parentsFixture(), WEEK_MONDAY);
    expect(week.appointments.map((a) => a.id)).toEqual([202, 201, 203]);
    // 11.11, 12.11 and 17.11 are all in other weeks.
    expect(week.appointments.map((a) => a.id)).not.toContain(205);
  });

  /**
   * The school year's start date is one row in one table, and an appointment is
   * keyed by an actual date. So there is nothing here for a year change to
   * move — this asserts the shape that guarantees it.
   */
  it("keys a booking by an actual date, never by a weekday index", () => {
    const planner = parentsFixture();
    for (const a of planner.parent_appointments) {
      expect(a.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Object.keys(a)).not.toContain("weekday");
    }
  });
});

/**
 * **M5's second acceptance criterion.**
 *
 * A parent appointment and a parent-contact-log entry for the same guardian and
 * date coexist independently.
 */
describe("a booking and a record of what happened", () => {
  it("both exist for the same guardian on the same date", () => {
    const planner = parentsFixture();
    const contact = allContacts(planner).find((c) => c.date === CONTESTED_DAY)!;
    const booking = planner.parent_appointments.find((a) => a.date === CONTESTED_DAY)!;

    expect(contact.guardian).toBe(ANNA);
    expect(booking.guardian).toBe(ANNA);
    expect(contact.date).toBe(booking.date);
    // And they say different things, because one is a record and one is a plan.
    expect(contact.outcome).toBe("Συνεννοηθήκαμε ήρεμα");
    expect(booking.outcome).toBe("");
  });

  /**
   * The strongest form of the check, and the one that bites.
   *
   * An earlier version of this test pushed 30 more bookings for a guardian who
   * *already had one* and asserted the log was unchanged. A deliberate mutation
   * — the log tagging any contact whose guardian appears in the appointment
   * table — **passed it**, because that guardian's membership of the set never
   * changed. So the check is now made against the two extremes: the log must
   * read identically whether the appointment table is **empty** or **full**.
   * Nothing short of complete insensitivity passes that.
   */
  it("reads identically whether the appointment table is empty or full", () => {
    const withNone = parentsFixture();
    withNone.parent_appointments = [];
    const expected = filteredContacts(withNone, NO_CONTACT_FILTER);

    // As the fixture stands, with its six bookings.
    expect(filteredContacts(parentsFixture(), NO_CONTACT_FILTER)).toEqual(expected);

    // And with a pile more, for guardians both known and unknown to the log.
    const withMany = parentsFixture();
    for (let i = 0; i < 30; i += 1) {
      withMany.parent_appointments.push({
        id: 900 + i,
        date: CONTESTED_DAY,
        clock_time: `${String(8 + (i % 10)).padStart(2, "0")}:00`,
        student_id: i % 3 === 0 ? ELENI : null,
        guardian: i % 2 === 0 ? ANNA : `Άγνωστος ${i}`,
        mode: "in_person",
        place: "",
        status: i % 2 === 0 ? "cancelled" : "confirmed",
        topic: `Θέμα ${i}`,
        outcome: "",
      } satisfies ParentAppointment);
    }
    expect(filteredContacts(withMany, NO_CONTACT_FILTER)).toEqual(expected);

    // Every filter, not just the unfiltered one.
    for (const filter of [
      { studentId: ELENI, classId: 0 },
      { studentId: 0, classId: A1 },
    ]) {
      expect(filteredContacts(withMany, filter)).toEqual(filteredContacts(withNone, filter));
    }
  });

  /** The mirror image, checked the same way and for the same reason. */
  it("builds the same week whether the log is empty or full", () => {
    const withNone = parentsFixture();
    withNone.parent_contacts = [];
    const expected = appointmentWeek(withNone, WEEK_MONDAY);

    const withMany = parentsFixture();
    for (let i = 0; i < 30; i += 1) {
      withMany.parent_contacts.push({
        id: 800 + i,
        student_id: i % 2 === 0 ? ELENI : NIKOS,
        date: CONTESTED_DAY,
        guardian: i % 2 === 0 ? ANNA : `Άγνωστος ${i}`,
        format: "phone",
        reason: `Λόγος ${i}`,
        agreements: "",
        outcome: "",
        next_step: "",
        remarks: `Σημείωση ${i}`,
      } satisfies ParentContact);
    }

    const after = appointmentWeek(withMany, WEEK_MONDAY);
    expect(after.times).toEqual(expected.times);
    expect(after.appointments).toEqual(expected.appointments);
    expect([...after.cells.entries()]).toEqual([...expected.cells.entries()]);
    expect(after.days).toEqual(expected.days);
  });
});

/**
 * **M5's third acceptance criterion.**
 *
 * The upcoming-overview panel correctly surfaces both appointments and meetings
 * due in the next 7 days on a test dataset.
 *
 * The fixture puts the boundaries deliberately close: a meeting six days ahead
 * and one eleven days ahead, an appointment three days ahead and one eight days
 * ahead, and a cancelled booking inside the window.
 */
describe("the upcoming-overview panel", () => {
  const planner = parentsFixture();
  const shown = upcomingOverview(planner, TODAY);

  it("surfaces both appointments and meetings in one list", () => {
    expect(shown.map((i) => i.kind)).toContain("appointment");
    expect(shown.map((i) => i.kind)).toContain("meeting");
  });

  it("shows exactly what falls inside the window, in date order", () => {
    expect(shown.map((i) => [i.kind, i.id, i.date])).toEqual([
      // Three days back: recent, and a meeting, so it is shown.
      ["meeting", MEETING_RECENT, "2026-11-06"],
      // Three days ahead.
      ["appointment", 205, "2026-11-12"],
      // Six days ahead — just inside the seven-day horizon.
      ["meeting", MEETING_SOON, "2026-11-15"],
    ]);
  });

  it("marks a recent meeting as past and an upcoming one as not", () => {
    expect(shown.find((i) => i.id === MEETING_RECENT)?.past).toBe(true);
    expect(shown.find((i) => i.id === MEETING_SOON)?.past).toBe(false);
  });

  it("leaves out a meeting beyond the horizon", () => {
    expect(shown.map((i) => i.id)).not.toContain(MEETING_FAR);
  });

  it("leaves out a cancelled booking, which is not something coming up", () => {
    // 204 is inside the window by date and cancelled by status.
    expect(planner.parent_appointments.find((a) => a.id === 204)?.date).toBe("2026-11-11");
    expect(shown.map((i) => i.id)).not.toContain(204);
  });

  it("leaves out an appointment that has already been", () => {
    // Every booking in the 02.11 week is behind TODAY.
    expect(shown.filter((i) => i.kind === "appointment").map((i) => i.id)).toEqual([205]);
  });

  /**
   * The whole point of taking the day as an argument: the same planner gives a
   * different panel on a different day, and neither reads a clock.
   */
  it("is a pure function of the day it is given", () => {
    // A week later the window has slid: the meeting that was six days ahead is
    // now three days *back* and shows as recent, the booking that was beyond
    // the horizon is now inside it, and the far meeting has come into range.
    const later = upcomingOverview(planner, "2026-11-16");
    expect(later.map((i) => [i.id, i.past])).toEqual([
      [MEETING_SOON, true],
      [206, false],
      [MEETING_FAR, false],
    ]);
    // Everything that was in the earlier panel and is now behind both windows
    // has dropped out of it.
    expect(later.map((i) => i.id)).not.toContain(MEETING_RECENT);
    expect(later.map((i) => i.id)).not.toContain(205);
    // And the original is unchanged, because nothing was mutated.
    expect(upcomingOverview(planner, TODAY)).toEqual(shown);
  });

  it("takes the window as an argument, defaulting to the spec's seven days", () => {
    expect(UPCOMING_DAYS).toBe(7);
    const wide = upcomingOverview(planner, TODAY, 30);
    expect(wide.map((i) => i.id)).toContain(MEETING_FAR);
    expect(wide.map((i) => i.id)).toContain(206);
  });

  /**
   * The panel merges two lists for the eye. That is not the same as merging two
   * records, and this pins the difference: nothing it returns carries a field
   * derived from the other kind.
   */
  it("merges for display without deriving one kind from the other", () => {
    const planner = parentsFixture();
    const before = upcomingOverview(planner, TODAY).filter((i) => i.kind === "meeting");
    planner.parent_appointments = [];
    const after = upcomingOverview(planner, TODAY).filter((i) => i.kind === "meeting");
    expect(after).toEqual(before);

    const planner2 = parentsFixture();
    const beforeAppointments = upcomingOverview(planner2, TODAY).filter(
      (i) => i.kind === "appointment",
    );
    planner2.staff_meetings = [];
    planner2.meeting_agreements = [];
    expect(
      upcomingOverview(planner2, TODAY).filter((i) => i.kind === "appointment"),
    ).toEqual(beforeAppointments);
  });
});

describe("the fixture itself", () => {
  it("has a student with nothing, so a filter that matched everyone would show", () => {
    const planner: Planner = parentsFixture();
    expect(planner.parent_contacts.some((c) => c.student_id === KOSTAS)).toBe(false);
    expect(planner.parent_appointments.some((a) => a.student_id === KOSTAS)).toBe(false);
    expect(planner.parent_contacts.some((c) => c.student_id === NIKOS)).toBe(true);
  });
});
