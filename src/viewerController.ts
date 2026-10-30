import { embed, type AppEmbedResult } from "@genome-spy/app";
import {
    DEFAULT_QUERY_MODE,
    createAppSpec,
    createPersistenceContext,
    createViewerSpec,
    getInitialLocus,
    type QueryMode,
} from "./createViewerSpec";
import { inspectFigwigSource, type PreparedSource } from "./figwigSource";
import { createFigwigPlugin } from "./figwigPlugin";

type CohortHandle = Awaited<ReturnType<AppEmbedResult["views"]["insert"]>>;

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

export interface OpenOptions {
    mode?: QueryMode;
    restoreHash?: string;
}

/** Own one App and replace its cohort through the public view lifecycle. */
export class ViewerController {
    readonly #options: ViewerControllerOptions;
    #api: AppEmbedResult | undefined;
    #cohort: CohortHandle | undefined;
    #kind: PreparedSource["kind"] = "local";
    #source: PreparedSource | undefined;
    #mode: QueryMode = DEFAULT_QUERY_MODE;
    #inspection: AbortController | undefined;
    #busy = false;

    constructor(options: ViewerControllerOptions) {
        this.#options = options;
    }

    get source(): PreparedSource | undefined {
        return this.#source;
    }

    get mode(): QueryMode {
        return this.#mode;
    }

    get busy(): boolean {
        return this.#busy;
    }

    async initialize(kind: PreparedSource["kind"] = "local"): Promise<void> {
        this.#kind = kind;
        this.#api = await embed(this.#options.mount, createAppSpec(), {
            embedMode: kind === "remote" ? "standalone" : "embedded",
            plugins: [createFigwigPlugin(this, this.#options.requestOpen)],
        });
    }

    cancelInspection(): void {
        this.#inspection?.abort(
            new DOMException("Opening cancelled.", "AbortError"),
        );
    }

    async open(input: File | string, options: OpenOptions = {}): Promise<void> {
        if (this.#busy) {
            throw new Error("Wait for the current file to finish opening.");
        }
        if (!this.#api) throw new Error("The viewer has not initialized.");

        this.#busy = true;
        const inspection = new AbortController();
        this.#inspection = inspection;
        this.#publish("inspecting", "Reading file information…", true);
        let candidate: PreparedSource | undefined;

        try {
            candidate = await inspectFigwigSource(input, inspection.signal);
            const mode = options.mode ?? DEFAULT_QUERY_MODE;
            const context = await createPersistenceContext(candidate, mode);
            const spec = createViewerSpec(candidate, mode);
            inspection.signal.throwIfAborted();
            this.#inspection = undefined;
            this.#publish("mounting", "Loading visualization…", false);

            const preserveLocus =
                this.#source !== undefined && this.#kind === candidate.kind;
            await this.#removeCohort();
            if (this.#kind !== candidate.kind) {
                // Embed mode is fixed by App; a source-kind change needs a new shell.
                this.#api.finalize();
                this.#api = undefined;
                await this.initialize(candidate.kind);
            }
            const api = this.#api!;
            updateSourceUrl(candidate, mode);
            await api.setPersistenceContext(context);
            // Bound the domain before insertion can activate any lazy signal request.
            if (!preserveLocus) {
                await api
                    .getScaleResolutionByName("locus")!
                    .zoomTo(getInitialLocus(candidate));
            }
            this.#cohort = await api.views.insert(
                api.views.get({ scope: [], view: "tracks" }),
                spec,
            );
            this.#source = candidate;
            this.#mode = mode;
            candidate = undefined;

            if (options.restoreHash) {
                const oldURL = window.location.href;
                window.history.replaceState(null, "", options.restoreHash);
                window.dispatchEvent(
                    new HashChangeEvent("hashchange", {
                        oldURL,
                        newURL: window.location.href,
                    }),
                );
                // The outer App transaction joins the pending native bookmark replay.
                await api.views.transaction(() => {});
            }
            await api.awaitVisibleLazyData(AbortSignal.timeout(30_000));
            const error = api.dataLoading
                .getSnapshot()
                .find((entry) => entry.status === "error");
            if (error) {
                throw new Error(
                    error.message ?? "The signal source could not be loaded.",
                );
            }

            document.title = this.#source.name + " · Figwig Viewer";
            this.#publish("ready", "Opened " + this.#source.name, false);
        } catch (error) {
            // Await reader teardown before releasing URLs, including failed inserts.
            if (!this.#inspection) {
                await this.#removeCohort();
                await this.#api?.setPersistenceContext(null);
                clearSourceUrl();
                document.title = "Figwig Viewer";
            }
            candidate?.dispose();
            this.#publish("error", openingErrorMessage(error), false);
        } finally {
            this.#inspection = undefined;
            this.#busy = false;
        }
    }

    async #removeCohort(): Promise<void> {
        if (this.#cohort) {
            await this.#api!.views.remove(this.#cohort);
            this.#cohort = undefined;
        }
        this.#source?.dispose();
        this.#source = undefined;
    }

    #publish(
        phase: ViewerState["phase"],
        message: string,
        canCancel: boolean,
    ): void {
        this.#options.onStateChange({ phase, message, canCancel });
    }
}

/** Keep the remote source locator separate from GenomeSpy's state hash. */
function updateSourceUrl(
    source: Pick<PreparedSource, "kind" | "url">,
    mode: QueryMode,
): void {
    const url = new URL(window.location.href);
    if (source.kind === "remote") {
        url.searchParams.set("url", source.url);
        if (mode === "exact") url.searchParams.set("mode", mode);
        else url.searchParams.delete("mode");
    } else {
        url.searchParams.delete("url");
        url.searchParams.delete("mode");
    }
    url.hash = "";
    window.history.replaceState(null, "", url.pathname + url.search);
}

function clearSourceUrl(): void {
    updateSourceUrl({ kind: "local", url: "" }, DEFAULT_QUERY_MODE);
}

function openingErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.name === "TimeoutError"
            ? "Opening timed out. Check the connection and try again."
            : error.message;
    }
    return String(error);
}
