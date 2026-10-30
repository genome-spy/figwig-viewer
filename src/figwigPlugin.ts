import { html, showMessageDialog, type AppPlugin } from "@genome-spy/app";
import { faFolderOpen, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import type { PreparedSource } from "./figwigSource";
import type { QueryMode } from "./createViewerSpec";
import packageManifest from "../package.json";

interface FileContext {
    readonly source: PreparedSource | undefined;
    readonly mode: QueryMode;
}

/** Install native actions once; their content follows the current cohort. */
export function createFigwigPlugin(
    context: FileContext,
    requestOpen: () => void,
): AppPlugin {
    return {
        name: "figwig-viewer",
        install({ ui }) {
            const removeOpen = ui.registerToolbarButton({
                title: "Open",
                icon: faFolderOpen,
                onClick: requestOpen,
            });
            const removeInfo = ui.registerToolbarButton({
                title: "File information",
                icon: faCircleInfo,
                onClick: async () => {
                    const source = context.source;
                    if (!source) {
                        await showMessageDialog(
                            "Open a Figwig file or URL to view signals and sample metadata. The viewer currently assumes hg38.",
                            { title: "Figwig Viewer" },
                        );
                        return;
                    }
                    const fields = Array.from(
                        new Set(
                            source.tracks.flatMap((track) =>
                                Object.keys(track.metadata),
                            ),
                        ),
                    ).filter(
                        (field) =>
                            !["name", "dtype", "group", "sample"].includes(
                                field,
                            ),
                    );
                    await showMessageDialog(
                        html`<dl>
                                <dt>File</dt>
                                <dd>${source.name}</dd>
                                <dt>Size</dt>
                                <dd>
                                    ${source.size === undefined ? "Unknown" : source.size.toLocaleString() + " bytes"}
                                </dd>
                                <dt>Assembly</dt>
                                <dd>hg38</dd>
                                <dt>Chromosomes in file</dt>
                                <dd>${source.header.chromosomes.length}</dd>
                                <dt>Tracks</dt>
                                <dd>${source.tracks.length}</dd>
                                <dt>Signal aggregation</dt>
                                <dd>
                                    ${context.mode === "fast" ? "Fast browsing" : "Exact means"}
                                </dd>
                                <dt>Metadata fields</dt>
                                <dd>
                                    ${fields.length ? fields.join(", ") : "None"}
                                </dd>
                                <dt>GenomeSpy App dependency</dt>
                                <dd>
                                    ${packageManifest.dependencies["@genome-spy/app"]}
                                </dd>
                            </dl>
                            <p>Use View settings to import metadata columns.</p>
                            ${
                                source.kind === "local"
                                    ? html`<p>
                                          Local files stay in your browser.
                                          Choose the file again after reloading.
                                      </p>`
                                    : html`<p>
                                          Shared links retain this source URL
                                          and its access requirements.
                                      </p>`
                            }`,
                        { title: "File information" },
                    );
                },
            });
            return () => {
                removeInfo();
                removeOpen();
            };
        },
    };
}
