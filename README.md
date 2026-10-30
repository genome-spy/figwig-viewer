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
packaged GenomeSpy production entry, since the package archive omits the source
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

## GenomeSpy preview dependency

Development uses the pinned
[GenomeSpy App preview at 58bd423](https://pkg.pr.new/@genome-spy/app@58bd423).
App declares its matching Core preview dependency, which npm installs transitively;
the viewer does not depend directly on Core. The lockfile records both preview
archives and their integrity hashes.

A fresh clone only needs `npm ci`. No local GenomeSpy checkout, vendored archives,
or snapshot-build script is required. To update the App preview:

```sh
npm install --save-exact https://pkg.pr.new/@genome-spy/app@<commit>
```

Keep the production export condition in Vite while App's archive omits the
JavaScript files referenced by its development exports. The File information
dialog identifies the App dependency used by the viewer.

**Before the first GitHub Pages deployment**, replace the previews with matching
npm releases containing the required Figwig and dynamic SampleView support, then
verify a clean installation, type checks, tests, and the production build. There
is no Pages deployment workflow yet; development CI only verifies the app.

## License

The viewer is MIT-licensed. GenomeSpy's MIT notice is retained in
[public/specs/LICENSE](public/specs/LICENSE); dependency packages retain their
respective licenses.
