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

Choose a local file, drop one onto the page, or enter a complete HTTPS file URL.
File extensions are not used to determine validity. A local file uses browser
random access and requires reselection after a page reload. Use the toolbar's
Open action to switch files; File information shows chromosome and track counts,
available metadata fields, and the GenomeSpy dependency identity.

Chromosome names and lengths come from the file. Tracks become samples with their
stored names. Use the App's metadata import controls to choose attributes; the
viewer does not import every column automatically. Initial queries use exact
means over the first megabase of the first non-empty chromosome, preserving
negative and zero values. A sparse file can initially show no signal: navigate to
the desired locus using the GenomeSpy search field.

Remote sources need to return HTTP 206 for byte ranges, allow the viewer's origin
through Access-Control-Allow-Origin, and expose Content-Range through
Access-Control-Expose-Headers. A server that ignores Range is rejected before its
body is consumed. HTTP URLs are accepted only for localhost development. URLs
requiring custom authorization headers are not supported.

Remote sessions retain the source in the url query parameter and let GenomeSpy
own the hash for view state. The native Share action includes both. Signed URLs
retain their tokens and access requirements and can expire. Local sessions keep
sample operations and undo/redo but disable source-sharing and persisted
bookmarks. Switching files clears the previous source's URL state.

File inspection can be cancelled and has a 30-second deadline. GenomeSpy's embed
launch does not expose cancellation; the loading screen offers Reload page if
that stage stalls. Once embedding returns, initial visible signal loading also
has a 30-second deadline.

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
npm release containing the required Figwig support. Remove the vendor snapshot,
preparation script, snapshot-only configuration and documentation, then rerun
clean installation, type checks, tests, and the production build. There is no
Pages deployment workflow yet; development CI only verifies the app.

## License

The viewer is MIT-licensed. GenomeSpy's notice is preserved alongside the temporary
snapshot archives; other dependencies retain their respective licenses.
