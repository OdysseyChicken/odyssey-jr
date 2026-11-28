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


def radioshack():
    # OJ Radio (Day 4): a little lean-to radio shack with a straight key, a valve radio with a glowing dial, headphones on
    # a hook, and a tall antenna mast with a red beacon light on top. Front (open side) faces -Y. Odyssey stands at
    # about (0, -1.25) facing +Y while he keys.
    # Named parts for the behavior: "key_lever" (pivot, tips down for each dit/dah), "tx_lamp" (glows while sending),
    # "dial_needle" (pivot, swings while tuning), "mast_light" (blinks the OJA beacon ident), "dial" (warm glow).
    wood = mat("wood", WOOD, tex="wood")
    planks = mat("rs_planks", (0.55, 0.72, 0.62), tex="planks", scale=(1.4, 1))
    trim = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    roof = mat("rs_roof", (0.78, 0.36, 0.3), tex="shingles", scale=(3, 1.6))
    stone = mat("stone", WOOD, tex="stone", scale=(2, 2))
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    black = mat("rs_bake", (0.12, 0.1, 0.09), rough=0.5)
    cream = mat("rs_cream", (0.93, 0.88, 0.74), rough=0.6)
    case = mat("rs_case", (0.55, 0.33, 0.2), tex="wood")
    grille = mat("rs_grille", (0.35, 0.28, 0.22), rough=0.95)
    steel = mat("rs_steel", (0.75, 0.77, 0.8), rough=0.35, metal=0.35)
    wire = mat("rs_wire", (0.2, 0.18, 0.16), rough=0.8)
    redp = mat("rs_redpaint", (0.85, 0.2, 0.18), rough=0.6)
    whitep = mat("rs_whitepaint", (0.95, 0.94, 0.9), rough=0.6)
    box("rs_pad", (2.9, 2.2, 0.08), (0, -0.25, 0.04), stone, bevel=0.03)
    W, D = 2.5, 1.4
    # back wall + two side walls (planks), a little window in the right side
    box("rs_back", (W, 0.1, 2.0), (0, D / 2, 1.08), planks, bevel=0.02)
    for s in (-1, 1):
        box("rs_side", (0.1, D, 1.9), (s * W / 2, 0, 1.03), planks, bevel=0.02)
        box("rs_corner", (0.14, 0.14, 2.1), (s * W / 2, -D / 2, 1.1), trim, bevel=0.03)
        box("rs_corner", (0.14, 0.14, 2.1), (s * W / 2, D / 2, 1.1), trim, bevel=0.03)
    box("rs_window", (0.06, 0.5, 0.45), (W / 2 + 0.03, 0, 1.4), mat("rs_glass", (0.7, 0.85, 0.95), rough=0.1), bevel=0.01)
    box("rs_wframe", (0.05, 0.62, 0.57), (W / 2 + 0.06, 0, 1.4), trim, bevel=0.02)
    # lean-to roof, high at the front so you can see in
    ang = math.radians(10)
    box("rs_roof", (W + 0.5, D + 0.6, 0.1), (0, -0.05, 2.25), roof, rot=(-ang, 0, 0), bevel=0.03)
    box("rs_fascia", (W + 0.55, 0.06, 0.16), (0, -D / 2 - 0.36, 2.33), trim, bevel=0.02)
    # the desk
    top = 0.78
    box("rs_desk", (W - 0.2, 0.75, 0.07), (0, 0.25, top), wood, bevel=0.02)
    for x in (-1.05, 1.05):
        for y in (-0.08, 0.58): box("rs_dleg", (0.07, 0.07, top), (x, y, top / 2), wood, bevel=0.01)
    box("rs_shelf", (1.8, 0.3, 0.05), (0.2, 0.52, 1.62), wood, bevel=0.01)
    for i, c in enumerate([(0.3, 0.55, 0.85), (0.9, 0.75, 0.3), (0.5, 0.75, 0.45)]):  # jars of spare parts
        cyl("rs_jar", 0.06, 0.06, 0.14, (-0.45 + i * 0.16, 0.52, 1.715), mat(f"rs_jar{i}", c, rough=0.25), verts=14, bevel=0.01)
    box("rs_manual", (0.32, 0.22, 0.06), (0.75, 0.52, 1.675), mat("rs_book", (0.25, 0.4, 0.7), rough=0.7), bevel=0.01)
    # the radio (on the desk, against the wall): wooden case, cream front, a glowing dial, two knobs, a speaker grille
    rx, ry = -0.35, 0.42
    box("rs_radio", (0.95, 0.4, 0.5), (rx, ry, top + 0.29), case, bevel=0.04)
    box("rs_face", (0.85, 0.02, 0.4), (rx, ry - 0.205, top + 0.29), cream, bevel=0.01)
    d = box("dial", (0.4, 0.015, 0.14), (rx - 0.15, ry - 0.218, top + 0.4), mat("rs_dialglow", (1, 0.85, 0.55), rough=0.4, emit=(1, 0.7, 0.35), emit_strength=1.2), bevel=0.005)
    for i in range(7): box("rs_tick", (0.006, 0.005, 0.03), (rx - 0.32 + i * 0.057, ry - 0.228, top + 0.44), black, bevel=0)
    piv = _pivot("dial_needle", (rx - 0.15, ry - 0.23, top + 0.34))
    _kid(box("rs_needle", (0.008, 0.006, 0.12), (rx - 0.15, ry - 0.23, top + 0.4), redp, bevel=0), piv)
    box("rs_grille", (0.3, 0.015, 0.26), (rx + 0.22, ry - 0.215, top + 0.3), grille, bevel=0.01)
    for k, x in enumerate((rx - 0.28, rx - 0.02)):
        cyl("rs_knob", 0.045, 0.04, 0.05, (x, ry - 0.24, top + 0.17), black, rot=(math.pi / 2, 0, 0), verts=18, bevel=0.01)
    # a glass valve (tube) on top, glowing a little orange
    cyl("rs_valvebase", 0.05, 0.05, 0.04, (rx + 0.3, ry + 0.05, top + 0.56), black, verts=14, bevel=0)
    sphere("rs_valve", 0.06, (rx + 0.3, ry + 0.05, top + 0.66), mat("rs_valveglass", (1, 0.7, 0.45), rough=0.1, emit=(1, 0.45, 0.15), emit_strength=0.8), scale=(1, 1, 1.6), sub=2)
    # the straight key, front of the desk. Base, brass lever on a pivot, a knob, spring, contacts.
    kx, ky = 0.45, 0.05
    box("rs_keybase", (0.5, 0.22, 0.04), (kx, ky, top + 0.055), mat("rs_keywood", (0.4, 0.22, 0.12), tex="wood"), bevel=0.01)
    for x in (kx + 0.02, kx + 0.08): box("rs_trunnion", (0.02, 0.1, 0.07), (x, ky, top + 0.11), brass, bevel=0.005)
    piv = _pivot("key_lever", (kx + 0.05, ky, top + 0.13))
    _kid(box("rs_lever", (0.42, 0.04, 0.025), (kx - 0.08, ky, top + 0.13), brass, bevel=0.006), piv)
    _kid(cyl("rs_keyknob", 0.05, 0.045, 0.035, (kx - 0.26, ky, top + 0.17), black, verts=20, bevel=0.01), piv)
    _kid(cyl("rs_keyskirt", 0.06, 0.06, 0.008, (kx - 0.26, ky, top + 0.148), black, verts=20, bevel=0), piv)
    cyl("rs_spring", 0.012, 0.012, 0.06, (kx + 0.15, ky, top + 0.1), steel, verts=8, bevel=0)
    cyl("rs_contact", 0.012, 0.012, 0.04, (kx - 0.15, ky, top + 0.095), steel, verts=8, bevel=0)
    for x in (kx + 0.21, kx + 0.24): cyl("rs_post", 0.014, 0.014, 0.05, (x, ky + 0.07, top + 0.1), brass, verts=8, bevel=0)
    # the "on air" lamp on the wall
    box("rs_lampbox", (0.26, 0.05, 0.14), (0.45, D / 2 - 0.07, 1.8), black, bevel=0.01)
    box("tx_lamp", (0.2, 0.02, 0.09), (0.45, D / 2 - 0.1, 1.8), mat("rs_txlamp", (0.75, 0.25, 0.2), rough=0.4, emit=(1, 0.15, 0.08), emit_strength=0.0), bevel=0.005)
    # headphones on a hook, a notepad and pencil, a little Morse chart pinned to the wall
    cyl("rs_hook", 0.012, 0.012, 0.12, (-1.0, D / 2 - 0.1, 1.65), brass, rot=(math.pi / 2, 0, 0), verts=8, bevel=0)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.13, minor_radius=0.015, location=(-1.0, D / 2 - 0.12, 1.55), rotation=(math.pi / 2, 0, 0), major_segments=24, minor_segments=6)
    o = bpy.context.object; o.name = "rs_band"; finish(o, black)
    for s in (-1, 1): cyl("rs_cup", 0.06, 0.06, 0.04, (-1.0 + s * 0.13, D / 2 - 0.12, 1.47), black, rot=(math.pi / 2, 0, 0), verts=16, bevel=0.01)
    box("rs_pad_paper", (0.22, 0.28, 0.01), (0.9, 0.2, top + 0.04), cream, rot=(0, 0, 0.2), bevel=0)
    cyl("rs_pencil", 0.008, 0.008, 0.2, (0.95, 0.12, top + 0.05), mat("rs_pencilm", (0.98, 0.8, 0.2), rough=0.6), rot=(0, math.pi / 2, 0.5), verts=6, bevel=0)
    box("rs_chart", (0.45, 0.01, 0.5), (0.75, D / 2 - 0.06, 1.2), cream, bevel=0)
    for i in range(6):
        for j in range(3): box("rs_chartline", (0.08 + (i * 7 + j) % 3 * 0.04, 0.004, 0.012), (0.6 + j * 0.15, D / 2 - 0.068, 1.42 - i * 0.08), black, bevel=0)
    # the antenna mast, behind and right of the shack, red and white bands, guy wires, a red light on top
    mx, my, H = 1.85, 1.0, 6.0
    cyl("rs_mastfoot", 0.2, 0.22, 0.15, (mx, my, 0.075), stone, verts=16)
    n = 6
    for i in range(n):
        cyl("rs_mast", 0.07, 0.07, H / n, (mx, my, 0.15 + H / n * (i + 0.5)), redp if i % 2 == 0 else whitep, verts=14, bevel=0)
    cyl("rs_mastcap", 0.1, 0.1, 0.05, (mx, my, H + 0.17), black, verts=14, bevel=0)
    sphere("mast_light", 0.11, (mx, my, H + 0.28), mat("rs_mastlamp", (0.9, 0.2, 0.15), rough=0.3, emit=(1, 0.08, 0.04), emit_strength=0.0), sub=2)
    def rod(name, a, b, m, r=0.012):
        a, b = Vector(a), Vector(b); v = b - a
        o = cyl(name, r, r, v.length, (a + b) / 2, m, verts=6, bevel=0)
        o.rotation_mode = "QUATERNION"; o.rotation_quaternion = v.to_track_quat("Z", "Y"); return o
    for k in range(3):
        ang = k / 3 * math.tau + 0.9
        g = (mx + math.cos(ang) * 2.3, my + math.sin(ang) * 2.3, 0.05)
        rod("rs_guy", (mx, my, H * 0.72), g, wire, 0.008)
        cyl("rs_peg", 0.05, 0.04, 0.12, g, wood, verts=8, bevel=0)
    # the long wire antenna from the mast to the shack roof, with little insulators
    rod("rs_lwire", (mx, my, H * 0.92), (-W / 2 - 0.1, 0.5, 2.35), wire, 0.01)
    rod("rs_feed", (-W / 2 - 0.1, 0.5, 2.35), (-W / 2 - 0.05, 0.5, 1.9), wire, 0.01)
    for t in (0.08, 0.9):
        p = Vector((mx, my, H * 0.92)).lerp(Vector((-W / 2 - 0.1, 0.5, 2.35)), t)
        sphere("rs_insul", 0.045, tuple(p), whitep, scale=(1, 1, 1.4), sub=2)
    # sign over the front
    box("rs_sign", (1.3, 0.06, 0.3), (-0.4, -D / 2 - 0.4, 2.05), planks, bevel=0.03)
    bpy.ops.object.text_add(location=(-0.4, -D / 2 - 0.44, 2.05), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ RADIO"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.17; t.data.extrude = 0.01
    t.data.materials.append(mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8)); bpy.ops.object.convert(target="MESH")
    for x in (-0.9, 0.1): cyl("rs_signchain", 0.008, 0.008, 0.2, (x, -D / 2 - 0.4, 2.27), steel, verts=6, bevel=0)

ASSETS.update({"radioshack": radioshack})

