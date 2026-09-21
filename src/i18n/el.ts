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
  "nav.grades": "Βαθμοί",
  "nav.timetable": "Πρόγραμμα",
  "nav.agenda": "Ατζέντα",
  "nav.plan": "Πλάνο",
  "nav.today": "Σημερινό",
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
  "common.today": "Σήμερα",
  "common.unnamed": "Χωρίς όνομα",
  "common.previous": "Προηγούμενο",
  "common.next": "Επόμενο",
  "common.none": "—",

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

  "classes.slots": "Ώρες του τμήματος",
  "classes.slotsIntro":
    "Οι ώρες του τμήματος προκύπτουν από το ωρολόγιο πρόγραμμα. Για να τις αλλάξετε, πηγαίνετε στην ενότητα «Πρόγραμμα» — έτσι το ίδιο μάθημα δεν γράφεται δύο φορές.",
  "classes.slotDay": "Ημέρα",
  "classes.slotPeriod": "Ώρα",
  "classes.noSlots": "Το τμήμα δεν έχει ακόμη ώρα στο ωρολόγιο πρόγραμμα.",

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

  "grades.heading": "Μητρώο βαθμών",
  "grades.intro":
    "Ένα φύλλο ανά τμήμα: οι στήλες βαθμολόγησης με τη βαρύτητά τους, οι βαθμοί των μαθητών, ο μέσος όρος και η πρόταση βαθμού.",
  "grades.noClasses": "Δεν υπάρχουν ακόμη τμήματα. Δημιουργήστε πρώτα ένα τμήμα στην ενότητα «Τάξεις».",
  "grades.emptyRoster": "Δεν υπάρχουν μαθητές σε αυτό το τμήμα. Προσθέστε μαθητές από τον κατάλογο του τμήματος.",

  "grades.sheetSettings": "Στοιχεία φύλλου",
  "grades.period": "Περίοδος",
  "grades.scaleMax": "Ανώτατος βαθμός κλίμακας",
  "grades.passMark": "Βάση",
  "grades.passMarkHint": "Ο χαμηλότερος βαθμός που θεωρείται επιτυχία. Προεπιλογή 10 στην κλίμακα 0–20.",

  "grades.columns": "Στήλες βαθμολόγησης",
  "grades.columnsIntro":
    "Προσθέστε όσες στήλες χρειάζεστε. Μόνο οι αριθμητικές στήλες μετρούν στον μέσο όρο — οι περιγραφικές, οι στήλες επιτυχίας/αποτυχίας και τα σχόλια καταγράφονται και εκτυπώνονται, αλλά δεν συμμετέχουν στον υπολογισμό.",
  "grades.columnLabel": "Ονομασία",
  "grades.columnKind": "Τύπος",
  "grades.weight": "Βαρύτητα (%)",
  "grades.weightBlank": "Κενή βαρύτητα σημαίνει «δεν έχει οριστεί ακόμη» και η στήλη δεν μετρά μέχρι να συμπληρωθεί.",
  "grades.addColumn": "Νέα στήλη",
  "grades.removeColumn": "Διαγραφή στήλης",
  "grades.removeColumnWarning": "Η διαγραφή μιας στήλης σβήνει και τους βαθμούς που έχουν γραφτεί σε αυτήν.",
  "grades.noColumns": "Δεν έχει προστεθεί ακόμη καμία στήλη βαθμολόγησης.",
  "grades.newColumnLabel": "Βαθμός {n}",

  "grades.weightTotal": "Σύνολο βαρυτήτων: {total}%",
  "grades.weightUnder":
    "Οι βαρύτητες αθροίζουν {total}% αντί για 100%. Ο μέσος όρος υπολογίζεται πάνω στο {total}% που έχει οριστεί.",
  "grades.weightOver": "Οι βαρύτητες αθροίζουν {total}%, δηλαδή πάνω από 100%.",
  "grades.weightNeverBlocks": "Αυτή είναι μόνο υπενθύμιση — δεν εμποδίζει ποτέ την αποθήκευση.",
  "grades.weightInvalid": "Η βαρύτητα πρέπει να είναι αριθμός από 0 έως 100.",

  "grades.sheet": "Βαθμοί τάξης",
  "grades.rosterNo": "Αρ.",
  "grades.average": "Μέσος όρος",
  "grades.suggestion": "Πρόταση",
  "grades.noValue": "—",
  "grades.gradeInvalid": "Ο βαθμός πρέπει να είναι αριθμός από 0 έως {max}.",

  "grades.conductHeading": "Συμπεριφορά και στάση",
  "grades.conductIntro":
    "Η διαγωγή δεν συμμετέχει στον μέσο όρο. Ο συνολικός βαθμός γράφεται από τον εκπαιδευτικό και δεν υπολογίζεται από την εφαρμογή.",
  "grades.conduct": "Διαγωγή",
  "grades.overallResult": "Συνολικός βαθμός",
  "grades.observations": "Παρατηρήσεις",

  "grades.classSummary": "Σύνοψη τμήματος",
  "grades.summaryAverage": "Μέσος όρος τμήματος",
  "grades.summaryHighest": "Υψηλότερος μέσος όρος",
  "grades.summaryLowest": "Χαμηλότερος μέσος όρος",
  "grades.summaryAbove": "Βαθμοί πάνω από τη βάση (≥ βάση)",
  "grades.summaryBelow": "Κινδυνεύουν με βαθμό κάτω της βάσης",
  "grades.summaryRoster": "Αριθμός μαθητών",
  "grades.summaryIntervention": "Διαγωγή που χρειάζεται παρέμβαση",

  "grades.yearSummary": "Σύνοψη — όλα τα τμήματα",
  "grades.yearSummaryIntro":
    "Ενημερώνεται μόνη της από τα φύλλα των τμημάτων· τίποτα εδώ δεν συμπληρώνεται χωριστά.",
  "grades.summaryClass": "Τμήμα",
  "grades.summarySubject": "Μάθημα",
  "grades.summaryStudents": "Μαθητές",
  "grades.overallAverage": "Γενικός μέσος όρος",

  "grades.exportSheet": "Εξαγωγή PDF βαθμών",
  "grades.exportConduct": "Εξαγωγή PDF συμπεριφοράς",
  "grades.exporting": "Δημιουργία PDF…",
  "grades.exported": "Το PDF γράφτηκε: {path}",
  "grades.sheetFileName": "Βαθμοί — {class} — {date}",
  "grades.conductFileName": "Συμπεριφορά και στάση — {class} — {date}",

  "grades.printClass": "ΤΑΞΗ",
  "grades.printSubject": "ΜΑΘΗΜΑ",
  "grades.printPeriod": "ΠΕΡΙΟΔΟΣ",
  "grades.printTeacher": "ΕΚΠΑΙΔΕΥΤΙΚΟΣ",
  "grades.printScale": "ΚΛΙΜΑΚΑ",
  "grades.printBase": "ΒΑΣΗ",
  "grades.printWeightRow": "ΒΑΡΥΤΗΤΑ",
  "grades.printAverage": "Μ.Ο.",
  "grades.printConductTitle": "Συμπεριφορά και στάση του μαθητή, με πρόταση βαθμού",
  "grades.printNote":
    "Η στήλη Μ.Ο. λαμβάνει υπόψη τις βαρύτητες· οι στήλες που δεν είναι αριθμητικές δεν μετρούν, ούτε η βαρύτητά τους.",
  "grades.printedOn": "Εκτυπώθηκε {date}",

  "timetable.heading": "Ωρολόγιο πρόγραμμα",
  "timetable.intro":
    "Δίπλα σε κάθε ώρα γράψτε το μάθημα και το τμήμα. Αυτό είναι το πρόγραμμα της εβδομάδας σας: από εδώ προκύπτουν οι ώρες κάθε τμήματος και το σημερινό σας μάθημα.",
  "timetable.hours": "Οι ώρες μου",
  "timetable.hoursIntro":
    "Ονομάστε τις ώρες της μέρας σας μία φορά, με τις ώρες του ρολογιού. Κάθε μέρα της εβδομάδας χρησιμοποιεί τις ίδιες ώρες.",
  "timetable.hour": "Ώρα",
  "timetable.hourName": "Ονομασία ώρας",
  "timetable.hourNamePlaceholder": "1η, 2η, διάλειμμα…",
  "timetable.addHour": "Προσθήκη ώρας",
  "timetable.removeHour": "Διαγραφή ώρας",
  "timetable.removeHourWarning":
    "Η διαγραφή μιας ώρας σβήνει και ό,τι έχει γραφτεί στα κελιά της σε όλες τις μέρες.",
  "timetable.noHours": "Δεν έχει οριστεί ακόμη ώρα. Προσθέστε την πρώτη σας ώρα για να ξεκινήσει το πρόγραμμα.",
  "timetable.grid": "Η εβδομάδα μου",
  "timetable.cell": "{day}, {hour}",
  "timetable.cellClass": "Τμήμα",
  "timetable.cellNoClass": "Χωρίς τμήμα",
  "timetable.cellSubject": "Μάθημα",
  "timetable.cellSubjectHint":
    "Μόνο όταν η ώρα δεν αντιστοιχεί σε τμήμα. Διαφορετικά συμπληρώνεται από το τμήμα.",
  "timetable.cellRoom": "Αίθουσα",
  "timetable.cellRoomHint": "Κενό σημαίνει την αίθουσα του τμήματος.",
  "timetable.cellDuty": "Αναπληρώσεις και άλλα καθήκοντα",
  "timetable.cellNotes": "Παρατηρήσεις",
  "timetable.cellFree": "Ελεύθερη ώρα",
  "timetable.cellEdit": "Επεξεργασία κελιού",
  "timetable.cellClose": "Κλείσιμο κελιού",
  "timetable.cellClear": "Καθαρισμός κελιού",
  "timetable.fromClass": "Από το τμήμα",
  "timetable.printLater":
    "Η εκτύπωση του προγράμματος σε PDF δεν έχει υλοποιηθεί ακόμη σε αυτό το στάδιο.",

  "agenda.heading": "Ατζέντα",
  "agenda.intro":
    "Σημειώσεις για τη μέρα, την εβδομάδα και τον μήνα. Κάθε σημείωση κρατιέται με την πραγματική της ημερομηνία.",
  "agenda.scope": "Προβολή",
  "agenda.jumpToToday": "Σήμερα",
  "agenda.dayNote": "Σημειώσεις της ημέρας",
  "agenda.dayNoteFor": "Σημειώσεις — {date}",
  "agenda.weekNote": "Σημειώσεις της εβδομάδας",
  "agenda.monthNote": "Εστίαση του μήνα",
  "agenda.weekTitle": "Εβδομάδα αρ. {n}",
  "agenda.weekTitleOutside": "Εβδομάδα εκτός της σχολικής χρονιάς",
  "agenda.weekSpan": "{from} – {to}",
  "agenda.monthTitle": "{month} επισκόπηση",
  "agenda.monthCounter": "{n} / 12",
  "agenda.dayTitle": "{weekday} {date}",
  "agenda.hasNote": "Έχει σημείωση",
  "agenda.selectDay": "Επιλογή ημέρας {date}",
  "agenda.noStartDate":
    "Ορίστε πρώτα την ημερομηνία έναρξης στην ενότητα «Έτος» για να φαίνεται ο αριθμός της εβδομάδας.",
  "agenda.todaysHours": "Το πρόγραμμα της ημέρας",
  "agenda.weekDays": "Οι μέρες της εβδομάδας",
  "agenda.monthDays": "Το ημερολόγιο του μήνα",

  "plan.heading": "Εβδομαδιαίο πλάνο",
  "plan.intro":
    "Ένα πλάνο για κάθε τμήμα και κάθε εβδομάδα. Κρατιέται με τη Δευτέρα της εβδομάδας ως πραγματική ημερομηνία, οπότε αν αλλάξετε την έναρξη της χρονιάς αλλάζει μόνο ο αριθμός της εβδομάδας — τίποτα από όσα γράψατε δεν μετακινείται.",
  "plan.noClasses": "Δεν υπάρχουν ακόμη τμήματα. Δημιουργήστε πρώτα ένα τμήμα στην ενότητα «Τάξεις».",
  "plan.week": "Εβδομάδα",
  "plan.notes": "Πλάνο της εβδομάδας",
  "plan.assessment": "Αξιολόγηση της εβδομάδας",
  "plan.assessmentHint": "Μία αξιολόγηση ανά εβδομάδα — διαγώνισμα, εργασία, παρουσίαση.",
  "plan.hoursThisWeek": "Οι ώρες του τμήματος αυτή την εβδομάδα",
  "plan.noHours": "Το τμήμα δεν έχει ώρα στο ωρολόγιο πρόγραμμα.",
  "plan.empty": "Δεν έχει γραφτεί ακόμη πλάνο για αυτή την εβδομάδα.",
  "plan.written": "Γραμμένο πλάνο",

  "today.heading": "Σημερινό μάθημα",
  "today.intro":
    "Ό,τι χρειάζεστε για σήμερα, μαζεμένο. Τίποτα εδώ δεν συμπληρώνεται — όλα γράφονται στις άλλες ενότητες.",
  "today.date": "{weekday} {date}",
  "today.week": "Εβδομάδα αρ. {n}",
  "today.weekOutside": "Εκτός της σχολικής χρονιάς",
  "today.schedule": "Το πρόγραμμα της ημέρας",
  "today.noSchedule": "Δεν υπάρχει μάθημα σήμερα στο ωρολόγιο πρόγραμμα.",
  "today.noHoursAtAll":
    "Δεν έχει οριστεί ακόμη ωρολόγιο πρόγραμμα. Συμπληρώστε το στην ενότητα «Πρόγραμμα».",
  "today.sunday": "Η Κυριακή δεν υπάρχει στο ωρολόγιο πρόγραμμα.",
  "today.note": "Σημειώσεις της ημέρας",
  "today.noNote": "Καμία σημείωση για σήμερα.",
  "today.plans": "Τα πλάνα της εβδομάδας",
  "today.openPlan": "Άνοιγμα πλάνου",
  "today.planEmpty": "Χωρίς πλάνο αυτή την εβδομάδα",
  "today.weekNote": "Σημειώσεις της εβδομάδας",

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
  "vocab.weekday.7": "Κυριακή",

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

  "vocab.agendaScope.day": "Ημέρα",
  "vocab.agendaScope.week": "Εβδομάδα",
  "vocab.agendaScope.month": "Μήνας",

  "vocab.gradeColumnKind.numeric": "Αριθμητικός βαθμός",
  "vocab.gradeColumnKind.descriptive": "Περιγραφικός (Α–Δ)",
  "vocab.gradeColumnKind.pass_fail": "Επιτυχία / Αποτυχία",
  "vocab.gradeColumnKind.comment": "Σχόλιο",

  "vocab.descriptiveGrade.a": "Α",
  "vocab.descriptiveGrade.b": "Β",
  "vocab.descriptiveGrade.c": "Γ",
  "vocab.descriptiveGrade.d": "Δ",

  "vocab.passFailGrade.pass": "Επιτυχία",
  "vocab.passFailGrade.fail": "Αποτυχία",

  "vocab.conduct.exemplary": "Υποδειγματική",
  "vocab.conduct.very_good": "Πολύ καλή",
  "vocab.conduct.good": "Καλή",
  "vocab.conduct.satisfactory": "Ικανοποιητική",
  "vocab.conduct.needs_support": "Χρειάζεται στήριξη",
  "vocab.conduct.needs_intervention": "Χρειάζεται παρέμβαση",
} as const;
