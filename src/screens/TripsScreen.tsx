/**
 * Εκδρομές και επισκέψεις — trips and events, with per-student consent.
 *
 * The source's register has columns `Ημερομηνία | Στόχος / Δραστηριότητα |
 * Τάξη | Υπεύθυνος | Μεταφορά | Έξοδο | Συγκαταθέσεις` over `ΛΙΣΤΑ ΕΛΕΓΧΟΥ`
 * and `ΣΗΜΕΙΩΣΕΙΣ ΚΑΙ ΑΞΙΟΛΟΓΗΣΗ`, both of which are per trip here rather than
 * per page: one box cannot serve a year of visits.
 *
 * **`Συγκαταθέσεις` is counted, not typed.** The cell shows
 * `consentTally`'s figures over the class's roster, so it cannot disagree with
 * the list the teacher ticked below it. The list itself is read from the
 * enrollment, so a student added to the class appears in it with nothing
 * recorded.
 *
 * **There is no consent letter here.** M5 already ships *Συγκατάθεση για
 * επίσκεψη / εκδρομή* as one of the seven parent letters, and it stores nothing
 * for a filled letter by a decision of its own. This screen points at it rather
 * than wiring a trip into it, which would change that decision — raised in the
 * release note instead.
 */
import { useState } from "react";
import { api } from "../api";
import { Button, DeferredTextField, Panel, TextArea } from "../components/Fields";
import {
  allTrips,
  consentFor,
  consentTally,
  emptyTrip,
  tripRoster,
  type Trip,
} from "../domain/trips";
import type { Planner, Student } from "../domain/types";
import { CONSENT_STATES, consentStateLabel } from "../i18n/vocabularies";
import { useTranslate } from "../i18n/useTranslate";
import type { Run } from "./types";

