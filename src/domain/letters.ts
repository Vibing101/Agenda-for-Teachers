/**
 * The seven parent letters: their structure, and what filling one means.
 *
 * **The words are not here**, for the same reason the message bank's are not —
 * they are in `src/i18n/lettersEl.ts`, and this module carries no Greek, so M9
 * adds a language file and changes nothing structural.
 *
 * **What a letter is on the source's own paper.** Six of the seven are forms
 * rather than prose: a title and subtitle, a row of small captioned fields
 * across the top, then captioned areas the teacher writes into, and — on two of
 * them — a `ΑΠΟΚΟΨΤΕ ΚΑΙ ΕΠΙΣΤΡΕΨΤΕ` reply slip ruled off at the foot. Only the
 * at-risk letter carries a fixed paragraph of its own. The last two are
 * certificates: a title, a name, a reason and two signature lines.
 *
 * So a letter is modelled as **a list of blocks**, not as a paragraph of text
 * with holes in it. Each block either carries fixed text from the bundle or
 * carries what the teacher typed, and `src/print/letterSheets.ts` turns the
 * list into a `PrintDocument`. Nothing here knows about HTML or about A4.
 *
 * **One check on the certificates, because the M5 brief got it wrong.** The
 * brief describes letters 6 and 7 as "2-up on the page". They are not: pages 7
 * and 8 of `reference/03 - Έτοιμες επιστολές προς γονείς.pdf` are each a single
 * full-page A4 portrait certificate inside a coloured border, rendered and
 * looked at to be sure. They are modelled as one page each.
 */
import { placeholdersInAll } from "./placeholders";
import type { StringId, Translate } from "../i18n";

export const LETTER_CODES = [
  "welcome",
  "newsletter",
  "invitation",
  "atRisk",
  "consent",
  "praise",
  "award",
] as const;

export type LetterCode = (typeof LETTER_CODES)[number];

/**
 * One small captioned field across the top of a letter — `ΤΜΗΜΑ`,
 * `ΣΧΟΛΙΚΟ ΕΤΟΣ`, `ΗΜΕΡΟΜΗΝΙΑ`.
 *
 * `key` is what the teacher's value is stored against while she is filling the
 * letter in; `captionId` is the printed caption. `kind` only tells the screen
 * which input to offer — the printed page is the same either way, since the app
 * formats every date it prints itself.
 */
export interface LetterField {
  key: string;
  captionId: StringId;
  kind?: "text" | "date" | "time";
}

/**
 * A block of a letter.
 *
 * - `prose` — a fixed sentence from the bundle. The only letter with a real one
 *   is the at-risk letter; the greeting line is the other use.
 * - `area` — a captioned area the teacher writes into, the source's own boxes.
 * - `slip` — the `ΑΠΟΚΟΨΤΕ ΚΑΙ ΕΠΙΣΤΡΕΨΤΕ` reply slip: a rule across the page,
 *   a caption, a fixed sentence with `[ΑΓΚΥΛΕΣ]` in it, and signature lines.
 * - `signatures` — a row of ruled lines with captions under them.
 * - `award` — the certificate's centred name-and-reason block.
 */
export type LetterBlock =
  | { kind: "prose"; textId: StringId }
  | { kind: "area"; captionId: StringId; key: string; rows?: number }
  | { kind: "slip"; captionId: StringId; textId: StringId; fields: LetterField[] }
  | { kind: "signatures"; fields: LetterField[] }
  | { kind: "award"; receivesId: StringId; forId: StringId };

export interface LetterTemplate {
  code: LetterCode;
  titleId: StringId;
  /** The italic line under the title. The certificates have none. */
  subtitleId?: StringId;
  /** The captioned fields across the head of the page. */
  fields: LetterField[];
  blocks: LetterBlock[];
  /**
   * A certificate is a single centred page and never paginates; the five
   * form-letters flow and may run to a second page.
   */
  certificate?: boolean;
}

/**
 * The seven letters, in the source PDF's own page order (pages 2–8).
 *
 * Every caption below is a string id, and every one of those ids is transcribed
 * from the source page it names in `lettersEl.ts`.
 */
