/**
 * The one sentence that says why a screen's letters, messages or suggested
 * text are Greek in the English interface (M10).
 *
 * The English content is an unreviewed draft, and until it is reviewed the
 * content stays Greek (`i18n/contentReview.ts`). A teacher who switched to
 * English and found Greek letters would otherwise reasonably think the switch
 * had failed. Renders nothing whenever the content is in the interface's own
 * language — in Greek always, and in English once the content is reviewed.
 */
import { useContentHeldBack, useTranslate } from "../i18n/useTranslate";

export function ContentLanguageNote() {
  const t = useTranslate();
  if (!useContentHeldBack()) return null;
  return <p className="note">{t("content.greekOnly")}</p>;
}
