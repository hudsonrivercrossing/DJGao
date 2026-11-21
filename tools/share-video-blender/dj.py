# DJ booth, pink FM-1 (photo-textured), toy figurine and her two hands playing
# the hand events of timeline.json. Geometry follows the earlier Blender option B
# so the figurine keeps the same look. Run: node send.js common.py dj.py
C = fresh_collection("DJ")

# ---------------------------------------------------------------- booth
m_booth = principled("dj_booth", "#241a33", rough=0.35, coat=0.6)
m_trim = emitter("dj_trim", LILAC, 6.0)
m_trim_rose = emitter("dj_trim_rose", ROSE, 6.0)
BOOTH_H = 0.82
rbox("booth", (0, -0.03, BOOTH_H / 2), (1.5, 0.62, BOOTH_H), m_booth, bevel=0.03, coll=C)
rbox("booth_strip", (0, -0.342, BOOTH_H - 0.08), (1.44, 0.01, 0.025), m_trim, bevel=0.004, coll=C)
rbox("booth_strip2", (0, -0.342, 0.12), (1.44, 0.01, 0.015), m_trim_rose, bevel=0.004, coll=C)
for i in range(5):                                       # little equaliser bars on the booth front
    rbox("booth_eq", (-0.44 + i * 0.22, -0.345, 0.45), (0.12, 0.01, 0.34), emitter("dj_eq%d" % i, PALETTE[i % 4], 2.0), bevel=0.01, coll=C)

# ---------------------------------------------------------------- synth (FM-1)
# Built from the straight top-down photo site/assets/fm1-pink.webp (1800x1238): every
# part is a real solid whose top face is UV-projected from the photo, so the silk-screen,
# key labels and button legends line up with the geometry. Local frame of "fm1_root":
# x = photo right, y = photo up, z = 0 on the panel top; the root turns it 180 deg so
# the keys face her. Sizes in photo pixels (PX metres each), measured on the photo.
PX = 0.0005
DEV = (239, 224, 1561, 1014)                 # body outline
DCX, DCY = (DEV[0] + DEV[2]) / 2, (DEV[1] + DEV[3]) / 2
ST = 0.028                                   # body thickness
SYNTH_TOP = BOOTH_H + ST
SYNTH_Y = 0.02
TRAY = (288, 676, 1510, 961, 40)             # sunken key tray (x0, y0, x1, y1, corner radius)
TRAY_D = 0.007                               # tray depth below the panel
CAP_TOP = 0.0025                             # key caps stand this far above the panel
PRESS = 0.003                                # key travel
FM1 = bpy.data.collections.new("FM1")
C.children.link(FM1)

img = bpy.data.images.load(os.path.join(REPO, "site", "assets", "fm1-pink.webp"), check_existing=True)
if not img.packed_file:
    img.pack()


def photo_mat(name, rough=0.42, coat=0.35):
    """Photo as base colour plus a faint self-glow (fm1_glow) so the pink reads under club light."""
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Coat Roughness"].default_value = 0.25
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; tex.interpolation = "Cubic"
    tex.extension = "EXTEND"
    hs = nt.nodes.new("ShaderNodeHueSaturation")          # AgX greys bright pinks: push the saturation back
    hs.inputs["Saturation"].default_value = 1.45
    nt.links.new(tex.outputs["Color"], hs.inputs["Color"])
    nt.links.new(hs.outputs["Color"], p.inputs["Base Color"])
    nt.links.new(hs.outputs["Color"], p.inputs["Emission Color"])
    g = nt.nodes.new("ShaderNodeValue"); g.name = g.label = "fm1_glow"; g.outputs[0].default_value = 0.12
    nt.links.new(g.outputs[0], p.inputs["Emission Strength"])
    return m


m_photo = photo_mat("fm1_photo")
m_capside = principled("fm1_cap_side", "#6a4590", rough=0.5, coat=0.2)
m_wall = principled("fm1_tray_wall", "#3c2456", rough=0.55)
m_knob = principled("fm1_knob", "#0d0b10", rough=0.38, coat=0.4)
m_tick = principled("fm1_tick", "#f4eef4", rough=0.4, emit="#f4eef4", strength=0.3)
m_screen = principled("fm1_screen", "#030305", rough=0.22, coat=0.5)
m_bside = bpy.data.materials.get("fm1_side")
if m_bside:
    bpy.data.materials.remove(m_bside)
