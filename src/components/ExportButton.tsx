/**
 * The one export button, for every printable sheet in the app.
 *
 * It builds a document and asks the Rust side to write it into `exports/`, and
 * it owns the three states an export has: busy, written, failed.
 *
 * **Export is not a mutation, so it does not go through `run`.** Nothing about
 * the data file changes, and a failed export must not look like a failed save.
 *
 * **`today` is a prop, not a clock read.** M3 established that the shell is the
 * single place that reads the calendar and passes the day down; M2's original
 * copy of this button predates that rule and called `todayIso()` itself, which
 * made `App`'s own doc comment — "this is where the calendar is read, and the
 * only place" — untrue. Lifting the button out of `GradesScreen` at M4.5 is
 * what closes that, rather than replicating the violation into three more
 * sheets.
 *
 * `html` is a function so a sheet — a 31-column attendance card, a register of
 * a year's incidents — is built when the teacher asks for it and not on every
 * render of the screen it sits on.
 */
import { useState } from "react";
import { api, describeError } from "../api";
import type { StringId } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import { Button } from "./Fields";

export function ExportButton({
  labelId,
  fileName,
  html,
  landscape = true,
}: {
  labelId: StringId;
  /** The file's name, without an extension. Built by the caller, which has the
   * class, the filter and the formatted date the name should carry. */
  fileName: string;
  /** Built on demand: the complete document to render. */
  html: () => string;
  landscape?: boolean;
}) {
  const t = useTranslate();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  return (
    <>
      <Button
        labelId={labelId}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setMessage(null);
          try {
            const path = await api.exportPdf(fileName, html(), landscape);
            setMessage(t("grades.exported", { path }));
          } catch (e) {
            setMessage(describeError(t, e));
          } finally {
            setBusy(false);
          }
        }}
      />
      {busy && <span className="muted">{t("grades.exporting")}</span>}
      {message && (
        <span className="message" role="status">
          {message}
        </span>
      )}
    </>
  );
}
