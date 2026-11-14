# Blender model workshop

Odyssey Jr.'s world objects are real 3D models built with Blender, running as a Python module (no Blender app needed).

```bash
python3 -m venv /tmp/bvenv && /tmp/bvenv/bin/pip install bpy pillow numpy   # one-time setup per run (takes a minute)
/tmp/bvenv/bin/python tools/blender/textures.py                              # makes tex/*.png
/tmp/bvenv/bin/python tools/blender/build.py -- coop oak                     # builds + exports assets/models/coop.glb, oak.glb and renders preview/*.png
```

- Add a new model by writing a function in `build.py` (or your own script using its helpers: `box`, `cyl`, `sphere`, `mat`, `jitter`) and adding it to `ASSETS`.
- Scale: 1 unit = 1 world unit (Odyssey Jr. is ~2 tall). Origin at bottom center on the ground. Front faces Blender -Y.
- Colors in `mat()` are written like web colors (sRGB 0..1). Textures: planks, wood, shingles, stone, dirt, water, bark (add more in `textures.py`).
- Always look at the preview render before using a model, and keep each .glb small (well under 8 MB).
- Then place it in `world/world.json` as `{ "type": "model", "src": "assets/models/<name>.glb", ... }`.