export default function TripsScreen({ planner, run }: { planner: Planner; run: Run }) {
  const t = useTranslate();
  const trips = allTrips(planner);

  return (
    <Panel
      headingId="trips.heading"
      introId="trips.intro"
      actions={
        <Button
          labelId="trips.new"
          variant="primary"
          onClick={() => run(() => api.saveTrip(emptyTrip(planner.classes[0]?.id ?? null)))}
        />
      }
    >
      <p className="hint">{t("trips.letterHint")}</p>
      {trips.length === 0 ? (
        <p className="muted">{t("trips.none")}</p>
      ) : (
        <>
          <p className="muted">{t("trips.count", { n: trips.length })}</p>
          <ul className="rows">
            {trips.map((trip, index) => (
              <TripCard
                key={trip.id}
                trip={trip}
                index={index + 1}
                planner={planner}
                run={run}
              />
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function TripCard({
  trip,
  index,
  planner,
  run,
}: {
  trip: Trip;
  index: number;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  // Every patch carries this trip's own id, so one card can never write another.
  const save = (patch: Partial<Trip>) => run(() => api.saveTrip({ ...trip, ...patch }));
  const tally = consentTally(planner, trip);
  const roster = tripRoster(planner, trip);

  return (
    <li>
      <section className="card" aria-label={t("trips.entry", { n: index })}>
        <div className="panel-head">
          <h3>{t("trips.entry", { n: index })}</h3>
          <Button
            labelId="trips.remove"
            variant="danger"
            onClick={() => run(() => api.deleteTrip(trip.id))}
          />
        </div>

        <div className="row wrap">
          <DeferredTextField
            labelId="common.date"
            type="date"
            value={trip.date}
            onCommit={(date) => save({ date })}
          />
          <DeferredTextField
            labelId="trips.activity"
            value={trip.activity}
            onCommit={(activity) => save({ activity })}
          />
          <label className="field">
            <span>{t("trips.class")}</span>
            <select
              value={String(trip.class_id ?? 0)}
              onChange={(e) => {
                const id = Number(e.target.value);
                save({ class_id: id === 0 ? null : id });
              }}
            >
              <option value="0">{t("trips.noClass")}</option>
              {planner.classes.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name.trim() || t("common.unnamed")}
                </option>
              ))}
            </select>
          </label>
          <DeferredTextField
            labelId="trips.responsible"
            value={trip.responsible}
            onCommit={(responsible) => save({ responsible })}
          />
          <DeferredTextField
            labelId="trips.transport"
            value={trip.transport}
            onCommit={(transport) => save({ transport })}
          />
          <DeferredTextField
            labelId="trips.cost"
            value={trip.cost}
            onCommit={(cost) => save({ cost })}
          />
          {/* Counted from the list below, never entered. */}
          <div className="field">
            <span>{t("trips.consents")}</span>
            <p>
              <strong>{t("trips.consentTally", { given: tally.given, total: tally.total })}</strong>
              {tally.refused > 0 && (
                <>
                  {" · "}
                  <span className="muted">{t("trips.consentRefused", { n: tally.refused })}</span>
                </>
              )}
              {tally.pending > 0 && (
                <>
                  {" · "}
                  <span className="muted">{t("trips.consentPending", { n: tally.pending })}</span>
                </>
              )}
            </p>
            <p className="hint">{t("trips.consentCounted")}</p>
          </div>
        </div>

        <TripArea
          labelId="trips.checklist"
          value={trip.checklist}
          onSave={(checklist) => save({ checklist })}
        />
        <TripArea
          labelId="trips.evaluation"
          value={trip.evaluation}
          onSave={(evaluation) => save({ evaluation })}
        />

        <h4>{t("trips.consentList")}</h4>
        {trip.class_id === null ? (
          <p className="muted">{t("trips.consentNoClass")}</p>
        ) : roster.length === 0 ? (
          <p className="muted">{t("trips.consentNoRoster")}</p>
        ) : (
          <ul className="rows">
            {roster.map((student) => (
              <ConsentRow
                key={student.id}
                trip={trip}
                student={student}
                planner={planner}
                run={run}
              />
            ))}
          </ul>
        )}
      </section>
    </li>
  );
}

function ConsentRow({
  trip,
  student,
  planner,
  run,
}: {
  trip: Trip;
  student: Student;
  planner: Planner;
  run: Run;
}) {
  const t = useTranslate();
  const consent = consentFor(planner, trip.id, student.id);
  // Keyed by `(trip, student)`: the screen knows both halves before it writes,
  // so there is no generated id and no selection to get wrong.
  const set = (patch: Partial<typeof consent>) =>
    run(() => api.setTripConsent({ ...consent, ...patch }));

  return (
    <li>
      <div className="row wrap">
        <span>{student.full_name.trim() || t("common.unnamed")}</span>
        <label className="field">
          <span>{t("trips.consentState")}</span>
          <select
            value={consent.state}
            onChange={(e) => set({ state: e.target.value as typeof consent.state })}
          >
            {/* The blank is not a third code — picking it removes the row. */}
            <option value="">{t("trips.consentNone")}</option>
            {CONSENT_STATES.map((code) => (
              <option key={code} value={code}>
                {t(consentStateLabel(code))}
              </option>
            ))}
          </select>
        </label>
        <DeferredTextField
          labelId="trips.consentNote"
          value={consent.note}
          onCommit={(note) => set({ note })}
        />
      </div>
    </li>
  );
}

/** A multi-line trip field that commits on blur, like every other in the app. */
function TripArea({
  labelId,
  value,
  onSave,
}: {
  labelId: Parameters<typeof TextArea>[0]["labelId"];
  value: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [lastStored, setLastStored] = useState(value);
  if (value !== lastStored) {
    setLastStored(value);
    setDraft(value);
  }
  return (
    <div
      onBlur={() => {
        if (draft !== value) onSave(draft);
      }}
    >
      <TextArea labelId={labelId} value={draft} onChange={setDraft} />
    </div>
  );
}
