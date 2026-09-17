import {
  defineConfig,
  devices,
} from "@playwright/test";


const baseURL =
  "http://127.0.0.1:3100";


export default defineConfig({
  testDir: "./e2e",

  fullyParallel: false,

  forbidOnly:
    Boolean(process.env.CI),

  retries:
    process.env.CI
      ? 2
      : 0,

  workers: 1,

  reporter:
    process.env.CI
      ? [
          ["line"],
          [
            "html",
            {
              open: "never",
            },
          ],
        ]
      : "list",

  use: {
    baseURL,

    trace:
      "retain-on-failure",

    screenshot:
      "only-on-failure",

    video:
      "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: {
        ...devices[
          "Desktop Chrome"
        ],
      },
    },
  ],

  webServer: {
    command:
      "npm run dev -- --hostname 127.0.0.1 --port 3100",

    url:
      baseURL,

    reuseExistingServer:
      !process.env.CI,

    timeout:
      120_000,

    env: {
      NEXT_TELEMETRY_DISABLED:
        "1",

      NEXT_PUBLIC_SUPABASE_URL:
        "https://adresse-gn-e2e.invalid",

      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        "e2e-public-placeholder-key",

      NEXT_PUBLIC_API_URL:
        "http://127.0.0.1:3999",
    },
  },
});
