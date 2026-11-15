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


# ---------- inside Odyssey Jr.'s house ----------
def nestbed():
    wood = mat("wood", WOOD, tex="wood")
    box("bed_base", (2.0, 1.5, 0.3), (0, 0, 0.3), mat("bedframe", (1, 0.88, 0.7), tex="planks", scale=(1, 0.6)), bevel=0.06)
    for x in (-0.9, 0.9):
        for y in (-0.65, 0.65): cyl("bed_leg", 0.09, 0.07, 0.18, (x, y, 0.09), wood, verts=12)
    box("headboard", (2.0, 0.14, 1.1), (0, 0.72, 0.75), wood, bevel=0.08)
    straw = mat("straw", (0.93, 0.8, 0.42), rough=0.95)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.6, minor_radius=0.22, location=(0, -0.05, 0.56)); n = finish(bpy.context.object, straw); n.name = "nest"; n.scale = (1.25, 0.95, 0.8)
    sphere("nest_middle", 0.55, (0, -0.05, 0.47), mat("straw_dark", (0.85, 0.7, 0.35), rough=0.95), scale=(1.2, 0.9, 0.25))
    sphere("pillow", 0.3, (0, 0.45, 0.62), mat("pillow", (0.95, 0.95, 1.0), rough=0.9), scale=(1.5, 0.7, 0.45))
    box("blanket", (1.9, 0.5, 0.08), (0, -0.52, 0.5), mat("blanket", (0.25, 0.45, 0.8), rough=0.95), bevel=0.04)
    for i in range(5): box("blanket_stripe", (0.08, 0.51, 0.085), (-0.76 + i * 0.38, -0.52, 0.5), mat("blanket_stripe", (0.95, 0.85, 0.45), rough=0.95), bevel=0.02)

def closet():
    wood = mat("closet_wood", (1, 0.9, 0.78), tex="planks", scale=(1, 1.5))
    dark = mat("wood", WOOD, tex="wood")
    box("closet_body", (1.9, 0.8, 2.6), (0, 0, 1.4), dark, bevel=0.05)
    box("closet_top", (2.1, 0.95, 0.12), (0, 0, 2.76), wood, bevel=0.05)
    box("closet_foot", (2.0, 0.88, 0.14), (0, 0, 0.07), wood, bevel=0.04)
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    for s in (-1, 1):
        box("closet_door", (0.88, 0.06, 2.3), (s * 0.46, -0.42, 1.42), wood, bevel=0.03)
        box("closet_panel", (0.62, 0.03, 0.8), (s * 0.46, -0.455, 1.95), dark, bevel=0.02)
        box("closet_panel", (0.62, 0.03, 0.8), (s * 0.46, -0.455, 0.9), dark, bevel=0.02)
        sphere("closet_knob", 0.06, (s * 0.1, -0.48, 1.42), brass)
    # a hat on top and a scarf peeking out, so it reads as his wardrobe
    cyl("hat_brim", 0.34, 0.34, 0.03, (0.45, -0.05, 2.84), mat("hat", (0.1, 0.1, 0.12), rough=0.7), verts=24, bevel=0)
    cyl("hat_top", 0.2, 0.21, 0.4, (0.45, -0.05, 3.05), mat("hat", (0.1, 0.1, 0.12), rough=0.7), verts=24, bevel=0.01)
    cyl("hat_band", 0.212, 0.212, 0.07, (0.45, -0.05, 2.9), mat("hatband", (0.7, 0.15, 0.18)), verts=24, bevel=0)
    box("scarf_peek", (0.1, 0.05, 0.5), (0.02, -0.46, 0.6), mat("scarf", (0.18, 0.44, 0.84), rough=0.95), rot=(0, 0.15, 0), bevel=0.02)

def shelf():
    wood = mat("wood", WOOD, tex="wood")
    plank = mat("shelf_plank", (1, 0.9, 0.78), tex="planks", scale=(1, 0.4))
    for x in (-0.95, 0.95): box("shelf_side", (0.1, 0.5, 2.0), (x, 0, 1.0), wood, bevel=0.03)
    for z in (0.12, 0.72, 1.32, 1.94): box("shelf_board", (2.0, 0.55, 0.08), (0, 0, z), plank, bevel=0.02)
    box("shelf_back", (1.9, 0.04, 1.9), (0, 0.24, 1.0), wood, bevel=0)
    cyl("jar", 0.12, 0.12, 0.26, (-0.6, -0.02, 0.89), mat("jarglass", (0.75, 0.9, 0.9), rough=0.15), verts=16)
    cyl("jar_lid", 0.13, 0.13, 0.05, (-0.6, -0.02, 1.04), mat("lid", (0.8, 0.3, 0.25)), verts=16)
    box("book1", (0.1, 0.36, 0.42), (0.35, 0, 0.97), mat("book_r", (0.75, 0.25, 0.22)), bevel=0.01)
    box("book2", (0.1, 0.36, 0.46), (0.47, 0, 0.99), mat("book_b", (0.2, 0.4, 0.7)), bevel=0.01)
    box("book3", (0.1, 0.36, 0.38), (0.59, 0, 0.95), mat("book_g", (0.3, 0.6, 0.35)), rot=(0, 0.25, 0), bevel=0.01)
    cyl("pot", 0.14, 0.1, 0.2, (0.5, -0.02, 1.46), mat("pot", (0.8, 0.45, 0.3)), verts=16)
    sphere("plant", 0.2, (0.5, -0.02, 1.7), mat("plant", (0.3, 0.62, 0.3), rough=0.9), sub=2)
    sphere("egg_trophy", 0.13, (-0.5, -0.02, 1.52), mat("gold", (0.95, 0.75, 0.25), rough=0.25, metal=0.9), scale=(1, 1, 1.3))

def housedoor():
    trim = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    box("door_frame", (1.3, 0.16, 2.3), (0, 0, 1.15), trim, bevel=0.03)
    box("door_leaf", (1.05, 0.1, 2.1), (0, -0.06, 1.07), mat("door", (0.55, 0.4, 0.3), tex="wood"), bevel=0.03)
    box("door_window", (0.5, 0.05, 0.5), (0, -0.1, 1.6), mat("doorglass", (0.6, 0.85, 1.0), rough=0.1, emit=(0.6, 0.85, 1.0), emit_strength=0.6), bevel=0.02)
    sphere("door_knob", 0.07, (0.38, -0.14, 1.0), mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9))
    box("doormat", (1.2, 0.7, 0.04), (0, -0.55, 0.02), mat("doormat", (0.75, 0.3, 0.25), rough=0.95), bevel=0.01)

def rug():
    cyl("rug", 1.6, 1.6, 0.04, (0, 0, 0.02), mat("rug_a", (0.8, 0.3, 0.28), rough=0.95), verts=48, bevel=0)
    cyl("rug_ring", 1.25, 1.25, 0.045, (0, 0, 0.022), mat("rug_b", (0.97, 0.9, 0.75), rough=0.95), verts=48, bevel=0)
    cyl("rug_center", 0.9, 0.9, 0.05, (0, 0, 0.024), mat("rug_c", (0.25, 0.45, 0.75), rough=0.95), verts=48, bevel=0)
    bpy.context.object.scale = (1, 0.999, 1)

