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

# ---------------- Day 2: the airport ----------------
def arch_piece(name, x0, x1, z0, y, m, R=2.0, zc=1.4, th=0.1, n=24):
    """Flat slice of the hangar's quonset profile (walls up to zc, then a half circle), between x0..x1 and above z0."""
    top = lambda x: zc + math.sqrt(max(R * R - x * x, 0))
    pts = [(x0, z0), (x1, z0)] + [(x1 + (x0 - x1) * i / n, top(x1 + (x0 - x1) * i / n)) for i in range(n + 1)]
    me = bpy.data.meshes.new(name); me.from_pydata([(x, y, z) for x, z in pts], [], [list(range(len(pts)))]); me.uv_layers.new()
    o = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(o); finish(o, m, smooth=False)
    o.modifiers.new("solid", "SOLIDIFY").thickness = th
    return o

def hangar():
    R, zc, D = 2.0, 1.4, 4.2
    tin = mat("tin", (0.8, 0.83, 0.86), rough=0.4, metal=0.55)
    wall = mat("hangar_wall", (0.93, 0.88, 0.78), tex="planks", scale=(2, 1))
    trim = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    red = mat("hangar_red", (0.8, 0.22, 0.2), rough=0.6, tex="planks")
    dark = mat("inside", (0.2, 0.17, 0.15), rough=1)
    # roof: an open tube cut in half, so the front stays open like a real quonset hangar
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=R, depth=D, location=(0, 0, zc), rotation=(math.pi / 2, 0, 0), end_fill_type="NOTHING")
    roof = bpy.context.object; roof.name = "roof"
    bpy.ops.object.transform_apply(rotation=True)
    bm = bmesh.new(); bm.from_mesh(roof.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < zc - 0.01], context="VERTS"); bm.to_mesh(roof.data); bm.free()
    roof.data.uv_layers.new(); finish(roof, tin, smooth=True); roof.modifiers.new("solid", "SOLIDIFY").thickness = 0.08
    for s in (-1, 1): box("side", (0.1, D, zc), (s * R, 0, zc / 2), red, bevel=0.02)
    for i in range(5):  # rib bands over the roof
        y = -D / 2 + 0.1 + i * (D - 0.2) / 4
        bpy.ops.mesh.primitive_torus_add(major_radius=R + 0.05, minor_radius=0.05, location=(0, y, zc), rotation=(math.pi / 2, 0, 0))
        t = bpy.context.object; finish(t, trim)
    arch_piece("back", -R, R, 0, D / 2 - 0.05, wall)
    # front facade with a big door opening
    arch_piece("front_l", -R, -1.35, 0, -D / 2, wall); arch_piece("front_r", 1.35, R, 0, -D / 2, wall)
    arch_piece("front_top", -1.35, 1.35, 2.5, -D / 2, wall)
    box("dark_inside", (2.7, 0.05, 2.5), (0, D / 2 - 0.15, 1.25), dark, bevel=0)
    box("floor", (3.9, D, 0.06), (0, 0, 0.03), mat("concrete", (0.75, 0.74, 0.72), tex="stone", scale=(3, 3)), bevel=0)
    box("apron", (3.6, 2.2, 0.04), (0, -D / 2 - 1.1, 0.02), mat("concrete", (0.75, 0.74, 0.72), tex="stone", scale=(3, 3)), bevel=0.01)
    # slid-open doors
    for s in (-1, 1): box("door", (0.9, 0.08, 2.45), (s * 1.75, -D / 2 - 0.12, 1.25), red, bevel=0.02)
    box("door_rail", (4.4, 0.1, 0.08), (0, -D / 2 - 0.12, 2.52), mat("steel", (0.3, 0.3, 0.33), rough=0.4, metal=0.8))
    box("signboard", (1.9, 0.08, 0.5), (0, -D / 2 - 0.08, 3.0), mat("board", (1, 0.86, 0.66), tex="planks", scale=(1, 0.5)), bevel=0.03)
    bpy.ops.object.text_add(location=(0, -D / 2 - 0.13, 3.0), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ AIR"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.32; t.data.extrude = 0.015
    t.data.materials.append(mat("ink_red", (0.7, 0.15, 0.12), rough=0.8)); bpy.ops.object.convert(target="MESH")
    lamp = mat("hangar_lamp", (1, 0.9, 0.6), rough=0.3, emit=(1, 0.8, 0.45), emit_strength=2.0)
    for s in (-1, 1):
        box("lamp_arm", (0.05, 0.3, 0.05), (s * 1.5, -D / 2 - 0.2, 2.75), mat("steel", (0.3, 0.3, 0.33), rough=0.4, metal=0.8))
        cyl("lamp_shade", 0.06, 0.16, 0.12, (s * 1.5, -D / 2 - 0.35, 2.68), mat("shade", (0.2, 0.35, 0.3), rough=0.5))
        sphere("lamp_bulb", 0.06, (s * 1.5, -D / 2 - 0.35, 2.6), lamp)
    for (x, y) in [(-1.3, 1.2), (1.2, 1.3)]:  # barrels and a crate inside
        cyl("barrel", 0.25, 0.25, 0.6, (x, y, 0.36), mat("barrel", (0.25, 0.45, 0.7), rough=0.4, metal=0.4))
    box("crate", (0.6, 0.6, 0.6), (1.2, 0.6, 0.36), mat("wood", WOOD, tex="wood"))

def plane():
    yel = mat("cub_yellow", (1, 0.8, 0.22), rough=0.45)
    red = mat("cub_red", (0.82, 0.18, 0.15), rough=0.5)
    blk = mat("rubber", (0.12, 0.12, 0.13), rough=0.8)
    glass = mat("cub_glass", (0.55, 0.75, 0.9), rough=0.08, metal=0.2)
    steel = mat("steel", (0.6, 0.62, 0.66), rough=0.35, metal=0.8)
    sphere("fuselage", 1, (0, -0.15, 1.0), yel, scale=(0.45, 1.55, 0.5), sub=4)
    sphere("tailcone", 1, (0, 1.15, 1.1), yel, scale=(0.26, 1.15, 0.3), sub=4)
    sphere("stripe", 1, (0, 0.2, 0.95), red, scale=(0.455, 1.25, 0.12), sub=4)
    sphere("windows", 1, (0, -0.55, 1.35), glass, scale=(0.36, 0.5, 0.28), sub=4)
    cyl("cowl", 0.4, 0.44, 0.35, (0, -1.6, 0.98), red, rot=(math.pi / 2, 0, 0), verts=32)
    cyl("spinner", 0.13, 0.0, 0.3, (0, -1.92, 0.98), red, rot=(math.pi / 2, 0, 0), verts=24, bevel=0)
    # propeller: everything hangs off an empty at the hub so it spins around the nose (behaviors/plane.js turns "propeller")
    hub = (0, -1.86, 0.98)
    bpy.ops.object.empty_add(location=hub); piv = bpy.context.object; piv.name = "propeller"
    parts = []
    for s in (-1, 1):
        parts.append(box("prop_blade", (0.68, 0.04, 0.13), (s * 0.38, hub[1], hub[2]), mat("prop", (0.45, 0.28, 0.15), tex="wood"), rot=(s * 0.3, 0, 0), bevel=0.02))
        parts.append(box("prop_tip", (0.12, 0.045, 0.135), (s * 0.68, hub[1], hub[2]), yel, rot=(s * 0.3, 0, 0), bevel=0.02))
    parts.append(cyl("prop_hub", 0.09, 0.09, 0.08, hub, red, rot=(math.pi / 2, 0, 0), verts=16, bevel=0))
    disc_m = mat("prop_blur", (0.85, 0.82, 0.75), rough=0.6)
    disc_m.node_tree.nodes["Principled BSDF"].inputs["Alpha"].default_value = 0.22
    for attr, val in (("surface_render_method", "BLENDED"), ("blend_method", "BLEND")):
        try: setattr(disc_m, attr, val)
        except Exception: pass
    parts.append(cyl("prop_disc", 0.8, 0.8, 0.01, (hub[0], hub[1] - 0.02, hub[2]), disc_m, rot=(math.pi / 2, 0, 0), verts=40, bevel=0))
    for o in parts:
        o.parent = piv; o.matrix_parent_inverse = piv.matrix_world.inverted()
    for s in (-1, 1):
        box("wing", (2.2, 0.85, 0.09), (s * 1.1, -0.45, 1.55), yel, bevel=0.04)
        box("wing_tip", (0.2, 0.86, 0.1), (s * 2.25, -0.45, 1.55), red, bevel=0.04)
        box("strut", (0.04, 0.05, 1.0), (s * 0.85, -0.45, 1.05), steel, rot=(0, s * 0.95, 0))
        box("gear", (0.05, 0.05, 0.55), (s * 0.45, -0.75, 0.42), steel, rot=(0, -s * 0.5, 0))
        cyl("wheel", 0.24, 0.24, 0.13, (s * 0.6, -0.75, 0.24), blk, rot=(0, math.pi / 2, 0), verts=24, bevel=0.04)
        cyl("hub", 0.08, 0.08, 0.15, (s * 0.6, -0.75, 0.24), red, rot=(0, math.pi / 2, 0), verts=12)
        bpy.ops.object.text_add(location=(s * 0.27, 1.75, 1.15), rotation=(math.pi / 2, 0, s * math.pi / 2))
        t = bpy.context.object; t.data.body = "OJ-1"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.22; t.data.extrude = 0.01
        t.data.materials.append(red); bpy.ops.object.convert(target="MESH")
    box("wing_center", (0.5, 0.85, 0.09), (0, -0.45, 1.55), yel, bevel=0.04)
    box("stabilizer", (1.5, 0.45, 0.06), (0, 2.15, 1.15), yel, bevel=0.03)
    box("fin", (0.06, 0.55, 0.6), (0, 2.2, 1.5), red, rot=(-0.35, 0, 0), bevel=0.03)
    cyl("tailwheel", 0.08, 0.08, 0.05, (0, 2.1, 0.08), blk, rot=(0, math.pi / 2, 0), verts=12)
    # tail wheel strut: from under the tail (front, top) down and back to the tail wheel
    box("tailstrut", (0.04, 0.04, 0.75), (0, 2.01, 0.49), steel, rot=(0.245, 0, 0))
    for sx in (-1, 1): box("tailfork", (0.015, 0.1, 0.12), (sx * 0.04, 2.1, 0.12), steel, bevel=0.005)

def windsock():
    steel = mat("pole", (0.92, 0.92, 0.9), rough=0.4, metal=0.5)
    cyl("pole", 0.06, 0.05, 3.4, (0, 0, 1.7), steel, verts=12)
    cyl("base", 0.35, 0.4, 0.15, (0, 0, 0.07), mat("concrete", (0.75, 0.74, 0.72), tex="stone"), verts=20)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.03, location=(0.22, 0, 3.3), rotation=(0, math.pi / 2, 0))
    finish(bpy.context.object, steel)
    sphere("cap", 0.08, (0, 0, 3.42), mat("beacon", (1, 0.3, 0.2), rough=0.3, emit=(1, 0.2, 0.1), emit_strength=2.0))
    st = mat("stone", WOOD, tex="stone")
    for i in range(10):
        a = i / 10 * math.tau; s = sphere("rim", 0.12, (math.cos(a) * 0.62, math.sin(a) * 0.62, 0.05), st, scale=(1.2, 1, 0.6), sub=1, smooth=False); jitter(s, 0.02)

