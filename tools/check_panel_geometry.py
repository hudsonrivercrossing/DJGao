"""Check browser-measured LED centers against the photograph's dark slots.
Requires Pillow; refresh preview/panel-geometry.json from a browser after geometry changes.
"""
from pathlib import Path
import json
from PIL import Image

root=Path(__file__).resolve().parents[1]
im=Image.open(root/'site/assets/fm1-pink.webp').convert('RGB')
assert im.size==(1800,1238), f'Source dimensions changed: {im.size}'
keys=json.loads((root/'preview/panel-geometry.json').read_text())
assert len(keys)==27 and len({k['midi'] for k in keys})==27
for key in keys:
    # Three points down the slot must fall on the original dark light aperture.
    for fraction in [-.3,0,.3]:
        point=(round(key['x']),round(key['y']+key['height']*fraction))
        assert max(im.getpixel(point))<65, f'LED misses slot: MIDI {key["midi"]}, {point}'
    assert abs(key['width']-8)<.15, key
print('27 LEDs: all 81 samples lie within original dark slots; source widths within 0.15 px.')
