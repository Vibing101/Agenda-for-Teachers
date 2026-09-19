import { useCallback, useEffect, useState } from "react";
import { api, isAppError, type Status } from "./api";

type SaveState = "idle" | "saving" | "saved" | "error";

export default function App() {
  const [status, setStatus] = useState<Status | null>(null);
  const [note, setNote] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [message, setMessage] = useState<string | null>(null);
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
        const loaded = await api.load();
        setNote(loaded.note);
      } catch (e) {
        setMessage(isAppError(e) ? e.message : String(e));
      }
      await refreshStatus();
    })();
  }, [refreshStatus]);

  async function onSave() {
    setSaveState("saving");
    setMessage(null);
    try {
      await api.save(note);
      setSaveState("saved");
      await refreshStatus();
    } catch (e) {
      if (isAppError(e) && e.code === "disk_changed") {
        setBlocked(true);
        setSaveState("idle");
        return;
      }
      setSaveState("error");
      setMessage(isAppError(e) ? e.message : String(e));
    }
  }

  async function onReload() {
    try {
      const loaded = await api.reload();
      setNote(loaded.note);
      setBlocked(false);
      setSaveState("idle");
      setMessage("Reloaded the version that is now on disk.");
      await refreshStatus();
    } catch (e) {
      setMessage(isAppError(e) ? e.message : String(e));
    }
  }

  async function onBackup() {
    try {
      const path = await api.makeBackup();
      setMessage(path ? `Snapshot written: ${path}` : "Nothing to back up yet.");
      await refreshStatus();
    } catch (e) {
      setMessage(isAppError(e) ? e.message : String(e));
    }
  }

  return (
    <main className="app">
      <header>
        <h1>Ατζέντα Εκπαιδευτικού</h1>
        <p className="milestone">M0 — shell &amp; persistence</p>
      </header>

      {blocked && (
        <section className="blocked" role="alert">
          <h2>The data file changed on disk</h2>
          <p>
            Another copy of this folder has been saved since this app read the file — most
            likely the cloud sync finished catching up from another device. Saving is
            blocked so that work is not overwritten.
          </p>
          <button type="button" onClick={onReload}>
            Reload from disk
          </button>
        </section>
      )}

      <section className="panel">
        <label htmlFor="note">Persistence check</label>
        <textarea
          id="note"
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaveState("idle");
          }}
          rows={5}
          placeholder="Type something, save, quit the app completely, and reopen it."
        />
        <div className="actions">
          <button type="button" onClick={onSave} disabled={blocked || saveState === "saving"}>
            {saveState === "saving" ? "Saving…" : "Save"}
          </button>
          <button type="button" onClick={onBackup}>
            Back up now
          </button>
          {saveState === "saved" && <span className="ok">Saved</span>}
        </div>
      </section>

      {message && <p className="message">{message}</p>}

      <section className="panel">
        <h2>Where the data lives</h2>
        {status ? (
          <dl>
            <dt>App folder</dt>
            <dd>{status.app_folder}</dd>
            <dt>Data file</dt>
            <dd>
              {status.db_path} {status.db_exists ? "" : "(not created yet)"}
            </dd>
            <dt>Schema version</dt>
            <dd>{status.schema_version}</dd>
            <dt>Backups</dt>
            <dd>
              {status.backup_count}
              {status.last_backup ? ` — latest ${status.last_backup}` : ""}
            </dd>
          </dl>
        ) : (
          <p>Loading…</p>
        )}
      </section>
    </main>
  );
}
