import "@genome-spy/app/style.css";
import "./styles.css";
import { showDialog } from "@genome-spy/app";
import { ViewerController, type ViewerState } from "./viewerController";
import "./openDialog";
import type { OpenDialog } from "./openDialog";
import { DEFAULT_QUERY_MODE, type QueryMode } from "./createViewerSpec";

const mount = document.querySelector<HTMLDivElement>("#app")!;
let dialog: OpenDialog | undefined;
let mode: QueryMode = DEFAULT_QUERY_MODE;
const controller = new ViewerController({
    mount,
    requestOpen: showOpen,
    onStateChange: renderState,
});

function showOpen(): void {
    if (!controller.busy) getOpenDialog();
}

function getOpenDialog(): OpenDialog {
    if (!dialog) {
        void showDialog("figwig-open-dialog", (element: OpenDialog) => {
            dialog = element;
            element.mode = mode;
            element.url =
                controller.source?.kind === "remote"
                    ? controller.source.url
                    : "";
            element.openSource = (input, selectedMode) => {
                mode = selectedMode;
                void controller.open(input, { mode });
            };
            element.cancelOpening = () => controller.cancelInspection();
        }).then(() => {
            dialog = undefined;
        });
    }
    return dialog!;
}

function renderState(state: ViewerState): void {
    if (state.phase === "ready") {
        dialog?.complete();
    } else {
        getOpenDialog().state = state;
    }
}

document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => {
    event.preventDefault();
    if (controller.busy) return;
    const files = event.dataTransfer!.files;
    if (files.length !== 1) {
        renderState({
            phase: "error",
            message: "Choose one Figwig file at a time.",
            canCancel: false,
        });
        return;
    }
    void controller.open(files[0], { mode });
});

const initialUrl = new URL(window.location.href);
const initialSource = initialUrl.searchParams.get("url");
const restoreHash = initialSource ? initialUrl.hash : "";
mode =
    initialUrl.searchParams.get("mode") === "exact"
        ? "exact"
        : DEFAULT_QUERY_MODE;
// Empty App launch must not restore a cohort bookmark before its SampleView exists.
if (initialUrl.hash) {
    initialUrl.hash = "";
    window.history.replaceState(
        null,
        "",
        initialUrl.pathname + initialUrl.search,
    );
}

try {
    await controller.initialize(initialSource ? "remote" : "local");
    if (initialSource) {
        await controller.open(initialSource, { mode, restoreHash });
    } else {
        showOpen();
    }
} catch (error) {
    renderState({ phase: "error", message: String(error), canCancel: false });
}
