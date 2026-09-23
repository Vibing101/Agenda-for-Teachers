/**
 * The app shell: the app's sections, the storage panel M0 left behind, and the
 * block-and-reload guard that now stands in front of real teacher data rather
 * than a scratch note.
 *
 * **This is where the calendar is read, and the only place.** `todayIso()` is
 * called here and the resulting day is passed down as a prop to every screen
 * that needs it, so no component reaches for `new Date()` on its own. That is
 * what makes the Today view testable on a chosen date — see M3's second
 * acceptance criterion — and it is why `App` takes an optional `today` override.
 *
 * That claim was inaccurate between M3 and M4.5: M2's export button, inside
 * `GradesScreen`, read the clock itself. Lifting it into the shared
 * `ExportButton` at M4.5 — rather than copying the violation into three more
 * printed sheets — is what made the sentence true again.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, isAppError, type Status } from "./api";
import { Button } from "./components/Fields";
import { todayIso } from "./domain/dates";
import type { Planner } from "./domain/types";
import { DEFAULT_LOCALE, translatorFor, type StringId } from "./i18n";
import { LocaleContext, useTranslate } from "./i18n/useTranslate";
import AgendaScreen from "./screens/AgendaScreen";
import AnnualPlanScreen from "./screens/AnnualPlanScreen";
import AppointmentsScreen from "./screens/AppointmentsScreen";
import AttendanceScreen from "./screens/AttendanceScreen";
import BehaviourScreen from "./screens/BehaviourScreen";
import ClassesScreen from "./screens/ClassesScreen";
import ContactsScreen from "./screens/ContactsScreen";
import ExamsScreen from "./screens/ExamsScreen";
import GradesScreen from "./screens/GradesScreen";
import LibraryScreen from "./screens/LibraryScreen";
import LettersScreen from "./screens/LettersScreen";
import MeetingsScreen from "./screens/MeetingsScreen";
import MessagesScreen from "./screens/MessagesScreen";
import PlanScreen, { type PlanFocus } from "./screens/PlanScreen";
import ProgressScreen from "./screens/ProgressScreen";
import ReflectionsScreen from "./screens/ReflectionsScreen";
import StudentsScreen from "./screens/StudentsScreen";
import SupportScreen from "./screens/SupportScreen";
import TimetableScreen from "./screens/TimetableScreen";
import TodayScreen from "./screens/TodayScreen";
import TripsScreen from "./screens/TripsScreen";
import YearScreen from "./screens/YearScreen";
import type { Run } from "./screens/types";

type Section =
  | "year"
  | "classes"
  | "students"
  | "grades"
  | "timetable"
  | "agenda"
  | "plan"
  | "parents"
  | "today";

/**
 * The sub-pages of a section, where a section has more than one.
 *
 * **M4 adds four surfaces and no top-level tabs.** The app already had eight,
 * and the spec files M4's pieces under two modules it already has: the
 * attendance grid and the absence register under module 4 (Βαθμοί), the
 * incident log and the support plans under module 2 (Τάξεις & Μαθητές). The
 * source product files them the same way and reaches each from its module's
 * own index page — "Απουσίες ανά τμήμα" from ΒΑΘΜΟΙ, "Συμπεριφορά και
 * περιστατικά" from ΜΑΘΗΤΕΣ. So this is that index: one row of sub-tabs inside
 * the section the spec puts the surface in, rather than four more things
 * competing for the top row.
 *
 * **M5 adds the ninth top-level tab, and it is the first since M0.** Its module
 * is the spec's "5. Γονείς & Ομάδα", and unlike M4's four surfaces it has no
 * existing section to belong to: nothing in the app is about parents or about
 * staff meetings. The source product puts ΓΟΝΕΙΣ and ΟΜΑΔΑ side by side in its
 * own navigation, which argues for two more tabs; this takes **one**, named
 * after the spec's module rather than after either half, and files all five of
 * M5's surfaces under it as sub-pages. That keeps M4's shape — sub-pages inside
 * a section, the top row as small as the spec allows — while keeping the label
 * honest about holding the staff meetings as well as the parent ones.
 *
 * **M6 adds seven sub-pages and no top-level tab, so the row stays at nine.**
 * The spec files every one of its eight surfaces under module 3, and `Πλάνο`
 * was already that module's section — it simply had no sub-pages, because M3
 * built only the weekly plan. The source product reaches all eight from its own
 * ΠΛΑΝΟ index page, so this is that index. The eight become seven because two
 * pairs collapse: *Ετήσιο πλάνο* and *Ενότητες* are two views of one record and
 * share a page, and the two reference lists — *Σχολικά βιβλία* and *Υλικά και
 * πηγές* — are the two surfaces that hang off no class and no week, so they
 * share one too.
 */
