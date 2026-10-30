import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { installAnnotationRoutes } from "./annotationRoutes";

const fixture = (name: string) =>
    fileURLToPath(new URL("./fixtures/" + name, import.meta.url));
const fixtureOrigin = "http://127.0.0.1:4174";
const pageErrors = new WeakMap<Page, string[]>();
const annotationRequests = new WeakMap<
    Page,
    Awaited<ReturnType<typeof installAnnotationRoutes>>
>();

test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    pageErrors.set(page, errors);
    page.on("pageerror", (error) => errors.push(error.message));
    annotationRequests.set(page, await installAnnotationRoutes(page));
});
test.afterEach(({ page }) => expect(pageErrors.get(page)).toEqual([]));

async function expectOpened(page: Page, name: string): Promise<void> {
    await expect(page).toHaveTitle(name + " · Figwig Viewer");
    await expect(
        page.getByRole("dialog").filter({ hasText: "Open Figwig file" }),
    ).toBeHidden();
    await expect(
        page.getByRole("button", { name: "File information", exact: true }),
    ).toBeVisible();
}

async function openLocal(page: Page, name = "signed.fw"): Promise<void> {
    await page
        .getByLabel("Local file", { exact: true })
        .setInputFiles(fixture(name));
    await expectOpened(page, name);
}

async function navigate(page: Page, locus = "chr1:1-256"): Promise<void> {
    const search = page.locator("genome-spy-search-field input");
    await search.click();
    await expect(
        page.locator("genome-spy-search-field .search-help"),
    ).toBeVisible();
    await search.fill(locus);
    await search.press("Enter");
    await expect(search).toHaveValue(locus);
}

async function exportSvg(page: Page): Promise<string> {
    await page
        .getByRole("button", { name: "Additional functions", exact: true })
        .click();
    await page.getByRole("menuitem", { name: "Save SVG", exact: true }).click();
    const dialog = page
        .getByRole("dialog")
        .filter({ hasText: "Save Visualization as SVG" });
    await dialog
        .getByRole("checkbox", { name: "Rasterize dense marks", exact: true })
        .uncheck();
    const pending = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Save SVG", exact: true }).click();
    const path = await (await pending).path();
    expect(path).not.toBeNull();
    return readFile(path!, "utf8");
}

async function inspectSvg(page: Page, svg: string) {
    return page.evaluate((source) => {
        const doc = new DOMParser().parseFromString(source, "image/svg+xml");
        const bars = Array.from(
            doc.querySelectorAll(
                '[data-name="signal"] [data-mark-type="rect"] rect',
            ),
        );
        return {
            labels: Array.from(
                doc.querySelectorAll("text"),
                (text) => text.textContent,
            ),
            heights: Array.from(
                new Set(
                    bars
                        .map((bar) => Number(bar.getAttribute("height")))
                        .filter((height) => height > 0),
                ),
            ).sort((a, b) => a - b),
            barCount: bars.length,
            trackOrder: Array.from(doc.querySelectorAll("[data-name]"))
                .map((element) => element.getAttribute("data-name"))
                .filter((name) =>
                    [
                        "ideogram-track",
                        "ccre-track",
                        "samples",
                        "refseq-track",
                    ].includes(name!),
                ),
            cytobandCount: doc.querySelectorAll(
                '[data-name="ideogram-track"] [data-mark-type="rect"] rect',
            ).length,
            ccreCount: doc.querySelectorAll(
                '[data-name="ccre-features"] [data-mark-type="rect"] rect',
            ).length,
        };
    }, svg);
}

/** Wait for fine bins and the viewport-driven y-scale animation to settle. */
async function inspectBaseResolution(page: Page) {
    let result: Awaited<ReturnType<typeof inspectSvg>> | undefined;
    let previousGeometry = "";
    await expect
        .poll(async () => {
            result = await inspectSvg(page, await exportSvg(page));
            const geometry = JSON.stringify([result.heights, result.barCount]);
            const stable =
                result.heights.length >= 4 && geometry === previousGeometry;
            previousGeometry = geometry;
            return stable;
        })
        .toBe(true);
    return result!;
}

async function hideCytobands(page: Page): Promise<void> {
    const settings = page.getByRole("button", {
        name: "View settings",
        exact: true,
    });
    await settings.click();
    await page
        .getByRole("checkbox", { name: "Cytobands", exact: true })
        .uncheck();
    await page.keyboard.press("Escape");
    await expect(
        page.getByRole("dialog", { name: "View settings", exact: true }),
    ).toBeHidden();
}

