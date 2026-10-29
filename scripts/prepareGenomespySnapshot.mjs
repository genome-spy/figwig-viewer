import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const vendorDirectory = join(projectRoot, "vendor", "genomespy");
const manifestPath = join(vendorDirectory, "snapshot.json");
const previous = JSON.parse(readFileSync(manifestPath, "utf8"));
const [sourceFlag, localSource, ...extraArguments] = process.argv.slice(2);
if (
    sourceFlag !== undefined &&
    (sourceFlag !== "--source" || !localSource || extraArguments.length)
) {
    throw new Error(
        "Usage: node scripts/prepareGenomespySnapshot.mjs [--source /path/to/genome-spy]",
    );
}
if (!/^[a-f0-9]{40}$/.test(previous.commit)) {
    throw new Error("snapshot.json must pin a full Git commit SHA.");
}

const temporaryDirectory = mkdtempSync(
    join(tmpdir(), "figwig-viewer-genomespy-"),
);
const sourceDirectory = join(temporaryDirectory, "source");
const archiveDirectory = join(temporaryDirectory, "archives");
mkdirSync(sourceDirectory);
mkdirSync(archiveDirectory);

try {
    if (localSource) {
        const checkout = resolve(localSource);
        const commit = run(
            "git",
            ["rev-parse", previous.commit],
            checkout,
            true,
        ).trim();
        if (commit !== previous.commit) {
            throw new Error("Local source does not contain the pinned commit.");
        }
        // Export committed bytes, never the developer's working-tree changes.
        const archivePath = join(temporaryDirectory, "source.tar");
        run(
            "git",
            [
                "archive",
                "--format=tar",
                `--output=${archivePath}`,
                previous.commit,
            ],
            checkout,
        );
        run("tar", ["-xf", archivePath, "-C", sourceDirectory], projectRoot);
    } else {
        run("git", ["init", "--quiet"], sourceDirectory);
        run(
            "git",
            ["remote", "add", "origin", previous.repository],
            sourceDirectory,
        );
        run(
            "git",
            ["fetch", "--depth=1", "origin", previous.commit],
            sourceDirectory,
        );
        run("git", ["checkout", "--detach", "FETCH_HEAD"], sourceDirectory);
        if (
            run("git", ["rev-parse", "HEAD"], sourceDirectory, true).trim() !==
            previous.commit
        ) {
            throw new Error(
                "Upstream checkout does not match the pinned commit.",
            );
        }
    }

    run("npm", ["ci", "--no-audit", "--no-fund"], sourceDirectory);
    run("npm", ["run", "build"], sourceDirectory);

    const artifacts = [];
    for (const workspace of ["core", "app"]) {
        const packageDirectory = join(sourceDirectory, "packages", workspace);
        const packageManifest = JSON.parse(
            readFileSync(join(packageDirectory, "package.json"), "utf8"),
        );
        run(
            "npm",
            ["pack", "--silent", `--pack-destination=${archiveDirectory}`],
            packageDirectory,
        );
        const generatedFilename = `${packageManifest.name.replace(/^@/, "").replace("/", "-")}-${packageManifest.version}.tgz`;
        const filename = generatedFilename.replace(
            /\.tgz$/,
            `-${previous.commit.slice(0, 12)}.tgz`,
        );
        const bytes = readFileSync(join(archiveDirectory, generatedFilename));
        writeFileSync(join(vendorDirectory, filename), bytes);
        artifacts.push({
            name: packageManifest.name,
            version: packageManifest.version,
            filename,
            sha256: createHash("sha256").update(bytes).digest("hex"),
        });
    }

    const currentFilenames = new Set(
        artifacts.map((artifact) => artifact.filename),
    );
    for (const filename of readdirSync(vendorDirectory)) {
        if (filename.endsWith(".tgz") && !currentFilenames.has(filename)) {
            rmSync(join(vendorDirectory, filename));
        }
    }
    const licenseSource = ["LICENSE", "LICENSE.md"]
        .map((filename) => join(sourceDirectory, filename))
        .find(existsSync);
    if (!licenseSource) {
        throw new Error("The upstream license file is missing.");
    }
    copyFileSync(licenseSource, join(vendorDirectory, "LICENSE"));
    writeFileSync(
        manifestPath,
        JSON.stringify(
            {
                repository: previous.repository,
                commit: previous.commit,
                purpose:
                    "Development-only snapshot; remove before first GitHub Pages publication.",
                toolchain: {
                    node: process.version,
                    npm: run("npm", ["--version"], projectRoot, true).trim(),
                },
                commands: [
                    "npm ci --no-audit --no-fund",
                    "npm run build",
                    "npm pack --silent (core and app)",
                ],
                artifacts,
            },
            null,
            2,
        ) + "\n",
    );
    console.log(
        `Prepared GenomeSpy ${previous.commit} archives in ${vendorDirectory}`,
    );
} finally {
    rmSync(temporaryDirectory, { recursive: true, force: true });
}

/**
 * @param {string} command
 * @param {string[]} args
 * @param {string} cwd
 * @param {boolean} [capture]
 * @returns {string}
 */
function run(command, args, cwd, capture = false) {
    const result = spawnSync(command, args, {
        cwd,
        env: { ...process.env, HUSKY: "0" },
        encoding: "utf8",
        stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) {
        throw new Error(
            `${command} ${args.join(" ")} failed with status ${result.status}.`,
        );
    }
    return result.stdout ?? "";
}