def runway():
    L, W = 28, 3
    tar = mat("asphalt", (0.5, 0.5, 0.52), rough=0.95, tex="stone", scale=(14, 1.5))
    paint = mat("paint", (0.97, 0.96, 0.92), rough=0.7)
    box("strip", (L, W, 0.05), (0, 0, 0.025), tar, bevel=0.02)
    box("shoulder", (L + 0.6, W + 0.6, 0.02), (0, 0, 0.01), mat("dirt", WOOD, tex="dirt", scale=(10, 1)), bevel=0)
    for i in range(10):  # centerline dashes
        x = -9 + i * 2.0; box("dash", (1.0, 0.12, 0.012), (x, 0, 0.056), paint, bevel=0)
    for s in (-1, 1):
        for k in range(6):  # piano keys at each threshold
            box("key", (1.1, 0.16, 0.012), (s * (L / 2 - 0.8), -1.1 + k * 0.44, 0.056), paint, bevel=0)
    for txt, x, rz in (("9", -L / 2 + 2.3, -math.pi / 2), ("27", L / 2 - 2.3, math.pi / 2)):
        bpy.ops.object.text_add(location=(x, 0, 0.052), rotation=(0, 0, rz))
        t = bpy.context.object; t.data.body = txt; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 1.1; t.data.extrude = 0.006
        t.data.materials.append(paint); bpy.ops.object.convert(target="MESH")
    post = mat("lightpost", (0.3, 0.3, 0.33), rough=0.4, metal=0.6)
    edge = mat("runway_light", (1, 0.95, 0.75), rough=0.2, emit=(1, 0.85, 0.5), emit_strength=1.0)
    grn = mat("runway_light_green", (0.5, 1, 0.6), rough=0.2, emit=(0.2, 1, 0.35), emit_strength=1.0)
    rd = mat("runway_light_red", (1, 0.5, 0.45), rough=0.2, emit=(1, 0.15, 0.1), emit_strength=1.0)
    n = 9
    for i in range(n):
        x = -L / 2 + 0.6 + i * (L - 1.2) / (n - 1)
        for s in (-1, 1):
            cyl("lightpost", 0.04, 0.04, 0.25, (x, s * (W / 2 + 0.2), 0.12), post, verts=8, bevel=0)
            sphere("edge_light", 0.08, (x, s * (W / 2 + 0.2), 0.28), edge, sub=2)
    for k in range(4):
        y = -1.2 + k * 0.8
        sphere("end_light", 0.08, (-L / 2 - 0.25, y, 0.12), grn, sub=2)
        sphere("end_light", 0.08, (L / 2 + 0.25, y, 0.12), rd, sub=2)

