/**
 * React access to the string lookup.
 *
 * Kept as a hook over a context so that switching the language at M9 re-renders
 * every screen on its own, without any screen knowing a language exists.
 */
import { createContext, useContext } from "react";
import { DEFAULT_LOCALE, translatorFor, type Locale, type Translate } from "./index";

export interface LocaleValue {
  locale: Locale;
  t: Translate;
}

export const LocaleContext = createContext<LocaleValue>({
  locale: DEFAULT_LOCALE,
  t: translatorFor(DEFAULT_LOCALE),
});

export function useTranslate(): Translate {
  return useContext(LocaleContext).t;
}
