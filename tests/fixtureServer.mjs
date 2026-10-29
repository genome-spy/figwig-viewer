import { createServer } from "node:http";
import { readFile } from "node:fs/promises";

const fixtures = new Map(
    await Promise.all(
        ["signed.fw", "replacement.fw"].map(async (name) => [
            name,
            await readFile(new URL("./fixtures/" + name, import.meta.url)),
        ]),
    ),
);

/** @type {{path: string, range: string | null}[]} */
const requests = [];
const port = Number(process.env.FIXTURE_PORT ?? 4174);
const server = createServer((request, response) => {
    const pathname = new URL(request.url, "http://127.0.0.1").pathname;
    requests.push({ path: pathname, range: request.headers.range ?? null });

    if (pathname !== "/no-cors.fw") {
        response.setHeader("Access-Control-Allow-Origin", "*");
        response.setHeader(
            "Access-Control-Expose-Headers",
            "Content-Range, Content-Length",
        );
    }
    if (pathname === "/health") {
        response.end("ready");
        return;
    } else if (pathname === "/requests") {
        response.setHeader("Content-Type", "application/json");
        response.end(JSON.stringify(requests));
        return;
    }

    const filePaths = new Set([
        "/signed.fw",
        "/replacement.fw",
        "/ignore-range.fw",
        "/stalled.fw",
        "/header-stall.fw",
        "/invalid.fw",
        "/no-cors.fw",
    ]);
    if (!filePaths.has(pathname)) {
        response.writeHead(404);
        response.end("Not found");
        return;
    }

    // A controllable stalled endpoint protects the opening cancellation boundary.
    if (
        pathname === "/stalled.fw" ||
        (pathname === "/header-stall.fw" &&
            request.headers.range !== "bytes=0-0")
    ) {
        return;
    }

    const name =
        pathname === "/replacement.fw" ? "replacement.fw" : "signed.fw";
    const bytes =
        pathname === "/invalid.fw"
            ? Buffer.from("not a Figwig file")
            : fixtures.get(name);
    const range =
        pathname === "/ignore-range.fw" ? undefined : request.headers.range;
    response.setHeader("Content-Type", "application/octet-stream");
    response.setHeader("Accept-Ranges", "bytes");

    if (range) {
        const match = /^bytes=(\d+)-(\d*)$/.exec(range);
        const start = match ? Number(match[1]) : bytes.length;
        const end =
            match && match[2]
                ? Math.min(Number(match[2]), bytes.length - 1)
                : bytes.length - 1;
        if (!match || start >= bytes.length || end < start) {
            response.writeHead(416, {
                "Content-Range": "bytes */" + bytes.length,
            });
            response.end();
            return;
        }
        response.writeHead(206, {
            "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
            "Content-Length": end - start + 1,
        });
        response.end(
            request.method === "HEAD"
                ? undefined
                : bytes.subarray(start, end + 1),
        );
    } else {
        response.writeHead(200, { "Content-Length": bytes.length });
        response.end(request.method === "HEAD" ? undefined : bytes);
    }
});
server.listen(port, "127.0.0.1", () => {
    console.log(`Figwig fixture server listening at http://127.0.0.1:${port}`);
});
for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
        server.closeAllConnections();
        server.close();
    });
}
