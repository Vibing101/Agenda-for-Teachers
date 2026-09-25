/**
 * React access to the string lookup.
 *
 * Kept as a hook over a context so that switching the language at M9 re-renders
 * every screen on its own, without any screen knowing a language exists.
 */
import { createContext, useContext } from "react";
import {
  contentLocale,
  DEFAULT_LOCALE,
  translatorFor,
  type Locale,
  type Translate,
} from "./index";

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

/**
 * The translator for a document made of the product's content — a letter, a
 * message (M10). In the English interface it is Greek until the English content
 * has been reviewed, so the whole document, footer and file name included, is
 * in one language. Screens keep `useTranslate()` for their own labels.
 */
export function useContentTranslate(): Translate {
  const { locale } = useContext(LocaleContext);
  return translatorFor(contentLocale(locale));
}

/**
 * True when the interface is in a language whose content is not being shown —
 * English, while unreviewed — so a screen can say why its letters are Greek.
 */
export function useContentHeldBack(): boolean {
  const { locale } = useContext(LocaleContext);
  return contentLocale(locale) !== locale;
}
