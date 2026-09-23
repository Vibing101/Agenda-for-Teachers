/**
 * M4.5's four printed sheets, as documents.
 *
 * What a PDF *looks* like can only be judged by opening one — that is a gate
 * step and a human's job. What can be pinned here is everything that decides
 * what the PDF will contain, and in particular the three things M4.5 could most
 * easily have got wrong:
 *
 * * **Nothing is recomputed for print.** The printed absence register and the
 *   printed month card are checked to be *insensitive* to each other's data:
 *   adding rows to one register leaves the other's document byte-for-byte
 *   identical. That is stronger than checking a number, because it fails if any
 *   future edit makes one sheet read the other's table at all.
 * * **A plan's status prints as typed, and no goal reaches the paper.** Rating
 *   every goal `met`, and then deleting every goal, leaves the printed overview
 *   unchanged.
 * * **What prints is what the screen shows**, filter included — the incident
 *   sheet reads the same selector the screen renders from.
 *
 * Greek with diacritics is asserted directly in the rendered HTML, because that
 * is the spec's named failure point and it is checkable without a webview.
 * Whether the *PDF* renders it is not checkable here; that needs a real build.
 */
import { describe, expect, it } from "vitest";
import { translatorFor } from "../../src/i18n";
import { NO_INCIDENT_FILTER } from "../../src/domain/behaviour";
import {
  absenceRegisterDocument,
  absenceRegisterHtml,
  monthCardDocument,
  monthCardHtml,
} from "../../src/print/attendanceSheets";
import { incidentSheetDocument, incidentSheetHtml } from "../../src/print/behaviourSheet";
import { supportOverviewDocument, supportOverviewHtml } from "../../src/print/supportSheet";
import {
  A1,
  B2,
  CONTESTED_DAY,
  ELENI,
  IN_NOVEMBER,
  MARIA,
  supportPlanner,
} from "../helpers/supportFixture";

const t = translatorFor("el");
const TODAY = "2026-11-16";

/** Every cell's text on one row, for the assertions below. */
const textsOf = (row: { text: string }[]) => row.map((c) => c.text);

describe("the printed incident register", () => {
  it("carries the source page's own columns, in its order", () => {
    const doc = incidentSheetDocument(t, supportPlanner(), NO_INCIDENT_FILTER, TODAY);
    expect(doc.title).toBe(t("behaviour.heading"));
    expect(doc.table.head.map((c) => c.text)).toEqual([
      t("common.date"),
      t("behaviour.student"),
      t("behaviour.class"),
      t("behaviour.whatHappened"),
      t("behaviour.actionTaken"),
      t("behaviour.parentsInformed"),
    ]);
  });

  it("prints every entry when nothing is filtered, and says so in the header", () => {
    const doc = incidentSheetDocument(t, supportPlanner(), NO_INCIDENT_FILTER, TODAY);
    // The fixture holds three: two of Ελένη's and one of Μαρία's.
    expect(doc.table.rows).toHaveLength(3);
    expect(doc.meta).toEqual([
      { label: t("behaviour.printFilterStudent"), value: t("print.filterAll") },
      { label: t("behaviour.printFilterClass"), value: t("print.filterAll") },
      { label: t("behaviour.printCount"), value: "3" },
    ]);
  });

  it("prints the filter's rows, and names the filter on the paper", () => {
    const doc = incidentSheetDocument(t, supportPlanner(), { studentId: ELENI, classId: 0 }, TODAY);
    expect(doc.table.rows).toHaveLength(2);
    for (const row of doc.table.rows) {
      expect(textsOf(row)).toContain("Ελένη Παπαδοπούλου");
    }
    expect(doc.meta[0].value).toBe("Ελένη Παπαδοπούλου");
    expect(doc.meta[2].value).toBe("2");
    // Μαρία's entry is filtered out and must not appear anywhere on the sheet.
    const html = incidentSheetHtml(t, supportPlanner(), { studentId: ELENI, classId: 0 }, TODAY);
    expect(html).not.toContain("Βοήθησε συμμαθήτρια");
  });

  it("filters by class on the roster, so a cross-class entry still prints", () => {
    // Ελένη is in both classes; her second entry names no class at all. Looked
    // at from Β2 both are still hers, which is what "follows the student" means.
    const doc = incidentSheetDocument(t, supportPlanner(), { studentId: 0, classId: B2 }, TODAY);
    const whatHappened = doc.table.rows.map((r) => r[3].text);
    expect(whatHappened).toContain("Διαφωνία στο διάλειμμα");
    expect(whatHappened).toContain("Καθυστερημένη εργασία");
    expect(whatHappened).toContain("Βοήθησε συμμαθήτρια");
    expect(doc.meta[1].value).toBe("Β2");
  });

  it("prints a stored field as stored: the date formatted, the tick as a word", () => {
    const doc = incidentSheetDocument(t, supportPlanner(), { studentId: MARIA, classId: 0 }, TODAY);
    expect(textsOf(doc.table.rows[0])).toEqual([
      "02.11.2026",
      "Μαρία Ιωάννου",
      "Β2",
      "Βοήθησε συμμαθήτρια",
      "Έπαινος",
      // Μαρία's entry has `parents_informed: false`, so the column is blank —
      // never "Όχι", and never a glyph a Greek face might not carry.
      "",
    ]);
    const eleni = incidentSheetDocument(t, supportPlanner(), { studentId: ELENI, classId: A1 }, TODAY);
    expect(textsOf(eleni.table.rows[0])).toContain(t("print.yes"));
  });

  it("carries the source page's ΠΡΟΣΘΕΤΕΣ ΣΗΜΕΙΩΣΕΙΣ box, as blank ruled space", () => {
    // M4.5 adds no field, so the box is what it is on the source's own paper:
    // somewhere for the teacher to write. It must still be on the sheet.
    const doc = incidentSheetDocument(t, supportPlanner(), NO_INCIDENT_FILTER, TODAY);
    expect(doc.boxes).toEqual([
      { caption: t("behaviour.printExtraNotes"), lines: [], emptyText: t("print.boxEmpty") },
    ]);
    expect(incidentSheetHtml(t, supportPlanner(), NO_INCIDENT_FILTER, TODAY)).toContain(
      "ΠΡΟΣΘΕΤΕΣ ΣΗΜΕΙΩΣΕΙΣ",
    );
  });
});

