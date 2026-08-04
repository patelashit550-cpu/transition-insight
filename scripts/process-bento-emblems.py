"""Crop triptych → crisp bento emblems (supersampled strokes, site emerald on card bg)."""
from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "assets" / "yoga-elements-triptych.png"
OUT_DIR = ROOT / "public" / "visuals"
ASSETS_DIR = ROOT / "assets"

CARD_BG = (9, 9, 11, 255)
EMERALD = (52, 211, 153, 255)

# Triptych segments: filenames swapped so B1→rose, B3→lion match artwork.
SEGMENTS = (
    (0, "bento-lion-emerald.png"),
    (1, "bento-gem-emerald.png"),
    (2, "bento-rose-emerald.png"),
)

# Supersample before stroke extraction, then downscale for smooth curves.
UPSCALE = 8
TARGET_HEIGHT = 480


def stroke_mask(crop: Image.Image) -> Image.Image:
    """Soft alpha mask of green line art (L mode, 0–255)."""
    rgb = crop.convert("RGB")
    w, h = rgb.size
    mask = Image.new("L", (w, h), 0)
    px_rgb = rgb.load()
    px_m = mask.load()

    for y in range(h):
        for x in range(w):
            r, g, b = px_rgb[x, y]
            greenness = g - max(r, b)
            if greenness < 10 or g < 50:
                continue
            lum = r + g + b
            if lum < 80:
                continue
            # Soft ramp — avoids chunky on/off pixels from JPEG/triptych source.
            strength = min(255, int(greenness * 4.2 + (g - 50) * 0.35))
            if strength > px_m[x, y]:
                px_m[x, y] = strength

    # Clean speckle, smooth edges for display downscale.
    mask = mask.filter(ImageFilter.MedianFilter(size=3))
    mask = mask.filter(ImageFilter.GaussianBlur(radius=0.85))
    mask = ImageOps.autocontrast(mask, cutoff=2)
    return mask


def composite_emblem(mask: Image.Image) -> Image.Image:
    """Emerald strokes on card background using mask alpha."""
    layer = Image.new("RGBA", mask.size, CARD_BG)
    stroke = Image.new("RGBA", mask.size, EMERALD)
    layer.paste(stroke, mask=mask)
    return layer


def trim_to_content(img: Image.Image, pad: int = 12) -> Image.Image:
    bbox = img.getbbox()
    if not bbox:
        return img
    x0, y0, x1, y1 = bbox
    w, h = img.size
    return img.crop(
        (
            max(0, x0 - pad),
            max(0, y0 - pad),
            min(w, x1 + pad),
            min(h, y1 + pad),
        )
    )


def process_crop(crop: Image.Image) -> Image.Image:
    w, h = crop.size
    big = crop.resize((w * UPSCALE, h * UPSCALE), Image.Resampling.LANCZOS)
    emblem = composite_emblem(stroke_mask(big))
    emblem = trim_to_content(emblem)

    ratio = TARGET_HEIGHT / emblem.height
    target_w = max(1, int(emblem.width * ratio))
    emblem = emblem.resize((target_w, TARGET_HEIGHT), Image.Resampling.LANCZOS)
    emblem = emblem.filter(ImageFilter.UnsharpMask(radius=0.9, percent=175, threshold=1))

    # Opaque card mat — no semi-transparent fringe in browsers.
    flat = Image.new("RGBA", emblem.size, CARD_BG)
    flat.paste(emblem, mask=emblem.split()[3])
    return flat


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing source triptych: {SOURCE}")

    im = Image.open(SOURCE)
    width, height = im.size
    third = width // 3

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ASSETS_DIR.mkdir(parents=True, exist_ok=True)

    for index, filename in SEGMENTS:
        x0 = index * third
        x1 = width if index == 2 else (index + 1) * third
        processed = process_crop(im.crop((x0, 0, x1, height)))
        for dest in (OUT_DIR / filename, ASSETS_DIR / filename):
            processed.save(dest, format="PNG", compress_level=6)
        print(f"wrote {filename} ({processed.size[0]}x{processed.size[1]})")


if __name__ == "__main__":
    main()
