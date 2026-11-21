# Venue: open-roof club hall, stage, LED wall, bar, balcony, truss, speakers,
# festoon lights, neon signs and the end title. Run: node send.js common.py scene.py
# (the PolyHaven sky/floor/wall materials are applied afterwards by the skills' scripts,
# see polyhaven.sh).

# remove the factory-startup cube/light/camera only
for n, kind in (("Cube", "MESH"), ("Light", "LIGHT"), ("Camera", "CAMERA")):
    o = bpy.data.objects.get(n)
    if o and o.type == kind:
        bpy.data.objects.remove(o, do_unlink=True)

scene.render.fps = FPS
scene.frame_start, scene.frame_end = 1, END_F
C = fresh_collection("Venue")

FLOOR_Z = -0.9
m_stage = principled("v_stage", "#0e0a14", rough=0.35, coat=0.5)
m_dark = principled("v_dark", "#0f0b16", rough=0.5, coat=0.1)
m_metal = principled("v_truss", "#3a3446", rough=0.35, metal=0.8)
m_trim_rose = emitter("v_trim_rose", ROSE, 6.0)
m_trim_lilac = emitter("v_trim_lilac", LILAC, 6.0)
m_trim_mint = emitter("v_trim_mint", MINT, 6.0)
m_trim_gold = emitter("v_trim_gold", GOLD, 5.0)

# ------------------------------------------------------------------ shell
stage = rbox("StageDeck", (0, 1.75, FLOOR_Z / 2), (13.0, 4.9, -FLOOR_Z), m_stage, bevel=0.03, coll=C)
rbox("stage_lip_rose", (0, -0.71, -0.03), (13.0, 0.04, 0.05), m_trim_rose, bevel=0.01, coll=C)
rbox("stage_lip_lilac", (0, -0.71, FLOOR_Z + 0.12), (13.0, 0.04, 0.04), m_trim_lilac, bevel=0.01, coll=C)

bm = bmesh.new()
for loc, size in (((0, 4.45, 2.8), (19.6, 0.3, 7.4)),          # back wall behind stage
                  ((-9.65, -6.1, 2.8), (0.3, 21.4, 7.4)),       # left wall
                  ((9.65, -6.1, 2.8), (0.3, 21.4, 7.4)),        # right wall
                  ((0, -16.65, 2.8), (19.6, 0.3, 7.4))):        # rear wall
    tmp = bmesh.new()
    bmesh.ops.create_cube(tmp, size=1)
    bmesh.ops.scale(tmp, vec=size, verts=tmp.verts)
    bmesh.ops.translate(tmp, vec=loc, verts=tmp.verts)
    me = bpy.data.meshes.new("tmp"); tmp.to_mesh(me); tmp.free()
    bm.from_mesh(me); bpy.data.meshes.remove(me)
walls = new_obj("ClubWalls", mesh_from_bm("ClubWalls", bm, False), principled("v_wall_tmp", "#2a1f33"), coll=C)
box_uv_world(walls.data, 1 / 2.5)

bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
bmesh.ops.scale(bm, vec=(19.0, 16.0, 1), verts=bm.verts)
floor = new_obj("DanceFloor", mesh_from_bm("DanceFloor", bm, False), principled("v_floor_tmp", "#140f1c"),
                loc=(0, -8.65, FLOOR_Z), coll=C)
box_uv_world(floor.data, 1 / 3.0)

# ------------------------------------------------------------------ crowd barrier (the front row leans on it)
m_barrier = principled("v_barrier", "#cfc6dc", rough=0.3, metal=0.8)
rbox("barrier_rail", (0, -1.27, FLOOR_Z + 0.47), (12.8, 0.06, 0.05), m_barrier, bevel=0.015, coll=C)
rbox("barrier_panel", (0, -1.25, FLOOR_Z + 0.24), (12.8, 0.02, 0.4), principled("v_barrier_panel", "#2a2236", rough=0.5), bevel=0.005, coll=C)
for i in range(17):
    rbox("barrier_post", (-6.4 + i * 0.8, -1.27, FLOOR_Z + 0.24), (0.04, 0.05, 0.48), m_barrier, bevel=0.01, coll=C)

