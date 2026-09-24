/**
 * The substitute folder as **one** file: a cover and five pages.
 *
 * The spec's line is "exports as one combined multi-page PDF", and the M7
 * acceptance criterion adds "not 5 separate files". Every document this app
 * printed before M7 was one per file; this is the first bundle, and it needed
 * no new machinery on the Rust side — see `renderPrintBundle` in `document.ts`
 * and `paginate.ts`, which cuts each sheet onto pages of its own in order.
 *
 * **Every page is built from `substituteFolder()` at the moment of export.**
 * Nothing is read from a stored copy, because there is none: the seats, the
 * roster, the class's own details, the week and its plan all come from the
 * planner as it is when the button is pressed. The folder's own texts come
 * from `folderText()`, which gives the teacher's words where she has written
 * them and the suggested text where she has not.
 *
 * **Landscape, all six**, as the source's folder is.
 */
import { addDays, formatDate } from "../domain/dates";
import { formatHourTimes } from "../domain/timetable";
import {
  CONTACT_ROLES,
  PROCEDURES,
  contactField,
  dayKey,
  dayRows,
  folderText,
  procedureField,
  substituteFolder,
  type AttentionEntry,
  type SubstituteFolder,
} from "../domain/substitute";
import type { Planner } from "../domain/types";
import type { StringId, Translate } from "../i18n";
import { senStatusLabel, weekdayLabel } from "../i18n/vocabularies";
import { renderPrintBundle, type PrintDocument } from "./document";
import { printedValue } from "./letterSheets";
import { printFooter } from "./sheetParts";

/** The five content pages, in the source's order — also the cover's contents. */
const PAGE_TITLES: StringId[] = [
  "folder.info.title",
  "folder.week.title",
  "folder.seating.title",
  "folder.day.title",
  "folder.contacts.title",
];

/** One line per student who needs attention, each note copied verbatim. */
export function attentionLines(t: Translate, entries: AttentionEntry[]): string[] {
  return entries.map((entry) =>
    t("folder.attentionLine", {
      student: entry.name || t("common.unnamed"),
      notes: entry.notes
        .map((note) => {
          switch (note.kind) {
            case "sen":
              return t(senStatusLabel(note.code));
            case "support":
              return note.text
                ? t("folder.note.supportWith", { text: note.text })
                : t("folder.note.support");
            default:
              return t(`folder.note.${note.kind}`, { text: note.text });
          }
        })
        .join(" · "),
    }),
  );
}

/** "02.11.2026 – 06.11.2026": the days the week's table shows. */
export function weekRange(t: Translate, folder: SubstituteFolder): string {
  const last = folder.week.weekdays[folder.week.weekdays.length - 1];
  return t("folder.week.rangeValue", {
    from: formatDate(folder.week.monday),
    to: formatDate(addDays(folder.week.monday, last - 1)),
  });
}

/**
 * The folder's six documents, cover first.
 *
 * Returns an empty list for a class that does not exist, so a folder can never
 * be printed for a class that has just been deleted.
 */