describe("the printed absence register", () => {
  const doc = absenceRegisterDocument(t, supportPlanner(), A1, TODAY);

  it("carries the source register's own header and columns", () => {
    expect(doc.meta.map((m) => m.label)).toEqual([
      t("grades.printClass"),
      t("grades.printSubject"),
      t("grades.printPeriod"),
    ]);
    expect(doc.meta[0].value).toBe("Α1");
    expect(doc.meta[1].value).toBe("Μαθηματικά");
    expect(doc.table.head.map((c) => c.text)).toEqual([
      t("absences.printNo"),
      t("common.date"),
      t("absences.clockTime"),
      t("absences.student"),
      t("vocab.absenceKindShort.absence"),
      t("vocab.absenceKindShort.late"),
      t("absences.printJustified"),
      t("absences.reason"),
    ]);
  });

  it("ticks the one kind the event stores, and leaves the other column empty", () => {
    // Ελένη's 05.11 line is a `late`, so Καθ. is ticked and Απ. is not.
    const line = doc.table.rows.find((r) => r[3].text === "Ελένη Παπαδοπούλου" && r[1].text === "05.11.2026")!;
    expect(line[4].text).toBe("");
    expect(line[5].text).toBe(t("print.yes"));
    // And it was justified on its own terms, which is the event's own flag.
    expect(line[6].text).toBe(t("print.yes"));
    expect(line[2].text).toBe("08:35");
    expect(line[7].text).toBe("1η — Καθυστέρηση λεωφορείου");
  });

  it("puts each event's own notes in the source's two boxes, verbatim", () => {
    const frequent = doc.boxes!.find((b) => b.caption === t("absences.printFrequent"))!;
    expect(frequent.lines).toEqual(["Ελένη Παπαδοπούλου, 05.11.2026: Τρίτη φορά αυτόν τον μήνα"]);
    const followUp = doc.boxes!.find((b) => b.caption === t("absences.printFollowUp"))!;
    expect(followUp.lines).toEqual([
      `Ελένη Παπαδοπούλου, 05.11.2026: ${t("vocab.followUp.informed")}`,
      `Νίκος Γεωργίου, 09.11.2026: ${t("vocab.followUp.pending")}`,
    ]);
    // The box lists what is stored. It counts nothing, and the app never
    // decides for itself that an absence is "frequent".
    expect(frequent.lines.join()).not.toMatch(/\d+\s*(φορές|απουσίες)/);
  });

  it("is not scoped to a month, as the register is not", () => {
    // The fixture has an October event in Α1 alongside the November ones.
    expect(doc.table.rows.map((r) => r[1].text)).toContain("20.10.2026");
  });
});