# ------------------------------------------------------------------ bar (left wall)
m_bar = principled("v_bar", "#2b1d35", rough=0.3, coat=0.8)
m_bar_top = principled("v_bar_top", "#3b2a4a", rough=0.15, coat=1.0)
rbox("bar_counter", (-7.75, -7.5, FLOOR_Z + 0.55), (1.0, 7.0, 1.1), m_bar, bevel=0.04, coll=C)
rbox("bar_top", (-7.75, -7.5, FLOOR_Z + 1.13), (1.25, 7.2, 0.07), m_bar_top, bevel=0.02, coll=C)
rbox("bar_strip", (-7.23, -7.5, FLOOR_Z + 0.95), (0.03, 6.9, 0.05), m_trim_mint, bevel=0.01, coll=C)
rbox("bar_strip2", (-7.23, -7.5, FLOOR_Z + 0.12), (0.03, 6.9, 0.04), m_trim_rose, bevel=0.01, coll=C)
rbox("bar_backlight", (-9.45, -7.5, FLOOR_Z + 2.3), (0.05, 6.4, 1.9), emitter("v_bar_back", "#3a2340", 2.5), bevel=0, coll=C)
m_shelf = principled("v_shelf", "#20162a", rough=0.4)
bottle_mats = [emitter("v_bottle_" + c, c, 4.0) for c in (ROSE, MINT, GOLD, LILAC)]
random.seed(11)
bottle_me = {}
for i, m in enumerate(bottle_mats):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=10, radius1=0.055, radius2=0.055, depth=0.24)
    bmesh.ops.translate(bm, vec=(0, 0, 0.12), verts=bm.verts)
    neck = bmesh.new()
    bmesh.ops.create_cone(neck, cap_ends=True, segments=8, radius1=0.022, radius2=0.018, depth=0.1)
    bmesh.ops.translate(neck, vec=(0, 0, 0.29), verts=neck.verts)
    me2 = bpy.data.meshes.new("n"); neck.to_mesh(me2); neck.free(); bm.from_mesh(me2); bpy.data.meshes.remove(me2)
    bottle_me[i] = mesh_from_bm("bottle%d" % i, bm)
    bottle_me[i].materials.append(m)
for s, z in enumerate((1.55, 2.15, 2.75)):
    rbox("shelf%d" % s, (-9.3, -7.5, FLOOR_Z + z), (0.3, 6.2, 0.04), m_shelf, bevel=0.005, coll=C)
    y = -10.4
    while y < -4.6:
        new_obj("bottle", bottle_me[random.randrange(4)], loc=(-9.3 + random.uniform(-0.05, 0.05), y, FLOOR_Z + z + 0.02), coll=C)
        y += random.uniform(0.16, 0.3)
m_stool = principled("v_stool", "#4a3a5e", rough=0.3, coat=0.6)
for i in range(7):
    y = -10.4 + i * 0.95
    cyl("stool_seat", (-6.85, y, FLOOR_Z + 0.75), 0.2, 0.08, m_stool, coll=C)
    cyl("stool_leg", (-6.85, y, FLOOR_Z + 0.37), 0.03, 0.74, m_metal, seg=8, coll=C)

# ------------------------------------------------------------------ balcony (rear)
BAL_Z = 2.3
rbox("balcony_slab", (0, -14.95, BAL_Z - 0.15), (19.0, 3.4, 0.3), m_dark, bevel=0.02, coll=C)
rbox("balcony_glass", (0, -13.27, BAL_Z + 0.45), (18.8, 0.04, 0.9), principled("v_glass", "#2a2038", rough=0.1, coat=1.0), bevel=0.005, coll=C)
rbox("balcony_rail", (0, -13.27, BAL_Z + 0.92), (18.9, 0.08, 0.05), m_trim_rose, bevel=0.01, coll=C)
rbox("balcony_under", (0, -13.27, BAL_Z - 0.32), (18.9, 0.05, 0.04), m_trim_lilac, bevel=0.01, coll=C)
for x in (-7.5, -2.5, 2.5, 7.5):
    cyl("balcony_col", (x, -13.6, (FLOOR_Z + BAL_Z) / 2), 0.14, BAL_Z - FLOOR_Z, m_dark, coll=C)