type Page =
  | "gradebook"
  | "attendance"
  | "cards"
  | "behaviour"
  | "support"
  | "contacts"
  | "appointments"
  | "meetings"
  | "letters"
  | "messages"
  | "weekPlan"
  | "annual"
  | "progress"
  | "exams"
  | "reflections"
  | "trips"
  | "library";

const SECTIONS: { key: Section; labelId: StringId; pages?: { key: Page; labelId: StringId }[] }[] = [
  { key: "year", labelId: "nav.year" },
  { key: "classes", labelId: "nav.classes" },
  {
    key: "students",
    labelId: "nav.students",
    pages: [
      { key: "cards", labelId: "nav.cards" },
      { key: "behaviour", labelId: "nav.behaviour" },
      { key: "support", labelId: "nav.support" },
    ],
  },
  {
    key: "grades",
    labelId: "nav.grades",
    pages: [
      { key: "gradebook", labelId: "nav.gradebook" },
      { key: "attendance", labelId: "nav.attendance" },
    ],
  },
  { key: "timetable", labelId: "nav.timetable" },
  {
    key: "plan",
    labelId: "nav.plan",
    pages: [
      { key: "weekPlan", labelId: "nav.weekPlan" },
      { key: "annual", labelId: "nav.annual" },
      { key: "progress", labelId: "nav.progress" },
      { key: "exams", labelId: "nav.exams" },
      { key: "reflections", labelId: "nav.reflections" },
      { key: "trips", labelId: "nav.trips" },
      { key: "library", labelId: "nav.library" },
    ],
  },
  { key: "agenda", labelId: "nav.agenda" },
  {
    key: "parents",
    labelId: "nav.parents",
    pages: [
      { key: "contacts", labelId: "nav.contacts" },
      { key: "appointments", labelId: "nav.appointments" },
      { key: "meetings", labelId: "nav.meetings" },
      { key: "letters", labelId: "nav.letters" },
      { key: "messages", labelId: "nav.messages" },
    ],
  },
  // Last, as the source product puts "ΣΗΜΕΡΙΝΟ ΜΑΘΗΜΑ" at the right of its nav.
  { key: "today", labelId: "nav.today" },
];

/** The sub-page a section opens on: its first, or none if it has no sub-pages. */
function firstPageOf(section: Section): Page | null {
  return SECTIONS.find((s) => s.key === section)?.pages?.[0].key ?? null;
}

/**
 * @param today Overrides the day the app thinks it is. Tests pin it; the app
 *   itself leaves it out and the shell reads the local calendar.
 */
export default function App({ today }: { today?: string } = {}) {
  // The app ships Greek-only through M8; M9 turns this into state behind a
  // toggle. Every string already resolves through the context, so that change
  // is here and nowhere else.
  const locale = DEFAULT_LOCALE;
  const value = useMemo(() => ({ locale, t: translatorFor(locale) }), [locale]);
  return (
    <LocaleContext.Provider value={value}>
      <Shell fixedToday={today} />
    </LocaleContext.Provider>
  );
}

