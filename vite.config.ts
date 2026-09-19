// vitest's defineConfig is the vite one plus the `test` block.
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Tauri serves the built frontend from ../dist and expects a fixed dev port.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: { port: 1420, strictPort: true },
  build: { outDir: "dist", emptyOutDir: true, target: "es2022" },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
  },
});
