"""Package the existing Blender render as app icons; preserve the original art.

Created with assistance from OpenAI Codex. Requires Pillow.
"""
from pathlib import Path
from shutil import copyfile
from PIL import Image

root = Path(__file__).resolve().parents[2]
assets = root / 'assets'
assets.mkdir(exist_ok=True)
with Image.open(root / 'design/logo/editor-md-logo.png') as source:
    icon = source.convert('RGBA')
    icon.thumbnail((256, 256), Image.Resampling.LANCZOS)
    icon.save(assets / 'editor-md-icon.png')
    icon.save(assets / 'editor-md.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
copyfile(root / 'design/logo/editor-md-logo catgirl.png', assets / 'mascot.png')
print('Packaged the plain MD render as PNG/ICO; copied the supplied mascot unchanged.')
