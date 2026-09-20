/**
 * Every user-facing string in the app, in Greek, keyed by a stable string id.
 *
 * This file is the *only* place Greek display text is allowed to live. No
 * component contains a Greek literal — eslint enforces that (see
 * `eslint.config.js`), so a screen cannot quietly grow an untranslatable label.
 *
 * Adding English at M9 therefore means adding one file next to this one and
 * one line to `i18n/index.ts`, not editing every screen. The keys here are the
 * contract that makes that true.
 *
 * Wording follows the source product (`reference/`) where the source has an
 * equivalent field, so the teacher recognises her own planner.
 */
export const el = {
  "app.title": "Ατζέντα Εκπαιδευτικού",
  "app.subtitle": "Σχεδίασε ήρεμα. Δίδαξε συνειδητά.",

  "nav.year": "Έτος",
  "nav.classes": "Τάξεις",
  "nav.students": "Μαθητές",
  "nav.storage": "Αρχείο",

  "common.add": "Προσθήκη",
  "common.cancel": "Ακύρωση",
  "common.date": "Ημερομηνία",
  "common.delete": "Διαγραφή",
  "common.done": "Τέλος",
  "common.edit": "Επεξεργασία",
  "common.email": "Email",
  "common.from": "Από",
  "common.loading": "Φόρτωση…",
  "common.name": "Ονοματεπώνυμο",
  "common.notes": "Παρατηρήσεις",
  "common.phone": "Τηλέφωνο",
  "common.save": "Αποθήκευση",
  "common.saved": "Αποθηκεύτηκε",
  "common.saving": "Αποθήκευση…",
  "common.to": "Έως",
  "common.unnamed": "Χωρίς όνομα",

  "blocked.title": "Το αρχείο δεδομένων άλλαξε στον δίσκο",
  "blocked.body":
    "Κάποιο άλλο αντίγραφο αυτού του φακέλου αποθηκεύτηκε αφότου η εφαρμογή διάβασε το αρχείο — πιθανότατα ο συγχρονισμός πρόλαβε μια άλλη συσκευή. Η αποθήκευση είναι φραγμένη για να μη χαθεί δουλειά.",
  "blocked.reload": "Επαναφόρτωση από τον δίσκο",
  "blocked.reloaded": "Φορτώθηκε ξανά η έκδοση που βρίσκεται τώρα στον δίσκο.",

  "storage.heading": "Πού αποθηκεύονται τα δεδομένα",
  "storage.appFolder": "Φάκελος εφαρμογής",
  "storage.dataFile": "Αρχείο δεδομένων",
  "storage.notCreated": "(δεν έχει δημιουργηθεί ακόμη)",
  "storage.schemaVersion": "Έκδοση σχήματος",
  "storage.backups": "Αντίγραφα ασφαλείας",
  "storage.latest": "τελευταίο {when}",
  "storage.backupNow": "Δημιουργία αντιγράφου τώρα",
  "storage.backupWritten": "Γράφτηκε αντίγραφο: {path}",
  "storage.nothingToBackUp": "Δεν υπάρχει ακόμη κάτι για αντίγραφο.",

  "year.heading": "Σχολικό έτος",
  "year.intro":
    "Γράψτε την ημερομηνία έναρξης. Οι εβδομάδες και οι μήνες συμπληρώνονται μόνοι τους.",
  "year.model": "Μοντέλο έτους",
  "year.startDate": "Πρώτη Δευτέρα της εβδομάδας 1",
  "year.startDateHelp":
    "Αν γράψετε άλλη μέρα της εβδομάδας, κρατιέται η Δευτέρα εκείνης της εβδομάδας.",
  "year.startDateSnapped": "Η εβδομάδα 1 ξεκινά τη Δευτέρα {date}.",
  "year.startDateMissing": "Δεν έχει οριστεί ακόμη ημερομηνία έναρξης.",
  "year.weeks": "Εβδομάδες",
  "year.weeksValue": "{count} εβδομάδες · {first} – {last}",
  "year.months": "Μήνες",
  "year.dataIsSafe":
    "Η αλλαγή της ημερομηνίας έναρξης δεν μετακινεί και δεν σβήνει καμία καταχώριση: κάθε εγγραφή κρατιέται με την πραγματική της ημερομηνία και ο αριθμός εβδομάδας υπολογίζεται ξανά.",
  "year.weekOf": "Εβδομάδα {n}",
  "year.outsideYear": "Εκτός της σχολικής χρονιάς",

  "year.periods": "Περίοδοι και έλεγχοι προόδου",
  "year.period.1": "Πρώτη περίοδος",
  "year.period.2": "Δεύτερη περίοδος",
  "year.period.3": "Τρίτη περίοδος",
  "year.periodName": "Ονομασία περιόδου",

  "year.holidays": "Διακοπές και αργίες",
  "year.holidaysIntro":
    "Οι ημερομηνίες ακολουθούν την απόφαση του Υπουργείου Παιδείας και το σχολείο σας.",
  "year.holidayName": "Ονομασία",
  "year.holidaySource": "Πηγή",
  "year.addHoliday": "Προσθήκη αργίας",
  "year.noHolidays": "Καμία καταχώριση ακόμη.",

  "year.importantDates": "Σημαντικές ημερομηνίες",
  "year.importantDatesIntro":
    "Οι ημερομηνίες, οι εκδηλώσεις και οι σημαντικές μέρες της σχολικής χρονιάς.",
  "year.importantDateName": "Ονομασία",
  "year.importantDateKind": "Τύπος",
  "year.addImportantDate": "Προσθήκη ημερομηνίας",
  "year.noImportantDates": "Καμία καταχώριση ακόμη.",

  "year.goals": "Στόχοι για τη χρονιά",
  "year.goalsIntro": "Οι επαγγελματικές και προσωπικές σας προτεραιότητες για φέτος.",
  "year.goal": "Στόχος",
  "year.goalActions": "Ενέργειες",
  "year.goalIndicators": "Δείκτες επιτυχίας",
  "year.goalDeadline": "Προθεσμία",
  "year.goalStatus": "Κατάσταση",
  "year.goalReview": "Ανασκόπηση στο τέλος της χρονιάς",

  "classes.heading": "Τα τμήματά μου",
  "classes.intro":
    "Ένα τμήμα ανά καρτέλα: μάθημα, αίθουσα, ωρολόγιο πρόγραμμα, λίστα και πλάνο αίθουσας.",
  "classes.new": "Νέο τμήμα",
  "classes.details": "Στοιχεία τμήματος",
  "classes.name": "Όνομα τμήματος",
  "classes.subject": "Μάθημα",
  "classes.room": "Αίθουσα",
  "classes.responsible": "Υπεύθυνος τμήματος",
  "classes.count": "Πλήθος",
  "classes.countValue": "{n} μαθητές",
  "classes.none": "Δεν έχει καταχωριστεί ακόμη τμήμα.",
  "classes.deleteWarning":
    "Θα διαγραφεί το τμήμα μαζί με το πρόγραμμα, τη λίστα και το πλάνο αίθουσάς του. Οι μαθητές παραμένουν στο ευρετήριο.",

  "classes.slots": "Ωρολόγιο πρόγραμμα",
  "classes.slotsIntro": "Δίπλα σε κάθε ώρα γράψτε τη μέρα και την αίθουσα.",
  "classes.slotDay": "Ημέρα",
  "classes.slotPeriod": "Ώρα",
  "classes.addSlot": "Προσθήκη ώρας",
  "classes.noSlots": "Καμία ώρα ακόμη.",
  "classes.removeSlot": "Αφαίρεση ώρας",

  "classes.roster": "Λίστα τμήματος",
  "classes.rosterNo": "Α/Α",
  "classes.rosterSupport": "Στήριξη",
  "classes.rosterNote": "Σύντομη σημείωση",
  "classes.rosterEmpty": "Κανένας μαθητής σε αυτό το τμήμα ακόμη.",
  "classes.addToRoster": "Προσθήκη μαθητή στο τμήμα",
  "classes.removeFromRoster": "Αφαίρεση από το τμήμα",
  "classes.allStudentsEnrolled": "Όλοι οι μαθητές του ευρετηρίου είναι ήδη σε αυτό το τμήμα.",
  "classes.alsoIn": "Επίσης: {classes}",

  "classes.seating": "Πλάνο αίθουσας",
  "classes.board": "Πίνακας",
  "classes.seatingRows": "Σειρές",
  "classes.seatingCols": "Στήλες",
  "classes.seatingNotes": "Διάταξη και σημειώσεις",
  "classes.seatEmpty": "Κενή θέση",
  "classes.seatAt": "Θέση σειρά {row}, στήλη {col}",

  "students.heading": "Ευρετήριο μαθητών",
  "students.intro": "Πατήστε ένα όνομα για να ανοίξει η καρτέλα του.",
  "students.new": "Νέος μαθητής",
  "students.none": "Δεν έχει καταχωριστεί ακόμη μαθητής.",
  "students.search": "Αναζήτηση",
  "students.searchPlaceholder": "Όνομα, τμήμα ή αριθμός μητρώου",
  "students.noMatches": "Κανένα αποτέλεσμα.",
  "students.sortBy": "Ταξινόμηση",
  "students.sort.name": "Ονοματεπώνυμο",
  "students.sort.register": "Αριθμός μητρώου",
  "students.sort.birthDate": "Ημερομηνία γέννησης",
  "students.countValue": "{n} μαθητές",

  "students.card": "Καρτέλα μαθητή",
  "students.details": "Στοιχεία μαθητή",
  "students.fullName": "Όνομα και επώνυμο",
  "students.registerNumber": "Αριθμός μητρώου",
  "students.birthDate": "Ημερομηνία γέννησης",
  "students.homeLanguage": "Γλώσσα στο σπίτι",
  "students.address": "Διεύθυνση",
  "students.midyear": "Εγγραφή μέσα στη χρονιά",

  "students.guardians": "Γονείς / κηδεμόνες",
  "students.guardian1": "Γονέας / κηδεμόνας 1",
  "students.guardian2": "Γονέας / κηδεμόνας 2",

  "students.health": "Υγεία και επείγοντα",
  "students.allergies": "Αλλεργίες",
  "students.conditions": "Παθήσεις και φροντίδα",
  "students.medication": "Φάρμακα",
  "students.emergencyPhone": "Τηλέφωνο ανάγκης",

  "students.sen": "Ειδικές εκπαιδευτικές ανάγκες",
  "students.senStatus": "Κατάσταση",
  "students.senPlan": "Πλάνο (ΕΠΕ, γνωμάτευση ΚΕΔΑΣΥ…)",
  "students.senAccommodations": "Προσαρμογές και στήριξη",

  "students.notes": "Σημειώσεις και παρατηρήσεις",
  "students.meetingNotes": "Σημειώσεις συναντήσεων",

  "students.classes": "Τάξη / τμήμα",
  "students.notInAnyClass": "Δεν ανήκει ακόμη σε τμήμα.",
  "students.addToClass": "Προσθήκη σε τμήμα",
  "students.deleteWarning":
    "Ο μαθητής θα διαγραφεί από το ευρετήριο, από όλα τα τμήματα και από κάθε πλάνο αίθουσας.",

  "birthdays.heading": "Γενέθλια",
  "birthdays.intro": "Σημειώστε τα γενέθλια για να μην ξεχάσετε κανένα.",
  "birthdays.none": "Καμία ημερομηνία γέννησης ακόμη.",
  "birthdays.emptyMonth": "—",

  "vocab.yearModel.sep_aug": "Σεπτέμβριος – Αύγουστος",
  "vocab.yearModel.jan_dec": "Ιανουάριος – Δεκέμβριος",
  "vocab.yearModel.feb_dec": "Φεβρουάριος – Δεκέμβριος",

  "vocab.holidaySource.ministry": "Υπουργείο Παιδείας",
  "vocab.holidaySource.school": "Σχολείο",

  "vocab.importantDateKind.deadline": "Προθεσμία",
  "vocab.importantDateKind.meeting": "Συνάντηση",
  "vocab.importantDateKind.exam_window": "Εβδομάδα εξετάσεων",
  "vocab.importantDateKind.event": "Εκδήλωση",
  "vocab.importantDateKind.other": "Άλλο",

  "vocab.senStatus.none": "Χωρίς πρόσθετη στήριξη",
  "vocab.senStatus.reinforcement": "Ενισχυτική διδασκαλία",
  "vocab.senStatus.accommodations": "Προσαρμογές",
  "vocab.senStatus.gifted": "Χαρισματικός μαθητής",

  "vocab.goalArea.teaching": "Διδασκαλία και περιεχόμενο",
  "vocab.goalArea.development": "Επαγγελματική ανάπτυξη",
  "vocab.goalArea.students": "Σχέσεις με τους μαθητές",
  "vocab.goalArea.colleagues": "Συνεργασία με τους συναδέλφους",
  "vocab.goalArea.parents": "Επικοινωνία με τους γονείς",
  "vocab.goalArea.wellbeing": "Προσωπική ευεξία",

  "vocab.weekday.1": "Δευτέρα",
  "vocab.weekday.2": "Τρίτη",
  "vocab.weekday.3": "Τετάρτη",
  "vocab.weekday.4": "Πέμπτη",
  "vocab.weekday.5": "Παρασκευή",
  "vocab.weekday.6": "Σάββατο",

  "vocab.month.1": "Ιανουάριος",
  "vocab.month.2": "Φεβρουάριος",
  "vocab.month.3": "Μάρτιος",
  "vocab.month.4": "Απρίλιος",
  "vocab.month.5": "Μάιος",
  "vocab.month.6": "Ιούνιος",
  "vocab.month.7": "Ιούλιος",
  "vocab.month.8": "Αύγουστος",
  "vocab.month.9": "Σεπτέμβριος",
  "vocab.month.10": "Οκτώβριος",
  "vocab.month.11": "Νοέμβριος",
  "vocab.month.12": "Δεκέμβριος",
} as const;
