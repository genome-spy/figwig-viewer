#!/usr/bin/env python3
# /// script
# requires-python = ">=3.12,<3.13"
# dependencies = [
#   "figwig @ git+https://github.com/jmschrei/figwig.git@c0e5d6522c677b9f03cd6831e2dbcea759866628",
#   "numpy==2.5.4",
#   "numba==0.68.0",
#   "llvmlite==0.50.0",
# ]
# ///
"""Generate original, tiny browser fixtures; normal tests need no Python."""

import hashlib
import importlib.metadata
import json
import platform
from pathlib import Path

import figwig
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / "tests" / "fixtures"
HG38_CHROMOSOMES = {"chr1": 248_956_422, "chr2": 242_193_529}


def write_fixture(name: str, chromosomes: dict[str, int], replacement: bool = False) -> None:
    tracks = [
        {"name": "sample-a", "dtype": "float32", "tissue": "kidney" if replacement else "heart", "age": 12},
        {"name": "sample-b", "dtype": "float32", "tissue": "liver" if replacement else "brain", "age": 14},
    ]
    with figwig.FigWigWriter(
        ROOT / name,
        chromosomes,
        tracks,
        genome="hg38",
        tile=16_384,
        groups=2,
        level=0,
        order="tracks",
        zooms=0,
        n_jobs=1,
    ) as writer:
        for chromosome, length in chromosomes.items():
            # A short write keeps fixtures sparse despite canonical chromosome lengths.
            values = np.zeros((1, 2, min(length, 256)), dtype=np.float32)
            values[0, 0, 8:32] = -4
            values[0, 0, 32:64] = 8
            values[0, 0, 64:80] = np.nan
            values[0, 1, 16:48] = 3
            values[0, 1, 96:112] = -2
            if replacement:
                values *= 2
            writer.write(chromosome, [0], values)


def main() -> None:
    ROOT.mkdir(parents=True, exist_ok=True)
    write_fixture("signed.fw", HG38_CHROMOSOMES)
    write_fixture("replacement.fw", HG38_CHROMOSOMES, replacement=True)
    manifest = {
        "writer": {
            "repository": "https://github.com/jmschrei/figwig",
            "commit": "c0e5d6522c677b9f03cd6831e2dbcea759866628",
            "version": figwig.__version__,
            "python": platform.python_version(),
            "numpy": np.__version__,
            "numba": importlib.metadata.version("numba"),
        },
        "files": {
            path.name: {"bytes": path.stat().st_size, "sha256": hashlib.sha256(path.read_bytes()).hexdigest()}
            for path in sorted(ROOT.glob("*.fw"))
        },
    }
    (ROOT / "provenance.json").write_text(json.dumps(manifest, indent=2) + "\n")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
