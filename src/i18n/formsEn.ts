/**
 * M7's content in English: the period checklist's sixteen items and the
 * substitute folder's suggested text.
 *
 * **UNREVIEWED MACHINE-TRANSLATED DRAFT.** Written at M9 by the implementing
 * agent from `formsEl.ts`; no person who reads both languages has reviewed it.
 * The checklist items are a translation of the source's own words. The folder's
 * suggestions were never the source's — M7 wrote them in Greek because the
 * source's boxes are blank — and the Open question asking a Greek-speaking
 * teacher to read them now applies to this English version too.
 *
 * **Not shown in the app until it is reviewed** (M10, the product owner's
 * call): with `ENGLISH_CONTENT_REVIEWED` false in `contentReview.ts`, the
 * English interface shows and prints the Greek content instead. This file is
 * still held against the Greek by `i18nParity.test.ts`, and is what a
 * reviewer corrects before that switch is turned on.
 *
 * **How the folder's suggestions follow the language.** A box the teacher has
 * never touched has no row in the file, and shows whichever of these, or of
 * their Greek, matches the interface at that moment. A box she has written in
 * or cleared keeps exactly what she left, in whatever language she wrote it.
 * Nothing is ever copied from here into the file. That is M7's design, and
 * `tests/component/Bilingual.test.tsx` holds it across a switch.
 *
 * Same keys as `formsEl.ts`, checked by the compiler and by
 * `tests/unit/i18nParity.test.ts`.
 */
import type { formsEl } from "./formsEl";

export const formsEn = {
  // Checklist for the period — START OF THE PERIOD.
  "form.periodChecklist.item.start.rosters": "Class lists have been updated",
  "form.periodChecklist.item.start.syllabus": "The scheme of work is ready",
  "form.periodChecklist.item.start.criteria":
    "Requirements and marking have been explained to the classes",
  "form.periodChecklist.item.start.timetable": "Timetable and duties have been confirmed",
  "form.periodChecklist.item.start.room": "The room and materials are ready",
  "form.periodChecklist.item.start.seating": "The seating plan is done",
  "form.periodChecklist.item.start.reports": "KEDASY assessments and IEPs have been checked",
  "form.periodChecklist.item.start.parents": "First contact with parents",
  // Checklist for the period — END OF THE PERIOD.
  "form.periodChecklist.item.end.grades": "Grades have been entered and checked",
  "form.periodChecklist.item.end.averages": "Weighted averages have been worked out",
  "form.periodChecklist.item.end.conduct": "The conduct grade has been decided",
  "form.periodChecklist.item.end.deadline": "Grades were issued on time",
  "form.periodChecklist.item.end.risks": "Parents have been told about any risks",
  "form.periodChecklist.item.end.resits": "Resits and deadlines have been set",
  "form.periodChecklist.item.end.records": "The class teacher's records are complete",
  "form.periodChecklist.item.end.backup": "The files have been backed up",

  // The substitute folder's suggested text — to be replaced by the teacher's.
  "folder.default.rules":
    "Students come in quietly and sit in their places on the seating plan.\nThey put a hand up to speak.\nPhones stay switched off in bags.",
  "folder.default.materials":
    "Books and exercise books: in the classroom cupboard.\nMarkers, paper and photocopies: in the teacher's desk drawer.",
  "folder.default.problem":
    "For anything serious, tell the head teacher's office straight away.\nIf there is an accident, send a student to the school office — never leave the class unsupervised.",
  "folder.default.message":
    "Thank you for taking my class. Everything you need is in this folder. Please leave me a short note on what was done and what is left.",
  "folder.default.proc.toilet": "One student at a time, with permission.",
  "folder.default.proc.evacuation":
    "Follow the evacuation plan by the door. Take the class list with you.",
  "folder.default.proc.devices": "Switched off and in bags, unless the activity needs them.",
  "folder.default.proc.breaks": "The duty rota is in the staff room.",
  "folder.default.proc.lateness":
    "Note anyone who is absent or late and let the school office know.",
  "folder.default.proc.end": "Students leave at the bell, once the room has been tidied.",
} as const satisfies Record<keyof typeof formsEl, string>;
