# Browser fixtures

These files contain original synthetic values written with the upstream Figwig
writer pinned in `scripts/generateFixtures.py`. They contain no biological data.
Run `uv run --python 3.12 scripts/generateFixtures.py` to regenerate them. Normal
JavaScript and browser tests use the committed files and require neither Python
nor network access. `provenance.json` records the writer and file fingerprints.

Both fixtures declare hg38 chr1 (248,956,422 bases) and chr2 (242,193,529 bases),
but write only the first 256 bases of each chromosome. Sparse storage keeps them
small while exercising the viewer's canonical assembly. Both have `sample-a`
and `sample-b` tracks, numerical `age` metadata and categorical `tissue` metadata.
`replacement.fw` keeps the same sample identities but changes tissues from
heart/brain to kidney/liver and doubles the signal.

For each chromosome, sample-a is -4 on [8,32), +8 on [32,64), NaN on [64,80),
and zero elsewhere. Sample-b is +3 on [16,48), -2 on [96,112), and zero elsewhere.
Replacement values are twice these values. Coordinates are zero-based half-open.
Navigate to chr1:1-256 to inspect these signed intervals at base resolution.
Both files use track-order storage, 16,384-base tiles, and no extra zoom levels.

The generator is original viewer-project code and invokes the upstream writer's
public API. It does not copy the upstream fixture generator or any dataset.
