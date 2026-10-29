import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const fixture = (name: string) =>
    fileURLToPath(new URL("./fixtures/" + name, import.meta.url));
const fixtureOrigin = "http://127.0.0.1:4174";

async function expectOpened(page: Page, name: string): Promise<void> {
    await expect(
        page.getByRole("status").filter({ hasText: "Opened " + name }),
    ).toBeVisible();
    await expect(
        page.getByRole("button", { name: "File information", exact: true }),
    ).toBeVisible();
}

async function openLocal(page: Page, name = "signed.fw"): Promise<void> {
    await page
        .getByLabel("Open file", { exact: true })
        .setInputFiles(fixture(name));
    await expectOpened(page, name);
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
    const download = await pending;
    const path = await download.path();
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
        };
    }, svg);
}

test("development server resolves the packaged App entry and opens a local file", async ({
    page,
}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("http://127.0.0.1:5173/figwig-viewer/");
    await openLocal(page);
    await expect(
        page.getByRole("button", { name: "Share", exact: true }),
    ).toHaveCount(0);
    expect(new URL(page.url()).search).toBe("");
    expect(new URL(page.url()).hash).toBe("");
    expect(errors).toEqual([]);
});

test("local and cross-origin sources render the same signed custom-genome signal", async ({
    page,
}) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("./");
    await openLocal(page);
    const local = await inspectSvg(page, await exportSvg(page));
    expect(local.labels).toContain("sample-a");
    expect(local.labels).toContain("sample-b");
    expect(local.labels.join(" ")).toContain("contigA");
    // Distinct negative and positive magnitudes must survive into exported bars.
    expect(local.heights.length).toBeGreaterThanOrEqual(4);
    expect(local.barCount).toBeGreaterThan(0);

    await page.getByRole("button", { name: "Open", exact: true }).click();
    await page
        .getByLabel("File URL", { exact: true })
        .fill(fixtureOrigin + "/signed.fw");
    await page.getByRole("button", { name: "Open URL", exact: true }).click();
    await expectOpened(page, "signed.fw");
    const remote = await inspectSvg(page, await exportSvg(page));
    expect(remote.heights).toEqual(local.heights);
    expect(remote.barCount).toBe(local.barCount);
    await expect(
        page.getByRole("button", { name: "Share", exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).searchParams.get("url")).toBe(
        fixtureOrigin + "/signed.fw",
    );
    expect(errors).toEqual([]);
});

test("remote view state reloads while switching to a local drop clears the source and state", async ({
    page,
}) => {
    await page.goto(
        "./?url=" + encodeURIComponent(fixtureOrigin + "/signed.fw"),
    );
    await expectOpened(page, "signed.fw");
    const canvas = page.locator(".genome-spy-container canvas");
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(
        box!.x + box!.width * 0.6,
        box!.y + box!.height * 0.5,
    );
    await page.mouse.wheel(0, -600);
    await expect.poll(() => new URL(page.url()).hash).not.toBe("");
    const hash = new URL(page.url()).hash;
    await page.reload();
    await expectOpened(page, "signed.fw");
    expect(new URL(page.url()).hash).toBe(hash);

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
    const output = await inspectSvg(page, await exportSvg(page));
    expect(output.labels.join(" ")).toContain("replacement");
    expect(output.labels.join(" ")).not.toContain("contigA");
});

test("rejected ranges and cancelled header inspection leave opening usable", async ({
    page,
}) => {
    await page.goto("./");
    await page
        .getByLabel("File URL", { exact: true })
        .fill(fixtureOrigin + "/ignore-range.fw");
    await page.getByRole("button", { name: "Open URL", exact: true }).click();
    await expect(page.locator(".opening-status.is-error")).toContainText(
        /range|206/i,
    );
    await expect(
        page.getByRole("button", { name: "Open URL", exact: true }),
    ).toBeEnabled();

    await page
        .getByLabel("File URL", { exact: true })
        .fill(fixtureOrigin + "/no-cors.fw");
    await page.getByRole("button", { name: "Open URL", exact: true }).click();
    await expect(page.locator(".opening-status.is-error")).toContainText(
        /CORS/,
    );
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
    await expect(page.locator(".opening-status.is-error")).toContainText(
        /cancel/i,
    );
    await expect(
        page.getByRole("button", { name: "Open URL", exact: true }),
    ).toBeEnabled();

    await page.getByLabel("Open file", { exact: true }).setInputFiles({
        name: "invalid.fw",
        mimeType: "application/octet-stream",
        buffer: Buffer.from("not a Figwig file"),
    });
    await expect(page.locator(".opening-status.is-error")).toHaveText(/.+/);
    await openLocal(page);
});

test("native metadata import, filtering, and undo update the rendered samples", async ({
    page,
}) => {
    await page.goto("./");
    await openLocal(page);
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
    const imported = await inspectSvg(page, await exportSvg(page));
    expect(imported.labels).toContain("tissue");

    await page.getByRole("button", { name: /^Undo/ }).click();
    const undone = await inspectSvg(page, await exportSvg(page));
    expect(undone.labels).not.toContain("tissue");
    await page.getByRole("button", { name: "Redo", exact: true }).click();
    const restored = await inspectSvg(page, await exportSvg(page));
    expect(restored.labels).toContain("tissue");

    // The native locus/search field can retain a matching metadata category.
    const search = page.locator("genome-spy-search-field input");
    await search.fill("heart");
    await search.press("Enter");
    const filtered = await inspectSvg(page, await exportSvg(page));
    expect(filtered.labels).toContain("sample-a");
    expect(filtered.labels).not.toContain("sample-b");
    expect(filtered.barCount).toBeLessThan(restored.barCount);
    await page.getByRole("button", { name: /^Undo/ }).click();
    const unfiltered = await inspectSvg(page, await exportSvg(page));
    expect(unfiltered.labels).toContain("sample-b");
    expect(unfiltered.barCount).toBe(restored.barCount);
});
