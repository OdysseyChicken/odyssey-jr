import bpy, bmesh, math, random, os, sys
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "tex")                       # made by textures.py
OUT = os.path.join(HERE, "..", "..", "assets", "models")
PREV = os.path.join(HERE, "preview")                  # quick renders to check your work (not committed)
os.makedirs(OUT, exist_ok=True); os.makedirs(PREV, exist_ok=True)
random.seed(3)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

_mats = {}
def mat(name, color, rough=0.8, metal=0.0, tex=None, scale=(1, 1), emit=None, emit_strength=1.0):
    key = (name, tex, scale)
    if key in _mats and _mats[key].name in bpy.data.materials: return _mats[key]
    color = tuple(c ** 2.2 for c in color)  # colors here are written in sRGB like the website; Blender wants linear
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Roughness"].default_value = rough; b.inputs["Metallic"].default_value = metal
    if tex:
        img = bpy.data.images.load(f"{TEX}/{tex}.png", check_existing=True)
        it = nt.nodes.new("ShaderNodeTexImage"); it.image = img
        mp = nt.nodes.new("ShaderNodeMapping"); mp.inputs["Scale"].default_value = (scale[0], scale[1], 1)
        tc = nt.nodes.new("ShaderNodeTexCoord")
        nt.links.new(tc.outputs["UV"], mp.inputs["Vector"]); nt.links.new(mp.outputs["Vector"], it.inputs["Vector"])
        # tint the texture with the base color
        mix = nt.nodes.new("ShaderNodeMix"); mix.data_type = "RGBA"; mix.blend_type = "MULTIPLY"; mix.inputs["Factor"].default_value = 1.0
        mix.inputs[6].default_value = (*color, 1)
        nt.links.new(it.outputs["Color"], mix.inputs[7]); nt.links.new(mix.outputs[2], b.inputs["Base Color"])
        # glTF only exports a plain image texture into base color, so connect directly if tint is white
        if color == (1.0, 1.0, 1.0): nt.links.new(it.outputs["Color"], b.inputs["Base Color"])
    if emit:
        b.inputs["Emission Color"].default_value = (*emit, 1); b.inputs["Emission Strength"].default_value = emit_strength
    _mats[key] = m
    return m

def finish(o, m, bevel=0.0, smooth=True, segs=3):
    o.data.materials.clear(); o.data.materials.append(m)
    if bevel > 0:
        md = o.modifiers.new("bevel", "BEVEL"); md.width = bevel; md.segments = segs; md.limit_method = "ANGLE"
    if smooth:
        for p in o.data.polygons: p.use_smooth = True
        o.modifiers.new("ws", "WEIGHTED_NORMAL") if bevel > 0 else None
    return o

def box(name, size, loc, m, rot=(0, 0, 0), bevel=0.04):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, m, bevel)

def cyl(name, r1, r2, h, loc, m, rot=(0, 0, 0), verts=32, bevel=0.02):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r1, radius2=r2, depth=h, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name
    return finish(o, m, bevel)

def sphere(name, r, loc, m, scale=(1, 1, 1), sub=3, smooth=True):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub, radius=r, location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(o, m, 0, smooth)

def jitter(o, amt):
    for v in o.data.vertices: v.co += Vector((random.uniform(-amt, amt), random.uniform(-amt, amt), random.uniform(-amt, amt)))

def export(name):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=f"{OUT}/{name}.glb", export_format="GLB", use_selection=True, export_apply=True,
                              export_image_format="JPEG", export_jpeg_quality=85)
    print(name, round(os.path.getsize(f"{OUT}/{name}.glb") / 1024), "KB")

