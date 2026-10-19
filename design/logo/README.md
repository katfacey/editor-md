# Editor, MD — 3D logo

Created in Blender with assistance from **OpenAI Codex**.

The mark uses two adjacent, extruded letter faces: a navy **M** and an orange
**D**. The M's right stem and D's left stem are one shared square corner
column. Its chunky, faceted construction takes inspiration from console-era
3D logos. Both letters have straight, perpendicular extrusion with no shear.
There are no duplicate letter faces on the rear sides.
Neutral white studio lights illuminate orange outlines around the navy M
and navy outlines around the orange D, including its inner opening. Both the
front and rear faces have matching outlines.

- `editor-md-logo.blend`: editable source, orthographic camera, and studio lights.
- `editor-md-logo.png`: verified 1536 × 1536 render with a transparent background.
- `editor-md-logo-rear-check.png`: 768 × 768 rear inspection render.
- `create-logo.py`: reproducible Blender geometry and scene setup.
- `finish-logo.py`: shared-stem union, contrasting outlines, and neutral lights.
- `update-rear-outlines.py`: matching rear outlines traced around the exposed
  faces of the united solid, including the opening in the D.
- `blender-command.cjs`: local client for the installed Blenderwright connector
  on `127.0.0.1:9876`. It uses the add-on's length-prefixed JSON TCP protocol.

The front-face materials use the editor's default dark-theme colors:
navy `#111e33` and orange `#f0a15a`. Rendered shading varies with the lights.
Both letters are custom meshes and require no external fonts or textures.

The saved file opens on the `Editor MD - Two Face Logo` scene. The original
scene was preserved in the file, and the original Blender file was not
overwritten. This asset has not yet been wired into the editor UI.

To regenerate in a Blender file that does not already contain the logo scene,
start Blenderwright with its user-controlled raw Python option enabled, then:

```powershell
node design/logo/blender-command.cjs execute_code design/logo/create-logo.py
node design/logo/blender-command.cjs execute_code design/logo/finish-logo.py
node design/logo/blender-command.cjs execute_code design/logo/update-rear-outlines.py
node design/logo/blender-command.cjs save_file '{"filepath":"F:/your-project/design/logo/editor-md-logo.blend"}'
node design/logo/blender-command.cjs render_image '{"filepath":"F:/your-project/design/logo/editor-md-logo.png"}'
```

The front and rear views were rendered and visually checked. The saved file
retains the original front camera composition.
