/**
 * Form primitives.
 *
 * Each one takes a **string id**, never a label — that is what keeps Greek text
 * out of the screens and makes the M9 English pass a one-file change. It also
 * means every control is labelled, which is what the component tests query by.
 */
import { useEffect, useId, useState, type ReactNode } from "react";
import { useTranslate } from "../i18n/useTranslate";
import type { Params, StringId } from "../i18n";

interface FieldProps {
  labelId: StringId;
  labelParams?: Params;
  hintId?: StringId;
  children: (controlId: string) => ReactNode;
}

export function Field({ labelId, labelParams, hintId, children }: FieldProps) {
  const t = useTranslate();
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{t(labelId, labelParams)}</label>
      {children(id)}
      {hintId && <p className="hint">{t(hintId)}</p>}
    </div>
  );
}

interface TextFieldProps {
  labelId: StringId;
  labelParams?: Params;
  hintId?: StringId;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "date" | "time" | "tel" | "email";
  placeholderId?: StringId;
}

export function TextField({
  labelId,
  labelParams,
  hintId,
  value,
  onChange,
  type = "text",
  placeholderId,
}: TextFieldProps) {
  const t = useTranslate();
  return (
    <Field labelId={labelId} labelParams={labelParams} hintId={hintId}>
      {(id) => (
        <input
          id={id}
          type={type}
          value={value}
          placeholder={placeholderId ? t(placeholderId) : undefined}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </Field>
  );
}

/**
 * A text field that commits when it loses focus rather than on every keystroke.
 *
 * Used for fields edited straight into a list — a roster note, say — where
 * saving per character would mean a write to the data file, and a fingerprint
 * re-check, for every letter typed.
 */
export function DeferredTextField({
  labelId,
  labelParams,
  value,
  onCommit,
  type = "text",
}: {
  labelId: StringId;
  labelParams?: Params;
  value: string;
  onCommit: (value: string) => void;
  type?: "text" | "time" | "date";
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Field labelId={labelId} labelParams={labelParams}>
      {(id) => (
        <input
          id={id}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== value) onCommit(draft);
          }}
        />
      )}
    </Field>
  );
}

/**
 * The text-area twin of [`DeferredTextField`]: commits when it loses focus.
 *
 * Added at M7 for the print forms and the substitute folder, whose boxes are
 * saved as the teacher leaves them rather than behind a Save button — a form
 * with thirty boxes on it should not lose one because she clicked away.
 */
export function DeferredTextArea({
  labelId,
  labelParams,
  value,
  onCommit,
  rows = 3,
}: {
  labelId: StringId;
  labelParams?: Params;
  value: string;
  onCommit: (value: string) => void;
  rows?: number;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <Field labelId={labelId} labelParams={labelParams}>
      {(id) => (
        <textarea
          id={id}
          rows={rows}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== value) onCommit(draft);
          }}
        />
      )}
    </Field>
  );
}

/**
 * One cell of a ruled register or one desk of a room plan: an input with an
 * accessible name and no visible label, committing when it loses focus.
 *
 * A 31-day attendance card is nearly a thousand of these, which is why it is
 * not a [`Field`] with a `<label>` each.
 */
export function CellInput({
  label,
  value,
  onCommit,
  type = "text",
  className,
}: {
  /** Already translated — a cell's name is built from its column and row. */
  label: string;
  value: string;
  onCommit: (value: string) => void;
  type?: "text" | "date";
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return (
    <input
      aria-label={label}
      className={className}
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft !== value) onCommit(draft);
      }}
    />
  );
}

interface TextAreaProps {
  labelId: StringId;
  labelParams?: Params;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}

export function TextArea({ labelId, labelParams, value, onChange, rows = 3 }: TextAreaProps) {
  return (
    <Field labelId={labelId} labelParams={labelParams}>
      {(id) => (
        <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </Field>
  );
}

interface SelectFieldProps<T extends string | number> {
  labelId: StringId;
  value: T;
  onChange: (value: T) => void;
  options: readonly T[];
  optionLabelId: (option: T) => StringId;
}

export function SelectField<T extends string | number>({
  labelId,
  value,
  onChange,
  options,
  optionLabelId,
}: SelectFieldProps<T>) {
  const t = useTranslate();
  return (
    <Field labelId={labelId}>
      {(id) => (
        <select
          id={id}
          value={String(value)}
          onChange={(e) => {
            const picked = options.find((o) => String(o) === e.target.value);
            if (picked !== undefined) onChange(picked);
          }}
        >
          {options.map((option) => (
            <option key={String(option)} value={String(option)}>
              {t(optionLabelId(option))}
            </option>
          ))}
        </select>
      )}
    </Field>
  );
}

interface CheckboxFieldProps {
  labelId: StringId;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export function CheckboxField({ labelId, checked, onChange }: CheckboxFieldProps) {
  const t = useTranslate();
  const id = useId();
  return (
    <div className="field checkbox">
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <label htmlFor={id}>{t(labelId)}</label>
    </div>
  );
}

/** A translated button, so no screen has to reach for `t` just to label one. */
export function Button({
  labelId,
  labelParams,
  onClick,
  variant = "secondary",
  disabled,
  type = "button",
}: {
  labelId: StringId;
  labelParams?: Params;
  onClick?: () => void;
  variant?: "primary" | "secondary" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  const t = useTranslate();
  return (
    <button type={type} className={variant} onClick={onClick} disabled={disabled}>
      {t(labelId, labelParams)}
    </button>
  );
}

export function Panel({
  headingId,
  introId,
  children,
  actions,
}: {
  headingId: StringId;
  introId?: StringId;
  children: ReactNode;
  actions?: ReactNode;
}) {
  const t = useTranslate();
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2>{t(headingId)}</h2>
          {introId && <p className="intro">{t(introId)}</p>}
        </div>
        {actions && <div className="panel-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Teacher-entered text, or a neutral marker when she has not filled it in. */
export function Entered({ value, fallbackId }: { value: string; fallbackId: StringId }) {
  const t = useTranslate();
  return value.trim() ? <>{value}</> : <span className="muted">{t(fallbackId)}</span>;
}
