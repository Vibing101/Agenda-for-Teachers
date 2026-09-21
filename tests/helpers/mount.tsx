/**
 * Test scaffolding for the individual screens.
 *
 * `renderScreen` gives a screen the two things the shell normally gives it —
 * the locale context and a `run` that replaces the planner with whatever the
 * backend returns — so a screen test exercises the same state flow the app
 * does, without mounting the whole shell.
 */
import { render } from "@testing-library/react";
import { useState, type ComponentType } from "react";
import { DEFAULT_LOCALE, translatorFor } from "../../src/i18n";
import { LocaleContext } from "../../src/i18n/useTranslate";
import type { Planner } from "../../src/domain/types";
import type { Run } from "../../src/screens/types";
import { createFakeBackend, type FakeBackend } from "./fakeBackend";

export interface ScreenProps {
  planner: Planner;
  run: Run;
}

/**
 * Anything a screen needs beyond the planner and `run` — in practice M3's
 * `today`, which the shell passes down so no screen reads the clock itself, and
 * the Today view's `onOpenPlan`.
 */
type Extra<P> = Omit<P, "planner" | "run">;

function Harness<P extends { planner: Planner }>({
  Screen,
  initial,
  extra,
}: {
  Screen: ComponentType<P>;
  initial: Planner;
  extra?: Extra<P>;
}) {
  const [planner, setPlanner] = useState(initial);
  const run: Run = async (call) => {
    const next = await call();
    setPlanner(next);
    return next;
  };
  // `run` is handed to every screen; one that does not declare it — the Today
  // view, which writes nothing — simply ignores it.
  const props = { planner, run, ...extra } as unknown as P;
  return <Screen {...props} />;
}

interface MockedInvoke {
  mockImplementation(fn: (command: string, args?: Record<string, unknown>) => unknown): void;
}

/**
 * Wires the mocked `invoke` to a fresh in-memory backend, renders the screen
 * against it, and hands the backend back so a test can assert on what actually
 * reached storage.
 */
export function renderScreen<P extends { planner: Planner }>(
  Screen: ComponentType<P>,
  planner: Planner,
  invoke: MockedInvoke,
  extra?: Extra<P>,
): FakeBackend {
  const backend = createFakeBackend(planner);
  invoke.mockImplementation((command, args) => {
    try {
      return Promise.resolve(backend.handle(command, args));
    } catch (e) {
      return Promise.reject(e);
    }
  });
  render(
    <LocaleContext.Provider value={{ locale: DEFAULT_LOCALE, t: translatorFor(DEFAULT_LOCALE) }}>
      <Harness Screen={Screen} initial={backend.planner} extra={extra} />
    </LocaleContext.Provider>,
  );
  return backend;
}
