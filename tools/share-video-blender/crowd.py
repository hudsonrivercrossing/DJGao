# Crowd of toy figures, about 1,200 of them.
# - Bodies: 16 near and 6 simplified far variants (head, hair style, top, trousers/skirt,
#   shoes), arms with hands and props (glow sticks, phones, cups).
# - The mass of the crowd is one point cloud with a Geometry Nodes tree ("crowd_gn") that
#   poses every figure each frame: a hop on every beat, side sway, head bangs, spins,
#   fist pumps, waves, glow-stick circles, phone filming, claps, shoulder bumps, hands up.
#   The music drives it through keyed modifier inputs (Beat counter, Bounce, Groove,
#   HandsUp, Phone, Sync, Crouch, Wave), so nobody is ever static and it costs no keyframes
#   per figure.
# - Sparkler / roman-candle holders, the stage crew and the bartenders are object rigs
#   (keyed here) because fireworks.py hangs sparks on their hands.
# Writes crowd_hands.json for fireworks.py. Run: node send.js common.py crowd.py
C = fresh_collection("Crowd")
PARTS = fresh_collection("CrowdParts")
random.seed(7)
FLOOR_Z, BAL_Z = -0.9, 2.3

HAIR = ["#2a1f3a", "#5e3f86", "#f2a7cf", "#9ef1da", "#f6d38c", "#6b3b2a", "#1c1424", "#b9a4ff", "#e86fa8", "#3a2a22"]
SHIRT = [ROSE, LILAC, MINT, GOLD, "#fff1ed", "#7a5aa6", "#e07ab0", "#5fc0b0", "#ff9f7a", "#9a7ee8", "#ffd1e6", "#4f3a7a"]
BOTTOM = ["#2a2238", "#3a2f52", "#1f2a44", "#5a3a5e", "#fff1ed", "#2f3a4f", ROSE, LILAC]
SKIN = ["#ffd9cf", "#f2c3a7", "#d9a07e", "#a8704f", "#ffe6dc"]
ACC = [INK, ROSE, MINT, GOLD, LILAC, "#ff6fa8"]
STYLES = ["pony", "bun", "short", "cap", "phones", "bunny", "buns", "bob"]
m_eye = principled("c_eye", "#1a1020", rough=0.2, coat=1.0)
m_blush = principled("c_blush", "#ff9fc4", rough=0.6)
m_shoe = principled("c_shoe", "#f4eef6", rough=0.5)


def tone(h, k=0.62):
    """Pastels lit by a club rig clip to white under AgX: keep the hue, lower the albedo."""
    return tuple(c * k for c in hexrgb(h)[:3]) + (1.0,)


def join(parts):
    bm = bmesh.new()
    for me, mat_i, mtx in parts:
        tmp = bmesh.new(); tmp.from_mesh(me)
        bmesh.ops.transform(tmp, matrix=mtx, verts=tmp.verts)
        for f_ in tmp.faces:
            f_.material_index = mat_i
        me2 = bpy.data.meshes.new("tmp"); tmp.to_mesh(me2); tmp.free()
        bm.from_mesh(me2); bpy.data.meshes.remove(me2)
    return bm


def T(x, y, z):
    return Matrix.Translation((x, y, z))


def S(x, y, z):
    return Matrix.Diagonal((x, y, z, 1))


def Rx(a):
    return Matrix.Rotation(a, 4, "X")


PRIM = {}


def prim(kind, *args):
    key = (kind,) + args
    if key not in PRIM:
        if kind == "sphere":
            PRIM[key] = sphere_mesh("p_sph", 1.0, args[0])
        elif kind == "capsule":
            PRIM[key] = capsule_mesh("p_cap", args[0], args[1], args[2])
        elif kind == "cone":
            bm = bmesh.new()
            bmesh.ops.create_cone(bm, cap_ends=True, segments=args[2], radius1=args[0], radius2=args[1], depth=1.0)
            PRIM[key] = mesh_from_bm("p_cone", bm)
        elif kind == "box":
            PRIM[key] = box_mesh("p_box", (1, 1, 1))
    return PRIM[key]


def vcap(r, z0, z1, seg, x=0.0, y=0.0):
    """capsule standing from z0 to z1 (centres of the end caps)"""
    return prim("capsule", r, z1 - z0, seg), T(x, y, z1) @ Rx(math.pi / 2)