async function importTissue(page: Page): Promise<void> {
    await page
        .getByRole("button", { name: "View settings", exact: true })
        .click();
    await page
        .getByRole("button", {
            name: "Settings for Sample metadata",
            exact: true,
        })
        .click();
    await page
        .getByRole("button", { name: /Import metadata from .* source/ })
        .click();
    const dialog = page
        .getByRole("dialog")
        .filter({ hasText: /Import metadata from\s+figwig\s+source/ });
    await dialog.getByRole("combobox").fill("tissue");
    await dialog.getByRole("option", { name: "tissue", exact: true }).click();
    await dialog.getByRole("button", { name: "Import", exact: true }).click();
    await expect(dialog).toBeHidden();
}

async function retainTissue(page: Page, tissue: string): Promise<void> {
    const search = page.locator("genome-spy-search-field input");
    await search.click();
    await expect(
        page.locator("genome-spy-search-field .search-help"),
    ).toBeVisible();
    await search.fill(tissue);
    await search.press("Enter");
}

test("startup uses the native App and Open dialog, including the aggregation choice", async ({
    page,
}) => {
    await page.goto("http://127.0.0.1:5173/figwig-viewer/");
    await expect(page.locator(".genome-spy-app")).toHaveCount(1);
    await expect(page.locator(".genome-spy-container canvas")).toHaveCount(1);
    await expect(page.locator("genome-spy-toolbar")).toContainText(
        "Experimental Figwig Viewer",
    );
    const openDialog = page
        .getByRole("dialog")
        .filter({ hasText: "Open Figwig file" });
    // Let the native entrance transition finish before testing dismissal.
    await expect(openDialog).toHaveCSS("opacity", "1");
    await page.keyboard.press("Escape");
    await expect(
        page.getByRole("dialog").filter({ hasText: "Open Figwig file" }),
    ).toBeHidden();
    const annotations = await inspectSvg(page, await exportSvg(page));
    expect(annotations.trackOrder).toEqual([
        "ideogram-track",
        "ccre-track",
        "refseq-track",
    ]);
    expect(annotations.cytobandCount).toBeGreaterThan(0);
    expect(annotations.labels).toContain("Zoom in to load cCREs");
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(page.getByLabel("Signal aggregation")).toHaveValue("fast");
    await openLocal(page);
    await expect(page.locator("genome-spy-search-field input")).toHaveValue(
        "chr1:1-chrM:16,569",
    );
    await expect(
        page.getByRole("button", { name: "Share", exact: true }),
    ).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).hash).toBe("");

    await page
        .getByRole("button", { name: "File information", exact: true })
        .click();
    const information = page
        .getByRole("dialog")
        .filter({ hasText: "File information" });
    await expect(information).toContainText("Fast browsing");
    await expect(information).toContainText("hg38");
    await information
        .getByRole("button", { name: "Close", exact: true })
        .click();

    await page.getByRole("button", { name: "Open", exact: true }).click();
    await expect(
        page.getByRole("link", { name: "Provenance", exact: true }),
    ).toHaveAttribute(
        "href",
        "https://github.com/genome-spy/genomespy-dataset-recipes/tree/main/recipes/encode-mouse-fetal-chromatin-mm10",
    );
    await expect(
        page.getByRole("dialog").filter({ hasText: "Open Figwig file" }),
    ).toContainText("mm10 chr1");
    const exampleURL =
        "https://data.genomespy.app/datasets/encode-mouse-fetal-chromatin-mm10/v2/chromatin.fw";
    // Keep the example button on its real opening path without fetching biological data in CI.
    await page.route(exampleURL, async (route) => {
        await route.fulfill({
            response: await route.fetch({ url: fixtureOrigin + "/signed.fw" }),
        });
    });
    await page
        .getByRole("button", { name: "Open example", exact: true })
        .click();
    await expectOpened(page, "chromatin.fw");
    expect(new URL(page.url()).searchParams.get("url")).toBe(exampleURL);
});