def preview(name):
    sc = bpy.context.scene
    bpy.ops.object.select_all(action="SELECT")
    objs = [o for o in sc.objects if o.type == "MESH"]
    mn = Vector((min(min((o.matrix_world @ Vector(c)).x for c in o.bound_box) for o in objs), min(min((o.matrix_world @ Vector(c)).y for c in o.bound_box) for o in objs), 0))
    mx = Vector((max(max((o.matrix_world @ Vector(c)).x for c in o.bound_box) for o in objs), max(max((o.matrix_world @ Vector(c)).y for c in o.bound_box) for o in objs), max(max((o.matrix_world @ Vector(c)).z for c in o.bound_box) for o in objs)))
    ctr = (mn + mx) / 2; rad = (mx - mn).length
    cam_data = bpy.data.cameras.new("cam"); cam = bpy.data.objects.new("cam", cam_data); sc.collection.objects.link(cam)
    cam.location = ctr + Vector((rad * 0.9, -rad * 1.3, rad * 0.75)); cam.rotation_euler = (ctr - cam.location).to_track_quat("-Z", "Y").to_euler()
    sc.camera = cam
    sun = bpy.data.objects.new("sun", bpy.data.lights.new("sun", "SUN")); sc.collection.objects.link(sun); sun.rotation_euler = (0.8, 0.2, 0.6); sun.data.energy = 3.5
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True; w.node_tree.nodes["Background"].inputs[0].default_value = (0.75, 0.85, 0.95, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    sc.view_settings.view_transform = "Standard"
    bpy.ops.mesh.primitive_plane_add(size=rad * 6, location=(ctr.x, ctr.y, 0)); g = bpy.context.object; g.data.materials.append(mat("ground", (0.45, 0.68, 0.32)))
    sc.render.engine = "CYCLES"; sc.cycles.samples = 24; sc.cycles.device = "CPU"
    sc.render.resolution_x = sc.render.resolution_y = 360; sc.render.filepath = f"{PREV}/{name}.png"
    bpy.ops.render.render(write_still=True)

# ---------------- assets ----------------
WOOD = (1, 1, 1)

def coop():
    planks = mat("coop_planks", (0.92, 0.42, 0.36), tex="planks", scale=(1.5, 1))
    trim = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    roof = mat("shingles", WOOD, tex="shingles", scale=(4.5, 2.2))
    dark = mat("door", (0.55, 0.4, 0.3), tex="wood")
    glow = mat("window", (1, 0.9, 0.6), rough=0.3, emit=(1, 0.8, 0.45), emit_strength=1.5)
    wood = mat("wood", WOOD, tex="wood")
    # raised floor on stubby legs
    for x in (-1.3, 1.3):
        for y in (-1.0, 1.0): cyl("leg", 0.1, 0.1, 0.35, (x, y, 0.17), wood)
    box("body", (3, 2.4, 1.8), (0, 0, 1.25), planks, bevel=0.05)
    for x in (-1.5, 1.5):
        for y in (-1.2, 1.2): box("corner", (0.14, 0.14, 1.86), (x, y, 1.25), trim, bevel=0.03)
    # gable roof: two slanted panels plus triangle ends
    ang = math.radians(32)
    for s in (-1, 1):
        box("roof", (3.6, 1.65, 0.12), (0, s * 0.68, 2.62), roof, rot=(-s * ang, 0, 0), bevel=0.03)
    box("ridge", (3.7, 0.2, 0.16), (0, 0, 3.1), trim, bevel=0.05)
    bm = bpy.data.meshes.new("gable"); verts = []
    for x in (-1.5, 1.5):
        me = bpy.data.meshes.new("gable"); me.from_pydata([(x, -1.2, 2.15), (x, 1.2, 2.15), (x, 0, 2.95)], [], [(0, 1, 2)]); me.uv_layers.new()
        o = bpy.data.objects.new("gable", me); bpy.context.scene.collection.objects.link(o); finish(o, planks, smooth=False)
        o.modifiers.new("solid", "SOLIDIFY").thickness = 0.05
    box("door", (0.8, 0.06, 1.1), (0, -1.22, 0.95), dark, bevel=0.03)
    box("door_frame", (0.95, 0.04, 1.22), (0, -1.205, 0.98), trim, bevel=0.02)
    sphere("knob", 0.05, (0.28, -1.27, 0.95), mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9))
    box("window", (0.55, 0.05, 0.5), (-0.95, -1.22, 1.55), glow, bevel=0.02)
    box("window_frame", (0.68, 0.04, 0.63), (-0.95, -1.205, 1.55), trim, bevel=0.02)
    box("sill", (0.75, 0.14, 0.06), (-0.95, -1.28, 1.25), trim)
    ra = math.atan2(0.36, 0.95)
    box("ramp", (0.6, 1.02, 0.06), (0, -1.72, 0.2), wood, rot=(ra, 0, 0))
    for i in range(4):
        f = 0.15 + i * 0.22; box("rung", (0.6, 0.05, 0.04), (0, -1.25 - f * 0.95, 0.38 - f * 0.36 + 0.04), trim, bevel=0.01)
    box("nameplate", (0.7, 0.04, 0.22), (0.85, -1.22, 1.75), mat("plate", (0.95, 0.85, 0.6), tex="wood"))

