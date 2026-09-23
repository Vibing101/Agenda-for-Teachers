/**
 * Τράπεζα μηνυμάτων — the 150-message bank.
 *
 * Search, pick a message, fill its `[ΑΓΚΥΛΕΣ]`, and either export a PDF or copy
 * the text. The spec asks for both: "given these are short, also keep a
 * one-click 'copy text' option alongside PDF generation for messages the
 * teacher will paste into an email/SMS rather than print".
 *
 * **The copy follows M4's timetable precedent**, down to the failure message —
 * clipboard access can refuse, and a button that silently does nothing is worse
 * than one that says so. And the copied text and the printed text come out of
 * the *same* fill, so what she pastes cannot differ from what she prints.
 *
 * **Search is a selector, not a screen rule.** `searchMessages` in
 * `domain/messages.ts` folds accents and case and matches title and body; this
 * screen only renders what it returns.
 */
import { useMemo, useState } from "react";
import { ExportButton } from "../components/ExportButton";
import { Button, Panel, TextField } from "../components/Fields";
import { formatDate } from "../domain/dates";
import {
  categoryTitleId,
  MESSAGE_CATEGORIES,
  searchMessages,
  type MessageCategory,
} from "../domain/messages";
import { useTranslate } from "../i18n/useTranslate";
import { messageAsText, messageHtml } from "../print/letterSheets";

export default function MessagesScreen({ today }: { today: string }) {
  const t = useTranslate();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<MessageCategory | "">("");
  const [picked, setPicked] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  const found = useMemo(() => searchMessages(t, query, category), [t, query, category]);
  const message = useMemo(
    () => found.find((m) => m.code === picked) ?? null,
    [found, picked],
  );

  return (
    <>
      <Panel headingId="messages.heading" introId="messages.intro">
        <div className="row wrap">
          <TextField labelId="messages.search" value={query} onChange={setQuery} />
          <label className="field">
            <span>{t("messages.category")}</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as MessageCategory | "")}
            >
              <option value="">{t("messages.allCategories")}</option>
              {MESSAGE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(categoryTitleId(c))}
                </option>
              ))}
            </select>
          </label>
        </div>

        {found.length === 0 ? (
          <p className="muted">{t("messages.none")}</p>
        ) : (
          <>
            <p className="muted">{t("messages.count", { n: found.length })}</p>
            <ul className="rows">
              {found.map((m) => (
                <li key={m.code}>
                  <div className="row wrap">
                    <span className="muted">{t(categoryTitleId(m.category))}</span>
                    <span className="strong">{m.title}</span>
                    <Button
                      labelId="messages.pick"
                      onClick={() => {
                        setPicked(m.code);
                        setValues({});
                        setCopyMessage(null);
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>

      {message && (
        <Panel headingId="messages.selected">
          <h3>{message.title}</h3>
          {/* The message's own words, with whatever has been filled in so far —
              the same fill the PDF and the clipboard get. */}
          <p className="prose">{messageAsText(message, values)}</p>

          {message.placeholders.length === 0 ? (
            <p className="muted">{t("messages.noPlaceholders")}</p>
          ) : (
            <div className="row wrap">
              {message.placeholders.map((token) => (
                <label className="field" key={token}>
                  <span>{token}</span>
                  <input
                    type="text"
                    value={values[token] ?? ""}
                    onChange={(e) => setValues((v) => ({ ...v, [token]: e.target.value }))}
                  />
                </label>
              ))}
            </div>
          )}

          <div className="row">
            <Button
              labelId="messages.copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(messageAsText(message, values));
                  setCopyMessage(t("messages.copied"));
                } catch {
                  // Clipboard access can refuse — M4 hit this on the timetable
                  // and the answer is to say so, not to fail silently.
                  setCopyMessage(t("messages.copyFailed"));
                }
              }}
            />
            <ExportButton
              labelId="messages.export"
              landscape={false}
              fileName={t("messages.fileName", {
                title: message.title,
                date: formatDate(today),
              })}
              html={() => messageHtml(t, message, values, today)}
            />
          </div>
          {copyMessage && (
            <p className="message" role="status">
              {copyMessage}
            </p>
          )}
        </Panel>
      )}
    </>
  );
}