describe("the printed month card", () => {
  const doc = monthCardDocument(t, supportPlanner(), A1, IN_NOVEMBER, TODAY);

  it("lays the roster against that month's own days and nothing borrowed", () => {
    // November 2026 has 30 days; plus the register number, the name and the
    // four totals columns.
    expect(doc.table.head).toHaveLength(2 + 30 + 4);
    expect(doc.table.head[2].text).toBe("1");
    expect(doc.table.head[31].text).toBe("30");
    expect(doc.meta[2]).toEqual({
      label: t("attendance.printMonth"),
      value: `${t("vocab.month.11")} 2026`,
    });
  });

  it("prints the stored symbol per cell and the month's totals per student", () => {
    const eleni = doc.table.rows.find((r) => r[1].text === "Ελένη Παπαδοπούλου")!;
    // 05.11 is a Thursday; the fixture marks her `present` there.
    expect(eleni[2 + 4].text).toBe(t("vocab.attendanceSymbol.present"));
    // Hand-counted from the fixture's November marks: 1 present, 2 absent,
    // 1 late, 1 excused. The October mark is not in this month and is not here.
    const totals = eleni.slice(-4).map((c) => c.text);
    expect(totals).toEqual(["1", "2", "1", "1"]);
  });

  it("is a dense landscape sheet with explicit column widths, so 31 days fit", () => {
    expect(doc.dense).toBe(true);
    expect(doc.table.head[2].width).toBeDefined();
    expect(monthCardHtml(t, supportPlanner(), A1, IN_NOVEMBER, TODAY)).toContain("width:");
  });
});