def beam():
    # OJ Beam (Day 4 bonus): a 2-meter Yagi-Uda beam antenna on a pole, turned by hand with a crank (hams call that the
    # "armstrong rotator"). Reflector (longest) at the back, the driven element (a split dipole with a feed box) next,
    # then three directors, each a bit shorter. The beam points where the directors point (Blender -Y = glTF +Z).
    # Named parts: "beam_head" (pivot, turns around the pole), "crank" (pivot, the hand wheel spins while I turn it),
    # "beam_lamp" (a little green lamp that glows when the beam is aimed at the island).
    alu = mat("bm_alu", (0.82, 0.84, 0.86), rough=0.35, metal=0.35)
    black = mat("rs_bake", (0.12, 0.1, 0.09), rough=0.5)
    wood = mat("wood", WOOD, tex="wood")
    stone = mat("stone", WOOD, tex="stone", scale=(2, 2))
    trim = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    redp = mat("rs_redpaint", (0.85, 0.2, 0.18), rough=0.6)
    green = mat("bm_green", (0.42, 0.62, 0.48), tex="planks", scale=(1, 1))
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    cream = mat("rs_cream", (0.93, 0.88, 0.74), rough=0.6)
    ink = mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8)
    H = 4.6
    # a round stone pad with a compass rose painted on it (N is Blender +Y here; the world rotates it)
    cyl("bm_pad", 1.0, 1.05, 0.08, (0, 0, 0.04), stone, verts=40, bevel=0.02)
    cyl("bm_rose", 0.85, 0.85, 0.012, (0, 0, 0.086), cream, verts=40, bevel=0)
    for k in range(8):
        a = k / 8 * math.tau; L = 0.8 if k % 2 == 0 else 0.5
        box("bm_point", (0.06, L, 0.008), (math.sin(a) * L / 2, math.cos(a) * L / 2, 0.096), redp if k == 0 else ink, rot=(0, 0, -a), bevel=0)
    # the pole (wood), with a base box that holds the crank
    cyl("bm_pole", 0.07, 0.06, H, (0, 0, H / 2 + 0.08), wood, verts=16, bevel=0.01)
    box("bm_gearbox", (0.36, 0.3, 0.46), (0, 0, 0.55), green, bevel=0.04)
    box("bm_gearlid", (0.42, 0.36, 0.05), (0, 0, 0.8), trim, bevel=0.02)
    cyl("bm_axle", 0.025, 0.025, 0.16, (0, -0.22, 0.55), brass, rot=(math.pi / 2, 0, 0), verts=10, bevel=0)
    cp = _pivot("crank", (0, -0.3, 0.55))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.18, minor_radius=0.02, location=(0, -0.3, 0.55), rotation=(math.pi / 2, 0, 0), major_segments=28, minor_segments=8)
    o = bpy.context.object; o.name = "bm_wheel"; finish(o, redp); _kid(o, cp)
    for k in range(3):
        a = k / 3 * math.tau
        _kid(box("bm_spoke", (0.18, 0.02, 0.02), (math.cos(a) * 0.09, -0.3, 0.55 + math.sin(a) * 0.09), redp, rot=(0, -a, 0), bevel=0), cp)
    _kid(cyl("bm_handle", 0.025, 0.025, 0.12, (0.18, -0.36, 0.55), wood, rot=(math.pi / 2, 0, 0), verts=10, bevel=0.005), cp)
    # a little green lamp on the gearbox: lights up when I'm pointed right at ISLE
    sphere("beam_lamp", 0.05, (0.12, -0.16, 0.72), mat("bm_lamp", (0.3, 0.75, 0.35), rough=0.3, emit=(0.2, 1, 0.3), emit_strength=0.0), sub=2)
    # coax cable down the pole to the gearbox
    cyl("bm_coax", 0.015, 0.015, H - 0.9, (0.08, 0.02, (H + 0.85) / 2), black, verts=6, bevel=0)
    # the turning head: a collar, a mast clamp, the boom and the elements
    hp = _pivot("beam_head", (0, 0, H + 0.1))
    _kid(cyl("bm_collar", 0.1, 0.1, 0.14, (0, 0, H + 0.1), black, verts=16, bevel=0.01), hp)
    _kid(box("bm_plate", (0.16, 0.16, 0.03), (0, 0, H + 0.2), alu, bevel=0.005), hp)
    z = H + 0.25; L = 2.1
    _kid(box("bm_boom", (0.07, L, 0.07), (0, -0.15, z), alu, bevel=0.01), hp)
    y0 = -0.15 + L / 2 - 0.1   # the back end
    elems = [("reflector", 1.08, 0.0), ("driven", 1.0, 0.42), ("dir1", 0.94, 0.85), ("dir2", 0.92, 1.35), ("dir3", 0.9, 1.9)]
    for nm, ln, off in elems:
        y = y0 - off
        _kid(box("bm_clamp", (0.08, 0.06, 0.08), (0, y, z), black, bevel=0.01), hp)
        if nm == "driven":   # a split dipole: two halves and a little feed box in the middle
            for s in (-1, 1): _kid(cyl("bm_el", 0.024, 0.024, ln / 2 - 0.05, (s * (ln / 4 + 0.025), y, z + 0.06), alu, rot=(0, math.pi / 2, 0), verts=8, bevel=0), hp)
            _kid(box("bm_feed", (0.12, 0.08, 0.08), (0, y, z + 0.06), black, bevel=0.01), hp)
        else:
            _kid(cyl("bm_el", 0.024, 0.024, ln, (0, y, z + 0.04), alu, rot=(0, math.pi / 2, 0), verts=8, bevel=0), hp)
        for s in (-1, 1): _kid(sphere("bm_tip", 0.032, (s * ln / 2, y, z + (0.06 if nm == "driven" else 0.04)), black, sub=1), hp)
    # a pointer flag on the front tip so you can see where it aims
    _kid(cyl("bm_flagpole", 0.01, 0.01, 0.3, (0, y0 - 2.0, z + 0.15), wood, verts=6, bevel=0), hp)
    _kid(box("bm_flag", (0.012, 0.22, 0.13), (0, y0 - 2.1, z + 0.23), redp, bevel=0), hp)
    # a little wooden sign on the pole
    box("bm_sign", (0.62, 0.05, 0.22), (0, -0.12, 1.45), wood, bevel=0.02)
    bpy.ops.object.text_add(location=(0, -0.15, 1.45), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ BEAM"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.13; t.data.extrude = 0.008
    t.data.materials.append(ink); bpy.ops.object.convert(target="MESH")

ASSETS.update({"beam": beam})

def tideclock():
    # OJ Tides (Day 4, bonus 2): a tide board for Pip's beach. A wooden board on two posts under a little shingle roof,
    # a round tide clock on the left (HIGH at the top, LOW at the bottom, the hand goes round once every 12 h 25 min),
    # and a glass tide tube on the right with blue water that rises and falls with the real tide on the island.
    # Front faces -Y. Named parts: "tide_hand" (pivot at the clock's center, turns around the clock's axis),
    # "tide_water" (pivot at the bottom of the tube, scaled up and down), "tide_lamp" (glows green when the beach is open).
    wood = mat("wood", WOOD, tex="wood")
    planks = mat("tc_planks", (0.62, 0.78, 0.86), tex="planks", scale=(1.2, 1))
    trim = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    roof = mat("tc_roof", (0.45, 0.6, 0.8), tex="shingles", scale=(2.5, 1.2))
    stone = mat("stone", WOOD, tex="stone", scale=(2, 2))
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    cream = mat("rs_cream", (0.93, 0.88, 0.74), rough=0.6)
    black = mat("rs_bake", (0.12, 0.1, 0.09), rough=0.5)
    navy = mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8)
    glass = mat("tc_glass", (0.85, 0.93, 0.97), rough=0.05)
    water = mat("tc_water", (0.2, 0.55, 0.85), rough=0.2, emit=(0.1, 0.35, 0.6), emit_strength=0.3)
    redp = mat("rs_redpaint", (0.85, 0.2, 0.18), rough=0.6)
    sand = mat("tc_sand", (0.92, 0.82, 0.6), rough=0.9)
    box("tc_pad", (2.3, 0.9, 0.08), (0, 0, 0.04), stone, bevel=0.03)
    for x in (-0.95, 0.95):
        box("tc_post", (0.14, 0.14, 2.62), (x, 0.05, 1.31), wood, bevel=0.02)
    box("tc_board", (2.0, 0.08, 1.3), (0, 0.08, 1.45), planks, bevel=0.03)
    box("tc_frame_t", (2.1, 0.1, 0.08), (0, 0.06, 2.12), trim, bevel=0.02)
    box("tc_frame_b", (2.1, 0.1, 0.08), (0, 0.06, 0.78), trim, bevel=0.02)
    # roof
    for s in (-1, 1):
        th, w = math.radians(28), 0.62
        box("tc_roof", (2.4, w, 0.06), (0, s * math.cos(th) * w / 2, 2.78 - math.sin(th) * w / 2), roof, rot=(-s * th, 0, 0), bevel=0.02)
    box("tc_ridge", (2.45, 0.08, 0.08), (0, 0, 2.8), trim, bevel=0.02)
    # the tide clock: a brass ring, cream face, HIGH/LOW, tick marks for the hours
    cx, cz, R = -0.45, 1.45, 0.5
    cyl("tc_ring", R + 0.06, R + 0.06, 0.06, (cx, 0.0, cz), brass, rot=(math.pi / 2, 0, 0), verts=48, bevel=0.015)
    cyl("tc_face", R, R, 0.02, (cx, -0.04, cz), cream, rot=(math.pi / 2, 0, 0), verts=48, bevel=0)
    for k in range(12):
        a = k / 12 * math.tau; L = 0.1 if k % 3 == 0 else 0.05
        box("tc_tick", (0.018, 0.006, L), (cx + math.sin(a) * (R - 0.06 - L / 2), -0.055, cz + math.cos(a) * (R - 0.06 - L / 2)), navy, rot=(0, a, 0), bevel=0)
    for txt, dz in (("HIGH", 0.22), ("LOW", -0.24)):
        bpy.ops.object.text_add(location=(cx, -0.056, cz + dz), rotation=(math.pi / 2, 0, 0))
        t = bpy.context.object; t.data.body = txt; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.1; t.data.extrude = 0.004
        t.data.materials.append(navy); bpy.ops.object.convert(target="MESH")
    piv = _pivot("tide_hand", (cx, -0.07, cz))
    _kid(box("tc_hand", (0.035, 0.012, R - 0.1), (cx, -0.07, cz + (R - 0.1) / 2 - 0.04), black, bevel=0.004), piv)
    _kid(box("tc_handtip", (0.07, 0.012, 0.07), (cx, -0.07, cz + R - 0.17), redp, rot=(0, math.pi / 4, 0), bevel=0.004), piv)
    cyl("tc_hub", 0.035, 0.035, 0.03, (cx, -0.085, cz), brass, rot=(math.pi / 2, 0, 0), verts=16, bevel=0.005)
    # the tide tube: brass caps, glass, water on a pivot at the bottom (height 1 = full scale)
    tx, z0, TH = 0.55, 0.92, 1.1
    cyl("tc_capb", 0.13, 0.13, 0.06, (tx, -0.05, z0 - 0.03), brass, verts=20, bevel=0.01)
    cyl("tc_capt", 0.13, 0.13, 0.06, (tx, -0.05, z0 + TH + 0.03), brass, verts=20, bevel=0.01)
    wp = _pivot("tide_water", (tx, -0.05, z0))
    _kid(cyl("tc_water", 0.085, 0.085, TH, (tx, -0.05, z0 + TH / 2), water, verts=20, bevel=0), wp)
    cyl("tc_tube", 0.1, 0.1, TH, (tx, -0.05, z0 + TH / 2), glass, verts=24, bevel=0)
    for k in range(7):  # meter marks
        box("tc_mark", (0.12 if k % 3 == 0 else 0.07, 0.01, 0.012), (tx + 0.2, 0.03, z0 + 0.05 + k * (TH - 0.1) / 6), navy, bevel=0)
    # a little sand strip with a toy plane at the bottom of the tube scale: "the beach line"
    box("tc_beachline", (0.36, 0.012, 0.025), (tx, -0.16, z0 + TH * 0.4), sand, bevel=0)
    # the beach-open lamp
    sphere("tide_lamp", 0.06, (0.95, -0.12, 2.0), mat("tc_lamp", (0.3, 0.75, 0.35), rough=0.3, emit=(0.2, 1, 0.3), emit_strength=0.0), sub=2)
    # a hanging sign under the roof
    box("tc_sign", (1.3, 0.05, 0.24), (0, -0.12, 2.36), wood, bevel=0.02)
    bpy.ops.object.text_add(location=(0, -0.15, 2.36), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "PIP'S BEACH TIDES"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.11; t.data.extrude = 0.006
    t.data.materials.append(navy); bpy.ops.object.convert(target="MESH")
    # two seashells and a little fish on the board for decoration
    for i, (x, c) in enumerate(((0.95 - 0.2, (0.98, 0.78, 0.7)), (-0.95 + 0.22, (0.96, 0.9, 0.8)))):
        sphere("tc_shell", 0.06, (x, -0.01, 0.95), mat(f"tc_shell{i}", c, rough=0.5), scale=(1.2, 0.5, 1), sub=2)
    sphere("tc_fish", 0.07, (0.15, 0.0, 2.0), mat("tc_fishm", (0.95, 0.6, 0.25), rough=0.5), scale=(1.8, 0.4, 0.8), sub=2)
    cyl("tc_fishtail", 0.06, 0.0, 0.08, (0.3, 0.0, 2.0), mat("tc_fishm", (0.95, 0.6, 0.25), rough=0.5), rot=(0, math.pi / 2, 0), verts=3, bevel=0)

ASSETS.update({"tideclock": tideclock})


def meteorwatch():
    # OJ Meteor Watch (Day 5): where I lie back and count shooting stars. A hay bale bed with a backrest bale, a plaid
    # blanket, a pillow, a thermos of warm mash, a red flashlight (red light keeps your night eyes), a lantern on a
    # shepherd's hook, and a chalk tally slate on a stake. Front faces -Y.
    # Named parts: "mw_slate" (the behavior draws tonight's tally on it), "mw_lamp" (lantern glass, glows at night),
    # "mw_red" (the flashlight lens).
    hay = mat("mw_hay", WOOD, tex="hay", scale=(1.5, 1.5))
    plaid = mat("mw_plaid", WOOD, tex="plaid", scale=(1.2, 1.2))
    twine = mat("mw_twine", (0.55, 0.38, 0.2), rough=0.9)
    wood = mat("wood", WOOD, tex="wood")
    iron = mat("mw_iron", (0.18, 0.17, 0.16), rough=0.5, metal=0.4)
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.35)
    slate = mat("mw_slatem", (0.16, 0.2, 0.21), rough=0.9)
    cream = mat("mw_cream", (0.95, 0.92, 0.84), rough=0.7)
    pillow = mat("mw_pillow", (0.55, 0.68, 0.9), rough=0.9)
    redp = mat("rs_redpaint", (0.85, 0.2, 0.18), rough=0.6)
    navy = mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8)
    glow = mat("mw_glow", (1.0, 0.85, 0.5), rough=0.3, emit=(1.0, 0.7, 0.3), emit_strength=0.6)
    redl = mat("mw_redl", (0.9, 0.1, 0.1), rough=0.3, emit=(1, 0.05, 0.05), emit_strength=0.8)
    # the bale bed and its twine
    b = box("mw_bale", (1.7, 1.0, 0.5), (0, 0, 0.25), hay, bevel=0.07); jitter(b, 0.004)
    for x in (-0.45, 0.45):
        box("mw_twine", (0.03, 1.02, 0.03), (x, 0, 0.505), twine, bevel=0)
        box("mw_twine", (0.03, 0.03, 0.5), (x, -0.505, 0.25), twine, bevel=0)
    # the backrest bale, leaning back
    box("mw_back", (1.7, 0.45, 0.85), (0, 0.66, 0.52), hay, rot=(-0.38, 0, 0), bevel=0.07)
    for x in (-0.45, 0.45):
        box("mw_twine", (0.03, 0.47, 0.03), (x, 0.82, 0.93), twine, rot=(-0.38, 0, 0), bevel=0)
    # plaid blanket on top, with a fold hanging over the front
    box("mw_blanket", (1.5, 0.98, 0.04), (0.05, -0.04, 0.52), plaid, bevel=0.015)
    box("mw_fold", (1.5, 0.04, 0.34), (0.05, -0.535, 0.38), plaid, rot=(0.08, 0, 0), bevel=0.015)
    sphere("mw_pillowo", 0.26, (0.1, 0.42, 0.78), pillow, scale=(1.5, 0.55, 0.85), sub=3)
    # the red flashlight on the blanket
    cyl("mw_torch", 0.035, 0.035, 0.2, (-0.55, -0.2, 0.575), iron, rot=(0, math.pi / 2, 0.3), verts=16, bevel=0.005)
    cyl("mw_red", 0.042, 0.042, 0.02, (-0.45, -0.17, 0.575), redl, rot=(0, math.pi / 2, 0.3), verts=16, bevel=0)
    # thermos and mug on the grass
    cyl("mw_thermos", 0.09, 0.09, 0.34, (1.02, -0.3, 0.17), redp, verts=24, bevel=0.02)
    cyl("mw_thcap", 0.095, 0.095, 0.08, (1.02, -0.3, 0.38), cream, verts=24, bevel=0.015)
    cyl("mw_mug", 0.065, 0.06, 0.12, (1.2, -0.45, 0.06), cream, verts=20, bevel=0.01)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.035, minor_radius=0.012, location=(1.27, -0.45, 0.07), rotation=(math.pi / 2, 0, 0))
    finish(bpy.context.object, cream)
    # the tally slate on its stake
    sx, sy = -1.2, -0.55
    box("mw_stake", (0.07, 0.07, 1.25), (sx, sy + 0.06, 0.62), wood, bevel=0.01)
    box("mw_slate", (0.72, 0.04, 0.5), (sx, sy, 1.05), slate, bevel=0.005)
    for dz in (-0.27, 0.27):
        box("mw_frame", (0.8, 0.07, 0.05), (sx, sy, 1.05 + dz), wood, bevel=0.01)
    for dx in (-0.38, 0.38):
        box("mw_frame", (0.05, 0.07, 0.6), (sx + dx, sy, 1.05), wood, bevel=0.01)
    box("mw_chalkledge", (0.6, 0.1, 0.03), (sx, sy - 0.04, 0.77), wood, bevel=0.005)
    box("mw_chalk", (0.1, 0.025, 0.025), (sx + 0.15, sy - 0.06, 0.795), cream, bevel=0.005)
    box("mw_sign", (0.9, 0.05, 0.16), (sx, sy, 1.47), wood, bevel=0.02)
    bpy.ops.object.text_add(location=(sx, sy - 0.03, 1.47), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "METEOR WATCH"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.1; t.data.extrude = 0.006
    t.data.materials.append(navy); bpy.ops.object.convert(target="MESH")
    # little stars on the sign's corners
    for dx in (-0.4, 0.4):
        cyl("mw_star", 0.04, 0.04, 0.02, (sx + dx, sy - 0.03, 1.47), brass, rot=(math.pi / 2, 0, 0), verts=5, bevel=0)
    # shepherd's hook with a lantern
    hx, hy = 1.05, 0.62
    cyl("mw_hook", 0.025, 0.025, 1.7, (hx, hy, 0.85), iron, verts=12, bevel=0)
    box("mw_arm", (0.32, 0.03, 0.03), (hx + 0.15, hy, 1.69), iron, bevel=0)
    cyl("mw_chain", 0.008, 0.008, 0.12, (hx + 0.3, hy, 1.63), iron, verts=8, bevel=0)
    cyl("mw_lcap", 0.05, 0.1, 0.06, (hx + 0.3, hy, 1.55), iron, verts=16, bevel=0.01)
    cyl("mw_lamp", 0.075, 0.075, 0.18, (hx + 0.3, hy, 1.43), glow, verts=16, bevel=0)
    cyl("mw_lbase", 0.1, 0.1, 0.03, (hx + 0.3, hy, 1.325), iron, verts=16, bevel=0.005)
    for a in range(4):
        ang = a * math.pi / 2 + math.pi / 4
        box("mw_lbar", (0.012, 0.012, 0.2), (hx + 0.3 + math.cos(ang) * 0.085, hy + math.sin(ang) * 0.085, 1.43), iron, bevel=0)

ASSETS.update({"meteorwatch": meteorwatch})


def frostpost():
    # OJ Frost (Day 7): a frost post. A little board on a post under a peaked roof holds a Six's max-min thermometer
    # (James Six, 1780): a U-shaped glass tube. The right arm reads UP (max), the left arm reads DOWN (min, cold at the top),
    # silver "mercury" sits in the bend and two tiny blue steel markers get pushed to the hottest and coldest point.
    # In front, a grass minimum thermometer lies on two little forks just above the grass, where frost happens.
    # Scale on the board: 0 F at z=1.0 up to 100 F at z=2.0 (right arm); left arm is flipped.
    # Named parts: "max_col" / "min_col" (pivots at the bottom of each arm, scale z = fraction 0..1),
    # "max_mark" / "min_mark" (move in z), "grass_col" (pivot at the bulb end, scale x), "frost_lamp" (glows ice-blue on frost nights).
    wood = mat("wood", WOOD, tex="wood")
    planks = mat("fp_planks", (0.86, 0.9, 0.95), tex="planks", scale=(1, 1))
    trim = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    roof = mat("fp_roof", (0.55, 0.68, 0.85), tex="shingles", scale=(1.5, 1))
    stone = mat("stone", WOOD, tex="stone", scale=(2, 2))
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    glass = mat("fp_glass", (0.88, 0.94, 0.98), rough=0.05)
    silver = mat("fp_mercury", (0.82, 0.84, 0.88), rough=0.2, metal=0.6)
    blue = mat("fp_marker", (0.2, 0.35, 0.85), rough=0.4, metal=0.3)
    red = mat("fp_red", (0.85, 0.2, 0.2), rough=0.4, emit=(0.6, 0.1, 0.1), emit_strength=0.2)
    navy = mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8)
    cream = mat("rs_cream", (0.93, 0.88, 0.74), rough=0.6)
    box("fp_pad", (0.6, 0.6, 0.06), (0, 0, 0.03), stone, bevel=0.02)
    box("fp_post", (0.14, 0.14, 2.3), (0, 0.08, 1.15), wood, bevel=0.02)
    box("fp_board", (0.9, 0.06, 1.4), (0, 0, 1.55), planks, bevel=0.02)
    box("fp_scaleplate", (0.62, 0.02, 1.2), (0, -0.04, 1.52), cream, bevel=0.01)
    for z in (0.83, 2.27):
        box("fp_trim", (0.96, 0.08, 0.06), (0, -0.01, z), trim, bevel=0.015)
    for s in (-1, 1):
        th, w = math.radians(32), 0.42
        box("fp_roof", (1.1, w, 0.05), (0, s * math.cos(th) * w / 2, 2.52 - math.sin(th) * w / 2), roof, rot=(-s * th, 0, 0), bevel=0.015)
    box("fp_ridge", (1.12, 0.06, 0.06), (0, 0, 2.53), trim, bevel=0.015)
    Z0, Z1, XA = 1.0, 2.0, 0.14   # 0 F and 100 F, arm offset from center
    y = -0.08
    for x in (-XA, XA):
        cyl("fp_arm", 0.03, 0.03, Z1 - Z0 + 0.06, (x, y, (Z0 + Z1) / 2), glass, verts=16, bevel=0)
    # the U bend at the bottom
    bpy.ops.mesh.primitive_torus_add(major_radius=XA, minor_radius=0.03, location=(0, y, Z0 - 0.03), rotation=(math.pi / 2, 0, 0), major_segments=32, minor_segments=10)
    u = bpy.context.object; u.name = "fp_bend"
    bm = bmesh.new(); bm.from_mesh(u.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > 0.001], context="VERTS")  # keep the lower half (local y is world z here)
    bm.to_mesh(u.data); bm.free(); finish(u, silver, 0)
    # bulbs at the top of each arm
    sphere("fp_bulb_l", 0.06, (-XA, y, Z1 + 0.09), glass, sub=2)
    sphere("fp_bulb_r", 0.045, (XA, y, Z1 + 0.08), glass, sub=2)
    # mercury columns on pivots (scale z 0..1 = Z0..Z1)
    for nm, x in (("max_col", XA), ("min_col", -XA)):
        pv = _pivot(nm, (x, y, Z0))
        _kid(cyl(nm + "_m", 0.02, 0.02, Z1 - Z0, (x, y, (Z0 + Z1) / 2), silver, verts=12, bevel=0), pv)
    for nm, x in (("max_mark", XA), ("min_mark", -XA)):
        pv = _pivot(nm, (x, y, Z0))
        _kid(cyl(nm + "_m", 0.022, 0.022, 0.05, (x, y, Z0 + 0.025), blue, verts=10, bevel=0), pv)
    # tick marks every 10 F, a bigger one at 32 F (freezing!)
    for k in range(11):
        z = Z0 + k / 10 * (Z1 - Z0)
        for x in (-XA - 0.09, XA + 0.09):
            box("fp_tick", (0.08 if k % 5 == 0 else 0.05, 0.01, 0.01), (x, -0.06, z), navy, bevel=0)
    zf = Z0 + 0.32 * (Z1 - Z0)
    box("fp_freeze", (0.62, 0.012, 0.016), (0, -0.065, zf), mat("fp_freezeline", (0.35, 0.65, 0.95), rough=0.5), bevel=0)
    for txt, x, z, sz in (("MIN", -XA - 0.17, Z1 + 0.12, 0.07), ("MAX", XA + 0.17, Z1 + 0.12, 0.07), ("32", 0.25, zf + 0.04, 0.05), ("OJ FROST", 0, 2.43, 0.075)):
        bpy.ops.object.text_add(location=(x, -0.07 if txt != "OJ FROST" else -0.2, z), rotation=(math.pi / 2, 0, 0))
        t = bpy.context.object; t.data.body = txt; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = sz; t.data.extrude = 0.004
        t.data.materials.append(navy); bpy.ops.object.convert(target="MESH")
    # the reset magnet (for sliding the markers back down) hanging on a little hook
    cyl("fp_hook", 0.01, 0.01, 0.08, (0.37, -0.06, 1.15), brass, rot=(math.pi / 2, 0, 0), verts=8, bevel=0)
    box("fp_magnet", (0.07, 0.03, 0.1), (0.37, -0.09, 1.07), red, bevel=0.01)
    box("fp_magnet_tips", (0.075, 0.032, 0.025), (0.37, -0.09, 1.015), silver, bevel=0.004)
    # frost lamp: a little ice-blue lantern on top
    sphere("frost_lamp", 0.07, (0, -0.24, 2.18), mat("fp_lamp", (0.7, 0.88, 1.0), rough=0.2, emit=(0.5, 0.8, 1.0), emit_strength=0.0), sub=2)
    box("fp_lampbrk", (0.03, 0.2, 0.03), (0, -0.14, 2.27), brass, bevel=0)
    # grass minimum thermometer: lying flat on two little forks, 3 cm over the grass, in front of the post
    gy, gz, L = -0.75, 0.09, 0.9
    for gx in (-0.3, 0.3):
        cyl("fp_fork", 0.012, 0.012, gz + 0.02, (gx, gy, (gz + 0.02) / 2), wood, verts=8, bevel=0)
        for s in (-1, 1):
            cyl("fp_prong", 0.008, 0.008, 0.06, (gx + s * 0.025, gy, gz + 0.03), wood, rot=(0, s * 0.4, 0), verts=6, bevel=0)
    cyl("fp_gtube", 0.022, 0.022, L, (0, gy, gz), glass, rot=(0, math.pi / 2, 0), verts=14, bevel=0)
    sphere("fp_gbulb", 0.04, (-L / 2 - 0.02, gy, gz), mat("fp_gbulbm", (0.85, 0.3, 0.3), rough=0.2), scale=(1.4, 1, 1), sub=2)
    pv = _pivot("grass_col", (-L / 2, gy, gz))
    _kid(cyl("grass_col_m", 0.012, 0.012, L, (0, gy, gz), mat("fp_alcohol", (0.9, 0.25, 0.25), rough=0.3), rot=(0, math.pi / 2, 0), verts=10, bevel=0), pv)
    box("fp_gtag", (0.2, 0.01, 0.08), (0.62, gy, 0.08), cream, bevel=0.005)

ASSETS.update({"frostpost": frostpost})

