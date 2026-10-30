import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
    createAppSpec,
    createPersistenceContext,
    createViewerSpec,
} from "./createViewerSpec";
import { inspectFigwigSource } from "./figwigSource";

async function fixtureSource() {
    const bytes = await readFile(
        new URL("../tests/fixtures/signed.fw", import.meta.url),
    );
    return inspectFigwigSource(new File([bytes], "signed.fw"));
}

describe("viewer specification", () => {
    it("owns persistent hg38 navigation alongside the annotation tracks", () => {
        const spec = createAppSpec();
        expect(spec).toMatchObject({
            name: "tracks",
            description: "Experimental Figwig Viewer",
            assembly: "hg38",
            scales: { x: { name: "locus", type: "locus", zoom: true } },
            resolve: { scale: { x: "shared" }, axis: { x: "shared" } },
            axes: { x: { orient: "top", title: null } },
        });
        expect(spec).not.toHaveProperty("specId");
    });

    it("keeps file identity, metadata, and signed signal in the replaceable cohort", async () => {
        const source = await fixtureSource();
        try {
            const spec = createViewerSpec(source, "exact");
            expect(spec).toMatchObject({
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
            // Assembly, navigation, and persistence belong to the surviving App.
            for (const property of [
                "assembly",
                "genomes",
                "scales",
                "specId",
            ]) {
                expect(spec).not.toHaveProperty(property);
            }
            expect(spec).not.toHaveProperty("spec.transform");
            expect(createViewerSpec(source, "fast")).toHaveProperty(
                "spec.data.lazy.mode",
                "fast",
            );
        } finally {
            source.dispose();
        }
    });

    it("namespaces remote persistence by complete URL and query mode while keeping local data transient", async () => {
        const source = await fixtureSource();
        try {
            expect(await createPersistenceContext(source, "exact")).toBeNull();
            const first = {
                ...source,
                kind: "remote" as const,
                url: "https://example.org/signals.fw?version=one",
            };
            const second = {
                ...first,
                url: "https://example.org/signals.fw?version=two",
            };
            const context = await createPersistenceContext(first, "exact");
            expect(context?.specId).toMatch(/^figwig-viewer:[a-f0-9]{64}$/);
            expect(context).toEqual(
                await createPersistenceContext(first, "exact"),
            );
            expect(context).not.toEqual(
                await createPersistenceContext(second, "exact"),
            );
            expect(context).not.toEqual(
                await createPersistenceContext(first, "fast"),
            );
        } finally {
            source.dispose();
        }
    });
});
