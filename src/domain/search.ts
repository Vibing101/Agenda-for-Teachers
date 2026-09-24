/**
 * The one definition of "these two strings match" for every search box in the
 * app — M5's message bank, and since M8 the staff directory.
 *
 * Moved here from `messages.ts` at M8 rather than copied, so there is one
 * folding rule and not two that agree today.
 */

/**
 * Folds accents and case so a search for "απουσιες" finds "Απουσίες".
 *
 * A Greek teacher typing quickly does not reach for the accent key, and a
 * search that only matched the accented form would look broken. `NFD` splits a
 * letter from its diacritic so the diacritic can be dropped.
 *
 * **Final sigma needs the round trip through upper case.** It is a distinct
 * letter rather than an accent, so `toLowerCase` leaves it alone and a search
 * for a word ending in one would not match the same word mid-sentence. Upper
 * case has no final form, so uppercasing and lowercasing again folds the two
 * sigmas together — and, unlike replacing one with the other, it needs no Greek
 * character in this file, which is a rule this project enforces at the build.
 */
export function foldForSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .toLowerCase();
}

/**
 * Whether `query` matches any of `haystack`, folded. An empty query matches
 * everything, so a search box that has been cleared hides nothing.
 */
export function matchesSearch(query: string, ...haystack: string[]): boolean {
  const needle = foldForSearch(query.trim());
  if (!needle) return true;
  return foldForSearch(haystack.join(" ")).includes(needle);
}
