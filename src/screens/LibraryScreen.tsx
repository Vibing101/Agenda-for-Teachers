/**
 * Σχολικά βιβλία και υλικά, and Υλικά και πηγές — the module's two reference
 * lists, on one sub-page because they are the two surfaces here that hang off
 * no class and no week.
 *
 * A textbook belongs to a *subject*, and the same book serves every class that
 * is taught it; a resource belongs to one of the source page's six categories.
 * Both are flat lists the teacher maintains, closer to M1's holidays than to a
 * lesson plan — so neither carries a date and neither moves when the school
 * year's start date is corrected.
 *
 * **The six categories are the source page's own captions**, not the rebuild
 * spec's own/school/shared/borrowed list. See `domain/resources.ts`; it is
 * raised in the release note rather than settled quietly.
 *
 * Rows are edited in place, so neither "new" button has a selection to move.
 */
import { api } from "../api";
import { Button, DeferredTextField, Panel } from "../components/Fields";
import {
  allTextbooks,
  emptyResource,
  emptyTextbook,
  resourcesIn,
  type Resource,
  type Textbook,
} from "../domain/resources";
import type { Planner } from "../domain/types";
import { RESOURCE_CATEGORIES, resourceCategoryLabel } from "../i18n/vocabularies";
import { countOf } from "../i18n";
import { useTranslate } from "../i18n/useTranslate";
import type { Run } from "./types";

export default function LibraryScreen({ planner, run }: { planner: Planner; run: Run }) {
  const t = useTranslate();
  const books = allTextbooks(planner);

  return (
    <>
      <Panel
        headingId="books.heading"
        introId="books.intro"
        actions={
          <Button
            labelId="books.new"
            variant="primary"
            onClick={() => run(() => api.saveTextbook(emptyTextbook()))}
          />
        }
      >
        {books.length === 0 ? (
          <p className="muted">{t("books.none")}</p>
        ) : (
          <>
            <p className="muted">{countOf(t, "books.count", books.length)}</p>
            <ul className="rows">
              {books.map((book, index) => (
                <TextbookRow key={book.id} book={book} index={index + 1} run={run} />
              ))}
            </ul>
          </>
        )}
      </Panel>

      <Panel headingId="resources.heading" introId="resources.intro">
        {RESOURCE_CATEGORIES.map((category) => {
          const entries = resourcesIn(planner, category);
          return (
            <section key={category} className="card">
              <div className="panel-head">
                <h3>{t(resourceCategoryLabel(category))}</h3>
                <Button
                  labelId="resources.new"
                  onClick={() => run(() => api.saveResource(emptyResource(category)))}
                />
              </div>
              {entries.length === 0 ? (
                <p className="muted">{t("resources.none")}</p>
              ) : (
                <ul className="rows">
                  {entries.map((resource, index) => (
                    <ResourceRow
                      key={resource.id}
                      resource={resource}
                      label={t("resources.entry", {
                        category: t(resourceCategoryLabel(category)),
                        n: index + 1,
                      })}
                      run={run}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </Panel>
    </>
  );
}

function TextbookRow({ book, index, run }: { book: Textbook; index: number; run: Run }) {
  const t = useTranslate();
  // Every patch carries this row's own id, so one book can never write another.
  const save = (patch: Partial<Textbook>) => run(() => api.saveTextbook({ ...book, ...patch }));

  return (
    <li>
      <div className="row wrap" role="group" aria-label={t("books.entry", { n: index })}>
        <DeferredTextField
          labelId="books.subject"
          value={book.subject}
          onCommit={(subject) => save({ subject })}
        />
        <DeferredTextField
          labelId="books.title"
          value={book.title}
          onCommit={(title) => save({ title })}
        />
        <DeferredTextField
          labelId="books.publisher"
          value={book.publisher}
          onCommit={(publisher) => save({ publisher })}
        />
        <DeferredTextField
          labelId="books.isbn"
          value={book.isbn}
          onCommit={(isbn) => save({ isbn })}
        />
        <DeferredTextField
          labelId="books.level"
          value={book.level}
          onCommit={(level) => save({ level })}
        />
        {/* Free text: a teacher writes "δωρεάν" here as readily as a number. */}
        <DeferredTextField
          labelId="books.price"
          value={book.price}
          onCommit={(price) => save({ price })}
        />
        <DeferredTextField
          labelId="books.status"
          value={book.status}
          onCommit={(status) => save({ status })}
        />
        <DeferredTextField
          labelId="books.remarks"
          value={book.remarks}
          onCommit={(remarks) => save({ remarks })}
        />
        <Button
          labelId="books.remove"
          variant="danger"
          onClick={() => run(() => api.deleteTextbook(book.id))}
        />
      </div>
    </li>
  );
}

function ResourceRow({
  resource,
  label,
  run,
}: {
  resource: Resource;
  label: string;
  run: Run;
}) {
  const save = (patch: Partial<Resource>) =>
    run(() => api.saveResource({ ...resource, ...patch }));

  return (
    <li>
      <div className="row wrap" role="group" aria-label={label}>
        <DeferredTextField
          labelId="resources.title"
          value={resource.title}
          onCommit={(title) => save({ title })}
        />
        <DeferredTextField
          labelId="resources.detail"
          value={resource.detail}
          onCommit={(detail) => save({ detail })}
        />
        <DeferredTextField
          labelId="resources.notes"
          value={resource.notes}
          onCommit={(notes) => save({ notes })}
        />
        <Button
          labelId="resources.remove"
          variant="danger"
          onClick={() => run(() => api.deleteResource(resource.id))}
        />
      </div>
    </li>
  );
}
