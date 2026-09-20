/**
 * Μαθητές — the student index and the full student card.
 *
 * The card carries every field the source product's own card has (details,
 * guardians, health and emergency, SEN) plus the multi-class membership the
 * spec adds. M1's third acceptance criterion is that all of it survives a
 * save and reload, which is why the card is one flat draft saved in one call
 * rather than a set of independently-saved sections.
 */
import { useEffect, useId, useMemo, useState } from "react";
import { api } from "../api";
import { Button, CheckboxField, Panel, SelectField, TextArea, TextField } from "../components/Fields";
import { useStoredDraft } from "../components/useStoredDraft";
import { dayOfMonth, formatDate, isIsoDate, monthOf } from "../domain/dates";
import { monthOrder } from "../domain/schoolYear";
import { emptyStudent, type Planner, type Student } from "../domain/types";
import { useTranslate } from "../i18n/useTranslate";
import { monthLabel, SEN_STATUSES, senStatusLabel, type SenStatus } from "../i18n/vocabularies";
import type { Run } from "./types";

type SortKey = "name" | "register" | "birthDate";
const SORT_KEYS: SortKey[] = ["name", "register", "birthDate"];
const sortLabel = (key: SortKey) =>
  ({ name: "students.sort.name", register: "students.sort.register", birthDate: "students.sort.birthDate" })[
    key
  ] as "students.sort.name";

export default function StudentsScreen({ planner, run }: { planner: Planner; run: Run }) {
  const [selectedId, setSelectedId] = useState<number | null>(planner.students[0]?.id ?? null);
  useEffect(() => {
    if (planner.students.length === 0) setSelectedId(null);
    else if (!planner.students.some((s) => s.id === selectedId)) {
      setSelectedId(planner.students[0].id);
    }
  }, [planner.students, selectedId]);

  const selected = planner.students.find((s) => s.id === selectedId) ?? null;

  return (
    <>
      <Index planner={planner} selectedId={selectedId} onSelect={setSelectedId} run={run} />
      {selected && <Card key={selected.id} student={selected} planner={planner} run={run} />}
      <Birthdays planner={planner} />
    </>
  );
}

