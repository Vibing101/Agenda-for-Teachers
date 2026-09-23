/**
 * The seven parent letters, in Greek — the source package's own words.
 *
 * `reference/03 - Έτοιμες επιστολές προς γονείς.pdf` is eight pages: a cover
 * and then one letter per page. **This is a transcription, not a rewrite.**
 * Every caption, title and sentence below is copied from that file, because
 * these are the words the teacher bought and recognises.
 *
 * **What the source letters actually are.** Six of the seven are *forms* rather
 * than prose: a title, a row of small captioned fields, and captioned areas the
 * teacher writes into. Only letter 4 carries a fixed paragraph of its own, and
 * letters 3 and 5 carry a fixed sentence inside their reply slip. So a letter's
 * fixed text is short and its filled text is the teacher's — which is why the
 * placeholders below are few, and why the rule that teacher-entered text is
 * never translated does most of the work here.
 *
 * **Why this is a file of its own rather than more of `el.ts`** — the same
 * reason as [`messagesEl`]: it is a product's content, not a screen's labels,
 * and it would have crowded out the file that holds the buttons. The lookup,
 * the `StringId` type and the no-Greek-outside-`src/i18n` rule are unchanged;
 * `i18n/index.ts` merges the three bundles into one.
 *
 * **What M9 does:** writes `lettersEn.ts` with these same keys. The structure —
 * which letters exist, which fields each has, where its reply slip goes — is in
 * `src/domain/letters.ts` and carries no Greek at all, so it is not touched.
 *
 * `[ΑΓΚΥΛΕΣ]` are the source's own placeholder syntax, shared with the message
 * bank. `src/domain/letters.ts` finds them; a test asserts none reaches a PDF.
 */
