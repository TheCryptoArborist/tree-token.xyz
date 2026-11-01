"""Create sized WebP delivery copies of the existing, unchanged game artwork.

Run from any directory with Pillow installed. Originals are never overwritten.
This only resizes and encodes; page CSS supplies the visual background treatment.
"""
from pathlib import Path
import hashlib
import json
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ARTWORK = [
    ("assets/arcade/garden-bot-crest.png", "garden-bot-poster.webp", (512, 512)),
    ("assets/arcade/pvp-battle-crest.png", "pvp-battle-poster.webp", (512, 512)),
    ("assets/arcade/arborist-trials-logo.webp", "arborist-trials-poster.webp", (800, 267)),
    ("assets/arcade/canopy-clash-crest.png", "canopy-clash-poster.webp", (512, 512)),
    ("assets/arboretum-logo-black.webp", "arboretum-poster.webp", (512, 512)),
    ("assets/tree-force-89-logo-black.webp", "tree-force-89-poster.webp", (512, 512)),
]

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def main():
    records = []
    for source_name, output_name, dimensions in ARTWORK:
        source = ROOT / source_name
        target = ROOT / "assets/arcade" / output_name
        with Image.open(source) as original:
            image = original.convert("RGBA" if "A" in original.getbands() else "RGB")
            if image.size != dimensions:
                image = image.resize(dimensions, Image.Resampling.LANCZOS)
            image.save(target, "WEBP", quality=90, method=6, exact=True)
        with Image.open(target) as result:
            assert result.size == dimensions and result.format == "WEBP"
            assert ("A" in result.getbands()) == (image.mode == "RGBA")
        records.append({
            "source": source_name,
            "sourceSha256": digest(source),
            "sourceBytes": source.stat().st_size,
            "output": str(target.relative_to(ROOT)),
            "outputSha256": digest(target),
            "outputBytes": target.stat().st_size,
            "width": dimensions[0],
            "height": dimensions[1],
            "alphaPreserved": image.mode == "RGBA",
        })
    before = sum(row["sourceBytes"] for row in records)
    after = sum(row["outputBytes"] for row in records)
    report = {"originalBytes": before, "deliveryBytes": after,
              "reductionPercent": round(100 * (1 - after / before), 1),
              "encoding": "WebP quality 90, method 6; original proportions retained",
              "artwork": records}
    (ROOT / "docs/arcade-polish-assets.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({key: report[key] for key in ("originalBytes", "deliveryBytes", "reductionPercent")}))

if __name__ == "__main__":
    main()
