/**
 * The seven parent letters, in English.
 *
 * **UNREVIEWED MACHINE-TRANSLATED DRAFT.** The product owner's decision
 * (Resolved: "English translation authorship") is that the English letters and
 * message bank start as a machine-translated draft. This is that draft, written
 * at M9 by the implementing agent from `lettersEl.ts`. **No person who reads
 * both languages has reviewed it yet.** These letters go to parents, which is
 * the whole argument the spec's superseded Language paragraph makes for
 * reviewing them carefully before a teacher sends one. Until someone has, treat
 * every sentence here as a proposal.
 *
 * Same keys as `lettersEl.ts`, checked by the compiler and by
 * `tests/unit/i18nParity.test.ts`. The structure of each letter — its fields,
 * blocks and reply slips — is in `src/domain/letters.ts` and did not change.
 *
 * The `[BRACKETS]` inside a slip are this language's spelling of the same
 * placeholders the Greek uses, listed as `ph.<code>` in `messagesEn.ts`; a value
 * the teacher filled in under the Greek token fills the English one too.
 */
import type { lettersEl } from "./lettersEl";

export const lettersEn = {
  // The shared furniture of every letter.
  "letter.field.class": "CLASS",
  "letter.field.schoolYear": "SCHOOL YEAR",
  "letter.field.date": "DATE",
  "letter.field.time": "TIME",
  "letter.field.teacher": "TEACHER / CLASS TEACHER",
  "letter.field.subject": "SUBJECT",
  "letter.field.contact": "CONTACT",
  "letter.field.student": "STUDENT",
  "letter.field.place": "PLACE / ROOM",
  "letter.field.signature": "SIGNATURE",
  "letter.field.guardianSignature": "PARENT / GUARDIAN SIGNATURE",
  "letter.field.teacherSignature": "TEACHER'S SIGNATURE",
  "letter.field.phone": "CONTACT PHONE",
  "letter.greeting": "Dear parents,",
  "letter.slipCaption": "CUT OFF AND RETURN",
  /* The body area of a letter that is a form: the teacher writes the letter. */
  "letter.bodyCaption": "TEXT OF THE LETTER",

  // 1 — Welcome letter
  "letter.welcome.title": "Welcome letter",
  "letter.welcome.subtitle": "for the start of the school year",

  // 2 — Newsletter
  "letter.newsletter.title": "Newsletter",
  "letter.newsletter.subtitle": "for parents",
  "letter.newsletter.field.issue": "ISSUE / MONTH",
  "letter.newsletter.field.topic": "THEME OF THIS ISSUE",
  "letter.newsletter.happened": "WHAT HAPPENED",
  "letter.newsletter.dates": "COMING DATES",
  "letter.newsletter.reminders": "REMINDERS",
  "letter.newsletter.atHome": "HOW TO HELP AT HOME",

  // 3 — Invitation to a meeting / interviews
  "letter.invitation.title": "Invitation",
  "letter.invitation.subtitle": "to a meeting / interviews",
  "letter.invitation.agenda": "AGENDA",
  "letter.invitation.slip":
    "I confirm that I will attend the meeting on [DATE] — parent / guardian of the student [STUDENT].",

  // 4 — Notice of an expected grade below the pass mark
  "letter.atRisk.title": "Notice",
  "letter.atRisk.subtitle": "of an expected grade below the pass mark",
  "letter.atRisk.field.period": "PERIOD / YEAR",
  "letter.atRisk.field.handedOn": "DATE HANDED OVER",
  "letter.atRisk.field.gradesOn": "DATE GRADES ARE ISSUED",
  "letter.atRisk.body":
    "I am writing to let you know that, at the end of the period, your child is at risk of a grade below the pass mark in the subject above. The reasons and the conditions for improving are set out below.",
  "letter.atRisk.reasons": "REASONS",
  "letter.atRisk.terms": "CONDITIONS AND DEADLINES FOR IMPROVEMENT",
  "letter.atRisk.receipt": "ACKNOWLEDGEMENT OF RECEIPT",

  // 5 — Consent for a visit / trip
  "letter.consent.title": "Consent",
  "letter.consent.subtitle": "for a visit / trip",
  "letter.consent.field.destination": "VISIT / DESTINATION",
  "letter.consent.field.hours": "TIMES",
  "letter.consent.field.cost": "COST",
  "letter.consent.field.escorts": "ACCOMPANYING STAFF",
  "letter.consent.details": "DETAILS — TRANSPORT, MEALS, WHAT TO BRING",
  "letter.consent.slip":
    "I, [PARENT], give my consent for my child [STUDENT] to take part in the visit described above.",
  "letter.consent.health":
    "Important information about the child's health (allergies, medication, other):",

  // 6 — Commendation
  "letter.praise.title": "Commendation",
  "letter.praise.receives": "AWARDED TO",
  "letter.praise.for": "for",

  // 7 — Achievement award
  "letter.award.title": "Achievement award",
  "letter.award.receives": "AWARDED TO",
  "letter.award.for": "for",
} as const satisfies Record<keyof typeof lettersEl, string>;
