"""Make the home-screen icons: the pink machine centred on the site's background, no transparency.

Usage: python tools/make_icons.py   (needs Pillow)

iOS fills transparent pixels with black, so every icon is flattened onto #100c18.
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'site' / 'assets' / 'fm1-pink.webp'
OUT = ROOT / 'site' / 'assets' / 'icons'
BACKGROUND = (0x10, 0x0c, 0x18, 255)
# The machine's width as a share of the icon; the rest is padding.
FILL = .78
SIZES = {'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512}


def machine():
    image = Image.open(SOURCE).convert('RGBA')
    # Crop to what is drawn: the alpha channel's bounding box (the drop shadow is not in the photo).
    return image.crop(image.getchannel('A').point(lambda a: 255 if a > 8 else 0).getbbox())


def icon(source, size):
    canvas = Image.new('RGBA', (size, size), BACKGROUND)
    width = round(size * FILL)
    height = round(width * source.height / source.width)
    scaled = source.resize((width, height), Image.LANCZOS)
    canvas.alpha_composite(scaled, ((size - width) // 2, (size - height) // 2))
    return canvas.convert('RGB')


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    source = machine()
    for name, size in SIZES.items():
        path = OUT / name
        icon(source, size).save(path, optimize=True)
        print(f'{path.relative_to(ROOT)}  {size}×{size}  {path.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
