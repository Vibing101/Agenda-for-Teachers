/**
 * What runs in the hidden window a PDF is rendered from.
 *
 * The flow, end to end: a screen calls `export_pdf` with the document it
 * built → Rust opens this window on the app's own page with `?print=1` → this
 * asks for the document, puts it on the page, waits for it to be laid out and
 * for its fonts to be ready, and calls `print_ready` → Rust drives the
 * platform's print-to-PDF and closes the window.
 *
 * **Waiting for `document.fonts.ready` is the part that matters for Greek.**
 * Capturing the page before the chosen face has loaded is how a PDF ends up
 * rendered in a fallback font — the classic way Greek turns into tofu or
 * silently loses its diacritics. Telling Rust "ready" only after the font
 * promise resolves removes the race rather than sleeping and hoping.
 */
import { useEffect, useRef, useState } from "react";
import { api, isAppError } from "../api";
import { paginate } from "./paginate";

export default function PrintHost() {
  const surface = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  /** A print is one-shot: never report ready twice for one document. */
  const reported = useRef(false);

  useEffect(() => {
    void (async () => {
      try {
        setHtml(await api.printJob());
      } catch {
        setFailed(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (html === null || reported.current) return;
    reported.current = true;
    void (async () => {
      try {
        // A timer, not `requestAnimationFrame`: this window is deliberately
        // hidden, and a hidden window's animation frames never run — which
        // would leave the export waiting forever for a frame that is not
        // coming. A macrotask is enough to let the render commit and the
        // layout settle.
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
        // Before measuring anything: a row's height depends on the face it is
        // drawn in, and measuring against a fallback font would put the page
        // breaks in the wrong places as well as risking Greek being captured
        // in a face that has none of it.
        await document.fonts.ready;
        const { pages } = surface.current
          ? paginate(surface.current)
          : { pages: 0 };
        await api.printReady(pages);
      } catch (e) {
        // The window is about to be closed by the Rust side either way; the
        // teacher hears about it through the export that is waiting.
        if (!isAppError(e)) throw e;
      }
    })();
  }, [html]);

  if (failed) return null;
  return <div ref={surface} dangerouslySetInnerHTML={{ __html: html ?? "" }} />;
}