m_bside = bpy.data.materials.new("fm1_side")              # pink-violet gradient like the photo body
m_bside.use_nodes = True
nt = m_bside.node_tree
p = nt.nodes["Principled BSDF"]
p.inputs["Roughness"].default_value, p.inputs["Coat Weight"].default_value = 0.4, 0.35
tc = nt.nodes.new("ShaderNodeTexCoord")
sep = nt.nodes.new("ShaderNodeSeparateXYZ"); nt.links.new(tc.outputs["Object"], sep.inputs[0])
mr = nt.nodes.new("ShaderNodeMapRange"); mr.inputs["From Min"].default_value, mr.inputs["From Max"].default_value = -0.33, 0.33
nt.links.new(sep.outputs[0], mr.inputs["Value"])
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = hexrgb("#b45f9e")
ramp.color_ramp.elements[1].color = hexrgb("#5e2452")
nt.links.new(mr.outputs[0], ramp.inputs[0])
nt.links.new(ramp.outputs[0], p.inputs["Base Color"])

root = empty("fm1_root", loc=(0, SYNTH_Y, SYNTH_TOP), rot=(0, 0, math.pi), coll=FM1)


def L(px_, py_):
    """photo pixel -> fm1_root local xy"""
    return ((px_ - DCX) * PX, (DCY - py_) * PX)


def outline(cx, cy, w, h, r, seg=12):
    """Rounded rectangle (photo px, centre cx,cy) as a CCW loop of local xy points; r = w/2 gives a capsule."""
    r = min(r, w / 2, h / 2)
    pts = []
    for qx, qy, a0 in ((1, -1, -90), (1, 1, 0), (-1, 1, 90), (-1, -1, 180)):   # photo y grows down
        ccx, ccy = cx + qx * (w / 2 - r), cy - qy * (h / 2 - r)
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append(L(ccx + r * math.cos(a), ccy - r * math.sin(a)))
    clean = [pts[0]]
    for q in pts[1:]:
        if (Vector(q) - Vector(clean[-1])).length > 1e-7:
            clean.append(q)
    if (Vector(clean[0]) - Vector(clean[-1])).length < 1e-7:
        clean.pop()
    return clean


def set_uv(bm, origin=(0, 0)):
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        for lp in f.loops:
            x, y = lp.vert.co.x + origin[0], lp.vert.co.y + origin[1]
            lp[uvl].uv = ((DCX + x / PX) / 1800, 1 - (DCY - y / PX) / 1238)


def prism(name, loop, z0, z1, mats, origin=(0, 0), bevel=0.0, parent=None, hole=None, hole_z=None):
    """Extrude a loop from z0 to z1 (top face material 0, sides 1). Optional hole: a sunken
    pocket (loop) whose floor sits at hole_z (floor material 0, pocket walls material 2)."""
    bm = bmesh.new()
    top = [bm.verts.new((x - origin[0], y - origin[1], z1)) for x, y in loop]
    bot = [bm.verts.new((x - origin[0], y - origin[1], z0)) for x, y in loop]
    n = len(loop)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((bot[i], bot[j], top[j], top[i])); f.material_index = 1; f.smooth = True
    fb = bm.faces.new(list(reversed(bot))); fb.material_index = 1
    if hole is None:
        ft = bm.faces.new(top); ft.material_index = 0
    else:
        ht = [bm.verts.new((x - origin[0], y - origin[1], z1)) for x, y in hole]
        hb = [bm.verts.new((x - origin[0], y - origin[1], hole_z)) for x, y in hole]
        m = len(hole)
        for i in range(m):
            j = (i + 1) % m
            f = bm.faces.new((ht[i], ht[j], hb[j], hb[i])); f.material_index = 2
        fl = bm.faces.new(hb); fl.material_index = 0
        # ring between the outer loop and the pocket rim: bridge the two loops
        e_out = [bm.edges.get((top[i], top[(i + 1) % n])) for i in range(n)]
        e_in = [bm.edges.get((ht[i], ht[(i + 1) % m])) for i in range(m)]
        res = bmesh.ops.bridge_loops(bm, edges=e_out + e_in)
        for f in res["faces"]:
            f.material_index = 0
    bm.normal_update()
    for f in bm.faces:
        if f.material_index != 1:
            f.smooth = False
    for e in bm.edges:                                       # crisp rims, smooth round sides
        if len(e.link_faces) == 2 and e.link_faces[0].smooth != e.link_faces[1].smooth:
            e.smooth = False
    set_uv(bm, origin)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me); bm.free()
    for m_ in mats:
        me.materials.append(m_)
    o = new_obj(name, me, parent=parent or root, loc=(origin[0], origin[1], 0), coll=FM1)
    if bevel:
        b = o.modifiers.new("bev", "BEVEL")
        b.width, b.segments, b.limit_method, b.harden_normals = bevel, 2, "ANGLE", True
    return o


