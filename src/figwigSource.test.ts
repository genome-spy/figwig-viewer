import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { inspectFigwigSource } from "./figwigSource";

afterEach(() => {
    vi.unstubAllGlobals();
});

async function fixtureFile(): Promise<File> {
    const bytes = await readFile(
        new URL("../tests/fixtures/signed.fw", import.meta.url),
    );
    // The extension deliberately differs: the reader, not a filename, validates the input.
    return new File([bytes], "signals.data");
}

describe("Figwig source inspection", () => {
    it("reads a local header and owns a working URL until disposal", async () => {
        const file = await fixtureFile();
        const source = await inspectFigwigSource(file);
        expect(source).toMatchObject({
            kind: "local",
            name: "signals.data",
            size: file.size,
        });
        expect(
            source.header.chromosomes.map(({ name, length }) => [name, length]),
        ).toEqual([
            ["chr1", 248_956_422],
            ["chr2", 242_193_529],
        ]);
        expect(source.tracks.map((track) => track.name)).toEqual([
            "sample-a",
            "sample-b",
        ]);
        expect(source.tracks[0].metadata).toMatchObject({
            tissue: "heart",
            age: 12,
        });
        expect((await fetch(source.url)).ok).toBe(true);

        source.dispose();
        await expect(fetch(source.url)).rejects.toThrow();
    });

    it("rejects invalid data without creating a local URL", async () => {
        const createUrl = vi.spyOn(URL, "createObjectURL");
        try {
            await expect(
                inspectFigwigSource(new File(["invalid"], "signals.fw")),
            ).rejects.toThrow();
            expect(createUrl).not.toHaveBeenCalled();
        } finally {
            createUrl.mockRestore();
        }
    });

    it("rejects non-HTTPS external URLs before making a request", async () => {
        const fetchMock = vi.fn();
        vi.stubGlobal("fetch", fetchMock);
        await expect(
            inspectFigwigSource("http://example.org/data.fw"),
        ).rejects.toThrow("HTTPS");
        await expect(
            inspectFigwigSource("file:///data/signals.fw"),
        ).rejects.toThrow("HTTPS");
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it("cancels ignored range responses before reading a whole file", async () => {
        const cancel = vi.fn();
        const body = new ReadableStream({ cancel });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));

        await expect(
            inspectFigwigSource("https://example.org/signals.fw"),
        ).rejects.toThrow("HTTP 206");
        expect(cancel).toHaveBeenCalledOnce();
    });

    it("requires a CORS-visible file size in the range response", async () => {
        vi.stubGlobal(
            "fetch",
            vi.fn().mockResolvedValue(new Response(null, { status: 206 })),
        );
        await expect(
            inspectFigwigSource("https://example.org/signals.fw"),
        ).rejects.toThrow("Content-Range");
    });

    it("lets a caller cancel a stalled range probe", async () => {
        vi.stubGlobal(
            "fetch",
            (_url: string, request: RequestInit) =>
                new Promise<Response>((_resolve, reject) => {
                    const signal = request.signal as AbortSignal;
                    signal.addEventListener(
                        "abort",
                        () => reject(signal.reason),
                        { once: true },
                    );
                }),
        );
        const controller = new AbortController();
        const opening = inspectFigwigSource(
            "https://example.org/signals.fw",
            controller.signal,
        );
        const reason = new DOMException("Opening cancelled", "AbortError");
        controller.abort(reason);
        await expect(opening).rejects.toBe(reason);
    });

    it("also applies cancellation while reading a remote header", async () => {
        const controller = new AbortController();
        let notifyHeaderRequest: () => void = () => {};
        const headerRequested = new Promise<void>((resolve) => {
            notifyHeaderRequest = resolve;
        });
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(
                new Response(new Uint8Array([0]), {
                    status: 206,
                    headers: { "Content-Range": "bytes 0-0/2395" },
                }),
            )
            .mockImplementation(
                (_url: string, request: RequestInit) =>
                    new Promise<Response>((_resolve, reject) => {
                        const signal = request.signal as AbortSignal;
                        signal.addEventListener(
                            "abort",
                            () => reject(signal.reason),
                            { once: true },
                        );
                        notifyHeaderRequest();
                    }),
            );
        vi.stubGlobal("fetch", fetchMock);

        const opening = inspectFigwigSource(
            "https://example.org/signals.fw",
            controller.signal,
        );
        await headerRequested;
        controller.abort();
        await expect(opening).rejects.toMatchObject({ name: "AbortError" });
    });
});
