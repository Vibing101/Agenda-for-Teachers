/**
 * M7's content, as opposed to its labels: the fixed text a form or the
 * substitute folder *says*, rather than what it captions.
 *
 * **Why a fourth file** (M7), by the rule M5 set when it split the letters and
 * the message bank out of `el.ts`: the bundle is divided by *kind* of string.
 * `el.ts` holds the app's labels — including every caption on every form,
 * which are labels. This file holds two kinds of content:
 *
 * 1. **The period checklist's sixteen items**, transcribed from the source's
 *    *Λίστα ελέγχου της περιόδου* page. They are sentences the form prints, and
 *    the teacher ticks them rather than typing them.
 * 2. **The substitute folder's suggested boilerplate** — the text a folder box
 *    shows until the teacher writes her own. **This wording is the app's, not
 *    the source's**: the source's boxes are blank. It is deliberately short and
 *    generic, it is written to be replaced, and it wants a Greek-speaking
 *    teacher's review before it reaches one. See `domain/substitute.ts` for how
 *    an untouched box is told from a cleared one.
 *
 * M9 adds `formsEn.ts` beside this and one line to `BUNDLES`.
 */
export const formsEl = {
  // Λίστα ελέγχου της περιόδου — ΑΡΧΗ ΤΗΣ ΠΕΡΙΟΔΟΥ.
  "form.periodChecklist.item.start.rosters": "Οι λίστες μαθητών ενημερώθηκαν",
  "form.periodChecklist.item.start.syllabus": "Ο προγραμματισμός ύλης είναι έτοιμος",
  "form.periodChecklist.item.start.criteria":
    "Οι απαιτήσεις και ο τρόπος βαθμολόγησης ανακοινώθηκαν στα τμήματα",
  "form.periodChecklist.item.start.timetable": "Ωρολόγιο πρόγραμμα και εφημερίες επιβεβαιώθηκαν",
  "form.periodChecklist.item.start.room": "Αίθουσα και υλικά ετοιμάστηκαν",
  "form.periodChecklist.item.start.seating": "Το πλάνο της αίθουσας έγινε",
  "form.periodChecklist.item.start.reports": "Γνωματεύσεις ΚΕΔΑΣΥ και ΕΠΕ ελέγχθηκαν",
  "form.periodChecklist.item.start.parents": "Πρώτη επικοινωνία με τους γονείς",
  // Λίστα ελέγχου της περιόδου — ΤΕΛΟΣ ΤΗΣ ΠΕΡΙΟΔΟΥ.
  "form.periodChecklist.item.end.grades": "Οι βαθμοί γράφτηκαν και ελέγχθηκαν",
  "form.periodChecklist.item.end.averages": "Οι σταθμισμένοι μέσοι όροι υπολογίστηκαν",
  "form.periodChecklist.item.end.conduct": "Ο βαθμός διαγωγής καθορίστηκε",
  "form.periodChecklist.item.end.deadline": "Η έκδοση βαθμών έκλεισε εμπρόθεσμα",
  "form.periodChecklist.item.end.risks": "Οι γονείς ενημερώθηκαν για τους κινδύνους",
  "form.periodChecklist.item.end.resits": "Οι επαναληπτικές και οι προθεσμίες ορίστηκαν",
  "form.periodChecklist.item.end.records": "Η τεκμηρίωση του υπευθύνου συμπληρώθηκε",
  "form.periodChecklist.item.end.backup": "Το αντίγραφο ασφαλείας των αρχείων έγινε",

  // The substitute folder's suggested text — the app's own wording, to be
  // replaced by the teacher's. One per box that has a default.
  "folder.default.rules":
    "Οι μαθητές μπαίνουν ήσυχα και κάθονται στις θέσεις του πλάνου αίθουσας.\nΣηκώνουν το χέρι για να μιλήσουν.\nΤα κινητά μένουν κλειστά στην τσάντα.",
  "folder.default.materials":
    "Βιβλία και τετράδια: στο ντουλάπι της αίθουσας.\nΜαρκαδόροι, χαρτιά και φωτοτυπίες: στο συρτάρι της έδρας.",
  "folder.default.problem":
    "Για οποιοδήποτε σοβαρό θέμα, ενημερώστε αμέσως τη Διεύθυνση.\nΣε περίπτωση ατυχήματος στείλτε έναν μαθητή στη Γραμματεία — μην αφήνετε την τάξη χωρίς επίβλεψη.",
  "folder.default.message":
    "Σας ευχαριστώ που αναλαμβάνετε την τάξη μου. Ό,τι χρειάζεστε βρίσκεται σε αυτόν τον φάκελο. Αφήστε μου ένα σύντομο σημείωμα για το τι έγινε και τι έμεινε.",
  "folder.default.proc.toilet": "Ένας μαθητής κάθε φορά, με άδεια.",
  "folder.default.proc.evacuation":
    "Ακολουθήστε το σχέδιο εκκένωσης δίπλα στην πόρτα. Πάρτε μαζί τον κατάλογο της τάξης.",
  "folder.default.proc.devices": "Κλειστά και στην τσάντα, εκτός αν τα ζητά η δραστηριότητα.",
  "folder.default.proc.breaks": "Το πρόγραμμα εφημεριών βρίσκεται στο γραφείο των εκπαιδευτικών.",
  "folder.default.proc.lateness": "Σημειώστε όποιον λείπει ή αργεί και ενημερώστε τη Γραμματεία.",
  "folder.default.proc.end":
    "Οι μαθητές βγαίνουν με το κουδούνι, αφού τακτοποιηθεί η αίθουσα.",
} as const;
