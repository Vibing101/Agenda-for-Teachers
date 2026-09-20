import { useState, type Dispatch, type SetStateAction } from "react";

/**
 * An editable draft of a stored record, kept in step with what is on disk.
 *
 * Every mutation returns the whole planner, so props arrive as brand-new
 * objects constantly — including when the teacher changed something else
 * entirely. Syncing a form from prop *identity* would therefore wipe a
 * half-typed class name the moment a student was added to that class's roster.
 *
 * Comparing by *value* instead gives both halves of what is wanted:
 *
 * * an unrelated change leaves the draft alone, because the stored record it
 *   came from did not actually change, and
 * * a real change to this record — our own save, or a reload from disk after
 *   the changed-on-disk block — does replace what is on screen, which is what
 *   makes the reload path honest.
 *
 * The comparison is a JSON round-trip: these are small records that both sides
 * build from the same serialiser, so key order is stable.
 */
export function useStoredDraft<T>(stored: T): [T, Dispatch<SetStateAction<T>>] {
  const [draft, setDraft] = useState(stored);
  const [lastStored, setLastStored] = useState(stored);

  // Adjusting state during render, rather than in an effect: React re-renders
  // immediately with the new value instead of briefly painting the stale one.
  if (JSON.stringify(stored) !== JSON.stringify(lastStored)) {
    setLastStored(stored);
    setDraft(stored);
  }

  return [draft, setDraft];
}
