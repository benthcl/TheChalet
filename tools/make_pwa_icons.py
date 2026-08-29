"""
Builds PWA icons from the chalet photo.

Outputs under icons/:
  icon-192.png, icon-512.png, icon-512-maskable.png, apple-touch-icon.png

Run from repo root:  python tools/make_pwa_icons.py
"""
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "photos" / "chalet1.jpg"
OUT = ROOT / "icons"

PINE = (31, 61, 50, 255)
WOOD = (176, 141, 87, 255)


def square_crop(img: Image.Image, bias_y: float = 0.38) -> Image.Image:
    w, h = img.size
    side = min(w, h)
    left = (w - side) // 2
    top = max(0, min(h - side, int((h - side) * bias_y)))
    return img.crop((left, top, left + side, top + side))


def make_icon(src: Image.Image, size: int, *, maskable: bool = False) -> Image.Image:
    """Photo icon on pine, optional maskable padding (safe zone ~80%)."""
    canvas = Image.new("RGBA", (size, size), PINE)
    pad = int(size * 0.12) if maskable else int(size * 0.06)
    inner = size - pad * 2
    photo = src.resize((inner, inner), Image.Resampling.LANCZOS)

    # Soft round-rect mask so the photo reads as an app glyph
    mask = Image.new("L", (inner, inner), 0)
    draw = ImageDraw.Draw(mask)
    radius = max(8, int(inner * 0.18))
    draw.rounded_rectangle((0, 0, inner - 1, inner - 1), radius=radius, fill=255)

    rounded = Image.new("RGBA", (inner, inner), (0, 0, 0, 0))
    rounded.paste(photo, (0, 0))
    rounded.putalpha(mask)

    # Thin wood ring
    ring = Image.new("RGBA", (inner, inner), (0, 0, 0, 0))
    rdraw = ImageDraw.Draw(ring)
    stroke = max(2, size // 64)
    rdraw.rounded_rectangle(
        (stroke // 2, stroke // 2, inner - 1 - stroke // 2, inner - 1 - stroke // 2),
        radius=radius,
        outline=WOOD,
        width=stroke,
    )

    canvas.paste(rounded, (pad, pad), rounded)
    canvas.paste(ring, (pad, pad), ring)
    return canvas


def main() -> None:
    OUT.mkdir(exist_ok=True)
    src = square_crop(Image.open(SOURCE).convert("RGB"))

    make_icon(src, 192).save(OUT / "icon-192.png", optimize=True)
    make_icon(src, 512).save(OUT / "icon-512.png", optimize=True)
    make_icon(src, 512, maskable=True).save(OUT / "icon-512-maskable.png", optimize=True)
    make_icon(src, 180).save(OUT / "apple-touch-icon.png", optimize=True)
    print(f"Wrote icons to {OUT}")


if __name__ == "__main__":
    main()