def oak():
    bark = mat("bark", WOOD, tex="bark", scale=(1, 2))
    t = cyl("trunk", 0.42, 0.26, 2.3, (0, 0, 1.15), bark, verts=16, bevel=0)
    jitter(t, 0.03)
    for a in (0, 2.2, 4.2): cyl("root", 0.18, 0.05, 0.7, (math.cos(a) * 0.35, math.sin(a) * 0.35, 0.12), bark, rot=(math.cos(a) * 1.2, -math.sin(a) * 1.2, 0) if False else (0, 1.3, a), verts=8, bevel=0)
    greens = [(0.31, 0.6, 0.23), (0.36, 0.67, 0.27), (0.27, 0.53, 0.2)]
    for i, (x, y, z, r) in enumerate([(0, 0, 3.1, 1.55), (0.9, 0.3, 2.7, 1.1), (-0.85, -0.3, 2.8, 1.05), (0.2, -0.8, 3.4, 0.95), (-0.3, 0.8, 3.5, 0.9), (0.1, 0.1, 4.0, 0.85)]):
        s = sphere("leaves", r, (x, y, z), mat(f"leaf{i%3}", greens[i % 3], rough=0.9), sub=2, smooth=True); jitter(s, r * 0.08)

def pine():
    bark = mat("bark", WOOD, tex="bark", scale=(1, 1))
    cyl("trunk", 0.24, 0.18, 1.2, (0, 0, 0.6), bark, verts=12, bevel=0)
    greens = [(0.18, 0.45, 0.27), (0.21, 0.52, 0.31), (0.24, 0.58, 0.35)]
    for i, (r, h, z) in enumerate([(1.55, 2.0, 1.9), (1.15, 1.7, 3.0), (0.75, 1.4, 3.95)]):
        c = cyl("needles", r, 0.05, h, (0, 0, z), mat(f"pine{i}", greens[i], rough=0.9), verts=10, bevel=0.06); jitter(c, 0.05)

def pond():
    water = mat("water", WOOD, rough=0.1, tex="water", scale=(2, 2))
    cyl("water", 2.4, 2.4, 0.06, (0, 0, 0.02), water, verts=48, bevel=0)
    st = mat("stone", WOOD, tex="stone")
    n = 22
    for i in range(n):
        a = i / n * math.tau; r = random.uniform(0.22, 0.34)
        s = sphere("stone", r, (math.cos(a) * 2.5, math.sin(a) * 2.5, 0.08), st, scale=(1.2, 1, 0.6), sub=1, smooth=False); jitter(s, 0.03)
    pad = mat("lilypad", (0.35, 0.65, 0.3), rough=0.6)
    for (x, y) in [(0.8, 0.5), (-0.9, -0.3), (0.2, -1.1)]:
        cyl("lilypad", 0.32, 0.32, 0.02, (x, y, 0.07), pad, verts=20, bevel=0)
    sphere("lily", 0.09, (0.85, 0.55, 0.13), mat("lilyflower", (1, 0.75, 0.85), rough=0.5), scale=(1, 1, 0.6))
    for (x, y) in [(2.1, 1.3), (2.3, 1.0)]:
        cyl("reed", 0.03, 0.03, 1.0, (x, y, 0.5), mat("reed", (0.35, 0.55, 0.25)), verts=6, bevel=0)
        cyl("cattail", 0.06, 0.06, 0.25, (x, y, 1.0), mat("cattail", (0.45, 0.28, 0.15)), verts=8)

def rock():
    s = sphere("rock", 0.8, (0, 0, 0.3), mat("stone", WOOD, tex="stone"), scale=(1.2, 1, 0.7), sub=2, smooth=False); jitter(s, 0.09)
    sphere("pebble", 0.25, (0.95, -0.4, 0.1), mat("stone", WOOD, tex="stone"), scale=(1, 1, 0.6), sub=1, smooth=False)

def flower(color):
    stem = mat("stem", (0.24, 0.55, 0.2))
    cyl("stem", 0.025, 0.025, 0.6, (0, 0, 0.3), stem, verts=8, bevel=0)
    sphere("leaf", 0.12, (0.08, 0, 0.18), stem, scale=(1.4, 0.5, 0.2))
    pm = mat(f"petal{color}", color, rough=0.6)
    for i in range(6):
        a = i / 6 * math.tau
        sphere("petal", 0.09, (math.cos(a) * 0.1, math.sin(a) * 0.1 - 0.02, 0.64), pm, scale=(1.2, 1.2, 0.4), sub=2)
    sphere("center", 0.07, (0, -0.03, 0.66), mat("pollen", (1, 0.85, 0.3), rough=0.7), scale=(1, 1, 0.6))

