import { defineConfig } from "vitest/config";

export default defineConfig({
    base: process.env.VIEWER_BASE_PATH ?? "/figwig-viewer/",
    resolve: {
        // App's archive includes production JS, not its development source entry.
        conditions: ["browser", "module", "production"],
    },
    server: {
        host: "127.0.0.1",
        port: 5173,
        strictPort: true,
    },
    test: {
        include: ["src/**/*.test.ts"],
    },
});
