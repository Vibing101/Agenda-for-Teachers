/**
 * Επαφές στο σχολείο — the staff directory, as a sub-page of Έτος, where the
 * source's own ΕΤΟΣ index files it ("Άνθρωποι στο σχολείο · Διεύθυνση,
 * γραμματεία και συνάδελφοι") and where the spec's module 1 puts it.
 *
 * Rows are edited in place, so `Νέα επαφή` has no selection to move. It clears
 * the search first, so the blank row it makes cannot be hidden by a query it
 * does not match.
 */
import { useId, useMemo, useState } from "react";
import { api } from "../api";
import { Button, DeferredTextField, Panel } from "../components/Fields";
import {
  allStaffContacts,
  emptyStaffContact,
  searchStaff,
  type StaffContact,
} from "../domain/staff";
import type { Planner } from "../domain/types";
import { countOf } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import type { Run } from "./types";

export default function StaffScreen({ planner, run }: { planner: Planner; run: Run }) {
  const t = useTranslate();
  const [query, setQuery] = useState("");
  const searchId = useId();
  const all = allStaffContacts(planner);
  /** The rows on screen, through the one selector that defines them. */
  const shown = useMemo(() => searchStaff(planner, query), [planner, query]);
  /** A row keeps its number in the whole list, whatever the search hides. */
  const numberOf = (c: StaffContact) => all.findIndex((x) => x.id === c.id) + 1;

  return (
    <Panel
      headingId="staff.heading"
      introId="staff.intro"
      actions={
        <Button
          labelId="staff.new"
          variant="primary"
          onClick={() => {
            setQuery("");
            void run(() => api.saveStaffContact(emptyStaffContact()));
          }}
        />
      }
    >
      <div className="field">
        <label htmlFor={searchId}>{t("staff.search")}</label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="hint">{t("staff.searchHint")}</p>
      </div>

      {all.length === 0 ? (
        <p className="muted">{t("staff.none")}</p>
      ) : shown.length === 0 ? (
        <p className="muted">{t("staff.noMatches")}</p>
      ) : (
        <>
          <p className="muted">
            {shown.length === all.length
              ? countOf(t, "staff.count", all.length)
              : countOf(t, "staff.countFiltered", all.length, { shown: shown.length })}
          </p>
          <ul className="rows">
            {shown.map((contact) => (
              <StaffRow key={contact.id} contact={contact} index={numberOf(contact)} run={run} />
            ))}
          </ul>
        </>
      )}
      <p className="note">{t("staff.notLinked")}</p>
    </Panel>
  );
}

function StaffRow({ contact, index, run }: { contact: StaffContact; index: number; run: Run }) {
  const t = useTranslate();
  // Every patch carries this row's own id, so one contact can never write another.
  const save = (patch: Partial<StaffContact>) =>
    run(() => api.saveStaffContact({ ...contact, ...patch }));
  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("staff.entry", { n: index })}>
        <DeferredTextField
          labelId="staff.name"
          value={contact.full_name}
          onCommit={(full_name) => save({ full_name })}
        />
        <DeferredTextField labelId="staff.role" value={contact.role} onCommit={(role) => save({ role })} />
        <DeferredTextField labelId="staff.phone" value={contact.phone} onCommit={(phone) => save({ phone })} />
        <DeferredTextField labelId="staff.email" value={contact.email} onCommit={(email) => save({ email })} />
        <Button
          labelId="staff.remove"
          variant="danger"
          onClick={() => run(() => api.deleteStaffContact(contact.id))}
        />
      </div>
    </li>
  );
}
