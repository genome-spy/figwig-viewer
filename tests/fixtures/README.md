# Browser fixtures

These files contain original synthetic values written with the upstream Figwig
writer pinned in `scripts/generateFixtures.py`. They contain no biological data.
Run `uv run --python 3.12 scripts/generateFixtures.py` to regenerate them. Normal
JavaScript and browser tests use the committed files and require neither Python
nor network access. `provenance.json` records the writer and file fingerprints.

Both fixtures have `sample-a` and `sample-b` tracks, numerical `age` metadata and
categorical `tissue` metadata. `signed.fw` has custom `contigA` (256 bases) and
`contigB` (128 bases); `replacement.fw` has `replacement` (512 bases), different
tissues, and doubled signal. Both use track-order storage without zoom summaries.

For each chromosome, sample-a is -4 on [8,32), +8 on [32,64), NaN on [64,80),
and zero elsewhere. Sample-b is +3 on [16,48), -2 on [96,112), and zero elsewhere.
Replacement values are twice these values. Coordinates are zero-based half-open.

The generator is original viewer-project code and invokes the upstream writer's
public API. It does not copy the upstream fixture generator or any dataset.
