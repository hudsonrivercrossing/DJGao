"""Subset the pixel fonts to the characters the site uses.

Full fonts live in fonts-src/. Run after changing any text in site/:

    python3 tools/subset_fonts.py

Needs fonttools and brotli (pip install fonttools brotli).
"""
from pathlib import Path

from fontTools import subset

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
SOURCE = ROOT / 'fonts-src'
FONTS = [
    ('fusion-pixel-12px-proportional-zh_hans.otf.woff2', 'fusion-pixel/fusion-pixel-12px-proportional-zh_hans.subset.woff2'),
    ('PixelifySans.ttf', 'pixelify-sans/PixelifySans.subset.woff2'),
]


def used_text():
    text = ''.join(path.read_text() for path in sorted(SITE.glob('*.js')))
    text += (SITE / 'index.html').read_text()
    # Keep all printable ASCII so dynamic values (note names, numbers) always render.
    text += ''.join(chr(code) for code in range(0x20, 0x7f))
    return ''.join(sorted(set(text)))


def main():
    text = used_text()
    options = subset.Options()
    options.flavor = 'woff2'
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.notdef_outline = True
    for source, target in FONTS:
        font = subset.load_font(str(SOURCE / source), options)
        subsetter = subset.Subsetter(options)
        subsetter.populate(text=text)
        subsetter.subset(font)
        out = SITE / 'assets' / target
        subset.save_font(font, str(out), options)
        print(f'{out.relative_to(ROOT)}: {out.stat().st_size // 1024} KB')


if __name__ == '__main__':
    main()
