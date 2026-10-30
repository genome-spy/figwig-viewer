# Figwig Viewer

A browser-only viewer for local and remote Figwig files, built with GenomeSpy App.

The viewer runs entirely in your browser. Local files are never uploaded. Remote
files are read directly from their server using HTTP byte-range requests.

## Development

Use Node.js 24 (or another version allowed by package.json) and npm 10.9 or newer.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173/figwig-viewer/. The dev server explicitly uses the
packaged GenomeSpy production entry, since the snapshot archive omits the source
files selected by its development export condition.

```sh
npm run check
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Browser tests start the production preview, a development server, and a separate
range/CORS fixture server. They use small synthetic files with original values;
normal tests do not require Python, biological datasets, or a network service.

To inspect the production build manually:

```sh
npm run build
npm run preview
```

Open http://127.0.0.1:4173/figwig-viewer/. Set VIEWER_BASE_PATH when building for a
different repository path or custom domain.

## Opening data

GenomeSpy App is visible from startup with hg38 cytobands, ENCODE cCREs, and
RefSeq genes. Its Open action opens a native dialog for
choosing a local file or entering a complete HTTPS URL. You can also drop one file
anywhere in the viewer. File information shows the current source, track count,
metadata fields, and dependency identity. Local files stay in your browser and
require reselection after reloading.

The Open dialog includes an ENCODE mouse fetal chromatin example with 256 tracks
on mm10 chromosome 1 and a link to its
[dataset recipe](https://github.com/genome-spy/genomespy-dataset-recipes/tree/main/recipes/encode-mouse-fetal-chromatin-mm10)
for provenance. Its coordinates differ from the viewer's current hg38 annotation
tracks.

The viewer currently assumes **hg38**. Files must use coordinates compatible with
that assembly. Assembly discovery, compatibility inference, and switching are
separate work tracked in [GenomeSpy #629](https://github.com/genome-spy/genome-spy/issues/629).

Tracks become samples using their stored names. Use View settings → Settings for
Sample metadata → Import metadata from figwig source to choose metadata columns.
The viewer does not import all columns automatically. Signal queries default to
Fast browsing, which uses approximate summaries at coarse scales and counts missing
values as zero. Choose Exact means in the opening dialog to omit NaNs from means;
exact queries over wide intervals can require substantial reading and decoding.
Both modes preserve negative and zero values. The signal y-axis autoscales to the
current viewport. A file without suitable summaries may fail at coarse zooms in
fast mode.

The viewer starts at the whole-genome hg38 extent. Navigate using GenomeSpy's
locus/search field. Shared links restore their saved locus. Replacing a file with another of the
same source kind keeps the App, canvas, and current locus, and replaces only the
SampleView. Imported metadata, sample operations, selections, and undo history reset
for the new cohort. Independent annotation siblings can be retained by this
lifecycle. The default order is cytobands, cCREs, Figwig samples, and RefSeq genes.
The annotation views and their visibility settings survive same-kind replacement.
Their JSON specifications are included in [public/specs](public/specs/README.md),
with data read directly from GenomeSpy's hosted annotation assets. cCREs load when
the visible span is at most 1 Mb; a hint appears at broader scales. RefSeq supports
gene-name search and detailed transcripts as you zoom in.

Remote sources must return HTTP 206 for byte ranges and allow the viewer's origin
through Access-Control-Allow-Origin. Exposing Content-Range through
Access-Control-Expose-Headers is optional; file size is shown as unknown when
that header is unavailable. A server that ignores Range is rejected before its
body is consumed. HTTP URLs are accepted only for localhost development. URLs
requiring custom authorization headers are not supported.

Remote sessions retain the source in the url query parameter and let GenomeSpy
own the hash for view state. Exact-mode links also include mode=exact. The native
Share action includes the source, query mode, and view state. Signed URLs
retain their tokens and access requirements and can expire. Local sessions keep
sample operations and undo/redo but disable source sharing and persisted bookmarks.
Switching files clears the previous source's state. App's embed mode is fixed at
construction, so switching between local and remote sources recreates the native
App; repeated opens of the same kind use dynamic SampleView replacement.

File inspection can be cancelled and has a 30-second deadline. During insertion,
the native dialog shows progress and offers Reload page if loading stalls. After
insertion, initial visible signal loading also has a 30-second deadline. Inspection
errors keep the previous file open; insertion failures leave an empty App ready
for another file.

## Temporary GenomeSpy snapshot

Figwig support is not yet available in the required released App/Core packages.
Development uses the exact master commit recorded in
[vendor/genomespy/snapshot.json](vendor/genomespy/snapshot.json). Both npm archives
are committed, with SHA-256 checksums and the upstream MIT notice. A fresh clone
does not depend on a local GenomeSpy checkout or rebuild GenomeSpy during npm ci.

To rebuild the pinned snapshot from upstream, or export its committed bytes from
an existing local Git repository:

```sh
npm run snapshot:prepare
npm run snapshot:prepare -- --source /path/to/genome-spy
npm install
```

The script runs the upstream production build and real npm pack lifecycle hooks
in a disposable directory. Do not edit or republish these archives. Snapshot
changes require updating the manifest, dependency paths, lockfile, and checks.

**Before the first GitHub Pages deployment**, switch App and Core to a matching
npm release containing the required Figwig and dynamic SampleView support. Remove the vendor snapshot,
preparation script, snapshot-only configuration and documentation, then rerun
clean installation, type checks, tests, and the production build. There is no
Pages deployment workflow yet; development CI only verifies the app.

## License

The viewer is MIT-licensed. GenomeSpy's notice is preserved alongside the temporary
snapshot archives; other dependencies retain their respective licenses.
