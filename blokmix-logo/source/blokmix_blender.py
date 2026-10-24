"""Blokmix app icons in Blender 4.0 (Cycles). Run:
blender -b -P blokmix_blender.py -- OUT_DIR [key ...] [--samples N]
1 Blender unit = 100 px on a 1024 px icon. Camera is orthographic, looking straight down.
"""
import bpy, bmesh, math, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
OUT = argv[0]
SAMPLES = 128
keys = []
i = 1
while i < len(argv):
    if argv[i] == "--samples":
        SAMPLES = int(argv[i + 1]); i += 2
    else:
        keys.append(argv[i]); i += 1
os.makedirs(OUT, exist_ok=True)

# ---------------------------------------------------------------- helpers
def lin(h):
    h = h.lstrip("#")
    c = [int(h[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple((v / 12.92) if v <= 0.04045 else ((v + 0.055) / 1.055) ** 2.4 for v in c) + (1.0,)

def P(x, y):
    """pixel coords on the 1024 icon -> world XY"""
    return (x / 100 - 5.12, 5.12 - y / 100)

def mat(name, color, rough=0.5, metal=0.0, coat=0.0, sss=0.0, trans=0.0, sheen=0.0, ior=1.45, emit=0.0, spec=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = lin(color)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Specular IOR Level"].default_value = spec
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.08
    b.inputs["Subsurface Weight"].default_value = sss
    if sss:
        b.inputs["Subsurface Radius"].default_value = (0.6, 0.3, 0.4)
        b.inputs["Subsurface Scale"].default_value = 0.4
    b.inputs["Transmission Weight"].default_value = trans
    b.inputs["Sheen Weight"].default_value = sheen
    b.inputs["IOR"].default_value = ior
    if emit:
        b.inputs["Emission Color"].default_value = lin(color)
        b.inputs["Emission Strength"].default_value = emit
    return m

def outline_rrect(w, h, r, seg=14):
    r = min(r, w / 2, h / 2)
    pts = []
    for cx, cy, a0 in ((w/2 - r, h/2 - r, 0), (-w/2 + r, h/2 - r, 90), (-w/2 + r, -h/2 + r, 180), (w/2 - r, -h/2 + r, 270)):
        for k in range(seg + 1):
            a = math.radians(a0 + 90 * k / seg)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    return pts

def outline_squircle(a=5.12, n=5.0, count=360):
    pts = []
    for k in range(count):
        t = 2 * math.pi * k / count
        c, s = math.cos(t), math.sin(t)
        pts.append((a * math.copysign(abs(c) ** (2 / n), c), a * math.copysign(abs(s) ** (2 / n), s)))
    return pts

def prism(name, pts, z0, z1, material, bevel=0.0, seg=5, loc=(0, 0), rot=(0, 0, 0)):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    verts = [bm.verts.new((x, y, z0)) for x, y in pts]
    face = bm.faces.new(verts)
    if face.normal.z < 0:
        face.normal_flip()
    ext = bmesh.ops.extrude_face_region(bm, geom=[face])
    for v in ext["geom"]:
        if isinstance(v, bmesh.types.BMVert):
            v.co.z = z1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    ob.location = (loc[0], loc[1], 0)
    ob.rotation_euler = tuple(math.radians(v) for v in rot)
    ob.data.materials.append(material)
    if bevel:
        m = ob.modifiers.new("bevel", "BEVEL")
        m.width = bevel; m.segments = seg; m.limit_method = "ANGLE"; m.angle_limit = math.radians(40)
        m.harden_normals = False
    for p in me.polygons:
        p.use_smooth = True
    me.use_auto_smooth = True
    me.auto_smooth_angle = math.radians(35)
    return ob

def rbox(name, cx, cy, w, h, r, z0, z1, material, bevel=0.06, rot=(0, 0, 0)):
    """rounded box centred on pixel (cx, cy), sizes in px, z in units"""
    x, y = P(cx, cy)
    return prism(name, outline_rrect(w / 100, h / 100, r / 100), z0, z1, material, bevel, loc=(x, y), rot=rot)

def cut(target, cutter):
    m = target.modifiers.new("cut", "BOOLEAN")
    m.operation = "DIFFERENCE"; m.solver = "EXACT"; m.object = cutter
    cutter.hide_render = True; cutter.display_type = "WIRE"
    # keep the tile's bevel above the boolean so the slot edge stays crisp
    return m

def disc(name, cx, cy, r, z0, z1, material):
    x, y = P(cx, cy)
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r / 100, depth=z1 - z0, location=(x, y, (z0 + z1) / 2))
    ob = bpy.context.active_object; ob.name = name
    ob.data.materials.append(material)
    return ob

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    prefs = bpy.context.preferences.addons["cycles"].preferences
    prefs.compute_device_type = "METAL"; prefs.get_devices()
    for d in prefs.devices:
        d.use = True
    sc.cycles.device = "GPU"
    sc.cycles.samples = SAMPLES
    sc.cycles.use_denoising = True
    sc.render.resolution_x = sc.render.resolution_y = 1024
    sc.render.film_transparent = True
    sc.view_settings.view_transform = "Standard"
    sc.view_settings.look = "None"
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGBA"
    cam = bpy.data.cameras.new("cam"); cam.type = "ORTHO"; cam.ortho_scale = 10.24
    co = bpy.data.objects.new("cam", cam); sc.collection.objects.link(co)
    co.location = (0, 0, 40); sc.camera = co
    return sc

def lights(sc, dark=False, ambient=0.32):
    w = bpy.data.worlds.new("w"); sc.world = w; w.use_nodes = True
    bg = w.node_tree.nodes["Background"]
    bg.inputs[0].default_value = (1, 1, 1, 1)
    bg.inputs[1].default_value = ambient * (0.18 if dark else 1.0)
    sun = bpy.data.lights.new("key", "SUN"); sun.energy = 2.1 if not dark else 2.6; sun.angle = math.radians(14)
    so = bpy.data.objects.new("key", sun); sc.collection.objects.link(so)
    so.rotation_euler = (math.radians(-34), math.radians(-24), 0)
    # soft top-left area light for glossy highlights
    ar = bpy.data.lights.new("spec", "AREA"); ar.energy = 380 if not dark else 760; ar.size = 7
    ao = bpy.data.objects.new("spec", ar); sc.collection.objects.link(ao)
    ao.location = (-7, 9, 16)
    ao.rotation_euler = Vector((7, -9, -16)).to_track_quat("-Z", "Y").to_euler()

def tile(material, bevel=0.14):
    return prism("tile", outline_squircle(), -0.5, 0.0, material, bevel=bevel, seg=6)

# ---------------------------------------------------------------- palette
PINK = "#FF5CB0"
def pink_plastic(): return mat("pink", PINK, rough=0.32, coat=1.0)
def pink_enamel(): return mat("enamel", "#FF4FA8", rough=0.18, coat=1.0)
def metal(): return mat("metal", "#D9D3D8", rough=0.22, metal=1.0)

# ---------------------------------------------------------------- icons
def grab(dark=False):
    sc = reset(); lights(sc, dark)
    base = mat("tile", "#1A1320" if dark else "#F1EBEE", rough=0.9 if dark else 0.5, spec=0.12 if dark else 0.5)
    dotm = mat("dot", "#3E3245" if dark else "#CFC4CC", rough=0.8, spec=0.2)
    slotm = mat("slotfloor", "#0B080D" if dark else "#D8CED5", rough=0.9, spec=0.1 if dark else 0.5)
    t = tile(base)
    cutter = rbox("slotcut", 384, 648, 352, 352, 66, -0.34, 0.5, base, bevel=0)
    cut(t, cutter)
    rbox("slotfloor", 384, 648, 352, 352, 66, -0.36, -0.30, slotm, bevel=0)
    for i in range(14):
        for j in range(14):
            px, py = 96 + i * 64, 96 + j * 64
            if 196 < px < 572 and 460 < py < 836:
                continue
            disc(f"d{i}_{j}", px, py, 7, -0.01, 0.006, dotm)
    rbox("block", 600, 458, 392, 392, 74, 0.0, 0.62, pink_plastic(), bevel=0.13, rot=(7, -6, -9)).location.z = 0.95
    return sc

def zipper():
    sc = reset(); lights(sc, False)
    under = mat("under", "#120D15", rough=0.8)
    paper = mat("paperfab", "#F3EDF0", rough=0.85, sheen=0.6)
    pinkf = mat("pinkfab", "#FF58AA", rough=0.75, sheen=0.7)
    met = metal()
    tile(under)
    sy = 520
    def seam(ypx, side):
        o = max(0, ypx - sy - 60) * 0.30
        return 512 - o if side < 0 else 512 + o
    # each fabric is a big panel bounded by its seam, then intersected with the tile shape
    def fabric(side, m):
        ys = [5.6 - k * 0.16 for k in range(72)]                     # top to bottom, world y
        seam_line = [(P(seam((5.12 - y) * 100, side), 0)[0], y) for y in ys]
        if side < 0:
            pts = [(-6, ys[0])] + seam_line + [(-6, ys[-1])]
        else:
            pts = seam_line + [(6, ys[-1]), (6, ys[0])]
        ob = prism(f"fab{side}", pts, 0.0, 0.10, m, bevel=0.05)
        clip = prism(f"clip{side}", outline_squircle(5.12), -1, 1, m, bevel=0)
        b = ob.modifiers.new("clip", "BOOLEAN"); b.operation = "INTERSECT"; b.solver = "EXACT"; b.object = clip
        clip.hide_render = True
        return ob
    fabric(-1, paper); fabric(1, pinkf)
    step = 40
    for y in range(-10, 1030, step):
        for side in (-1, 1):
            ty = y + (0 if side < 0 else step / 2)
            closed = ty < sy + 60
            ex = seam(ty, side)
            if side < 0:
                x0 = 470 if closed else ex - 44
            else:
                x0 = 490 if closed else ex - 20
            rbox(f"t{y}{side}", x0 + 32, ty + 12, 64, 24, 9, 0.06, 0.2, met, bevel=0.03)
    # slider: trapezoid body
    sl = [P(432, sy - 150), P(592, sy - 150), P(562, sy + 40), P(462, sy + 40)]
    body = prism("slider", [(x, y) for x, y in sl], 0.1, 0.42, met, bevel=0.07)
    # pull tab, lying on the pink side, with a hole
    pull = rbox("pull", 512, sy + 156, 112, 300, 42, 0.0, 0.14, pink_enamel(), bevel=0.05, rot=(0, 0, -14))
    pull.location.z = 0.42
    hole = rbox("hole", 512, sy + 50, 68, 40, 20, -1, 2, met, bevel=0, rot=(0, 0, -14))
    cut(pull, hole)
    return sc

def pinboard(dark=False):
    sc = reset(); lights(sc, dark)
    base = mat("board", "#1A1320" if dark else "#EEE7EB", rough=0.9 if dark else 0.55, spec=0.12 if dark else 0.5)
    holem = mat("hole", "#000000" if dark else "#9D919A", rough=1.0, spec=0.0)
    card = mat("card", "#FFFFFF", rough=0.35)
    bar1 = mat("bar1", "#C6BBC3", rough=0.5)
    bar2 = mat("bar2", "#E2D9DF", rough=0.5)
    white = mat("white", "#FFFFFF", rough=0.3)
    tile(base)
    for i in range(11):
        for j in range(11):
            disc(f"h{i}_{j}", 112 + i * 80, 112 + j * 80, 11, -0.02, 0.004, holem)
    def c(x, y, w, h, bars, mcard, z=0.02, rot=(0, 0, 0), thick=0.18, lift=0.0):
        ob = rbox("card", x + w / 2, y + h / 2, w, h, 34, z, z + thick, mcard, bevel=0.06)
        bpy.context.view_layer.update()
        for k, (bx, by, bw, bh, m) in enumerate(bars):
            b = rbox(f"bar{k}", x + bx + bw / 2, y + by + bh / 2, bw, bh, bh / 2, z + thick, z + thick + 0.025, m, bevel=0.01)
            bpy.context.view_layer.update()
            b.parent = ob
            b.matrix_parent_inverse = ob.matrix_world.inverted()
        # tilt and lift the card; its bars ride along
        ob.rotation_euler = tuple(math.radians(v) for v in rot)
        ob.location.z = lift
        return ob
    c(196, 168, 520, 200, [(40, 44, 260, 34, bar1), (40, 98, 380, 20, bar2), (40, 132, 300, 20, bar2)], card)
    c(196, 664, 520, 200, [(40, 40, 160, 120, bar2), (224, 40, 120, 120, bar2), (366, 40, 114, 120, bar2)], card)
    c(330, 420, 560, 220, [(42, 44, 240, 36, white), (42, 102, 380, 22, white), (42, 140, 300, 22, white)],
      pink_plastic(), rot=(8, -5, -7), thick=0.22, lift=0.75)
    return sc

def gummy():
    sc = reset(); lights(sc, True, ambient=0.7)
    base = mat("tile", "#120D15", rough=0.6)
    milk = mat("milk", "#F7F1F4", rough=0.25, sss=0.85, coat=0.6)
    jelly = mat("jelly", "#FF4FA8", rough=0.12, sss=0.5, trans=0.45, coat=1.0, ior=1.4)
    tile(base)
    a = rbox("milk", 380, 520, 408, 408, 130, 0.0, 1.1, milk, bevel=0.42, rot=(6, -10, 7)); a.location.z = 0.3
    b = rbox("jelly", 640, 500, 408, 408, 130, 0.0, 1.1, jelly, bevel=0.42, rot=(-6, 10, -7)); b.location.z = 0.45
    for ob in (a, b):
        s = ob.modifiers.new("smooth", "SUBSURF"); s.levels = 2; s.render_levels = 2
    return sc

ICONS = {"grab": lambda: grab(False), "grab-dark": lambda: grab(True), "zip": zipper,
         "pinboard": lambda: pinboard(False), "pinboard-dark": lambda: pinboard(True), "gummy": gummy}
for k in (keys or ICONS.keys()):
    sc = ICONS[k]()
    sc.render.filepath = os.path.join(OUT, f"{k}.png")
    bpy.ops.render.render(write_still=True)
    print("RENDERED", k, flush=True)
