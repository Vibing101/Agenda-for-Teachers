import type { Planner } from "../domain/types";

/**
 * How a screen asks for a change to be written.
 *
 * Screens never call the backend directly: they hand the call to `run`, which
 * owns the two things every mutation shares — the block-and-reload path when
 * the data file changed underneath us, and replacing the UI's state with the
 * planner that was read back from disk afterwards.
 *
 * It hands that planner back, or `null` if the write did not happen (the disk
 * changed underneath us, or the call failed). A screen that has just created a
 * record needs it to find the row the backend assigned an id to, so it can
 * select it — see the "new record" buttons in the class and student screens.
 * Callers that only cause a write may ignore the result.
 */
export type Run = (call: () => Promise<Planner>) => Promise<Planner | null>;
