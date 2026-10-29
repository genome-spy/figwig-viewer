import { html, showMessageDialog, type AppPlugin } from "@genome-spy/app";
import { faFolderOpen, faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import type { PreparedSource } from "./figwigSource";
import snapshot from "../vendor/genomespy/snapshot.json";

/** Add file actions through App's public UI contract. */
export function createFigwigPlugin(
    source: PreparedSource,
    requestOpen: () => void,
): AppPlugin {
    const fields = Array.from(
        new Set(source.tracks.flatMap((track) => Object.keys(track.metadata))),
    ).filter((field) => !["name", "dtype", "group", "sample"].includes(field));

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
                    await showMessageDialog(
                        html`<dl>
                                <dt>File</dt>
                                <dd>${source.name}</dd>
                                <dt>Size</dt>
                                <dd>
                                    ${source.size === undefined ? "Unknown" : source.size.toLocaleString() + " bytes"}
                                </dd>
                                <dt>Genome label</dt>
                                <dd>
                                    ${source.header.genome ?? "Not specified"}
                                </dd>
                                <dt>Chromosomes</dt>
                                <dd>${source.header.chromosomes.length}</dd>
                                <dt>Tracks</dt>
                                <dd>${source.tracks.length}</dd>
                                <dt>Query mode</dt>
                                <dd>Exact</dd>
                                <dt>Metadata fields</dt>
                                <dd>
                                    ${fields.length ? fields.join(", ") : "None"}
                                </dd>
                                <dt>GenomeSpy snapshot</dt>
                                <dd>${snapshot.commit.slice(0, 12)}</dd>
                            </dl>
                            ${
                                source.kind === "local"
                                    ? html`<p>
                                          This file stays in your browser.
                                          Choose it again after reloading the
                                          page.
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
