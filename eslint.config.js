import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

/**
 * Greek characters: the basic block plus Extended, which covers polytonic and
 * the precomposed accented forms that turn up in real Greek text.
 */
const GREEK = String.raw`[Ͱ-Ͽἀ-῿]`;
const NO_GREEK =
  "User-facing text belongs in src/i18n/el.ts, keyed by a string id, so that adding English at M9 is one new file rather than an edit to every screen.";

export default tseslint.config(
  { ignores: ["dist", "src-tauri/target", "node_modules"] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules },
  },
  {
    // The rule that keeps the single-lookup promise honest: no Greek literal
    // may appear in application code outside the language files. Tests are
    // exempt — they assert against rendered Greek on purpose.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/i18n/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: `JSXText[value=/${GREEK}/]`, message: NO_GREEK },
        { selector: `Literal[value=/${GREEK}/]`, message: NO_GREEK },
        { selector: `TemplateElement[value.raw=/${GREEK}/]`, message: NO_GREEK },
      ],
    },
  },
);
