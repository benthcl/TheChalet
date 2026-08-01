"""
Builds the email header banner from the chalet photo.

Output: photos/email-header.jpg — 1200x420 (shown at 600x210, retina ready).
Run from the repo root:  python tools/make_email_header.py
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "photos" / "chalet1.jpg"
TARGET = ROOT / "photos" / "email-header.jpg"

WIDTH, HEIGHT = 1200, 420
# Bias the crop upward so the roof, trees and mountain stay in frame
# instead of the cars and the driveway.
VERTICAL_BIAS = 0.34


def main() -> None:
    img = Image.open(SOURCE).convert("RGB")

    target_ratio = WIDTH / HEIGHT
    src_w, src_h = img.size

    if src_w / src_h > target_ratio:
        crop_h = src_h
        crop_w = round(src_h * target_ratio)
    else:
        crop_w = src_w
        crop_h = round(src_w / target_ratio)

    left = (src_w - crop_w) // 2
    top = round((src_h - crop_h) * VERTICAL_BIAS)

    banner = img.crop((left, top, left + crop_w, top + crop_h))
    banner = banner.resize((WIDTH, HEIGHT), Image.LANCZOS)
    banner.save(TARGET, "JPEG", quality=82, optimize=True, progressive=True)

    print(f"{TARGET.relative_to(ROOT)} -> {banner.size}, {TARGET.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