export const LETTERS: LetterTemplate[] = [
  {
    code: "welcome",
    titleId: "letter.welcome.title",
    subtitleId: "letter.welcome.subtitle",
    fields: [
      { key: "class", captionId: "letter.field.class" },
      { key: "schoolYear", captionId: "letter.field.schoolYear" },
      { key: "date", captionId: "letter.field.date", kind: "date" },
    ],
    blocks: [
      { kind: "prose", textId: "letter.greeting" },
      { kind: "area", captionId: "letter.bodyCaption", key: "body", rows: 14 },
      {
        kind: "signatures",
        fields: [
          { key: "teacher", captionId: "letter.field.teacher" },
          { key: "subject", captionId: "letter.field.subject" },
          { key: "contact", captionId: "letter.field.contact" },
        ],
      },
    ],
  },
  {
    code: "newsletter",
    titleId: "letter.newsletter.title",
    subtitleId: "letter.newsletter.subtitle",
    fields: [
      { key: "class", captionId: "letter.field.class" },
      { key: "issue", captionId: "letter.newsletter.field.issue" },
      { key: "topic", captionId: "letter.newsletter.field.topic" },
    ],
    blocks: [
      { kind: "area", captionId: "letter.newsletter.happened", key: "happened", rows: 6 },
      { kind: "area", captionId: "letter.newsletter.dates", key: "dates", rows: 5 },
      { kind: "area", captionId: "letter.newsletter.reminders", key: "reminders", rows: 5 },
      { kind: "area", captionId: "letter.newsletter.atHome", key: "atHome", rows: 5 },
    ],
  },
  {
    code: "invitation",
    titleId: "letter.invitation.title",
    subtitleId: "letter.invitation.subtitle",
    fields: [
      { key: "class", captionId: "letter.field.class" },
      { key: "date", captionId: "letter.field.date", kind: "date" },
      { key: "time", captionId: "letter.field.time", kind: "time" },
      { key: "place", captionId: "letter.field.place" },
    ],
    blocks: [
      { kind: "prose", textId: "letter.greeting" },
      { kind: "area", captionId: "letter.bodyCaption", key: "body", rows: 5 },
      { kind: "area", captionId: "letter.invitation.agenda", key: "agenda", rows: 8 },
      {
        kind: "slip",
        captionId: "letter.slipCaption",
        textId: "letter.invitation.slip",
        fields: [
          { key: "slipDate", captionId: "letter.field.date", kind: "date" },
          { key: "slipSignature", captionId: "letter.field.guardianSignature" },
        ],
      },
    ],
  },
  {
    code: "atRisk",
    titleId: "letter.atRisk.title",
    subtitleId: "letter.atRisk.subtitle",
    fields: [
      { key: "student", captionId: "letter.field.student" },
      { key: "class", captionId: "letter.field.class" },
      { key: "subject", captionId: "letter.field.subject" },
      { key: "period", captionId: "letter.atRisk.field.period" },
      { key: "handedOn", captionId: "letter.atRisk.field.handedOn", kind: "date" },
      { key: "gradesOn", captionId: "letter.atRisk.field.gradesOn", kind: "date" },
    ],
    blocks: [
      { kind: "prose", textId: "letter.greeting" },
      // The one letter of the seven with a paragraph of its own.
      { kind: "prose", textId: "letter.atRisk.body" },
      { kind: "area", captionId: "letter.atRisk.reasons", key: "reasons", rows: 7 },
      { kind: "area", captionId: "letter.atRisk.terms", key: "terms", rows: 7 },
      {
        kind: "signatures",
        fields: [
          { key: "receiptDate", captionId: "letter.field.date", kind: "date" },
          { key: "guardianSignature", captionId: "letter.field.guardianSignature" },
          { key: "teacherSignature", captionId: "letter.field.teacherSignature" },
        ],
      },
    ],
  },
  {
    code: "consent",
    titleId: "letter.consent.title",
    subtitleId: "letter.consent.subtitle",
    fields: [
      { key: "destination", captionId: "letter.consent.field.destination" },
      { key: "date", captionId: "letter.field.date", kind: "date" },
      { key: "class", captionId: "letter.field.class" },
      { key: "hours", captionId: "letter.consent.field.hours" },
      { key: "cost", captionId: "letter.consent.field.cost" },
      { key: "escorts", captionId: "letter.consent.field.escorts" },
    ],
    blocks: [
      { kind: "area", captionId: "letter.consent.details", key: "details", rows: 8 },
      {
        kind: "slip",
        captionId: "letter.slipCaption",
        textId: "letter.consent.slip",
        fields: [
          { key: "slipDate", captionId: "letter.field.date", kind: "date" },
          { key: "slipPhone", captionId: "letter.field.phone" },
          { key: "slipSignature", captionId: "letter.field.guardianSignature" },
        ],
      },
      { kind: "area", captionId: "letter.consent.health", key: "health", rows: 4 },
    ],
  },
  {
    code: "praise",
    titleId: "letter.praise.title",
    certificate: true,
    fields: [],
    blocks: [
      { kind: "award", receivesId: "letter.praise.receives", forId: "letter.praise.for" },
      {
        kind: "signatures",
        fields: [
          { key: "date", captionId: "letter.field.date", kind: "date" },
          { key: "signature", captionId: "letter.field.signature" },
        ],
      },
    ],
  },
  {
    code: "award",
    titleId: "letter.award.title",
    certificate: true,
    fields: [],
    blocks: [
      { kind: "award", receivesId: "letter.award.receives", forId: "letter.award.for" },
      {
        kind: "signatures",
        fields: [
          { key: "date", captionId: "letter.field.date", kind: "date" },
          { key: "signature", captionId: "letter.field.signature" },
        ],
      },
    ],
  },
];

