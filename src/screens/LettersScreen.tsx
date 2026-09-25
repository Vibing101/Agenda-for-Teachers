/**
 * Έτοιμες επιστολές προς γονείς — the seven parent letters.
 *
 * Pick a letter, fill its fields, and export a descriptively-named PDF. That is
 * the spec's own sentence for this surface, and it is all of it.
 *
 * **Nothing here is stored.** A letter is filled and printed in one sitting, and
 * M5's scope line does not ask for a filled letter to be saved. Saving a filled
 * form under a name, reopening it and editing it again is M7's print-forms
 * library, which has an acceptance criterion of its own for exactly that. The
 * values live in this screen's state, so switching to another letter and back
 * within a session keeps them — see `drafts` below.
 *
 * **What the teacher leaves blank prints as a ruled line, not as `[ΑΓΚΥΛΕΣ]`.**
 * That is M5's first acceptance criterion and it is the source's own behaviour:
 * these letters are forms, and an unfilled one is a form to finish by hand.
 */
import { useMemo, useState } from "react";
import { ExportButton } from "../components/ExportButton";
import { Button, Panel, TextArea, TextField } from "../components/Fields";
import { formatDate } from "../domain/dates";
import {
  AWARD_NAME_KEY,
  AWARD_REASON_KEY,
  LETTERS,
  type LetterCode,
  type LetterValues,
} from "../domain/letters";
import { useTranslate } from "../i18n/useTranslate";
import { letterHtml, unansweredPlaceholders } from "../print/letterSheets";

export default function LettersScreen({ today }: { today: string }) {
  const t = useTranslate();
  const [code, setCode] = useState<LetterCode>(LETTERS[0].code);
  /**
   * One draft per letter, so moving between letters while composing does not
   * throw away what was typed into the other.
   */
  const [drafts, setDrafts] = useState<Record<string, LetterValues>>({});

  const letter = useMemo(() => LETTERS.find((l) => l.code === code)!, [code]);
  const values = drafts[code] ?? {};
  const setValue = (key: string, value: string) =>
    setDrafts((d) => ({ ...d, [code]: { ...(d[code] ?? {}), [key]: value } }));

  // The `[ΑΓΚΥΛΕΣ]` the letter's own fixed text asks for, minus any already
  // answered by a field of the same name — so a slip that names the meeting
  // date does not ask for it twice.
  const tokens = unansweredPlaceholders(t, letter);
  const hasAward = letter.blocks.some((b) => b.kind === "award");

  return (
    <Panel
      headingId="letters.heading"
      introId="letters.intro"
      actions={
        <>
          <Button labelId="letters.clear" onClick={() => setDrafts((d) => ({ ...d, [code]: {} }))} />
          {/* Portrait: the source's letters are portrait A4, unlike every
              register this app prints. */}
          <ExportButton
            labelId="letters.export"
            landscape={false}
            fileName={t("letters.fileName", {
              letter: t(letter.titleId),
              date: formatDate(today),
            })}
            html={() => letterHtml(t, letter, values, today)}
          />
        </>
      }
    >
      <label className="field">
        <span>{t("letters.pick")}</span>
        <select value={code} onChange={(e) => setCode(e.target.value as LetterCode)}>
          {LETTERS.map((l) => (
            <option key={l.code} value={l.code}>
              {t(l.titleId)}
            </option>
          ))}
        </select>
      </label>

      <p className="muted">{t("letters.blankNote")}</p>

      {letter.fields.length > 0 && (
        <>
          <h3>{t("letters.fields")}</h3>
          <div className="row wrap">
            {letter.fields.map((field) => (
              <TextField
                key={field.key}
                labelId={field.captionId}
                type={field.kind === "date" ? "date" : field.kind === "time" ? "time" : "text"}
                value={values[field.key] ?? ""}
                onChange={(v) => setValue(field.key, v)}
              />
            ))}
          </div>
        </>
      )}

      {hasAward && (
        <div className="row wrap">
          <TextField
            labelId="letters.awardName"
            value={values[AWARD_NAME_KEY] ?? ""}
            onChange={(v) => setValue(AWARD_NAME_KEY, v)}
          />
          <TextField
            labelId="letters.awardReason"
            value={values[AWARD_REASON_KEY] ?? ""}
            onChange={(v) => setValue(AWARD_REASON_KEY, v)}
          />
        </div>
      )}

      {/* The teacher's own writing areas — the source page's captioned boxes.
          Printed exactly as typed and never translated. */}
      {letter.blocks.map((block, i) => {
        if (block.kind === "area") {
          return (
            <TextArea
              key={`${block.key}-${i}`}
              labelId={block.captionId}
              rows={Math.min(block.rows ?? 4, 8)}
              value={values[block.key] ?? ""}
              onChange={(v) => setValue(block.key, v)}
            />
          );
        }
        if (block.kind === "slip" || block.kind === "signatures") {
          return (
            <div className="row wrap" key={`sig-${i}`}>
              {block.fields.map((field) => (
                <TextField
                  key={field.key}
                  labelId={field.captionId}
                  type={field.kind === "date" ? "date" : "text"}
                  value={values[field.key] ?? ""}
                  onChange={(v) => setValue(field.key, v)}
                />
              ))}
            </div>
          );
        }
        return null;
      })}

      {tokens.length > 0 && (
        <>
          <h3>{t("letters.placeholders")}</h3>
          <div className="row wrap">
            {tokens.map(({ token, key }) => (
              // The caption is the token itself — the source's own
              // `[ΟΝΟΜΑΤΕΠΩΝΥΜΟ]`, from the language bundle rather than a
              // literal here. The value is kept against the token's stable key,
              // so it survives a switch of language (M9).
              <label className="field" key={key}>
                <span>{token}</span>
                <input
                  type="text"
                  value={values[key] ?? ""}
                  onChange={(e) => setValue(key, e.target.value)}
                />
              </label>
            ))}
          </div>
        </>
      )}
    </Panel>
  );
}
