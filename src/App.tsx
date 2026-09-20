/**
 * The app shell: the three M1 sections, the storage panel M0 left behind, and
 * the block-and-reload guard that now stands in front of real teacher data
 * rather than a scratch note.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, isAppError, type Status } from "./api";
import { Button } from "./components/Fields";
import type { Planner } from "./domain/types";
import { DEFAULT_LOCALE, translatorFor, type StringId } from "./i18n";
import { LocaleContext, useTranslate } from "./i18n/useTranslate";
import ClassesScreen from "./screens/ClassesScreen";
import GradesScreen from "./screens/GradesScreen";
import StudentsScreen from "./screens/StudentsScreen";
import YearScreen from "./screens/YearScreen";
import type { Run } from "./screens/types";

type Section = "year" | "classes" | "students" | "grades";
const SECTIONS: { key: Section; labelId: StringId }[] = [
  { key: "year", labelId: "nav.year" },
  { key: "classes", labelId: "nav.classes" },
  { key: "students", labelId: "nav.students" },
  { key: "grades", labelId: "nav.grades" },
];

export default function App() {
  // The app ships Greek-only through M8; M9 turns this into state behind a
  // toggle. Every string already resolves through the context, so that change
  // is here and nowhere else.
  const locale = DEFAULT_LOCALE;
  const value = useMemo(() => ({ locale, t: translatorFor(locale) }), [locale]);
  return (
    <LocaleContext.Provider value={value}>
      <Shell />
    </LocaleContext.Provider>
  );
}

function Shell() {
  const t = useTranslate();
  const [planner, setPlanner] = useState<Planner | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [section, setSection] = useState<Section>("year");
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
