#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = ["pybigtools==0.3.0"]
# ///
"""Generate original annotation records; routine tests use the committed bytes."""

import hashlib
import importlib.metadata
import json
import platform
from pathlib import Path

import pybigtools

ROOT = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
CHROMOSOMES = {"chr1": 248_956_422, "chr2": 242_193_529}
AUTOSQL = '''table syntheticCcre
"Original synthetic annotation records for viewer tests"
(
    string chrom; "Chromosome"
    uint chromStart; "Zero-based start"
    uint chromEnd; "Exclusive end"
    string ucscLabel; "Synthetic regulatory element class"
)
'''


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    path = ROOT / "annotations.bb"
    records = [
        (chromosome, start, end, label)
        for chromosome in CHROMOSOMES
        for start, end, label in [(8, 32, "prom"), (64, 96, "enhD")]
    ]
    writer = pybigtools.open(str(path), "w")
    writer.write(CHROMOSOMES, records, autosql=AUTOSQL)

    manifest = {
        "writer": {
            "repository": "https://github.com/jackh726/bigtools",
            "package": "pybigtools",
            "version": importlib.metadata.version("pybigtools"),
            "python": platform.python_version(),
        },
        "files": {
            path.name: {
                "bytes": path.stat().st_size,
                "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
            }
        },
    }
    (ROOT / "annotations.provenance.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
