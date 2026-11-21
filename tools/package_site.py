"""Build the offline HTML and static-site archive from site/.

Usage: python3 tools/package_site.py [output-dir]   (default: exports/)
"""
from pathlib import Path
import base64
import re
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'site'
OUT = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else ROOT / 'exports'
OUT.mkdir(parents=True, exist_ok=True)
html = (SITE / 'index.html').read_text()
def embed_font(match):
    font = SITE / match[1]
    data = base64.b64encode(font.read_bytes()).decode()
    return 'url("data:font/' + font.suffix[1:] + ';base64,' + data + '")'

style = re.sub(r'url\("(assets/[^"]+\.(?:woff2|ttf))"\)', embed_font, (SITE / 'style.css').read_text())
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>' + style + '</style>')
font_licenses = sorted(path for path in (SITE / 'assets').rglob('*.txt') if path.name in {'OFL.txt','LICENSE.txt'})
license_text = '\n\n'.join(path.read_text() for path in font_licenses)
html = html.replace('</head>', '<script type="text/plain" id="font-license">\n' + license_text + '</script></head>')
scripts = ['fullscreen.js', 'content.js', 'audio.js', 'knob-inspector.js', 'learning-content.js', 'learning.js', 'dj-score.js', 'dj-synth.js', 'dj-storage.js', 'dj-export.js', 'finale.js', 'premiere.js', 'firmware.js', 'volume.js', 'app.js', 'intro.js', 'dock.js']
for name in scripts:
    html = html.replace(f'<script src="{name}" defer></script>', '')
# A file:// page cannot load a web manifest; the zip keeps it for the hosted site.
html = html.replace('<link rel="manifest" href="manifest.webmanifest">', '')
for attribute, asset in re.findall(r'(src|href)="(assets/[^"]+\.(?:webp|png))"', html):
    path = SITE / asset
    mime = {'webp': 'image/webp', 'png': 'image/png'}[path.suffix[1:]]
    data = base64.b64encode(path.read_bytes()).decode()
    html = html.replace(attribute + '="' + asset + '"', attribute + '="data:' + mime + ';base64,' + data + '"')
vendor = SITE / 'assets' / 'fm1-emu'
wasm = base64.b64encode((vendor / 'fm1_web.wasm').read_bytes()).decode()
worklet = (vendor / 'worklet.js').read_text().replace('</script', '<\\/script')
license = (vendor / 'LICENSE').read_text()
firmware = (f'<script type="text/plain" id="firmware-wasm">{wasm}</script>\n'
            f'<script type="text/plain" id="firmware-worklet">{worklet}</script>\n'
            f'<script type="text/plain" id="firmware-license">{license}</script>\n')
script = '\n'.join((SITE / name).read_text() for name in scripts)
script = script.replace('</script', '<\\/script')
html = html.replace('</body>', firmware + '<script>\n' + script + '\n</script></body>')
(OUT / 'A Little Sound Adventure.html').write_text(html)
with zipfile.ZipFile(OUT / 'A Little Sound Adventure - website.zip', 'w', zipfile.ZIP_DEFLATED) as archive:
    for path in sorted(SITE.rglob('*')):
        if path.is_file() and not path.name.startswith('.'):
            # The share video is already compressed; storing it keeps the build quick.
            stored = zipfile.ZIP_STORED if path.suffix == '.mp4' else zipfile.ZIP_DEFLATED
            archive.write(path, path.relative_to(SITE), compress_type=stored)
print('Built offline HTML and static-site ZIP.')
