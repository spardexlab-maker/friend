import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  webServer: [
    {
      command: "npm run dev",
      url: "http://localhost:5173",
      reuseExistingServer: true,
    },
    {
      command: "npm run api:start",
      url: "http://127.0.0.1:8787/api/status",
      reuseExistingServer: true,
    },
  ],
  use: {
    baseURL: "http://localhost:5173",
    browserName: "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 1100 },
    launchOptions: { channel: "msedge" },
  },
});