# material slots of a body: 0 top, 1 bottom, 2 skin, 3 hair, 4 eyes, 5 blush, 6 accessory, 7 shoes
def body_variant(name, rng, far=False, shirt=None, style=None):
    seg = 8 if far else 14
    cols = dict(shirt=shirt or rng.choice(SHIRT), bottom=rng.choice(BOTTOM), skin=rng.choice(SKIN), hair=rng.choice(HAIR),
                acc=rng.choice(ACC))
    style = style or rng.choice(STYLES)
    low = rng.choice(("pants", "pants", "skirt", "shorts"))
    sph = prim("sphere", seg)
    P = []
    # legs / bottoms
    if low == "pants":
        for sx in (-1, 1):
            me, mt = vcap(0.064, 0.07, 0.3, seg // 2 * 2, sx * 0.07); P.append((me, 1, mt))
    else:
        for sx in (-1, 1):
            me, mt = vcap(0.05, 0.07, 0.3, seg // 2 * 2, sx * 0.07); P.append((me, 2, mt))
        if low == "skirt":
            P.append((prim("cone", 0.2, 0.12, seg + 4), 1, T(0, 0, 0.32) @ S(1, 1, 0.24)))
        else:
            for sx in (-1, 1):
                me, mt = vcap(0.072, 0.24, 0.33, seg // 2 * 2, sx * 0.07); P.append((me, 1, mt))
    for sx in (-1, 1):
        P.append((sph, 7, T(sx * 0.07, 0.03, 0.035) @ S(0.062, 0.085, 0.04)))
    # torso, neck, head
    me, mt = vcap(0.15, 0.37, 0.52, seg); P.append((me, 0, mt))
    P.append((sph, 2, T(0, 0, 0.67) @ S(0.06, 0.06, 0.06)))
    P.append((sph, 2, T(0, 0, 0.86) @ S(0.2, 0.2, 0.2)))
    # hair
    shell = S(1.07, 1.05, 0.9) if style not in ("bob", "short") else (S(1.15, 1.1, 0.95) if style == "bob" else S(1.04, 1.02, 0.82))
    P.append((sph, 3, T(0, -0.035, 0.89 if style != "bob" else 0.84) @ shell @ S(0.2, 0.2, 0.2)))
    if style == "pony":
        P.append((sph, 3, T(0, -0.235, 0.8) @ S(0.075, 0.075, 0.17)))
        P.append((sph, 6, T(0, -0.205, 0.93) @ S(0.035, 0.035, 0.035)))
    elif style == "bun":
        P.append((sph, 3, T(0, -0.05, 1.08) @ S(0.085, 0.085, 0.085)))
    elif style == "buns":
        for sx in (-1, 1):
            P.append((sph, 3, T(sx * 0.17, -0.02, 1.02) @ S(0.07, 0.07, 0.07)))
    elif style == "cap":
        P.append((sph, 6, T(0, -0.01, 0.97) @ S(0.212, 0.212, 0.13)))
        P.append((sph, 6, T(0, 0.17, 0.955) @ S(0.15, 0.13, 0.018)))
    elif style == "phones":
        for i in range(11):
            a = math.pi * i / 10
            P.append((sph, 6, T(0.215 * math.cos(a), -0.01, 0.86 + 0.215 * math.sin(a)) @ S(0.024, 0.03, 0.024)))
        for sx in (-1, 1):
            P.append((sph, 6, T(sx * 0.205, -0.01, 0.84) @ S(0.045, 0.075, 0.075)))
    elif style == "bunny":
        for sx in (-1, 1):
            P.append((sph, 6, T(sx * 0.085, -0.03, 1.16) @ Matrix.Rotation(sx * -0.25, 4, "Y") @ S(0.045, 0.025, 0.14)))
    if not far:
        for sx in (-1, 1):
            P.append((sph, 4, T(sx * 0.07, 0.185, 0.85) @ S(0.022, 0.01, 0.03)))
            P.append((sph, 5, T(sx * 0.12, 0.16, 0.79) @ S(0.03, 0.01, 0.018)))
    me = mesh_from_bm(name, join(P))
    acc = cols["acc"] if cols["acc"] != cols["shirt"] else INK
    for i, (col, rough) in enumerate(((cols["shirt"], 0.5), (cols["bottom"], 0.55), (cols["skin"], 0.5), (cols["hair"], 0.4))):
        me.materials.append(principled(f"c_{name}_{i}", tone(col), rough=rough, coat=0.3))
    me.materials.append(m_eye)
    me.materials.append(m_blush)
    me.materials.append(principled(f"c_{name}_acc", acc, rough=0.35, coat=0.5))
    me.materials.append(m_shoe)
    return me, cols


rng = random.Random(11)
NEAR, FAR = [], []
for i in range(16):
    me, cols = body_variant("body_%02d" % i, rng, style=STYLES[i % len(STYLES)])
    o = new_obj("body_%02d" % i, me, coll=PARTS); NEAR.append((o, cols))
for i in range(6):
    me, cols = body_variant("body_%02d" % (16 + i), rng, far=True, style=STYLES[(i * 3) % len(STYLES)])
    o = new_obj("body_%02d" % (16 + i), me, coll=PARTS); FAR.append((o, cols))
CREW = [body_variant("crew_%d" % i, rng, shirt="#1c1626", style=("cap", "phones")[i]) for i in range(2)]

# ------------------------------------------------------------------ arms
# origin at the shoulder, hanging along -Z, hand at z = -0.33. GN arms read the figure's skin
# and shirt colour from instance attributes; rig arms use object-linked materials.
ARM_LEN = 0.33


def inst_attr_mat(name, attr):
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree
    a = nt.nodes.new("ShaderNodeAttribute"); a.attribute_type = "INSTANCER"; a.attribute_name = attr
    p = nt.nodes["Principled BSDF"]
    p.inputs["Roughness"].default_value, p.inputs["Coat Weight"].default_value = 0.5, 0.3
    k = nt.nodes.new("ShaderNodeVectorMath"); k.operation = "SCALE"; k.inputs["Scale"].default_value = 0.62
    nt.links.new(a.outputs["Vector"], k.inputs[0])
    nt.links.new(k.outputs["Vector"], p.inputs["Base Color"])
    return m


m_arm_skin = inst_attr_mat("c_arm_skin", "skin_col")
m_arm_sleeve = inst_attr_mat("c_arm_sleeve", "shirt_col")
def stick_mat(c):
    """Glow stick whose brightness follows the instance attribute "glow" (bright inside the encore wave)."""
    m = emitter("c_stick_" + c, c, 9.0)
    nt = m.node_tree
    a = nt.nodes.new("ShaderNodeAttribute"); a.attribute_type = "INSTANCER"; a.attribute_name = "glow"
    mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"; mul.inputs[1].default_value = 16.0
    nt.links.new(a.outputs["Fac"], mul.inputs[0])
    nt.links.new(mul.outputs[0], nt.nodes["Emission"].inputs["Strength"])
    # in the encore the sticks switch to a colour that contrasts with that key's wash
    rgb = nt.nodes.new("ShaderNodeRGB"); rgb.name = "contrast"; rgb.outputs[0].default_value = hexrgb(c)
    enc = nt.nodes.new("ShaderNodeValue"); enc.name = "enc"; enc.outputs[0].default_value = 0.0
    mx_ = nt.nodes.new("ShaderNodeMix"); mx_.data_type = "RGBA"
    ins = [s_ for s_ in mx_.inputs if s_.type == "RGBA"]
    ins[0].default_value = hexrgb(c)
    nt.links.new(enc.outputs[0], mx_.inputs[0]); nt.links.new(rgb.outputs[0], ins[1])
    nt.links.new([s_ for s_ in mx_.outputs if s_.type == "RGBA"][0], nt.nodes["Emission"].inputs["Color"])
    return m


m_stick = {c: stick_mat(c) for c in PALETTE}
m_phone = principled("c_phone", "#15101c", rough=0.3)
m_screen = emitter("c_screen", "#cfe6ff", 1.5)
m_flash = emitter("c_flash", "#fffaf0", 0.0)
m_cup = principled("c_cup", GOLD, rough=0.2, coat=1.0, emit=GOLD, strength=0.4)
m_rod = principled("c_rod", "#3a3040", rough=0.5, metal=0.5)
m_tube = principled("c_candle_tube", ROSE, rough=0.4)


UPPER = 0.18                               # shoulder -> elbow (GN arms bend here)


def arm_mesh(name, prop=None, seg=10, part="full"):
    """part: "full" = one stiff arm (object rigs), "lower" = forearm + hand + prop with the
    origin at the elbow (GN crowd), "upper" = upper arm + sleeve + elbow."""
    sph = prim("sphere", seg)
    if part == "upper":
        me_, mt = vcap(0.047, -UPPER, -0.02, seg)
        return mesh_from_bm(name, join([(me_, 0, mt), (sph, 1, T(0, 0, -0.04) @ S(0.068, 0.068, 0.075)),
                                        (sph, 0, T(0, 0, -UPPER) @ S(0.046, 0.046, 0.046))]))
    me_, mt = vcap(0.047, -0.29, -0.02, seg)
    parts = [(me_, 0, mt), (sph, 1, T(0, 0, -0.04) @ S(0.068, 0.068, 0.075)),               # arm + short sleeve
             (sph, 0, T(0, 0.0, -ARM_LEN) @ S(0.055, 0.045, 0.06)),                          # hand
             (sph, 0, T(0, 0.04, -0.315) @ S(0.022, 0.022, 0.03))]                          # thumb
    if part == "lower":                                   # forearm from the elbow; everything 0.03 further out
        me_, mt = vcap(0.044, -0.3, -UPPER, seg)
        parts[:2] = [(me_, 0, mt)]
        shift = T(0, 0, UPPER - 0.03)
    if prop and prop.startswith("stick"):
        me_, mt = vcap(0.034, -0.66, -0.35, 8); parts.append((me_, 2, mt))
    elif prop == "phone":
        parts.append((prim("box"), 3, T(0, 0.035, -0.41) @ S(0.075, 0.012, 0.14)))
        parts.append((prim("box"), 4, T(0, 0.042, -0.41) @ S(0.065, 0.003, 0.12)))
        parts.append((sph, 5, T(0.022, 0.028, -0.465) @ S(0.012, 0.006, 0.012)))
    elif prop == "cup":
        parts.append((prim("cone", 0.045, 0.035, 10), 2, T(0, 0.02, -0.4) @ S(1, 1, 0.12)))
    elif prop in ("sparkler", "candle"):
        r, l = (0.008, 0.34) if prop == "sparkler" else (0.03, 0.3)
        me_, mt = vcap(r, -0.35 - l, -0.35, 6); parts.append((me_, 2, mt))
    if part == "lower":
        parts = [(m_, i_, shift @ x_) for m_, i_, x_ in parts]
    me = mesh_from_bm(name, join(parts))
    return me


ARM_TYPES = ["plain", "stick_rose", "stick_lilac", "stick_mint", "stick_gold", "phone", "cup"]
STICK_COL = {"stick_rose": ROSE, "stick_lilac": LILAC, "stick_mint": MINT, "stick_gold": GOLD}
ARM_ME = []
for i, k in enumerate(ARM_TYPES):
    old = bpy.data.meshes.get("arm_%d_%s" % (i, k))          # a re-run must not pick up last run's mesh by name
    if old:
        old.name = old.name + "_stale"
    me = arm_mesh("arm_%d_%s" % (i, k), None if k == "plain" else k, part="lower")
    ARM_ME.append(me)
    me.materials.append(m_arm_skin); me.materials.append(m_arm_sleeve)
    if k.startswith("stick"):
        me.materials.append(m_stick[STICK_COL[k]])
    elif k == "phone":
        me.materials.append(m_phone); me.materials.append(m_phone); me.materials.append(m_screen); me.materials.append(m_flash)
    elif k == "cup":
        me.materials.append(m_cup)
ARMS_COLL = bpy.data.collections.new("CrowdArms")
PARTS.children.link(ARMS_COLL)
BODY_COLL = bpy.data.collections.new("CrowdBodies")
PARTS.children.link(BODY_COLL)
for o, _ in NEAR + FAR:
    PARTS.objects.unlink(o); BODY_COLL.objects.link(o)
for i, k in enumerate(ARM_TYPES):
    new_obj("arm_%d_%s" % (i, k), ARM_ME[i], coll=ARMS_COLL)
UPPER_COLL = bpy.data.collections.new("CrowdUpperArm")
PARTS.children.link(UPPER_COLL)
me = arm_mesh("upperarm", part="upper")
me.materials.append(m_arm_skin); me.materials.append(m_arm_sleeve)
new_obj("upperarm", me, coll=UPPER_COLL)
RIG_ARM = {}
for k in ("plain", "sparkler", "candle"):
    me = arm_mesh("rigarm_" + k, None if k == "plain" else k)
    for m_ in (m_phone, m_phone, m_rod if k == "sparkler" else m_tube):
        me.materials.append(m_)
    RIG_ARM[k] = me
PROP_TIP = {"sparkler": Vector((0, 0, -0.35 - 0.34)), "candle": Vector((0, 0, -0.35 - 0.3))}
for lc in bpy.context.view_layer.layer_collection.children:
    if lc.collection == PARTS:
        lc.exclude = True

# ------------------------------------------------------------------ placement
figs = []


def add_fig(x, y, z, zone, rotz=None):
    far = (y < -8.5) or zone == "balcony"
    figs.append(dict(x=x, y=y, z=z, zone=zone, rotz=random.uniform(-0.3, 0.3) if rotz is None else rotz,
                     sc=random.uniform(0.84, 1.03), far=far))


y, row = -1.58, 0
while y > -13.3:
    dx = 0.44 if y > -3.2 else (0.47 if y > -8.5 else 0.5)
    x = -8.9 + (dx / 2 if row % 2 else 0.0) + random.uniform(0, 0.08)
    while x < 8.9:
        bar_zone = x < -6.35 and -11.7 < y < -3.3
        if not bar_zone and random.random() > 0.025:
            zone = "front" if (row == 0 and abs(x) < 6.4) else "floor"
            add_fig(x + random.uniform(-0.07, 0.07), y + random.uniform(-0.07, 0.07), FLOOR_Z, zone,
                    rotz=random.uniform(-0.12, 0.12) if zone == "front" else None)
        x += dx * random.uniform(0.96, 1.08)
    y -= dx * 0.86 * random.uniform(0.96, 1.04)
    row += 1
for yb in (-13.72, -14.38, -15.04, -15.7):
    x = -8.85 + random.uniform(0, 0.2)
    while x < 8.85:
        if random.random() > 0.08:
            add_fig(x + random.uniform(-0.06, 0.06), yb, BAL_Z, "balcony")
        x += random.uniform(0.47, 0.56)
for i in range(12):                                            # people at the bar, facing it
    add_fig(-6.7 + random.uniform(-0.08, 0.2), -10.9 + i * 0.6, FLOOR_Z, "bar", math.pi / 2 + random.uniform(-0.5, 0.5))
RIGS = []                                                       # object-rigged figures
for x, y_, zone, rz in ((-8.65, -7.0, "bartender", -math.pi / 2), (-8.65, -9.2, "bartender", -math.pi / 2)):
    RIGS.append(dict(x=x, y=y_, z=FLOOR_Z, zone=zone, rotz=rz, sc=1.0, role="plain", mesh=CREW[0 if y_ > -8 else 1][0]))
for x, y_ in [(-6.1, 0.9), (-5.4, 2.3), (6.1, 0.9), (5.4, 2.3)]:      # pyro crew on the stage wings
    RIGS.append(dict(x=x, y=y_, z=0.0, zone="crew", rotz=math.pi + (0.5 if x > 0 else -0.5), sc=0.95, role="plain",
                     mesh=CREW[0 if x < 0 else 1][0]))
# sparkler / candle holders: taken out of the point crowd where the cameras look
floor = [f for f in figs if f["zone"] == "floor" and f["y"] < -2.4]
for role, n, key in (("sparkler", 34, lambda f: abs(f["x"] - 1.0) + 0.5 * abs(f["y"] + 6.0)),
                     ("candle", 16, lambda f: abs(f["x"]) * 1.2 + abs(f["y"] + 4.5))):
    for f in sorted([f for f in floor if "role" not in f], key=key)[:n]:
        f["role"] = role
        v = random.randrange(len(NEAR))
        RIGS.append(dict(f, mesh=NEAR[v][0].data, cols=NEAR[v][1]))
figs = [f for f in figs if f.get("role") not in ("sparkler", "candle")]

# ------------------------------------------------------------------ per-figure attributes for the GN crowd
ROLES = ["bounce", "pump", "wave", "stick", "phone", "clap", "bump", "bang", "spin", "glass", "barrier"]
ROLE_W = [12, 18, 14, 14, 9, 9, 7, 12, 5, 0, 0]
ZONE_K = {"front": 1.4, "floor": 1.0, "balcony": 0.8, "bar": 0.4}
for f in figs:
    if f["zone"] == "front":
        role = "barrier"
    elif f["zone"] == "bar":
        role = "glass"
    else:
        role = random.choices(ROLES, ROLE_W)[0]
    f["role"] = ROLES.index(role)
    pool = FAR if f["far"] else NEAR
    v = random.randrange(len(pool))
    f["var"] = (16 + v) if f["far"] else v
    f["cols"] = pool[v][1]
    arm_r = "plain"
    if role == "stick":
        arm_r = random.choice(list(STICK_COL))
    elif role == "phone" or (role in ("bounce", "wave", "clap", "bump") and random.random() < 0.15):
        arm_r = "phone"
    elif role in ("bounce", "wave", "clap", "bump", "bang", "pump") and random.random() < 0.5:
        arm_r = random.choice(list(STICK_COL))                   # half the floor carries a glow stick
    elif role == "glass":
        arm_r = "cup"
    f["arm_r"] = ARM_TYPES.index(arm_r)
    f["arm_l"] = ARM_TYPES.index(random.choice(list(STICK_COL))) if (role == "stick" and random.random() < 0.3) else 0
    f["k"] = ZONE_K[f["zone"]] * (0.9 if (f["zone"] == "floor" and f["y"] < -8.5) else 1.0) * random.uniform(0.9, 1.1)
    f["lag"] = random.uniform(0.0, 0.06 if f["zone"] == "front" else 0.15)
    f["rate"] = 0.5 if (random.random() < 0.08 and f["zone"] != "front") else 1.0
    f["wave"] = 1.1 if f["zone"] == "balcony" else min(1.05, max(0.0, 0.65 * (-1.5 - f["y"]) / 11.5 + 0.45 * (f["x"] + 9.0) / 18.0))   # diagonal band: front-left -> back-right
    f["isphone"] = 1.0 if arm_r == "phone" else 0.0
    f["upk"] = 0.45 if f["zone"] == "bar" else 1.0

me = bpy.data.meshes.new("crowd_points")
me.vertices.add(len(figs))
me.vertices.foreach_set("co", [c for f in figs for c in (f["x"], f["y"], f["z"])])
for name, getter in (("var", lambda f: f["var"]), ("arm_r", lambda f: f["arm_r"]), ("arm_l", lambda f: f["arm_l"]),
                     ("role", lambda f: f["role"]), ("sc", lambda f: f["sc"]), ("rz", lambda f: f["rotz"]),
                     ("lag", lambda f: f["lag"]), ("rate", lambda f: f["rate"]), ("k", lambda f: f["k"]),
                     ("wave", lambda f: f["wave"]), ("isphone", lambda f: f["isphone"]), ("upk", lambda f: f["upk"])):
    a = me.attributes.new(name, "FLOAT", "POINT")
    a.data.foreach_set("value", [float(getter(f)) for f in figs])
for name, key in (("skin_col", "skin"), ("shirt_col", "shirt")):
    a = me.attributes.new(name, "FLOAT_VECTOR", "POINT")
    a.data.foreach_set("vector", [c for f in figs for c in lin(f["cols"][key])])
crowd = new_obj("CrowdGN", me, coll=C)

# ------------------------------------------------------------------ the GN tree
g = bpy.data.node_groups.get("crowd_gn")
if g:
    bpy.data.node_groups.remove(g)
G = bpy.data.node_groups.new("crowd_gn", "GeometryNodeTree")
G.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
G.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
INPUTS = ["Beat", "Bounce", "Sway", "Groove", "HandsUp", "Phone", "Sync", "Crouch", "WaveT", "Leap", "Shot", "Calm", "Near"]
for n_ in INPUTS:
    G.interface.new_socket(n_, in_out="INPUT", socket_type="NodeSocketFloat")
GI = G.nodes.new("NodeGroupInput")
GO = G.nodes.new("NodeGroupOutput")


class Ex:
    def __init__(self, s):
        self.s = s

    def __add__(a, b): return op("ADD", a, b)
    def __radd__(a, b): return op("ADD", b, a)
    def __sub__(a, b): return op("SUBTRACT", a, b)
    def __rsub__(a, b): return op("SUBTRACT", b, a)
    def __mul__(a, b): return op("MULTIPLY", a, b)
    def __rmul__(a, b): return op("MULTIPLY", b, a)
    def __truediv__(a, b): return op("DIVIDE", a, b)
    def __neg__(a): return op("MULTIPLY", a, -1.0)


def feed(v, sock):
    if isinstance(v, Ex):
        G.links.new(v.s, sock)
    else:
        sock.default_value = v


def op(o, *args):
    if not any(isinstance(a, Ex) for a in args):
        a = [float(x) for x in args]
        return {"ADD": lambda: a[0] + a[1], "SUBTRACT": lambda: a[0] - a[1], "MULTIPLY": lambda: a[0] * a[1],
                "DIVIDE": lambda: a[0] / a[1], "SINE": lambda: math.sin(a[0]), "COSINE": lambda: math.cos(a[0]),
                "MAXIMUM": lambda: max(a[0], a[1]), "MINIMUM": lambda: min(a[0], a[1]), "ABSOLUTE": lambda: abs(a[0]),
                "FRACT": lambda: a[0] - math.floor(a[0])}[o]()
    n = G.nodes.new("ShaderNodeMath"); n.operation = o
    for i, v in enumerate(args):
        feed(v, n.inputs[i])
    return Ex(n.outputs[0])


sin = lambda a: op("SINE", a)
cos = lambda a: op("COSINE", a)
fract = lambda a: op("FRACT", a)
absf = lambda a: op("ABSOLUTE", a)
mx = lambda a, b: op("MAXIMUM", a, b)
mn = lambda a, b: op("MINIMUM", a, b)
clamp = lambda a, lo=0.0, hi=1.0: mn(mx(a, lo), hi)
mix = lambda a, b, t: a + (b - a) * t
eq = lambda a, v: op("COMPARE", a, float(v), 0.1)
PI = math.pi


def attr(name, vec=False):
    n = G.nodes.new("GeometryNodeInputNamedAttribute"); n.data_type = "FLOAT_VECTOR" if vec else "FLOAT"
    n.inputs["Name"].default_value = name
    return Ex(n.outputs["Attribute"])


def xyz(x, y, z):
    n = G.nodes.new("ShaderNodeCombineXYZ")
    for i, v in enumerate((x, y, z)):
        feed(v, n.inputs[i])
    return Ex(n.outputs[0])


def euler(v):
    n = G.nodes.new("FunctionNodeEulerToRotation"); feed(v, n.inputs[0]); return Ex(n.outputs[0])


def switch(idx, items):
    n = G.nodes.new("GeometryNodeIndexSwitch"); n.data_type = "FLOAT"
    while len([i for i in n.inputs if i.identifier.startswith("Item_")]) < len(items):
        n.index_switch_items.new()
    feed(idx, n.inputs["Index"])
    for i, v in enumerate(items):
        feed(v, n.inputs["Item_%d" % i])
    return Ex(n.outputs[0])


I = {n_: Ex(GI.outputs[n_]) for n_ in INPUTS}
B = I["Beat"]
role, lag, rate, k, sc = attr("role"), attr("lag"), attr("rate"), attr("k"), attr("sc")
ph = fract(B * rate - lag)                     # this figure's phase inside its beat
phS = fract(B)                                 # everybody together
s1 = sin(ph * PI)
s1S = sin(phS * PI)
lag2 = lag * 6.283
osc2 = sin(B * PI + lag2 * 3.0)                # one swing every two beats
osc4 = sin(B * (PI / 2) + lag2 * 3.0)          # one swing every four beats
# encore wave: per-shot screen-space diagonal coordinate (camera.py writes wave_a / wave_b, near_*, turn_*)
shot = I["Shot"]
wavev = switch(shot, [attr("wave"), attr("wave_a"), attr("wave_b"), attr("wave")])
nearv = switch(shot, [0.0, attr("near_a"), attr("near_b"), attr("near_c")]) * I["Near"]
turnv = switch(shot, [0.0, attr("turn_a"), attr("turn_b"), attr("turn_c")]) * I["Near"]
wb = clamp((0.3 - absf(I["WaveT"] - wavev)) * 5.0)    # full inside +-0.1, gone beyond +-0.3: a band several rows deep
groove = I["Groove"]

# body
# a hop on every beat (rows lock to the kick as Sync rises), the wave, the crouch before the drop
# and the "Leap" that has everybody in the air on the first frame of the drop
s1w = mix(s1, s1S, I["Sync"])
hop = I["Bounce"] * k * s1w + wb * 0.6 * k - I["Crouch"] * 0.1 * k + I["Leap"] * 0.5 * k
squash = 1.0 - clamp(I["Bounce"] * 2.2 * k) * 0.16 * (1.0 - s1w) - I["Crouch"] * 0.14   # knees bend on landing
lean_y = I["Sway"] * 0.11 * osc4 + eq(role, 6) * groove * 0.24 * osc2
lean_x = -(eq(role, 7) * groove * 0.6 * s1 * s1) - 0.25 * I["Bounce"] * k * s1w
spin_s = clamp((fract(B / 8.0 + lag) - 0.7) * 3.3333)
spin_s = spin_s * spin_s * (3.0 - spin_s * 2.0)
rz = attr("rz") + turnv + eq(role, 8) * op("ROUND", groove) * 6.2832 * spin_s + 0.14 * sin(B * (PI / 4) + lag2 * 5.0)
fig_rot = euler(xyz(lean_x, lean_y, rz))


def arm_pose(side):
    """(rx, ry) of one arm; +rx swings forward/up, ry = -side*a lifts it outwards."""
    out = -side
    right = side == 1
    rest = (0.18 + 0.12 * osc2 * side, out * 0.22)
    poses = [
        (0.5 + 1.1 * s1, out * 0.4),                                                           # bounce, arms swing up
        ((2.0 + 0.95 * s1, out * 0.15) if right else (0.5 + 0.6 * s1, out * 0.4)),              # pump
        ((0.25, out * (2.2 + 0.75 * osc2)) if right else (0.4 + 0.6 * s1, out * 0.35)),         # wave
        ((2.35 + 0.6 * osc2, out * 0.1 + 0.9 * cos(B * PI + lag2 * 3.0)) if right else (0.6 + 0.6 * s1, out * 0.35)),  # stick circle
        ((2.1 + 0.35 * osc2, out * 0.1 + 0.6 * osc4) if right else (0.5 + 0.5 * s1, out * 0.35)),  # phone filming, panning
        (1.3 + 0.1 * s1, out * (0.06 + 0.42 * s1)),                                            # clap on the beat
        (0.3 + 0.35 * osc2 * side, out * 0.38),                                                # shoulder bump
        (0.35 + 0.45 * s1, out * 0.5),                                                         # head bang
        (0.3, out * 1.45),                                                                     # spin
        ((1.05 + 1.35 * clamp(osc4 * 3.0 - 2.0), out * 0.12) if right else rest),               # glass
        ((2.3 + 0.5 * s1, out * 0.15) if right else (1.3, out * 0.04)),                         # barrier: pump + hand on rail
    ]
    rx = switch(role, [p[0] for p in poses])
    ry = switch(role, [p[1] for p in poses])
    gr = mx(groove, eq(role, 10))                                                              # the rail hand stays on
    rx, ry = mix(rest[0], rx, gr), mix(rest[1], ry, gr)
    if right:
        w = I["Phone"] * attr("isphone")
        rx, ry = mix(rx, 2.3 + 0.05 * osc2, w), mix(ry, out * 0.1, w)
    calm = I["Calm"] * (1.0 - wb) * (1.0 - nearv)                       # outside the band: hands at the chest
    rx, ry = mix(rx, 1.05 + 0.15 * s1, calm), mix(ry, out * 0.3, calm)
    up = clamp(I["HandsUp"] * attr("upk") + wb * 1.6 + nearv)
    rx = mix(rx, 0.28 + 0.1 * s1, up)
    ry = mix(ry, out * (2.82 + 0.25 * osc2 * side), up)
    return rx, ry


pos_off = xyz(0.0, 0.0, hop * sc)


def coll_info(coll):
    n = G.nodes.new("GeometryNodeCollectionInfo")
    n.inputs["Collection"].default_value = coll
    n.inputs["Separate Children"].default_value = True
    n.inputs["Reset Children"].default_value = True
    return n.outputs[0]


def instance(points, inst, index, rot, scale):
    n = G.nodes.new("GeometryNodeInstanceOnPoints")
    G.links.new(points, n.inputs["Points"])
    G.links.new(inst, n.inputs["Instance"])
    n.inputs["Pick Instance"].default_value = True
    feed(index, n.inputs["Instance Index"])
    feed(rot, n.inputs["Rotation"])
    feed(scale, n.inputs["Scale"])
    return n.outputs[0]


glow_st = G.nodes.new("GeometryNodeStoreNamedAttribute"); glow_st.data_type = "FLOAT"; glow_st.domain = "POINT"
glow_st.inputs["Name"].default_value = "glow"
G.links.new(GI.outputs[0], glow_st.inputs["Geometry"])
feed(mix(1.0, 0.08 + 2.6 * wb + 1.2 * nearv, I["Calm"]), glow_st.inputs["Value"])


def set_pos(offset):
    n = G.nodes.new("GeometryNodeSetPosition")
    G.links.new(glow_st.outputs[0], n.inputs["Geometry"])
    feed(offset, n.inputs["Offset"])
    return n.outputs[0]


def rot_vec(v, r):
    n = G.nodes.new("FunctionNodeRotateVector"); feed(v, n.inputs["Vector"]); feed(r, n.inputs["Rotation"])
    return Ex(n.outputs[0])


def rot_rot(r, by):
    n = G.nodes.new("FunctionNodeRotateRotation"); n.rotation_space = "LOCAL"
    feed(r, n.inputs["Rotation"]); feed(by, n.inputs["Rotate By"])
    return Ex(n.outputs[0])


scv = xyz(sc, sc, sc * squash)
scv1 = xyz(sc, sc, sc)


def vsum(a, b):
    n = G.nodes.new("ShaderNodeVectorMath"); n.operation = "ADD"
    feed(a, n.inputs[0]); feed(b, n.inputs[1])
    return Ex(n.outputs[0])
join_n = G.nodes.new("GeometryNodeJoinGeometry")
G.links.new(instance(set_pos(pos_off), coll_info(BODY_COLL), attr("var"), fig_rot, scv), join_n.inputs[0])
for side, aname in ((1, "arm_r"), (-1, "arm_l")):
    rx, ry = arm_pose(side)
    # two-part arm at natural length: shoulders lift when the arm goes up, the elbow keeps a
    # slight bend and the forearm/wrist swings with the beat
    upness = clamp(-(cos(rx) * cos(ry)))
    shoulder = vsum(rot_vec(xyz(side * 0.165 * sc, 0.0, (0.56 + 0.06 * upness) * sc * squash), fig_rot), pos_off)
    up_rot = rot_rot(fig_rot, euler(xyz(rx, ry, 0.0)))
    elbow = vsum(shoulder, rot_vec(xyz(0.0, 0.0, -UPPER * sc), up_rot))
    bend = 0.28 + 0.22 * sin(B * PI + lag2 * 2.0 + side) + 0.15 * s1w
    low_rot = rot_rot(up_rot, euler(xyz(bend, 0.0, 0.35 * sin(B * PI * 0.5 + lag2 + side))))
    G.links.new(instance(set_pos(shoulder), coll_info(UPPER_COLL), 0, up_rot, scv1), join_n.inputs[0])
    G.links.new(instance(set_pos(elbow), coll_info(ARMS_COLL), attr(aname), low_rot, scv1), join_n.inputs[0])
G.links.new(join_n.outputs[0], GO.inputs[0])
mod = crowd.modifiers.new("crowd", "NODES")
mod.node_group = G
SOCK = {it.name: it.identifier for it in G.interface.items_tree if it.item_type == "SOCKET" and it.in_out == "INPUT"}

# ------------------------------------------------------------------ music -> modifier inputs
# Beat counter: +1 on every kick; where there is no kick, a grid that follows the music
# (96 bpm music box, half-time breakdown, the accelerating snare roll of the build).
B124 = 60 / 124
pulses = [0.3 + i * 0.625 for i in range(int((SEC["horn"] - 0.3) / 0.625) + 1)]
pulses += [SEC["horn"] + i * B124 for i in range(int((SEC["house-intro"] - SEC["horn"]) / B124) + 1)]
pulses += [k for k in KICKS]
t = SEC["breakdown"]
while t < SEC["build"]:
    if not any(abs(t - k) < 0.2 for k in KICKS):
        pulses.append(t)
    t += 2 * B124
snares = sorted({round(e["t"], 3) for e in EVENTS if e["part"] == "drums" and e["midi"] in (18, 19) and SEC["build"] <= e["t"] < SEC["silence"]})
pulses += snares if snares else [SEC["build"] + i * B124 for i in range(7)]
last = max(KICKS)
pulses += [last + i * B124 for i in range(1, int((SONG_LEN + 1 - last) / B124) + 2)]
pulses = sorted(pulses)
clean = []
for p_ in pulses:
    if not clean or p_ - clean[-1] > 0.09:
        clean.append(p_)
mpath = lambda n_: getattr(mod.properties.inputs, SOCK[n_]).path_from_id("value")   # Blender 5 modifier inputs
bake(crowd, mpath("Beat"), 0, [(F(p_), float(i)) for i, p_ in enumerate(clean)], interp="LINEAR")

P = {   # section: Bounce, Sway, Groove, HandsUp, Phone, Crouch
    "windup": (0.02, 1.0, 0.15, 0.0, 0.0, 0.0), "musicbox": (0.03, 1.0, 0.2, 0.0, 0.0, 0.0),
    "horn": (0.15, 0.3, 0.3, 1.0, 0.0, 0.0), "house-intro": (0.13, 0.6, 0.7, 0.0, 0.0, 0.0),
    "house": (0.22, 0.4, 1.0, 0.1, 0.0, 0.0), "filter-dip": (0.12, 0.6, 0.8, 0.0, 0.0, 0.0),
    "name-2": (0.16, 0.3, 0.5, 1.0, 0.0, 0.0), "stutter": (0.2, 0.3, 1.0, 0.0, 0.0, 0.0),
    "breakdown": (0.04, 1.0, 0.2, 0.0, 1.0, 0.0), "build": (0.1, 0.2, 0.8, 0.15, 0.0, 0.0),
    "silence": (0.0, 0.0, 0.0, 0.85, 0.0, 1.0), "drop": (0.42, 0.2, 1.0, 0.5, 0.0, 0.0),
    "name-3": (0.26, 0.2, 0.6, 1.0, 0.0, 0.0), "machine-gun": (0.35, 0.2, 1.0, 0.2, 0.0, 0.0),
    "rewind": (0.1, 0.5, 0.5, 0.6, 0.0, 0.0), "countdown": (0.16, 0.3, 0.6, 0.5, 0.0, 0.0),
    "encore-key-1": (0.36, 0.2, 1.0, 0.08, 0.0, 0.0), "encore-key-2": (0.37, 0.2, 1.0, 0.08, 0.0, 0.0),   # low hands so the wave band stands out
    "encore-key-3": (0.38, 0.2, 1.0, 0.1, 0.0, 0.0), "encore-key-4": (0.4, 0.2, 1.0, 0.12, 0.0, 0.0),
    "fireworks": (0.15, 0.6, 0.4, 1.0, 0.0, 0.0),
}
for j, n_ in enumerate(("Bounce", "Sway", "Groove", "HandsUp", "Phone", "Crouch")):
    ks = []
    for s in TL["sections"]:
        v = P[s["id"]][j]
        ramp = 0.06 if s["id"] in ("silence", "drop") else 0.25
        prev = ks[-1][1] if ks else v
        ks += [(F(s["start"] - ramp), prev), (F(s["start"]), v)]
    if n_ == "Bounce":                                     # the build gets faster and bigger
        ks = [kv for kv in ks if not (F(SEC["build"]) < kv[0] < F(SEC["silence"]) - 3)]
        ks += [(F(SEC["build"]) + 1, 0.08), (F(SEC["silence"]) - 3, 0.3)]
    if n_ == "HandsUp":
        ks += [(F(SEC["silence"]) - 12, 0.15), (F(SEC["silence"]) - 2, 0.8)]
        dd = SEC["drop"]                                    # arms stay up through the first jumps of the drop
        ks = [kv for kv in ks if not (F(dd) - 1 <= kv[0] <= F(dd + 2.2))] + [(F(dd) - 1, 0.9), (F(dd + 1.3), 1.0), (F(dd + 2.2), 0.5)]
    bake(crowd, mpath(n_), 0, sorted(ks), interp="LINEAR")
d = SEC["drop"]
# how locked to the kick the rows are: loose in the intro, tight in house, one body on the drop
SYNC = {"windup": 0.0, "house-intro": 0.4, "house": 0.6, "breakdown": 0.3, "build": 0.7, "drop": 1.0, "name-3": 0.7,
        "machine-gun": 0.85, "rewind": 0.5, "countdown": 0.6, "encore-key-1": 0.75, "fireworks": 0.4}
sk, cur = [(1, 0.0)], 0.0
for s_ in TL["sections"]:
    if s_["id"] in SYNC:
        sk += [(F(s_["start"]) - 3, cur), (F(s_["start"]), SYNC[s_["id"]])]
        cur = SYNC[s_["id"]]
sk = [kv for kv in sk if not (F(d) - 3 <= kv[0] <= F(d + 5))] + [(F(d) - 3, 0.7), (F(d) - 1, 1.0), (F(d + 5), 1.0), (F(d + 7), 0.8)]
bake(crowd, mpath("Sync"), 0, sorted(sk), interp="LINEAR")
# everybody is in the air on the first frame after the blackout
bake(crowd, mpath("Leap"), 0, [(1, 0.0), (F(d) - 5, 0.0), (F(d) + 0.5, 1.0), (F(d) + 4, 0.7), (F(d) + 9, 0.0)])
# the wave coordinate runs 0 (bottom-left of the shot) -> 1 (top-right); the crowd fills ~0-0.7 of it,
# so the band crosses the middle of the crowd (0.35) 0.5 s after each key change
wk = [(1, -0.5)]
for ke in ENCORE:
    wk += [(F(ke) - 1.2, -0.5), (F(ke) - 0.7, -0.15), (F(ke + 1.7), 0.85), (F(ke + 2.2), 1.3)]
bake(crowd, mpath("WaveT"), 0, wk, interp="LINEAR")
ENC_END = SEC["fireworks"]
# Shot 3 = the drop close-up (camera 13), 1/2 = the encore cameras; Near turns the rows nearest that lens
bake(crowd, mpath("Shot"), 0, [(1, 0.0), (F(SEC["drop"]) - 1, 3.0), (F(52.6) - 0.5, 0.0), (F(ENCORE[0]) - 0.5, 1.0),
                               (F(ENCORE[2]) - 0.5, 2.0), (F(ENC_END) - 0.5, 0.0)], interp="CONSTANT")
bake(crowd, mpath("Near"), 0, [(1, 0.0), (F(SEC["drop"]) - 1, 1.0), (F(52.6) - 0.5, 1.0), (F(52.6), 0.0),
                               (F(ENCORE[0]) - 6, 0.0), (F(ENCORE[0]) - 0.5, 1.0), (F(ENC_END) - 6, 1.0), (F(ENC_END), 0.0)], interp="LINEAR")
STICK_CONTRAST = {0: "#4dffd2", 1: "#ff4fb0", 2: "#a07bff", 3: "#ffd23a"}    # under pink, mint, gold, violet
for m_ in m_stick.values():
    nt_ = m_.node_tree
    ck = {0: [], 1: [], 2: []}
    for i_, ke in enumerate(ENCORE):
        for ax in range(3):
            ck[ax].append((F(ke), hexrgb(STICK_CONTRAST[i_])[ax]))
    for ax in range(3):
        bake(nt_, 'nodes["contrast"].outputs[0].default_value', ax, ck[ax], interp="CONSTANT")
    bake(nt_, 'nodes["enc"].outputs[0].default_value', 0,
         [(1, 0.0), (F(ENCORE[0]) - 1, 0.0), (F(ENCORE[0]), 0.9), (F(ENC_END), 0.9), (F(ENC_END) + 1, 0.0)], interp="CONSTANT")
bake(crowd, mpath("Calm"), 0, [(1, 0.0), (F(ENCORE[0]) - 6, 0.0), (F(ENCORE[0]) - 0.5, 1.0), (F(ENC_END) - 6, 1.0), (F(ENC_END), 0.0)], interp="LINEAR")

# ------------------------------------------------------------------ object rigs (holders, crew, bartenders)
HANDS_UP = ("name-2", "name-3", "rewind", "fireworks")
CHEER = [(17.375, 18.6)]
HYPE = ("drop", "machine-gun", "encore-key-1", "encore-key-2", "encore-key-3", "encore-key-4", "countdown")
SPARK_ON, SPARK_OFF = SEC["drop"] + 1.2, SEC["machine-gun"] + 1.0
CANDLE_ON, CANDLE_OFF = ENCORE[0], SEC["fireworks"]
RIG_K = {"floor": 1.0, "bartender": 0.15, "crew": 0.0}
skin_mats = {}
for r in RIGS:
    o = new_obj("rig", r["mesh"], loc=(r["x"], r["y"], r["z"]), coll=C)
    o.rotation_euler = (0, 0, r["rotz"])
    o.scale = (r["sc"],) * 3
    r["o"] = o
    cols = r.get("cols") or dict(skin=SKIN[0], shirt="#1c1626")
    key = (cols["skin"], cols["shirt"])
    if key not in skin_mats:
        skin_mats[key] = (principled("c_rigskin_%d" % len(skin_mats), cols["skin"], rough=0.5, coat=0.3),
                          principled("c_rigshirt_%d" % len(skin_mats), cols["shirt"], rough=0.5, coat=0.3))
    for side in (1, -1):
        prop = r["role"] if (side == 1 and r["role"] in ("sparkler", "candle")) else "plain"
        a = new_obj("rig_arm", RIG_ARM[prop], loc=(side * 0.165, 0.0, 0.56), coll=C, parent=o)
        for i in (0, 1):
            a.material_slots[i].link = "OBJECT"
            a.material_slots[i].material = skin_mats[key][i]
        r["arm_r" if side == 1 else "arm_l"] = a
    r["lag"] = random.uniform(0.0, 2.2)
    r["amp"] = random.uniform(0.9, 1.2)


def rig_pose(r, side, t, beat):
    sec = section_at(t)
    out = -side
    rest = (0.15, out * 0.22)
    if r["zone"] == "crew":
        launch = any(L_ - 1.6 < t < L_ - 0.6 for L_ in ENCORE + [SEC["fireworks"]])
        return (1.35, out * 0.1) if (side == 1 and launch) else rest
    if r["zone"] == "bartender":
        return (0.9, out * 0.1) if side == 1 and (r["lag"] > 1.2) else rest
    holding = side == 1 and ((r["role"] == "sparkler" and SPARK_ON <= t < SPARK_OFF) or (r["role"] == "candle" and CANDLE_ON <= t < CANDLE_OFF))
    if holding:
        return (2.45 + 0.05 * math.sin(t * 3 + r["lag"]), out * 0.15)
    if any(a <= t < b for a, b in CHEER) or sec in HANDS_UP:
        return (0.3, out * (2.65 + 0.25 * math.sin(t * 4.1 + r["lag"]) * side))
    if sec in HYPE or sec in ("house", "stutter"):
        return (2.7 if beat % 2 == 0 else 2.2, out * 0.2) if side == 1 else (0.6, out * 0.35)
    return (0.2 + 0.15 * math.sin(t * 2.0 + r["lag"] + side), out * 0.25)


MOMENTS = sorted(set([round(k_, 3) for k_ in KICKS] + [round(s["start"], 3) for s in TL["sections"]] +
                     [round(x * 0.25, 3) for x in range(int(SONG_LEN * 4) + 1)]))
kick_index, ki = [], 0
for t in MOMENTS:
    while ki + 1 < len(KICKS) and KICKS[ki + 1] <= t + 1e-6:
        ki += 1
    kick_index.append(ki)
BOUNCE = {s: P[s][0] for s in P}
for r in RIGS:
    lagf, zk, base = r["lag"], RIG_K.get(r["zone"], 1.0) * r["amp"], r["z"]
    zkeys = [(1, base)]
    t = 0.0
    while t < SEC["house-intro"]:
        zkeys += [(F(t) + lagf * 6, base), (F(t + 0.6) + lagf * 6, base + 0.012 * zk)]
        t += 1.2
    for i, k_ in enumerate(KICKS):
        amp = BOUNCE.get(section_at(k_), 0.0) * zk
        if r["role"] == "candle" and CANDLE_ON <= k_ < CANDLE_OFF:
            amp *= 0.15
        nxt = KICKS[i + 1] if i + 1 < len(KICKS) else k_ + 0.5
        half = min(0.25, (nxt - k_) / 2)
        zkeys += [(F(k_) + lagf, base), (F(k_ + half) + lagf, base + amp)] if amp > 0 else [(F(k_) + lagf, base)]
    bake(r["o"], "location", 2, zkeys)
    for side in (1, -1):
        arm = r["arm_r" if side == 1 else "arm_l"]
        rx, ry, last = [], [], None
        for t, bi in zip(MOMENTS, kick_index):
            p_ = rig_pose(r, side, t, bi)
            if p_ != last or t == MOMENTS[-1]:
                ff = F(t) + lagf * 0.6
                if last is not None and max(abs(p_[0] - last[0]), abs(p_[1] - last[1])) > 0.5:
                    rx.append((ff - 2.5, last[0])); ry.append((ff - 2.5, last[1]))
                rx.append((ff, p_[0])); ry.append((ff, p_[1]))
                last = p_
        bake(arm, "rotation_euler", 0, rx)
        bake(arm, "rotation_euler", 1, ry)

# phone flashes on in breakdown, name-2 and fireworks; screens glow softly all night
bake(m_flash.node_tree, socket_path(m_flash.node_tree.nodes["Emission"], "Strength"), 0,
     [(1, 0.0), (F(SEC["name-2"]), 18.0), (F(SEC["stutter"]), 0.0), (F(SEC["breakdown"]), 18.0), (F(SEC["build"]), 0.0),
      (F(SEC["fireworks"]), 18.0)], interp="CONSTANT")

# hand data for fireworks.py (sparkler tips and roman-candle muzzles)
hands = [dict(name=r["arm_r"].name, role=r["role"], tip=list(PROP_TIP[r["role"]])) for r in RIGS if r["role"] in ("sparkler", "candle")]
crew = [[r["x"], r["y"], r["z"]] for r in RIGS if r["zone"] == "crew"]
txt = bpy.data.texts.get("crowd_hands.json") or bpy.data.texts.new("crowd_hands.json")
txt.from_string(json.dumps(dict(hands=hands, crew=crew, spark=[SPARK_ON, SPARK_OFF], candle=[CANDLE_ON, CANDLE_OFF])))
print("crowd ok:", len(figs), "GN figures,", len(RIGS), "rigs,", len(G.nodes), "nodes,", len(clean), "beats;",
      {z: sum(1 for f in figs if f["zone"] == z) for z in ZONE_K})
