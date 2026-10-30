# Figwig Viewer implementation plan

Status: milestones 1–3 implemented and verified; local snapshots replaced by the App preview at 58bd423. The stable npm release and Pages publication remain pending.

Written: 2026-10-29.

Project directory: /Users/klavikka/projektit/figwig-viewer/.

Original implementation baseline (superseded by the preview dependency below): GenomeSpy master at [d983873abaa5e21b8b7eb35e55221a6e9a19f3da](https://github.com/genome-spy/genome-spy/commit/d983873abaa5e21b8b7eb35e55221a6e9a19f3da), verified against the clean local master checkout on this date. This is a fixed snapshot; subsequent master commits do not enter the viewer automatically.

## Intended result

A standalone, browser-only application deployed to GitHub Pages. Users open a local Figwig file through a file picker or drag-and-drop, or open a remote file through an HTTPS URL. The application inspects the file, generates a GenomeSpy App specification, and provides the existing sample-analysis interface with a small Figwig-specific plugin.

The project lives entirely in this directory. GenomeSpy remains an upstream dependency. The private genome-spy/figwig-viewer repository is initialized. Implementation through milestone 3 is complete on a feature branch; release migration and publication remain later work.

## Goals and scope

- Open files supported by the current Figwig v1 reader, without requiring the user to write a visualization specification.
- Read local data in the browser through random access, without uploading or loading the entire file into memory.
- Read remote data through byte-range requests and explain inaccessible or unsuitable servers.
- Derive the chromosome dictionary, sample identities, and available metadata from each file.
- Retain GenomeSpy App's navigation, sample operations, metadata import, undo/redo, and export controls.
- Add native toolbar actions for opening another file and inspecting file information.
- Make remote dataset links reloadable and shareable using the App's existing view-state persistence.
- Build reproducibly from a fresh clone and deploy static output under a GitHub Pages repository path.

The first version does not add a backend, proxy, desktop wrapper, file conversion, arbitrary user-authored specs, annotation downloads, multiple simultaneous Figwig files, or a new sample-analysis UI. Offline installation, recent-file persistence, local-file session restoration, advanced rendering presets, and custom authentication headers are deferred. A URL may contain a server-issued access token, but the browser's CORS and range requirements still apply.

## Architecture check

| Concern                             | Owner and reuse decision                                                                                                          |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Figwig parsing and header discovery | Use the published @genome-spy/figwig reader and generic-filehandle2. Do not implement the binary format in the viewer.            |
| Signal loading and rendering        | Use the preview App's existing Core Figwig lazy source, genome definitions, scales, marks, and data-loading APIs.                 |
| Sample identity and metadata        | Use App's Figwig metadata backend and samples.identity. Keep track names as canonical sample identifiers.                         |
| Sample operations and provenance    | Keep grouping, filtering, sorting, undo/redo, and metadata workflows in App.                                                      |
| Source lifecycle                    | A viewer controller owns candidate inspection, source URLs, the current embed, and replacement/disposal.                          |
| Viewer-specific UI                  | Use the public App plugin toolbar/menu interfaces and public dialog helpers. Do not reach through the agent API or patch App DOM. |
| Persistence                         | Use App's standalone mode for remote datasets and embedded mode for local datasets, as detailed below.                            |
| Packaging and deployment            | The viewer owns its build, lockfile, tests, and Pages workflow. No upstream changes are required by this design.                  |

Relevant upstream contracts at the pinned commit:

- [Architecture map](https://github.com/genome-spy/genome-spy/blob/d983873abaa5e21b8b7eb35e55221a6e9a19f3da/ARCHITECTURE.md) and [App architecture](https://github.com/genome-spy/genome-spy/blob/d983873abaa5e21b8b7eb35e55221a6e9a19f3da/packages/app/APP_ARCHITECTURE.md).
- [App embed and finalization](https://github.com/genome-spy/genome-spy/blob/d983873abaa5e21b8b7eb35e55221a6e9a19f3da/packages/app/src/index.js) and [public plugin/embed-mode types](https://github.com/genome-spy/genome-spy/blob/d983873abaa5e21b8b7eb35e55221a6e9a19f3da/packages/app/src/appTypes.d.ts).
- [Figwig signal source](https://github.com/genome-spy/genome-spy/blob/d983873abaa5e21b8b7eb35e55221a6e9a19f3da/packages/core/src/data/sources/lazy/figWigSource.js) and [query-mode contract](https://github.com/genome-spy/genome-spy/blob/d983873abaa5e21b8b7eb35e55221a6e9a19f3da/packages/core/src/spec/data.d.ts).
- [Figwig metadata adapter](https://github.com/genome-spy/genome-spy/blob/d983873abaa5e21b8b7eb35e55221a6e9a19f3da/packages/app/src/sampleView/metadata/adapters/figWigMetadataSourceAdapter.js), [sample grammar](https://github.com/genome-spy/genome-spy/blob/d983873abaa5e21b8b7eb35e55221a6e9a19f3da/packages/app/src/spec/sampleView.d.ts), and [root genome grammar](https://github.com/genome-spy/genome-spy/blob/d983873abaa5e21b8b7eb35e55221a6e9a19f3da/packages/core/src/spec/root.d.ts).

The compatibility boundary is an ordinary external consumer of the current App/Core packages. Verify both a metadata-rich multitrack file like the mouse recipe and an unrelated custom-genome file with negative signal, sparse metadata, and no summaries. The generic viewer must not inherit biological or presentation assumptions from the recipe.

## Decisions

### 1. Small TypeScript application

Use Vite, TypeScript, npm, and ordinary DOM code for the opening screen. Reuse the public App dialog helpers for the small plugin UI. A separate frontend framework and state-management library are unnecessary for this scope.

Use the App's public embed function and plugin types, and import @genome-spy/app/style.css. Explicitly exclude the development export condition in Vite so development resolves the JavaScript actually included in the npm archive; verify both the dev server and production preview. Derive the generated-spec type from the public embed signature when needed instead of importing unexported App implementation modules. Declare every directly imported package, including the Figwig reader, generic-filehandle2, and toolbar icons, as a direct dependency.

The opening screen contains Open file, a drop area, a labeled URL field, and a clear loading/error status. Keep its host outside the element owned by embed/finalize. Validate the file with the reader rather than relying on a .fw or .figwig suffix.

### 2. Use the pinned GenomeSpy App preview

Use `https://pkg.pr.new/@genome-spy/app@58bd423`, whose archive SHA-1 matches
`5cae70e9f3624758b46c7ba5e8b3c822f06a8ea3`. App declares the matching Core
preview transitively. The viewer needs no direct Core dependency, overrides,
local source checkout, vendored archives, manifest, or snapshot-build script.
Commit the npm lockfile so all preview dependencies have integrity hashes.

App bundles Core at runtime, while its declarations depend on Core types. The
preview's rewritten Core dependency keeps those artifacts aligned automatically.
Keep Vite's production export conditions because App's archive omits the
JavaScript referenced by its development exports. The existing dialog typing
bridge is still needed because the public dialog declarations reference omitted
implementation files. These are upstream App packaging issues.

Before the first Pages deployment, replace the preview dependency with a matching
stable npm release as previously agreed. Validate clean installation, public API
types, local/remote opening, and the production build before enabling deployment.

### 3. Inspect sources, then generate one generic App spec

For local input, inspect with FigWig and BlobFile(file). After validation, create one blob URL for the mounted App's signal and metadata sources. The existing signal source accepts a URL and constructs RemoteFile internally; a File object cannot be passed directly through that grammar.

For remote input, preserve the complete URL, including meaningful query parameters. Perform a bounded single-byte range probe before handing the source to the reader. Require HTTP 206; Content-Range exposure is optional and only supplies the displayed file size. Cancel an ignored-range response before reading its body. This avoids the reader accepting an initial 200 response and downloading a potentially huge file. A failed browser fetch should explain possible CORS, network, or authorization causes without claiming the browser can identify which one occurred.

Read the header and tracks, validate the supported-file boundary, and close the inspection reader after collecting the required immutable information. Do not scan signal chunks to discover coverage at startup.

Generate the following native structure:

- A custom genome named file, whose contigs preserve the header's chromosome names, lengths, and order; assembly references file. The header's genome label is informational and never substitutes for the actual dictionary.
- Stable view names such as samples and signal, and a stable metadata-source id figwig, so App's view-state addressing remains consistent.
- Sample identity from the Figwig metadata source, with track names as labels by default.
- A Figwig metadata source with initialLoad false. Identity is still available; users import attributes through App's existing interface. Do not import thousands of arbitrary columns automatically or add a parallel metadata inference system.
- One signal track with sampleId as the sample channel, locus start/end coordinates, quantitative score, a zero-inclusive y scale, and a neutral Signal label. Preserve negative and zero values. Use a signed-capable mark configuration, with no nonnegative-value filter.
- Signal track selection driven by the native visibleSamples expression, so App sample membership changes affect the requested tracks.
- Fast query mode by default, with exact means available explicitly. Start at the whole-genome hg38 extent supplied by the native locus scale, unless restoring a shared locus. Do not choose an arbitrary initial interval.

The recipe's mm10 assumption, rowLabel, tissue hierarchy, palettes, bookmarks, annotation tracks, assay labels, and nonnegative filtering are not part of the template. Fast browsing uses approximate summaries at coarse scales and counts missing values as zero; the opening dialog explains this and offers exact means explicitly. Fast mode requires suitable summaries at coarse scales.

### 4. Extend the App through a small plugin

Install a plugin for each embed that registers Open and File information actions. The controller supplies the opening callback and read-only file information; the plugin owns its UI registrations and returns a disposer.

File information shows the source name, byte size when known, genome label, chromosome and track counts, available metadata fields, and the GenomeSpy dependency version. During preview development, show the declared App dependency; the published app shows the released package version. Use a dialog in the first version. App's embedded mode does not attach a side-panel host, so a uniform dialog works for both source kinds without private shell access. A side panel is a later presentation enhancement if the public contracts support it for both modes.

Reuse native sample/metadata controls, export actions, and provenance. Add no duplicate toolbar, custom sample store, or dependence on agent-only exposure APIs. Show user-controlled labels and metadata as text or escaped templates.

### 5. Separate remote and local session semantics

Remote sources use standalone mode. Store their source locator in the page's url query parameter and reserve the hash for GenomeSpy. The URL remains a single page below the repository base, for example /figwig-viewer/?url=<encoded-source>#<app-state>. Do not add a router that competes for the hash.

Derive a source-specific specId from a digest of the full normalized source URL plus the viewer spec-format version. This namespaces remote browser bookmarks without placing raw access tokens in database names. Files are assumed immutable while open; versioned source URLs are recommended. A signed source URL retains its token and expiry when intentionally shared, so its link may stop working later. Do not add a recent-URL database in v1.

On initial bootstrap from a remote url query, preserve the incoming hash for App to restore. When the user explicitly opens another source, finalize the old instance and clear the old hash before embedding the next file. App's hash has no source binding; specId only namespaces browser bookmarks and cannot prevent incorrect hash replay by itself.

Local sources use embedded mode. This preserves local interaction controls and undo/redo while disabling the App's source-unaware Share button, browser URL state, and bookmarks. Omit specId, remove any old remote url query/hash, and keep the blob URL entirely out of the address bar. Explain that reopening the page requires choosing the file again. Persistent local sessions are deferred until there is an explicit identity/restoration contract.

### 6. Keep ownership and failure handling explicit

Serialize open operations by disabling new opens while inspection/mounting is active. Give range probing and header inspection a shared 30-second deadline and caller cancellation signal, with a Cancel opening action. App embed launch itself has no cancellation contract: identify that stage in the UI and offer a page reload if it stalls; do not imply that cancelling inspection can cancel embedding. Do not add overlapping embed or rollback machinery. Inspect a candidate before replacing a valid current viewer. After successful inspection, finalize the previous embed, then release its blob URL; mount the replacement and release its resources if mounting fails.

Close inspection readers on every exit path. Finalizing an embed also runs plugin disposers. Revoke a local blob URL only after its consumers have been finalized. Keep launcher/error UI usable after a failed open so the user can choose another source.

Handle rejected embed calls and asynchronous lazy-source errors. A fulfilled embed alone does not prove signal readiness: use the public data-loading snapshot and a bounded awaitVisibleLazyData wait for opening verification. Report a failed initial load clearly; runtime pan/zoom failures retain the App's normal error reporting. Recovery is a user-initiated open or navigation action, not silent mode changes or automatic retries.

### 7. Static deployment

Build all runtime assets into dist and deploy it through GitHub Actions. Configure the repository base path, expected initially to be /figwig-viewer/, while keeping it configurable for another repository name or a custom domain. Verify lazy chunks, CSS, fonts, and URL bootstrap under that non-root path. Follow the [Vite GitHub Pages deployment guidance](https://vite.dev/guide/static-deploy.html#github-pages).

Development CI installs the pinned preview dependencies from the committed lockfile, checks types and focused tests, builds, and runs browser smoke tests against the production output. Before enabling deployment, replace the preview with the stable GenomeSpy npm release as specified in milestone 4. Deployment CI then uses an ordinary npm ci from the release-based lockfile. The deployment job depends on those checks and publishes only dist. The workflow can be prepared before a GitHub repository is chosen; enabling Pages and performing the first deployment require both the actual remote destination and completion of the release migration. Do not publish a preview-backed app to Pages.

## Proposed files

- package.json, package-lock.json, TypeScript/Vite configuration, index.html, and .gitignore.
- src/main.ts for bootstrap and mounting.
- src/viewerController.ts for source and embed ownership.
- src/figwigSource.ts for local/remote inspection, range validation, and source descriptors.
- src/createViewerSpec.ts for the pure generic spec generator.
- src/figwigPlugin.ts and a small file-information dialog.
- src/styles.css for opening-screen and viewer-specific layout only.
- GenomeSpy App is a pinned preview URL in package.json; its Core preview is transitive. Keep dependency notices in public/specs/LICENSE.
- tests/fixtures/ with tiny original Figwig files and generation provenance, plus focused browser tests.
- .github/workflows/ for verification and Pages deployment.
- README.md for operation, server requirements, development, and preview/release migration.

Keep modules proportional to the implementation. Combine files when the split adds indirection without separating a real responsibility.

## Native App migration (2026-10-30)

This amendment supersedes the original opening-screen, file-derived assembly,
per-file embed, and generated root-spec decisions below. The original milestone
record remains useful history. The user has deferred GenomeSpy #629 and selected
hg38 for now. GenomeSpy #628 has shipped to master in #631.

### Architecture and current decisions

- Use the App preview at `https://pkg.pr.new/@genome-spy/app@58bd423`, with its
  matching Core preview installed transitively. Use only public App entry points.
  Keep the stable-release migration and Pages requirements in milestones 4 and 5.
- Launch GenomeSpy App immediately with persistent annotations in a named concat,
  fixed hg38, an explicitly owned zoomable locus scale, and shared x resolution. The native
  toolbar is the sole header. No landing card or separate welcome screen remains.
- Open and File information are persistent public plugin actions. Opening uses
  a BaseDialog subclass and native component styling. Drag/drop remains supported.
  Keep progress/error feedback in that dialog, with cancellation during inspection.
- Generate a SampleSpec containing the metadata identity, metadata backend, and
  signal track. Opening a replacement first inspects it, awaits old SampleView
  removal, releases its source, updates persistence context, then inserts the new
  SampleSpec. Rely on App for cohort/history cleanup and reader disposal.
- Use hg38 as supplied by the host. Do not infer or compare assemblies or implement
  #629. Test fixtures use canonical hg38 names/lengths with short sparse writes.
  Opening begins at the whole-genome hg38 extent. Preserve the existing locus
  when replacing an established cohort in the same App. The root description
  shown in the toolbar is "Experimental Figwig Viewer".
- Default to Fast browsing for local and remote files. Exact means remain an
  explicit choice and remote exact-mode links preserve `mode=exact` on reload.
  Keep the aggregation explanation visible in the opening dialog; do not silently
  switch modes after loading errors. Retain inspection cancellation/range checks.
- `setPersistenceContext` controls bookmark identity but not embedMode or URL hash
  ownership. Keep App alive for same-kind replacements. Recreate only on a local
  versus remote mode change, retaining the native interface throughout. This
  documented exception preserves existing local sharing/URL guarantees without
  private APIs, hidden controls, or upstream changes.
- For initial remote URL bootstrap, save/remove the incoming hash before empty
  App launch. Set source query/context and insert the cohort before restoring the
  saved hash through the native hashchange path. Local opens use embedded mode and
  no source context. Remote identity hashes the full normalized URL and the new
  hg38 spec version (and aggregation mode). Keep blob URLs out of source locators.
- File information reads current controller state; no per-source toolbar action
  accumulation. Source replacement remains serialized. A failed inspection keeps
  the current cohort; a failed insertion leaves an empty App ready for another
  open. No rollback or concurrent replacement framework is added.

### Milestone: native App startup and dynamic hg38 cohorts

Outcome: the viewer uses GenomeSpy's interface from startup, with local and URL
opening through one native dialog, public subtree replacement, and unchanged
source-specific persistence guarantees. Existing snapshot preparation is refreshed
only for development; publication remains blocked on released packages.

Affected areas: snapshot manifest/archives and dependencies; main/controller/spec
and plugin modules; native open dialog and minimal layout CSS; fixture generator,
fixtures, unit/browser tests; README and this plan. No upstream GenomeSpy edits.

Verification and acceptance:

- App toolbar/canvas exist before opening. The native Open dialog is keyboard
  usable, closes/reopens, and shows cancellable inspection and clear errors.
- Original signed hg38 fixtures render matching local/range-HTTP signal, preserving
  zeros and negative values. Initial and restored loci render visible data.
- Same-kind source replacement preserves shell/canvas identity and the locus,
  resets imported metadata/filtering/history, and creates no duplicate actions.
- Local/remote transitions select the supported embed mode, isolate source state,
  preserve remote URL/hash reload and disable local source sharing.
- Range/CORS failure, cancelled stalled inspection, invalid input, and failed
  insertion leave the interface usable for a subsequent valid open. Revoke each
  blob URL only after public removal or failed-insertion cleanup finishes.
- Formatting, TypeScript, focused Vitest tests, production build and Chromium flows
  pass. Inspect the actual opening dialog and rendered viewer visually. Do not
  re-upload the previously denied large local file through the integrated browser.
- README describes fixed hg38, whole-genome opening, native dialogs, mode-change
  exception, fast default and exact opt-in, snapshot identity and
  release-before-Pages condition.

Tentative commit: `feat: open hg38 cohorts in the native GenomeSpy interface`.

Implementation completed: the viewer now starts in the native App, uses a public
BaseDialog for local/URL opening, replaces same-kind SampleViews, and uses fixed
hg38 with viewport signal autoscaling. Fast browsing is the default after
large-file usage exposed the cost of exact-mode queries; exact means remain
explicitly available. Summary preflight is not included. The master snapshot and
Figwig 0.2.4 are installed with matching deduped App/Core packages.

Verification passed: TypeScript, 10 focused unit tests, production build, and all
six revised Chromium flows. Browser assertions cover actual remote metadata/filter
and locus replay, same-kind shell/canvas identity and cohort/history reset, signed
local/remote SVG equivalence, aggregation choice, cancellation/errors, and native
metadata/undo. Visual inspection confirmed the native dialog theme and signed
viewport axes. Independent implementation review found a Lit reactive-field issue;
it was fixed with a declared property and constructor assignment. No outstanding
material findings remain. Native App stays alive for same-kind replacements;
local/remote transitions use the documented embed-mode recreation boundary.

Release migration and Pages deployment remain pending; no upstream source changes
or deployment were made. Retain this plan while the PR is draft.

Independent plan review completed before implementation with no material findings.
Verify cancellation through native dialog Escape handling and actual locus/sample
state after deferred hash restoration, not only loading readiness. Reconcile the
amendment after verification. The original release
migration and deployment milestones remain pending.

## Persistent hg38 annotations (2026-10-30)

Add repository-owned JSON specifications under `public/specs/`, adapted from
GenomeSpy's curated cytoband, BigBed cCRE, and scored RefSeq examples. Preserve
their hosted `https://data.genomespy.app/` data URLs and source descriptions.
Record upstream provenance and retain the MIT notice alongside these copied
specifications. The paper specification is the composition reference; cohort
metadata and paper-specific data are not copied.

The root App owns the shared hg38 locus and composes cytobands, cCREs, and RefSeq
genes from these local spec URLs. Insert the dynamic SampleView at child index 2
through the public `views.insert` option, so the final order is cytobands, cCREs,
Figwig samples, RefSeq genes. Keep annotations alive across same-kind replacements,
including their visibility settings and collected data. Local/remote transitions
retain the existing App recreation boundary. Use independent color scales and a
single shared genomic x axis at the top of the stack, authored only on the root.
The SampleView explicitly shares its x axis across its default independent-axis
boundary. Remove descendant x-axis declarations and the cCRE example's authored
chr7 domain. Preserve the whole-genome default and Experimental Figwig Viewer
description.

The BigBed source queries at most a 1 Mb window. Gate only its feature layer with
native expression opacity using that same span threshold, and show a zoom-in hint
outside it. Give the hint its own singleton data and scope the BigBed source to
the feature layer. This avoids querying the full cCRE file or blocking visible-lazy-data
readiness on a deliberately inactive annotation. Keep native gene score/semantic
zoom and search behavior. Use public imports, composition, and insertion only.

One implementation milestone: ship these three local specs, root composition,
indexed SampleView insertion, provenance, and documentation together. Update the
remote persistence format version because the named view/settings structure now
includes annotations. Verify production and dev serving below `/figwig-viewer/`.

Acceptance: annotations render before any Figwig is chosen; a local or remote open
places samples between cCREs and genes; all tracks share locus navigation; sample
replacement keeps the annotation views and visibility state; shared links replay
locus, annotation visibility, and sample operations. Extend existing browser flows
with small synthetic annotation data and a real BigBed fixture so normal tests
remain offline. Run one bounded browser smoke against the actual hosted annotation
data at whole-genome and detailed loci. Check loading errors and visible output.
TypeScript, unit tests, formatting, build, and affected Chromium flows must pass.
No upstream source changes, annotation data mirroring, assembly switching, or
Pages publication are included.

Independent review completed before implementation. The cCRE domain removal,
separate hint data, shared loading threshold, and shared top locus axis are
included in the scope.

Tentative commit: `feat: add persistent hg38 annotation tracks`.

Implemented and verified: three local specs and MIT provenance, indexed cohort
insertion, independent colors and a single top locus axis, cCRE span gating,
and annotation-aware persistence are in place. TypeScript, 10 unit tests,
formatting, build, and all six Chromium flows passed. Regression coverage checks
rendered annotation records and order, retained visibility without refetching
on same-kind replacement, and visibility/locus/sample replay from remote links.
Independent implementation review found no material production issues and its
native-dialog visibility test improvement is included.

The hosted-data Chrome smoke loaded cytobands and RefSeq once, used partial
BigBed requests for 411 cCREs at chr7:66,600,001–66,800,000, and preserved exact
annotation/App/canvas identities across two synthetic Figwig opens. Whole-genome
and detailed screenshots were visually inspected. No private file was accessed
in this browser verification and no annotation data was copied into production.

## Current preview and remote-reader compatibility (2026-10-30)

The App preview at 58bd423 replaces the local snapshot bootstrap. The App archive
matches the user-supplied SHA-1, and its dependency manifest declares the matching
Core preview. Remove the vendored archives, snapshot manifest, preparation script,
and direct Core dependency. Preserve the existing MIT notice in public/specs/LICENSE.

Figwig 0.2.4 remains the published reader dependency. Remote signal and metadata
reads accept an unknown physical file size when CORS hides Content-Range. The
viewer requires HTTP 206 and displays Unknown when the file size is unavailable.
Known-size validation, truncated-read checks, cancellation, and rejection of
ignored ranges remain covered. The viewer continues to assume hg38 and labels
the curated example as mm10 chr1.

Preview migration verification passed: clean npm ci, type checks, 11 unit tests,
formatting, production build, and all six Chromium flows. The public chromatin
URL also opened in Chromium with Content-Range hidden from JavaScript, completed
overview and chr1 signal loading, and reported no browser errors. The rendered
view was visually inspected. Pages remains disabled.

## Implementation record (2026-10-29)

- Milestone 1 completed: clean pinned-source production build and real npm packing; checksummed App/Core archives; deduped matching dependency resolution; clean standalone npm ci, public TypeScript imports, and Vite development-entry smoke verification.
- Milestone 2 completed: picker, drop, and URL opening; bounded/cancellable inspection; strict range/CORS checking; file-derived genome and metadata identity; signed exact signal. Browser testing caught and fixed the explicit locus domain's inclusive upper-bound convention for a single-chromosome file.
- Milestone 3 completed: native plugin actions, file information, local embedded/remote standalone modes, source-specific bookmarks, remote state reload, and source switching with cleared hashes and disposed resources.
- Verification passed: formatting, TypeScript, nine focused Vitest tests, production build, and five Chromium browser flows. Coverage includes local/cross-origin SVG equivalence, signed values, custom contigs, source switching, CORS/range failures, cancelled stalled inspection, invalid-file recovery, and native metadata import, categorical filtering, and undo/redo. Independent implementation review found no material P1/P2 issues.
- Real-data smoke passed: the local mouse recipe's 89,771,464-byte Figwig opened with all 24 tracks, navigated to chr10:82,400,000–83,400,000, and reported ready signal data with no browser errors. No recipe dataset was copied into this repository.
- Milestones 4 and 5 remain pending. No Pages deployment workflow or publication has been performed. Firefox/WebKit smoke checks and additional grouping workflows remain part of broader pre-publication verification.

## Implementation milestones

### Milestone 1: Prove the external snapshot dependency boundary (completed; historical)

Outcome: a fresh standalone project installs the exact App/Core snapshot, type-checks public API imports, and renders a tiny Figwig through the production package artifacts.

Affected areas: project scaffold, snapshot preparation script/manifest, archives and lockfile, package imports, minimal render harness, and original fixtures. Downstream consumers are every later development and CI build.

Verification: build/package from a clean pinned checkout; verify checksums and package entry files; install in a fresh directory with npm ci; inspect App/Core dependency resolution; type-check embed and AppPlugin imports; smoke-test the dev server; build and open the harness below a repository-style base path. Confirm dynamically loaded Figwig assets and App CSS load from the snapshot. Test actual filehandle reads, not just a mocked source.

Documentation: record snapshot provenance, reproduction commands, supported toolchain, and third-party notices. No upstream package is republished.

Tentative commit: build: bootstrap viewer with pinned GenomeSpy snapshot

### Milestone 2: Open local and remote Figwig files with a generic view

Outcome: the opening screen and controller load local files and suitable remote URLs, generate the native spec, and expose sample/metadata workflows without recipe-specific assumptions.

Affected areas: source inspection/range probe, controller, generic spec generator, opening/error UI, and sample/metadata integration.

Verification: open the same fixture through File/blob and range-capable HTTP and compare sample identities and visible values; test a custom chromosome dictionary, signed and zero signal, absent optional metadata, and a file without summaries. Import a metadata attribute, filter/group samples, and undo to confirm the real metadata-to-visibleSamples-to-signal path. Reject truncated/unsupported input and servers that ignore ranges before consuming a whole body; successfully open a valid source afterward. Test file replacement and resource disposal through the user flow. Exercise stalled probes and stalled header reads; cancelling inspection must re-enable opening without replacing the existing viewer.

Documentation: explain local data handling, supported-file scope, exact-mode behavior, metadata import, initial locus, and remote CORS/range requirements.

Tentative commit: feat: open local and remote Figwig files

### Milestone 3: Integrate plugin actions and source-specific sessions

Outcome: Open and File information fit within the App interface; remote links restore App state; local views avoid unusable source-sharing controls; switching datasets resets source-dependent state.

Affected areas: plugin/dialog, bootstrap query handling, embed-mode selection, source-specific specId, URL replacement, and finalization.

Verification: open and dismiss plugin dialogs by keyboard; switch between two different fixtures, including overlapping sample names; verify no old hash actions, metadata, or view state affect the new file. Reload a remote url-plus-hash link and verify locus and sample operations restore. Verify local opens use embedded mode, remove the remote locator/hash, and never write a blob URL into shareable state. Check that reopening does not accumulate toolbar actions or event handlers.

Documentation: describe remote sharing/bookmarks and local reselection; record that access-controlled URLs retain their own expiry and access requirements.

Tentative commit: feat: add Figwig actions and source-specific sessions

### Milestone 4: Replace the preview with a stable npm release

Outcome: the viewer uses a stable GenomeSpy npm release containing the required changes before Pages publication. Local snapshot tooling is already removed; development uses the pinned App preview until the stable release is available.

Affected areas: App dependency URL and lockfile, dependency identity display, any remaining package compatibility configuration, and development documentation.

Verification: confirm that the selected release includes the required Figwig, metadata, plugin, and session APIs; install the released App package and its matching transitive Core dependency in a fresh checkout; verify dependency resolution; run type checks, focused behavior tests, the production build, and local/remote file-opening smoke tests. Confirm there are no local archive dependencies, snapshot fallback, preparation script, vendor snapshot directory, or neighboring-checkout requirements. Ordinary package compatibility configuration may remain only if the released packages still require it, with its purpose documented separately.

Documentation: replace preview update instructions with ordinary npm installation and updates; retain required third-party attribution; record the selected released versions.

Tentative commit: build: replace GenomeSpy preview with a stable release

### Milestone 5: Deliver a verified GitHub Pages build

Outcome: production assets built with the released GenomeSpy packages and a Pages workflow are ready for the selected remote repository, with deployment gated on meaningful checks and completion of milestone 4.

Affected areas: production base configuration, verification/deployment workflows, browser harness, and README.

Verification: run type checks, focused Vitest behavior tests, production build, and Playwright flows against dist under /figwig-viewer/. Serve remote fixtures from a distinct local origin with explicit range/CORS behavior, so same-origin tests cannot hide cross-origin problems. Check Chromium plus Firefox/WebKit smoke coverage before claiming support for those browsers. Confirm unrelated datasets are not fetched until opened and local signal bytes never leave the browser. Validate that a fresh clone needs neither the GenomeSpy working tree nor its node_modules.

Documentation: complete local development, GitHub Pages configuration, data-server troubleshooting, browser support, and normal dependency-update instructions. Once the release migration is complete, a remote destination exists, and deployment is authorized, verify the first deployed URL as the final integration check.

Tentative commit: ci: deploy verified viewer builds to GitHub Pages

## Final integration acceptance

- A tiny original multitrack fixture produces matching values and sample identities when opened locally and remotely, including negative values, explicit zero, and missing data.
- A file with a custom chromosome dictionary works without a built-in assembly or annotation download.
- Native metadata import, sample filtering/grouping, and undo affect the actual signal rows correctly.
- The local mouse fetal development recipe output can be opened and navigated to chr10:82400000-83400000, exercising its 24-track metadata-rich case without copying the dataset or its companion specs into this project.
- Local-to-remote, remote-to-local, and remote-to-different-remote switches respect source ownership, URL state, and plugin disposal.
- A remote source-plus-state URL reloads under the Pages repository base. A local open never exposes a reusable blob URL.
- Invalid files, inaccessible URLs, ignored ranges, and initial lazy-load failures produce a visible error and allow another valid open.
- The production site loads its CSS, icons/fonts where used, and lazy chunks correctly from a clean deployment.
- Before first deployment, dependency inspection and a clean production build demonstrate that matching published App/Core packages containing the required changes are used. There are no local archive dependencies, preparation tools, or snapshot/preview fallbacks. Any package compatibility configuration still needed is documented.

Use behavioral assertions and small numeric fixtures. Do not snapshot the entire generated spec or duplicate upstream renderer/parser tests. Production browser verification must wait for visible data and inspect public loading errors; an empty canvas with no thrown exception is not success.

## Risks, open decisions, and follow-up boundaries

- App packaging currently requires Vite production export conditions and the existing dialog typing bridge. These upstream package-boundary findings are recorded above; the viewer uses public entry points without importing monorepo source internals.
- Local and remote App embedding is verified in Chromium. Firefox/WebKit smoke checks remain pending; browser claims follow actual smoke results.
- Exact-mode overview queries can be expensive. visibleSamples represents sample membership, not vertical viewport culling. Very large track counts need measured follow-up; v1 must not silently truncate samples or promise unlimited scalability. Fast summaries support the default whole-genome view; exact mode remains an explicit, potentially expensive choice.
- Richer display settings and a side-panel design remain follow-ups. They must preserve the reader's explicit query semantics and the App's public UI boundaries.
- The required GenomeSpy release must be available and milestone 4 must be complete before the first Pages publication. If release timing changes, continue development and local verification with the pinned preview and keep deployment disabled.
- The private GitHub repository is genome-spy/figwig-viewer. The expected future Pages base is /figwig-viewer/; public visibility and Pages publication remain later work after milestone 4.
- The viewer is MIT-licensed. Preserve upstream MIT notices and annotation provenance. No third-party application code is copied into the viewer implementation; the established browser-only local/URL model is also used by [IGV-Web](https://igvteam.github.io/igv-webapp/).

An independent subagent review was completed on 2026-10-29. Its two P2 findings have been incorporated: Vite explicitly resolves the packaged production entry and the browser suite covers development; remote probing and inspection share a deadline and caller cancellation, while the UI documents App embedding's cancellation boundary.

During implementation, keep this document current. Retain it for draft discussion, then reconcile completed/deferred tasks and retire the temporary plan before the implementation branch is merged.