def sign():
    wood = mat("wood", WOOD, tex="wood")
    board = mat("board", (1, 0.86, 0.66), tex="planks", scale=(1, 0.5))
    for x in (-0.8, 0.8): box("post", (0.14, 0.14, 1.75), (x, 0, 0.87), wood, bevel=0.03)
    box("board", (2.0, 0.1, 0.75), (0, -0.05, 1.4), board, bevel=0.04)
    bpy.ops.object.text_add(location=(0, -0.11, 1.4), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "Odyssey Jr.'s Place"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.2; t.data.extrude = 0.012
    t.data.materials.append(mat("ink", (0.25, 0.16, 0.12), rough=0.9))
    bpy.ops.object.convert(target="MESH")

def workbench():
    wood = mat("wood", WOOD, tex="wood")
    top = mat("benchtop", (1, 0.92, 0.8), tex="planks", scale=(1, 0.6))
    box("top", (2.4, 1.1, 0.12), (0, 0, 0.92), top, bevel=0.03)
    for x in (-1.05, 1.05):
        for y in (-0.42, 0.42): box("leg", (0.14, 0.14, 0.9), (x, y, 0.45), wood, bevel=0.02)
    box("shelf", (2.2, 0.9, 0.06), (0, 0, 0.25), top)
    cyl("jar", 0.11, 0.11, 0.22, (0.7, 0.15, 1.09), mat("jar", (0.8, 0.85, 0.85), rough=0.2, metal=0.3))
    box("hammer_handle", (0.05, 0.5, 0.05), (-0.5, -0.1, 1.01), mat("handle", (0.75, 0.2, 0.18)), rot=(0, 0, 0.4))
    box("hammer_head", (0.22, 0.08, 0.08), (-0.4, -0.33, 1.02), mat("steel", (0.6, 0.62, 0.66), rough=0.35, metal=0.8), rot=(0, 0, 0.4))
    box("plank_stack", (0.9, 0.3, 0.12), (-0.3, 0.1, 0.34), wood)

def feeder():
    wood = mat("wood", WOOD, tex="wood")
    cyl("post", 0.07, 0.07, 1.0, (0, 0, 0.5), wood, verts=12)
    cyl("tray", 0.55, 0.6, 0.12, (0, 0, 0.06), mat("tray", (0.85, 0.35, 0.3), tex="planks"), verts=32)
    cyl("hopper", 0.3, 0.3, 0.5, (0, 0, 1.0), mat("glass", (0.95, 0.88, 0.6), rough=0.2), verts=24)
    cyl("roof", 0.45, 0.02, 0.35, (0, 0, 1.42), mat("feeder_roof", (0.45, 0.3, 0.22), tex="shingles"), verts=8, bevel=0.03)
    seedm = mat("seed", (0.9, 0.75, 0.3))
    for i in range(30):
        a = random.uniform(0, math.tau); r = random.uniform(0.15, 0.5)
        sphere("seed", 0.035, (math.cos(a) * r, math.sin(a) * r, 0.13), seedm, scale=(1.3, 1, 0.7), sub=1)

def dustbath():
    cyl("dirt", 1.3, 1.25, 0.08, (0, 0, 0.04), mat("dirt", WOOD, tex="dirt", scale=(2, 2)), verts=40, bevel=0.03)
    st = mat("stone", WOOD, tex="stone")
    for i in range(16):
        a = i / 16 * math.tau
        s = sphere("rim", 0.17, (math.cos(a) * 1.38, math.sin(a) * 1.38, 0.07), st, scale=(1.2, 1, 0.6), sub=1, smooth=False); jitter(s, 0.02)
    for (x, y) in [(0.4, 0.2), (-0.3, -0.5), (0.1, 0.6)]:
        sphere("feather", 0.08, (x, y, 0.1), mat("fluff", (1, 0.97, 0.9)), scale=(1.6, 0.5, 0.2))

ASSETS = {"coop": coop, "oak": oak, "pine": pine, "pond": pond, "rock": rock, "sign": sign, "workbench": workbench, "feeder": feeder, "dustbath": dustbath,
          "flower-pink": lambda: flower((1, 0.44, 0.66)), "flower-yellow": lambda: flower((1, 0.83, 0.3)), "flower-purple": lambda: flower((0.54, 0.49, 1))}
only = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else list(ASSETS)
for name in only:
    reset(); _mats.clear()
    ASSETS[name]()
    export(name)
    if "--nopreview" not in sys.argv: preview(name)
