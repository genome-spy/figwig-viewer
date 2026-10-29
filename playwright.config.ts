import { defineConfig, devices } from "@playwright/test";

const browsers = process.env.ALL_BROWSERS
    ? (["chromium", "firefox", "webkit"] as const)
    : (["chromium"] as const);

export default defineConfig({
    testDir: "./tests",
    timeout: 30_000,
    expect: { timeout: 10_000 },
    fullyParallel: false,
    retries: 0,
    reporter: "list",
    use: {
        baseURL: "http://127.0.0.1:4173/figwig-viewer/",
        viewport: { width: 1200, height: 800 },
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    projects: browsers.map((name) => ({
        name,
        use: {
            ...devices[
                name === "chromium"
                    ? "Desktop Chrome"
                    : name === "firefox"
                      ? "Desktop Firefox"
                      : "Desktop Safari"
            ],
        },
    })),
    webServer: [
        {
            command: "npm run preview",
            url: "http://127.0.0.1:4173/figwig-viewer/",
            reuseExistingServer: !process.env.CI,
        },
        {
            command: "npm run dev",
            url: "http://127.0.0.1:5173/figwig-viewer/",
            reuseExistingServer: !process.env.CI,
        },
        {
            command: "node tests/fixtureServer.mjs",
            url: "http://127.0.0.1:4174/health",
            reuseExistingServer: !process.env.CI,
        },
    ],
});