describe("the two attendance sheets stay independent of each other", () => {
  it("leaves the register's sheet untouched when marks are added or removed", () => {
    const before = absenceRegisterDocument(t, supportPlanner(), A1, TODAY);

    const planner = supportPlanner();
    // Mark every day of November for everyone — the loudest possible change to
    // the *other* register.
    for (const day of Array.from({ length: 30 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`)) {
      planner.attendance_marks.push({ class_id: A1, student_id: ELENI, date: day, state: "absent" });
    }
    planner.attendance_marks = planner.attendance_marks.filter((m) => m.date !== CONTESTED_DAY);

    expect(absenceRegisterDocument(t, planner, A1, TODAY)).toEqual(before);
  });

  it("leaves the month card's totals untouched when absence events are added", () => {
    const before = monthCardDocument(t, supportPlanner(), A1, IN_NOVEMBER, TODAY);

    const planner = supportPlanner();
    for (let i = 0; i < 10; i += 1) {
      planner.absence_events.push({
        id: 900 + i,
        class_id: A1,
        student_id: ELENI,
        date: "2026-11-05",
        kind: "absence",
        clock_time: "",
        teaching_hour: "",
        reason: "",
        justified: false,
        follow_up: "",
        frequent_note: "",
      });
    }

    expect(monthCardDocument(t, planner, A1, IN_NOVEMBER, TODAY)).toEqual(before);
  });

  it("prints the contested day both ways at once, each sheet its own record", () => {
    // M4's first acceptance criterion, on paper: Ελένη is `present` in the card
    // and carries a logged late arrival in the register, for the same day.
    const card = monthCardDocument(t, supportPlanner(), A1, IN_NOVEMBER, TODAY);
    const eleni = card.table.rows.find((r) => r[1].text === "Ελένη Παπαδοπούλου")!;
    expect(eleni[2 + 4].text).toBe(t("vocab.attendanceSymbol.present"));

    const register = absenceRegisterDocument(t, supportPlanner(), A1, TODAY);
    const line = register.table.rows.find((r) => r[1].text === "05.11.2026")!;
    expect(line[5].text).toBe(t("print.yes"));

    // And neither sheet mentions the other register at all.
    expect(monthCardHtml(t, supportPlanner(), A1, IN_NOVEMBER, TODAY)).not.toContain(
      "Καθυστέρηση λεωφορείου",
    );
  });
});

describe("the printed support overview", () => {
  const doc = supportOverviewDocument(t, supportPlanner(), TODAY);

  it("carries the source page's columns, plus the per-class flag the screen shows", () => {
    expect(doc.table.head.map((c) => c.text)).toEqual([
      t("overview.student"),
      t("overview.classes"),
      t("overview.senStatus"),
      t("overview.classSupport"),
      t("overview.accommodations"),
      t("overview.printAssessment"),
      t("overview.printPlan"),
    ]);
  });

  it("includes a student on any one signal, and excludes one with none", () => {
    const names = doc.table.rows.map((r) => r[0].text);
    expect(names).toEqual(["Ελένη Παπαδοπούλου", "Μαρία Ιωάννου", "Νίκος Γεωργίου"]);
    // Κώστας has no card category, no ticked class and no plan.
    expect(names).not.toContain("Κώστας Δημητρίου");
  });

  it("prints the teacher's status exactly as typed, one line per plan", () => {
    const eleni = doc.table.rows[0];
    expect(eleni[6].text).toBe("Σε εφαρμογή\nΟλοκληρώθηκε");
    expect(eleni[5].text).toBe("15.01.2027\n");
  });

  it("computes nothing from a plan's goals — rating them all changes nothing", () => {
    const planner = supportPlanner();
    for (const goal of planner.support_goals) goal.progress = "met";
    expect(supportOverviewDocument(t, planner, TODAY)).toEqual(doc);

    const emptied = supportPlanner();
    emptied.support_goals = [];
    expect(supportOverviewDocument(t, emptied, TODAY)).toEqual(doc);
  });

  it("puts no goal, and no count of goals, anywhere on the paper", () => {
    const html = supportOverviewHtml(t, supportPlanner(), TODAY);
    expect(html).not.toContain("Ανάγνωση κειμένου 80 λέξεων χωρίς βοήθεια");
    expect(html).not.toContain(t("vocab.goalProgress.met"));
    expect(html).not.toContain(t("support.goals"));
    expect(html).not.toMatch(/\d\s*\/\s*\d/);
  });

  it("shows the card's category and the ticked class separately, as M4 merges them", () => {
    const eleni = doc.table.rows[0];
    expect(eleni[1].text).toBe("Α1, Β2");
    expect(eleni[2].text).toBe(t("vocab.senStatus.accommodations"));
    // The tick is on Α1 only, although she is in both classes.
    expect(eleni[3].text).toBe("Α1 — Κάθεται μπροστά");
    expect(eleni[4].text).toBe("Επιπλέον χρόνος στις γραπτές εργασίες");
  });

  it("gathers each plan's own collaboration note into the source's box", () => {
    const box = doc.boxes!.find((b) => b.caption === t("overview.printCollaboration"))!;
    expect(box.lines).toEqual([
      "Ελένη Παπαδοπούλου: Συνεργασία με τη λογοθεραπεύτρια",
    ]);
  });
});

describe("every M4.5 sheet, as a document", () => {
  const sheets = () => [
    incidentSheetHtml(t, supportPlanner(), NO_INCIDENT_FILTER, TODAY),
    absenceRegisterHtml(t, supportPlanner(), A1, TODAY),
    monthCardHtml(t, supportPlanner(), A1, IN_NOVEMBER, TODAY),
    supportOverviewHtml(t, supportPlanner(), TODAY),
  ];

  it("keeps Greek with diacritics intact, accents and final sigma included", () => {
    for (const html of sheets()) {
      expect(html).toContain("Ελένη Παπαδοπούλου");
    }
    expect(sheets()[0]).toContain("Διαφωνία στο διάλειμμα");
    expect(sheets()[1]).toContain("Καθυστέρηση λεωφορείου");
    expect(sheets()[3]).toContain("Επιπλέον χρόνος στις γραπτές εργασίες");
    // Every accented form the fixture's own text contains, still there.
    for (const ch of "άέήίόύώς") {
      expect(sheets().join("")).toContain(ch);
    }
  });

  it("asks for no external resource of any kind", () => {
    for (const html of sheets()) {
      expect(html).not.toMatch(/https?:\/\//);
      expect(html).not.toContain("<link");
      expect(html).not.toContain("@import");
      expect(html).not.toContain("<script");
    }
  });

  it("forces a light page and dates its footer in the app's own format", () => {
    for (const html of sheets()) {
      expect(html).toContain("color-scheme: light");
      expect(html).toContain("16.11.2026");
    }
  });

  it("escapes what the teacher typed rather than letting it become markup", () => {
    const planner = supportPlanner();
    planner.incidents[0].what_happened = '<b>Α&Β</b>';
    const html = incidentSheetHtml(t, planner, NO_INCIDENT_FILTER, TODAY);
    expect(html).toContain("&lt;b&gt;Α&amp;Β&lt;/b&gt;");
    expect(html).not.toContain("<b>Α&Β</b>");
  });

  it("repeats the header on a second page and never splits a row", () => {
    for (const html of sheets()) {
      expect(html).toContain("table-header-group");
      expect(html).toContain("break-inside: avoid");
    }
  });
});