test("local and cross-origin sources render the same signed hg38 signal", async ({
    page,
}) => {
    await page.goto("./");
    await openLocal(page);
    await navigate(page);
    const local = await inspectBaseResolution(page);
    expect(local.trackOrder).toEqual([
        "ideogram-track",
        "ccre-track",
        "samples",
        "refseq-track",
    ]);
    expect(local.cytobandCount).toBeGreaterThan(0);
    expect(local.ccreCount).toBeGreaterThan(0);
    expect(local.labels).toContain("SYNTH_GENE_A");
    expect(local.labels).toContain("sample-a");
    expect(local.labels).toContain("sample-b");
    // Both negative and positive fixture magnitudes must survive into visible bars.
    expect(local.heights.length).toBeGreaterThanOrEqual(4);
    expect(local.barCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Open", exact: true }).click();
    // A readable Content-Range is optional: verify real browser CORS filtering.
    await page
        .getByLabel("File URL", { exact: true })
        .fill(fixtureOrigin + "/unexposed-range.fw");
    await page.getByRole("button", { name: "Open URL", exact: true }).click();
    await expectOpened(page, "unexposed-range.fw");
    await navigate(page);
    const remote = await inspectBaseResolution(page);
    expect(remote.heights).toEqual(local.heights);
    expect(remote.barCount).toBe(local.barCount);
    await expect(
        page.getByRole("button", { name: "Share", exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("url")).toBe(
        fixtureOrigin + "/unexposed-range.fw",
    );
});

test("remote links replay the actual filtered rows and locus, then local opening clears remote state", async ({
    page,
}) => {
    await page.goto(
        "./?mode=exact&url=" + encodeURIComponent(fixtureOrigin + "/signed.fw"),
    );
    await expectOpened(page, "signed.fw");
    await navigate(page);
    await importTissue(page);
    await retainTissue(page, "heart");
    await hideCytobands(page);
    const filtered = await inspectSvg(page, await exportSvg(page));
    expect(filtered.cytobandCount).toBe(0);
    expect(filtered.labels).toContain("sample-a");
    expect(filtered.labels).not.toContain("sample-b");
    const locus = await page
        .locator("genome-spy-search-field input")
        .inputValue();
    // The URL update is debounced; a nonempty hash may still describe initial state.
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await page
        .getByRole("button", { name: "Make a link", exact: true })
        .click();
    const share = page.locator("gs-share-bookmark-dialog");
    const sharedURL = await share
        .getByLabel("Here's a link for you:", { exact: true })
        .inputValue();
    expect(new URL(sharedURL).searchParams.get("mode")).toBe("exact");
    const bookmark = JSON.parse(
        await share.locator("#bookmark-json").inputValue(),
    );
    expect(bookmark.scaleDomains.locus).toEqual([
        { chrom: "chr1", pos: 0 },
        { chrom: "chr1", pos: 255 },
    ]);
    expect(bookmark.actions.length).toBeGreaterThan(0);
    await expect
        .poll(() => new URL(page.url()).hash)
        .toBe(new URL(sharedURL).hash);
    await share.getByRole("button", { name: "Close", exact: true }).click();
    await page.reload();
    await expectOpened(page, "signed.fw");
    expect(new URL(page.url()).searchParams.get("mode")).toBe("exact");
    await expect(page.locator("genome-spy-search-field input")).toHaveValue(
        locus,
    );
    await page
        .getByRole("button", { name: "File information", exact: true })
        .click();
    const information = page
        .getByRole("dialog")
        .filter({ hasText: "File information" });
    await expect(information).toContainText("Exact means");
    await information
        .getByRole("button", { name: "Close", exact: true })
        .click();
    const replayed = await inspectSvg(page, await exportSvg(page));
    expect(replayed.cytobandCount).toBe(0);
    expect(replayed.labels).toContain("tissue");
    expect(replayed.labels).toContain("sample-a");
    expect(replayed.labels).not.toContain("sample-b");
    expect(replayed.barCount).toBe(filtered.barCount);

    const bytes = Array.from(await readFile(fixture("replacement.fw")));
    await page.evaluate((values) => {
        const transfer = new DataTransfer();
        transfer.items.add(
            new File([Uint8Array.from(values)], "replacement.fw"),
        );
        document.dispatchEvent(
            new DragEvent("drop", {
                dataTransfer: transfer,
                bubbles: true,
                cancelable: true,
            }),
        );
    }, bytes);
    await expectOpened(page, "replacement.fw");
    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).hash).toBe("");
    await expect(
        page.getByRole("button", { name: "Share", exact: true }),
    ).toHaveCount(0);
    await expect(
        page.getByRole("button", { name: "Open", exact: true }),
    ).toHaveCount(1);
    await navigate(page);
    const replacement = await inspectSvg(page, await exportSvg(page));
    expect(replacement.labels).toContain("sample-a");
    expect(replacement.labels).toContain("sample-b");
    expect(replacement.labels).not.toContain("tissue");
});

test("same-kind replacement preserves the App, canvas, and locus but resets the cohort", async ({
    page,
}) => {
    await page.goto("./");
    await openLocal(page);
    await navigate(page);
    await importTissue(page);
    await retainTissue(page, "heart");
    await hideCytobands(page);
    const filtered = await inspectSvg(page, await exportSvg(page));
    expect(filtered.cytobandCount).toBe(0);
    expect(filtered.labels).not.toContain("sample-b");
    const shell = await page.locator(".genome-spy-app").elementHandle();
    const canvas = await page
        .locator(".genome-spy-container canvas")
        .elementHandle();
    const locus = await page
        .locator("genome-spy-search-field input")
        .inputValue();
    const annotationReadCount = annotationRequests.get(page)!.length;

    await page.getByRole("button", { name: "Open", exact: true }).click();
    await openLocal(page, "replacement.fw");
    expect(await shell!.evaluate((element) => element.isConnected)).toBe(true);
    expect(await canvas!.evaluate((element) => element.isConnected)).toBe(true);
    await expect(page.locator(".genome-spy-app")).toHaveCount(1);
    await expect(page.locator(".genome-spy-container canvas")).toHaveCount(1);
    await expect(page.locator("genome-spy-search-field input")).toHaveValue(
        locus,
    );
    await expect(page.getByRole("button", { name: /^Undo/ })).toBeDisabled();
    const replacement = await inspectSvg(page, await exportSvg(page));
    expect(replacement.trackOrder).toEqual([
        "ccre-track",
        "samples",
        "refseq-track",
    ]);
    expect(replacement.cytobandCount).toBe(0);
    expect(replacement.ccreCount).toBeGreaterThan(0);
    expect(replacement.labels).toContain("SYNTH_GENE_A");
    expect(annotationRequests.get(page)!.length).toBe(annotationReadCount);
    expect(replacement.labels).toContain("sample-a");
    expect(replacement.labels).toContain("sample-b");
    expect(replacement.labels).not.toContain("tissue");

    // Overlapping sample ids must now resolve to the new file's metadata.
    await importTissue(page);
    await retainTissue(page, "kidney");
    const newMetadata = await inspectSvg(page, await exportSvg(page));
    expect(newMetadata.labels).toContain("sample-a");
    expect(newMetadata.labels).not.toContain("sample-b");
});

test("range and CORS failures and cancelled header inspection leave opening usable", async ({
    page,
}) => {
    await page.goto("./");
    await page
        .getByLabel("File URL", { exact: true })
        .fill(fixtureOrigin + "/ignore-range.fw");
    await page.getByRole("button", { name: "Open URL", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(/range|206/i);
    await expect(
        page.getByRole("button", { name: "Open URL", exact: true }),
    ).toBeEnabled();

    await page
        .getByLabel("File URL", { exact: true })
        .fill(fixtureOrigin + "/no-cors.fw");
    await page.getByRole("button", { name: "Open URL", exact: true }).click();
    await expect(page.getByRole("status")).toContainText(/CORS/);
    await expect(
        page.getByRole("button", { name: "Open URL", exact: true }),
    ).toBeEnabled();

    const pendingHeader = page.waitForRequest(
        (request) =>
            request.url().endsWith("/header-stall.fw") &&
            request.headers().range !== "bytes=0-0",
    );
    await page
        .getByLabel("File URL", { exact: true })
        .fill(fixtureOrigin + "/header-stall.fw");
    await page.getByRole("button", { name: "Open URL", exact: true }).click();
    await pendingHeader;
    await page
        .getByRole("button", { name: "Cancel opening", exact: true })
        .click();
    await expect(page.getByRole("status")).toContainText(/cancel/i);
    await expect(
        page.getByRole("button", { name: "Open URL", exact: true }),
    ).toBeEnabled();

    await page.getByLabel("Local file", { exact: true }).setInputFiles({
        name: "invalid.fw",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("not a Figwig file"),
    });
    await expect(page.getByRole("status")).toContainText(/truncated file/i);
    await expect(
        page.getByRole("button", { name: "Open URL", exact: true }),
    ).toBeEnabled();
    await openLocal(page);
});

test("native metadata import, filtering, and undo update the rendered samples", async ({
    page,
}) => {
    await page.goto("./");
    await openLocal(page);
    await navigate(page);
    await importTissue(page);
    const imported = await inspectSvg(page, await exportSvg(page));
    expect(imported.labels).toContain("tissue");
    await page.getByRole("button", { name: /^Undo/ }).click();
    const undone = await inspectSvg(page, await exportSvg(page));
    expect(undone.labels).not.toContain("tissue");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    const restored = await inspectSvg(page, await exportSvg(page));
    expect(restored.labels).toContain("tissue");

    await retainTissue(page, "heart");
    await hideCytobands(page);
    const filtered = await inspectSvg(page, await exportSvg(page));
    expect(filtered.cytobandCount).toBe(0);
    expect(filtered.labels).toContain("sample-a");
    expect(filtered.labels).not.toContain("sample-b");
    expect(filtered.barCount).toBeLessThan(restored.barCount);
    await page.getByRole("button", { name: /^Undo/ }).click();
    const unfiltered = await inspectSvg(page, await exportSvg(page));
    expect(unfiltered.labels).toContain("sample-b");
    expect(unfiltered.barCount).toBe(restored.barCount);
});