def bakeoven():
    # OJ Bakehouse (Day 8): a cob earth oven on a round stone base, under a little shingled roof on four posts.
    # Real earth ovens are a dome of clay+sand (the "thermal mass" that soaks up the fire's heat), wrapped in a layer of
    # clay+straw (insulation) and a smooth plaster coat. You burn a fire INSIDE it, rake it out, and bake on the hot floor.
    # Named parts (for behaviors/bakeoven.js): "oven_mouth" (dark doorway, glows with the fire), "flames" (pivot, flicker),
    # "soot" (black patch over the arch that burns off when the oven is really hot), "oven_door" (pivot, moves between
    # leaning-on-the-base and in-the-doorway), "temp_needle" (pivot on the brass dial), "loaf_1..3", "cookies", "smoke_pt".
    stone = mat("stone", WOOD, tex="stone", scale=(3, 1))
    clay = mat("bo_clay", WOOD, tex="clay", scale=(2, 2))
    brick = mat("bo_brick", WOOD, tex="brick", scale=(1.5, 1.5))
    wood = mat("wood", WOOD, tex="wood")
    planks = mat("bo_planks", (0.95, 0.85, 0.75), tex="planks", scale=(1, 1))
    roof = mat("bo_roof", (0.95, 0.75, 0.6), tex="shingles", scale=(3, 2))
    trim = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    bark = mat("bark", WOOD, tex="bark")
    endw = mat("bo_logend", (0.86, 0.7, 0.48), rough=0.8)
    dark = mat("bo_mouth", (0.06, 0.04, 0.03), rough=1.0, emit=(1.0, 0.45, 0.12), emit_strength=0.0)
    flame = mat("bo_flame", (1.0, 0.62, 0.15), rough=0.5, emit=(1.0, 0.55, 0.1), emit_strength=2.0)
    flame2 = mat("bo_flame2", (1.0, 0.88, 0.35), rough=0.5, emit=(1.0, 0.85, 0.3), emit_strength=2.0)
    soot = mat("bo_soot", (0.12, 0.1, 0.09), rough=1.0)
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    cream = mat("rs_cream", (0.93, 0.88, 0.74), rough=0.6)
    navy = mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8)
    red = mat("bo_red", (0.8, 0.2, 0.18), rough=0.5)
    metal = mat("bo_metal", (0.55, 0.57, 0.6), rough=0.45, metal=0.35)
    crust = mat("bo_crust", (0.78, 0.5, 0.22), rough=0.6)
    crumb = mat("bo_score", (0.95, 0.85, 0.62), rough=0.7)
    # round stone base: the oven floor sits at z = 0.9 (a comfy height for a baker; a chicken hops up on the ledge)
    FZ = 0.9
    cyl("bo_base", 1.3, 1.25, FZ, (0, 0, FZ / 2), stone, verts=40, bevel=0.04)
    cyl("bo_cap", 1.34, 1.34, 0.08, (0, 0, FZ - 0.02), mat("bo_capstone", (0.78, 0.74, 0.68), tex="stone", scale=(2, 1)), verts=40, bevel=0.02)
    box("bo_ledge", (1.1, 0.5, 0.1), (0, -1.35, FZ - 0.05), mat("bo_capstone", (0.78, 0.74, 0.68), tex="stone", scale=(2, 1)), bevel=0.02)
    # the dome (a little egg, of course)
    d = sphere("bo_dome", 1.0, (0, 0.1, FZ), clay, scale=(1.0, 1.08, 0.92), sub=4); jitter(d, 0.012)
    # brick entrance tunnel sticking out the front, with a round top (an arch)
    AW, AH, AY0, AY1 = 0.46, 0.34, -0.75, -1.18      # half width, wall height, back/front of tunnel
    L = AY0 - AY1
    box("bo_arch_walls", (AW * 2, L, AH), (0, (AY0 + AY1) / 2, FZ + AH / 2), brick, bevel=0.03)
    cyl("bo_arch_top", AW, AW, L, (0, (AY0 + AY1) / 2, FZ + AH), brick, rot=(math.pi / 2, 0, 0), verts=32, bevel=0.03)
    # the doorway: dark (and it glows orange when the fire is going)
    MW, MH = 0.27, 0.22
    mw = box("oven_mouth_a", (MW * 2, 0.03, MH), (0, AY1 - 0.005, FZ + MH / 2 + 0.02), dark, bevel=0)
    mt = cyl("oven_mouth_b", MW, MW, 0.03, (0, AY1 - 0.005, FZ + MH + 0.02), dark, rot=(math.pi / 2, 0, 0), verts=24, bevel=0)
    bpy.ops.object.select_all(action="DESELECT"); mw.select_set(True); mt.select_set(True); bpy.context.view_layer.objects.active = mw
    bpy.ops.object.join(); mw.name = "oven_mouth"
    # keystone + dial over the arch
    box("bo_keystone", (0.14, 0.06, 0.16), (0, AY1 - 0.01, FZ + AH + AW - 0.05), mat("bo_capstone", (0.78, 0.74, 0.68), tex="stone", scale=(2, 1)), bevel=0.02)
    cyl("bo_dial", 0.13, 0.13, 0.04, (0, AY1 - 0.08, FZ + AH + AW + 0.2), brass, rot=(math.pi / 2, 0, 0), verts=24, bevel=0.01)
    cyl("bo_dialface", 0.11, 0.11, 0.01, (0, AY1 - 0.105, FZ + AH + AW + 0.2), cream, rot=(math.pi / 2, 0, 0), verts=24, bevel=0)
    cyl("bo_dialstem", 0.015, 0.015, 0.2, (0, AY1 + 0.02, FZ + AH + AW + 0.2), brass, rot=(math.pi / 2, 0, 0), verts=8, bevel=0)
    for k in range(9):  # ticks from 7 o'clock (cold) round to 5 o'clock (900 F)
        a = math.radians(-135 + k * 270 / 8)
        box("bo_tick", (0.012, 0.01, 0.03), (math.sin(a) * 0.085, AY1 - 0.115, FZ + AH + AW + 0.2 + math.cos(a) * 0.085), red if k >= 6 else navy, rot=(0, a, 0), bevel=0)
    DZ = FZ + AH + AW + 0.2
    pv = _pivot("temp_needle", (0, AY1 - 0.12, DZ))
    _kid(box("temp_needle_m", (0.012, 0.008, 0.09), (0, AY1 - 0.12, DZ + 0.04), red, bevel=0), pv)
    # soot: the black smudge that rises out of the doorway onto the dome. It burns off white-clean at ~600-700 F.
    sp_ = _pivot("soot", (0, AY1, FZ + AH))
    s_ = sphere("soot_dome", 1.0, (0, 0.1, FZ), soot, scale=(1.012, 1.092, 0.932), sub=4)
    bm = bmesh.new(); bm.from_mesh(s_.data)   # keep only a smudge on the front of the dome, above the arch
    def keep(v):
        x, y, z = v.co.x, v.co.y - 0.1, v.co.z - FZ
        return y < -0.05 and 0.5 < z and abs(x) < 0.62 - (z - 0.5) * 0.5
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if not keep(v)], context="VERTS")
    bm.to_mesh(s_.data); bm.free(); _kid(s_, sp_)
    # ...and on the top of the brick arch, where the smoke pours out
    a_ = cyl("soot_arch", AW + 0.012, AW + 0.012, L + 0.02, (0, (AY0 + AY1) / 2, FZ + AH), soot, rot=(math.pi / 2, 0, 0), verts=32, bevel=0)
    bm = bmesh.new(); bm.from_mesh(a_.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y > -AW * 0.55], context="VERTS")  # local -y here is up
    bm.to_mesh(a_.data); bm.free(); _kid(a_, sp_)
    # flames (just peeking out of the doorway)
    fp = _pivot("flames", (0, AY1 + 0.03, FZ + 0.02))
    for x, h, r, m in ((-0.13, 0.22, 0.07, flame), (0.0, 0.3, 0.09, flame), (0.12, 0.2, 0.065, flame), (-0.05, 0.16, 0.05, flame2), (0.06, 0.18, 0.05, flame2)):
        c = cyl("flame", r, 0.005, h, (x, AY1 + 0.03, FZ + 0.02 + h / 2), m, verts=10, bevel=0); _kid(c, fp)
    # a little spot where the smoke comes out (smoke from an earth oven pours out of the top of the doorway)
    _pivot("smoke_pt", (0, AY1 - 0.05, FZ + MH + MW + 0.05))
    # the oven door: planks with a handle, shaped like the doorway. Built in the doorway; the behavior moves it.
    dp = _pivot("oven_door", (0, AY1 - 0.05, FZ))
    dw = box("door_a", (MW * 2 + 0.08, 0.06, MH + 0.02), (0, AY1 - 0.05, FZ + (MH + 0.02) / 2 + 0.02), planks, bevel=0.01); _kid(dw, dp)
    dt = cyl("door_b", MW + 0.04, MW + 0.04, 0.06, (0, AY1 - 0.05, FZ + MH + 0.03), planks, rot=(math.pi / 2, 0, 0), verts=24, bevel=0.01); _kid(dt, dp)
    _kid(box("door_bar", (MW * 2 + 0.1, 0.03, 0.05), (0, AY1 - 0.09, FZ + 0.16), metal, bevel=0.005), dp)
    _kid(cyl("door_knob", 0.035, 0.035, 0.08, (0, AY1 - 0.12, FZ + 0.3), wood, rot=(math.pi / 2, 0, 0), verts=12, bevel=0.01), dp)
    # roof on four posts, gable facing front
    PX, PY, PH = 1.55, 1.45, 2.75
    for x in (-PX, PX):
        for y in (-PY, PY):
            box("bo_post", (0.16, 0.16, PH), (x, y, PH / 2), wood, bevel=0.02)
            cyl("bo_footing", 0.16, 0.18, 0.12, (x, y, 0.06), stone, verts=12, bevel=0.01)
        box("bo_beam", (0.14, PY * 2 + 0.3, 0.16), (x, 0, PH - 0.05), wood, bevel=0.02)
    th = math.radians(30); half = PX + 0.35; w = half / math.cos(th)
    for sgn in (-1, 1):
        box("bo_roof", (w, PY * 2 + 0.7, 0.1), (sgn * half / 2, 0, PH + 0.05 + math.tan(th) * half / 2), roof, rot=(0, sgn * th, 0), bevel=0.02)
    RZ = PH + 0.05 + math.tan(th) * half
    box("bo_ridge", (0.18, PY * 2 + 0.75, 0.14), (0, 0, RZ + 0.02), trim, bevel=0.04)
    for y in (-PY - 0.05, PY + 0.05):
        me = bpy.data.meshes.new("gable"); me.from_pydata([(-PX - 0.05, y, PH + 0.03), (PX + 0.05, y, PH + 0.03), (0, y, RZ - 0.05)], [], [(0, 1, 2)]); me.uv_layers.new()
        o = bpy.data.objects.new("bo_gable", me); bpy.context.scene.collection.objects.link(o); finish(o, planks, smooth=False)
        o.modifiers.new("solid", "SOLIDIFY").thickness = 0.05
    # sign hanging under the front gable
    box("bo_sign", (1.5, 0.05, 0.3), (0, -PY - 0.12, PH + 0.42), cream, bevel=0.02)
    bpy.ops.object.text_add(location=(0, -PY - 0.15, PH + 0.42), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ BAKEHOUSE"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.17; t.data.extrude = 0.008
    t.data.materials.append(mat("bo_ink", (0.55, 0.2, 0.15), rough=0.8)); bpy.ops.object.convert(target="MESH")
    # a little wheat sheaf on the sign (three ears)
    for k, a in enumerate((-0.35, 0, 0.35)):
        sphere("bo_wheat", 0.05, (-0.85 + math.sin(a) * 0.08, -PY - 0.15, PH + 0.48 + math.cos(a) * 0.05), mat("bo_gold", (0.92, 0.72, 0.3), rough=0.6), scale=(0.5, 0.5, 1.4), sub=2)
    # woodpile on the left: split logs stacked three rows high
    random.seed(11)
    for row in range(3):
        n = 4 - row
        for i in range(n):
            x = -2.15 + random.uniform(-0.03, 0.03); y = -0.6 + (i + row * 0.5) * 0.36; z = 0.17 + row * 0.3
            cyl("bo_log", 0.16, 0.16, 0.9, (x, y, z), bark, rot=(0, math.pi / 2, 0), verts=10, bevel=0.01)
            for sx in (-0.451, 0.451): cyl("bo_logend", 0.14, 0.14, 0.01, (x + sx, y, z), endw, rot=(0, math.pi / 2, 0), verts=10, bevel=0)
    # the peel (a big wooden spatula) leaning on the right front post
    cyl("bo_peel_handle", 0.03, 0.03, 2.0, (PX - 0.18, -PY - 0.15, 1.05), wood, rot=(0.12, -0.12, 0), verts=8, bevel=0)
    box("bo_peel_blade", (0.4, 0.03, 0.45), (PX - 0.2, -PY - 0.03, 0.22), wood, rot=(0.12, -0.12, 0), bevel=0.04)
    # water bucket + the "scuffle" (a wet rag mop for cleaning ash off the floor)
    cyl("bo_bucket", 0.2, 0.25, 0.4, (-1.85, -1.35, 0.2), metal, verts=20, bevel=0.01)
    cyl("bo_water", 0.21, 0.21, 0.01, (-1.85, -1.35, 0.37), mat("bo_wat", (0.3, 0.55, 0.75), rough=0.1), verts=20, bevel=0)
    cyl("bo_mop", 0.02, 0.02, 1.3, (-1.75, -1.3, 0.85), wood, rot=(0.0, 0.25, 0), verts=8, bevel=0)
    # cooling bench on the right with the day's bread
    BX, BY, BZ = 2.25, 0.0, 0.75
    box("bo_bench", (0.75, 1.6, 0.08), (BX, BY, BZ), planks, bevel=0.02)
    for x in (BX - 0.3, BX + 0.3):
        for y in (BY - 0.7, BY + 0.7): box("bo_bleg", (0.08, 0.08, BZ), (x, y, BZ / 2), wood, bevel=0.01)
    box("bo_rack", (0.6, 1.0, 0.02), (BX, BY - 0.2, BZ + 0.05), metal, bevel=0)
    for i, y in enumerate((-0.55, -0.2, 0.15)):
        l = sphere(f"loaf_{i + 1}", 0.22, (BX, BY + y, BZ + 0.15), crust, scale=(1.0, 0.75, 0.5), sub=3); jitter(l, 0.006)
        sc = box(f"loaf_{i + 1}_score", (0.03, 0.2, 0.02), (BX + 0.02, BY + y, BZ + 0.255), crumb, rot=(0, 0, 0.5), bevel=0.008); _kid(sc, l)
    tp = _pivot("cookies", (BX - 0.08, BY + 0.55, BZ + 0.05))
    _kid(box("bo_tray", (0.42, 0.4, 0.025), (BX - 0.1, BY + 0.55, BZ + 0.055), metal, bevel=0.01), tp)
    for i in range(6):
        cx = BX - 0.26 + (i % 3) * 0.13; cy = BY + 0.48 + (i // 3) * 0.15
        _kid(cyl("bo_cookie", 0.055, 0.055, 0.03, (cx, cy, BZ + 0.085), mat("bo_cookiem", (0.82, 0.6, 0.32), rough=0.7), verts=14, bevel=0.01), tp)
    # my sourdough starter in a glass jar (fed every morning; the goo inside rises and falls: pivot "starter", scale z)
    glass = mat("bo_glass", (0.85, 0.93, 0.97), rough=0.05)
    jx, jy = BX + 0.22, BY + 0.62
    sp = _pivot("starter", (jx, jy, BZ + 0.05))
    _kid(cyl("starter_goo", 0.075, 0.075, 0.2, (jx, jy, BZ + 0.15), mat("bo_goo", (0.96, 0.92, 0.8), rough=0.6), verts=16, bevel=0), sp)
    cyl("bo_jar", 0.085, 0.085, 0.36, (jx, jy, BZ + 0.22), glass, verts=20, bevel=0.01)
    cyl("bo_jarcloth", 0.1, 0.1, 0.03, (jx, jy, BZ + 0.41), mat("bo_cloth", (0.85, 0.3, 0.3), tex="plaid", scale=(0.3, 0.3)), verts=20, bevel=0.01)
    box("bo_jartag", (0.1, 0.01, 0.06), (jx, jy - 0.09, BZ + 0.24), cream, bevel=0.003)

ASSETS.update({"bakeoven": bakeoven})
def kitepost():
    # OJ Kites (Day 8 bonus): a kite post. A wooden post with a hand reel (the crank really turns) where I tie my kite
    # off on good-wind days, a Beaufort board (0 calm .. 6 reel in!) with a brass pointer, and my kite: an Eddy kite
    # (William Eddy, 1890s): a diamond with its cross spar BOWED back, so the two halves make a shallow V into the wind.
    # Named parts: "reel" (pivot, turns about x), "line_eye" (where the line leaves the reel), "bft_pointer" (moves in z:
    # row k sits at z = 1.5 + k*0.1), "kite" (pivot at the cross of the spars; front = -Y; bridle point is 0.35 in front).
    wood = mat("wood", WOOD, tex="wood")
    planks = mat("kp_planks", (0.95, 0.92, 0.85), tex="planks")
    stone = mat("stone", WOOD, tex="stone", scale=(2, 2))
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    cream = mat("rs_cream", (0.93, 0.88, 0.74), rough=0.6)
    navy = mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8)
    string = mat("kp_string", (0.97, 0.95, 0.9), rough=0.9)
    trim = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    box("kp_pad", (0.7, 0.7, 0.06), (0, 0, 0.03), stone, bevel=0.02)
    box("kp_post", (0.14, 0.14, 2.3), (0, 0.06, 1.15), wood, bevel=0.02)
    sphere("kp_finial", 0.09, (0, 0.06, 2.36), trim, sub=2)
    # the reel on two little arms
    for x in (-0.11, 0.11):
        box("kp_arm", (0.03, 0.26, 0.06), (x, -0.08, 1.0), wood, bevel=0.01)
    reel = _pivot("reel", (0, -0.18, 1.0))
    for x in (-0.085, 0.085):
        _kid(cyl("kp_flange", 0.19, 0.19, 0.025, (x, -0.18, 1.0), wood, rot=(0, math.pi / 2, 0), verts=28, bevel=0.006), reel)
    _kid(cyl("kp_wound", 0.13, 0.13, 0.15, (0, -0.18, 1.0), string, rot=(0, math.pi / 2, 0), verts=28, bevel=0.01), reel)
    for k in range(6):  # spokes on the outside flange so you can SEE it turn
        a = k * math.pi / 3
        _kid(box("kp_spoke", (0.012, 0.03, 0.3), (0.1, -0.18, 1.0), mat("kp_red", (0.82, 0.22, 0.18), rough=0.6), rot=(a, 0, 0), bevel=0.004), reel)
    _kid(box("kp_crank", (0.025, 0.04, 0.2), (0.115, -0.18, 1.08), brass, bevel=0.008), reel)
    _kid(cyl("kp_knob", 0.03, 0.03, 0.09, (0.16, -0.18, 1.16), mat("kp_knobm", (0.82, 0.22, 0.18), rough=0.5), rot=(0, math.pi / 2, 0), verts=12, bevel=0.01), reel)
    _pivot("line_eye", (0, -0.18, 1.14))
    # Beaufort board
    by = -0.04
    box("kp_board", (0.8, 0.05, 0.95), (0, by, 1.82), planks, bevel=0.02)
    for z in (1.33, 2.31):
        box("kp_trim", (0.86, 0.07, 0.05), (0, by, z), trim, bevel=0.012)
    cols = [(0.72, 0.86, 0.95), (0.62, 0.85, 0.82), (0.55, 0.82, 0.5), (0.36, 0.72, 0.34), (0.95, 0.8, 0.3), (0.96, 0.58, 0.25), (0.88, 0.28, 0.22)]
    words = ["0 CALM", "1 SMOKE DRIFTS", "2 LEAVES RUSTLE", "3 TWIGS DANCE", "4 BRANCHES MOVE", "5 TREES SWAY", "6 REEL IN!"]
    for k, c in enumerate(cols):
        z = 1.5 + k * 0.1
        box("kp_row", (0.6, 0.012, 0.085), (0.06, by - 0.03, z), mat(f"kp_row{k}", c, rough=0.7), bevel=0.004)
        bpy.ops.object.text_add(location=(0.06, by - 0.04, z), rotation=(math.pi / 2, 0, 0))
        t = bpy.context.object; t.data.body = words[k]; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.055; t.data.extrude = 0.003
        t.data.materials.append(navy); bpy.ops.object.convert(target="MESH")
    bpy.ops.object.text_add(location=(0, by - 0.04, 2.2), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ KITES"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.1; t.data.extrude = 0.005
    t.data.materials.append(navy); bpy.ops.object.convert(target="MESH")
    box("kp_rail", (0.02, 0.02, 0.72), (-0.3, by - 0.035, 1.8), brass, bevel=0)
    pt = _pivot("bft_pointer", (-0.3, by - 0.05, 1.5))
    bpy.ops.mesh.primitive_cone_add(vertices=3, radius1=0.05, depth=0.02, location=(-0.3, by - 0.05, 1.5), rotation=(math.pi / 2, 0, -math.pi / 2))
    a = bpy.context.object; a.name = "kp_arrow"; finish(a, brass, 0, smooth=False); _kid(a, pt)
    # the kite (built at the origin, then leaned against the post)
    kite = _pivot("kite", (0, 0, 0))
    red = mat("kp_sail_red", (0.9, 0.25, 0.2), rough=0.7, tex="ripstop")
    yel = mat("kp_sail_yel", (1.0, 0.8, 0.25), rough=0.7, tex="ripstop")
    T, B, W, BOW = 0.45, -0.85, 0.58, 0.13
    top, bot, ctr, lft, rgt = Vector((0, 0, T)), Vector((0, 0, B)), Vector((0, 0, 0)), Vector((-W, BOW, 0)), Vector((W, BOW, 0))
    for nm, tri, m in (("kp_sail_tl", (top, lft, ctr), red), ("kp_sail_tr", (top, ctr, rgt), red), ("kp_sail_bl", (ctr, lft, bot), yel), ("kp_sail_br", (ctr, bot, rgt), yel)):
        me = bpy.data.meshes.new(nm); me.from_pydata([tuple(v) for v in tri], [], [(0, 1, 2)]); me.update()
        uv = me.uv_layers.new(); 
        for li, l in enumerate(me.loops): v = tri[l.vertex_index]; uv.data[li].uv = (v.x * 2 + 0.5, v.z * 2 + 0.5)
        o = bpy.data.objects.new(nm, me); bpy.context.collection.objects.link(o); o.data.materials.append(m); _kid(o, kite)
    def spar(nm, a, b, r=0.012):
        d = b - a; L = d.length; mid = (a + b) / 2
        o = cyl(nm, r, r, L, tuple(mid), wood, verts=8, bevel=0)
        o.rotation_mode = "QUATERNION"; o.rotation_quaternion = d.to_track_quat("Z", "Y"); return _kid(o, kite)
    spar("kp_spine", top + Vector((0, -0.01, 0.02)), bot + Vector((0, -0.01, -0.02)))
    spar("kp_spar_l", lft + Vector((-0.02, 0.0, 0)), ctr + Vector((0, -0.015, 0)))
    spar("kp_spar_r", ctr + Vector((0, -0.015, 0)), rgt + Vector((0.02, 0.0, 0)))
    bpy.ops.object.text_add(location=(0, -0.012, -0.38), rotation=(math.pi / 2, 0, 0))
    t = bpy.context.object; t.data.body = "OJ"; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = 0.22; t.data.extrude = 0.004
    t.data.materials.append(mat("kp_navy2", (0.15, 0.22, 0.55), rough=0.7)); bpy.ops.object.convert(target="MESH"); _kid(t, kite)
    sphere("kp_nose", 0.03, (0, -0.02, 0), brass, sub=1).parent = None
    _kid(bpy.data.objects["kp_nose"], kite)
    # lean it against the post on the right, like it's waiting for wind
    kite.location = (0.62, -0.12, 0.93); kite.rotation_euler = (0.18, 0, -0.12)

ASSETS.update({"kitepost": kitepost})


# ---------------- OJ Rail (Day 9) ----------------
# A ride-on garden railway: gauge 0.9 (rails at x = +-0.45), rail tops at z = 0.14. Front of every vehicle = -Y.
def _txt(body, loc, rot, size, m, extrude=0.012):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    t = bpy.context.object; t.data.body = body; t.data.align_x = "CENTER"; t.data.align_y = "CENTER"; t.data.size = size; t.data.extrude = extrude
    t.data.materials.append(m); bpy.ops.object.convert(target="MESH"); return t

def _wheel(name, x, y, z, r, iron, red, brass, spokes=8):
    # a pivot that spins about X, with a flanged iron wheel, red spokes and a brass hub
    pv = _pivot(name, (x, y, z)); s = 1 if x > 0 else -1
    _kid(cyl(name + "_tyre", r, r, 0.1, (x, y, z), iron, rot=(0, math.pi / 2, 0), verts=28, bevel=0.01), pv)
    _kid(cyl(name + "_flange", r + 0.04, r + 0.04, 0.03, (x - s * 0.06, y, z), iron, rot=(0, math.pi / 2, 0), verts=28, bevel=0.005), pv)
    _kid(cyl(name + "_face", r * 0.82, r * 0.82, 0.104, (x, y, z), red, rot=(0, math.pi / 2, 0), verts=24, bevel=0.0), pv)
    for k in range(spokes):
        a = k * math.pi * 2 / spokes
        _kid(box(name + "_spoke", (0.03, 0.035, r * 1.6), (x + s * 0.055, y, z), iron, rot=(a, 0, 0), bevel=0.005), pv)
    _kid(cyl(name + "_hub", r * 0.25, r * 0.25, 0.13, (x + s * 0.01, y, z), brass, rot=(0, math.pi / 2, 0), verts=14, bevel=0.01), pv)
    return pv

def loco():
    # "Biscuit", engine No. 9: a little green tank engine. Named parts for behaviors/railway.js:
    # wheel_1..wheel_4 (pivots, spin about X), rod_L / rod_R (side rods, the script moves them round in a circle with the
    # crank pins), headlamp (emissive), firebox_glow (the open firehole, glows), stack_top (where the smoke comes out),
    # whistle_pt (where the steam whistle puffs).
    green = mat("lo_green", (0.16, 0.42, 0.3), rough=0.45)
    green2 = mat("lo_green2", (0.12, 0.33, 0.24), rough=0.5)
    black = mat("lo_black", (0.1, 0.1, 0.11), rough=0.55)
    red = mat("lo_red", (0.78, 0.17, 0.14), rough=0.5)
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    iron = mat("lo_iron", (0.3, 0.3, 0.32), rough=0.45, metal=0.35)
    cream = mat("lo_cream", (0.96, 0.9, 0.74), rough=0.6)
    wood = mat("wood", WOOD, tex="wood")
    coal = mat("lo_coal", (0.08, 0.08, 0.09), rough=0.9)
    lamp = mat("lo_lamp", (1, 0.93, 0.7), rough=0.3, emit=(1, 0.85, 0.5), emit_strength=2.5)
    fire = mat("lo_fire", (1, 0.55, 0.15), rough=0.5, emit=(1, 0.5, 0.12), emit_strength=2.0)
    glass = mat("lo_glass", (0.55, 0.7, 0.8), rough=0.15, metal=0.2)
    WZ = 0.46  # axle height (wheel radius 0.32 + rail top 0.14)
    # frame, footplate and red buffer beams
    box("lo_frame", (0.66, 3.1, 0.26), (0, 0.05, 0.62), black, bevel=0.02)
    box("lo_footplate", (1.32, 3.25, 0.07), (0, 0.05, 0.85), black, bevel=0.015)
    box("lo_valance", (1.34, 3.27, 0.03), (0, 0.05, 0.82), red, bevel=0.0)
    for y in (-1.66, 1.73):
        box("lo_beam", (1.36, 0.12, 0.3), (0, y, 0.66), red, bevel=0.02)
        for x in (-0.42, 0.42):
            cyl("lo_buffer", 0.06, 0.06, 0.16, (x, y + (-0.12 if y < 0 else 0.12), 0.66), iron, rot=(math.pi / 2, 0, 0), verts=12, bevel=0.01)
            cyl("lo_bufhead", 0.1, 0.1, 0.03, (x, y + (-0.2 if y < 0 else 0.2), 0.66), iron, rot=(math.pi / 2, 0, 0), verts=16, bevel=0.01)
        box("lo_coupler", (0.12, 0.2, 0.08), (0, y + (-0.12 if y < 0 else 0.12), 0.6), iron, bevel=0.01)
    # a little cowcatcher (chicken-catcher?) at the front
    for k in range(5):
        x = -0.4 + k * 0.2
        box("lo_catcher", (0.05, 0.3, 0.05), (x, -1.84, 0.36), red, rot=(0.9, 0, 0), bevel=0.01)
    box("lo_catcher_bar", (1.0, 0.05, 0.06), (0, -1.94, 0.26), red, bevel=0.01)
    # wheels (0-4-0) and the cylinders that drive them
    for i, (x, y) in enumerate([(-0.5, -0.65), (0.5, -0.65), (-0.5, 0.65), (0.5, 0.65)]):
        _wheel(f"wheel_{i + 1}", x, y, WZ, 0.32, iron, red, brass)
    for s, nm in ((-1, "rod_L"), (1, "rod_R")):
        x = s * 0.62
        cyl("lo_cyl", 0.15, 0.15, 0.55, (x - s * 0.02, -1.25, 0.62), green, rot=(math.pi / 2, 0, 0), verts=20, bevel=0.02)
        for y in (-1.53, -0.97): cyl("lo_cylend", 0.16, 0.16, 0.04, (x - s * 0.02, y, 0.62), brass, rot=(math.pi / 2, 0, 0), verts=20, bevel=0.005)
        pv = _pivot(nm, (x, 0, WZ))
        _kid(box(nm + "_bar", (0.05, 1.5, 0.07), (x, 0, WZ), iron, bevel=0.012), pv)
        for y in (-0.65, 0.65): _kid(cyl(nm + "_pin", 0.05, 0.05, 0.08, (x + s * 0.01, y, WZ), brass, rot=(0, math.pi / 2, 0), verts=10, bevel=0.005), pv)
    # the boiler, with brass bands and a black smokebox at the front
    BZ = 1.3
    cyl("lo_boiler", 0.42, 0.42, 2.0, (0, -0.45, BZ), green, rot=(math.pi / 2, 0, 0), verts=36, bevel=0.0)
    for y in (-1.05, -0.45, 0.15): cyl("lo_band", 0.43, 0.43, 0.04, (0, y, BZ), brass, rot=(math.pi / 2, 0, 0), verts=36, bevel=0.0)
    cyl("lo_smokebox", 0.45, 0.45, 0.4, (0, -1.4, BZ), black, rot=(math.pi / 2, 0, 0), verts=36, bevel=0.02)
    box("lo_saddle", (0.7, 0.4, 0.4), (0, -1.4, 1.0), black, bevel=0.02)
    cyl("lo_door", 0.38, 0.36, 0.06, (0, -1.62, BZ), black, rot=(math.pi / 2, 0, 0), verts=32, bevel=0.02)
    cyl("lo_doorring", 0.4, 0.4, 0.02, (0, -1.6, BZ), brass, rot=(math.pi / 2, 0, 0), verts=32, bevel=0.0)
    cyl("lo_doorhandle", 0.04, 0.04, 0.08, (0, -1.67, BZ), brass, rot=(math.pi / 2, 0, 0), verts=10, bevel=0.005)
    _txt("9", (0, -1.655, BZ + 0.2), (math.pi / 2, 0, 0), 0.16, brass, 0.01)
    # headlamp on top of the smokebox
    cyl("lo_lampcase", 0.12, 0.12, 0.2, (0, -1.5, BZ + 0.52), black, rot=(math.pi / 2, 0, 0), verts=18, bevel=0.01)
    cyl("headlamp", 0.1, 0.1, 0.03, (0, -1.61, BZ + 0.52), lamp, rot=(math.pi / 2, 0, 0), verts=18, bevel=0.0)
    # chimney (stack) with a flared brass-rimmed top, steam dome, safety valves
    cyl("lo_stack", 0.12, 0.14, 0.5, (0, -1.25, BZ + 0.62), black, verts=20, bevel=0.01)
    cyl("lo_stacktop", 0.21, 0.13, 0.16, (0, -1.25, BZ + 0.93), black, verts=20, bevel=0.01)
    cyl("lo_stackrim", 0.22, 0.22, 0.03, (0, -1.25, BZ + 1.01), brass, verts=20, bevel=0.0)
    _pivot("stack_top", (0, -1.25, BZ + 1.05))
    cyl("lo_dome", 0.2, 0.22, 0.24, (0, -0.4, BZ + 0.48), brass, verts=24, bevel=0.02)
    sphere("lo_domecap", 0.2, (0, -0.4, BZ + 0.6), brass, scale=(1, 1, 0.55), sub=3)
    for x in (-0.06, 0.06): cyl("lo_valve", 0.035, 0.035, 0.18, (x, 0.25, BZ + 0.5), brass, verts=10, bevel=0.005)
    # sand boxes on the footplate + handrails
    for s in (-1, 1):
        box("lo_sandbox", (0.18, 0.36, 0.26), (s * 0.52, -0.55, 1.0), green2, bevel=0.03)
        cyl("lo_rail", 0.015, 0.015, 1.9, (s * 0.47, -0.45, BZ + 0.18), brass, rot=(math.pi / 2, 0, 0), verts=6, bevel=0.0)
    # the cab
    CY0, CY1, CW, CH = 0.55, 1.62, 1.28, 2.3
    box("lo_cabfront", (CW, 0.08, CH - 0.88), (0, CY0, (CH + 0.88) / 2), green, bevel=0.02)
    for x in (-0.33, 0.33):
        cyl("lo_spectacle", 0.13, 0.13, 0.1, (x, CY0, 1.85), glass, rot=(math.pi / 2, 0, 0), verts=20, bevel=0.0)
        cyl("lo_specring", 0.15, 0.15, 0.09, (x, CY0 - 0.01, 1.85), brass, rot=(math.pi / 2, 0, 0), verts=20, bevel=0.0)
    for s in (-1, 1):
        box("lo_cabside_low", (0.07, CY1 - CY0, 0.62), (s * CW / 2, (CY0 + CY1) / 2, 1.19), green, bevel=0.02)
        box("lo_cabside_back", (0.07, 0.3, CH - 0.88), (s * CW / 2, CY1 - 0.15, (CH + 0.88) / 2), green, bevel=0.02)
        box("lo_cabside_front", (0.07, 0.16, CH - 0.88), (s * CW / 2, CY0 + 0.08, (CH + 0.88) / 2), green, bevel=0.02)
        box("lo_lining", (0.075, CY1 - CY0 - 0.1, 0.03), (s * CW / 2, (CY0 + CY1) / 2, 1.45), cream, bevel=0.0)
        box("lo_plate", (0.08, 0.5, 0.18), (s * (CW / 2 + 0.01), (CY0 + CY1) / 2 - 0.05, 1.18), brass, bevel=0.01)
        _txt("BISCUIT", (s * (CW / 2 + 0.06), (CY0 + CY1) / 2 - 0.05, 1.18), (math.pi / 2, 0, s * math.pi / 2), 0.1, red, 0.01)
    box("lo_cabback", (CW, 0.07, 0.5), (0, CY1, 1.13), green, bevel=0.02)
    box("lo_bunker", (1.0, 0.36, 0.42), (0, CY1 - 0.24, 1.1), green2, bevel=0.03)
    for k in range(9):
        sphere("lo_coal", 0.09, (-0.36 + (k % 5) * 0.18, CY1 - 0.26 + (k // 5) * 0.12, 1.32 + random.uniform(0, 0.04)), coal, sub=1, smooth=False)
    # roof (a gentle curve: a wide flat cylinder slice)
    rf = cyl("lo_roof", 1.4, 1.4, CY1 - CY0 + 0.3, (0, (CY0 + CY1) / 2, CH - 1.22), black, rot=(math.pi / 2, 0, 0), verts=64, bevel=0.0)
    bm = bmesh.new(); bm.from_mesh(rf.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if (rf.matrix_world @ v.co).z < 2.3], context="VERTS"); bm.to_mesh(rf.data); bm.free()
    sol = rf.modifiers.new("sol", "SOLIDIFY"); sol.thickness = 0.06
    cyl("lo_roofrib", 0.02, 0.02, CW + 0.15, (0, CY1 + 0.12, CH + 0.12), cream, rot=(0, math.pi / 2, 0), verts=6, bevel=0.0)
    # inside the cab: the backhead with the firehole (it glows) and a brass whistle on top of the cab front
    box("lo_backhead", (0.8, 0.06, 0.8), (0, CY0 + 0.07, 1.4), black, bevel=0.02)
    box("firebox_glow", (0.28, 0.02, 0.18), (0, CY0 + 0.11, 1.2), fire, bevel=0.0)
    cyl("lo_gauge", 0.06, 0.06, 0.02, (0.2, CY0 + 0.11, 1.62), cream, rot=(math.pi / 2, 0, 0), verts=14, bevel=0.0)
    cyl("lo_whistle", 0.04, 0.05, 0.22, (0.3, CY0 - 0.05, CH + 0.12), brass, verts=12, bevel=0.005)
    _pivot("whistle_pt", (0.3, CY0 - 0.05, CH + 0.28))

def railcar():
    # an open "toast rack" car with a striped canopy, two benches facing forward. I ride in the front one.
    # Named parts: wheel_1..wheel_4 (spin about X), seat (where I sit).
    red = mat("rc_red", (0.78, 0.2, 0.16), tex="planks", scale=(1, 0.6))
    cream = mat("lo_cream", (0.96, 0.9, 0.74), rough=0.6)
    black = mat("lo_black", (0.1, 0.1, 0.11), rough=0.55)
    iron = mat("lo_iron", (0.3, 0.3, 0.32), rough=0.45, metal=0.35)
    wred = mat("lo_red", (0.78, 0.17, 0.14), rough=0.5)
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    wood = mat("wood", WOOD, tex="wood")
    stripe_r = mat("rc_stripe_r", (0.85, 0.22, 0.18), rough=0.8)
    stripe_c = mat("rc_stripe_c", (0.97, 0.93, 0.82), rough=0.8)
    L, W, FZ = 2.4, 1.24, 0.58
    box("rc_chassis", (0.66, L - 0.1, 0.18), (0, 0, 0.5), black, bevel=0.02)
    box("rc_floor", (W, L, 0.08), (0, 0, FZ), wood, bevel=0.015)
    for i, (x, y) in enumerate([(-0.5, -0.72), (0.5, -0.72), (-0.5, 0.72), (0.5, 0.72)]):
        _wheel(f"wheel_{i + 1}", x, y, 0.38, 0.24, iron, wred, brass, spokes=6)
    for y in (-L / 2 - 0.05, L / 2 + 0.05):
        box("rc_coupler", (0.12, 0.25, 0.08), (0, y + (-0.08 if y < 0 else 0.08), 0.52), iron, bevel=0.01)
    # low sides and ends
    for s in (-1, 1):
        box("rc_side", (0.06, L, 0.42), (s * W / 2, 0, FZ + 0.25), red, bevel=0.015)
        box("rc_sidecap", (0.1, L + 0.04, 0.05), (s * W / 2, 0, FZ + 0.48), cream, bevel=0.012)
    for y in (-L / 2, L / 2):
        box("rc_end", (W, 0.06, 0.42), (0, y, FZ + 0.25), red, bevel=0.015)
        box("rc_endcap", (W + 0.04, 0.1, 0.05), (0, y, FZ + 0.48), cream, bevel=0.012)
    # two forward-facing benches
    for y in (-0.45, 0.55):
        box("rc_bench", (W - 0.14, 0.4, 0.07), (0, y, FZ + 0.3), wood, bevel=0.015)
        box("rc_benchback", (W - 0.14, 0.06, 0.36), (0, y + 0.22, FZ + 0.5), wood, bevel=0.015)
        for x in (-0.45, 0.45): box("rc_benchleg", (0.06, 0.3, 0.26), (x, y, FZ + 0.14), black, bevel=0.01)
    _pivot("seat", (0, -0.45, FZ + 0.0))
    # canopy on four posts, red and cream stripes, with a little scalloped edge (tall enough for my comb AND a hat)
    RZ = 3.0
    for x in (-W / 2 + 0.04, W / 2 - 0.04):
        for y in (-L / 2 + 0.06, L / 2 - 0.06):
            cyl("rc_post", 0.035, 0.035, RZ - FZ - 0.25, (x, y, (RZ + FZ + 0.25) / 2), brass, verts=8, bevel=0.0)
    n = 7
    for k in range(n):
        x = -W / 2 - 0.1 + (W + 0.2) * (k + 0.5) / n
        box("rc_canopy", ((W + 0.2) / n, L + 0.25, 0.05), (x, 0, RZ + 0.06 - abs(x) * 0.12), stripe_r if k % 2 == 0 else stripe_c, rot=(0, math.atan(0.12) * (1 if x > 0 else -1), 0), bevel=0.0)
    for s in (-1, 1):
        for k in range(8):
            y = -L / 2 - 0.1 + (L + 0.2) * (k + 0.5) / 8
            sphere("rc_scallop", 0.09, (s * (W / 2 + 0.1), y, RZ - 0.02), stripe_r if k % 2 == 0 else stripe_c, scale=(0.3, 1, 0.6), sub=2)

def station():
    # Coop Junction: a low platform with a stone edge, a little shingled shelter with a bench and a station clock,
    # a departure blackboard, a lamp post, flower tubs and the station sign. Front (-Y) faces the track.
    # Named parts: clock_hour, clock_min (pivots, turn about Y), station_lamp (emissive), board (the blackboard).
    stone = mat("stone", WOOD, tex="stone", scale=(4, 1))
    edge = mat("st_edge", (0.92, 0.88, 0.78), tex="stone", scale=(6, 0.5))
    planks = mat("st_planks", (0.9, 0.8, 0.68), tex="planks", scale=(4, 1))
    wood = mat("wood", WOOD, tex="wood")
    roof = mat("st_roof", (0.7, 0.32, 0.28), tex="shingles", scale=(3, 2))
    cream = mat("lo_cream", (0.96, 0.9, 0.74), rough=0.6)
    green = mat("lo_green", (0.16, 0.42, 0.3), rough=0.45)
    red = mat("lo_red", (0.78, 0.17, 0.14), rough=0.5)
    black = mat("lo_black", (0.1, 0.1, 0.11), rough=0.55)
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    chalk = mat("st_chalkboard", (0.14, 0.2, 0.17), rough=0.9)
    chalkw = mat("st_chalk", (0.95, 0.95, 0.9), rough=0.9)
    lamp = mat("st_lamp", (1, 0.93, 0.7), rough=0.3, emit=(1, 0.85, 0.5), emit_strength=2.0)
    soil = mat("dirt", WOOD, tex="dirt")
    PL, PD, PH = 8.6, 2.2, 0.14
    box("st_platform", (PL, PD, PH), (0, 0, PH / 2), stone, bevel=0.02)
    box("st_edge", (PL, 0.3, 0.04), (0, -PD / 2 + 0.15, PH + 0.01), edge, bevel=0.01)
    box("st_line", (PL, 0.06, 0.01), (0, -PD / 2 + 0.38, PH + 0.005), mat("st_yellow", (0.96, 0.8, 0.25), rough=0.7), bevel=0.0)
    for x in (-PL / 2 - 0.4, PL / 2 + 0.4): box("st_ramp", (0.8, PD, PH), (x, 0, PH / 2 - 0.04), stone, rot=(0, 0.12 if x > 0 else -0.12, 0), bevel=0.02)
    # the shelter, at the back of the platform on the left half
    SX, SW, SD, SH = -1.8, 3.4, 1.7, 2.5
    sy0, sy1 = 0.2, 0.2 + SD
    box("st_floor", (SW + 0.2, SD + 0.2, 0.16), (SX, (sy0 + sy1) / 2 + 0.1, 0.08), planks, bevel=0.01)
    box("st_back", (SW, 0.1, SH + 0.6), (SX, sy1, (SH + 0.6) / 2), planks, bevel=0.02)
    for s in (-1, 1): box("st_endwall", (0.1, SD, SH + 0.15), (SX + s * SW / 2, (sy0 + sy1) / 2, (SH + 0.15) / 2), planks, bevel=0.02)
    for s in (-1, 1): box("st_post", (0.12, 0.12, SH), (SX + s * (SW / 2 - 0.1), sy0 - 0.25, SH / 2), cream, bevel=0.02)
    box("st_fascia", (SW + 0.4, 0.08, 0.22), (SX, sy0 - 0.55, SH + 0.02), cream, bevel=0.01)
    for k in range(14):  # a frilly wooden valance, like old country stations
        x = SX - SW / 2 - 0.1 + (SW + 0.2) * (k + 0.5) / 14
        cyl("st_frill", 0.08, 0.0, 0.18, (x, sy0 - 0.55, SH - 0.17), cream, verts=4, bevel=0.0)
    # sloped roof (front low over the platform, back high)
    rf = box("st_roof", (SW + 0.6, SD + 1.2, 0.1), (SX, (sy0 + sy1) / 2 - 0.25, SH + 0.32), roof, rot=(0.28, 0, 0), bevel=0.02)
    box("st_ridge", (SW + 0.7, 0.14, 0.12), (SX, sy1 + 0.3, SH + 0.76), mat("st_ridgem", (0.45, 0.22, 0.2), rough=0.7), bevel=0.02)
    # bench inside
    box("st_bench", (2.0, 0.45, 0.07), (SX, sy1 - 0.4, 0.62), wood, bevel=0.015)
    box("st_benchback", (2.0, 0.06, 0.4), (SX, sy1 - 0.17, 0.9), wood, bevel=0.015)
    for x in (-0.85, 0.85): box("st_benchleg", (0.07, 0.4, 0.46), (SX + x, sy1 - 0.4, 0.38), black, bevel=0.01)
    # the departures blackboard on the back wall
    box("board", (1.2, 0.04, 0.75), (SX + 0.95, sy1 - 0.07, 1.55), chalk, bevel=0.01)
    box("st_boardframe", (1.3, 0.03, 0.85), (SX + 0.95, sy1 - 0.05, 1.55), wood, bevel=0.01)
    _txt("DEPARTURES", (SX + 0.95, sy1 - 0.1, 1.82), (math.pi / 2, 0, 0), 0.09, chalkw, 0.003)
    for k in range(4): box("st_chalkline", (0.8, 0.01, 0.025), (SX + 0.95, sy1 - 0.1, 1.65 - k * 0.12), chalkw, bevel=0.0)
    # station clock hanging under the front of the roof (double-sided)
    CZ = SH - 0.5
    box("st_clockarm", (0.06, 0.06, 0.4), (SX, sy0 - 0.55, SH - 0.2), black, bevel=0.0)
    cyl("st_clockcase", 0.3, 0.3, 0.12, (SX, sy0 - 0.55, CZ), black, rot=(math.pi / 2, 0, 0), verts=28, bevel=0.02)
    cyl("st_clockface", 0.26, 0.26, 0.125, (SX, sy0 - 0.55, CZ), cream, rot=(math.pi / 2, 0, 0), verts=28, bevel=0.0)
    for k in range(12):
        a = k * math.pi / 6
        box("st_tick", (0.02, 0.13, 0.05 if k % 3 else 0.07), (SX + math.sin(a) * 0.21, sy0 - 0.55, CZ + math.cos(a) * 0.21), black, rot=(0, a, 0), bevel=0.0)
    for nm, Lh, wdt in (("clock_hour", 0.13, 0.035), ("clock_min", 0.2, 0.025)):
        pv = _pivot(nm, (SX, sy0 - 0.55, CZ))
        for yy in (-0.07, 0.07): _kid(box(nm + "_m", (wdt, 0.01, Lh), (SX, sy0 - 0.55 + yy, CZ + Lh / 2 - 0.02), black, bevel=0.0), pv)
    # the station sign on two posts at the right end
    GX = 3.2
    for x in (GX - 1.1, GX + 1.1): box("st_signpost", (0.1, 0.1, 1.9), (x, 0.55, 0.95), cream, bevel=0.015)
    box("st_sign", (2.5, 0.08, 0.5), (GX, 0.55, 1.65), mat("st_signm", (0.96, 0.92, 0.8), rough=0.6), bevel=0.03)
    box("st_signedge", (2.62, 0.06, 0.62), (GX, 0.57, 1.65), green, bevel=0.02)
    _txt("COOP JUNCTION", (GX, 0.5, 1.65), (math.pi / 2, 0, 0), 0.24, green, 0.012)
    # lamp post between the sign and the shelter
    LX = 0.9
    cyl("st_lampbase", 0.12, 0.1, 0.25, (LX, 0.45, PH + 0.12), green, verts=14, bevel=0.01)
    cyl("st_lamppole", 0.045, 0.045, 2.6, (LX, 0.45, PH + 1.4), green, verts=10, bevel=0.0)
    box("st_lampbox", (0.24, 0.24, 0.32), (LX, 0.45, PH + 2.85), black, bevel=0.02)
    box("station_lamp", (0.2, 0.25, 0.26), (LX, 0.45, PH + 2.85), lamp, bevel=0.01)
    cyl("st_lamptop", 0.2, 0.02, 0.16, (LX, 0.45, PH + 3.08), black, verts=4, rot=(0, 0, math.pi / 4), bevel=0.0)
    # flower tubs (red geraniums) and a luggage trolley with a mail sack
    for x in (-4.0, 1.6, 4.0):
        cyl("st_tub", 0.25, 0.2, 0.32, (x, 0.65, PH + 0.16), wood, verts=16, bevel=0.01)
        cyl("st_soil", 0.22, 0.22, 0.02, (x, 0.65, PH + 0.32), soil, verts=16, bevel=0.0)
        for k in range(6):
            a = k * 1.05
            sphere("st_leaf", 0.1, (x + math.cos(a) * 0.12, 0.65 + math.sin(a) * 0.12, PH + 0.4), mat("st_leafm", (0.3, 0.55, 0.25), rough=0.8), sub=1)
            sphere("st_bloom", 0.06, (x + math.cos(a + 0.5) * 0.08, 0.65 + math.sin(a + 0.5) * 0.08, PH + 0.52), red, sub=1)
    TX = 2.6
    box("st_trolley", (0.9, 0.55, 0.06), (TX, -0.1, PH + 0.32), wood, bevel=0.01)
    for x in (TX - 0.3, TX + 0.3): cyl("st_twheel", 0.13, 0.13, 0.05, (x, -0.1, PH + 0.13), black, rot=(0, math.pi / 2, 0), verts=14, bevel=0.0)
    box("st_handle", (0.05, 0.05, 0.6), (TX + 0.48, -0.1, PH + 0.58), black, rot=(0, 0.4, 0), bevel=0.0)
    sphere("st_sack", 0.25, (TX - 0.1, -0.1, PH + 0.55), mat("st_sackm", (0.82, 0.74, 0.58), rough=0.95), scale=(1.2, 0.9, 0.9), sub=2)
    box("st_crate", (0.35, 0.35, 0.3), (TX + 0.25, -0.1, PH + 0.5), wood, bevel=0.02)

def watertower():
    # A railway water tower: a wooden tank with iron hoops on four legs, a pointy roof, a ladder,
    # and a canvas spout that swings down to fill Biscuit's tanks. Named: "spout" (pivot, turns about X).
    wood = mat("wood", WOOD, tex="wood")
    planks = mat("wt_planks", (0.85, 0.7, 0.55), tex="planks", scale=(3, 1))
    iron = mat("lo_iron", (0.3, 0.3, 0.32), rough=0.45, metal=0.35)
    roof = mat("st_roof", (0.7, 0.32, 0.28), tex="shingles", scale=(3, 2))
    stone = mat("stone", WOOD, tex="stone", scale=(2, 1))
    canvas = mat("wt_canvas", (0.55, 0.45, 0.32), rough=0.9)
    TZ = 2.3
    for x in (-0.6, 0.6):
        for y in (-0.6, 0.6):
            box("wt_footing", (0.3, 0.3, 0.2), (x, y, 0.1), stone, bevel=0.02)
            box("wt_leg", (0.16, 0.16, TZ), (x * 0.92, y * 0.92, TZ / 2), wood, rot=(y * 0.08, -x * 0.08, 0), bevel=0.02)
    for z in (0.9, 1.7):
        for s in (-1, 1):
            box("wt_brace", (1.2, 0.08, 0.08), (0, s * 0.57, z), wood, bevel=0.01)
            box("wt_brace", (0.08, 1.2, 0.08), (s * 0.57, 0, z), wood, bevel=0.01)
    cyl("wt_deck", 0.95, 0.95, 0.1, (0, 0, TZ), wood, verts=32, bevel=0.01)
    cyl("wt_tank", 0.82, 0.86, 1.3, (0, 0, TZ + 0.7), planks, verts=32, bevel=0.01)
    for z in (TZ + 0.25, TZ + 0.7, TZ + 1.15): cyl("wt_hoop", 0.87, 0.87, 0.05, (0, 0, z), iron, verts=32, bevel=0.0)
    cyl("wt_roof", 0.98, 0.05, 0.7, (0, 0, TZ + 1.7), roof, verts=10, bevel=0.0)
    sphere("wt_knob", 0.07, (0, 0, TZ + 2.06), iron, sub=2)
    for k in range(9): box("wt_rung", (0.36, 0.04, 0.04), (0.85, 0.3, 0.3 + k * 0.32), wood, bevel=0.0)
    for y in (0.12, 0.48): box("wt_ladder", (0.04, 0.04, 3.1), (1.02, y, 1.55), wood, rot=(0, -0.08, 0), bevel=0.0)
    # the spout: pivot on the front of the tank, an iron pipe with a floppy canvas end (rests tipped up)
    pv = _pivot("spout", (0, -0.86, TZ + 0.35))
    _kid(cyl("wt_spoutpipe", 0.11, 0.1, 1.4, (0, -0.86 - 0.7, TZ + 0.35), iron, rot=(math.pi / 2, 0, 0), verts=14, bevel=0.0), pv)
    _kid(cyl("wt_spoutsock", 0.1, 0.09, 0.7, (0, -0.86 - 1.6, TZ + 0.22), canvas, rot=(math.pi / 2 + 0.5, 0, 0), verts=12, bevel=0.0), pv)
    _kid(box("wt_chain", (0.02, 0.02, 0.9), (0.12, -0.86 - 1.3, TZ + 0.8), iron, bevel=0.0), pv)

def tunnelhill():
    # Tunnel Hill: a grassy hump the track goes straight through (along X), with stone portals at both ends,
    # a dark stone lining inside, a few boulders and bushes. 14 long, 10 wide, 4.2 high. Bore: 1.9 wide, 2.95 high.
    grass = mat("th_grass", (0.86, 0.9, 0.8), tex="grass", scale=(5, 4))
    stone = mat("stone", WOOD, tex="stone", scale=(2, 2))
    dark = mat("th_dark", (0.16, 0.15, 0.14), rough=1.0)
    key = mat("bo_capstone", (0.78, 0.74, 0.68), tex="stone", scale=(2, 1))
    bush = mat("th_bush", (0.33, 0.58, 0.28), rough=0.9)
    HL, HW, HH, BW, BH, PX = 7.0, 5.0, 4.2, 0.95, 2.0, 5.2
    hill = sphere("th_hill", 1.0, (0, 0, 0), grass, scale=(HL, HW, HH), sub=5); jitter(hill, 0.05)
    bm = bmesh.new(); bm.from_mesh(hill.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.05 or abs(v.co.x) > PX - 0.05], context="VERTS"); bm.to_mesh(hill.data); bm.free()  # ends cut off flat behind the portals
    # cut the bore with a boolean (a box plus a round top)
    cutter = box("th_cut", (HL * 2 + 2, BW * 2, BH + 0.2), (0, 0, (BH + 0.2) / 2 - 0.2), dark, bevel=0)
    top = cyl("th_cut2", BW, BW, HL * 2 + 2, (0, 0, BH), dark, rot=(0, math.pi / 2, 0), verts=24, bevel=0)
    for c in (cutter, top):
        md = hill.modifiers.new("cut", "BOOLEAN"); md.object = c; md.operation = "DIFFERENCE"; md.solver = "EXACT"
    bpy.context.view_layer.objects.active = hill
    for md in list(hill.modifiers):
        if md.type == "BOOLEAN": bpy.ops.object.modifier_apply(modifier=md.name)
    bpy.data.objects.remove(cutter); bpy.data.objects.remove(top)
    # lining: two walls and a half-pipe roof between the portals (dark, so it looks deep)
    for s in (-1, 1): box("th_wall", (PX * 2, 0.1, BH), (0, s * (BW + 0.03), BH / 2), dark, bevel=0)
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=BW + 0.05, depth=PX * 2, location=(0, 0, BH), rotation=(0, math.pi / 2, 0), end_fill_type="NOTHING")
    rf = bpy.context.object; rf.name = "th_vault"
    bm = bmesh.new(); bm.from_mesh(rf.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if (rf.matrix_world @ v.co).z < BH - 0.01], context="VERTS"); bm.to_mesh(rf.data); bm.free()
    finish(rf, dark, 0, True); dark.use_backface_culling = False
    box("th_floor", (PX * 2, BW * 2, 0.02), (0, 0, 0.01), dark, bevel=0)
    # portals: a stone face with an arched opening, a keystone, and a name stone above
    for s in (-1, 1):
        x = s * PX
        face = box("th_portal", (0.45, 7.0, 3.7), (x, 0, 1.85), stone, bevel=0.03)
        c1 = box("th_pc", (1.0, BW * 2, BH + 0.2), (x, 0, (BH + 0.2) / 2 - 0.2), dark, bevel=0)
        c2 = cyl("th_pc2", BW, BW, 1.0, (x, 0, BH), dark, rot=(0, math.pi / 2, 0), verts=24, bevel=0)
        for c in (c1, c2):
            md = face.modifiers.new("cut", "BOOLEAN"); md.object = c; md.operation = "DIFFERENCE"; md.solver = "EXACT"
        bpy.context.view_layer.objects.active = face
        for md in list(face.modifiers):
            if md.type == "BOOLEAN": bpy.ops.object.modifier_apply(modifier=md.name)
        bpy.data.objects.remove(c1); bpy.data.objects.remove(c2)
        for k in range(9):  # arch voussoirs, a ring of lighter stones around the opening
            a = -math.pi / 2 + k * math.pi / 8
            box("th_vous", (0.5, 0.22, 0.34), (x + s * 0.03, math.sin(a) * (BW + 0.15), BH + (BW + 0.15) * math.cos(a)), key, rot=(-a, 0, 0), bevel=0.02)
        box("th_parapet", (0.6, 7.2, 0.25), (x, 0, 3.8), key, bevel=0.03)
        for yy in (-3.2, 3.2): box("th_pier", (0.6, 0.5, 3.8), (x, yy, 1.9), key, bevel=0.03)
        box("th_namestone", (0.5, 1.4, 0.36), (x + s * 0.03, 0, 3.35), key, bevel=0.02)
        _txt("1926" if s > 0 else "OJ RAIL", (x + s * 0.29, 0, 3.35), (math.pi / 2, 0, s * math.pi / 2), 0.2, mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8), 0.01)
    # boulders and bushes on the slopes
    random.seed(9)
    for k in range(10):
        a = random.uniform(0, math.pi * 2); r = random.uniform(0.45, 0.85)
        px, py = math.cos(a) * HL * r, math.sin(a) * HW * r
        if abs(py) < 1.6 and abs(px) > 3.5: continue
        pz = HH * math.sqrt(max(0, 1 - (px / HL) ** 2 - (py / HW) ** 2))
        if k % 2: o = sphere("th_boulder", random.uniform(0.3, 0.5), (px, py, pz), stone, scale=(1.2, 1, 0.7), sub=2); jitter(o, 0.05)
        else:
            for j in range(3): sphere("th_bushball", random.uniform(0.35, 0.5), (px + j * 0.3 - 0.3, py + random.uniform(-0.2, 0.2), pz + 0.2), bush, sub=2)