ASSETS = {"nestbed": nestbed, "closet": closet, "shelf": shelf, "housedoor": housedoor, "rug": rug, "coop": coop, "oak": oak, "pine": pine, "pond": pond, "rock": rock, "sign": sign, "workbench": workbench, "feeder": feeder, "dustbath": dustbath,
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

def weatherstation():
    # OJ Weather (Day 3): a Stevenson screen (white louvered box for thermometers), a pole with a rooster weathervane
    # and a cup anemometer, and a glass rain gauge. Pivots: "vane" (turns with wind), "anemometer" (spins), "rain_level" (fills).
    white = mat("ws_white", (0.97, 0.96, 0.92), rough=0.6)
    shade = mat("ws_shade", (0.82, 0.8, 0.76), rough=0.7)
    wood = mat("wood", WOOD, tex="wood")
    stone = mat("stone", WOOD, tex="stone", scale=(2, 2))
    steel = mat("steel", (0.3, 0.3, 0.33), rough=0.4, metal=0.8)
    copper = mat("ws_copper", (0.85, 0.55, 0.3), rough=0.35, metal=0.85)
    red = mat("ws_red", (0.8, 0.22, 0.2), rough=0.6)
    glass = mat("ws_glass", (0.75, 0.88, 0.95), rough=0.05, metal=0.2)
    water = mat("ws_water", (0.35, 0.6, 0.95), rough=0.1, emit=(0.2, 0.45, 0.9), emit_strength=0.3)
    # round stone pad
    cyl("pad", 1.9, 1.95, 0.08, (0, 0, 0.04), stone, verts=24)
    # --- Stevenson screen on four legs, door facing the viewer (-Y) ---
    sx0, sy0, H0 = -0.55, 0.15, 1.15  # box centre x,y and bottom height
    for dx in (-0.36, 0.36):
        for dy in (-0.3, 0.3):
            box("leg", (0.08, 0.08, H0), (sx0 + dx, sy0 + dy, H0 / 2), wood, bevel=0.01)
    box("screen_floor", (0.95, 0.8, 0.06), (sx0, sy0, H0), white, bevel=0.01)
    bh = 0.75
    for i in range(9):  # louvers all around: slats tilted so air gets in but sun and rain don't
        z = H0 + 0.08 + i * (bh / 9)
        box("louver", (0.92, 0.03, 0.09), (sx0, sy0 - 0.39, z), white, rot=(0.6, 0, 0), bevel=0.005)
        box("louver", (0.92, 0.03, 0.09), (sx0, sy0 + 0.39, z), white, rot=(-0.6, 0, 0), bevel=0.005)
        box("louver", (0.03, 0.76, 0.09), (sx0 - 0.46, sy0, z), white, rot=(0, -0.6, 0), bevel=0.005)
        box("louver", (0.03, 0.76, 0.09), (sx0 + 0.46, sy0, z), white, rot=(0, 0.6, 0), bevel=0.005)
    box("screen_inner", (0.84, 0.7, bh), (sx0, sy0, H0 + bh / 2 + 0.03), shade, bevel=0)
    for dx in (-0.46, 0.46):
        for dy in (-0.39, 0.39):
            box("corner", (0.06, 0.06, bh + 0.08), (sx0 + dx, sy0 + dy, H0 + bh / 2 + 0.03), white, bevel=0.01)
    # pitched double roof (the gap keeps the sun from heating it)
    rz = H0 + bh + 0.12
    box("roof_l", (0.6, 1.0, 0.05), (sx0 - 0.27, sy0, rz + 0.12), white, rot=(0, -0.42, 0), bevel=0.01)
    box("roof_r", (0.6, 1.0, 0.05), (sx0 + 0.27, sy0, rz + 0.12), white, rot=(0, 0.42, 0), bevel=0.01)
    box("door_knob", (0.05, 0.05, 0.05), (sx0 + 0.32, sy0 - 0.43, H0 + 0.4), copper, bevel=0.01)
    # --- tall pole with weathervane + anemometer ---
    px, py = 0.75, 0.25
    top = 4.2
    cyl("pole", 0.07, 0.05, top, (px, py, top / 2), steel, verts=12)
    cyl("pole_foot", 0.2, 0.25, 0.25, (px, py, 0.2), stone, verts=12)
    # compass arms: N E S W letters (N points to world -z, which is Blender +Y)
    cz = top - 0.55
    box("arm_ns", (0.04, 1.1, 0.04), (px, py, cz), steel, bevel=0)
    box("arm_ew", (1.1, 0.04, 0.04), (px, py, cz), steel, bevel=0)
    ink = mat("ws_ink", (0.2, 0.18, 0.2), rough=0.6)
    for letter, (dx, dy) in {"N": (0, 0.62), "S": (0, -0.62), "E": (0.62, 0), "W": (-0.62, 0)}.items():
        bpy.ops.object.text_add(location=(px + dx, py + dy, cz - 0.08), rotation=(math.pi / 2, 0, 0))
        t = bpy.context.object; t.data.body = letter; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.24; t.data.extrude = 0.025
        t.data.materials.append(copper); bpy.ops.object.convert(target="MESH")
    sphere("ball", 0.08, (px, py, top + 0.02), copper, sub=2)
    # rooster weathervane on a pivot. Its tail catches the wind, so the head points where the wind comes FROM.
    bpy.ops.object.empty_add(location=(px, py, top + 0.1)); vp = bpy.context.object; vp.name = "vane"
    vz = top + 0.55
    vparts = [cyl("vane_rod", 0.02, 0.02, 0.5, (px, py, top + 0.3), steel, verts=8, bevel=0),
              box("arrow", (0.03, 1.3, 0.03), (px, py + 0.0, top + 0.22), copper, bevel=0),
              cyl("arrow_head", 0.09, 0.0, 0.2, (px, py - 0.72, top + 0.22), copper, rot=(math.pi / 2, 0, 0), verts=4, bevel=0),
              box("arrow_fin", (0.02, 0.28, 0.24), (px, py + 0.62, top + 0.22), copper, bevel=0.01)]
    vparts.append(sphere("r_body", 1, (px, py + 0.05, vz), copper, scale=(0.05, 0.3, 0.2), sub=3))
    vparts.append(sphere("r_chest", 1, (px, py - 0.17, vz + 0.1), copper, scale=(0.05, 0.13, 0.15), sub=3))
    vparts.append(sphere("r_head", 1, (px, py - 0.27, vz + 0.3), copper, scale=(0.045, 0.1, 0.1), sub=3))
    vparts.append(cyl("r_beak", 0.03, 0.0, 0.1, (px, py - 0.4, vz + 0.3), copper, rot=(math.pi / 2, 0, 0), verts=6, bevel=0))
    for i, (dy, dz) in enumerate([(-0.3, 0.42), (-0.24, 0.43), (-0.18, 0.4)]):
        vparts.append(sphere("r_comb", 0.045, (px, py + dy, vz + dz), red, scale=(0.6, 1, 1.2), sub=2))
    vparts.append(sphere("r_wattle", 1, (px, py - 0.33, vz + 0.2), red, scale=(0.03, 0.03, 0.05), sub=2))
    for i in range(4):  # big curved tail feathers
        f = sphere("r_tail", 1, (0, 0, 0), copper, scale=(0.03, 0.08, 0.28 - i * 0.03), sub=3)  # built at the origin so it turns around its own middle
        f.rotation_euler.x = -0.5 - i * 0.28; f.location = (px, py + 0.32 + i * 0.03, vz + 0.18 + i * 0.03); vparts.append(f)
    vparts.append(cyl("r_leg", 0.02, 0.02, 0.2, (px, py + 0.05, vz - 0.22), copper, verts=6, bevel=0))
    for o in vparts: o.parent = vp; o.matrix_parent_inverse = vp.matrix_world.inverted()
    # cup anemometer on a side arm. Hollow cups catch more wind than their round backs, so they spin.
    ax, ay, az = px - 0.65, py, top - 1.4
    box("anemo_arm", (0.65, 0.04, 0.04), (px - 0.33, py, az), steel, bevel=0)
    cyl("anemo_post", 0.025, 0.025, 0.3, (ax, ay, az + 0.15), steel, verts=8, bevel=0)
    bpy.ops.object.empty_add(location=(ax, ay, az + 0.32)); ap = bpy.context.object; ap.name = "anemometer"
    aparts = [cyl("anemo_hub", 0.05, 0.04, 0.08, (ax, ay, az + 0.32), copper, verts=12, bevel=0)]
    for i in range(3):
        a = i / 3 * math.tau
        cx, cy = ax + math.cos(a) * 0.34, ay + math.sin(a) * 0.34
        aparts.append(box("anemo_spoke", (0.3, 0.02, 0.02), (ax + math.cos(a) * 0.17, ay + math.sin(a) * 0.17, az + 0.32), steel, rot=(0, 0, a), bevel=0))
        bpy.ops.mesh.primitive_uv_sphere_add(radius=0.09, location=(cx, cy, az + 0.32), segments=16, ring_count=8)
        c = bpy.context.object; c.name = "anemo_cup"
        bm = bmesh.new(); bm.from_mesh(c.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.005], context="VERTS"); bm.to_mesh(c.data); bm.free()
        c.rotation_euler = (math.pi / 2, 0, a + math.pi); finish(c, red); aparts.append(c)
        mdf = c.modifiers.new("solid", "SOLIDIFY"); mdf.thickness = 0.012
    for o in aparts: o.parent = ap; o.matrix_parent_inverse = ap.matrix_world.inverted()
    # rain gauge: a glass tube with marks, on a little post, plus a funnel on top
    gx, gy = 0.1, -1.0
    box("gauge_post", (0.14, 0.14, 0.7), (gx, gy, 0.35), wood, bevel=0.01)
    cyl("gauge_tube", 0.12, 0.12, 0.6, (gx, gy, 1.0), glass, verts=20, bevel=0)
    cyl("gauge_funnel", 0.2, 0.12, 0.12, (gx, gy, 1.36), steel, verts=20, bevel=0)
    for i in range(5):
        box("gauge_mark", (0.1, 0.01, 0.012), (gx, gy - 0.12, 0.78 + i * 0.1), ink, bevel=0)
    bpy.ops.object.empty_add(location=(gx, gy, 0.72)); lp = bpy.context.object; lp.name = "rain_level"
    w = cyl("gauge_water", 0.1, 0.1, 0.56, (gx, gy, 0.72 + 0.28), water, verts=20, bevel=0)
    w.parent = lp; w.matrix_parent_inverse = lp.matrix_world.inverted()
    # sign
    box("ws_sign", (1.1, 0.06, 0.32), (0.9, -1.1, 0.75), mat("board", (1, 0.86, 0.66), tex="planks", scale=(1, 0.5)), bevel=0.03)
    box("ws_sign_post", (0.07, 0.07, 0.6), (0.9, -1.05, 0.3), wood, bevel=0.01)
    bpy.ops.object.text_add(location=(0.9, -1.14, 0.75), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ WEATHER"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.17; t.data.extrude = 0.01
    t.data.materials.append(mat("ink_red", (0.7, 0.15, 0.12), rough=0.8)); bpy.ops.object.convert(target="MESH")

ASSETS.update({"weatherstation": weatherstation})

def musicnook():
    # OJ Music (Day 3, bonus 2): the Cluck-a-phone (an 8-bar xylophone, C major, low notes on the left) and a wind chime
    # on a shepherd's post. Named parts for the behavior: "bar0".."bar7" (bounce when hit), "chimes" (the whole chime
    # swings from its hook), "chime0".."chime5" (each tube swings from its string), "striker" (the clapper + sail).
    # Bars are on the -Y side facing visitors; Odyssey stands at +Y (behind the bars) and faces them while he plays.
    wood = mat("wood", WOOD, tex="wood")
    planks = mat("mn_planks", (1, 0.86, 0.66), tex="planks", scale=(1, 0.6))
    felt = mat("mn_felt", (0.75, 0.18, 0.16), rough=0.95)
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    silver = mat("mn_silver", (0.86, 0.88, 0.92), rough=0.3, metal=0.35)
    cord = mat("mn_cord", (0.25, 0.2, 0.18), rough=0.9)
    copper = mat("ws_copper", (0.85, 0.55, 0.3), rough=0.35, metal=0.85)
    stone = mat("stone", WOOD, tex="stone", scale=(2, 2))
    cyl("mn_pad", 1.55, 1.6, 0.06, (0, 0, 0.03), stone, verts=28)
    # --- the Cluck-a-phone ---
    top = 0.86
    for x in (-1.12, 1.12):
        for y in (-0.42, 0.42):
            cyl("xy_leg", 0.05, 0.06, top - 0.06, (x, y, (top - 0.06) / 2), wood, verts=10, bevel=0.01)
        box("xy_side", (0.08, 0.95, 0.08), (x, 0, top - 0.25), wood, bevel=0.015)
    for y in (-0.3, 0.3):  # the two rails the bars rest on, with red felt
        box("xy_rail", (2.36, 0.09, 0.1), (0, y, top - 0.08), wood, bevel=0.02)
        box("xy_felt", (2.3, 0.07, 0.02), (0, y, top - 0.02), felt, bevel=0.005)
    cols = [(0.92, 0.3, 0.28), (0.97, 0.55, 0.22), (0.98, 0.82, 0.25), (0.45, 0.78, 0.35), (0.25, 0.72, 0.7), (0.3, 0.52, 0.9), (0.45, 0.38, 0.82), (0.72, 0.4, 0.8)]
    for i in range(8):
        x = -0.98 + i * 0.28
        ln = 0.95 - i * 0.055   # higher notes = shorter bars (pitch goes like 1 / length squared)
        b = box(f"bar{i}", (0.22, ln, 0.06), (x, 0, top + 0.03), mat(f"mn_bar{i}", cols[i], rough=0.45), bevel=0.02)
        for y in (-0.3, 0.3): cyl("xy_pin", 0.018, 0.018, 0.02, (x, y, top + 0.065), brass, verts=8, bevel=0)
        cyl("xy_tube", 0.075, 0.075, 0.5 - i * 0.04, (x, 0, top - 0.2 - (0.5 - i * 0.04) / 2), brass, verts=16, bevel=0.005)  # resonators
    for k, (x, y) in enumerate([(-1.0, 0.62), (-0.7, 0.66)]):  # two mallets resting on a little side tray
        cyl("mallet_stick", 0.018, 0.018, 0.55, (x + 0.27, y, top - 0.08), wood, rot=(0, math.pi / 2, 0.15 * k), verts=8, bevel=0)
        sphere("mallet_head", 0.06, (x, y, top - 0.08), felt, sub=2)
    box("xy_tray", (0.9, 0.2, 0.04), (-0.65, 0.64, top - 0.13), planks, bevel=0.01)
    # --- the wind chime on a shepherd's post ---
    px, py = 2.1, 0.35
    box("ch_post", (0.13, 0.13, 3.3), (px, py, 1.65), wood, bevel=0.02)
    box("ch_arm", (0.75, 0.1, 0.1), (px - 0.33, py, 3.2), wood, bevel=0.02)
    box("ch_brace", (0.07, 0.07, 0.5), (px - 0.18, py, 3.0), wood, rot=(0, 0.75, 0), bevel=0.01)
    hx, hz = px - 0.62, 3.15
    bpy.ops.object.empty_add(location=(hx, py, hz)); piv = bpy.context.object; piv.name = "chimes"
    def kid(o, parent):
        o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted(); return o
    kid(cyl("ch_hook", 0.008, 0.008, 0.35, (hx, py, hz - 0.17), cord, verts=6, bevel=0), piv)
    dz = hz - 0.4
    kid(cyl("ch_top", 0.3, 0.3, 0.06, (hx, py, dz), wood, verts=24, bevel=0.01), piv)
    for a in range(3):  # three cords from the hook to the disc
        ang = a / 3 * math.tau
        kid(cyl("ch_cord3", 0.006, 0.006, 0.08, (hx + math.cos(ang) * 0.1, py + math.sin(ang) * 0.1, dz + 0.06), cord, verts=5, bevel=0), piv)
    for i in range(6):
        ang = i / 6 * math.tau
        x, y = hx + math.cos(ang) * 0.22, py + math.sin(ang) * 0.22
        ln = 0.95 - i * 0.08     # pentatonic tubes: a tube's pitch goes like 1 / length squared
        bpy.ops.object.empty_add(location=(x, y, dz - 0.03)); ep = bpy.context.object; ep.name = f"chime{i}"; kid(ep, piv)
        hang = 0.12
        kid(cyl("ch_string", 0.005, 0.005, hang, (x, y, dz - 0.03 - hang / 2), cord, verts=5, bevel=0), ep)
        kid(cyl("ch_tube", 0.032, 0.032, ln, (x, y, dz - 0.03 - hang - ln / 2), silver, verts=14, bevel=0.004), ep)
    bpy.ops.object.empty_add(location=(hx, py, dz - 0.03)); st = bpy.context.object; st.name = "striker"; kid(st, piv)
    kid(cyl("ch_strstring", 0.005, 0.005, 1.25, (hx, py, dz - 0.03 - 0.625), cord, verts=5, bevel=0), st)
    kid(cyl("ch_clapper", 0.13, 0.13, 0.05, (hx, py, dz - 0.6), wood, verts=20, bevel=0.01), st)
    # the sail: a copper feather that catches the wind
    f = sphere("ch_sail", 0.2, (hx, py, dz - 1.4), copper, scale=(0.75, 0.06, 1.3), sub=3); kid(f, st)
    kid(box("ch_quill", (0.02, 0.02, 0.52), (hx, py, dz - 1.4), mat("ink", (0.25, 0.18, 0.12)), bevel=0), st)
    # little sign
    box("mn_sign", (1.15, 0.06, 0.32), (-1.25, -1.05, 0.62), planks, bevel=0.03)
    box("mn_sign_post", (0.07, 0.07, 0.5), (-1.25, -1.0, 0.25), wood, bevel=0.01)
    bpy.ops.object.text_add(location=(-1.25, -1.09, 0.62), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ MUSIC"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.17; t.data.extrude = 0.01
    t.data.materials.append(mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8)); bpy.ops.object.convert(target="MESH")

ASSETS.update({"musicnook": musicnook})

def kitchengarden():
    # OJ Garden (Day 3, bonus 3): a cedar raised bed. The left half is open (garlic, tucked under straw), the right half
    # wears a cold frame: a wooden box with a sloped glass lid that faces the sun. Named parts for the behavior:
    # "lid" (an empty at the back hinge; the lid swings open on sunny afternoons), "glass" (the pane, made see-through
    # by the behavior). The plants are NOT in this model; the behavior grows them day by day.
    # Front faces -Y (toward visitors). Soil top is at z = 0.42.
    cedar = mat("kg_cedar", (0.95, 0.68, 0.5), tex="planks", scale=(2, 0.4))
    wood = mat("wood", WOOD, tex="wood")
    soil = mat("kg_soil", (0.62, 0.45, 0.35), tex="dirt", scale=(3, 1.5))
    straw = mat("kg_straw", (0.93, 0.8, 0.45), rough=0.95)
    white = mat("kg_white", (0.95, 0.93, 0.86), rough=0.7)
    glass = mat("kg_glass", (0.75, 0.88, 0.92), rough=0.1)
    green = mat("kg_green", (0.38, 0.62, 0.42), rough=0.6)
    tin = mat("kg_tin", (0.55, 0.72, 0.68), rough=0.4, metal=0.35)
    ink = mat("ink", (0.25, 0.16, 0.12), rough=0.9)
    L, W, H = 3.8, 1.7, 0.45
    # the bed: three stacked boards per side, chunky corner posts
    for k in range(3):
        z = 0.08 + k * 0.145
        box("kg_board", (L, 0.09, 0.14), (0, -W / 2, z), cedar, bevel=0.015)
        box("kg_board", (L, 0.09, 0.14), (0, W / 2, z), cedar, bevel=0.015)
        box("kg_board", (0.09, W, 0.14), (-L / 2, 0, z), cedar, bevel=0.015)
        box("kg_board", (0.09, W, 0.14), (L / 2, 0, z), cedar, bevel=0.015)
    for x in (-L / 2, L / 2):
        for y in (-W / 2, W / 2):
            box("kg_post", (0.14, 0.14, 0.56), (x, y, 0.28), wood, bevel=0.025)
            cyl("kg_cap", 0.085, 0.06, 0.05, (x, y, 0.585), white, verts=16, bevel=0.01)
    box("kg_cap_rail", (L + 0.12, 0.16, 0.04), (0, -W / 2, H + 0.02), white, bevel=0.012)
    box("kg_cap_rail", (L + 0.12, 0.16, 0.04), (0, W / 2, H + 0.02), white, bevel=0.012)
    s = box("kg_soil", (L - 0.1, W - 0.1, 0.06), (0, 0, 0.39), soil, bevel=0.03); jitter(s, 0.008)
    # straw mulch over the garlic (left half): loose little tufts
    random.seed(11)
    for i in range(70):
        x = random.uniform(-1.8, -0.15); y = random.uniform(-0.72, 0.72)
        box("kg_straw", (random.uniform(0.12, 0.25), 0.012, 0.012), (x, y, 0.43 + random.uniform(0, 0.02)), straw,
            rot=(0, random.uniform(-0.2, 0.2), random.uniform(0, math.pi)), bevel=0)
    # row markers: little white stakes with green tops
    for (x, y) in [(-1.75, -0.35), (-1.75, 0.35), (0.25, -0.45), (0.25, 0.0), (0.25, 0.45)]:
        box("kg_stake", (0.03, 0.03, 0.28), (x, y, 0.52), white, bevel=0.004)
        box("kg_tag", (0.1, 0.015, 0.07), (x, y - 0.02, 0.64), green, bevel=0.006)
    # the cold frame on the right half: back wall taller than the front, so the glass slopes toward the sun
    fx0, fx1 = 0.05, 1.8; fw = fx1 - fx0; cx = (fx0 + fx1) / 2
    back, front = 0.42, 0.22
    box("kg_cf_back", (fw, 0.07, back), (cx, W / 2 - 0.12, H + back / 2), wood, bevel=0.015)
    box("kg_cf_front", (fw, 0.07, front), (cx, -W / 2 + 0.12, H + front / 2), wood, bevel=0.015)
    d = W - 0.24
    for x in (fx0, fx1):  # sloped side walls (a wedge from a box, then cut the top)
        bpy.ops.mesh.primitive_cube_add(size=1)
        o = bpy.context.object; o.name = "kg_cf_side"
        for v in o.data.vertices:
            yy = v.co.y * d; top = front + (back - front) * (v.co.y + 0.5)
            v.co.x = x + v.co.x * 0.07; v.co.y = yy; v.co.z = H + (top if v.co.z > 0 else 0)
        finish(o, wood, bevel=0.012)
    # the lid hinges on the back edge
    hy, hz = W / 2 - 0.12, H + back
    bpy.ops.object.empty_add(location=(cx, hy, hz)); piv = bpy.context.object; piv.name = "lid"
    ang = math.atan2(back - front, d); ln = math.hypot(d, back - front) + 0.06
    def kid(o):
        o.parent = piv; o.matrix_parent_inverse = piv.matrix_world.inverted(); return o
    my, mz = hy - math.cos(ang) * ln / 2, hz - math.sin(ang) * ln / 2 + 0.03
    kid(box("glass", (fw - 0.08, ln - 0.08, 0.02), (cx, my, mz), glass, rot=(-ang, 0, 0), bevel=0))
    for x in (fx0, cx, fx1):
        kid(box("kg_lid_bar", (0.07, ln, 0.05), (x, my, mz + 0.01), white, rot=(-ang, 0, 0), bevel=0.01))
    for t in (0.0, 1.0):
        yy = hy - math.cos(ang) * ln * t; zz = hz - math.sin(ang) * ln * t + 0.03
        kid(box("kg_lid_end", (fw + 0.07, 0.07, 0.05), (cx, yy, zz + 0.01), white, rot=(-ang, 0, 0), bevel=0.01))
    kid(cyl("kg_handle", 0.025, 0.025, 0.3, (cx, hy - math.cos(ang) * ln - 0.03, hz - math.sin(ang) * ln + 0.06), mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9), rot=(0, math.pi / 2, 0), verts=10, bevel=0))
    for x in (fx0 + 0.3, fx1 - 0.3):
        cyl("kg_hinge", 0.03, 0.03, 0.14, (x, hy, hz + 0.02), mat("ws_iron", (0.3, 0.3, 0.32), rough=0.5, metal=0.6), rot=(0, math.pi / 2, 0), verts=10, bevel=0)
    # a vent stick leaning on the frame (what I prop the lid up with)
    box("kg_ventstick", (0.04, 0.04, 0.5), (fx1 + 0.12, -W / 2 - 0.05, 0.25), wood, rot=(0.15, 0.1, 0), bevel=0.005)
    # watering can at the front left corner
    cx2, cy2 = -2.25, -0.55
    cyl("kg_can", 0.17, 0.15, 0.3, (cx2, cy2, 0.15), tin, verts=24, bevel=0.01)
    cyl("kg_spout", 0.025, 0.04, 0.45, (cx2 + 0.28, cy2, 0.28), tin, rot=(0, 0.9, 0), verts=10, bevel=0)
    cyl("kg_rose", 0.06, 0.035, 0.05, (cx2 + 0.46, cy2, 0.42), tin, rot=(0, 0.9, 0), verts=12, bevel=0)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.13, minor_radius=0.02, location=(cx2 - 0.05, cy2, 0.36), rotation=(math.pi / 2, 0, 0))
    o = bpy.context.object; o.name = "kg_can_handle"; finish(o, tin)
    # the sign
    box("kg_sign", (1.2, 0.06, 0.34), (-1.0, -W / 2 - 0.35, 0.72), mat("board", (1, 0.86, 0.66), tex="planks", scale=(1, 0.5)), bevel=0.03)
    box("kg_sign_post", (0.07, 0.07, 0.62), (-1.0, -W / 2 - 0.31, 0.31), wood, bevel=0.01)
    bpy.ops.object.text_add(location=(-1.0, -W / 2 - 0.39, 0.72), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ GARDEN"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.17; t.data.extrude = 0.01
    t.data.materials.append(mat("ink_green", (0.2, 0.42, 0.22), rough=0.8)); bpy.ops.object.convert(target="MESH")

ASSETS.update({"kitchengarden": kitchengarden})


def telescope():
    # OJ Stars (Day 3, bonus 4): a little brass refractor on a wooden tripod, plus a low step so a chicken can reach.
    # Named parts for the behavior: "mount" (an empty that turns left/right = azimuth), "tube" (an empty inside it that
    # tips up/down = altitude). The tube points along -Y (forward) when both are at zero, eyepiece at the back.
    wood = mat("wood", WOOD, tex="wood")
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    navy = mat("ts_navy", (0.16, 0.22, 0.45), rough=0.45, metal=0.2)
    black = mat("ts_black", (0.08, 0.08, 0.1), rough=0.5)
    lens = mat("ts_lens", (0.55, 0.75, 0.95), rough=0.05, metal=0.3)
    planks = mat("board", (1, 0.86, 0.66), tex="planks", scale=(1, 0.5))
    H = 1.55
    for i in range(3):  # tripod legs, splayed out
        a = i / 3 * math.tau + 0.3
        fx, fy = math.cos(a) * 0.62, math.sin(a) * 0.62
        mx, my = fx / 2, fy / 2
        ln = math.sqrt(0.62 ** 2 + H ** 2)
        tilt = math.atan2(0.62, H)
        cyl("ts_leg", 0.045, 0.035, ln, (mx, my, H / 2), wood, rot=(0, -tilt, a), verts=10, bevel=0)
        # rotate around Y tips the top inward: correct sign by placing top at center
        cyl("ts_foot", 0.06, 0.07, 0.04, (fx, fy, 0.02), black, verts=10, bevel=0)
    cyl("ts_head", 0.14, 0.14, 0.08, (0, 0, H), brass, verts=20, bevel=0.01)
    cyl("ts_tray", 0.36, 0.36, 0.025, (0, 0, H * 0.45), planks, verts=6, bevel=0.005)  # accessory tray between the legs
    for k in range(3):
        cyl("ts_eyepiece_spare", 0.03, 0.03, 0.07, (math.cos(k * 2) * 0.18, math.sin(k * 2) * 0.18, H * 0.45 + 0.045), brass, verts=10, bevel=0)
    bpy.ops.object.empty_add(location=(0, 0, H + 0.04)); mount = bpy.context.object; mount.name = "mount"
    def kid(o, parent):
        o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted(); return o
    kid(box("ts_fork", (0.34, 0.08, 0.06), (0, 0, H + 0.08), brass, bevel=0.01), mount)
    for x in (-0.15, 0.15): kid(box("ts_arm", (0.04, 0.08, 0.22), (x, 0, H + 0.2), brass, bevel=0.01), mount)
    tz = H + 0.27
    bpy.ops.object.empty_add(location=(0, 0, tz)); tube = bpy.context.object; tube.name = "tube"; kid(tube, mount)
    kid(cyl("ts_tube", 0.09, 0.09, 1.25, (0, -0.15, tz), navy, rot=(math.pi / 2, 0, 0), verts=24, bevel=0.01), tube)
    kid(cyl("ts_dew", 0.11, 0.105, 0.3, (0, -0.85, tz), navy, rot=(math.pi / 2, 0, 0), verts=24, bevel=0.01), tube)
    for y in (-0.72, 0.45): kid(cyl("ts_ring", 0.1, 0.1, 0.04, (0, y, tz), brass, rot=(math.pi / 2, 0, 0), verts=24, bevel=0.005), tube)
    kid(cyl("ts_lens", 0.085, 0.085, 0.01, (0, -0.99, tz), lens, rot=(math.pi / 2, 0, 0), verts=24, bevel=0), tube)
    kid(cyl("ts_focuser", 0.05, 0.05, 0.22, (0, 0.58, tz), brass, rot=(math.pi / 2, 0, 0), verts=16, bevel=0.005), tube)
    kid(cyl("ts_diag", 0.04, 0.04, 0.16, (0, 0.7, tz + 0.07), black, verts=12, bevel=0.005), tube)
    kid(cyl("ts_eye", 0.035, 0.045, 0.08, (0, 0.7, tz + 0.18), black, verts=12, bevel=0.005), tube)
    kid(cyl("ts_finder", 0.025, 0.025, 0.35, (0.08, -0.25, tz + 0.12), brass, rot=(math.pi / 2, 0, 0), verts=10, bevel=0), tube)
    # a step stool for a short chicken
    box("ts_step", (0.6, 0.45, 0.08), (0, 0.95, 0.42), planks, bevel=0.02)
    for x in (-0.24, 0.24):
        for y in (0.77, 1.13): box("ts_step_leg", (0.06, 0.06, 0.4), (x, y, 0.2), wood, bevel=0.01)
    # a little sign
    box("ts_sign", (0.95, 0.06, 0.3), (0.9, -0.55, 0.55), planks, bevel=0.03)
    box("ts_sign_post", (0.07, 0.07, 0.45), (0.9, -0.51, 0.22), wood, bevel=0.01)
    bpy.ops.object.text_add(location=(0.9, -0.59, 0.55), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ STARS"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.15; t.data.extrude = 0.01
    t.data.materials.append(mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8)); bpy.ops.object.convert(target="MESH")

ASSETS.update({"telescope": telescope})


def lighthouse():
    # OJ Light (Day 3, bonus 5): the lighthouse I found in the fog past the Tall Hills, on a rocky point over the sea.
    # Red and white bands are its "daymark" (so sailors know which lighthouse it is in the daytime).
    # Front (Blender -Y) faces back toward my yard; the sea and the foghorn face +Y.
    paint = mat("lh_white", (0.97, 0.95, 0.9), rough=0.7)
    red = mat("lh_red", (0.78, 0.18, 0.15), rough=0.6)
    iron = mat("lh_iron", (0.16, 0.18, 0.2), rough=0.5, metal=0.4)
    brass = mat("lh_brass", (0.85, 0.65, 0.28), rough=0.35, metal=0.35)
    stone = mat("lh_stone", WOOD, tex="stone", scale=(3, 1))
    rockm = mat("lh_rock", (0.62, 0.58, 0.55), rough=0.95)
    wood = mat("lh_door", (0.45, 0.3, 0.2), tex="wood")
    win = mat("lh_window", (0.95, 0.85, 0.55), rough=0.3, emit=(1, 0.78, 0.4), emit_strength=0.6)
    lensm = mat("lh_lens", (0.95, 0.9, 0.7), rough=0.1, metal=0.2, emit=(1, 0.85, 0.5), emit_strength=0.3)
    lampm = mat("lh_lamp", (1, 0.95, 0.75), rough=0.2, emit=(1, 0.9, 0.6), emit_strength=0.5)
    glass = mat("lh_glass", (0.75, 0.88, 0.95), rough=0.05, metal=0.1)
    gb = glass.node_tree.nodes["Principled BSDF"]; gb.inputs["Alpha"].default_value = 0.28
    try: glass.surface_render_method = "BLENDED"
    except Exception: glass.blend_method = "BLEND"
    # the rocky point
    for i in range(9):
        a = i / 9 * math.tau; r = 3.2 + random.uniform(0, 1.6)
        o = sphere("lh_rocks", random.uniform(1.6, 2.6), (math.cos(a) * r, math.sin(a) * r, 0.2), rockm, scale=(1.2, 1, 0.55), sub=2, smooth=False); jitter(o, 0.25)
    cyl("lh_plinth", 3.1, 2.9, 1.2, (0, 0, 0.6), stone, verts=10, bevel=0.03)
    z0, H, r0, r1 = 1.2, 13.0, 2.4, 1.5
    rad = lambda z: r0 + (r1 - r0) * (z - z0) / H
    cyl("lh_tower", r0, r1, H, (0, 0, z0 + H / 2), paint, verts=40, bevel=0)
    for zb in (3.0, 7.0, 11.0):  # daymark bands
        h = 1.7; cyl("lh_band", rad(zb) + 0.03, rad(zb + h) + 0.03, h, (0, 0, zb + h / 2), red, verts=40, bevel=0)
    # door and windows, staggered as the stairs spiral up inside
    box("lh_door", (0.9, 0.2, 1.7), (0, -rad(2) + 0.05, 2.05), wood, bevel=0.03)
    box("lh_door_frame", (1.15, 0.12, 0.2), (0, -rad(2.9) - 0.02, 2.95), paint, bevel=0.02)
    for zw, a in ((5.2, -1.2), (9.2, -1.9), (12.8, -1.35), (6.0, 1.6)):
        rr = rad(zw); box("lh_win", (0.45, 0.12, 0.7), (math.cos(a) * rr, math.sin(a) * rr, zw), win, rot=(0, 0, a + math.pi / 2), bevel=0.02)
    # gallery (the balcony the keeper walks around)
    top = z0 + H
    cyl("lh_corbel", r1, 2.35, 0.5, (0, 0, top + 0.05), iron, verts=40, bevel=0)
    cyl("lh_gallery", 2.45, 2.45, 0.22, (0, 0, top + 0.4), iron, verts=40, bevel=0.02)
    for i in range(24):
        a = i / 24 * math.tau; cyl("lh_post", 0.04, 0.04, 0.9, (math.cos(a) * 2.35, math.sin(a) * 2.35, top + 0.95), iron, verts=6, bevel=0)
    for zz in (1.4, 0.95):
        bpy.ops.mesh.primitive_torus_add(major_radius=2.35, minor_radius=0.05, location=(0, 0, top + zz), major_segments=48, minor_segments=8)
        finish(bpy.context.object, iron).name = "lh_rail"
    # lantern room
    lb = top + 0.5
    cyl("lh_lantern_wall", 1.35, 1.35, 0.7, (0, 0, lb + 0.35), red, verts=10, bevel=0.02)
    gh = 2.0
    cyl("lh_lantern_glass", 1.28, 1.28, gh, (0, 0, lb + 0.7 + gh / 2), glass, verts=10, bevel=0)
    for i in range(10):
        a = (i + 0.5) / 10 * math.tau; box("lh_mullion", (0.08, 0.08, gh), (math.cos(a) * 1.27, math.sin(a) * 1.27, lb + 0.7 + gh / 2), iron, bevel=0)
    bpy.ops.mesh.primitive_torus_add(major_radius=1.28, minor_radius=0.05, location=(0, 0, lb + 0.7 + gh * 0.5), major_segments=40, minor_segments=6)
    finish(bpy.context.object, iron).name = "lh_astragal"
    # the Fresnel lens: rings of glass prisms around the lamp, on a brass pedestal (clockwork turns it)
    lz = lb + 0.7 + gh / 2
    cyl("lh_pedestal", 0.35, 0.45, 0.75, (0, 0, lb + 0.7 + 0.37), brass, verts=16, bevel=0.01)
    bpy.ops.object.empty_add(location=(0, 0, lz)); piv = bpy.context.object; piv.name = "lens"
    parts = [cyl("lens_core", 0.62, 0.62, 1.15, (0, 0, lz), lensm, verts=24, bevel=0)]
    for dz in (-0.5, -0.3, -0.1, 0.1, 0.3, 0.5):
        bpy.ops.mesh.primitive_torus_add(major_radius=0.62 - abs(dz) * 0.25, minor_radius=0.07, location=(0, 0, lz + dz), major_segments=32, minor_segments=6)
        parts.append(finish(bpy.context.object, brass))
    for a in (0, 0.44):  # two bullseye panels close together: two flashes, then a long dark. bawk-bawk.
        parts.append(cyl("lens_bullseye", 0.28, 0.28, 0.08, (math.cos(a) * 0.64, math.sin(a) * 0.64, lz), lampm, rot=(0, math.pi / 2, a), verts=20, bevel=0))
    for o in parts: o.parent = piv; o.matrix_parent_inverse = piv.matrix_world.inverted()
    sphere("lamp", 0.22, (0, 0, lz), lampm, sub=2)
    # roof
    rz = lb + 0.7 + gh
    cyl("lh_roof_rim", 1.55, 1.5, 0.15, (0, 0, rz + 0.07), red, verts=10, bevel=0.02)
    sphere("lh_dome", 1.4, (0, 0, rz + 0.12), red, scale=(1, 1, 0.72), sub=3)
    cyl("lh_vent_neck", 0.16, 0.12, 0.5, (0, 0, rz + 1.2), iron, verts=12, bevel=0)
    sphere("lh_vent_ball", 0.32, (0, 0, rz + 1.55), iron, sub=2)
    cyl("lh_rod", 0.03, 0.02, 1.1, (0, 0, rz + 2.3), brass, verts=6, bevel=0)
    # keeper's cottage
    cx, cy = -5.2, 0.8
    box("lh_cottage", (4.0, 3.2, 2.6), (cx, cy, 1.3), paint, bevel=0.04)
    for s in (-1, 1):
        box("lh_roof", (4.4, 2.05, 0.18), (cx, cy + s * 0.8, 3.15), red, rot=(s * -0.62, 0, 0), bevel=0.03)
    for s in (-1, 1):  # gable ends
        bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=1.85, depth=0.15, location=(cx + s * 1.98, cy, 3.05), rotation=(0, math.pi / 2, 0))
        o = bpy.context.object; o.scale = (0.62, 1, 1); o.rotation_euler = (math.pi / 2 * 0 + math.radians(-90), math.pi / 2, 0); finish(o, paint).name = "lh_gable"
    box("lh_chimney", (0.5, 0.5, 1.4), (cx - 1.2, cy + 0.6, 3.6), stone, bevel=0.02)
    box("lh_cdoor", (0.75, 0.12, 1.5), (cx + 0.6, cy - 1.62, 0.8), wood, bevel=0.03)
    for x in (-1.1,):
        box("lh_cwin", (0.8, 0.1, 0.7), (cx + x, cy - 1.62, 1.5), win, bevel=0.02)
    box("lh_sign", (2.0, 0.1, 0.45), (cx, cy - 1.68, 2.35), mat("board", (1, 0.86, 0.66), tex="planks", scale=(1, 0.5)), bevel=0.03)
    bpy.ops.object.text_add(location=(cx, cy - 1.75, 2.35), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ LIGHT"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.32; t.data.extrude = 0.015
    t.data.materials.append(mat("ink_red", (0.7, 0.15, 0.12), rough=0.8)); bpy.ops.object.convert(target="MESH")
    # fog signal house with its big horn pointing out to sea (+Y)
    fx, fy = 3.6, 3.0
    box("lh_foghouse", (1.8, 1.6, 1.6), (fx, fy, 0.8 + 1.0), paint, bevel=0.03)
    box("lh_fogroof", (2.1, 1.9, 0.18), (fx, fy, 2.7), red, bevel=0.03)
    bpy.ops.object.empty_add(location=(fx, fy + 0.8, 2.0)); hp = bpy.context.object; hp.name = "horn"
    h1 = cyl("horn_bell", 0.12, 0.55, 1.4, (fx, fy + 1.5, 2.0), iron, rot=(-math.pi / 2, 0, 0), verts=20, bevel=0)
    h1.parent = hp; h1.matrix_parent_inverse = hp.matrix_world.inverted()

ASSETS.update({"lighthouse": lighthouse})


def _kid(o, parent):
    o.parent = parent; o.matrix_parent_inverse = parent.matrix_world.inverted(); return o

def _pivot(name, loc):
    bpy.ops.object.empty_add(location=loc); p = bpy.context.object; p.name = name; return p

def bluejay():
    # Rascal the blue jay (Day 3, bonus 6). Origin between his feet. Faces -Y. About 0.7 long, nose to tail tip.
    blue = mat("jay_blue", (0.33, 0.55, 0.88), rough=0.5)
    bright = mat("jay_bright", (0.35, 0.68, 0.95), rough=0.45)
    white = mat("jay_white", (0.95, 0.95, 0.93), rough=0.8)
    grey = mat("jay_grey", (0.85, 0.86, 0.88), rough=0.85)
    black = mat("jay_black", (0.08, 0.08, 0.1), rough=0.5)
    shine = mat("jay_shine", (1, 1, 1), rough=0.1)
    legm = mat("jay_legs", (0.25, 0.25, 0.28), rough=0.6)
    sphere("jay_body", 1, (0, 0.02, 0.26), grey, scale=(0.13, 0.2, 0.13), sub=3)
    sphere("jay_back", 1, (0, 0.06, 0.3), blue, scale=(0.125, 0.19, 0.11), sub=3)
    sphere("jay_belly", 1, (0, -0.07, 0.22), white, scale=(0.105, 0.12, 0.1), sub=3)
    for sx in (-1, 1):
        cyl("jay_leg", 0.012, 0.01, 0.17, (sx * 0.05, 0.02, 0.09), legm, verts=6, bevel=0)
        box("jay_toe", (0.02, 0.07, 0.012), (sx * 0.05, -0.01, 0.006), legm, bevel=0)
    # wings: blue with black bars and white tips, on pivots so he can flap
    for sx, nm in ((-1, "jay_wing_l"), (1, "jay_wing_r")):
        pv = _pivot(nm, (sx * 0.1, -0.02, 0.33))
        w = _kid(sphere("jay_wingm", 1, (sx * 0.12, 0.1, 0.3), bright, scale=(0.035, 0.2, 0.08), sub=3), pv); w.rotation_euler.x = -0.15
        for k in range(4): _kid(box("jay_bar", (0.01, 0.014, 0.1), (sx * 0.152, 0.02 + k * 0.06, 0.3 - k * 0.012), black, bevel=0), pv)
        for k in range(3): _kid(sphere("jay_spot", 0.014, (sx * 0.152, 0.05 + k * 0.06, 0.24 - k * 0.01), white, sub=1), pv)
    # long tail, barred, white tips
    tp = _pivot("jay_tail", (0, 0.18, 0.3))
    t = _kid(box("jay_tailm", (0.12, 0.32, 0.035), (0, 0.33, 0.25), blue, bevel=0.012), tp); t.rotation_euler.x = -0.35
    for k in range(5):
        b = _kid(box("jay_tbar", (0.115, 0.012, 0.03), (0, 0.22 + k * 0.05, 0.285 - k * 0.018), black, bevel=0), tp); b.rotation_euler.x = -0.35
    tt = _kid(box("jay_ttip", (0.115, 0.04, 0.03), (0, 0.48, 0.2), white, bevel=0.005), tp); tt.rotation_euler.x = -0.35
    # head on a pivot: crest, black necklace, white face, bill
    hp = _pivot("jay_head", (0, -0.12, 0.4))
    _kid(sphere("jay_headm", 0.095, (0, -0.15, 0.46), blue, sub=3), hp)
    _kid(sphere("jay_face", 1, (0, -0.2, 0.44), white, scale=(0.075, 0.06, 0.06), sub=3), hp)
    c = _kid(cyl("jay_crest", 0.06, 0.008, 0.15, (0, -0.1, 0.555), blue, verts=10, bevel=0), hp); c.rotation_euler.x = -0.95
    bpy.ops.mesh.primitive_torus_add(major_radius=0.085, minor_radius=0.014, location=(0, -0.15, 0.39), rotation=(1.1, 0, 0), major_segments=24, minor_segments=6)
    _kid(finish(bpy.context.object, black), hp).name = "jay_necklace"
    b = _kid(cyl("jay_bill", 0.022, 0.003, 0.1, (0, -0.28, 0.46), black, verts=8, bevel=0), hp); b.rotation_euler.x = math.pi / 2 + 0.15
    for sx in (-1, 1):
        _kid(sphere("jay_eye", 0.018, (sx * 0.055, -0.22, 0.48), black, sub=2), hp)
        _kid(sphere("jay_eyeshine", 0.006, (sx * 0.065, -0.235, 0.488), shine, sub=1), hp)
        _kid(box("jay_eyeline", (0.01, 0.05, 0.012), (sx * 0.07, -0.19, 0.505), black, bevel=0), hp)

def squirrel():
    # Nutmeg the eastern gray squirrel (Day 3, bonus 6). Origin under her middle, faces -Y. About 0.95 long with the tail.
    grey = mat("sq_grey", (0.55, 0.53, 0.5), rough=0.95)
    warm = mat("sq_warm", (0.66, 0.5, 0.36), rough=0.95)
    white = mat("sq_white", (0.93, 0.9, 0.85), rough=0.9)
    dark = mat("sq_dark", (0.08, 0.07, 0.07), rough=0.3)
    pink = mat("sq_pink", (0.85, 0.62, 0.6), rough=0.7)
    shine = mat("sq_shine", (1, 1, 1), rough=0.1)
    sphere("sq_body", 1, (0, 0.05, 0.18), grey, scale=(0.12, 0.2, 0.13), sub=3)
    sphere("sq_belly", 1, (0, -0.03, 0.15), white, scale=(0.09, 0.13, 0.1), sub=3)
    sphere("sq_haunch", 1, (0, 0.15, 0.15), grey, scale=(0.13, 0.12, 0.13), sub=3)
    for sx in (-1, 1):
        sphere("sq_foot", 1, (sx * 0.08, 0.1, 0.025), grey, scale=(0.035, 0.09, 0.025), sub=2)
        sphere("sq_hand", 1, (sx * 0.05, -0.14, 0.04), grey, scale=(0.025, 0.04, 0.03), sub=2)
        sphere("sq_side", 1, (sx * 0.1, 0.05, 0.18), warm, scale=(0.03, 0.13, 0.07), sub=2)
    hp = _pivot("sq_head", (0, -0.16, 0.26))
    _kid(sphere("sq_headm", 1, (0, -0.2, 0.3), grey, scale=(0.085, 0.11, 0.085), sub=3), hp)
    _kid(sphere("sq_cheek", 1, (0, -0.25, 0.27), white, scale=(0.06, 0.06, 0.05), sub=2), hp)
    _kid(sphere("sq_nose", 0.016, (0, -0.31, 0.3), pink, sub=2), hp)
    for sx in (-1, 1):
        _kid(sphere("sq_eye", 0.022, (sx * 0.055, -0.25, 0.33), dark, sub=2), hp)
        _kid(sphere("sq_eyeshine", 0.007, (sx * 0.065, -0.265, 0.34), shine, sub=1), hp)
        _kid(sphere("sq_eyering", 1, (sx * 0.06, -0.245, 0.33), white, scale=(0.012, 0.028, 0.03), sub=2), hp)
        e = _kid(cyl("sq_ear", 0.03, 0.005, 0.07, (sx * 0.045, -0.17, 0.4), grey, verts=8, bevel=0), hp); e.rotation_euler = (-0.25, sx * 0.3, 0)
    # the big bushy tail, in an S curve, on a pivot so she can flick it (that's how squirrels talk)
    tp = _pivot("sq_tail", (0, 0.24, 0.15))
    pts = [(0, 0.3, 0.17, 0.07), (0, 0.38, 0.27, 0.09), (0, 0.4, 0.4, 0.1), (0, 0.36, 0.53, 0.105), (0, 0.29, 0.62, 0.1), (0, 0.24, 0.66, 0.08)]
    for i, (x, y, z, r) in enumerate(pts):
        _kid(sphere("sq_fringe", 1, (x, y + 0.012, z), mat("sq_frost", (0.82, 0.8, 0.76), rough=0.95), scale=(r * 1.15, r * 1.0, r * 1.25), sub=2), tp)
        _kid(sphere("sq_tailm", 1, (x, y - 0.005, z), grey, scale=(r * 1.05, r * 1.08, r * 1.3), sub=2), tp)

def owl():
    # Hoo, a great horned owl who visits my oak at night (Day 3, bonus 6). Origin under his feet, faces -Y. About 1.2 tall.
    brown = mat("owl_brown", (0.5, 0.38, 0.26), rough=0.95)
    dark = mat("owl_dark", (0.28, 0.2, 0.14), rough=0.95)
    buff = mat("owl_buff", (0.8, 0.68, 0.5), rough=0.95)
    rust = mat("owl_rust", (0.8, 0.5, 0.25), rough=0.9)
    white = mat("owl_white", (0.95, 0.93, 0.88), rough=0.9)
    eye = mat("owl_eye", (1, 0.75, 0.1), rough=0.2, emit=(1, 0.65, 0.1), emit_strength=0.4)
    black = mat("owl_black", (0.04, 0.04, 0.04), rough=0.2)
    beak = mat("owl_beak", (0.2, 0.18, 0.16), rough=0.4)
    sphere("owl_body", 1, (0, 0.02, 0.45), brown, scale=(0.3, 0.27, 0.42), sub=3)
    sphere("owl_breast", 1, (0, -0.1, 0.4), buff, scale=(0.24, 0.2, 0.33), sub=3)
    for k in range(7):  # barring on the breast
        z = 0.18 + k * 0.075; w = 0.22 * math.sqrt(max(0.05, 1 - ((z - 0.4) / 0.36) ** 2))
        box("owl_bar", (w * 1.6, 0.02, 0.018), (0, -0.28 + abs(z - 0.42) * 0.25, z), dark, bevel=0)
    for sx in (-1, 1):
        for k in range(3): sphere("owl_talon", 1, (sx * 0.08 + (k - 1) * 0.03, -0.15, 0.03), black, scale=(0.012, 0.04, 0.012), sub=1)
        sphere("owl_foot", 1, (sx * 0.08, -0.08, 0.05), buff, scale=(0.06, 0.07, 0.05), sub=2)
    for sx, nm in ((-1, "owl_wing_l"), (1, "owl_wing_r")):
        pv = _pivot(nm, (sx * 0.25, 0.02, 0.62))
        w = _kid(sphere("owl_wingm", 1, (sx * 0.24, 0.08, 0.42), dark, scale=(0.05, 0.22, 0.34), sub=3), pv); w.rotation_euler.x = 0.1
        for k in range(4): _kid(sphere("owl_wspot", 1, (sx * 0.285, 0.02 + k * 0.05, 0.5 - k * 0.09), buff, scale=(0.012, 0.04, 0.02), sub=1), pv)
    sphere("owl_tail", 1, (0, 0.24, 0.12), dark, scale=(0.12, 0.08, 0.14), sub=2)
    hp = _pivot("owl_head", (0, 0, 0.8))
    _kid(sphere("owl_headm", 1, (0, 0.0, 0.92), brown, scale=(0.24, 0.22, 0.2), sub=3), hp)
    for sx in (-1, 1):
        d = _kid(sphere("owl_disc", 1, (sx * 0.1, -0.15, 0.93), rust, scale=(0.11, 0.06, 0.12), sub=3), hp)
        _kid(sphere("owl_eyem", 0.055, (sx * 0.095, -0.2, 0.95), eye, sub=2), hp)
        _kid(sphere("owl_pupil", 0.028, (sx * 0.095, -0.245, 0.955), black, sub=2), hp)
        t = _kid(cyl("owl_tuft", 0.055, 0.008, 0.2, (sx * 0.15, 0.0, 1.13), dark, verts=8, bevel=0), hp); t.rotation_euler = (0.15, sx * 0.4, 0)
        _kid(box("owl_brow", (0.11, 0.03, 0.025), (sx * 0.09, -0.21, 1.02), buff, rot=(0, sx * -0.3, 0), bevel=0), hp)
    _kid(sphere("owl_bib", 1, (0, -0.17, 0.8), white, scale=(0.11, 0.05, 0.05), sub=2), hp)
    b = _kid(cyl("owl_beakm", 0.03, 0.004, 0.08, (0, -0.25, 0.9), beak, verts=8, bevel=0), hp); b.rotation_euler.x = math.pi * 0.85

def trailcam():
    # OJ Cam 1: a trail camera strapped to the big oak (Day 3, bonus 6). Origin = middle of the oak trunk at the ground,
    # so it shares the oak's position. The camera faces -Y (my yard). The strap fits the trunk (oak scale 1.4).
    camo = mat("tc_camo", (0.36, 0.4, 0.26), rough=0.9)
    camo2 = mat("tc_camo2", (0.24, 0.27, 0.17), rough=0.9)
    strap = mat("tc_strap", (0.2, 0.18, 0.15), rough=0.8)
    black = mat("tc_black", (0.05, 0.05, 0.06), rough=0.2, metal=0.3)
    glassm = mat("tc_glass", (0.3, 0.35, 0.45), rough=0.05, metal=0.5)
    ir = mat("tc_ir", (0.25, 0.08, 0.08), rough=0.3)
    red = mat("tc_rec", (1, 0.2, 0.15), rough=0.3, emit=(1, 0.1, 0.05), emit_strength=2.0)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.535, minor_radius=0.03, location=(0, 0, 1.05), major_segments=40, minor_segments=6)
    o = bpy.context.object; o.scale = (1, 1, 1.6); finish(o, strap).name = "tc_strap"
    y = -0.6
    box("tc_body", (0.3, 0.16, 0.42), (0, y, 1.05), camo, bevel=0.04)
    for (x, z, sx, sz) in ((-0.08, 1.15, 0.12, 0.08), (0.07, 0.95, 0.1, 0.12), (0.09, 1.2, 0.06, 0.05), (-0.06, 0.9, 0.08, 0.05)):
        box("tc_blot", (sx, 0.02, sz), (x, y - 0.075, z), camo2, bevel=0.005)
    cyl("tc_lens_barrel", 0.055, 0.055, 0.05, (0, y - 0.095, 1.12), black, rot=(math.pi / 2, 0, 0), verts=20, bevel=0)
    cyl("tc_lens", 0.04, 0.04, 0.01, (0, y - 0.123, 1.12), glassm, rot=(math.pi / 2, 0, 0), verts=20, bevel=0)
    box("tc_irpanel", (0.2, 0.02, 0.1), (0, y - 0.085, 1.22), black, bevel=0.005)
    for i in range(5):
        for j in range(2): sphere("tc_irled", 0.012, (-0.08 + i * 0.04, y - 0.097, 1.2 + j * 0.04), ir, sub=1)
    box("tc_pir", (0.09, 0.03, 0.06), (0, y - 0.09, 0.95), mat("tc_pirm", (0.92, 0.9, 0.85), rough=0.4), bevel=0.01)
    sphere("rec_light", 0.014, (0.11, y - 0.09, 1.25), red, sub=1)
    box("tc_back", (0.26, 0.12, 0.08), (0, y + 0.1, 1.05), strap, bevel=0.01)

ASSETS.update({"bluejay": bluejay, "squirrel": squirrel, "owl": owl, "trailcam": trailcam})


only = [a for a in sys.argv[sys.argv.index("--") + 1:] if not a.startswith("--")] if "--" in sys.argv else list(ASSETS)
only = only or list(ASSETS)
for name in only:
    reset(); _mats.clear()
    ASSETS[name]()
    export(name)
    if "--nopreview" not in sys.argv: preview(name)