# body with the sunken key tray
tray = outline((TRAY[0] + TRAY[2]) / 2, (TRAY[1] + TRAY[3]) / 2, TRAY[2] - TRAY[0], TRAY[3] - TRAY[1], TRAY[4], 10)
body = prism("fm1_body", outline(DCX, DCY, DEV[2] - DEV[0] - 4, DEV[3] - DEV[1] - 4, 78, 14), -ST, 0.0,
             [m_photo, m_bside, m_wall], hole=tray, hole_z=-TRAY_D)
synth = body

# raised plates under the buttons, then the buttons themselves (photo legends on top)
prism("fm1_btn_plate", outline(1206.5, 534.5, 526, 182, 22), -0.001, 0.0016, [m_photo, m_wall], bevel=0.0008)
prism("fm1_oct_plate", outline(418.5, 593.5, 206, 64, 14), -0.001, 0.0016, [m_photo, m_wall], bevel=0.0008)
for row, by in enumerate((492, 576)):
    for i in range(6):
        bx = 1000 + i * 83
        prism("fm1_btn", outline(bx, by, 64, 66, 14, 6), 0.0, 0.0068, [m_photo, m_capside], origin=L(bx, by), bevel=0.0012)
for bx in (364, 467):
    prism("fm1_oct", outline(bx, 594, 68, 48, 11, 6), 0.0, 0.0062, [m_photo, m_capside], origin=L(bx, 594), bevel=0.0012)
# screen: glossy black glass flush in a thin bezel
prism("fm1_screen", outline(736, 438, 312, 314, 30, 8), -0.0005, 0.0006, [m_screen, m_knob], bevel=0.0004)
# eight knobs with a white pointer line
for (kx, ky), ang in zip(((342, 345), (484, 345), (342, 485), (484, 485), (983, 345), (1133, 345), (1283, 345), (1432, 345)),
                         (-150, -30, 40, -95, 10, -60, 120, -20)):
    o = prism("fm1_knob", outline(kx, ky, 54, 54, 27, 8), 0.0, 0.016, [m_knob, m_knob], origin=L(kx, ky), bevel=0.0025)
    t_ = rbox("fm1_knob_tick", (0, 0, 0.0161), (0.0026, 0.011, 0.0006), m_tick, bevel=0, coll=FM1, parent=o)
    t_.location = (0.0065 * math.sin(math.radians(ang)) * -1, 0.0065 * math.cos(math.radians(ang)), 0.0161)
    t_.rotation_euler = (0, 0, math.radians(ang))


def key_world(px_, py_, z=SYNTH_TOP):
    x, y = L(px_, py_)
    return root.matrix_world @ Vector((x, y, z - SYNTH_TOP))


bpy.context.view_layer.update()
geo = {k["midi"]: k for k in json.load(open(os.path.join(REPO, "preview", "panel-geometry.json")))}
caps, slot_mats = {}, {}
for midi, k in geo.items():
    white = k["y"] > 820
    cw, ch, cy_ = (62, 127, 886) if white else (60, 124, 754)
    cap = prism(f"cap_{midi}", outline(k["x"], cy_, cw, ch, cw / 2, 12), -TRAY_D, CAP_TOP, [m_photo, m_capside],
                origin=L(k["x"], cy_), bevel=0.0015)
    sm = principled(f"slot_{midi}", "#0b090e", rough=0.3, coat=0.0, emit=ROSE, strength=0.0)
    s = prism(f"slot_{midi}", outline(k["x"], k["y"], 8, k["height"], 4, 4), CAP_TOP - 0.0004, CAP_TOP + 0.00025,
              [sm, sm], origin=L(k["x"], k["y"]), parent=cap)
    s.location = (L(k["x"], k["y"])[0] - L(k["x"], cy_)[0], L(k["x"], k["y"])[1] - L(k["x"], cy_)[1], 0)
    caps[midi] = cap
    slot_mats[midi] = sm
