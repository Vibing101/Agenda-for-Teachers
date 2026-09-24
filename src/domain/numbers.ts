/**
 * Typed numbers: reading one the way a Greek teacher types it, and writing one
 * back the way this app prints it.
 *
 * A Greek keyboard produces a decimal comma as readily as a dot, and a teacher
 * typing `12,50` means twelve and a half — so both are accepted on the way in.
 * On the way out the app always writes a **dot**, independent of the OS locale,
 * which is the rule every printed number in this app follows.
 *
 * M2's weight parser was the first to need this; since M8 it is built on
 * [`parseDecimal`] too, so there is one reading of "a number she typed".
 */

/**
 * A typed non-negative number, three ways:
 *
 * * `null` — blank. **Not zero**: nothing was entered.
 * * a number — `12`, `12.5` or `12,5`.
 * * `undefined` — not a single non-negative number (a letter, a sign, a range,
 *   two separators). The caller refuses to save it rather than guess.
 *
 * Keeping blank and invalid apart matters because they mean opposite things:
 * blank is "not yet", invalid is "you mistyped".
 */
export function parseDecimal(value: string): number | null | undefined {
  const trimmed = value.trim().replace(",", ".");
  if (trimmed === "") return null;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

/** `1.5`, `3` — up to two decimals, trailing zeros trimmed, always a dot. */
export function formatDecimal(value: number): string {
  return String(Number(value.toFixed(2)));
}

/** `12.50` — an amount of money, always two decimals and a dot. */
export function formatMoney(value: number): string {
  return value.toFixed(2);
}

/**
 * Adds amounts in hundredths, so `0.1 + 0.2` is `0.3` and a year of course
 * fees does not drift by a cent.
 */
export function sumHundredths(values: number[]): number {
  return values.reduce((total, v) => total + Math.round(v * 100), 0) / 100;
}