ASSETS.update({"loco": loco, "railcar": railcar, "station": station, "watertower": watertower, "tunnelhill": tunnelhill})


# ---------------- OJ Balloons (Day 10) ----------------
# Montauciel II, my hot-air balloon (named after the sheep who flew with a duck and a ROOSTER at Versailles, 1783).
# Origin = bottom center of the basket. Front = -Y. Named parts:
#   "envelope" (pivot at the mouth, z = MOUTH; the whole bag + skirt + crown valve hang off it so it can lie down and fill up),
#   "valve" (the parachute lid in the crown), "cables" (load cables, frame to mouth), "burner_flame" (cone, origin at the
#   burner nozzles, points up), "pilot" (little blue pilot light), "seat" (where I stand; my head pokes over the rim), "basket".
MOUTH = 3.35
def _catmull(pts, n=6):
    out = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for k in range(n):
            t = k / n; t2, t3 = t * t, t * t * t
            out.append(tuple(0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3) for j in range(2)))
    out.append(pts[-1]); return out

def balloon():
    red = mat("bl_red", (0.86, 0.22, 0.2), rough=0.6, tex="ripstop", scale=(3, 3))
    cream = mat("bl_cream", (0.98, 0.93, 0.8), rough=0.6, tex="ripstop", scale=(3, 3))
    gold = mat("bl_gold", (1.0, 0.78, 0.25), rough=0.6, tex="ripstop", scale=(3, 3))
    navy = mat("bl_navy", (0.17, 0.24, 0.55), rough=0.6, tex="ripstop", scale=(3, 3))
    skirt_m = mat("bl_skirt", (0.95, 0.85, 0.55), rough=0.8)
    wicker = mat("bl_wicker", WOOD, tex="wicker", scale=(3, 2))
    leather = mat("bl_leather", (0.45, 0.27, 0.15), rough=0.6)
    steel = mat("bl_steel", (0.75, 0.77, 0.8), rough=0.35, metal=0.35)
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    tankm = mat("bl_tank", (0.85, 0.85, 0.82), rough=0.4, metal=0.3)
    cable = mat("bl_cable", (0.3, 0.3, 0.32), rough=0.5, metal=0.3)
    wood = mat("wood", WOOD, tex="wood")
    # --- basket: woven willow with a leather rim, a wooden floor, two propane tanks and a step box (so I can see out)
    bk = _pivot("basket", (0, 0, 0))
    W, D, H = 1.6, 1.5, 1.05
    _kid(box("bl_basket", (W, D, H), (0, 0, H / 2), wicker, bevel=0.12), bk)
    _kid(box("bl_floor", (W - 0.12, D - 0.12, 0.06), (0, 0, H - 0.02), mat("bl_dark", (0.2, 0.14, 0.1), rough=0.9), bevel=0), bk)
    for x, y, w, d in ((0, -D / 2, W + 0.06, 0.12), (0, D / 2, W + 0.06, 0.12), (-W / 2, 0, 0.12, D + 0.06), (W / 2, 0, 0.12, D + 0.06)):
        _kid(box("bl_rim", (w, d, 0.12), (x, y, H), leather, bevel=0.05), bk)
    _kid(box("bl_skid", (W + 0.04, 0.14, 0.08), (0, -0.4, 0.04), wood, bevel=0.02), bk)
    _kid(box("bl_skid", (W + 0.04, 0.14, 0.08), (0, 0.4, 0.04), wood, bevel=0.02), bk)
    for x in (-0.48, 0.48):
        _kid(cyl("bl_tank", 0.2, 0.2, 0.75, (x, 0.42, H - 0.05 + 0.3), tankm, verts=20, bevel=0.06), bk)
        _kid(cyl("bl_tankcap", 0.07, 0.07, 0.08, (x, 0.42, H + 0.32), brass, verts=10, bevel=0.01), bk)
    _pivot("seat", (0, 0.18, 0.18))
    # uprights (suede-covered rods) up to the burner frame
    FZ = 2.75
    for x in (-0.66, 0.66):
        for y in (-0.62, 0.62):
            _kid(cyl("bl_rod", 0.045, 0.045, FZ - H, (x * 0.85, y * 0.85, (FZ + H) / 2), leather, verts=10, bevel=0), bk)
    for x, y, w, d in ((0, -0.53, 1.2, 0.07), (0, 0.53, 1.2, 0.07), (-0.56, 0, 0.07, 1.12), (0.56, 0, 0.07, 1.12)):
        _kid(box("bl_frame", (w, d, 0.07), (x, y, FZ), steel, bevel=0.02), bk)
    # the burner: two coils (fat steel rings) and nozzles
    for x in (-0.2, 0.2):
        for k in range(4):
            bpy.ops.mesh.primitive_torus_add(major_radius=0.17, minor_radius=0.035, location=(x, 0, FZ + 0.05 + k * 0.07))
            o = bpy.context.object; o.name = "bl_coil"; finish(o, steel); _kid(o, bk)
        _kid(cyl("bl_nozzle", 0.09, 0.06, 0.1, (x, 0, FZ + 0.37), steel, verts=12, bevel=0.01), bk)
    _kid(box("bl_valvebox", (0.2, 0.12, 0.12), (0, -0.25, FZ - 0.08), brass, bevel=0.02), bk)
    # the flame (hidden until I pull the blast valve) and the little blue pilot light that's always on
    fl = _pivot("burner_flame", (0, 0, FZ + 0.42))
    _kid(cyl("bl_flame_out", 0.3, 0.02, 1.3, (0, 0, FZ + 0.42 + 0.65), mat("bl_flame", (1, 0.6, 0.15), rough=1, emit=(1, 0.55, 0.12), emit_strength=6), verts=16, bevel=0), fl)
    _kid(cyl("bl_flame_in", 0.17, 0.01, 0.8, (0, 0, FZ + 0.42 + 0.4), mat("bl_flame2", (1, 0.95, 0.6), rough=1, emit=(1, 0.95, 0.6), emit_strength=8), verts=12, bevel=0), fl)
    pl = sphere("pilot", 0.05, (0.2, 0, FZ + 0.46), mat("bl_pilot", (0.4, 0.6, 1), rough=1, emit=(0.35, 0.55, 1), emit_strength=4), sub=1)
    # load cables: from the frame corners up to the mouth ring
    cb = _pivot("cables", (0, 0, FZ))
    for x in (-0.56, 0.56):
        for y in (-0.53, 0.53):
            a = Vector((x, y, FZ)); b = Vector((x * 1.45, y * 1.45, MOUTH)); d = b - a
            o = cyl("bl_cable", 0.018, 0.018, d.length, tuple((a + b) / 2), cable, verts=6, bevel=0)
            o.rotation_mode = "QUATERNION"; o.rotation_quaternion = d.to_track_quat("Z", "Y"); _kid(o, cb)
    # --- the envelope: 12 gores, red and cream, a gold band with OJ on it, a navy crown
    env = _pivot("envelope", (0, 0, MOUTH))
    prof = _catmull([(0.82, 0.0), (1.05, 0.5), (1.5, 1.2), (2.1, 2.0), (2.6, 2.8), (2.9, 3.6), (3.02, 4.4), (2.95, 5.1), (2.7, 5.7), (2.25, 6.2), (1.6, 6.6), (0.85, 6.86), (0.3, 6.96), (0.0, 6.99)], 5)
    G, SUB = 12, 6; NT = G * SUB
    verts, faces, fm = [], [], []
    for (r, z) in prof:
        for j in range(NT):
            th = j / NT * math.pi * 2
            bulge = 1 + 0.045 * math.sin(math.pi * (j % SUB) / SUB) * min(1, r / 1.2)   # each gore puffs out between its load tapes
            verts.append((r * bulge * math.cos(th), r * bulge * math.sin(th), MOUTH + z))
    for i in range(len(prof) - 1):
        zc = (prof[i][1] + prof[i + 1][1]) / 2
        for j in range(NT):
            a, b = i * NT + j, i * NT + (j + 1) % NT
            faces.append((a, b, b + NT, a + NT))
            g = j // SUB
            fm.append(3 if zc > 6.35 else 2 if 3.85 < zc < 4.95 else (0 if g % 2 == 0 else 1))
    me = bpy.data.meshes.new("bl_envelope"); me.from_pydata(verts, [], faces); me.update()
    uv = me.uv_layers.new()
    for f in me.polygons:
        for li in f.loop_indices:
            v = me.vertices[me.loops[li].vertex_index].co; th = math.atan2(v.y, v.x)
            uv.data[li].uv = (th / (2 * math.pi) * 6, v.z / 2)
    o = bpy.data.objects.new("bl_envelope", me); bpy.context.collection.objects.link(o)
    for m in (red, cream, gold, navy): o.data.materials.append(m)
    for p, mi in zip(o.data.polygons, fm): p.material_index = mi; p.use_smooth = True
    _kid(o, env)
    # skirt (the fire-proof scoop round the mouth) and the crown valve lid
    _kid(cyl("bl_skirt", 0.82, 1.0, 0.55, (0, 0, MOUTH - 0.22), skirt_m, verts=36, bevel=0), env)
    bpy.data.objects["bl_skirt"].modifiers.new("solid", "SOLIDIFY").thickness = 0.03
    v = _pivot("valve", (0, 0, MOUTH + 6.99))
    _kid(cyl("bl_valvelid", 0.75, 0.55, 0.08, (0, 0, MOUTH + 6.97), navy, verts=24, bevel=0.02), v); _kid(v, env)
    # OJ on both sides, on the gold band
    for side in (-1, 1):
        t = _txt("OJ", (0, side * 3.11, MOUTH + 4.38), (math.pi / 2, 0, 0 if side < 0 else math.pi), 0.95, navy, extrude=0.04)
        _kid(t, env)
    for side in (-1, 1):
        t = _txt("OJ", (side * 3.11, 0, MOUTH + 4.38), (math.pi / 2, 0, side * math.pi / 2), 0.95, navy, extrude=0.04)
        _kid(t, env)

