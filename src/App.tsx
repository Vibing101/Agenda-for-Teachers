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
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, isAppError, type Status } from "./api";
import { Button } from "./components/Fields";
import { todayIso } from "./domain/dates";
import type { Planner } from "./domain/types";
import { DEFAULT_LOCALE, translatorFor, type StringId } from "./i18n";
import { LocaleContext, useTranslate } from "./i18n/useTranslate";
import AgendaScreen from "./screens/AgendaScreen";
import ClassesScreen from "./screens/ClassesScreen";
import GradesScreen from "./screens/GradesScreen";
import PlanScreen, { type PlanFocus } from "./screens/PlanScreen";
import StudentsScreen from "./screens/StudentsScreen";
import TimetableScreen from "./screens/TimetableScreen";
import TodayScreen from "./screens/TodayScreen";
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
  | "today";
const SECTIONS: { key: Section; labelId: StringId }[] = [
  { key: "year", labelId: "nav.year" },
  { key: "classes", labelId: "nav.classes" },
  { key: "students", labelId: "nav.students" },
  { key: "grades", labelId: "nav.grades" },
  { key: "timetable", labelId: "nav.timetable" },
  { key: "plan", labelId: "nav.plan" },
  { key: "agenda", labelId: "nav.agenda" },
  // Last, as the source product puts "ΣΗΜΕΡΙΝΟ ΜΑΘΗΜΑ" at the right of its nav.
  { key: "today", labelId: "nav.today" },
];

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
              onClick={() => setSection(s.key)}
            >
              {t(s.labelId)}
            </button>
          ))}
        </nav>
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
          {section === "students" && <StudentsScreen planner={planner} run={run} />}
          {section === "grades" && <GradesScreen planner={planner} run={run} />}
          {section === "timetable" && <TimetableScreen planner={planner} run={run} />}
          {section === "plan" && (
            <PlanScreen planner={planner} run={run} today={today} focus={planFocus} />
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