# ------------------------------------------------------------------ truss + speakers
def truss_beam(name, a, b, r=0.05):
    a, b = Vector(a), Vector(b)
    d = b - a
    o = cyl(name, (a + b) / 2, r, d.length, m_metal, seg=8, coll=C)
    o.rotation_euler = d.to_track_quat("Z", "Y").to_euler()
    return o


TRUSS_Z, TRUSS_Y = 5.3, -0.45
for dz in (0, 0.45):
    for dy in (0, 0.45):
        truss_beam("truss_front", (-7.2, TRUSS_Y + dy, TRUSS_Z + dz), (7.2, TRUSS_Y + dy, TRUSS_Z + dz))
        truss_beam("truss_back", (-7.2, 3.3 + dy, TRUSS_Z + 0.4 + dz), (7.2, 3.3 + dy, TRUSS_Z + 0.4 + dz))
        for sx in (-7.0, 7.0):
            truss_beam("truss_tower", (sx + dy, TRUSS_Y + dz, FLOOR_Z), (sx + dy, TRUSS_Y + dz, TRUSS_Z + 0.45))
x = -7.2
while x < 7.2:
    truss_beam("truss_x", (x, TRUSS_Y, TRUSS_Z), (x + 0.45, TRUSS_Y + 0.45, TRUSS_Z + 0.45), 0.025)
    x += 0.45

m_spk = principled("v_speaker", "#141019", rough=0.6)
m_cone = principled("v_cone", "#26202e", rough=0.35, coat=0.4)
for sx in (-1, 1):
    for k in range(2):
        z0 = FLOOR_Z + k * 1.25
        rbox("speaker", (sx * 8.1, -0.3, z0 + 0.6), (1.2, 0.9, 1.2), m_spk, bevel=0.03, coll=C)
        for cz, r in ((0.28, 0.32), (0.86, 0.16)):
            c = cyl("cone", (sx * 8.1, -0.76, z0 + cz + 0.02), r, 0.04, m_cone, coll=C, rot=(math.pi / 2, 0, 0))
    rbox("speaker_led", (sx * 8.1, -0.77, FLOOR_Z + 2.52), (1.1, 0.02, 0.04), m_trim_lilac, bevel=0.005, coll=C)

# ------------------------------------------------------------------ LED wall
GW, GH = 128, 64
WALL_W, WALL_H = 9.2, 4.6
WALL_Y, WALL_Z0 = 2.6, 0.35
GLYPHS = {
    "D": ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
    "J": ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
    "G": ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
}
CAKE = [
    "....y...y...y....",
    "....o...o...o....",
    "....w...w...w....",
    "..ppppppppppppp..",
    "..pwpwpwpwpwpwp..",
    "..ppppppppppppp..",
    ".lllllllllllllll.",
    ".lmlllmlllmlllml.",
    ".lllllllllllllll.",
    "ppppppppppppppppp",
    "pwwpwwpwwpwwpwwpp",
    "ppppppppppppppppp",
]
HEART = [".rr.rr.", "rrrrrrr", "rrrrrrr", ".rrrrr.", "..rrr..", "...r..."]
pal = {"y": lin(GOLD), "o": lin("#ffb36b"), "w": lin(INK), "p": lin(ROSE), "l": lin(LILAC), "m": lin(MINT), "r": lin(ROSE)}