bpy.context.view_layer.update()
CAP_H = CAP_TOP


def cap_top(midi):
    """Where the fingertip lands: the near end of the cap, so the glowing slot stays in view."""
    k = geo[midi]
    return key_world(k["x"], 931 if k["y"] > 820 else 795, SYNTH_TOP + CAP_TOP)


# a soft rose-white light that keeps the pink readable in the close-ups
sl = bpy.data.lights.new("fm1_soft", "AREA"); sl.shape = "DISK"; sl.size = 0.9
sl.color = lin("#ffb8de"); sl.energy = 6; sl.use_shadow = True
fm1_soft = new_obj("fm1_soft", sl, loc=(0.1, -0.05, SYNTH_TOP + 0.75), coll=FM1)


# ---------------------------------------------------------------- birthday cake on the booth (candles blown at "silence")
m_cake = principled("dj_cake", ROSE, rough=0.5, coat=0.4)
m_icing = principled("dj_icing", INK, rough=0.4, coat=0.5)
m_candle = principled("dj_candle", MINT, rough=0.4)
m_flame = emitter("dj_flame", "#ffc070", 18.0)
cyl("cake", (0.56, -0.12, BOOTH_H + 0.05), 0.11, 0.1, m_cake, coll=C)
cyl("cake_icing", (0.56, -0.12, BOOTH_H + 0.105), 0.112, 0.015, m_icing, coll=C)
flames = []
for i, a in enumerate((0.3, 2.4, 4.4)):
    x, y = 0.56 + 0.06 * math.cos(a), -0.12 + 0.06 * math.sin(a)
    cyl("candle", (x, y, BOOTH_H + 0.15), 0.008, 0.07, m_candle, seg=8, coll=C)
    fl = sphere("flame", (x, y, BOOTH_H + 0.198), (0.009, 0.009, 0.018), m_flame, seg=10, coll=C)
    flames.append(fl)
blow = F(SEC["silence"]) + 4
for fl in flames:
    for ax in range(3):
        s0 = fl.scale[ax]
        bake(fl, "scale", ax, [(1, s0), (blow - 3, s0), (blow + 2, 0.0)])

# ---------------------------------------------------------------- figurine
m_skin = principled("skin", "#f8cbbb", rough=0.5, coat=0.4)
m_hair = principled("hair", "#5e3f86", rough=0.35, coat=0.6)
m_dress = principled("dress", ROSE, rough=0.45, coat=0.5)
m_shirt = principled("shirt", LILAC, rough=0.45, coat=0.5)
m_eye = principled("eyes", "#1a1020", rough=0.2, coat=1.0)
m_blush = principled("blush", "#ff9fc4", rough=0.6, coat=0.0)
m_phones = principled("phones", INK, rough=0.3, coat=0.6)
m_mint = principled("mint", MINT, rough=0.4, coat=0.5, emit=MINT, strength=0.8)
m_shoe = principled("shoe", INK, rough=0.4)

GIRL_Y = 0.5
girl = empty("girl", loc=(0, GIRL_Y, 0), coll=C)
leg = capsule_mesh("leg", 0.045, 0.34)
for sx in (-0.07, 0.07):
    o = new_obj("leg", leg, m_skin, girl, (sx, 0, 0.4), coll=C); o.rotation_euler = (math.pi / 2, 0, 0)
    sphere("shoe", (sx, -0.02, 0.03), (0.06, 0.08, 0.04), m_shoe, girl, coll=C)
