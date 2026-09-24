/**
 * The 150-message bank: its structure, and the search the screen renders from.
 *
 * **The words are not here.** They are in `src/i18n/messagesEl.ts`, because
 * they are user-facing text like every other string in this app. What is here
 * is the shape — 15 categories of 10, their stable codes, and the rules for
 * finding one — and it carries no Greek at all, which is why M9 adds a language
 * file without touching this module.
 *
 * The codes are the source's own numbering (`c01`…`c15`, `m01`…`m10`), kept
 * because the teacher knows the bank by those numbers and because a stable code
 * is what this project stores and labels everywhere else.
 */
import { placeholdersIn } from "./placeholders";
import { foldForSearch } from "./search";
import type { StringId, Translate } from "../i18n";

/** The 15 categories, in the order the source's index page lists them. */
export const MESSAGE_CATEGORIES = [
  "c01",
  "c02",
  "c03",
  "c04",
  "c05",
  "c06",
  "c07",
  "c08",
  "c09",
  "c10",
  "c11",
  "c12",
  "c13",
  "c14",
  "c15",
] as const;

export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];

/** Ten per category, as the source's index page says in as many words. */
export const MESSAGES_PER_CATEGORY = 10;

/** One message's stable code — `c04.m07`, the seventh of the fourth category. */
export type MessageCode = string;

export function messageCodes(category: MessageCategory): MessageCode[] {
  return Array.from(
    { length: MESSAGES_PER_CATEGORY },
    (_, i) => `${category}.m${String(i + 1).padStart(2, "0")}`,
  );
}

/** Every message in the bank, category by category — 150 of them. */
export function allMessageCodes(): MessageCode[] {
  return MESSAGE_CATEGORIES.flatMap(messageCodes);
}

export const categoryTitleId = (c: MessageCategory): StringId =>
  `msgcat.${c}.title` as StringId;
export const categoryHintId = (c: MessageCategory): StringId => `msgcat.${c}.hint` as StringId;
export const messageTitleId = (code: MessageCode): StringId => `msg.${code}.title` as StringId;
export const messageBodyId = (code: MessageCode): StringId => `msg.${code}.body` as StringId;

/** The category a message code belongs to. */
export function categoryOf(code: MessageCode): MessageCategory {
  return code.slice(0, 3) as MessageCategory;
}

/**
 * One message, resolved into the current language.
 *
 * Built through `t` rather than read from a bundle directly, so the M9 language
 * switch reaches the message bank by the same route it reaches everything else.
 */
export interface BankMessage {
  code: MessageCode;
  category: MessageCategory;
  title: string;
  body: string;
  /** The `[ΑΓΚΥΛΕΣ]` this message asks the teacher to fill, in reading order. */
  placeholders: string[];
}

export function bankMessage(t: Translate, code: MessageCode): BankMessage {
  const body = t(messageBodyId(code));
  return {
    code,
    category: categoryOf(code),
    title: t(messageTitleId(code)),
    body,
    placeholders: placeholdersIn(body),
  };
}

/** The whole bank, resolved. 150 messages. */
export function messageBank(t: Translate): BankMessage[] {
  return allMessageCodes().map((code) => bankMessage(t, code));
}

/**
 * The accent- and case-folding rule, which lives in `search.ts` since M8 so
 * the staff directory searches by the same rule. Re-exported so nothing that
 * imported it from here has to change.
 */
export { foldForSearch };

/**
 * What the bank shows for a query and a category.
 *
 * **This is the one definition of "what is on screen"**, and the printed sheet
 * and the copy-to-clipboard read it too — the M4.5 rule that a sheet and its
 * screen call one selector rather than two that agree today.
 *
 * An empty query matches everything; a category of `""` means every category.
 * The match is over a message's title *and* its body, because a teacher
 * remembers a phrase from a message far more often than its title.
 */
export function searchMessages(
  t: Translate,
  query: string,
  category: MessageCategory | "",
): BankMessage[] {
  const needle = foldForSearch(query.trim());
  return messageBank(t).filter((m) => {
    if (category && m.category !== category) return false;
    if (!needle) return true;
    return foldForSearch(`${m.title} ${m.body}`).includes(needle);
  });
}
