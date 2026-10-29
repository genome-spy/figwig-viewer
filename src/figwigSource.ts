import { FigWig, type Header, type Track } from "@genome-spy/figwig";
import { BlobFile, RemoteFile } from "generic-filehandle2";

export interface PreparedSource {
    kind: "local" | "remote";
    url: string;
    name: string;
    size: number | undefined;
    header: Header;
    tracks: readonly Track[];
    /** Release a local URL after its embedded viewer has been finalized. */
    dispose(): void;
}

/** Inspect metadata without reading signal chunks or keeping a reader open. */
export async function inspectFigwigSource(
    input: File | string,
    signal?: AbortSignal,
): Promise<PreparedSource> {
    const inspectionSignal = AbortSignal.any([
        AbortSignal.timeout(30_000),
        ...(signal ? [signal] : []),
    ]);
    inspectionSignal.throwIfAborted();

    const remoteUrl =
        typeof input === "string" ? parseRemoteUrl(input) : undefined;
    const size = remoteUrl
        ? await probeRangeAccess(remoteUrl.href, inspectionSignal)
        : (input as File).size;
    const reader = new FigWig({
        filehandle: remoteUrl
            ? new RemoteFile(remoteUrl.href)
            : new BlobFile(input as File),
    });

    let header: Header;
    try {
        header = await reader.getHeader({ signal: inspectionSignal });
        if (!header.tracks.length) {
            throw new Error("This Figwig file contains no signal tracks.");
        }
        if (!header.chromosomes.some((chromosome) => chromosome.length > 0)) {
            throw new Error(
                "This Figwig file contains no non-empty chromosomes.",
            );
        }
    } finally {
        await reader.close();
    }
    inspectionSignal.throwIfAborted();

    if (remoteUrl) {
        return {
            kind: "remote",
            url: remoteUrl.href,
            name:
                remoteUrl.pathname.slice(
                    remoteUrl.pathname.lastIndexOf("/") + 1,
                ) || remoteUrl.hostname,
            size,
            header,
            tracks: header.tracks,
            dispose() {},
        };
    } else {
        const file = input as File;
        const url = URL.createObjectURL(file);
        return {
            kind: "local",
            url,
            name: file.name,
            size,
            header,
            tracks: header.tracks,
            dispose() {
                URL.revokeObjectURL(url);
            },
        };
    }
}

function parseRemoteUrl(input: string): URL {
    let url: URL;
    try {
        url = new URL(input);
    } catch {
        throw new Error("Enter a complete HTTPS URL to a Figwig file.");
    }

    const isLocalHttp =
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !isLocalHttp) {
        throw new Error(
            "Remote files require an HTTPS URL. HTTP is allowed only on localhost.",
        );
    }

    return url;
}

async function probeRangeAccess(
    url: string,
    signal: AbortSignal,
): Promise<number> {
    let response: Response;
    try {
        response = await fetch(url, {
            headers: { Range: "bytes=0-0" },
            signal,
        });
    } catch (error) {
        signal.throwIfAborted();
        throw new Error(
            "Could not access the remote file. Check the URL and the server's CORS and authorization settings.",
            { cause: error },
        );
    }

    try {
        if (response.status !== 206) {
            throw new Error(
                `The server returned HTTP ${response.status}. Remote files require byte-range responses (HTTP 206).`,
            );
        }

        const match = /^bytes 0-0\/([1-9]\d*)$/i.exec(
            response.headers.get("Content-Range") ?? "",
        );
        const size = match ? Number(match[1]) : Number.NaN;
        if (!Number.isSafeInteger(size)) {
            throw new Error(
                "The server must return a valid Content-Range header and expose it through CORS.",
            );
        }
        return size;
    } finally {
        // Even a server that ignores Range must not make us consume its whole file.
        if (response.body) {
            await response.body.cancel();
        }
    }
}