bm = bmesh.new()
bmesh.ops.create_cone(bm, cap_ends=True, segments=32, radius1=0.24, radius2=0.13, depth=0.26)
skirt = new_obj("skirt", mesh_from_bm("skirt", bm), m_dress, girl, (0, 0, 0.46), coll=C)
bv = skirt.modifiers.new("bev", "BEVEL"); bv.width, bv.segments = 0.03, 4
torso = new_obj("torso", capsule_mesh("torso", 0.14, 0.2), m_shirt, girl, (0, 0, 0.56), coll=C)
torso.rotation_euler = (-math.pi / 2, 0, 0)

upper = empty("upper", girl, (0, 0, 0.82), coll=C)
sphere("head", (0, 0, 0.36), (0.27, 0.25, 0.25), m_skin, upper, coll=C)
sphere("hair_bob", (0, 0.07, 0.40), (0.30, 0.26, 0.27), m_hair, upper, coll=C)
sphere("bangs", (0, -0.12, 0.5), (0.24, 0.12, 0.1), m_hair, upper, coll=C)
sphere("bun_l", (-0.21, 0.03, 0.6), (0.09, 0.09, 0.09), m_hair, upper, coll=C)
sphere("bun_r", (0.21, 0.03, 0.6), (0.09, 0.09, 0.09), m_hair, upper, coll=C)
for sx in (-1, 1):
    sphere("eye", (sx * 0.085, -0.235, 0.35), (0.028, 0.012, 0.038), m_eye, upper, 16, coll=C)
    sphere("eye_hi", (sx * 0.085 + 0.01, -0.246, 0.365), (0.008, 0.004, 0.01), m_phones, upper, 12, coll=C)
    sphere("blush", (sx * 0.15, -0.2, 0.29), (0.04, 0.012, 0.022), m_blush, upper, 16, coll=C)
    sphere("sleeve", (sx * 0.15, -0.02, 0.05), (0.07, 0.07, 0.06), m_shirt, upper, coll=C)