function Index({
  planner,
  selectedId,
  onSelect,
  run,
}: {
  planner: Planner;
  selectedId: number | null;
  onSelect: (id: number) => void;
  run: Run;
}) {
  const t = useTranslate();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const classesOf = useMemo(() => {
    const map = new Map<number, string[]>();
    for (const e of planner.enrollments) {
      const name = planner.classes.find((c) => c.id === e.class_id)?.name.trim();
      if (!name) continue;
      map.set(e.student_id, [...(map.get(e.student_id) ?? []), name]);
    }
    return map;
  }, [planner.enrollments, planner.classes]);

  const shown = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("el");
    const matches = planner.students.filter((s) => {
      if (!needle) return true;
      const haystack = [s.full_name, s.register_number, ...(classesOf.get(s.id) ?? [])]
        .join(" ")
        .toLocaleLowerCase("el");
      return haystack.includes(needle);
    });
    const by: Record<SortKey, (s: Student) => string> = {
      name: (s) => s.full_name,
      register: (s) => s.register_number,
      birthDate: (s) => s.birth_date,
    };
    // `numeric` so register number 220 sorts before 12345 rather than
    // after it, which is what plain string ordering would do.
    return [...matches].sort((a, b) =>
      by[sort](a).localeCompare(by[sort](b), "el", { numeric: true }),
    );
  }, [planner.students, classesOf, query, sort]);

  return (
    <Panel
      headingId="students.heading"
      introId="students.intro"
      actions={
        <Button
          labelId="students.new"
          variant="primary"
          onClick={async () => {
            // Select the student we just created — same reason as the class
            // screen: otherwise the card stays bound to the previously selected
            // student and typing a name overwrites her instead.
            const before = new Set(planner.students.map((s) => s.id));
            const next = await run(() => api.saveStudent(emptyStudent()));
            const created = next?.students.find((s) => !before.has(s.id));
            if (created) onSelect(created.id);
          }}
        />
      }
    >
      <div className="row">
        <TextField
          labelId="students.search"
          placeholderId="students.searchPlaceholder"
          value={query}
          onChange={setQuery}
        />
        <SelectField<SortKey>
          labelId="students.sortBy"
          value={sort}
          onChange={setSort}
          options={SORT_KEYS}
          optionLabelId={sortLabel}
        />
      </div>

      {planner.students.length === 0 ? (
        <p className="muted">{t("students.none")}</p>
      ) : shown.length === 0 ? (
        <p className="muted">{t("students.noMatches")}</p>
      ) : (
        <>
          <p className="muted">{t("students.countValue", { n: shown.length })}</p>
          <ul className="chips">
            {shown.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  className={s.id === selectedId ? "chip selected" : "chip"}
                  onClick={() => onSelect(s.id)}
                >
                  <strong>{s.full_name.trim() || t("common.unnamed")}</strong>
                  <span className="muted">{(classesOf.get(s.id) ?? []).join(", ")}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function Card({
  student,
  planner,
  run,
}: {
  student: Student;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  const [draft, setDraft] = useStoredDraft(student);
  const patch = (p: Partial<Student>) => setDraft((d) => ({ ...d, ...p }));

  const memberships = planner.enrollments.filter((e) => e.student_id === student.id);
  const notIn = planner.classes.filter((c) => !memberships.some((e) => e.class_id === c.id));
  const [toJoin, setToJoin] = useState(0);
  const joinId = useId();

  return (
    <Panel headingId="students.card">
      <h3>{t("students.details")}</h3>
      <div className="row">
        <TextField
          labelId="students.fullName"
          value={draft.full_name}
          onChange={(full_name) => patch({ full_name })}
        />
        <TextField
          labelId="students.registerNumber"
          value={draft.register_number}
          onChange={(register_number) => patch({ register_number })}
        />
        <TextField
          labelId="students.birthDate"
          type="date"
          value={draft.birth_date}
          onChange={(birth_date) => patch({ birth_date })}
        />
        <TextField
          labelId="students.homeLanguage"
          value={draft.home_language}
          onChange={(home_language) => patch({ home_language })}
        />
      </div>
      <TextField
        labelId="students.address"
        value={draft.address}
        onChange={(address) => patch({ address })}
      />
      <CheckboxField
        labelId="students.midyear"
        checked={draft.midyear_enrollment}
        onChange={(midyear_enrollment) => patch({ midyear_enrollment })}
      />

      <h3>{t("students.guardians")}</h3>
      <div className="columns">
        <div className="card">
          <h4>{t("students.guardian1")}</h4>
          <TextField
            labelId="common.name"
            value={draft.guardian1_name}
            onChange={(guardian1_name) => patch({ guardian1_name })}
          />
          <TextField
            labelId="common.phone"
            type="tel"
            value={draft.guardian1_phone}
            onChange={(guardian1_phone) => patch({ guardian1_phone })}
          />
          <TextField
            labelId="common.email"
            type="email"
            value={draft.guardian1_email}
            onChange={(guardian1_email) => patch({ guardian1_email })}
          />
        </div>
        <div className="card">
          <h4>{t("students.guardian2")}</h4>
          <TextField
            labelId="common.name"
            value={draft.guardian2_name}
            onChange={(guardian2_name) => patch({ guardian2_name })}
          />
          <TextField
            labelId="common.phone"
            type="tel"
            value={draft.guardian2_phone}
            onChange={(guardian2_phone) => patch({ guardian2_phone })}
          />
          <TextField
            labelId="common.email"
            type="email"
            value={draft.guardian2_email}
            onChange={(guardian2_email) => patch({ guardian2_email })}
          />
        </div>
      </div>

      <h3>{t("students.health")}</h3>
      <div className="row">
        <TextField
          labelId="students.allergies"
          value={draft.allergies}
          onChange={(allergies) => patch({ allergies })}
        />
        <TextField
          labelId="students.conditions"
          value={draft.conditions}
          onChange={(conditions) => patch({ conditions })}
        />
        <TextField
          labelId="students.medication"
          value={draft.medication}
          onChange={(medication) => patch({ medication })}
        />
        <TextField
          labelId="students.emergencyPhone"
          type="tel"
          value={draft.emergency_phone}
          onChange={(emergency_phone) => patch({ emergency_phone })}
        />
      </div>

      <h3>{t("students.sen")}</h3>
      <SelectField<SenStatus>
        labelId="students.senStatus"
        value={draft.sen_status}
        onChange={(sen_status) => patch({ sen_status })}
        options={SEN_STATUSES}
        optionLabelId={senStatusLabel}
      />
      <TextArea
        labelId="students.senPlan"
        value={draft.sen_plan}
        onChange={(sen_plan) => patch({ sen_plan })}
      />
      <TextArea
        labelId="students.senAccommodations"
        value={draft.sen_accommodations}
        onChange={(sen_accommodations) => patch({ sen_accommodations })}
      />

      <TextArea labelId="students.notes" value={draft.notes} onChange={(notes) => patch({ notes })} />
      <TextArea
        labelId="students.meetingNotes"
        value={draft.meeting_notes}
        onChange={(meeting_notes) => patch({ meeting_notes })}
      />

      <div className="actions">
        <Button
          labelId="common.save"
          variant="primary"
          onClick={() => run(() => api.saveStudent(draft))}
        />
        <Button
          labelId="common.delete"
          variant="danger"
          onClick={() => run(() => api.deleteStudent(student.id))}
        />
      </div>
      <p className="note">{t("students.deleteWarning")}</p>

      <h3>{t("students.classes")}</h3>
      {memberships.length === 0 ? (
        <p className="muted">{t("students.notInAnyClass")}</p>
      ) : (
        <ul className="rows">
          {memberships.map((e) => (
            <li key={e.class_id}>
              <span className="grow">
                {planner.classes.find((c) => c.id === e.class_id)?.name.trim() ||
                  t("common.unnamed")}
              </span>
              <Button
                labelId="classes.removeFromRoster"
                variant="danger"
                onClick={() => run(() => api.removeEnrollment(e.class_id, student.id))}
              />
            </li>
          ))}
        </ul>
      )}
      {notIn.length > 0 && (
        /* Class names are the teacher's own text, so this select is a plain one
           rather than the translated `SelectField`. */
        <div className="row">
          <div className="field">
            <label htmlFor={joinId}>{t("students.addToClass")}</label>
            <select
              id={joinId}
              value={String(toJoin || notIn[0].id)}
              onChange={(e) => setToJoin(Number(e.target.value))}
            >
              {notIn.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name.trim() || t("common.unnamed")}
                </option>
              ))}
            </select>
          </div>
          <Button
            labelId="common.add"
            onClick={() =>
              run(() =>
                api.setEnrollment({
                  class_id: toJoin || notIn[0].id,
                  student_id: student.id,
                  roster_no: 0,
                  support: false,
                  note: "",
                }),
              )
            }
          />
        </div>
      )}
    </Panel>
  );
}

/**
 * The birthday calendar, derived from the students' birth dates — never
 * entered separately, so it cannot drift from the cards.
 */
function Birthdays({ planner }: { planner: Planner }) {
  const t = useTranslate();
  const withBirthdays = planner.students.filter((s) => isIsoDate(s.birth_date));
  const months = monthOrder(planner.school_year.year_model, planner.school_year.start_date);

  if (withBirthdays.length === 0) {
    return (
      <Panel headingId="birthdays.heading" introId="birthdays.intro">
        <p className="muted">{t("birthdays.none")}</p>
      </Panel>
    );
  }

  return (
    <Panel headingId="birthdays.heading" introId="birthdays.intro">
      <div className="columns months">
        {months.map((month) => {
          const inMonth = withBirthdays
            .filter((s) => monthOf(s.birth_date) === month)
            .sort((a, b) => dayOfMonth(a.birth_date) - dayOfMonth(b.birth_date));
          return (
            <div key={month} className="card">
              <h4>{t(monthLabel(month))}</h4>
              {inMonth.length === 0 ? (
                <p className="muted">{t("birthdays.emptyMonth")}</p>
              ) : (
                <ul className="plain">
                  {inMonth.map((s) => (
                    <li key={s.id}>
                      <span className="muted">{formatDate(s.birth_date).slice(0, 5)}</span>{" "}
                      {s.full_name.trim() || t("common.unnamed")}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
