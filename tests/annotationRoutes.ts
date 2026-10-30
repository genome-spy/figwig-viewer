import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { gzipSync } from "node:zlib";

const origin = "https://data.genomespy.app";
const fixtures = new Map([
    [
        origin + "/genomes/hg38/cytoBand.txt.gz",
        {
            type: "application/gzip",
            bytes: gzipSync(
                "chr1\t0\t128\tpSynthetic\tgneg\n" +
                    "chr1\t128\t248956422\tqSynthetic\tgpos50\n" +
                    "chr2\t0\t242193529\tpSynthetic2\tgneg\n",
            ),
        },
    ],
    [
        origin + "/genomes/hg38/refSeqGenes-hg38-release232.tsv.gz",
        {
            type: "application/gzip",
            bytes: gzipSync(
                "symbol\tchrom\tstart\tlength\tstrand\tscore\texons\n" +
                    "SYNTH_GENE_A\tchr1\t8\t104\t+\t5\t0,24,32,48\n" +
                    "SYNTH_GENE_B\tchr2\t8\t104\t-\t3\t0,24,32,48\n",
            ),
        },
    ],
    [
        origin + "/sample-data/encodeCcreCombined.hg38.bb",
        {
            type: "application/octet-stream",
            bytes: await readFile(
                new URL("./fixtures/annotations.bb", import.meta.url),
            ),
        },
    ],
]);

/** Preserve real gzip and BigBed parsing while keeping browser tests offline. */
export async function installAnnotationRoutes(
    page: Page,
): Promise<{ url: string; range: string | null }[]> {
    const requests: { url: string; range: string | null }[] = [];
    await page.route(
        (url) => fixtures.has(url.href),
        async (route) => {
            const fixture = fixtures.get(route.request().url())!;
            const range = route.request().headers().range;
            requests.push({ url: route.request().url(), range: range ?? null });
            const headers: Record<string, string> = {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers":
                    "Content-Range, Content-Length",
                "Accept-Ranges": "bytes",
                "Content-Type": fixture.type,
            };

            let start = 0;
            let end = fixture.bytes.length - 1;
            if (range) {
                const match = /^bytes=(\d+)-(\d*)$/.exec(range);
                start = match ? Number(match[1]) : fixture.bytes.length;
                end = match?.[2] ? Math.min(Number(match[2]), end) : end;
                if (!match || start > end) {
                    await route.fulfill({
                        status: 416,
                        headers: {
                            ...headers,
                            "Content-Range": "bytes */" + fixture.bytes.length,
                        },
                    });
                    return;
                }
                headers["Content-Range"] =
                    `bytes ${start}-${end}/${fixture.bytes.length}`;
            }

            const body = fixture.bytes.subarray(start, end + 1);
            headers["Content-Length"] = String(body.length);
            await route.fulfill({ status: range ? 206 : 200, headers, body });
        },
    );
    return requests;
}