def balloonfield():
    # OJ Balloons launch field: a sign with my name for the balloon, an inflator fan (named "fan_blades", spins about its
    # axis = -Y), a pibal box with a red pilot balloon tied on (named "pibal_tied"), three tether stakes with rope coils.
    wood = mat("wood", WOOD, tex="wood")
    planks = mat("bf_planks", (0.95, 0.92, 0.85), tex="planks")
    trim = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    navy = mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8)
    redm = mat("bf_red", (0.86, 0.22, 0.2), rough=0.5)
    steel = mat("bl_steel", (0.75, 0.77, 0.8), rough=0.35, metal=0.35)
    dark = mat("bf_dark", (0.2, 0.2, 0.22), rough=0.6)
    yel = mat("bf_yel", (1.0, 0.8, 0.25), rough=0.6)
    rope = mat("bf_rope", (0.85, 0.75, 0.55), rough=0.9)
    # sign (at x = 4.2)
    sx, sy = 4.2, 2.6
    for x in (sx - 0.85, sx + 0.85): box("bf_post", (0.12, 0.12, 2.1), (x, sy, 1.05), wood, bevel=0.02)
    box("bf_board", (1.95, 0.08, 0.9), (sx, sy, 1.65), planks, bevel=0.03)
    box("bf_trim", (2.05, 0.1, 0.06), (sx, sy, 2.12), redm, bevel=0.02); box("bf_trim", (2.05, 0.1, 0.06), (sx, sy, 1.18), redm, bevel=0.02)
    _txt("OJ BALLOONS", (sx, sy - 0.05, 1.85), (math.pi / 2, 0, 0), 0.24, navy, extrude=0.01)
    _txt("Montauciel II", (sx, sy - 0.05, 1.55), (math.pi / 2, 0, 0), 0.16, redm, extrude=0.008)
    _txt("fly at dawn + dusk", (sx, sy - 0.05, 1.33), (math.pi / 2, 0, 0), 0.11, navy, extrude=0.006)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.22, location=(sx, sy, 2.45)); o = bpy.context.object; o.name = "bf_ball"; o.scale = (1, 1, 1.2); finish(o, redm)
    # inflator fan (at x = -2.5, y = 2.2, blowing toward -Y... toward the mouth of the envelope)
    fx, fy = -2.6, 1.6
    box("bf_fanbase", (1.0, 0.6, 0.12), (fx, fy, 0.18), dark, bevel=0.03)
    for x in (-0.4, 0.4): cyl("bf_wheel", 0.15, 0.15, 0.08, (fx + x, fy + 0.25, 0.15), dark, rot=(0, math.pi / 2, 0), verts=14)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.62, minor_radius=0.07, location=(fx, fy, 0.85), rotation=(math.pi / 2, 0, 0)); o = bpy.context.object; o.name = "bf_cage"; finish(o, yel)
    for a in (0.5, -0.5): box("bf_leg", (0.08, 0.08, 0.75), (fx + a * 0.9, fy, 0.5), yel, rot=(0, a * 0.5, 0), bevel=0.02)
    cyl("bf_motor", 0.2, 0.2, 0.45, (fx, fy + 0.3, 0.85), dark, rot=(math.pi / 2, 0, 0), verts=18, bevel=0.03)
    fb = _pivot("fan_blades", (fx, fy - 0.05, 0.85))
    for k in range(5):
        a = k * math.pi * 2 / 5
        _kid(box("bf_blade", (0.17, 0.03, 0.52), (fx + math.sin(a) * 0.28, fy - 0.05, 0.85 + math.cos(a) * 0.28), steel, rot=(0.35, -a, 0), bevel=0.01), fb)
    _kid(sphere("bf_hub", 0.08, (fx, fy - 0.08, 0.85), redm, sub=2), fb)
    for k in range(6):
        a = k * math.pi / 3; box("bf_guard", (0.02, 0.02, 1.2), (fx, fy - 0.12, 0.85), steel, rot=(0, a, 0), bevel=0)
    # pibal box: a little crate with a red pilot balloon on a string
    px, py = 3.0, -2.6
    box("bf_crate", (0.6, 0.45, 0.45), (px, py, 0.225), wood, bevel=0.03)
    _txt("PIBAL", (px, py - 0.235, 0.25), (math.pi / 2, 0, 0), 0.12, navy, extrude=0.006)
    pb = _pivot("pibal_tied", (px, py, 0.45))
    _kid(cyl("bf_string", 0.008, 0.008, 0.9, (px, py, 0.9), rope, verts=5, bevel=0), pb)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.17, location=(px, py, 1.45)); o = bpy.context.object; o.name = "bf_pibal"; o.scale = (1, 1, 1.18); finish(o, mat("bf_pibalm", (0.95, 0.2, 0.25), rough=0.3)); _kid(o, pb)
    # tether stakes with rope coils (for hops), on a circle of radius 3.6 round the basket
    for k in range(3):
        a = math.pi / 2 + k * math.pi * 2 / 3; x, y = math.cos(a) * 3.6, math.sin(a) * 3.6
        cyl("bf_stake", 0.07, 0.04, 0.5, (x, y, 0.2), wood, verts=8)
        bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.05, location=(x + 0.25, y, 0.06)); o = bpy.context.object; o.name = "bf_coil"; finish(o, rope)

ASSETS.update({"balloon": balloon, "balloonfield": balloonfield})


def beetree():
    # Day 11: the BEE TREE. A big old oak (far-oak-4, north-west corner, past the railway) with a hollow inside and a
    # knothole on the south side. Wild honeybees live in there. Oaks keep their dead brown leaves into winter
    # (marcescence), so this one is russet. The knothole mouth is an empty named "bee_door" (bees come and go there),
    # facing -Y (= south in my yard). A brown propolis/wax stain runs down under the hole, where bees have walked for years.
    bark = mat("bt_bark", (0.82, 0.78, 0.74), tex="bark", scale=(1.5, 3))
    dark = mat("bt_hole", (0.05, 0.035, 0.03), rough=1.0)
    stain = mat("bt_stain", (0.42, 0.26, 0.1), rough=0.6)
    t = cyl("bt_trunk", 0.62, 0.42, 3.0, (0, 0, 1.5), bark, verts=20, bevel=0); jitter(t, 0.04)
    for a in (0.3, 1.9, 3.3, 4.8):
        cyl("bt_root", 0.24, 0.06, 1.0, (math.cos(a) * 0.5, math.sin(a) * 0.5, 0.14), bark, rot=(0, 1.35, a), verts=8, bevel=0)
    # big limbs
    for (a, tilt, L, z) in [(0.4, 0.8, 1.6, 2.6), (2.5, 0.9, 1.5, 2.8), (4.3, 0.75, 1.4, 2.5), (1.4, 0.35, 1.3, 3.0)]:
        dx, dy = math.cos(a), math.sin(a)
        cyl("bt_limb", 0.2, 0.1, L, (dx * math.sin(tilt) * L / 2, dy * math.sin(tilt) * L / 2, z + math.cos(tilt) * L / 2), bark,
            rot=(-dy * tilt, dx * tilt, 0), verts=10, bevel=0)
    # the knothole: a dark oval with a fat bark lip, about 2.1 up, on the front (-Y)
    hz, hy = 2.05, -0.5
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.15, location=(0, hy - 0.01, hz)); o = bpy.context.object; o.name = "bt_knot"; o.scale = (0.85, 0.35, 1.35); finish(o, dark)
    bpy.ops.mesh.primitive_torus_add(major_radius=0.17, minor_radius=0.055, location=(0, hy + 0.01, hz), rotation=(math.pi / 2, 0, 0)); o = bpy.context.object; o.name = "bt_lip"; o.scale = (0.9, 1.35, 1); finish(o, bark)
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.16, location=(0, hy + 0.03, hz - 0.33)); o = bpy.context.object; o.name = "bt_stain"; o.scale = (0.7, 0.25, 1.4); finish(o, stain)
    _pivot("bee_door", (0, hy - 0.06, hz - 0.12))
    # a bracket fungus shelf (just because they're cute)
    for i, (x, z, r) in enumerate([(0.45, 0.9, 0.2), (0.5, 1.15, 0.15)]):
        cyl("bt_fungus", r, r * 0.85, 0.06, (x, -0.3, z), mat("bt_fung", (0.86, 0.66, 0.38), rough=0.8), rot=(0.15, 0, 0), verts=16, bevel=0.02)
    # russet winter leaves (oaks hang on to them)
    cols = [(0.62, 0.36, 0.18), (0.72, 0.46, 0.22), (0.55, 0.3, 0.16)]
    for i, (x, y, z, r) in enumerate([(0, 0.1, 3.9, 1.6), (1.1, 0.2, 3.5, 1.15), (-1.05, -0.1, 3.6, 1.1), (0.2, 0.9, 4.2, 1.0), (-0.3, -0.8, 4.3, 0.85), (0.1, 0.1, 4.8, 0.85)]):
        s = sphere("bt_leaves", r, (x, y, z), mat(f"bt_leaf{i%3}", cols[i % 3], rough=0.95), sub=2, smooth=True); jitter(s, r * 0.1)

