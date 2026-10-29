import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { createViewerSpec } from "./createViewerSpec";
import { inspectFigwigSource } from "./figwigSource";

async function fixtureSource() {
    const bytes = await readFile(
        new URL("../tests/fixtures/signed.fw", import.meta.url),
    );
    return inspectFigwigSource(new File([bytes], "signed.fw"));
}

describe("viewer specification", () => {
    it("uses the file dictionary and metadata identity for signed signal", async () => {
        const source = await fixtureSource();
        try {
            const spec = await createViewerSpec(source);
            expect(spec).toMatchObject({
                assembly: "file",
                genomes: {
                    file: {
                        contigs: [
                            { name: "contigA", size: 256 },
                            { name: "contigB", size: 128 },
                        ],
                    },
                },
                scales: {
                    x: {
                        domain: [
                            { chrom: "contigA", pos: 0 },
                            { chrom: "contigA", pos: 255 },
                        ],
                    },
                },
                samples: { identity: { metadataSource: "figwig" } },
                metadata: {
                    sources: [
                        {
                            id: "figwig",
                            initialLoad: false,
                            backend: { backend: "figwig", url: source.url },
                        },
                    ],
                },
                spec: {
                    data: {
                        lazy: {
                            type: "figwig",
                            mode: "exact",
                            url: source.url,
                            tracks: { expr: "visibleSamples" },
                        },
                    },
                    encoding: {
                        y: { field: "score", scale: { zero: true } },
                        y2: { datum: 0 },
                    },
                },
            });
            expect(spec).not.toHaveProperty("specId");
            // No recipe-specific transform may discard negative values.
            expect(spec).not.toHaveProperty("spec.transform");
        } finally {
            source.dispose();
        }
    });

    it("namespaces remote bookmarks by the complete source URL", async () => {
        const source = await fixtureSource();
        try {
            const first = {
                ...source,
                kind: "remote" as const,
                url: "https://example.org/signals.fw?version=one",
            };
            const second = {
                ...first,
                url: "https://example.org/signals.fw?version=two",
            };
            const firstSpec = await createViewerSpec(first);
            expect(firstSpec.specId).toMatch(/^figwig-viewer:[a-f0-9]{64}$/);
            expect(firstSpec.specId).toBe(
                (await createViewerSpec(first)).specId,
            );
            expect(firstSpec.specId).not.toBe(
                (await createViewerSpec(second)).specId,
            );
        } finally {
            source.dispose();
        }
    });
});
