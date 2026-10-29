import { embed } from "@genome-spy/app";
import { createViewerSpec } from "./createViewerSpec";
import { inspectFigwigSource, type PreparedSource } from "./figwigSource";
import { createFigwigPlugin } from "./figwigPlugin";

export type ViewerApi = Awaited<ReturnType<typeof embed>>;

export interface ViewerState {
    phase: "empty" | "inspecting" | "mounting" | "ready" | "error";
    message: string;
    canCancel: boolean;
}

export interface ViewerControllerOptions {
    mount: HTMLElement;
    requestOpen: () => void;
    onStateChange: (state: ViewerState) => void;
}

/** Own one source and App instance; opening operations are deliberately serialized. */
export class ViewerController {
    readonly #options: ViewerControllerOptions;
    #api: ViewerApi | undefined;
    #source: PreparedSource | undefined;
    #inspection: AbortController | undefined;
    #busy = false;

    constructor(options: ViewerControllerOptions) {
        this.#options = options;
    }

    get api(): ViewerApi | undefined {
        return this.#api;
    }

    get source(): PreparedSource | undefined {
        return this.#source;
    }

    get busy(): boolean {
        return this.#busy;
    }

    cancelInspection(): void {
        this.#inspection?.abort(
            new DOMException("Opening cancelled.", "AbortError"),
        );
    }

    async open(input: File | string, restoreUrlState = false): Promise<void> {
        if (this.#busy) {
            throw new Error("Wait for the current file to finish opening.");
        }

        this.#busy = true;
        const inspection = new AbortController();
        this.#inspection = inspection;
        this.#publish("inspecting", "Reading file information…", true);
        let candidate: PreparedSource | undefined;

        try {
            candidate = await inspectFigwigSource(input, inspection.signal);
            const spec = await createViewerSpec(candidate);
            inspection.signal.throwIfAborted();
            this.#inspection = undefined;

            this.#clearEmbed();
            updateSourceUrl(candidate, restoreUrlState);
            this.#publish(
                "mounting",
                "Loading visualization… This stage cannot be cancelled; reload the page if the server stops responding.",
                false,
            );

            const source = candidate;
            const api = await embed(this.#options.mount, spec, {
                embedMode: source.kind === "remote" ? "standalone" : "embedded",
                plugins: [
                    createFigwigPlugin(source, this.#options.requestOpen),
                ],
            });
            this.#api = api;
            this.#source = source;
            candidate = undefined;

            // An embed can resolve before a visible lazy source has failed or completed.
            const loadingDeadline = AbortSignal.timeout(30_000);
            try {
                await api.awaitVisibleLazyData(loadingDeadline);
            } catch (error) {
                loadingDeadline.throwIfAborted();
                throw error;
            }
            const error = api.dataLoading
                .getSnapshot()
                .find((entry) => entry.status === "error");
            if (error) {
                throw new Error(
                    error.message ?? "The signal source could not be loaded.",
                );
            }

            document.title = source.name + " · Figwig Viewer";
            this.#publish("ready", "Opened " + source.name, false);
        } catch (error) {
            candidate?.dispose();
            // Inspection failures leave the current viewer intact. Mount failures do not.
            if (!this.#inspection) {
                this.#clearEmbed();
            }
            const message = openingErrorMessage(error);
            this.#publish("error", message, false);
        } finally {
            this.#inspection = undefined;
            this.#busy = false;
        }
    }

    dispose(): void {
        if (this.#busy) {
            throw new Error("Cannot dispose while a file is opening.");
        }
        this.#clearEmbed();
    }

    #clearEmbed(): void {
        this.#api?.finalize();
        this.#api = undefined;
        this.#source?.dispose();
        this.#source = undefined;
        this.#options.mount.replaceChildren();
    }

    #publish(
        phase: ViewerState["phase"],
        message: string,
        canCancel: boolean,
    ): void {
        this.#options.onStateChange({ phase, message, canCancel });
    }
}

/** The source query belongs to the viewer; the hash belongs to remote App sessions. */
export function updateSourceUrl(
    source: Pick<PreparedSource, "kind" | "url">,
    restore: boolean,
): void {
    const url = new URL(window.location.href);
    if (source.kind === "remote") {
        url.searchParams.set("url", source.url);
        if (!restore) {
            url.hash = "";
        }
    } else {
        url.searchParams.delete("url");
        url.hash = "";
    }
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
}

function openingErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        if (error.name === "TimeoutError") {
            return "Opening timed out. Check the server connection and try again.";
        }
        return error.message;
    }
    return String(error);
}
