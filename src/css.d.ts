/**
 * The app's stylesheet is imported for its side effect — Vite turns it into a
 * `<link>` — and `main.tsx` imports it dynamically so the hidden print window
 * never loads it. TypeScript needs telling that a `.css` import is a module.
 */
declare module "*.css";
