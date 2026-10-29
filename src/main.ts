import "@genome-spy/app/style.css";
import "./styles.css";
import { ViewerController, type ViewerState } from "./viewerController";

const app = document.querySelector<HTMLDivElement>("#app")!;
app.innerHTML = `
    <header class="viewer-header"><a href="./">Figwig Viewer</a><span>Explore multitrack genomic signals</span><span class="viewer-status" role="status" aria-live="polite" hidden></span></header>
    <main class="viewer-workspace">
        <section class="landing" aria-label="Open a Figwig file">
            <div class="opening-card">
                <p class="eyebrow">GENOMIC SIGNAL EXPLORER</p>
                <h1>Open a Figwig file</h1>
                <p class="intro">Explore signal tracks and sample metadata from one file.</p>
                <div class="form-host"></div>
            </div>
            <p class="landing-note">Powered by GenomeSpy · Local files stay in your browser</p>
        </section>
        <section class="viewer" aria-label="Signal viewer" hidden><div class="embed-mount"></div></section>
    </main>
    <dialog class="open-dialog" aria-labelledby="open-dialog-title">
        <div class="dialog-header"><h2 id="open-dialog-title">Open Figwig file</h2><button type="button" class="close-dialog" aria-label="Close">×</button></div>
        <div class="dialog-form-host"></div>
    </dialog>
`;

const form = document.createElement("form");
form.className = "opening-form";
form.innerHTML = `
    <label class="drop-area" for="figwig-file"><strong>Choose a local file</strong><span>or drop a file here</span></label>
    <label class="file-input-label" for="figwig-file">Open file</label>
    <input id="figwig-file" type="file" />
    <div class="or-divider"><span>or open from a URL</span></div>
    <label for="figwig-url">File URL</label>
    <div class="url-row"><input id="figwig-url" type="url" placeholder="https://example.org/signals.fw" autocomplete="off" spellcheck="false" /><button type="submit">Open URL</button></div>
    <p class="field-help">The server must allow cross-origin access and byte-range requests.</p>
    <p class="opening-status" role="status" aria-live="polite"></p>
    <div class="loading-actions"><button type="button" class="cancel-opening" hidden>Cancel opening</button><button type="button" class="reload-page" hidden>Reload page</button></div>
`;

const landing = app.querySelector<HTMLElement>(".landing")!;
const viewer = app.querySelector<HTMLElement>(".viewer")!;
const dialog = app.querySelector<HTMLDialogElement>(".open-dialog")!;
const status = form.querySelector<HTMLElement>(".opening-status")!;
const picker = form.querySelector<HTMLInputElement>("#figwig-file")!;
const urlInput = form.querySelector<HTMLInputElement>("#figwig-url")!;
const cancel = form.querySelector<HTMLButtonElement>(".cancel-opening")!;
const reload = form.querySelector<HTMLButtonElement>(".reload-page")!;
const close = dialog.querySelector<HTMLButtonElement>(".close-dialog")!;
const dropArea = form.querySelector<HTMLElement>(".drop-area")!;
const viewerStatus = app.querySelector<HTMLElement>(".viewer-status")!;
app.querySelector(".form-host")!.append(form);

const controller = new ViewerController({
    mount: app.querySelector<HTMLElement>(".embed-mount")!,
    requestOpen: showOpen,
    onStateChange: renderState,
});

function showOpen(): void {
    if (controller.busy) return;
    status.textContent = "";
    status.classList.remove("is-error");
    if (controller.source) {
        dialog.querySelector(".dialog-form-host")!.append(form);
        dialog.showModal();
        picker.focus();
    }
}

function renderState(state: ViewerState): void {
    const busy = state.phase === "inspecting" || state.phase === "mounting";
    status.textContent = state.message;
    status.classList.toggle("is-error", state.phase === "error");
    for (const control of form.querySelectorAll<
        HTMLInputElement | HTMLButtonElement
    >("input, button[type=submit]")) {
        control.disabled = busy;
    }
    cancel.hidden = !state.canCancel;
    reload.hidden = state.phase !== "mounting";
    close.disabled = busy;
    dropArea.setAttribute("aria-disabled", String(busy));

    // The canvas needs a real layout while its initial data and scales initialize.
    const mounting = state.phase === "mounting";
    viewer.hidden = !mounting && controller.source === undefined;
    landing.hidden =
        controller.source !== undefined || (mounting && dialog.open);
    landing.classList.toggle("is-loading", mounting && !dialog.open);
    viewerStatus.hidden = controller.source === undefined;
    if (state.phase === "ready") {
        viewerStatus.textContent = state.message;
        if (dialog.open) dialog.close();
    } else if (state.phase === "error" && !controller.source) {
        if (dialog.open) dialog.close();
        app.querySelector(".form-host")!.append(form);
    }
}

async function open(input: File | string, restore = false): Promise<void> {
    await controller.open(input, restore);
    picker.value = "";
}

picker.addEventListener("change", () => {
    const file = picker.files![0];
    if (file) void open(file);
});
form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!urlInput.value.trim()) {
        status.textContent = "Enter a file URL.";
        urlInput.focus();
        return;
    }
    void open(urlInput.value.trim());
});
cancel.addEventListener("click", () => controller.cancelInspection());
reload.addEventListener("click", () => window.location.reload());
close.addEventListener("click", () => dialog.close());
dialog.addEventListener("cancel", (event) => {
    if (controller.busy) event.preventDefault();
});
document.addEventListener("dragover", (event) => event.preventDefault());
document.addEventListener("drop", (event) => {
    event.preventDefault();
    if (controller.busy) return;
    const files = event.dataTransfer!.files;
    if (files.length !== 1) {
        showOpen();
        status.textContent = "Choose one Figwig file at a time.";
        return;
    }
    showOpen();
    void open(files[0]);
});

const initialSource = new URL(window.location.href).searchParams.get("url");
if (initialSource) {
    urlInput.value = initialSource;
    void open(initialSource, true);
} else if (window.location.hash) {
    // A hash without its remote source cannot safely be restored onto a chosen file.
    window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
    );
}
