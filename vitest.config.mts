import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Unit test untuk modul murni (dan modul pdf-lib yang jalan di Node).
// Uji di browser sungguhan ada di tests/e2e (Playwright).
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/__tests__/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