export function folderDocuments(
  t: Translate,
  planner: Planner,
  classId: number,
  today: string,
): PrintDocument[] {
  const folder = substituteFolder(planner, classId, today);
  if (!folder) return [];
  const { schoolClass } = folder;
  const text = (field: string) => folderText(planner, classId, field, t).value;
  const school = (field: string) => folderText(planner, null, field, t).value;
  const footer = printFooter(t, today);
  const className = schoolClass.name.trim() || t("common.unnamed");
  const classMeta = [{ label: t("folder.info.class"), value: className }];

  const cover: PrintDocument = {
    title: t("folder.heading"),
    subtitle: t("folder.intro"),
    meta: [],
    cover: true,
    blocks: [
      {
        kind: "fields",
        tight: true,
        fields: [
          { label: t("folder.info.class"), value: className },
          { label: t("folder.info.subject"), value: schoolClass.subject },
          { label: t("folder.info.room"), value: schoolClass.room },
        ],
      },
      { kind: "prose", lines: [t("folder.cover.contents"), PAGE_TITLES.map((id) => t(id)).join("\n")] },
    ],
    footer,
  };

  // The attention box is the live list first, then anything she added.
  const extra = text("attention").trim();
  const attention = [...attentionLines(t, folder.attention), ...(extra ? ["", extra] : [])].join(
    "\n",
  );

  const info: PrintDocument = {
    title: t("folder.info.title"),
    subtitle: t("folder.info.subtitle"),
    meta: [],
    blocks: [
      {
        kind: "fields",
        tight: true,
        fields: [
          { label: t("folder.info.class"), value: className },
          { label: t("folder.info.subject"), value: schoolClass.subject },
          { label: t("folder.info.room"), value: schoolClass.room },
          { label: t("folder.info.count"), value: String(folder.rosterSize) },
          { label: t("folder.info.responsible"), value: schoolClass.responsible },
        ],
      },
      {
        kind: "areas",
        areas: [
          { caption: t("form.area.rules"), text: text("rules"), rows: 7 },
          { caption: t("form.area.attention"), text: attention, rows: 7 },
        ],
      },
      {
        kind: "areas",
        areas: [
          { caption: t("folder.materials"), text: text("materials"), rows: 7 },
          { caption: t("folder.problem"), text: text("problem"), rows: 7 },
        ],
      },
    ],
    footer,
  };

  const week: PrintDocument = {
    title: t("folder.week.title"),
    subtitle: t("folder.week.subtitle"),
    meta: [...classMeta, { label: t("folder.week.range"), value: weekRange(t, folder) }],
    table: {
      head: [
        { text: t("folder.week.hour"), width: "14%" },
        ...folder.week.weekdays.map((d) => ({ text: t(weekdayLabel(d)) })),
      ],
      rows: folder.week.rows.map(({ period, cells }) => [
        {
          text: [period.name.trim(), formatHourTimes(period)].filter(Boolean).join("\n"),
          strong: true,
        },
        ...cells.map((hour) => ({
          text: hour
            ? [[hour.subject, hour.room].filter(Boolean).join(" · "), hour.cell.notes.trim()]
                .filter(Boolean)
                .join("\n")
            : "",
        })),
      ]),
    },
    ruled: true,
    blocks: [
      {
        kind: "areas",
        areas: [
          { caption: t("folder.week.plan"), text: folder.week.plan.notes, rows: 4 },
          { caption: t("folder.week.assessment"), text: folder.week.plan.assessment, rows: 4 },
        ],
      },
    ],
    note: folder.week.rows.length === 0 ? t("folder.week.noPeriods") : undefined,
    footer,
  };

  const rows = folder.seating.names.length;
  const seating: PrintDocument = {
    title: t("folder.seating.title"),
    subtitle: t("folder.seating.subtitle"),
    meta: classMeta,
    blocks: [
      {
        kind: "desks",
        board: t("form.board"),
        names: folder.seating.names,
        // What a landscape page has left under its header and above the notes
        // box — about 70 of its 142 CSS millimetres — shared between the rows.
        height: Math.min(15, Math.floor((70 - (rows - 1) * 3) / Math.max(1, rows))),
      },
      {
        kind: "areas",
        areas: [{ caption: t("folder.seating.notes"), text: folder.seating.notes, rows: 2 }],
      },
    ],
    footer,
  };

  const day: PrintDocument = {
    title: t("folder.day.title"),
    subtitle: t("folder.day.subtitle"),
    meta: classMeta,
    head: [
      {
        kind: "fields",
        tight: true,
        fields: [
          { label: t("folder.day.date"), value: printedValue(text("day.date")) },
          { label: t("folder.day.goal"), value: text("day.goal"), grow: 3 },
        ],
      },
    ],
    table: {
      head: [
        { text: t("folder.day.time"), width: "12%" },
        { text: t("folder.day.activity"), width: "50%" },
        { text: t("folder.day.notes") },
      ],
      rows: Array.from({ length: dayRows(planner, classId) }, (_, i) =>
        (["time", "activity", "notes"] as const).map((column) => ({
          text: text(dayKey(i + 1, column)),
          nowrap: column === "time",
        })),
      ),
    },
    ruled: true,
    footer,
  };

  const contacts: PrintDocument = {
    title: t("folder.contacts.title"),
    subtitle: t("folder.contacts.subtitle"),
    meta: classMeta,
    blocks: [
      {
        kind: "pairs",
        columns: [
          {
            caption: t("folder.contacts.people"),
            rows: CONTACT_ROLES.map((role) => ({
              label: t(`folder.contact.${role}`),
              // The one contact that differs by class is the class's own
              // person in charge, and it is looked up rather than retyped.
              value: role === "responsible" ? schoolClass.responsible : school(contactField(role)),
            })),
          },
          {
            caption: t("folder.contacts.procedures"),
            rows: PROCEDURES.map((p) => ({
              label: t(`folder.proc.${p}`),
              value: school(procedureField(p)),
            })),
          },
        ],
      },
      {
        kind: "areas",
        areas: [{ caption: t("form.area.message"), text: text("message"), rows: 5 }],
      },
    ],
    footer,
  };

  return [cover, info, week, seating, day, contacts];
}

/** The whole folder, ready for the one export that writes it. */
export function folderHtml(t: Translate, planner: Planner, classId: number, today: string): string {
  return renderPrintBundle(folderDocuments(t, planner, classId, today), true);
}