def beeyard():
    # Day 11: OJ Bees, the yard by the bee tree. A bait hive (an empty, dark, ~40 litre box with a small entrance near the
    # bottom, facing south, up high on a post: what Seeley's scout bees vote for) with a "VACANCY" tag, a ladder, a sign,
    # and a log stool where I sit and listen. Named: "vacancy" (the tag, it swings).
    wood = mat("wood", WOOD, tex="wood")
    planks = mat("by_planks", (0.95, 0.92, 0.85), tex="planks")
    darkply = mat("by_dark", (0.42, 0.3, 0.2), tex="planks")
    shing = mat("by_shing", (0.75, 0.45, 0.35), tex="shingles")
    bark = mat("by_bark", (0.82, 0.78, 0.74), tex="bark", scale=(1, 1))
    navy = mat("ink_blue", (0.2, 0.3, 0.7), rough=0.8)
    honey = mat("by_honey", (0.95, 0.68, 0.15), rough=0.5)
    redm = mat("by_red", (0.86, 0.22, 0.2), rough=0.5)
    hole = mat("by_hole", (0.04, 0.03, 0.03), rough=1)
    cream = mat("by_cream", (0.98, 0.95, 0.86), rough=0.7)
    # the post + bait hive (at x = 2.4)
    px = 2.4; H = 4.2
    box("by_post", (0.16, 0.16, H), (px, 0, H / 2), wood, bevel=0.02)
    box("by_shelf", (0.95, 0.85, 0.08), (px, 0, H), wood, bevel=0.02)
    for s in (-1, 1): box("by_brace", (0.06, 0.06, 0.8), (px + s * 0.25, 0, H - 0.3), wood, rot=(0, s * 0.7, 0), bevel=0.01)
    box("by_box", (0.8, 0.7, 0.9), (px, 0, H + 0.49), darkply, bevel=0.03)
    box("by_roof", (0.98, 0.9, 0.08), (px, 0, H + 0.98), shing, rot=(0.08, 0, 0), bevel=0.02)
    cyl("by_door", 0.07, 0.07, 0.03, (px, -0.355, H + 0.14), hole, rot=(math.pi / 2, 0, 0), verts=16, bevel=0)
    box("by_landing", (0.3, 0.12, 0.03), (px, -0.42, H + 0.08), wood, bevel=0.01)
    _txt("OJ", (px, -0.36, H + 0.62), (math.pi / 2, 0, 0), 0.22, honey, extrude=0.01)
    vac = _pivot("vacancy", (px + 0.25, -0.38, H + 0.42))
    _kid(cyl("by_string", 0.006, 0.006, 0.16, (px + 0.25, -0.38, H + 0.34), cream, verts=5, bevel=0), vac)
    _kid(box("by_tag", (0.42, 0.02, 0.15), (px + 0.25, -0.39, H + 0.2), cream, bevel=0.01), vac)
    _kid(_txt("VACANCY", (px + 0.25, -0.405, H + 0.2), (math.pi / 2, 0, 0), 0.07, redm, extrude=0.004), vac)
    # ladder leaning on the post
    for s in (-0.22, 0.22): box("by_rail", (0.06, 0.06, H * 0.98), (px + s, -0.75, H * 0.47), wood, rot=(-0.17, 0, 0), bevel=0.01)
    for k in range(9):
        z = 0.35 + k * 0.45; y = -0.75 - (H * 0.47 - z) * math.tan(0.17) * -1
        box("by_rung", (0.5, 0.05, 0.05), (px, -0.75 + (z - H * 0.47) * math.tan(0.17), z), wood, bevel=0.01)
    # the sign (at x = -1.2)
    sx = -1.4
    for x in (sx - 0.75, sx + 0.75): box("by_spost", (0.11, 0.11, 1.9), (x, 0.3, 0.95), wood, bevel=0.02)
    box("by_board", (1.75, 0.08, 0.85), (sx, 0.3, 1.45), planks, bevel=0.03)
    box("by_strip", (1.85, 0.1, 0.06), (sx, 0.3, 1.9), honey, bevel=0.02); box("by_strip", (1.85, 0.1, 0.06), (sx, 0.3, 1.0), honey, bevel=0.02)
    _txt("BEE TREE", (sx, 0.25, 1.66), (math.pi / 2, 0, 0), 0.24, navy, extrude=0.01)
    _txt("let them be", (sx, 0.25, 1.4), (math.pi / 2, 0, 0), 0.14, redm, extrude=0.006)
    _txt("(till spring)", (sx, 0.25, 1.2), (math.pi / 2, 0, 0), 0.11, navy, extrude=0.006)
    # little hexagon on top of the sign
    cyl("by_hex", 0.22, 0.22, 0.06, (sx, 0.3, 2.15), honey, rot=(math.pi / 2, 0, 0), verts=6, bevel=0.01)
    # the listening stool: a sawn log
    cyl("by_log", 0.33, 0.33, 0.45, (0.6, -1.1, 0.225), bark, verts=18, bevel=0.02)
    cyl("by_logtop", 0.3, 0.3, 0.02, (0.6, -1.1, 0.455), mat("by_end", (0.86, 0.7, 0.5), rough=0.8), verts=18, bevel=0)

ASSETS.update({"beetree": beetree, "beeyard": beeyard})


# ---------------- OJ Music Box (Day 12) ----------------
def musicbox():
    # A storybook-big Swiss cylinder music box (Favre, Geneva, 1796: a comb of tuned steel teeth instead of bells).
    # Front = -Y. Named parts for behaviors/musicbox.js:
    #   "cylinder" (pivot on its axis, spins about X; the behavior adds the real pins), "tooth0".."tooth17" (bass = 0, left),
    #   "fly" (the air-brake fan on the endless screw, spins about Z), "crank" (winding key, turns about X),
    #   "tune_pointer" (pivot, turns about Y on the front dial), "lid" (pivot at the back hinge).
    walnut = mat("mb_walnut", (0.55, 0.34, 0.2), rough=0.55, tex="wood", scale=(2, 2))
    dark = mat("mb_dark", (0.32, 0.19, 0.11), rough=0.6, tex="wood")
    inlay = mat("mb_inlay", (0.93, 0.82, 0.58), rough=0.5)
    stone = mat("stone", WOOD, tex="stone", scale=(2, 2))
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    steel = mat("mb_steel", (0.78, 0.8, 0.84), rough=0.3, metal=0.35)
    lead = mat("mb_lead", (0.36, 0.37, 0.4), rough=0.6, metal=0.3)
    ruby = mat("mb_ruby", (0.85, 0.08, 0.15), rough=0.2, emit=(0.6, 0.02, 0.08), emit_strength=0.6)
    navy = mat("mb_navy", (0.12, 0.17, 0.38), rough=0.8)
    gold = mat("mb_gold", (0.98, 0.8, 0.35), rough=0.4, metal=0.5)
    cream = mat("rs_cream", (0.93, 0.88, 0.74), rough=0.6)
    red = mat("mb_red", (0.75, 0.15, 0.15), rough=0.7)
    # the stone plinth it sits on, so I can see in when I stand next to it
    box("mb_plinth", (2.2, 1.35, 0.42), (0, 0, 0.21), stone, bevel=0.05)
    box("mb_plinth_top", (2.3, 1.45, 0.06), (0, 0, 0.45), stone, bevel=0.03)
    Z0 = 0.48
    W, D, H = 1.9, 1.05, 0.5
    box("mb_floor", (W, D, 0.06), (0, 0, Z0 + 0.03), walnut, bevel=0.02)
    box("mb_back", (W, 0.07, H), (0, D / 2 - 0.035, Z0 + H / 2), walnut, bevel=0.02)
    box("mb_front", (W, 0.07, H * 0.62), (0, -D / 2 + 0.035, Z0 + H * 0.31), walnut, bevel=0.02)
    for s in (-1, 1): box("mb_side", (0.07, D, H), (s * (W / 2 - 0.035), 0, Z0 + H / 2), walnut, bevel=0.02)
    # inlay bands round the outside + little feet
    for y, w in ((-D / 2 - 0.002, W), (D / 2 + 0.002, W)):
        box("mb_band", (w - 0.08, 0.01, 0.035), (0, y, Z0 + 0.12), inlay, bevel=0)
    for s in (-1, 1):
        box("mb_band", (0.01, D - 0.08, 0.035), (s * (W / 2 + 0.002), 0, Z0 + 0.12), inlay, bevel=0)
        for t in (-1, 1): sphere("mb_foot", 0.06, (s * (W / 2 - 0.08), t * (D / 2 - 0.08), Z0 - 0.0), brass, scale=(1, 1, 0.5), sub=2)
    # brass bedplate
    box("mb_bed", (W - 0.2, D - 0.2, 0.03), (0, 0, Z0 + 0.075), brass, bevel=0.01)
    AX, AY, R, L = Z0 + 0.3, 0.14, 0.13, 1.2
    # cylinder bearings (two brass cheeks)
    for s in (-1, 1):
        box("mb_cheek", (0.05, 0.16, 0.24), (s * (L / 2 + 0.06), AY, Z0 + 0.2), brass, bevel=0.015)
        cyl("mb_bearing", 0.035, 0.035, 0.07, (s * (L / 2 + 0.06), AY, AX), steel, rot=(0, math.pi / 2, 0), verts=16, bevel=0.005)
    cylp = _pivot("cylinder", (0, AY, AX))
    _kid(cyl("mb_drum", R, R, L, (0, AY, AX), brass, rot=(0, math.pi / 2, 0), verts=48, bevel=0.01), cylp)
    _kid(cyl("mb_axle", 0.02, 0.02, L + 0.16, (0, AY, AX), steel, rot=(0, math.pi / 2, 0), verts=12, bevel=0), cylp)
    for s in (-1, 1): _kid(cyl("mb_drumend", R + 0.012, R + 0.012, 0.025, (s * L / 2, AY, AX), brass, rot=(0, math.pi / 2, 0), verts=48, bevel=0.006), cylp)
    _kid(box("mb_gearmark", (0.02, 0.02, 0.05), (-L / 2 - 0.015, AY, AX + R - 0.01), steel, bevel=0), cylp)
    # the comb: 18 tuned steel teeth on a slanted base (bass teeth on the left are longer and carry lead weights)
    N, pitch = 18, 0.06
    tipY = AY - R - 0.012
    x0 = -(N - 1) * pitch / 2
    for i in range(N):
        x = x0 + i * pitch
        f = i / (N - 1)
        baseY = -0.4 + f * 0.13
        ln = tipY - baseY
        t = box(f"tooth{i}", (0.044, ln, 0.018), (x, (tipY + baseY) / 2, AX - 0.005), steel, bevel=0.004)
        if i < 6:  # lead weights under the bass teeth make them ring lower without being even longer
            box(f"tooth{i}_lead", (0.04, ln * 0.35, 0.035 - i * 0.004), (x, tipY - ln * 0.25, AX - 0.03), lead, bevel=0.006)
    box("mb_combbase", (N * pitch + 0.08, 0.1, 0.06), (0, -0.39, AX - 0.02), steel, rot=(0, 0, math.atan2(0.13, N * pitch)), bevel=0.01)
    for k in range(4): cyl("mb_screw", 0.018, 0.018, 0.02, (x0 + k * 0.35, -0.39 + k * 0.035, AX + 0.015), brass, verts=10, bevel=0.003)
    box("mb_combfoot", (N * pitch + 0.1, 0.14, AX - Z0 - 0.08), (0, -0.39, Z0 + 0.08 + (AX - Z0 - 0.08) / 2 - 0.02), brass, bevel=0.01)
    # spring barrel (left) with the winding crank outside the left wall
    cyl("mb_barrel", 0.15, 0.15, 0.16, (-0.8, -0.2, Z0 + 0.25), brass, rot=(0, math.pi / 2, 0), verts=36, bevel=0.01)
    for k in range(12):
        a = k * math.pi / 6
        box("mb_ratchet", (0.17, 0.03, 0.03), (-0.8, -0.2 + 0.15 * math.cos(a), Z0 + 0.25 + 0.15 * math.sin(a)), steel, rot=(a, 0, 0), bevel=0.003)
    cr = _pivot("crank", (-W / 2 - 0.04, -0.2, Z0 + 0.25))
    _kid(cyl("mb_crankhub", 0.05, 0.05, 0.06, (-W / 2 - 0.04, -0.2, Z0 + 0.25), brass, rot=(0, math.pi / 2, 0), verts=16, bevel=0.008), cr)
    _kid(box("mb_crankarm", (0.035, 0.05, 0.3), (-W / 2 - 0.08, -0.2, Z0 + 0.38), brass, bevel=0.01), cr)
    _kid(cyl("mb_crankknob", 0.04, 0.035, 0.12, (-W / 2 - 0.15, -0.2, Z0 + 0.51), red, rot=(0, math.pi / 2, 0), verts=14, bevel=0.012), cr)
    # governor (right): gear train up to an endless screw with a two-vane fly and a ruby on top
    box("mb_govframe", (0.22, 0.2, 0.04), (0.82, -0.18, Z0 + 0.12), brass, bevel=0.01)
    for s in (-1, 1): box("mb_govpost", (0.03, 0.03, 0.5), (0.82 + s * 0.09, -0.18, Z0 + 0.37), brass, bevel=0.005)
    box("mb_govtop", (0.24, 0.05, 0.03), (0.82, -0.18, Z0 + 0.62), brass, bevel=0.008)
    cyl("mb_wheel", 0.09, 0.09, 0.02, (0.82, -0.18, Z0 + 0.2), brass, verts=30, bevel=0.004)
    fly = _pivot("fly", (0.82, -0.18, Z0 + 0.38))
    _kid(cyl("mb_screwshaft", 0.012, 0.012, 0.44, (0.82, -0.18, Z0 + 0.38), steel, verts=10, bevel=0), fly)
    for k in range(5): _kid(cyl("mb_thread", 0.022, 0.022, 0.012, (0.82, -0.18, Z0 + 0.22 + k * 0.025), steel, verts=12, bevel=0.003), fly)
    for s in (-1, 1): _kid(box("mb_vane", (0.17, 0.006, 0.09), (0.82 + s * 0.09, -0.18, Z0 + 0.48), brass, bevel=0.003), fly)
    sphere("mb_ruby", 0.022, (0.82, -0.18, Z0 + 0.645), ruby, sub=2)
    # the tune dial on the front (1, 2, 3: the cylinder slides sideways to change tunes)
    cyl("mb_dial", 0.12, 0.12, 0.02, (0.55, -D / 2 - 0.01, Z0 + 0.17), cream, rot=(math.pi / 2, 0, 0), verts=32, bevel=0.005)
    cyl("mb_dialrim", 0.135, 0.135, 0.015, (0.55, -D / 2 - 0.005, Z0 + 0.17), brass, rot=(math.pi / 2, 0, 0), verts=32, bevel=0.004)
    for k, a in enumerate((-0.7, 0, 0.7)):
        _txt(str(k + 1), (0.55 + 0.085 * math.sin(a), -D / 2 - 0.024, Z0 + 0.17 + 0.085 * math.cos(a)), (math.pi / 2, 0, 0), 0.05, navy, extrude=0.003)
    tp = _pivot("tune_pointer", (0.55, -D / 2 - 0.03, Z0 + 0.17))
    _kid(box("mb_pointer", (0.012, 0.008, 0.075), (0.55, -D / 2 - 0.03, Z0 + 0.2), red, bevel=0.002), tp)
    # brass plaque
    box("mb_plaque", (0.6, 0.012, 0.14), (-0.3, -D / 2 - 0.006, Z0 + 0.17), brass, bevel=0.01)
    _txt("OJ MUSIC BOX", (-0.3, -D / 2 - 0.014, Z0 + 0.19), (math.pi / 2, 0, 0), 0.055, navy, extrude=0.003)
    _txt("18 NOTES · 3 TUNES", (-0.3, -D / 2 - 0.014, Z0 + 0.135), (math.pi / 2, 0, 0), 0.034, navy, extrude=0.002)
    # the lid, hinged at the back, open, with a glass window and a painted night sky inside
    HZ = Z0 + H
    lid = _pivot("lid", (0, D / 2, HZ))
    _kid(box("mb_lidframe_b", (W, 0.1, 0.06), (0, D / 2 - 0.05, HZ + 0.03), dark, bevel=0.015), lid)
    _kid(box("mb_lidframe_f", (W, 0.1, 0.06), (0, -D / 2 + 0.05, HZ + 0.03), dark, bevel=0.015), lid)
    for s in (-1, 1): _kid(box("mb_lidframe_s", (0.1, D, 0.06), (s * (W / 2 - 0.05), 0, HZ + 0.03), dark, bevel=0.015), lid)
    _kid(box("mb_lidpanel", (W - 0.2, D - 0.2, 0.012), (0, 0, HZ + 0.045), navy, bevel=0.0), lid)
    # stars and a moon painted on the inside (bottom) of the lid, they face you when it's open
    random.seed(12)
    for k in range(26):
        x = random.uniform(-0.8, 0.8); y = random.uniform(-0.38, 0.38)
        _kid(sphere("mb_star", random.uniform(0.012, 0.025), (x, y, HZ + 0.036), gold, scale=(1, 1, 0.3), sub=1), lid)
    _kid(sphere("mb_moon", 0.08, (0.6, -0.2, HZ + 0.035), cream, scale=(1, 1, 0.25), sub=2), lid)
    _kid(sphere("mb_moonbite", 0.075, (0.64, -0.17, HZ + 0.032), navy, scale=(1, 1, 0.25), sub=2), lid)
    for txt, y, sz in (("ODYSSEY JR.", -0.05, 0.11), ("plays for the stars", 0.12, 0.05)):
        t = _txt(txt, (-0.15, y, HZ + 0.037), (math.pi, 0, 0), sz, gold, extrude=0.003); _kid(t, lid)
    for s in (-1, 1): cyl("mb_hinge", 0.025, 0.025, 0.14, (s * 0.6, D / 2 + 0.01, HZ), brass, rot=(0, math.pi / 2, 0), verts=12, bevel=0.004)
    lid.rotation_euler = (-1.85, 0, 0)

ASSETS.update({"musicbox": musicbox})


# ---------------- Day 13: OJ Turkeys (my wild cousins) ----------------
def _limb(name, p0, p1, r0, r1, m, verts=10):
    # a tapered cylinder from p0 to p1 (for branches and necks)
    a, b = Vector(p0), Vector(p1); d = b - a
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r0, radius2=r1, depth=d.length, location=(a + b) / 2)
    o = bpy.context.object; o.name = name
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = d.to_track_quat("Z", "Y")
    return finish(o, m, 0)

def _turkey(tom):
    # Eastern wild turkey. Origin between the feet, faces -Y. Tom ~2.5 tall (I'm 2: they're BIG cousins), hen ~2.0.
    # Named parts a behavior moves: tk_head (pivot: neck+head), tk_fan (pivot: the tail fan; strut = upright and spread),
    # tk_wing_l / tk_wing_r (pivots: drop them to drag the primaries in a strut), tk_snood (mesh: stretches in a strut).
    # Materials the behavior recolors: tk_skin (red <-> white <-> blue), tk_crown.
    s = 1.0 if tom else 0.8
    P = lambda x, y, z: (x * s, y * s, z * s)
    bronze = mat("tk_bronze" if tom else "tk_brown", (0.36, 0.25, 0.15) if tom else (0.47, 0.36, 0.24), rough=0.45 if tom else 0.85, metal=0.25 if tom else 0.0)
    edge = mat("tk_edge" if tom else "tk_buff", (0.08, 0.06, 0.05) if tom else (0.74, 0.62, 0.45), rough=0.6)
    rust = mat("tk_rust", (0.55, 0.33, 0.17), rough=0.8)
    band = mat("tk_band", (0.1, 0.07, 0.05), rough=0.7)
    tip = mat("tk_tip", (0.78, 0.6, 0.38), rough=0.8)
    white = mat("tk_white", (0.93, 0.92, 0.88), rough=0.8)
    barred = mat("tk_barred", (0.25, 0.2, 0.16), rough=0.8)
    legm = mat("tk_legs", (0.78, 0.5, 0.45) if tom else (0.7, 0.55, 0.5), rough=0.6)
    skin = mat("tk_skin", (0.82, 0.12, 0.1) if tom else (0.55, 0.6, 0.72), rough=0.45)
    crown = mat("tk_crown", (0.92, 0.93, 0.98) if tom else (0.58, 0.66, 0.8), rough=0.45)
    beakm = mat("tk_beak", (0.6, 0.55, 0.45), rough=0.4)
    black = mat("tk_black", (0.04, 0.03, 0.03), rough=0.2)
    shine = mat("tk_shine", (1, 1, 1), rough=0.1)
    # body: a big bronze barrel, a deep breast, scaly black-edged feathers
    sphere("tk_body", 1, P(0, 0.05, 1.25), bronze, scale=(0.5 * s, 0.72 * s, 0.52 * s), sub=3)
    sphere("tk_breast", 1, P(0, -0.38, 1.25), bronze, scale=(0.42 * s, 0.4 * s, 0.48 * s), sub=3)
    random.seed(13)
    for k in range(40):  # black feather edges like fish scales
        a = random.uniform(-1.2, 1.2); z = random.uniform(0.95, 1.6); y = random.uniform(-0.6, 0.45)
        r = math.sqrt(max(0.05, 1 - ((z - 1.25) / 0.55) ** 2 - (y / 0.8) ** 2))
        sphere("tk_scale", 1, P(math.sin(a) * 0.5 * r, y - 0.02, z), edge, scale=(0.05 * s, 0.07 * s, 0.022 * s), sub=1)
    if tom:  # the BEARD: a tassel of hair-like feathers hanging from the breast
        _limb("tk_beard", P(0, -0.7, 1.4), P(0, -0.76, 1.0), 0.05 * s, 0.025 * s, black, verts=8)
    # legs (long, pinkish, with spurs on a tom) and big feet
    for sx in (-1, 1):
        _limb("tk_leg", P(sx * 0.15, 0.02, 0.85), P(sx * 0.16, -0.02, 0.06), 0.06 * s, 0.045 * s, legm, verts=8)
        sphere("tk_thigh", 1, P(sx * 0.18, 0.05, 0.95), bronze, scale=(0.14 * s, 0.2 * s, 0.2 * s), sub=2)
        for a in (-0.45, 0, 0.45):
            _limb("tk_toe", P(sx * 0.16, -0.02, 0.03), P(sx * 0.16 + math.sin(a) * 0.2, -0.02 - math.cos(a) * 0.22, 0.015), 0.025 * s, 0.015 * s, legm, verts=6)
        _limb("tk_toe", P(sx * 0.16, -0.02, 0.03), P(sx * 0.16, 0.14, 0.02), 0.022 * s, 0.012 * s, legm, verts=6)
        if tom: _limb("tk_spur", P(sx * 0.165, 0.02, 0.3), P(sx * 0.17, 0.1, 0.27), 0.018, 0.004, black, verts=6)
    # wings: bronze coverts, white-barred primaries (a turkey's wing looks striped from the side)
    for sx, nm in ((-1, "tk_wing_l"), (1, "tk_wing_r")):
        pv = _pivot(nm, P(sx * 0.42, -0.3, 1.45))
        _kid(sphere("tk_wingm", 1, P(sx * 0.48, 0.05, 1.3), bronze, scale=(0.08 * s, 0.5 * s, 0.3 * s), sub=3), pv)
        _kid(sphere("tk_prim", 1, P(sx * 0.5, 0.32, 1.12), barred, scale=(0.06 * s, 0.42 * s, 0.17 * s), sub=2), pv)
        for k in range(5):
            _kid(box("tk_bar", (0.015 * s, 0.022 * s, 0.13 * s), P(sx * 0.53, 0.1 + k * 0.08, 1.12 + k * 0.012), mat("tk_barlight", (0.78, 0.74, 0.66), rough=0.85), bevel=0), pv)
    # the tail fan: 15 long feathers fanned in a half circle, rusty with a black band and a buff tip. At rest the
    # behavior folds it (squeezed and laid back); in a strut it stands up straight and spreads (scale 1, upright).
    fp = _pivot("tk_fan", P(0, 0.62, 1.32))
    n = 15
    L = (1.0 if tom else 0.85)
    for k in range(n):
        a = -1.5 + 3.0 * k / (n - 1)
        dx, dz = math.sin(a), math.cos(a)
        base = Vector(P(0, 0.64, 1.32))
        for (t0, t1, m_) in ((0.0, 0.72, rust), (0.72, 0.86, band), (0.86, 1.0, tip)):
            a0 = base + Vector((dx, 0.0, dz)) * (L * t0 * s); a1 = base + Vector((dx, 0.0, dz)) * (L * t1 * s)
            o = box("tk_feather", (0.13 * s * (0.9 + t1 * 0.4), 0.02 * s, (t1 - t0) * L * s + 0.01), tuple((a0 + a1) / 2), m_, rot=(0, a, 0), bevel=0.01)
            o.location.y += k * 0.002  # tiny overlap so the feathers don't flicker
            _kid(o, fp)
    _kid(sphere("tk_rump", 1, P(0, 0.62, 1.3), bronze, scale=(0.3 * s, 0.14 * s, 0.25 * s), sub=2), fp)
    # head + long neck on one pivot. Bare skin: a warty red neck (caruncles), a pale crown, a dangly SNOOD over the beak.
    hp = _pivot("tk_head", P(0, -0.55, 1.55))
    _kid(_limb("tk_neck", P(0, -0.6, 1.5), P(0, -0.82, 2.08), 0.13 * s, 0.07 * s, skin, verts=12), hp)
    for k in range(9 if tom else 4):  # caruncles: bumpy knobs on the front of the neck
        z = 1.62 + k * 0.05; y = -0.72 - (z - 1.55) * 0.42
        _kid(sphere("tk_carun", (0.05 if tom else 0.03) * s, P((k % 3 - 1) * 0.05, y, z), skin, sub=1), hp)
    _kid(sphere("tk_headm", 1, P(0, -0.86, 2.14), crown, scale=(0.085 * s, 0.11 * s, 0.09 * s), sub=3), hp)
    _kid(sphere("tk_cheek", 1, P(0, -0.88, 2.1), skin, scale=(0.09 * s, 0.1 * s, 0.07 * s), sub=2), hp)
    b = _kid(_limb("tk_beakm", P(0, -0.94, 2.13), P(0, -1.06, 2.1), 0.035 * s, 0.006, beakm, verts=8), hp)
    # the wattle (a flap under the chin) and the snood
    _kid(sphere("tk_wattle", 1, P(0, -0.9, 2.0), skin, scale=(0.04 * s, 0.05 * s, 0.09 * s), sub=2), hp)
    sn = _kid(_limb("tk_snood", P(0, -0.96, 2.2), P(0.01, -1.04, 2.02 if tom else 2.15), 0.03 * s, 0.018 * s, skin, verts=8), hp)
    for sx in (-1, 1):
        _kid(sphere("tk_eye", 0.022 * s, P(sx * 0.07, -0.9, 2.16), black, sub=2), hp)
        _kid(sphere("tk_eyeshine", 0.008 * s, P(sx * 0.082, -0.915, 2.168), shine, sub=1), hp)