function Shell({ fixedToday }: { fixedToday?: string }) {
  const t = useTranslate();
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [section, setSection] = useState<Section>("year");
  /** Which sub-page of `section` is showing, for the sections that have them. */
  const [page, setPage] = useState<Page | null>(null);
  const pages = SECTIONS.find((s) => s.key === section)?.pages;
  /**
   * Today, read from the local calendar once and then kept current. A session
   * left open overnight rolls over rather than showing yesterday, and the
   * interval sets the same string on an ordinary day, so it costs no re-render.
   */
  const [liveToday, setLiveToday] = useState(todayIso);
  useEffect(() => {
    if (fixedToday !== undefined) return;
    const timer = setInterval(() => setLiveToday(todayIso()), 60_000);
    return () => clearInterval(timer);
  }, [fixedToday]);
  const today = fixedToday ?? liveToday;
  /** Set when the Today view asks for a particular class's week to be opened. */
  const [planFocus, setPlanFocus] = useState<PlanFocus | null>(null);
  /**
   * Set when the upcoming-overview panel asks for a meeting's minutes, which
   * the spec asks it to open straight into.
   */
  const [meetingFocus, setMeetingFocus] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /**
   * Set when the data file changed on disk since we read it — most likely the
   * cloud sync caught up with another device after we opened. While it is set,
   * saving is refused and the only way forward is an explicit reload, per the
   * spec's resolved decision (no save-alongside fallback).
   */
  const [blocked, setBlocked] = useState(false);

  const refreshStatus = useCallback(async () => {
    try {
      const s = await api.status();
      setStatus(s);
      if (s.disk_changed) setBlocked(true);
    } catch (e) {
      setMessage(isAppError(e) ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        setPlanner(await api.load());
      } catch (e) {
        setMessage(isAppError(e) ? e.message : String(e));
      }
      await refreshStatus();
    })();
  }, [refreshStatus]);

  /**
   * The one path every change takes. A mutation that comes back `disk_changed`
   * raises the block instead of reporting an error the teacher cannot act on.
   */
  const run: Run = useCallback(
    async (call) => {
      setSaving(true);
      setMessage(null);
      try {
        const next = await call();
        setPlanner(next);
        await refreshStatus();
        return next;
      } catch (e) {
        if (isAppError(e) && e.code === "disk_changed") {
          setBlocked(true);
        } else {
          setMessage(isAppError(e) ? e.message : String(e));
        }
        return null;
      } finally {
        setSaving(false);
      }
    },
    [refreshStatus],
  );

  async function onReload() {
    try {
      setPlanner(await api.reload());
      setBlocked(false);
      setMessage(t("blocked.reloaded"));
      await refreshStatus();
    } catch (e) {
      setMessage(isAppError(e) ? e.message : String(e));
    }
  }

  async function onBackup() {
    try {
      const path = await api.makeBackup();
      setMessage(
        path ? t("storage.backupWritten", { path }) : t("storage.nothingToBackUp"),
      );
      await refreshStatus();
    } catch (e) {
      setMessage(isAppError(e) ? e.message : String(e));
    }
  }

  return (
    <main className="app">
      <header>
        <h1>{t("app.title")}</h1>
        <p className="subtitle">{t("app.subtitle")}</p>
        <nav>
          {SECTIONS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={s.key === section ? "tab selected" : "tab"}
              aria-current={s.key === section ? "page" : undefined}
              onClick={() => {
                setSection(s.key);
                setPage(firstPageOf(s.key));
              }}
            >
              {t(s.labelId)}
            </button>
          ))}
        </nav>
        {pages && (
          <nav className="subtabs" aria-label={t(SECTIONS.find((s) => s.key === section)!.labelId)}>
            {pages.map((p) => (
              <button
                key={p.key}
                type="button"
                className={p.key === (page ?? pages[0].key) ? "tab selected" : "tab"}
                aria-current={p.key === (page ?? pages[0].key) ? "page" : undefined}
                onClick={() => setPage(p.key)}
              >
                {t(p.labelId)}
              </button>
            ))}
          </nav>
        )}
      </header>

      {blocked && (
        <section className="blocked" role="alert">
          <h2>{t("blocked.title")}</h2>
          <p>{t("blocked.body")}</p>
          <button type="button" onClick={onReload}>
            {t("blocked.reload")}
          </button>
        </section>
      )}

      {message && <p className="message">{message}</p>}
      {saving && <p className="message">{t("common.saving")}</p>}

      {planner === null ? (
        <p>{t("common.loading")}</p>
      ) : (
        <fieldset className="sections" disabled={blocked}>
          {section === "year" && <YearScreen planner={planner} run={run} />}
          {section === "classes" && <ClassesScreen planner={planner} run={run} />}
          {section === "students" && (page ?? "cards") === "cards" && (
            <StudentsScreen planner={planner} run={run} />
          )}
          {section === "students" && page === "behaviour" && (
            <BehaviourScreen planner={planner} run={run} today={today} />
          )}
          {section === "students" && page === "support" && (
            <SupportScreen planner={planner} run={run} today={today} />
          )}
          {section === "grades" && (page ?? "gradebook") === "gradebook" && (
            <GradesScreen planner={planner} run={run} today={today} />
          )}
          {section === "grades" && page === "attendance" && (
            <AttendanceScreen planner={planner} run={run} today={today} />
          )}
          {section === "parents" && (page ?? "contacts") === "contacts" && (
            <ContactsScreen planner={planner} run={run} today={today} />
          )}
          {section === "parents" && page === "appointments" && (
            <AppointmentsScreen
              planner={planner}
              run={run}
              today={today}
              onOpenMeeting={(id) => {
                setMeetingFocus(id);
                setPage("meetings");
              }}
            />
          )}
          {section === "parents" && page === "meetings" && (
            <MeetingsScreen planner={planner} run={run} focusId={meetingFocus} />
          )}
          {section === "parents" && page === "letters" && <LettersScreen today={today} />}
          {section === "parents" && page === "messages" && <MessagesScreen today={today} />}
          {section === "timetable" && <TimetableScreen planner={planner} run={run} />}
          {section === "plan" && (page ?? "weekPlan") === "weekPlan" && (
            <PlanScreen planner={planner} run={run} today={today} focus={planFocus} />
          )}
          {section === "plan" && page === "annual" && (
            <AnnualPlanScreen planner={planner} run={run} />
          )}
          {section === "plan" && page === "progress" && (
            // Takes no `run`: the matrix is a view over the weekly plans, so
            // there is nothing on it to save. M6's first acceptance criterion.
            <ProgressScreen
              planner={planner}
              today={today}
              onOpenPlan={(focus) => {
                setPlanFocus(focus);
                setPage("weekPlan");
              }}
            />
          )}
          {section === "plan" && page === "exams" && (
            <ExamsScreen planner={planner} run={run} today={today} />
          )}
          {section === "plan" && page === "reflections" && (
            <ReflectionsScreen planner={planner} run={run} />
          )}
          {section === "plan" && page === "trips" && <TripsScreen planner={planner} run={run} />}
          {section === "plan" && page === "library" && (
            <LibraryScreen planner={planner} run={run} />
          )}
          {section === "agenda" && (
            <AgendaScreen planner={planner} run={run} today={today} />
          )}
          {section === "today" && (
            <TodayScreen
              planner={planner}
              today={today}
              onOpenPlan={(focus) => {
                setPlanFocus(focus);
                setSection("plan");
                // Πλάνο has sub-pages since M6, so name the one the plan is on
                // rather than letting the section open on its first.
                setPage("weekPlan");
              }}
            />
          )}
        </fieldset>
      )}

      <section className="panel">
        <h2>{t("storage.heading")}</h2>
        {status ? (
          <dl>
            <dt>{t("storage.appFolder")}</dt>
            <dd>{status.app_folder}</dd>
            <dt>{t("storage.dataFile")}</dt>
            <dd>
              {status.db_path} {status.db_exists ? "" : t("storage.notCreated")}
            </dd>
            <dt>{t("storage.schemaVersion")}</dt>
            <dd>{status.schema_version}</dd>
            <dt>{t("storage.backups")}</dt>
            <dd>
              {status.backup_count}
              {status.last_backup
                ? ` — ${t("storage.latest", { when: status.last_backup })}`
                : ""}
            </dd>
          </dl>
        ) : (
          <p>{t("common.loading")}</p>
        )}
        <div className="actions">
          <Button labelId="storage.backupNow" onClick={onBackup} />
        </div>
      </section>
    </main>
  );
}
