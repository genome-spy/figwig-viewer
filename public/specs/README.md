# hg38 annotation tracks

These local GenomeSpy specifications are adapted from the curated examples at
GenomeSpy commit `e8aeae207a71a869725393987dc32fe73db98e18`:

- [cytobands.json](https://github.com/genome-spy/genome-spy/blob/e8aeae207a71a869725393987dc32fe73db98e18/examples/docs/examples/genomic-data/cytobands.json)
- [bigbed-ccre-track.json](https://github.com/genome-spy/genome-spy/blob/e8aeae207a71a869725393987dc32fe73db98e18/examples/docs/grammar/data/lazy/bigbed-ccre-track.json)
- [scored-refSeq-genes.json](https://github.com/genome-spy/genome-spy/blob/e8aeae207a71a869725393987dc32fe73db98e18/examples/docs/examples/genomic-data/scored-refSeq-genes.json)

The upstream MIT license is retained in [LICENSE](LICENSE). The viewer supplies
hg38 and a shared locus scale, plus native visibility settings. The standalone
cCRE example's initial locus is omitted; its feature layer loads at spans up to
1 Mb and shows a zoom-in hint at broader scales. The parent viewer supplies
one shared coordinate axis above the full track stack.

Data remains on `https://data.genomespy.app/`: UCSC hg38 cytobands, the ENCODE
candidate cis-regulatory elements BigBed, and preprocessed NCBI RefSeq genes.
Each spec retains its upstream data-source description. The viewer does not
mirror these datasets. RefSeq's scored labels, transcript bodies, exons, strand
arrows, gene-name search, and native gene tooltips are preserved.

The vertical composition follows `private/genomespy-paper-2024-spec/spec.json`
in the user's GenomeSpy checkout. No paper-specific datasets or cohort metadata
are included here.