def turkeytom(): _turkey(True)
def turkeyhen(): _turkey(False)

def roosttree():
    # Day 13: THE ROOST. A huge old bare white oak in the east field, with long level limbs, where my wild turkey
    # cousins sleep. Turkeys like big trees with open branches (so they can fly straight up into them and see danger).
    # Empties perch_0 .. perch_7 sit on top of the limbs: that's where each turkey stands at night.
    bark = mat("rt_bark", (0.78, 0.76, 0.72), tex="bark", scale=(1.5, 4))
    t = cyl("rt_trunk", 0.85, 0.55, 4.4, (0, 0, 2.2), bark, verts=22, bevel=0); jitter(t, 0.05)
    for a in (0.2, 1.5, 2.9, 4.1, 5.3):
        cyl("rt_root", 0.32, 0.06, 1.4, (math.cos(a) * 0.75, math.sin(a) * 0.75, 0.16), bark, rot=(0, 1.38, a), verts=8, bevel=0)
    random.seed(21)
    perches = []
    # long level limbs, spiralling up the trunk (white oaks spread wide and low)
    limbs = [(0.3, 3.3, 3.6), (2.0, 3.7, 3.4), (3.6, 3.5, 3.2), (5.0, 4.1, 3.0), (1.1, 4.6, 2.8), (2.8, 5.0, 2.6), (4.4, 5.3, 2.4), (0.0, 5.8, 2.0)]
    for i, (a, z, L) in enumerate(limbs):
        d = Vector((math.cos(a), math.sin(a), 0.18))
        p0 = Vector((0, 0, z)); p1 = p0 + d * L
        _limb("rt_limb", p0, p1, 0.24, 0.07, bark)
        # a little upward elbow at the end + twigs
        p2 = p1 + Vector((math.cos(a) * 0.5, math.sin(a) * 0.5, 0.9))
        _limb("rt_tip", p1, p2, 0.08, 0.02, bark, verts=6)
        for k in range(3):
            q = p0 + (p1 - p0) * (0.45 + k * 0.2); b = a + random.choice((-1, 1)) * random.uniform(0.6, 1.1)
            _limb("rt_twig", q, q + Vector((math.cos(b) * 0.8, math.sin(b) * 0.8, random.uniform(0.5, 1.0))), 0.05, 0.012, bark, verts=5)
        pp = p0 + (p1 - p0) * 0.62; e = _pivot(f"perch_{i}", (pp.x, pp.y, pp.z + 0.17 - (0.24 - 0.17 * 0.62) * 0.3)); perches.append(e)
    # the crown: a few upright leaders
    for a in (0.7, 2.6, 4.6):
        _limb("rt_leader", (0, 0, 4.2), (math.cos(a) * 1.0, math.sin(a) * 1.0, 7.0), 0.3, 0.06, bark)
    # a few hanging-on russet leaves (oaks keep some all winter)
    cols = [mat("rt_leaf0", (0.5, 0.3, 0.17), rough=0.95), mat("rt_leaf1", (0.58, 0.38, 0.2), rough=0.95)]
    for k in range(18):
        a = random.uniform(0, 6.28); r = random.uniform(1.5, 3.4); z = random.uniform(4.3, 6.8)
        sphere("rt_leaves", random.uniform(0.14, 0.24), (math.cos(a) * r, math.sin(a) * r, z), cols[k % 2], scale=(1, 1, 0.6), sub=1)
    # leaf litter + scratched patches under the tree, and a little sign
    wood = mat("wood", WOOD, tex="wood")
    dirt = mat("rt_dirt", (0.85, 0.8, 0.72), tex="dirt", scale=(2, 2))
    cyl("rt_litter", 3.2, 3.2, 0.03, (0, 0, 0.015), mat("rt_litterm", (0.62, 0.45, 0.28), rough=1.0), verts=32, bevel=0)
    cyl("rt_post", 0.06, 0.06, 1.3, (2.2, -3.2, 0.65), wood, verts=8, bevel=0)
    box("rt_board", (1.5, 0.08, 0.55), (2.2, -3.25, 1.2), wood, bevel=0.02)
    navy = mat("rt_ink", (0.16, 0.14, 0.25), rough=0.6)
    _txt("THE ROOST", (2.2, -3.3, 1.28), (math.pi / 2, 0, 0), 0.17, navy, extrude=0.01)
    _txt("turkeys sleep here", (2.2, -3.3, 1.07), (math.pi / 2, 0, 0), 0.09, navy, extrude=0.008)

ASSETS.update({"turkeytom": turkeytom, "turkeyhen": turkeyhen, "roosttree": roosttree})

def cousinslog():
    # Day 13: a fallen log at the edge of the turkeys' feeding ground under the far oak, where I sit and watch my
    # cousins scratch for acorns. Log runs along X, about 3 long. A little sign: COUSINS WATCH.
    bark = mat("cl_bark", (0.75, 0.7, 0.64), tex="bark", scale=(2, 1))
    endw = mat("cl_end", (0.86, 0.7, 0.5), rough=0.9)
    ring = mat("cl_ring", (0.55, 0.4, 0.26), rough=0.9)
    moss = mat("cl_moss", (0.42, 0.56, 0.25), rough=1.0)
    lg = cyl("cl_log", 0.34, 0.3, 3.0, (0, 0, 0.32), bark, rot=(0, math.pi / 2, 0), verts=18, bevel=0); jitter(lg, 0.015)
    for sx, r in ((-1, 0.34), (1, 0.3)):
        cyl("cl_endcap", r * 0.96, r * 0.96, 0.01, (sx * 1.5, 0, 0.32), endw, rot=(0, math.pi / 2, 0), verts=18, bevel=0)
        for k in (0.35, 0.65):
            bpy.ops.mesh.primitive_torus_add(major_radius=r * k, minor_radius=0.008, location=(sx * 1.505, 0, 0.32), rotation=(0, math.pi / 2, 0), major_segments=24, minor_segments=4)
            finish(bpy.context.object, ring)
    for k in range(5): sphere("cl_mosspad", random.uniform(0.12, 0.2), (-1.0 + k * 0.5, random.uniform(-0.08, 0.08), 0.62), moss, scale=(1.4, 1, 0.3), sub=2)
    cyl("cl_branch", 0.08, 0.03, 0.8, (0.6, -0.3, 0.55), bark, rot=(0.9, 0, 0.3), verts=8, bevel=0)
    for k in range(3): sphere("cl_shroom", 0.06, (-0.6 + k * 0.18, -0.3, 0.22 + k * 0.03), mat("cl_shroomm", (0.88, 0.75, 0.55), rough=0.8), scale=(1, 0.5, 0.35), sub=2)
    wood = mat("wood", WOOD, tex="wood"); ink = mat("cl_ink", (0.16, 0.14, 0.25), rough=0.6)
    cyl("cl_post", 0.045, 0.045, 1.1, (1.9, -0.2, 0.55), wood, verts=8, bevel=0)
    box("cl_board", (0.95, 0.06, 0.36), (1.9, -0.25, 1.0), wood, bevel=0.015)
    _txt("COUSINS", (1.9, -0.29, 1.06), (math.pi / 2, 0, 0), 0.12, ink, extrude=0.006)
    _txt("WATCH", (1.9, -0.29, 0.92), (math.pi / 2, 0, 0), 0.1, ink, extrude=0.006)
    sphere("cl_feather_tip", 0.001, (0, 0, 0), ink, sub=1)

ASSETS.update({"cousinslog": cousinslog})


# ---------------- Day 14: OJ Mill (a tower windmill) ----------------
def _ring(name, r, z, tube, m, verts=48):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=tube, major_segments=verts, minor_segments=8, location=(0, 0, z))
    o = bpy.context.object; o.name = name; return finish(o, m, 0)

def _beam(name, p0, p1, w, h, m, bevel=0.01):
    # a square timber from p0 to p1
    a, b = Vector(p0), Vector(p1); d = b - a
    o = box(name, (w, h, d.length), (0, 0, 0), m, bevel=bevel)   # box() bakes its location into the mesh, so build at 0
    o.rotation_mode = "QUATERNION"; o.rotation_quaternion = d.to_track_quat("Z", "Y"); o.location = (a + b) / 2; return o

def windmill():
    # OJ Mill (Day 14): a whitewashed brick TOWER MILL. Only the cap on top turns; the tower stays put.
    # Named parts for behaviors/windmill.js:
    #   "cap"      pivot on top of the tower (turns about the tower's axis to face the wind)
    #   "sails"    pivot at the hub (spins about the windshaft, Blender Y; anticlockwise from the front, like English mills)
    #   "sail_1..4" each sail; "cloth_1..4" pivots on each whip: scale X = how much cloth is spread (1 full .. 0 furled)
    #   "fantail"  pivot at the back of the cap (spins about Blender X when the wind comes round)
    # Front (sails, door) = Blender -Y.
    brick = mat("ml_brick", WOOD, tex="whitebrick", scale=(5, 3))
    stone = mat("stone", WOOD, tex="stone", scale=(4, 1))
    wood = mat("wood", WOOD, tex="wood")
    dark = mat("ml_tar", (0.24, 0.2, 0.18), rough=0.7)
    planks = mat("ml_planks", (0.9, 0.82, 0.72), tex="planks", scale=(1, 1))
    capm = mat("ml_cap", (0.98, 0.86, 0.75), tex="shingles", scale=(5, 3))
    white = mat("trim", (0.96, 0.93, 0.86), rough=0.7)
    green = mat("ml_green", (0.25, 0.48, 0.36), rough=0.6)
    red = mat("ml_red", (0.78, 0.22, 0.18), rough=0.6)
    iron = mat("ml_iron", (0.32, 0.32, 0.34), rough=0.5, metal=0.35)
    cloth = mat("ml_cloth", WOOD, tex="canvas", scale=(1, 3))
    glow = mat("window", (1, 0.9, 0.6), rough=0.3, emit=(1, 0.8, 0.45), emit_strength=1.5)
    cream = mat("rs_cream", (0.93, 0.88, 0.74), rough=0.6)
    sack = mat("ml_sack", (0.86, 0.76, 0.58), tex="canvas", scale=(1, 1))
    H, R0, R1 = 7.0, 2.0, 1.45
    tilt = math.atan((R0 - R1) / H)
    rad = lambda z: R0 - (R0 - R1) * z / H
    # stone plinth + the brick tower
    cyl("ml_plinth", R0 + 0.18, R0 + 0.12, 0.4, (0, 0, 0.2), stone, verts=48, bevel=0.03)
    cyl("ml_tower", R0, R1, H - 0.4, (0, 0, 0.4 + (H - 0.4) / 2), brick, verts=48, bevel=0)
    _ring("ml_curb", R1 + 0.05, H - 0.02, 0.09, dark)
    def onwall(name, size, z, phi, m, out=0.0):
        r = rad(z) + out
        return box(name, size, (math.sin(phi) * r, -math.cos(phi) * r, z), m, rot=(-tilt, 0, phi), bevel=0.02)
    # the door (front), a little porch step and a sign
    onwall("ml_doorframe", (1.25, 0.1, 1.95), 1.38, 0, white, 0.0)
    onwall("ml_door", (1.0, 0.1, 1.75), 1.3, 0, green, 0.04)
    for zz in (0.85, 1.65): onwall("ml_doorbar", (0.9, 0.06, 0.08), zz, 0, mat("ml_green2", (0.2, 0.4, 0.3), rough=0.6), 0.09)
    sphere("ml_knob", 0.06, (0.34, -rad(1.3) - 0.14, 1.3), mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9))
    box("ml_step", (1.5, 0.7, 0.2), (0, -R0 - 0.45, 0.1), stone, bevel=0.03)
    onwall("ml_sign", (1.7, 0.08, 0.42), 2.75 - 0.6, 0, cream, 0.02) if False else None
    # windows on three floors, spiralling round
    for z, phi in ((3.3, 0.0), (3.0, 2.2), (4.9, -1.1), (5.6, 1.0), (4.4, 3.4)):
        onwall("ml_winframe", (0.62, 0.08, 0.8), z, phi, white, 0.0)
        onwall("ml_win", (0.46, 0.08, 0.62), z, phi, glow, 0.03)
        onwall("ml_sill", (0.72, 0.18, 0.07), z - 0.43, phi, white, 0.05)
    # the reefing stage: a wooden gallery round the tower. The miller walks round it to set the sail cloth by hand.
    SZ, SR = 2.2, 2.78
    st = cyl("ml_stage", SR, SR, 0.1, (0, 0, SZ), planks, verts=48, bevel=0.01)
    _ring("ml_stage_edge", SR, SZ, 0.06, wood)
    for k in range(20):
        a = k * math.pi * 2 / 20
        cyl("ml_rail_post", 0.04, 0.04, 0.8, (math.sin(a) * (SR - 0.06), -math.cos(a) * (SR - 0.06), SZ + 0.45), wood, verts=8, bevel=0)
        if k % 2 == 0:
            r_in = rad(SZ - 1.0)
            _beam("ml_brace", (math.sin(a) * r_in, -math.cos(a) * r_in, SZ - 1.0), (math.sin(a) * (SR - 0.15), -math.cos(a) * (SR - 0.15), SZ - 0.04), 0.09, 0.09, wood)
    _ring("ml_rail", SR - 0.06, SZ + 0.85, 0.045, white)
    _ring("ml_rail_mid", SR - 0.06, SZ + 0.45, 0.03, wood)
    # a ladder up to the stage (round the back-left, out of the way of the sails)
    la = -3 * math.pi / 4
    dirv = Vector((math.sin(la), -math.cos(la), 0))
    side = Vector((math.cos(la), math.sin(la), 0))
    foot, top = dirv * 3.65, dirv * (SR - 0.05) + Vector((0, 0, SZ + 0.85))
    for sgn in (-1, 1):
        o = side * 0.3 * sgn
        _beam("ml_ladder", tuple(foot + o), tuple(top + o), 0.07, 0.07, wood)
    for i in range(1, 8):
        f = i / 8; p = foot.lerp(top, f)
        _beam("ml_rung", tuple(p - side * 0.3), tuple(p + side * 0.3), 0.04, 0.04, wood)
    # flour sacks by the door
    for x, y, rz in ((1.05, -R0 - 0.35, 0.3), (1.45, -R0 - 0.1, -0.2), (1.2, -R0 - 0.2, 0.0)):
        z = 0.32 if rz != 0.0 else 0.8
        sphere("ml_floursack", 0.32, (x, y, z), sack, scale=(0.9, 0.75, 1.15), sub=3)
    _txt("FLOUR", (1.05, -R0 - 0.62, 0.36), (math.pi / 2 - 0.25, 0, 0.3), 0.1, mat("bo_ink", (0.55, 0.2, 0.15), rough=0.8), 0.004)

    # ---------- the cap (it all turns together) ----------
    cap = _pivot("cap", (0, 0, H))
    c = sphere("ml_capdome", 1.0, (0, 0, H), capm, scale=(R1 + 0.25, R1 + 0.55, 1.35), sub=4)
    bm = bmesh.new(); bm.from_mesh(c.data); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < H - 0.01], context="VERTS"); bm.to_mesh(c.data); bm.free()
    _kid(c, cap)
    _kid(_ring("ml_capskirt", 1.0, H + 0.02, 0.1, white), cap).scale = (R1 + 0.25, R1 + 0.55, 1)
    _kid(sphere("ml_finial", 0.22, (0, 0, H + 1.45), white, sub=3), cap)
    _kid(cyl("ml_finial_neck", 0.08, 0.12, 0.3, (0, 0, H + 1.25), white, verts=12, bevel=0), cap)
    # windshaft poking out the front, a little upward like real ones (but the hub is what spins)
    HY, HZ = -2.05, H + 0.7
    _kid(cyl("ml_windshaft", 0.2, 0.2, 1.2, (0, HY + 0.55, HZ), dark, rot=(math.pi / 2, 0, 0), verts=16, bevel=0.01), cap)
    sails = _pivot("sails", (0, HY, HZ)); _kid(sails, cap)
    _kid(cyl("ml_canister", 0.34, 0.34, 0.5, (0, HY, HZ), iron, rot=(math.pi / 2, 0, 0), verts=20, bevel=0.03), sails)
    _kid(cyl("ml_canister_cap", 0.22, 0.12, 0.18, (0, HY - 0.32, HZ), red, rot=(math.pi / 2, 0, 0), verts=20, bevel=0.02), sails)
    SL, W0, BAR = 4.4, 0.95, 0.26
    for k in range(4):
        sp = _pivot(f"sail_{k + 1}", (0, HY, HZ)); _kid(sp, sails)
        Y = HY - 0.06
        # the whip (main spar) runs straight up from the hub
        _kid(box("ml_whip", (0.14, 0.12, SL), (0, Y, HZ + SL / 2), wood, bevel=0.015), sp)
        # lattice: sail bars across, a hemlath along the outside edge, a narrow leading board on the other side
        z = HZ + 0.9
        while z < HZ + SL - 0.05:
            _kid(box("ml_sailbar", (W0 + 0.28, 0.05, 0.04), (W0 / 2 - 0.12, Y, z), white, bevel=0.005), sp); z += BAR
        _kid(box("ml_hemlath", (0.06, 0.06, SL - 0.85), (W0, Y, HZ + 0.85 + (SL - 0.85) / 2), white, bevel=0.008), sp)
        _kid(box("ml_leadboard", (0.24, 0.03, SL - 0.85), (-0.24, Y + 0.02, HZ + 0.85 + (SL - 0.85) / 2), white, bevel=0.008), sp)
        # the cloth (on the trailing side: sails go anticlockwise from the front, so that's +X here)
        cp = _pivot(f"cloth_{k + 1}", (0.06, Y + 0.05, HZ)); _kid(cp, sp)
        me = bpy.data.meshes.new("ml_cloth"); z0, z1 = HZ + 0.95, HZ + SL - 0.1
        me.from_pydata([(0.06, Y + 0.05, z0), (W0 - 0.02, Y + 0.05, z0), (W0 - 0.02, Y + 0.05, z1), (0.06, Y + 0.05, z1)], [], [(0, 1, 2, 3)]); me.update()
        uv = me.uv_layers.new()
        for li, l in enumerate(me.loops): uv.data[li].uv = [(0, 0), (1, 0), (1, 1), (0, 1)][l.vertex_index]
        o = bpy.data.objects.new("ml_cloth", me); bpy.context.collection.objects.link(o); o.data.materials.append(cloth)
        o.modifiers.new("solid", "SOLIDIFY").thickness = 0.03; _kid(o, cp)
        # a rolled-up roll of cloth along the whip (shows when the cloth is furled)
        _kid(cyl("ml_furl", 0.08, 0.08, SL - 1.1, (0.12, Y + 0.05, HZ + 0.95 + (SL - 1.1) / 2), cloth, verts=10, bevel=0), cp)
        sp.rotation_euler = (0, math.pi / 4 + k * math.pi / 2, 0)  # start in a St Andrew's cross (X = "short rest")
    # the fantail on a little frame at the back of the cap: blades in the Y-Z plane, spinning about X
    FY, FZ = R1 + 1.25, H + 1.0
    for sgn in (-1, 1):
        _kid(_beam("ml_fanstrut", (sgn * 0.45, R1 + 0.25, H + 0.1), (sgn * 0.25, FY, FZ - 0.05), 0.09, 0.09, wood), cap)
        _kid(_beam("ml_fanstrut2", (sgn * 0.45, R1 + 0.1, H + 0.9), (sgn * 0.25, FY, FZ + 0.05), 0.07, 0.07, wood), cap)
    _kid(cyl("ml_fanaxle", 0.05, 0.05, 0.75, (0, FY, FZ), iron, rot=(0, math.pi / 2, 0), verts=10, bevel=0), cap)
    fan = _pivot("fantail", (0, FY, FZ)); _kid(fan, cap)
    _kid(cyl("ml_fanhub", 0.13, 0.13, 0.22, (0, FY, FZ), red, rot=(0, math.pi / 2, 0), verts=16, bevel=0.02), fan)
    for k in range(6):
        a = k * math.pi / 3
        b = box("ml_fanblade", (0.03, 0.34, 0.9), (0, 0, 0), white if k % 2 else red, bevel=0.01)
        b.rotation_euler = (-a, 0, 0); b.rotation_euler.rotate_axis("Z", 0.45)  # pitched, like a little propeller
        b.location = (0, FY + math.sin(a) * 0.6, FZ + math.cos(a) * 0.6); bpy.context.view_layer.update()
        _kid(b, fan)
        _kid(_beam("ml_fanarm", (0, FY, FZ), (0, FY + math.sin(a) * 0.22, FZ + math.cos(a) * 0.22), 0.03, 0.03, wood), fan)
    # sign over the door: OJ MILL
    sz = 4.3
    box("ml_signboard", (1.6, 0.08, 0.4), (0, -rad(sz) - 0.09, sz), cream, rot=(-tilt, 0, 0), bevel=0.02)
    _txt("OJ MILL", (0, -rad(sz) - 0.14, sz), (math.pi / 2 - tilt, 0, 0), 0.24, mat("bo_ink", (0.55, 0.2, 0.15), rough=0.8), 0.01)

ASSETS.update({"windmill": windmill})