sphere("mouth", (0, -0.245, 0.27), (0.025, 0.01, 0.012), m_eye, upper, 16, coll=C)
cu = bpy.data.curves.new("band", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.02; cu.bevel_resolution = 3
sp = cu.splines.new("POLY"); arc = [(0.3 * math.cos(a), 0.3 * math.sin(a)) for a in [i * math.pi / 32 for i in range(33)]]
sp.points.add(len(arc) - 1)
for pt, (x, z) in zip(sp.points, arc):
    pt.co = (x, 0, z, 1)
new_obj("band", cu, m_phones, upper, (0, 0.03, 0.38), coll=C)
for sx in (-1, 1):
    cup = new_obj("cup", capsule_mesh("cup", 0.07, 0.04), m_mint, upper, (sx * 0.30, 0.03, 0.36), coll=C)
    cup.rotation_euler = (0, 0, sx * math.pi / 2)

# ---------------------------------------------------------------- hands
FINGERS = [   # name, x, knuckle y, (three phalanx lengths), radius, (three curls in degrees)
    ("index", 0.022, -0.062, (0.027, 0.019, 0.016), 0.0085, (18, 12, 10)),
    ("middle", 0.007, -0.065, (0.030, 0.021, 0.017), 0.0088, (52, 48, 38)),
    ("ring", -0.008, -0.063, (0.028, 0.020, 0.016), 0.0084, (58, 52, 38)),
    ("pinky", -0.022, -0.058, (0.022, 0.016, 0.013), 0.0075, (64, 54, 38)),
]
BASE_PITCH = math.radians(35)
m_nail = principled("nail", "#ffc4cf", rough=0.25, coat=0.8)
m_knuckle = principled("knuckle", "#f0b7a6", rough=0.5, coat=0.3)


def finger(name, parent, loc, rot, lens, curls, r):
    """Three phalanges with a knuckle bump at every joint and a glossy nail; returns the tip empty."""
    j = empty(name + "0", parent, loc, rot, coll=C)
    for i, (ln, cu) in enumerate(zip(lens, curls)):
        if i:
            j = empty(f"{name}{i}", j, (0, -lens[i - 1], 0), (math.radians(cu), 0, 0), coll=C)
        rr = r * (1.0 - 0.07 * i)
        new_obj(f"{name}_seg{i}", capsule_mesh("seg", rr, ln, 12), m_skin, j, coll=C)
        sphere(f"{name}_knuckle{i}", (0, 0, rr * 0.25), (rr * 1.12, rr * 1.05, rr * 1.0), m_knuckle, j, 10, coll=C)
    sphere(name + "_nail", (0, -lens[-1] * 0.72, r * 0.72), (r * 0.72, r * 0.95, r * 0.28), m_nail, j, 10, coll=C)
    return empty(name + "_tip", j, (0, -lens[-1], 0), coll=C)


def make_hand(name, side):
    root = empty(name, coll=C)
    new_obj(name + "_palm", rounded_box_mesh("palm", 0.034, 0.037, 0.012), m_skin, root, (0, -0.033, 0.002), coll=C)
    sphere(name + "_wrist", (0, 0, 0), (0.021, 0.021, 0.019), m_skin, root, coll=C)
    tips = {}
    for fname, x, ky, lens, r, curls in FINGERS:
        tips[fname] = finger(f"{name}_{fname}", root, (side * x, ky, 0), (math.radians(curls[0]), 0, 0), lens, (0,) + curls[1:], r)
    tips["thumb"] = finger(name + "_thumb", root, (side * 0.032, -0.02, -0.006), (math.radians(25), 0, -side * math.radians(38)),
                           (0.022, 0.017, 0.014), (0, 22, 12), 0.0096)
    bpy.context.view_layer.update()
    return root, tips["index"].matrix_world.translation.copy()


hand_r, TIP_R = make_hand("hand_r", +1)
hand_l, TIP_L = make_hand("hand_l", -1)
TIP_RADIUS = 0.0085 * 0.95
SHOULDER = {+1: Vector((-0.15, GIRL_Y - 0.03, 0.88)), -1: Vector((0.15, GIRL_Y - 0.03, 0.88))}
arm_me = tube_mesh("arm", 0.033, 0.02)
for side, hand in ((+1, hand_r), (-1, hand_l)):
    arm = new_obj("arm", arm_me, m_skin, upper, SHOULDER[side] - Vector((0, GIRL_Y, 0.82)), coll=C)
    c = arm.constraints.new("STRETCH_TO")
    c.target, c.rest_length, c.volume = hand, 1.0, "NO_VOLUME"


def animate_hand(hand, tip_local, side, strikes, neutral_x):
    """strikes: (f_on, dur_f, key, press). Bakes wrist loc/rot so the index tip lands on keys."""
    poses = []

    def tip_at(key, dz):
        return cap_top(key) + Vector((0, 0, TIP_RADIUS + dz))

    poses.append((1, tip_at(strikes[0][2], 0.05), -0.12))
    for i, (f_on, dur, key, press) in enumerate(strikes):
        down = -PRESS if press else 0.0
        hold = f_on + max(1.0, min(dur * 0.6, dur - 2.0))
        poses.append((f_on, tip_at(key, down), 0.05))
        if hold - f_on > 2.2:
            poses.append((f_on + 1.4, tip_at(key, down - 0.0006), 0.07))
        poses.append((hold, tip_at(key, down), 0.05))
        nxt = strikes[i + 1] if i + 1 < len(strikes) else None
        if nxt is None:
            poses.append((hold + 8, tip_at(key, 0.04), -0.1))
            continue
        q, p0 = tip_at(nxt[2], 0), tip_at(key, 0)
        dist = (q - p0).length
        pre = nxt[0] - 1.1
        gap = pre - hold
        if gap < 0.6:
            continue
        poses.append((hold + min(0.9, gap * 0.3), tip_at(key, 0.004), 0.0))
        if gap > 2.0:
            lift = 0.006 + 0.45 * dist + (0.01 if gap > 15 else 0)
            mid = (p0 + q) / 2 + Vector((0, 0.004, lift))
            poses.append(((hold + pre) / 2 + 0.3, mid, -0.05 - 2.0 * lift))
        poses.append((pre, q + Vector((0, 0, 0.0045)), 0.0))
    keys = {i: [] for i in range(6)}
    for f, tip, dp in sorted(poses, key=lambda p: p[0]):
        d = tip - SHOULDER[side]
        yaw = 0.55 * math.atan2(d.x, -d.y)
        roll = max(-0.16, min(0.16, -1.2 * (tip.x - neutral_x))) * side
        rot = Euler((BASE_PITCH + dp, roll, yaw), "XYZ")
        loc = tip - rot.to_matrix() @ tip_local
        for i in range(3):
            keys[i].append((f, loc[i]))
            keys[3 + i].append((f, rot[i]))
    for i in range(3):
        bake(hand, "location", i, keys[i])
        bake(hand, "rotation_euler", i, keys[3 + i])


def strikes_for(parts, pick):
    evs = sorted((e for e in EVENTS if e.get("hand") and e["part"] in parts), key=lambda e: e["t"])
    out = []
    for e in evs:
        f = F(e["t"])
        dur = max(2.0, e.get("len", 0.15) * FPS)
        if out and f - out[-1][0] < 1.0:                  # chord / layered note: keep one key
            if pick(e["key"], out[-1][2]) == e["key"]:
                out[-1] = (out[-1][0], max(dur, out[-1][1]), e["key"], True)
            continue
        out.append((f, dur, e["key"], True))
    return out


r_strikes = strikes_for(("lead",), max)
l_strikes = strikes_for(("bass", "drums", "sfx"), min)
# 83.4-84.6 s (her close-up): both hands rest on a held chord instead of travelling between notes
HOLD = (F(83.4), F(84.6))
r_strikes = [x for x in r_strikes if not HOLD[0] - 4 <= x[0] <= HOLD[1]] + [(HOLD[0], HOLD[1] - HOLD[0], 72, True)]
l_strikes = [x for x in l_strikes if not HOLD[0] - 4 <= x[0] <= HOLD[1]] + [(HOLD[0], HOLD[1] - HOLD[0], 60, True)]
r_strikes.sort(); l_strikes.sort()
animate_hand(hand_r, TIP_R, +1, r_strikes, -0.15)
animate_hand(hand_l, TIP_L, -1, l_strikes, 0.18)

key_presses = {m: [] for m in geo}
for f, d, key, press in r_strikes + l_strikes:
    key_presses[key].append((f, f + max(1.0, min(d * 0.6, d - 2.0))))
for midi, presses in key_presses.items():
    if not presses:
        continue
    presses.sort()
    z0 = caps[midi].location.z
    zk, gk = [(1, z0)], [(1, 0.0)]
    for i, (on, off) in enumerate(presses):
        nxt = presses[i + 1][0] if i + 1 < len(presses) else 1e9
        zk += [(on - 0.7, z0), (on, z0 - PRESS), (off, z0 - PRESS), (min(off + 4.0, nxt - 0.7), z0)]
        gk += [(on - 0.5, 0.0), (on + 0.3, 14.0), (off, 9.0), (min(off + 6.0, nxt - 0.6), 0.0)]
    bake(caps[midi], "location", 2, zk)
    node = slot_mats[midi].node_tree.nodes["Principled BSDF"]
    bake(slot_mats[midi].node_tree, socket_path(node, "Emission Strength"), 0, gk)

# body: gentle sway in the music box, groove on every kick after
lz, rx, rz = [], [], []
t = 0.3
while t < SEC["house-intro"]:
    i = int(t / 1.25)
    lz += [(F(t), 0.82 - 0.005), (F(t + 0.62), 0.82 + 0.003)]
    rz += [(F(t), math.radians(1.5 * (1 if i % 2 else -1)))]
    t += 1.25
for i, k in enumerate(KICKS):
    sec = section_at(k)
    amp = 0.0 if sec in ("silence",) else (0.022 if sec in ("drop", "machine-gun", "encore-key-1", "encore-key-2", "encore-key-3", "encore-key-4") else 0.014)
    lz += [(F(k), 0.82 - amp), (F(k) + 7, 0.82 + amp * 0.4)]
    rx += [(F(k), math.radians(3)), (F(k) + 7, 0)]
    rz += [(F(k), math.radians(3 * (1 if i % 2 else -1)))]
bake(upper, "location", 2, lz)
bake(upper, "rotation_euler", 0, rx or [(1, 0)])
bake(upper, "rotation_euler", 2, rz)
print("dj ok:", len(r_strikes), "right strikes,", len(l_strikes), "left strikes")
