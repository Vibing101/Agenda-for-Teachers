/**
 * What the bilingual tests look at: the page as a reader meets it, an exported
 * document's visible text, and the Greek left in either once the teacher's own
 * words are set aside.
 *
 * Shared since M10, when the shipped state (English interface, Greek content)
 * got a test file of its own beside M9's `Bilingual.test.tsx`.
 */
import type { Planner } from "../../src/domain/types";

export const GREEK = /[Ͱ-Ͽἀ-῿]/;
export const GREEK_RUN = /[Ͱ-Ͽἀ-῿][Ͱ-Ͽἀ-῿\s.,·]*/g;

/** Every string the teacher (or the fixture, for her) put in the file. */
export function teacherStrings(planner: Planner): string[] {
  const out = new Set<string>();
  const walk = (v: unknown) => {
    if (typeof v === "string") {
      if (v.trim()) out.add(v.trim());
      for (const line of v.split("\n")) if (line.trim()) out.add(line.trim());
    } else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(planner);
  // The fake backend's folder path is the teacher's folder name, not a label.
  out.add("/Drive/Ημερολόγιο/data/planner.sqlite");
  out.add("/Drive/Ημερολόγιο");
  // The toggle names Greek in Greek, on purpose.
  out.add("Ελληνικά");
  return [...out].sort((a, b) => b.length - a.length);
}

/** Every Greek run left in a piece of text once the teacher's words are removed. */
export function greekLeftIn(text: string, allowed: string[]): string[] {
  let rest = text;
  for (const a of allowed) rest = rest.split(a).join(" ");
  return [...rest.matchAll(GREEK_RUN)].map((m) => m[0].trim()).filter(Boolean);
}

/** The whole visible page as text: text nodes, form values, and the attributes a reader hears. */
export function pageText(): string {
  const parts = [document.body.textContent ?? ""];
  for (const el of document.body.querySelectorAll("*")) {
    for (const attr of ["aria-label", "placeholder", "title", "alt"]) {
      const v = el.getAttribute(attr);
      if (v) parts.push(v);
    }
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) parts.push(el.value);
  }
  return parts.join("\n");
}

/** The visible text of an exported document's HTML. */
export function htmlText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