def millroom():
    # The stone floor inside OJ Mill (Day 14). One pair of millstones in a wooden tun, fed from a hopper, driven from above
    # ("overdrift"): the great spur wheel on the upright shaft turns a little stone nut, whose spindle (the quant) turns the
    # runner stone. The damsel on the quant knocks the shoe so grain trickles into the eye of the stone. Flour comes out
    # of the meal spout into a sack. A centrifugal governor lifts or drops the runner (tentering) as the speed changes.
    # Named parts (behaviors/millstones.js): "runner", "spur", "stonenut" (spin about Z), "shoe" (wiggles about X),
    # "gov" (spins), "gov_arm_1/2" (swing out about Y), "flour" (pivot at the sack's bottom: scale Z with today's flour).
    wood = mat("wood", WOOD, tex="wood")
    planks = mat("ml_planks", (0.9, 0.82, 0.72), tex="planks", scale=(1, 1))
    dark = mat("ml_tar", (0.24, 0.2, 0.18), rough=0.7)
    burr = mat("ml_burr", (0.86, 0.84, 0.8), tex="stone", scale=(2, 2))
    groove = mat("ml_groove", (0.4, 0.38, 0.36), rough=0.9)
    iron = mat("ml_iron", (0.32, 0.32, 0.34), rough=0.5, metal=0.35)
    gold = mat("ml_grain", (0.9, 0.72, 0.35), rough=0.8)
    flourm = mat("ml_flour", (0.98, 0.96, 0.92), rough=0.9)
    sack = mat("ml_sack", (0.86, 0.76, 0.58), tex="canvas", scale=(1, 1))
    red = mat("ml_red", (0.78, 0.22, 0.18), rough=0.6)
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    ink = mat("bo_ink", (0.55, 0.2, 0.15), rough=0.8)
    # the hurst: a low wooden platform the stones sit on
    box("mr_hurst", (3.0, 2.8, 0.5), (0, 0, 0.25), planks, bevel=0.03)
    SZ = 0.5
    cyl("mr_bed", 0.95, 0.95, 0.22, (0, 0, SZ + 0.11), burr, verts=40, bevel=0.02)
    rn = _pivot("runner", (0, 0, SZ + 0.22))
    _kid(cyl("mr_runner", 0.93, 0.93, 0.26, (0, 0, SZ + 0.36), burr, verts=40, bevel=0.03), rn)
    _kid(cyl("mr_eye", 0.18, 0.18, 0.02, (0, 0, SZ + 0.5), mat("mr_eyed", (0.2, 0.18, 0.16), rough=1), verts=20, bevel=0), rn)
    _kid(_ring("mr_hoop", 0.93, SZ + 0.42, 0.025, iron), rn)
    for k in range(6):  # marks on top so you can see it turn (and a red balance box)
        a = k * math.pi / 3
        _kid(box("mr_mark", (0.05, 0.6, 0.012), (math.cos(a) * 0.55, math.sin(a) * 0.55, SZ + 0.495), groove, rot=(0, 0, a + 0.3), bevel=0), rn)
    _kid(box("mr_balance", (0.18, 0.1, 0.06), (0.7, 0, SZ + 0.52), red, bevel=0.01), rn)
    # the tun (wooden case round the stones), cut away at the front so you can watch
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=1.12, depth=0.5, location=(0, 0, SZ + 0.25), end_fill_type="NOTHING")
    t = bpy.context.object; t.name = "mr_tun"
    bm = bmesh.new(); bm.from_mesh(t.data); bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.y < -0.35], context="VERTS"); bm.to_mesh(t.data); bm.free()
    finish(t, wood); t.modifiers.new("solid", "SOLIDIFY").thickness = 0.06
    _ring("mr_tunband", 1.14, SZ + 0.45, 0.02, iron).scale = (1, 1, 1)
    bm = None
    # meal spout + flour sack on the front-right
    _beam("mr_spout", (0.78, -0.82, SZ + 0.38), (1.05, -1.5, SZ + 0.3), 0.2, 0.16, wood)
    fl = _pivot("flour", (1.05, -1.75, 0.0))
    _kid(sphere("mr_sack_flour", 0.33, (1.05, -1.75, 0.34), sack, scale=(1, 0.85, 1.05), sub=3), fl)
    _kid(sphere("mr_sack_top", 0.18, (1.05, -1.75, 0.66), flourm, scale=(1, 0.85, 0.45), sub=2), fl)
    cyl("mr_sackmouth", 0.22, 0.26, 0.16, (1.05, -1.75, 0.74), sack, verts=16, bevel=0)
    _txt("OJ FLOUR", (1.05, -2.04, 0.38), (math.pi / 2, 0, 0), 0.1, ink, 0.004)
    # the horse (frame) on the tun holding the hopper; the shoe under it; the damsel on the quant
    for x in (-0.55, 0.55):
        for y in (-0.15, 0.65): _beam("mr_horse", (x, y, SZ + 0.5), (x * 0.7, y * 0.8, SZ + 1.4), 0.07, 0.07, wood)
    bpy.ops.mesh.primitive_cone_add(vertices=4, radius1=0.12, radius2=0.72, depth=0.75, location=(0.0, 0.35, SZ + 1.75), rotation=(0, 0, math.pi / 4))
    hp = bpy.context.object; hp.name = "mr_hopper"; finish(hp, planks, 0, smooth=False); hp.modifiers.new("solid", "SOLIDIFY").thickness = 0.04
    sphere("mr_grain", 0.48, (0.0, 0.35, SZ + 2.05), gold, scale=(1, 1, 0.35), sub=3)
    sh = _pivot("shoe", (0.0, 0.4, SZ + 1.32))
    _kid(box("mr_shoe", (0.24, 0.55, 0.08), (0.0, 0.2, SZ + 1.2), wood, rot=(-0.4, 0, 0), bevel=0.01), sh)
    _kid(sphere("mr_shoegrain", 0.08, (0.0, 0.08, SZ + 1.18), gold, scale=(1, 2, 0.6), sub=2), sh)
    # overdrift: the quant (spindle) from the stone nut above down to the runner, with the damsel's four knobs
    QZ0, QZ1 = SZ + 0.5, 3.35
    sn = _pivot("stonenut", (0, 0, QZ1))
    _kid(cyl("mr_quant", 0.05, 0.05, QZ1 - QZ0, (0, 0, (QZ0 + QZ1) / 2), iron, verts=10, bevel=0), sn)
    _kid(cyl("mr_nut", 0.3, 0.3, 0.2, (0, 0, QZ1), wood, verts=20, bevel=0.01), sn)
    for k in range(12):
        a = k * math.pi / 6
        _kid(box("mr_nutcog", (0.08, 0.05, 0.16), (math.cos(a) * 0.33, math.sin(a) * 0.33, QZ1), iron, rot=(0, 0, a), bevel=0.005), sn)
    for k in range(4):
        a = k * math.pi / 2
        _kid(box("mr_damsel", (0.2, 0.05, 0.05), (math.cos(a) * 0.08, math.sin(a) * 0.08, SZ + 1.0), iron, rot=(0, 0, a), bevel=0.005), sn)
    # the great spur wheel on the upright shaft (left), with wooden cogs, meshing with the stone nut
    GX, GR = -1.6, 1.25
    cyl("mr_upright", 0.18, 0.18, 4.4, (GX, 0, 2.4), dark, verts=8, bevel=0.01)
    sw = _pivot("spur", (GX, 0, QZ1))
    _kid(_ring("mr_spurrim", GR, QZ1, 0.08, wood, verts=64), sw)
    for k in range(4):
        a = k * math.pi / 4
        _kid(box("mr_spurarm", (GR * 2, 0.1, 0.12), (GX, 0, QZ1), wood, rot=(0, 0, a), bevel=0.01), sw)
    for k in range(36):
        a = k * math.pi * 2 / 36
        _kid(box("mr_spurcog", (0.1, 0.06, 0.14), (GX + math.cos(a) * (GR + 0.08), math.sin(a) * (GR + 0.08), QZ1), planks, rot=(0, 0, a), bevel=0.005), sw)
    # governor: a little spindle by the stones with two flyballs (they swing out when the stones speed up)
    VX, VY = -1.0, 1.0
    box("mr_govbase", (0.3, 0.3, 0.1), (VX, VY, SZ + 0.05), iron, bevel=0.01)
    gv = _pivot("gov", (VX, VY, SZ + 1.1))
    _kid(cyl("mr_govspindle", 0.03, 0.03, 1.1, (VX, VY, SZ + 0.6), iron, verts=8, bevel=0), gv)
    _kid(sphere("mr_govtop", 0.06, (VX, VY, SZ + 1.15), brass, sub=2), gv)
    for i, sgn in enumerate((-1, 1)):
        ap = _pivot(f"gov_arm_{i + 1}", (VX, VY, SZ + 1.1)); _kid(ap, gv)
        _kid(_beam("mr_govrod", (VX, VY, SZ + 1.1), (VX + sgn * 0.12, VY, SZ + 0.68), 0.02, 0.02, iron), ap)
        _kid(sphere("mr_govball", 0.09, (VX + sgn * 0.13, VY, SZ + 0.63), brass, sub=2), ap)
    # sacks of wheat against the back, a sack hoist chain, a bench with my mill bill, and a spare stone showing its dress
    for i, (x, z) in enumerate(((-3.6, 0.42), (-2.9, 0.42), (-3.25, 1.12), (3.4, 0.42))):
        sphere("mr_wheatsack", 0.4, (x, 2.9, z), sack, scale=(0.95, 0.8, 0.95), sub=3)
    _txt("WHEAT", (-2.9, 2.55, 0.45), (math.pi / 2, 0, 0), 0.12, ink, 0.004)
    cyl("mr_chain", 0.025, 0.025, 2.6, (2.3, 1.8, 2.9), iron, verts=6, bevel=0)
    _ring("mr_hook", 0.1, 1.55, 0.02, iron).rotation_euler = (math.pi / 2, 0, 0)
    box("mr_bench", (1.4, 0.55, 0.08), (2.9, 0.6, 0.75), planks, bevel=0.02)
    for x in (2.35, 3.45):
        for y in (0.4, 0.8): box("mr_benchleg", (0.07, 0.07, 0.72), (x, y, 0.36), wood, bevel=0.01)
    cyl("mr_billhandle", 0.03, 0.03, 0.5, (2.75, 0.55, 0.83), wood, rot=(0, math.pi / 2, 0.3), verts=8, bevel=0)
    box("mr_billhead", (0.05, 0.25, 0.05), (2.52, 0.48, 0.83), iron, bevel=0.005)
    # the spare stone leaning on the right wall, face out: lands (flat) and furrows (grooves) in 10 "harps"
    SX, SYc = 3.85, -0.6
    spare = _pivot("mr_spare", (0, 0, 0))
    _kid(cyl("mr_spare_stone", 0.85, 0.85, 0.22, (0, 0, 0), burr, verts=40, bevel=0.02), spare)
    _kid(cyl("mr_spare_eye", 0.15, 0.15, 0.24, (0, 0, 0), mat("mr_eyed", (0.2, 0.18, 0.16), rough=1), verts=16, bevel=0), spare)
    for h in range(10):
        a0 = h * math.pi * 2 / 10
        for j in range(3):  # each harp: a master furrow and two shorter ones parallel to it
            L = 0.62 - j * 0.16; off = j * 0.14
            ang = a0 + 0.35
            cx = math.cos(a0) * 0.18 + math.cos(ang) * L / 2 + math.cos(a0 + math.pi / 2) * off
            cy = math.sin(a0) * 0.18 + math.sin(ang) * L / 2 + math.sin(a0 + math.pi / 2) * off
            if math.hypot(cx, cy) + L / 2 > 0.84: continue
            _kid(box("mr_furrow", (L, 0.035, 0.01), (cx, cy, 0.115), groove, rot=(0, 0, ang), bevel=0), spare)
    spare.location = (SX, SYc, 0.86); spare.rotation_euler = (0, -math.pi / 2 + 0.18, 0)
    # a tiny stool (for me) and a lantern hook
    cyl("mr_stool", 0.32, 0.32, 0.08, (1.8, -0.9, 0.45), planks, verts=20, bevel=0.02)
    for k in range(3):
        a = k * math.pi * 2 / 3
        _beam("mr_stoolleg", (1.8 + math.cos(a) * 0.22, -0.9 + math.sin(a) * 0.22, 0.42), (1.8 + math.cos(a) * 0.3, -0.9 + math.sin(a) * 0.3, 0.0), 0.05, 0.05, wood)

ASSETS.update({"millroom": millroom})

# ---------------- Day 16: OJ Camera Obscura ----------------
def obscura():
    # OJ Camera Obscura (Day 16): a dark little hut with a brass lens in a painted eye on its front (-Y) wall.
    # Step inside and the yard is on the back wall, upside down, live (behaviors/obscura.js renders it).
    # A curtain door on the +X side. A little periscope cupola on the roof (like Edinburgh's, 1853). Named parts:
    # "lens_glass" (glints), "cupola_mirror" (turns slowly).
    planks = mat("ob_planks", (0.27, 0.3, 0.45), tex="planks", scale=(1.6, 1))
    trim = mat("ob_trim", (0.95, 0.9, 0.78), rough=0.7)
    roof = mat("ob_roof", (0.72, 0.3, 0.26), tex="shingles", scale=(3, 2))
    stone = mat("stone", WOOD, tex="stone", scale=(2, 2))
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    glass = mat("ob_glass", (0.55, 0.75, 0.85), rough=0.05, metal=0.2)
    cream = mat("ob_cream", (0.97, 0.93, 0.8), rough=0.6)
    iris = mat("ob_iris", (0.32, 0.55, 0.62), rough=0.6)
    dark = mat("ob_dark", (0.07, 0.06, 0.07), rough=0.9)
    curtain = mat("ob_curtain", (0.55, 0.12, 0.16), tex="fabric", scale=(2, 2)) if os.path.exists(f"{TEX}/fabric.png") else mat("ob_curtain", (0.55, 0.12, 0.16), rough=0.95)
    gold = mat("ob_gold", (0.92, 0.75, 0.32), rough=0.4, metal=0.6)
    board = mat("ob_board", (0.16, 0.2, 0.18), rough=0.95)
    chalk = mat("ob_chalk", (0.95, 0.95, 0.9), rough=1)
    wood = mat("wood", WOOD, tex="wood")
    W, D, H = 3.4, 3.4, 2.7
    box("ob_pad", (W + 0.8, D + 0.8, 0.1), (0, 0, 0.05), stone, bevel=0.03)
    box("ob_body", (W, D, H), (0, 0, 0.1 + H / 2), planks, bevel=0.04)
    for sx in (-1, 1):
        for sy in (-1, 1): box("ob_corner", (0.16, 0.16, H + 0.05), (sx * W / 2, sy * D / 2, 0.1 + H / 2), trim, bevel=0.03)
    box("ob_band", (W + 0.08, D + 0.08, 0.12), (0, 0, 0.16), trim, bevel=0.02)
    box("ob_eave", (W + 0.2, D + 0.2, 0.14), (0, 0, 0.1 + H), trim, bevel=0.03)
    # pyramid roof
    r = cyl("ob_roof", (W + 0.7) / math.sqrt(2), 0.08, 1.5, (0, 0, 0.1 + H + 0.75), roof, rot=(0, 0, math.pi / 4), verts=4, bevel=0.02)
    # periscope cupola: a little square tower with a slanted mirror hood that peeks out over the yard
    top = 0.1 + H + 1.2
    box("ob_cupola", (0.6, 0.6, 0.55), (0, 0, top + 0.2), planks, bevel=0.03)
    box("ob_cupola_cap", (0.75, 0.75, 0.08), (0, 0, top + 0.5), trim, bevel=0.02)
    hood = _pivot("cupola_mirror", (0, 0, 0))
    _kid(box("ob_hood", (0.5, 0.5, 0.45), (0, 0.05, 0.22), roof, bevel=0.03), hood)
    _kid(box("ob_hood_glass", (0.42, 0.04, 0.32), (0, -0.21, 0.2), glass, bevel=0.01), hood)
    _kid(sphere("ob_finial", 0.07, (0, 0.05, 0.5), brass), hood)
    hood.location = (0, 0, top + 0.54)
    # the painted eye on the front wall, with the lens in its pupil
    fy = -D / 2 - 0.02; ez = 1.55
    e = sphere("ob_eye_white", 1, (0, fy, ez), cream, scale=(0.95, 0.03, 0.5), sub=4)
    sphere("ob_eye_lid", 1, (0, fy + 0.005, ez), gold, scale=(1.02, 0.025, 0.56), sub=4)
    sphere("ob_eye_iris", 0.36, (0, fy - 0.02, ez), iris, scale=(1, 0.06, 1), sub=4)
    sphere("ob_eye_pupil", 0.2, (0, fy - 0.035, ez), dark, scale=(1, 0.05, 1), sub=4)
    for k in range(9):   # little painted lashes on top
        a = math.radians(35 + k * 13.75)
        box("ob_lash", (0.035, 0.02, 0.22), (math.cos(a) * 1.0, fy - 0.01, ez + math.sin(a) * 0.55 + 0.08), dark, rot=(0, -(a - math.pi / 2), 0), bevel=0)
    cyl("ob_lens_tube", 0.13, 0.13, 0.42, (0, fy - 0.22, ez), brass, rot=(math.pi / 2, 0, 0), verts=24)
    cyl("ob_lens_ring", 0.16, 0.16, 0.05, (0, fy - 0.43, ez), brass, rot=(math.pi / 2, 0, 0), verts=24)
    cyl("lens_glass", 0.11, 0.11, 0.02, (0, fy - 0.45, ez), glass, rot=(math.pi / 2, 0, 0), verts=24, bevel=0)
    # lens cap dangling on a chain
    cyl("ob_chain", 0.01, 0.01, 0.34, (0.15, fy - 0.42, ez - 0.2), mat("ob_iron", (0.25, 0.25, 0.27), rough=0.6, metal=0.5), verts=6, bevel=0)
    cyl("ob_cap", 0.15, 0.15, 0.04, (0.15, fy - 0.43, ez - 0.4), brass, rot=(math.pi / 2, 0, 0), verts=24)
    # sign over the eye
    box("ob_sign", (2.6, 0.06, 0.42), (0, fy - 0.03, 2.5), trim, bevel=0.03)
    _txt("CAMERA OBSCURA", (0, fy - 0.07, 2.5), (math.pi / 2, 0, 0), 0.24, mat("ob_ink", (0.2, 0.22, 0.36), rough=0.6), 0.01)
    # curtain door on the +X side
    dx = W / 2 + 0.02
    box("ob_doorframe", (0.06, 1.2, 2.0), (dx, 0.3, 1.1), trim, bevel=0.02)
    box("ob_doorhole", (0.04, 1.0, 1.85), (dx + 0.02, 0.3, 1.05), dark, bevel=0)
    for i in range(6):   # pleated curtain
        y = 0.3 - 0.45 + i * 0.18
        cyl("ob_curtain", 0.09, 0.08, 1.75, (dx + 0.07, y, 1.0), curtain, verts=10, bevel=0)
    cyl("ob_rod", 0.03, 0.03, 1.2, (dx + 0.08, 0.3, 1.95), brass, rot=(math.pi / 2, 0, 0), verts=10)
    box("ob_step", (0.6, 1.2, 0.14), (dx + 0.3, 0.3, 0.07), stone, bevel=0.02)
    # chalkboard on the -X side: "NOW SHOWING"
    bx = -W / 2 - 0.03
    box("ob_chalkframe", (0.06, 1.5, 1.0), (bx, 0, 1.4), wood, bevel=0.02)
    box("ob_chalkboard", (0.04, 1.36, 0.86), (bx - 0.02, 0, 1.4), board, bevel=0)
    for j, (t, s) in enumerate((("NOW SHOWING:", 0.12), ("THE YARD", 0.16), ("(upside down)", 0.1))):
        _txt(t, (bx - 0.05, 0, 1.65 - j * 0.24), (math.pi / 2, 0, -math.pi / 2), s, chalk, 0.003)

def obscuraroom():
    # Inside the Camera Obscura (Day 16). Room is 8 wide x 7 deep. This model sits at room (0,0).
    # Blender +Y = into the room (three -Z) = the back wall, where the screen hangs. The hole is in the (missing) front wall.
    # Named parts: "aperture_wheel" (turns to the chosen hole), "easel_board".
    wood = mat("wood", WOOD, tex="wood")
    dark = mat("or_frame", (0.22, 0.15, 0.11), tex="wood")
    gesso = mat("or_gesso", (0.9, 0.88, 0.82), rough=0.95)
    brass = mat("brass", (0.85, 0.65, 0.25), rough=0.3, metal=0.9)
    planks = mat("or_planks", (0.45, 0.33, 0.24), tex="planks", scale=(1.2, 1))
    velvet = mat("or_velvet", (0.35, 0.08, 0.12), rough=1)
    paper = mat("or_paper", (0.97, 0.95, 0.88), rough=1)
    # screen frame on the back wall (the live picture is added by the behavior, just in front of the gesso)
    SY, SZ, SW, SH = 3.46, 1.85, 6.0, 3.0
    box("or_gesso", (SW, 0.04, SH), (0, SY, SZ), gesso, bevel=0)
    for z in (SZ - SH / 2 - 0.08, SZ + SH / 2 + 0.08): box("or_frame_h", (SW + 0.36, 0.1, 0.16), (0, SY - 0.03, z), dark, bevel=0.03)
    for x in (-SW / 2 - 0.1, SW / 2 + 0.1): box("or_frame_v", (0.16, 0.1, SH + 0.32), (x, SY - 0.03, SZ), dark, bevel=0.03)
    # a velvet rope + two brass posts in front of the screen
    for x in (-2.2, 2.2):
        cyl("or_post", 0.06, 0.06, 0.9, (x, 2.3, 0.45), brass, verts=12)
        cyl("or_postbase", 0.18, 0.2, 0.06, (x, 2.3, 0.03), brass, verts=16)
        sphere("or_postknob", 0.08, (x, 2.3, 0.92), brass)
    for i in range(12):
        x = -2.2 + 4.4 * (i + 0.5) / 12; sag = 0.18 * math.sin(math.pi * (i + 0.5) / 12)
        cyl("or_rope", 0.035, 0.035, 0.4, (x, 2.3, 0.86 - sag), velvet, rot=(0, math.pi / 2, 0), verts=8, bevel=0)
    # a long bench facing the screen (I sit at its middle)
    BY = -0.5
    box("or_bench_seat", (2.6, 0.55, 0.1), (0, BY, 0.5), planks, bevel=0.02)
    box("or_bench_back", (2.6, 0.08, 0.5), (0, BY - 0.28, 0.85), planks, bevel=0.02)
    for x in (-1.15, 1.15):
        for y in (BY - 0.2, BY + 0.2): box("or_bench_leg", (0.08, 0.08, 0.5), (x, y, 0.25), wood, bevel=0.01)
    box("or_cushion", (0.7, 0.45, 0.08), (0, BY, 0.58), velvet, bevel=0.03)
    # a tracing easel to the right, turned toward the screen
    ex, ey = 2.9, 0.6
    eas = _pivot("or_easel", (0, 0, 0))
    for s in (-1, 1): _kid(_beam("or_easel_leg", (s * 0.45, 0, 0), (s * 0.18, 0.05, 2.0), 0.06, 0.06, wood), eas)
    _kid(_beam("or_easel_back", (0, 0.6, 0), (0, 0.05, 1.9), 0.06, 0.06, wood), eas)
    _kid(box("or_easel_ledge", (1.2, 0.12, 0.06), (0, -0.06, 0.75), wood, bevel=0.01), eas)
    _kid(box("easel_board", (1.1, 0.04, 0.85), (0, -0.02, 1.2), mat("or_board", (0.55, 0.4, 0.28), tex="wood"), rot=(-0.08, 0, 0), bevel=0.01), eas)
    _kid(cyl("or_pencil", 0.02, 0.02, 0.3, (0.3, -0.12, 0.8), mat("or_yellow", (0.95, 0.78, 0.2), rough=0.6), rot=(0, math.pi / 2, 0), verts=6, bevel=0), eas)
    eas.location = (ex, ey, 0); eas.rotation_euler = (0, 0, math.radians(-35))
    # the aperture wheel by the front left: a brass disc with four holes (big hole, lens, pinhole, tiny pinhole)
    cyl("or_wheelpost", 0.07, 0.09, 1.2, (-3.2, -2.4, 0.6), wood, verts=12)
    wh = _pivot("aperture_wheel", (0, 0, 0))
    _kid(cyl("or_wheel", 0.42, 0.42, 0.05, (0, 0, 0), brass, rot=(math.pi / 2, 0, 0), verts=40), wh)
    for k, rr in enumerate((0.11, 0.08, 0.025, 0.012)):
        a = k * math.pi / 2
        _kid(cyl("or_hole", rr, rr, 0.06, (math.cos(a) * 0.26, -0.005, math.sin(a) * 0.26), mat("or_black", (0.03, 0.03, 0.03), rough=1), rot=(math.pi / 2, 0, 0), verts=16, bevel=0), wh)
    _kid(cyl("or_lensdisc", 0.075, 0.075, 0.065, (0, -0.006, 0.26), mat("ob_glass", (0.55, 0.75, 0.85), rough=0.05, metal=0.2), rot=(math.pi / 2, 0, 0), verts=16, bevel=0), wh)
    wh.location = (-3.2, -2.47, 1.3)
    box("or_pointer", (0.04, 0.04, 0.16), (-3.2, -2.5, 1.8), mat("or_red", (0.8, 0.15, 0.12), rough=0.5), bevel=0.01)
    # a dark rug
    cyl("or_rug", 1.9, 1.9, 0.02, (0, 0.4, 0.01), mat("or_rugc", (0.18, 0.2, 0.32), tex="fabric", scale=(3, 3)) if os.path.exists(f"{TEX}/fabric.png") else mat("or_rugc", (0.18, 0.2, 0.32), rough=1), verts=40, bevel=0)

ASSETS.update({"obscura": obscura, "obscuraroom": obscuraroom})

only = [a for a in sys.argv[sys.argv.index("--") + 1:] if not a.startswith("--")] if "--" in sys.argv else list(ASSETS)
only = only or list(ASSETS)
for name in only:
    reset(); _mats.clear()
    ASSETS[name]()
    export(name)
    if "--nopreview" not in sys.argv: preview(name)