class Canvas:
    def __init__(self):
        self.px = [[(0, 0, 0)] * GW for _ in range(GH)]

    def put(self, c, r, col):
        if 0 <= c < GW and 0 <= r < GH:
            self.px[r][c] = col

    def text(self, s, c0, r0, scale, col):
        c = c0
        for ch in s:
            if ch == " ":
                c += 4 * scale
                continue
            for r, row in enumerate(GLYPHS[ch]):
                for i, bit in enumerate(row):
                    if bit == "1":
                        for dy in range(scale):
                            for dx in range(scale):
                                self.put(c + i * scale + dx, r0 + r * scale + dy, col)
            c += 6 * scale

    def bitmap(self, rows, c0, r0, scale=1):
        for r, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch != ".":
                    for dy in range(scale):
                        for dx in range(scale):
                            self.put(c0 + i * scale + dx, r0 + r * scale + dy, pal[ch])

    def image(self, name):
        old = bpy.data.images.get(name)
        if old:
            bpy.data.images.remove(old)
        im = bpy.data.images.new(name, GW, GH, alpha=False)
        flat = []
        for r in range(GH - 1, -1, -1):
            for c in range(GW):
                flat += [*self.px[r][c], 1.0]
        im.pixels = flat
        im.pack()
        return im


cv = Canvas()
cv.text("DJ GAO", 13, 9, 3, (1, 1, 1))                         # white mask, tinted in the shader
for c in range(GW):
    if c % 3 != 2:
        cv.put(c, 5, (0.5, 0.5, 0.5)); cv.put(c, 34, (0.5, 0.5, 0.5))
img_text = cv.image("led_text")
cv = Canvas()
cv.text("DJ GAO", 37, 3, 2, (1, 1, 1))
img_text_small = cv.image("led_text_small")
cv = Canvas()
cv.bitmap(CAKE, 4, 26, 2)
cv.bitmap(CAKE, 90, 26, 2)
for c0, r0 in ((10, 4), (110, 4), (44, 22), (77, 22), (30, 40), (92, 8)):
    cv.bitmap(HEART, c0, r0, 1)
random.seed(5)
for _ in range(90):
    cv.put(random.randrange(GW), random.randrange(GH), lin(random.choice(PALETTE), 0.8))
img_art = cv.image("led_art")

m_led = bpy.data.materials.get("led_wall")
if m_led:
    bpy.data.materials.remove(m_led)
m_led = bpy.data.materials.new("led_wall")
m_led.use_nodes = True
nt = m_led.node_tree
nt.nodes.clear()
N, L = nt.nodes.new, nt.links.new


def vmath(op, a=None, bval=None, b=None):
    n = N("ShaderNodeVectorMath"); n.operation = op
    if a is not None:
        L(a, n.inputs[0])
    if b is not None:
        L(b, n.inputs[1])
    if bval is not None:
        n.inputs[1].default_value = bval
    return n


def val(name, v):
    n = N("ShaderNodeValue"); n.name = n.label = name; n.outputs[0].default_value = v
    return n


def rgb(name, col):
    n = N("ShaderNodeRGB"); n.name = n.label = name; n.outputs[0].default_value = hexrgb(col)
    return n


def mixc(fac, a, b, blend="MIX"):
    n = N("ShaderNodeMix"); n.data_type = "RGBA"; n.blend_type = blend
    ins = [s for s in n.inputs if s.type == "RGBA"]
    for src, dst in ((fac, n.inputs[0]), (a, ins[0]), (b, ins[1])):
        if isinstance(src, (int, float)):
            dst.default_value = src
        elif isinstance(src, tuple):
            dst.default_value = src
        else:
            L(src, dst)
    return [s for s in n.outputs if s.type == "RGBA"][0]