export const lettersEl = {
  // The shared furniture of every letter.
  "letter.field.class": "ΤΜΗΜΑ",
  "letter.field.schoolYear": "ΣΧΟΛΙΚΟ ΕΤΟΣ",
  "letter.field.date": "ΗΜΕΡΟΜΗΝΙΑ",
  "letter.field.time": "ΩΡΑ",
  "letter.field.teacher": "ΕΚΠΑΙΔΕΥΤΙΚΟΣ / ΥΠΕΥΘΥΝΟΣ ΤΜΗΜΑΤΟΣ",
  "letter.field.subject": "ΜΑΘΗΜΑ",
  "letter.field.contact": "ΕΠΙΚΟΙΝΩΝΙΑ",
  "letter.field.student": "ΜΑΘΗΤΗΣ",
  "letter.field.place": "ΤΟΠΟΣ / ΑΙΘΟΥΣΑ",
  "letter.field.signature": "ΥΠΟΓΡΑΦΗ",
  "letter.field.guardianSignature": "ΥΠΟΓΡΑΦΗ ΓΟΝΕΑ / ΚΗΔΕΜΟΝΑ",
  "letter.field.teacherSignature": "ΥΠΟΓΡΑΦΗ ΕΚΠΑΙΔΕΥΤΙΚΟΥ",
  "letter.field.phone": "ΤΗΛΕΦΩΝΟ ΕΠΙΚΟΙΝΩΝΙΑΣ",
  "letter.greeting": "Αγαπητοί γονείς,",
  "letter.slipCaption": "ΑΠΟΚΟΨΤΕ ΚΑΙ ΕΠΙΣΤΡΕΨΤΕ",
  /* The body area of a letter that is a form: the teacher writes the letter. */
  "letter.bodyCaption": "ΚΕΙΜΕΝΟ ΕΠΙΣΤΟΛΗΣ",

  // 1 — Επιστολή καλωσορίσματος
  "letter.welcome.title": "Επιστολή καλωσορίσματος",
  "letter.welcome.subtitle": "για την αρχή της σχολικής χρονιάς",

  // 2 — Ενημερωτικό δελτίο
  "letter.newsletter.title": "Ενημερωτικό δελτίο",
  "letter.newsletter.subtitle": "για γονείς",
  "letter.newsletter.field.issue": "ΑΡΙΘΜΟΣ / ΜΗΝΑΣ",
  "letter.newsletter.field.topic": "ΘΕΜΑ ΤΕΥΧΟΥΣ",
  "letter.newsletter.happened": "ΤΙ ΕΓΙΝΕ",
  "letter.newsletter.dates": "ΠΡΟΣΕΧΕΙΣ ΗΜΕΡΟΜΗΝΙΕΣ",
  "letter.newsletter.reminders": "ΥΠΕΝΘΥΜΙΣΕΙΣ",
  "letter.newsletter.atHome": "ΠΩΣ ΝΑ ΒΟΗΘΗΣΕΤΕ ΣΤΟ ΣΠΙΤΙ",

  // 3 — Πρόσκληση σε συνάντηση / συνεντεύξεις
  "letter.invitation.title": "Πρόσκληση",
  "letter.invitation.subtitle": "σε συνάντηση / συνεντεύξεις",
  "letter.invitation.agenda": "ΗΜΕΡΗΣΙΑ ΔΙΑΤΑΞΗ",
  "letter.invitation.slip":
    "Βεβαιώνω την παρουσία μου στη συνάντηση της [ΗΜΕΡΟΜΗΝΙΑ] — γονέας / κηδεμόνας του μαθητή [ΜΑΘΗΤΗΣ].",

  // 4 — Ενημέρωση για προβλεπόμενο βαθμό κάτω της βάσης
  "letter.atRisk.title": "Ενημέρωση",
  "letter.atRisk.subtitle": "για προβλεπόμενο βαθμό κάτω της βάσης",
  "letter.atRisk.field.period": "ΠΕΡΙΟΔΟΣ / ΕΤΟΣ",
  "letter.atRisk.field.handedOn": "ΗΜΕΡΟΜΗΝΙΑ ΠΑΡΑΔΟΣΗΣ",
  "letter.atRisk.field.gradesOn": "ΗΜΕΡΟΜΗΝΙΑ ΕΚΔΟΣΗΣ ΒΑΘΜΩΝ",
  "letter.atRisk.body":
    "σας ενημερώνω ότι στο τέλος της περιόδου το παιδί σας κινδυνεύει με βαθμό κάτω της βάσης στο παραπάνω μάθημα. Παρακάτω αναφέρω τους λόγους και τους όρους βελτίωσης.",
  "letter.atRisk.reasons": "ΛΟΓΟΙ",
  "letter.atRisk.terms": "ΟΡΟΙ ΚΑΙ ΠΡΟΘΕΣΜΙΕΣ ΒΕΛΤΙΩΣΗΣ",
  "letter.atRisk.receipt": "ΒΕΒΑΙΩΣΗ ΠΑΡΑΛΑΒΗΣ",

  // 5 — Συγκατάθεση για επίσκεψη / εκδρομή
  "letter.consent.title": "Συγκατάθεση",
  "letter.consent.subtitle": "για επίσκεψη / εκδρομή",
  "letter.consent.field.destination": "ΕΠΙΣΚΕΨΗ / ΠΡΟΟΡΙΣΜΟΣ",
  "letter.consent.field.hours": "ΩΡΕΣ",
  "letter.consent.field.cost": "ΚΟΣΤΟΣ",
  "letter.consent.field.escorts": "ΣΥΝΟΔΟΙ",
  "letter.consent.details": "ΛΕΠΤΟΜΕΡΕΙΕΣ — ΜΕΤΑΦΟΡΑ, ΓΕΥΜΑΤΑ, ΤΙ ΝΑ ΠΑΡΕΙ",
  "letter.consent.slip":
    "Εγώ, ο/η [ΓΟΝΕΑΣ], δίνω τη συγκατάθεσή μου για τη συμμετοχή του παιδιού μου [ΜΑΘΗΤΗΣ] στην παραπάνω επίσκεψη.",
  "letter.consent.health":
    "Σημαντικές πληροφορίες για την υγεία του παιδιού (αλλεργίες, φάρμακα, άλλα):",

  // 6 — Έπαινος
  "letter.praise.title": "Έπαινος",
  "letter.praise.receives": "ΠΑΡΑΛΑΜΒΑΝΕΙ",
  "letter.praise.for": "για",

  // 7 — Βραβείο επίδοσης
  "letter.award.title": "Βραβείο επίδοσης",
  "letter.award.receives": "ΠΑΡΑΛΑΜΒΑΝΕΙ",
  "letter.award.for": "για",
} as const;
