import { BaseDialog } from "@genome-spy/app";
import {
    LitElement,
    css,
    html,
    nothing,
    type TemplateResult,
    type CSSResultGroup,
    type PropertyDeclarations,
} from "lit";
import { DEFAULT_QUERY_MODE, type QueryMode } from "./createViewerSpec";
import type { ViewerState } from "./viewerController";

const EXAMPLE_URL =
    "https://data.genomespy.app/datasets/encode-mouse-fetal-chromatin-mm10/v2/chromatin.fw";
const EXAMPLE_PROVENANCE_URL =
    "https://github.com/genome-spy/genomespy-dataset-recipes/tree/main/recipes/encode-mouse-fetal-chromatin-mm10";

// App's public dialog export omits its implementation types from the npm archive.
// Describe only the documented BaseDialog extension methods used here.
interface NativeDialog extends LitElement {
    dialogTitle: string;
    finish(detail: { ok: boolean; reason?: string }): void;
    triggerClose(): void;
    onCloseButtonClick(): void;
}
const NativeDialogBase = BaseDialog as {
    new (): NativeDialog;
    properties: PropertyDeclarations;
    styles: CSSResultGroup;
};

export class OpenDialog extends NativeDialogBase {
    static properties = {
        ...NativeDialogBase.properties,
        state: { attribute: false },
    };

    static styles = [
        BaseDialog.styles,
        css`
            dialog {
                width: min(480px, calc(100vw - 24px));
            }
            input[type="file"] {
                width: 100%;
            }
            .opening-status {
                white-space: pre-wrap;
                overflow-wrap: anywhere;
            }
            .example-actions {
                display: flex;
                align-items: center;
                gap: 0.75em;
            }
        `,
    ];

    declare state: ViewerState;
    mode: QueryMode = DEFAULT_QUERY_MODE;
    url = "";
    openSource: (input: File | string, mode: QueryMode) => void = () => {};
    cancelOpening: () => void = () => {};

    constructor() {
        super();
        this.dialogTitle = "Open Figwig file";
        this.state = { phase: "empty", message: "", canCancel: false };
    }

    get busy(): boolean {
        return (
            this.state.phase === "inspecting" || this.state.phase === "mounting"
        );
    }

    protected firstUpdated(): void {
        super.firstUpdated(new Map());
        this.renderRoot.addEventListener(
            "cancel",
            (event) => {
                if (this.busy) {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    if (this.state.canCancel) this.cancelOpening();
                }
            },
            { capture: true },
        );
    }

    complete(): void {
        this.finish({ ok: true });
        this.triggerClose();
    }

    protected renderBody(): TemplateResult {
        return html`
            <p>Choose a file or drop one anywhere in the viewer.</p>
            <div class="gs-form-group">
                <label for="figwig-file">Local file</label>
                <input
                    autofocus
                    id="figwig-file"
                    type="file"
                    ?disabled=${this.busy}
                    @change=${(event: Event) => {
                        const picker = event.target as HTMLInputElement;
                        const file = picker.files![0];
                        if (file) this.openSource(file, this.mode);
                        picker.value = "";
                    }}
                />
                <small>Local files stay in your browser.</small>
            </div>
            <div class="gs-form-group">
                <label for="figwig-url">File URL</label>
                <input
                    id="figwig-url"
                    type="text"
                    inputmode="url"
                    placeholder="https://example.org/signals.fw"
                    .value=${this.url}
                    ?disabled=${this.busy}
                    @input=${(event: Event) => {
                        this.url = (event.target as HTMLInputElement).value;
                    }}
                />
                <small
                    >The server must allow cross-origin access and byte-range
                    requests.</small
                >
            </div>
            <div class="gs-form-group">
                <div class="example-actions">
                    <button
                        class="btn"
                        type="button"
                        ?disabled=${this.busy}
                        @click=${() => {
                            this.url = EXAMPLE_URL;
                            this.#openUrl();
                        }}
                    >
                        Open example
                    </button>
                    <a
                        href=${EXAMPLE_PROVENANCE_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        >Provenance</a
                    >
                </div>
                <small>
                    ENCODE mouse fetal chromatin: 256 tracks, mm10 chr1.
                    Annotation tracks currently use hg38.
                </small>
            </div>
            <div class="gs-form-group">
                <label for="signal-mode">Signal aggregation</label>
                <select
                    id="signal-mode"
                    .value=${this.mode}
                    ?disabled=${this.busy}
                    @change=${(event: Event) => {
                        this.mode = (event.target as HTMLSelectElement)
                            .value as QueryMode;
                    }}
                >
                    <option value="fast">Fast browsing</option>
                    <option value="exact">Exact means</option>
                </select>
                <small
                    >Fast browsing uses approximate summaries at coarse scales
                    and counts missing values as zero.</small
                >
            </div>
            <p>Assembly: hg38</p>
            ${this.state.message ? html`<div class="opening-status gs-alert ${this.state.phase === "error" ? "warning" : "info"}" role="status">${this.state.message}</div>` : nothing}
        `;
    }

    protected renderButtons(): TemplateResult[] {
        return [
            this.state.canCancel
                ? html`<button class="btn" @click=${this.cancelOpening}>
                      Cancel opening
                  </button>`
                : html`<button
                      class="btn"
                      ?disabled=${this.busy}
                      @click=${() => this.onCloseButtonClick()}
                  >
                      Close
                  </button>`,
            this.state.phase === "mounting"
                ? html`<button
                      class="btn"
                      @click=${() => window.location.reload()}
                  >
                      Reload page
                  </button>`
                : html`<button
                      class="btn btn-primary"
                      data-primary
                      ?disabled=${this.busy}
                      @click=${() => this.#openUrl()}
                  >
                      Open URL
                  </button>`,
        ];
    }

    #openUrl(): void {
        if (!this.url.trim()) {
            this.state = {
                phase: "error",
                message: "Enter a file URL.",
                canCancel: false,
            };
            this.renderRoot
                .querySelector<HTMLInputElement>("#figwig-url")!
                .focus();
            return;
        }
        this.openSource(this.url.trim(), this.mode);
    }
}

customElements.define("figwig-open-dialog", OpenDialog);