tc = N("ShaderNodeTexCoord")
grid = vmath("MULTIPLY", tc.outputs["UV"], (GW, GH, 1))
cuv = vmath("DIVIDE", vmath("ADD", vmath("FLOOR", grid.outputs[0]).outputs[0], (0.5, 0.5, 0)).outputs[0], (GW, GH, 1))
local = vmath("SUBTRACT", vmath("FRACTION", grid.outputs[0]).outputs[0], (0.5, 0.5, 0))
dist = vmath("LENGTH", local.outputs[0])
dot = N("ShaderNodeMapRange")
L(dist.outputs["Value"], dot.inputs["Value"])
dot.inputs["From Min"].default_value, dot.inputs["From Max"].default_value = 0.26, 0.46
dot.inputs["To Min"].default_value, dot.inputs["To Max"].default_value = 1.0, 0.04


def teximg(img):
    t = N("ShaderNodeTexImage"); t.image = img; t.interpolation = "Closest"
    L(cuv.outputs[0], t.inputs["Vector"])
    return t


t_text, t_small, t_art = teximg(img_text), teximg(img_text_small), teximg(img_art)
text_tint, bg_tint = rgb("text_tint", INK), rgb("bg_tint", LILAC)
phase, art_mix, level, chase = val("phase", 0.0), val("art_mix", 0.0), val("level", 0.0), val("chase", 0.25)
# soft horizontal bands rolling upwards (the old diagonal stripes cut through "DJ GAO")
wave = N("ShaderNodeTexWave"); wave.wave_type = "BANDS"; wave.bands_direction = "Y"
wave.inputs["Scale"].default_value = 1.6; wave.inputs["Distortion"].default_value = 0.0
L(cuv.outputs[0], wave.inputs["Vector"]); L(phase.outputs[0], wave.inputs["Phase Offset"])
soft = mixc(0.45, (0.55, 0.55, 0.55, 1.0), wave.outputs["Color"])
bgc = mixc(1.0, soft, bg_tint.outputs[0], "MULTIPLY")
bgc = mixc(chase.outputs[0], (0, 0, 0, 1), bgc)
txt = mixc(1.0, t_text.outputs["Color"], text_tint.outputs[0], "MULTIPLY")
main = mixc(t_text.outputs["Color"], bgc, txt, "SCREEN")
art = mixc(1.0, t_art.outputs["Color"], t_small.outputs["Color"], "SCREEN")
art = mixc(0.6, art, bgc, "SCREEN")
content = mixc(art_mix.outputs[0], main, art)
lit = N("ShaderNodeMath"); lit.operation = "MULTIPLY"
L(dot.outputs[0], lit.inputs[0]); L(level.outputs[0], lit.inputs[1])
emi = N("ShaderNodeEmission")
L(content, emi.inputs["Color"]); L(lit.outputs[0], emi.inputs["Strength"])
dif = N("ShaderNodeBsdfDiffuse"); dif.inputs["Color"].default_value = hexrgb("#0a0810")
add = N("ShaderNodeAddShader")
L(dif.outputs[0], add.inputs[0]); L(emi.outputs[0], add.inputs[1])
L(add.outputs[0], N("ShaderNodeOutputMaterial").inputs[0])

bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
uvl = bm.loops.layers.uv.new()
for f in bm.faces:
    for lp in f.loops:
        lp[uvl].uv = (lp.vert.co.x + 0.5, lp.vert.co.y + 0.5)
bmesh.ops.scale(bm, vec=(WALL_W, WALL_H, 1), verts=bm.verts)
led = new_obj("LEDWall", mesh_from_bm("LEDWall", bm, False), m_led, loc=(0, WALL_Y, WALL_Z0 + WALL_H / 2), coll=C)
led.rotation_euler = (math.pi / 2, 0, 0)
rbox("led_frame", (0, WALL_Y + 0.08, WALL_Z0 + WALL_H / 2), (WALL_W + 0.3, 0.12, WALL_H + 0.3), m_dark, bevel=0.02, coll=C)
for sx in (-1, 1):                                              # side LED pillars, share the tint
    p = rbox("led_pillar", (sx * 5.35, WALL_Y - 0.2, WALL_Z0 + WALL_H / 2), (0.35, 0.1, WALL_H), m_led, bevel=0.01, coll=C)