ASSETS.update({"hangar": hangar, "plane": plane, "windsock": windsock, "runway": runway})

def tower():
    # OJ Tower: a little wooden airfield control tower (Day 2 bonus). Ladder on the +X side, balcony deck, glass cab, rotating beacon.
    paint = mat("tower_paint", (0.97, 0.94, 0.86), rough=0.75)
    red = mat("tower_red", (0.8, 0.22, 0.2), rough=0.6)
    trim = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    wood = mat("wood", WOOD, tex="wood")
    stone = mat("stone", WOOD, tex="stone", scale=(2, 1))
    steel = mat("steel", (0.3, 0.3, 0.33), rough=0.4, metal=0.8)
    glass = mat("tower_glass", (0.6, 0.8, 0.92), rough=0.05, metal=0.3, emit=(1, 0.82, 0.5), emit_strength=0.25)
    deckH = 4.6
    cyl("plinth", 1.35, 1.3, 0.4, (0, 0, 0.2), stone, verts=8)
    sh = cyl("shaft", 0.95, 0.72, deckH - 0.4, (0, 0, 0.4 + (deckH - 0.4) / 2), paint, verts=8, bevel=0.03)
    sh.rotation_euler.z = math.pi / 8
    for z in (1.6, 3.2):  # red bands like a real tower
        b = cyl("band", 0.92 - z * 0.05, 0.9 - z * 0.05, 0.16, (0, 0, z), red, verts=8, bevel=0.01); b.rotation_euler.z = math.pi / 8
    box("door", (0.06, 0.6, 1.0), (0.94, -0.0, 0.92), mat("door", (0.55, 0.4, 0.3), tex="wood"), rot=(0, 0.0, 0), bevel=0.02)
    box("door", (0.6, 0.06, 1.0), (0, -0.92, 0.92), mat("door", (0.55, 0.4, 0.3), tex="wood"), bevel=0.02)
    lamp = mat("tower_lamp", (1, 0.9, 0.6), rough=0.3, emit=(1, 0.8, 0.45), emit_strength=2.0)
    for z in (2.4, 3.8):
        box("slit", (0.32, 0.05, 0.45), (0, -0.88 + z * 0.045, z), lamp, rot=(-0.06, 0, 0), bevel=0.02)
    # balcony deck with a railing
    cyl("deck", 1.85, 1.85, 0.16, (0, 0, deckH), wood, verts=8, bevel=0.03).rotation_euler.z = math.pi / 8
    cyl("deck_under", 1.0, 1.85, 0.45, (0, 0, deckH - 0.3), paint, verts=8, bevel=0.02).rotation_euler.z = math.pi / 8
    for i in range(16):
        a = i / 16 * math.tau
        if abs(math.atan2(math.sin(a), math.cos(a))) < 0.3: continue   # gap where the ladder arrives
        cyl("rail_post", 0.035, 0.035, 0.6, (math.cos(a) * 1.75, math.sin(a) * 1.75, deckH + 0.38), trim, verts=8, bevel=0)
    for z in (0.62, 0.36):
        bpy.ops.mesh.primitive_torus_add(major_radius=1.75, minor_radius=0.035, location=(0, 0, deckH + z), major_segments=48, minor_segments=8)
        r = bpy.context.object; r.name = "rail"; finish(r, red)
        bm = bmesh.new(); bm.from_mesh(r.data)   # open the ring at the ladder
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.x > 1.6 and abs(v.co.y) < 0.45], context="VERTS"); bm.to_mesh(r.data); bm.free()
    # the cab: windows tilted outward (that's how real towers stop glare and reflections)
    c0, c1 = deckH + 0.08, deckH + 1.95
    cyl("cab_base", 1.05, 1.05, 0.35, (0, 0, c0 + 0.17), paint, verts=8, bevel=0.02).rotation_euler.z = math.pi / 8
    g = cyl("cab_glass", 1.02, 1.28, c1 - c0 - 0.35, (0, 0, (c0 + 0.35 + c1) / 2), glass, verts=8, bevel=0); g.rotation_euler.z = math.pi / 8
    for i in range(8):
        a = i / 8 * math.tau
        zm = (c0 + 0.35 + c1) / 2; rm = 1.15
        o = box("mullion", (0.07, 0.07, c1 - c0 - 0.3), (math.cos(a) * rm, math.sin(a) * rm, zm), trim, bevel=0.01)
        o.rotation_euler = (-math.sin(a) * 0.19, math.cos(a) * 0.19, a)
    roofH = c1 + 0.08
    cyl("roof", 1.55, 1.45, 0.16, (0, 0, roofH), red, verts=8, bevel=0.03).rotation_euler.z = math.pi / 8
    cyl("roof_cap", 1.2, 0.5, 0.35, (0, 0, roofH + 0.25), red, verts=8, bevel=0.02).rotation_euler.z = math.pi / 8
    cyl("beacon_base", 0.28, 0.24, 0.25, (0, 0, roofH + 0.55), steel, verts=16)
    # rotating beacon: one green and one white lamp back to back (that means "land airport" in pilot language)
    bpy.ops.object.empty_add(location=(0, 0, roofH + 0.82)); piv = bpy.context.object; piv.name = "beacon"
    parts = [cyl("beacon_drum", 0.22, 0.22, 0.32, (0, 0, roofH + 0.82), steel, verts=20)]
    gm = mat("beacon_green", (0.5, 1, 0.6), rough=0.2, emit=(0.2, 1, 0.35), emit_strength=2.0)
    wm = mat("beacon_white", (1, 1, 0.95), rough=0.2, emit=(1, 0.97, 0.85), emit_strength=2.0)
    parts.append(cyl("beacon_lens_g", 0.13, 0.13, 0.08, (0.22, 0, roofH + 0.82), gm, rot=(0, math.pi / 2, 0), verts=16, bevel=0))
    parts.append(cyl("beacon_lens_w", 0.13, 0.13, 0.08, (-0.22, 0, roofH + 0.82), wm, rot=(0, math.pi / 2, 0), verts=16, bevel=0))
    parts.append(sphere("beacon_top", 0.1, (0, 0, roofH + 1.0), steel, sub=2))
    for o in parts: o.parent = piv; o.matrix_parent_inverse = piv.matrix_world.inverted()
    # antenna with a red tip
    cyl("antenna", 0.025, 0.015, 1.3, (-0.7, 0.5, roofH + 0.75), steel, verts=6, bevel=0)
    sphere("antenna_tip", 0.06, (-0.7, 0.5, roofH + 1.42), mat("runway_light_red", (1, 0.5, 0.45), rough=0.2, emit=(1, 0.15, 0.1), emit_strength=1.0), sub=2)
    # sign on the front of the deck
    box("signboard", (1.4, 0.07, 0.36), (0, -1.95, deckH - 0.25), mat("board", (1, 0.86, 0.66), tex="planks", scale=(1, 0.5)), bevel=0.03)
    bpy.ops.object.text_add(location=(0, -2.0, deckH - 0.25), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ TOWER"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.24; t.data.extrude = 0.012
    t.data.materials.append(mat("ink_red", (0.7, 0.15, 0.12), rough=0.8)); bpy.ops.object.convert(target="MESH")
    # ladder on +X, leaning from the ground up to the gap in the railing
    bx, tx, top = 2.75, 1.9, deckH + 0.9
    ang = math.atan2(bx - tx, top); L = math.hypot(bx - tx, top)
    for s in (-1, 1):
        box("ladder_rail", (0.07, 0.07, L), ((bx + tx) / 2, s * 0.32, top / 2), wood, rot=(0, -ang, 0), bevel=0.015)
    n = 15
    for i in range(n):
        f = (i + 0.6) / n; x = bx + (tx - bx) * f; z = top * f
        if z > deckH + 0.1: break
        cyl("rung", 0.03, 0.03, 0.62, (x, 0, z), trim, rot=(math.pi / 2, 0, 0), verts=8, bevel=0)
    # a little crate of flags and a lamp on the deck
    box("crate", (0.35, 0.35, 0.3), (-1.2, -0.9, deckH + 0.23), wood)
    cyl("flag_pole", 0.02, 0.02, 0.7, (-1.25, -0.85, deckH + 0.6), steel, verts=6, bevel=0)
    box("flag", (0.03, 0.32, 0.2), (-1.25, -1.0, deckH + 0.85), mat("flag_green", (0.3, 0.7, 0.35), rough=0.8), bevel=0.005)

ASSETS.update({"tower": tower})

def duck():
    # Puddles, a female mallard (Day 2, second bonus). Origin = waterline under her middle. Faces -Y (front).
    brown = mat("duck_brown", (0.6, 0.45, 0.3), rough=0.85)
    dark = mat("duck_dark", (0.42, 0.3, 0.2), rough=0.85)
    light = mat("duck_light", (0.78, 0.65, 0.48), rough=0.85)
    blue = mat("duck_speculum", (0.25, 0.3, 0.85), rough=0.35, metal=0.2)
    white = mat("duck_white", (0.97, 0.96, 0.92), rough=0.7)
    bill = mat("duck_bill", (0.95, 0.55, 0.15), rough=0.5)
    blk = mat("duck_eye", (0.06, 0.05, 0.05), rough=0.2)
    sphere("body", 1, (0, 0.05, 0.16), brown, scale=(0.36, 0.58, 0.27), sub=4)
    sphere("breast", 1, (0, -0.3, 0.22), light, scale=(0.3, 0.3, 0.25), sub=3)
    sphere("tail", 1, (0, 0.6, 0.25), dark, scale=(0.11, 0.17, 0.05), sub=3).rotation_euler.x = -0.35
    for sx in (-1, 1):
        w = sphere("wing", 1, (sx * 0.27, 0.12, 0.27), dark, scale=(0.1, 0.42, 0.17), sub=3); w.rotation_euler = (0.18, 0, sx * -0.15)
        sphere("speculum", 1, (sx * 0.34, 0.2, 0.27), blue, scale=(0.03, 0.14, 0.06), sub=2)
        sphere("speculum_edge", 1, (sx * 0.345, 0.2, 0.2), white, scale=(0.025, 0.14, 0.018), sub=2)
    # head on a pivot so a behavior can bob it, dunk it, or tuck it in to sleep
    bpy.ops.object.empty_add(location=(0, -0.38, 0.36)); piv = bpy.context.object; piv.name = "duck_head"
    parts = [sphere("neck", 1, (0, -0.4, 0.42), brown, scale=(0.13, 0.13, 0.17), sub=3),
             sphere("head", 0.19, (0, -0.45, 0.62), brown, scale=(0.9, 1.1, 0.95), sub=3)]
    b = sphere("bill", 1, (0, -0.66, 0.6), bill, scale=(0.085, 0.16, 0.04), sub=3); b.rotation_euler.x = 0.12; parts.append(b)
    parts.append(sphere("bill_spot", 1, (0, -0.72, 0.625), mat("bill_spot", (0.25, 0.18, 0.12), rough=0.6), scale=(0.035, 0.05, 0.015), sub=2))
    for sx in (-1, 1):
        parts.append(sphere("eye_stripe", 1, (sx * 0.14, -0.48, 0.64), dark, scale=(0.03, 0.12, 0.025), sub=2))
        parts.append(sphere("eye", 0.032, (sx * 0.155, -0.52, 0.66), blk, sub=2))
        parts.append(sphere("eye_shine", 0.01, (sx * 0.175, -0.535, 0.675), white, sub=1))
    for o in parts: o.parent = piv; o.matrix_parent_inverse = piv.matrix_world.inverted()
    # orange feet just under the water, on a pivot so they can paddle
    for sx in (-1, 1):
        bpy.ops.object.empty_add(location=(sx * 0.12, 0.15, -0.02)); fp = bpy.context.object; fp.name = "duck_foot_" + ("l" if sx < 0 else "r")
        f = sphere("foot", 1, (sx * 0.12, 0.2, -0.1), bill, scale=(0.08, 0.1, 0.015), sub=2)
        f.parent = fp; f.matrix_parent_inverse = fp.matrix_world.inverted()

ASSETS.update({"duck": duck})

only = [a for a in sys.argv[sys.argv.index("--") + 1:] if not a.startswith("--")] if "--" in sys.argv else list(ASSETS)
only = only or list(ASSETS)
for name in only:
    reset(); _mats.clear()
    ASSETS[name]()
    export(name)
    if "--nopreview" not in sys.argv: preview(name)