export function letterTemplate(code: LetterCode): LetterTemplate {
  const found = LETTERS.find((l) => l.code === code);
  if (!found) throw new Error(`unknown letter: ${code}`);
  return found;
}

/**
 * What the teacher has typed into one letter: a value per field key, plus a
 * value per `[ΑΓΚΥΛΗ]` the letter's fixed text asks for.
 *
 * Deliberately one flat map. A letter is filled and printed in one sitting, and
 * nothing here is stored — see the release note: **M5 does not persist a filled
 * letter.** Saving a filled form under a name, reopening and re-editing it is
 * M7's print-forms library, which has its own acceptance criterion for it.
 */
export type LetterValues = Record<string, string>;

/**
 * The award block's two written values, which every certificate has and no
 * other letter does.
 */
export const AWARD_NAME_KEY = "awardName";
export const AWARD_REASON_KEY = "awardReason";

/** Every key a letter's blocks and fields ask the teacher for. */
export function letterKeys(letter: LetterTemplate): string[] {
  const keys = letter.fields.map((f) => f.key);
  for (const block of letter.blocks) {
    if (block.kind === "area") keys.push(block.key);
    if (block.kind === "slip") keys.push(...block.fields.map((f) => f.key));
    if (block.kind === "signatures") keys.push(...block.fields.map((f) => f.key));
    if (block.kind === "award") keys.push(AWARD_NAME_KEY, AWARD_REASON_KEY);
  }
  return keys;
}

/**
 * The `[ΑΓΚΥΛΕΣ]` a letter's own fixed text asks for — in practice the two
 * reply slips, which name a date and a student inside a sentence.
 *
 * These are separate from [`letterKeys`] because they come from the *language
 * bundle*, not from the structure: a translated slip may word its sentence
 * differently and ask for its tokens in another order, and this reads them back
 * out of whatever the bundle actually says.
 */
export function letterPlaceholders(t: Translate, letter: LetterTemplate): string[] {
  return placeholdersInAll(
    letter.blocks.flatMap((b) => {
      if (b.kind === "prose") return [t(b.textId)];
      if (b.kind === "slip") return [t(b.textId)];
      return [];
    }),
  );
}
