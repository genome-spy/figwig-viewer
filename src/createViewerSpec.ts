import type { AppPersistenceContext, SampleSpec, embed } from "@genome-spy/app";
import type { PreparedSource } from "./figwigSource";

export type AppRootSpec = Exclude<Parameters<typeof embed>[1], string>;
export type ViewerSpec = SampleSpec;
export type QueryMode = "fast" | "exact";

export const DEFAULT_QUERY_MODE: QueryMode = "fast";

/** Keep the application and its hg38 navigation alive between file opens. */
export function createAppSpec(): AppRootSpec {
    return {
        name: "tracks",
        description: "Experimental Figwig Viewer",
        assembly: "hg38",
        scales: {
            x: { name: "locus", type: "locus", zoom: true },
        },
        resolve: { scale: { x: "shared" } },
        vconcat: [],
    };
}

/** Create only the file-owned cohort, metadata, and signal subtree. */
export function createViewerSpec(
    source: PreparedSource,
    mode: QueryMode,
): ViewerSpec {
    return {
        name: "samples",
        description: source.name,
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
                    mode,
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
                    scale: { zero: true, domain: { source: "viewport" } },
                    axis: { title: "Signal" },
                },
                y2: { datum: 0 },
                tooltip: [
                    { field: "sampleId", title: "Sample" },
                    { field: "score", title: "Signal", format: ".4g" },
                ],
            },
        },
    };
}

/** Bind remote bookmarks to the exact source, assembly, query mode, and format. */
export async function createPersistenceContext(
    source: PreparedSource,
    mode: QueryMode,
): Promise<AppPersistenceContext | null> {
    if (source.kind === "local") return null;

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(
            `figwig-viewer-spec-v3\nhg38\n${mode}\n${source.url}`,
        ),
    );
    const id = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, "0"),
    ).join("");
    return { specId: "figwig-viewer:" + id };
}