# ------------------------------------------------------------------ festoon lights + neon
m_bulb = emitter("v_bulb", GOLD, 9.0)
m_wire = principled("v_wire", "#0b0910", rough=0.6)
bulb_me = sphere_mesh("bulb", 0.06, 10)
bulb_me.materials.append(m_bulb)
for i, y in enumerate((-1.6, -4.0, -6.4, -8.8, -11.2)):
    pts = []
    for k in range(29):
        u = k / 28
        x = -9.4 + 18.8 * u
        z = 6.2 - 1.1 * math.sin(math.pi * u) - 0.25 * (i % 2)
        pts.append(Vector((x, y + 0.6 * math.sin(math.pi * u) * (1 if i % 2 else -1), z)))
        if 0 < k < 28:
            new_obj("bulb", bulb_me, loc=pts[-1] - Vector((0, 0, 0.07)), coll=C)
    cu = bpy.data.curves.new("wire%d" % i, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.008
    sp = cu.splines.new("POLY"); sp.points.add(len(pts) - 1)
    for p_, v in zip(sp.points, pts):
        p_.co = (*v, 1)
    new_obj("wire", cu, m_wire, coll=C)


def neon(name, pts2d, loc, rot, scale, mat, closed=True):
    cu = bpy.data.curves.new(name, "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.035
    cu.bevel_resolution = 2
    sp = cu.splines.new("BEZIER"); sp.bezier_points.add(len(pts2d) - 1); sp.use_cyclic_u = closed
    for bp, (x, y) in zip(sp.bezier_points, pts2d):
        bp.co = (x, 0, y); bp.handle_left_type = bp.handle_right_type = "AUTO"
    o = new_obj(name, cu, mat, loc=loc, coll=C)
    o.rotation_euler, o.scale = rot, (scale, scale, scale)
    return o


heart = [(0, -1), (0.9, 0.05), (0.5, 0.75), (0, 0.4), (-0.5, 0.75), (-0.9, 0.05)]
star = [(math.cos(a) * (1 if i % 2 == 0 else 0.45), math.sin(a) * (1 if i % 2 == 0 else 0.45))
        for i, a in enumerate([math.pi / 2 + k * math.pi / 5 for k in range(10)])]
for sx, y, z, shape, mat, s in ((-1, -2.5, 3.6, heart, m_trim_rose, 0.9), (1, -3.5, 3.8, star, m_trim_mint, 0.9),
                                (1, -9.0, 3.6, heart, m_trim_lilac, 1.1), (-1, -12.6, 4.0, star, m_trim_gold, 0.8),
                                (1, -13.5, 4.2, heart, m_trim_rose, 0.7)):
    neon("neon", shape, (sx * 9.45, y, z), (0, 0, math.pi / 2), s, mat)

# ------------------------------------------------------------------ end title (hidden until the finale)
font = bpy.data.fonts.load(os.path.join(HERE, "fonts", "fusion-pixel-title.otf"), check_existing=True)
if not font.packed_file:
    font.pack()
m_title = emitter("v_title", INK, 6.0)
m_sub = emitter("v_sub", GOLD, 4.0)
latin = bpy.data.fonts.load(os.path.join(HERE, "fonts", "pixelify.woff2"), check_existing=True)   # the otf is a CJK subset
if not latin.packed_file:
    latin.pack()
titles = []
for name, body, z, size, mat, fnt in (("Title", "生日快乐!", 2.85, 0.95, m_title, font), ("Subtitle", "DJ GAO · LIVE", 2.12, 0.24, m_sub, latin)):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body, cu.font, cu.size = body, fnt, size
    cu.align_x, cu.align_y, cu.extrude = "CENTER", "CENTER", 0.03
    o = new_obj(name, cu, mat, loc=(0, 2.25, z), coll=C)
    o.rotation_euler = (math.pi / 2, 0, 0)
    titles.append(o)
print("venue ok:", len(C.objects), "objects")
