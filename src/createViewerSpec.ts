import type { embed } from "@genome-spy/app";
import type { PreparedSource } from "./figwigSource";

export type ViewerSpec = Exclude<Parameters<typeof embed>[1], string>;

/** Generate a sample view from the file's own dictionary and track identities. */
export async function createViewerSpec(
    source: PreparedSource,
): Promise<ViewerSpec> {
    const firstChromosome = source.header.chromosomes.find(
        (chromosome) => chromosome.length > 0,
    );
    if (!firstChromosome) {
        throw new Error("This Figwig file contains no non-empty chromosomes.");
    }

    const spec = {
        name: "samples",
        description: [source.name],
        genomes: {
            file: {
                contigs: source.header.chromosomes.map(({ name, length }) => ({
                    name,
                    size: length,
                })),
            },
        },
        assembly: "file",
        scales: {
            x: {
                domain: [
                    { chrom: firstChromosome.name, pos: 0 },
                    {
                        chrom: firstChromosome.name,
                        // Explicit locus domains include the upper coordinate.
                        pos: Math.min(firstChromosome.length, 1_000_000) - 1,
                    },
                ],
            },
        },
        samples: {
            identity: { metadataSource: "figwig" },
            labelTitle: "Sample",
        },
        sampleLayout: { sampleHeight: 24 },
        sampleYAxis: { mode: "top", minSampleHeight: 18 },
        metadata: {
            title: "Sample metadata",
            sources: [
                {
                    id: "figwig",
                    initialLoad: false,
                    backend: { backend: "figwig", url: source.url },
                },
            ],
        },
        spec: {
            name: "signal",
            height: 24,
            params: [
                {
                    name: "brush",
                    select: {
                        type: "interval",
                        encodings: ["x"],
                        zoom: "wheel[event.shiftKey]",
                    },
                },
            ],
            data: {
                lazy: {
                    type: "figwig",
                    url: source.url,
                    mode: "exact",
                    tracks: { expr: "visibleSamples" },
                },
            },
            mark: { type: "rect", color: "#4c78a8", minWidth: 0.5 },
            encoding: {
                sample: { field: "sampleId" },
                x: { chrom: "chrom", pos: "start", type: "locus" },
                x2: { chrom: "chrom", pos: "end" },
                y: {
                    field: "score",
                    type: "quantitative",
                    scale: { zero: true },
                    axis: { title: "Signal" },
                },
                y2: { datum: 0 },
                tooltip: [
                    { field: "sampleId", title: "Sample" },
                    { field: "score", title: "Signal", format: ".4g" },
                ],
            },
        },
    } satisfies ViewerSpec;

    if (source.kind === "remote") {
        const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode("figwig-viewer-spec-v1\n" + source.url),
        );
        const id = Array.from(new Uint8Array(digest), (byte) =>
            byte.toString(16).padStart(2, "0"),
        ).join("");
        return { ...spec, specId: "figwig-viewer:" + id };
    } else {
        return spec;
    }
}
