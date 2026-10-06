"""Build responsive WebP covers without modifying original artwork.

Requires Pillow. Run from any directory:
    python tools/optimize_covers.py
    python tools/optimize_covers.py images/new-cover.png

The default set contains the current catalogue. Pass new artwork paths when
adding a project, then use the 480w and 960w variants in its coverSrcset.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_COVERS = ("dinorun3310", "mothership", "tweft", "istanbulparking")
WIDTHS = (480, 960)


def optimize(source: Path, output_dir: Path) -> None:
    with Image.open(source) as artwork:
        oriented = ImageOps.exif_transpose(artwork)
        mode = "RGBA" if "A" in oriented.getbands() or "transparency" in oriented.info else "RGB"
        original = oriented.convert(mode)

    for width in WIDTHS:
        # Keep the filename's width truthful and avoid enlarging small artwork.
        target_width = min(width, original.width)
        target_height = round(original.height * target_width / original.width)
        cover = original.resize((target_width, target_height), Image.Resampling.LANCZOS)
        destination = output_dir / f"{source.stem}-{target_width}.webp"
        # High quality preserves fine cover lettering; exact preserves RGB under alpha.
        cover.save(destination, "WEBP", quality=90, method=6, exact=True)
        print(f"{destination.relative_to(ROOT)}: {target_width}x{target_height}, {destination.stat().st_size:,} bytes")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("covers", nargs="*", type=Path, help="Original artwork paths, relative to the repository root or absolute")
    args = parser.parse_args()
    covers = args.covers or [Path("images") / f"{name}.png" for name in DEFAULT_COVERS]
    sources = [path if path.is_absolute() else ROOT / path for path in covers]
    for source in sources:
        if not source.is_file():
            parser.error(f"Artwork not found: {source}")
    output_dir = ROOT / "images" / "optimized"
    output_dir.mkdir(parents=True, exist_ok=True)
    for source in sources:
        optimize(source, output_dir)


if __name__ == "__main__":
    main()
