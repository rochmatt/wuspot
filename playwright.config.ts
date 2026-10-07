import { defineConfig, devices } from "@playwright/test";

// Uji mesin kompres di Chromium sungguhan. Browser sudah terpasang di
// PLAYWRIGHT_BROWSERS_PATH (jangan jalankan `playwright install`).
// Butuh fixture: `npm run fixtures`.

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

// Penanda satu kali `playwright test`. Worker baru (mis. setelah tes gagal)
// mewarisi env ini, jadi tabel ringkasan bisa digabung lintas worker.
process.env.WUSPOT_E2E_RUN ??= String(Date.now());

export default defineConfig({
  testDir: "tests/e2e",
  outputDir: "test-results",
  // Mesin memakai CPU penuh; satu worker supaya waktu yang dicatat masuk akal.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  // Fixture scan beberapa MB + tangga raster bisa makan waktu.
  timeout: 10 * 60_000,
  expect: { timeout: 30_000 },
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: `${BASE_URL}/uji-mesin`,
    reuseExistingServer: true,
    timeout: 5 * 60_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});
