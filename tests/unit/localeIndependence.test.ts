/**
 * **Dates and numbers do not change with the language** — the spec's Resolved
 * "Date and time formatting" (`dd.MM.yyyy`, formatted by the app) and M8's
 * number rule (a dot, never a comma), which M9 was told not to switch to a
 * locale format for English.
 *
 * Each formatter is called with the interface in each language and the
 * browser claiming each locale in turn, and must give the same string every
 * time. A formatter that reached for `toLocale…` or `Intl` would give
 * `09/11/2026`, `1,250.00` or `13,2` somewhere in that grid.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate } from "../../src/domain/dates";
import { formatAverage } from "../../src/domain/grades";
import { formatDecimal, formatMoney } from "../../src/domain/numbers";

const SETTINGS: [string, string][] = [
  ["el", "el-GR"],
  ["el", "en-US"],
  ["en", "en-US"],
  ["en", "el-GR"],
  ["en", "de-DE"],
];

afterEach(() => {
  vi.restoreAllMocks();
  document.documentElement.lang = "el";
});

describe("dates and numbers, in every language and on every OS locale", () => {
  for (const [ui, os] of SETTINGS) {
    it(`are the app's own formats — interface ${ui}, OS ${os}`, () => {
      document.documentElement.lang = ui;
      vi.spyOn(window.navigator, "language", "get").mockReturnValue(os);
      vi.spyOn(window.navigator, "languages", "get").mockReturnValue([os]);

      expect(formatDate("2026-11-09")).toBe("09.11.2026");
      expect(formatAverage(13.25)).toBe("13.25");
      expect(formatAverage(1234.5)).toBe("1234.5");
      expect(formatDecimal(1.5)).toBe("1.5");
      expect(formatMoney(1250)).toBe("1250.00");
      expect(formatMoney(12.5)).toBe("12.50");
    });
  }
});
