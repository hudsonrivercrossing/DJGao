# Fireworks for DJ GAO's birthday: aerial shells launched by the stage crew, stage gerbs,
# confetti cannons, sparklers and roman candles in the crowd, burst lights.
# Every spark is precomputed here as one point (start, velocity, t0, life, drag, ...) and a
# Geometry Nodes tree moves it with closed-form linear-drag ballistics each frame, so the
# render is deterministic and cheap. Run after crowd.py: node send.js common.py fireworks.py
C = fresh_collection("Fireworks")
random.seed(2026)
for g in ("fw_ballistic", "fw_confetti", "fw_sparkler"):
    if bpy.data.node_groups.get(g):
        bpy.data.node_groups.remove(bpy.data.node_groups[g])

COL = {"rose": lin(ROSE), "lilac": lin(LILAC), "mint": lin(MINT), "gold": lin(GOLD), "white": lin(INK),
       "warm": lin("#ffc070")}


# ------------------------------------------------------------------ GN helpers
class Tree:
    def __init__(self, name):
        self.g = bpy.data.node_groups.new(name, "GeometryNodeTree")
        self.g.interface.new_socket("Geometry", in_out="INPUT", socket_type="NodeSocketGeometry")
        self.g.interface.new_socket("Geometry", in_out="OUTPUT", socket_type="NodeSocketGeometry")
        self.gi = self.n("NodeGroupInput")
        self.go = self.n("NodeGroupOutput")

    def n(self, kind, **props):
        node = self.g.nodes.new(kind)
        for k, v in props.items():
            setattr(node, k, v)
        return node

    def L(self, a, b):
        self.g.links.new(a, b)

    def sock(self, x, node, idx):
        if isinstance(x, (int, float)):
            node.inputs[idx].default_value = x
        elif isinstance(x, tuple):
            node.inputs[idx].default_value = x
        else:
            self.L(x, node.inputs[idx])

    def math(self, op, a, b=None):
        m = self.n("ShaderNodeMath", operation=op)
        self.sock(a, m, 0)
        if b is not None:
            self.sock(b, m, 1)
        return m.outputs[0]

    def vmath(self, op, a, b=None, scale=None):
        m = self.n("ShaderNodeVectorMath", operation=op)
        self.sock(a, m, 0)
        if b is not None:
            self.sock(b, m, 1)
        if scale is not None:
            self.sock(scale, m, "Scale")
        return m.outputs["Value"] if op in ("LENGTH", "DOT_PRODUCT", "DISTANCE") else m.outputs["Vector"]

    def attr(self, name, vec=False):
        a = self.n("GeometryNodeInputNamedAttribute", data_type="FLOAT_VECTOR" if vec else "FLOAT")
        a.inputs["Name"].default_value = name
        return a.outputs["Attribute"]

    def xyz(self, x, y, z):
        c = self.n("ShaderNodeCombineXYZ")
        for i, v in enumerate((x, y, z)):
            self.sock(v, c, i)
        return c.outputs[0]

    def time(self):
        st = self.n("GeometryNodeInputSceneTime")
        return self.math("DIVIDE", self.math("SUBTRACT", st.outputs["Frame"], 1.0), float(FPS))


def ballistic_tree(name, confetti=False):
    T = Tree(name)
    t = T.time()
    age = T.math("SUBTRACT", t, T.attr("t0"))
    life = T.attr("life")
    dead = T.math("MAXIMUM", T.math("LESS_THAN", age, 0.0), T.math("GREATER_THAN", age, life))
    dele = T.n("GeometryNodeDeleteGeometry", domain="POINT")
    T.L(T.gi.outputs[0], dele.inputs["Geometry"])
    T.L(dead, dele.inputs["Selection"])
    age = T.math("MAXIMUM", age, 0.0)
    k = T.math("MAXIMUM", T.attr("drag"), 0.02)
    e = T.math("EXPONENT", T.math("MULTIPLY", T.math("MULTIPLY", k, age), -1.0))
    A = T.math("DIVIDE", T.math("SUBTRACT", 1.0, e), k)
    gk = T.math("DIVIDE", T.math("MULTIPLY", T.attr("grav"), 9.8), k)
    vel = T.attr("vel", vec=True)
    off = T.vmath("ADD", T.vmath("SCALE", vel, scale=A), T.xyz(0, 0, T.math("MULTIPLY", gk, T.math("SUBTRACT", A, age))))
    v_now = T.vmath("ADD", T.vmath("SCALE", vel, scale=e), T.xyz(0, 0, T.math("MULTIPLY", gk, T.math("SUBTRACT", e, 1.0))))
    sp = T.n("GeometryNodeSetPosition")
    T.L(dele.outputs[0], sp.inputs["Geometry"])
    T.L(off, sp.inputs["Offset"])
    # brightness: fade over life, optional crackle flicker, bright first frames
    u = T.math("DIVIDE", age, life)
    fade = T.math("POWER", T.math("MAXIMUM", T.math("SUBTRACT", 1.0, u), 0.0), 1.5)
    idx = T.n("GeometryNodeInputIndex").outputs[0]
    wob = T.math("SINE", T.math("ADD", T.math("MULTIPLY", age, 61.0), T.math("MULTIPLY", idx, 1.37)))
    flick = T.math("SUBTRACT", 1.0, T.math("MULTIPLY", T.attr("flick"), T.math("MULTIPLY", T.math("ADD", wob, 1.0), 0.5)))
    flash = T.math("ADD", 1.0, T.math("MULTIPLY", 2.0, T.math("MAXIMUM", T.math("SUBTRACT", 1.0, T.math("DIVIDE", age, 0.1)), 0.0)))
    b = T.math("MULTIPLY", T.math("MULTIPLY", fade, flick), flash)
    if confetti:
        b = T.math("MINIMUM", T.math("MULTIPLY", T.math("SUBTRACT", 1.0, u), 6.0), 1.0)
    col = T.vmath("SCALE", T.attr("col", vec=True), scale=b)
    st = T.n("GeometryNodeStoreNamedAttribute", data_type="FLOAT_VECTOR", domain="POINT")
    T.L(sp.outputs[0], st.inputs["Geometry"])
    st.inputs["Name"].default_value = "fw_col"
    T.L(col, st.inputs["Value"])
    size = T.attr("size")
    inst = T.n("GeometryNodeInstanceOnPoints")
    T.L(st.outputs[0], inst.inputs["Points"])
    if confetti:
        grid = T.n("GeometryNodeMeshGrid")
        grid.inputs["Size X"].default_value, grid.inputs["Size Y"].default_value = 1.0, 0.6
        grid.inputs["Vertices X"].default_value = grid.inputs["Vertices Y"].default_value = 2
        T.L(grid.outputs["Mesh"], inst.inputs["Instance"])
        spin = T.attr("spin", vec=True)
        eul = T.vmath("ADD", T.vmath("SCALE", spin, scale=age), T.vmath("SCALE", spin, scale=3.0))
        rot = T.n("FunctionNodeEulerToRotation")
        T.L(eul, rot.inputs[0])
        T.L(rot.outputs[0], inst.inputs["Rotation"])
        T.L(T.xyz(size, size, size), inst.inputs["Scale"])
    else:
        cy = T.n("GeometryNodeMeshCylinder")
        cy.inputs["Vertices"].default_value = 6
        cy.inputs["Radius"].default_value, cy.inputs["Depth"].default_value = 1.0, 1.0
        tr = T.n("GeometryNodeTransform")
        T.L(cy.outputs["Mesh"], tr.inputs["Geometry"])
        tr.inputs["Translation"].default_value = (0, 0, -0.5)
        T.L(tr.outputs[0], inst.inputs["Instance"])
        al = T.n("FunctionNodeAlignRotationToVector", axis="Z")
        T.L(v_now, al.inputs["Vector"])
        T.L(al.outputs[0], inst.inputs["Rotation"])
        length = T.math("ADD", T.math("MULTIPLY", T.vmath("LENGTH", v_now), T.attr("trail")), T.math("MULTIPLY", size, 2.0))
        T.L(T.xyz(size, size, length), inst.inputs["Scale"])
    sm = T.n("GeometryNodeSetMaterial")
    T.L(inst.outputs[0], sm.inputs["Geometry"])
    rz = T.n("GeometryNodeRealizeInstances")              # changing topology: EEVEE leaves it out of motion blur
    T.L(sm.outputs[0], rz.inputs[0])
    T.L(rz.outputs[0], T.go.inputs[0])
    return T.g, sm


def instancer_material(name, emissive=True):
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    a = nt.nodes.new("ShaderNodeAttribute"); a.attribute_type = "GEOMETRY"; a.attribute_name = "fw_col"   # realized below
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    if emissive:
        e = nt.nodes.new("ShaderNodeEmission")
        nt.links.new(a.outputs["Color"], e.inputs["Color"])
        e.inputs["Strength"].default_value = 1.0
        nt.links.new(e.outputs[0], out.inputs[0])
    else:
        p = nt.nodes.new("ShaderNodeBsdfPrincipled")
        nt.links.new(a.outputs["Color"], p.inputs["Base Color"])
        nt.links.new(a.outputs["Color"], p.inputs["Emission Color"])
        p.inputs["Emission Strength"].default_value = 3.0
        p.inputs["Roughness"].default_value = 0.4
        nt.links.new(p.outputs[0], out.inputs[0])
    return m


# ------------------------------------------------------------------ spark data
SPARKS, CONF = [], []


def spark(p0, vel, t0, life, drag=1.3, grav=0.35, size=0.05, trail=0.06, col="gold", gain=20.0, flick=0.0):
    c = COL[col] if isinstance(col, str) else col
    SPARKS.append((tuple(p0), tuple(vel), t0, life, drag, grav, size, trail, tuple(x * gain for x in c), flick))


def launch_vel(p0, p1, T, k, grav):
    """Initial velocity that carries a linear-drag projectile from p0 to p1 in T seconds."""
    e = math.exp(-k * T)
    A = (1 - e) / k
    gk = grav * 9.8 / k
    d = Vector(p1) - Vector(p0)
    return Vector((d.x / A, d.y / A, (d.z - gk * (A - T)) / A))


def pos_at(p0, vel, k, grav, age):
    e = math.exp(-k * age)
    A = (1 - e) / k
    gk = grav * 9.8 / k
    return Vector(p0) + Vector(vel) * A + Vector((0, 0, gk * (A - age)))


def sphere_dirs(n):
    ga = math.pi * (3 - math.sqrt(5))
    for i in range(n):
        z = 1 - 2 * (i + 0.5) / n
        r = math.sqrt(1 - z * z)
        yield Vector((r * math.cos(i * ga), r * math.sin(i * ga), z))


BURSTS = []           # (t, pos, colour) for the burst lights


def shell(t, pos, kind="peony", col="rose", col2=None, launch=None, rise=1.0, n=150):
    """One aerial shell. If launch is given, a rocket with a trail rises for `rise` s first."""
    pos = Vector(pos)
    if launch is not None:
        t_l = t - rise
        k, gr = 0.25, 1.0
        v = launch_vel(launch, pos, rise, k, gr)
        spark(launch, v, t_l, rise, k, gr, 0.07, 0.05, "warm", 30.0)
        steps = int(rise * 45)
        for s in range(steps):
            a = s / 45
            p = pos_at(launch, v, k, gr, a)
            jitter = Vector((random.gauss(0, 0.4), random.gauss(0, 0.4), random.gauss(0, 0.4)))
            spark(p, jitter, t_l + a, random.uniform(0.35, 0.6), 2.5, 0.3, 0.035, 0.02, "warm", 9.0, 0.6)
    BURSTS.append((t, pos, col))
    speed = random.uniform(8.5, 10.5)
    if kind == "peony":
        for d in sphere_dirs(n):
            d = (d + Vector([random.gauss(0, 0.05) for _ in range(3)])).normalized()
            c = col if (col2 is None or random.random() < 0.6) else col2
            spark(pos, d * speed * random.uniform(0.92, 1.05), t + random.uniform(0, 0.03), random.uniform(1.4, 2.0),
                  1.35, 0.35, 0.055, 0.07, c, 22.0, 0.35)
    elif kind == "willow":
        for d in sphere_dirs(n):
            spark(pos, d * speed * 0.75, t, random.uniform(2.1, 2.7), 1.05, 0.8, 0.035, 0.07, "gold", 16.0, 0.55)
    elif kind == "ring":
        ax = Vector((random.uniform(-0.4, 0.4), random.uniform(-1, -0.6), random.uniform(-0.3, 0.3))).normalized()
        u = ax.orthogonal().normalized(); w = ax.cross(u)
        for i in range(n // 2):
            a = 2 * math.pi * i / (n // 2)
            d = u * math.cos(a) + w * math.sin(a)
            spark(pos, d * speed, t, random.uniform(1.5, 1.9), 1.4, 0.3, 0.06, 0.06, col, 24.0, 0.2)
        for d in sphere_dirs(30):
            spark(pos, d * speed * 0.35, t, 1.0, 1.6, 0.3, 0.05, 0.04, col2 or "white", 20.0)
    elif kind == "heart":                                         # heart in the plane facing the crowd
        for i in range(n):
            a = 2 * math.pi * i / n
            x = 16 * math.sin(a) ** 3
            z = 13 * math.cos(a) - 5 * math.cos(2 * a) - 2 * math.cos(3 * a) - math.cos(4 * a)
            d = Vector((x, -0.15 * random.random(), z + 2)) / 17
            spark(pos, d * speed * 1.1, t, random.uniform(1.6, 2.0), 1.6, 0.18, 0.06, 0.05, col, 26.0, 0.1)


def gerbs(t0, dur, xs=(-5.2, -3.1, -1.0, 1.0, 3.1, 5.2), rate=55, col="gold", height=1.0):
    for x in xs:
        n = int(dur * rate)
        for i in range(n):
            t = t0 + i / rate + random.uniform(0, 1 / rate)
            a, r = random.uniform(0, 2 * math.pi), random.uniform(0, 0.16)
            v = Vector((math.cos(a) * r, math.sin(a) * r - 0.05, 1)).normalized() * random.uniform(6.5, 8.5) * height
            spark((x, -0.55, 0.05), v, t, random.uniform(0.9, 1.3), 0.9, 1.0, 0.03, 0.05,
                  col if random.random() < 0.8 else "white", 18.0, 0.4)


def comet(t, x, col):
    v = Vector((random.uniform(-0.6, 0.6), random.uniform(-0.8, 0.2), 1)).normalized() * 13
    spark((x, -0.55, 0.05), v, t, 1.1, 0.5, 1.0, 0.08, 0.1, col, 24.0)


def confetti(t, origin, n, aim=(0, -1, 1), spread=0.5, speed=(8, 12)):
    aim = Vector(aim).normalized()
    for i in range(n):
        d = (aim + Vector([random.gauss(0, spread) for _ in range(3)])).normalized()
        c = random.choice([ROSE, LILAC, MINT, GOLD, INK])
        CONF.append((tuple(origin), tuple(d * random.uniform(*speed)), t + random.uniform(0, 0.15), random.uniform(5.5, 8.0),
                     random.uniform(1.0, 1.6), 0.28, random.uniform(0.05, 0.08), 0.0, tuple(lin(c)), 0.0,
                     (random.uniform(-9, 9), random.uniform(-9, 9), random.uniform(-9, 9))))


# ------------------------------------------------------------------ the show
info = json.loads(bpy.data.texts["crowd_hands.json"].as_string())
crew = info["crew"]
RACKS = [Vector((c[0] + (0.5 if c[0] > 0 else -0.5), c[1] + 0.3, 0.3)) for c in crew]


m_rack = principled("fw_rack", "#2a2433", rough=0.5, metal=0.4)
m_tube = principled("fw_tube", "#6b4a7a", rough=0.5)
for r in RACKS:
    rbox("rack", (r.x, r.y, 0.12), (0.7, 0.5, 0.24), m_rack, bevel=0.02, coll=C)
    for ix in range(3):
        for iy in range(2):
            cyl("tube", (r.x - 0.2 + ix * 0.2, r.y - 0.1 + iy * 0.2, 0.36), 0.07, 0.3, m_tube, seg=10, coll=C)


def rnd_sky(xr=(-8, 8), yr=(1.5, 9), zr=(9.5, 14.5)):
    return (random.uniform(*xr), random.uniform(*yr), random.uniform(*zr))


# horn: party poppers in the crowd
for x in (-3.0, 0.5, 3.5):
    confetti(SEC["horn"], (x, -5.5, 0.4), 50, aim=(0, 0.2, 1), spread=0.35, speed=(4, 6))
# DROP: everything at once
d = SEC["drop"]
for i, (c, c2) in enumerate((("rose", "gold"), ("mint", "white"), ("lilac", "rose"), ("gold", "mint"))):
    shell(d + i * 0.08, rnd_sky(xr=(-7 + i * 3.5, -4 + i * 3.5)), "peony", c, c2)
gerbs(d, 3.0)
for x in (-4.0, 4.0):
    confetti(d, (x, -0.6, 0.4), 260, aim=(-0.15 * x / 4, -1, 1.2))
for x in (-1.3, 1.3):                                           # centre cannons: confetti fills the drop close-up
    confetti(d - 0.05, (x, -0.75, 0.3), 220, aim=(-0.2 * x, -0.7, 1.4), spread=0.45, speed=(6, 10))
drop_kicks = [k for k in KICKS if d <= k < SEC["name-3"]]
for j, k in enumerate(drop_kicks[8::16]):
    for r in random.sample(RACKS, 2):
        shell(k, rnd_sky(), random.choice(("peony", "ring")), random.choice(("rose", "mint", "lilac", "gold")), "white", launch=r)
# name-3: hearts for the birthday girl
n3 = SEC["name-3"]
shell(n3, (-3.5, 4.0, 11.5), "heart", "rose", launch=RACKS[0], rise=1.1, n=120)
shell(n3 + 0.25, (3.5, 4.0, 11.5), "heart", "rose", launch=RACKS[2], rise=1.1, n=120)
shell(n3 + 1.9, (0.0, 5.0, 13.5), "heart", "gold", launch=RACKS[1], rise=1.2, n=140)
shell(n3 + 2.6, rnd_sky(), "willow", launch=RACKS[3])
gerbs(n3, 2.0, col="gold")
for x in (-4.0, 4.0):
    confetti(n3, (x, -0.6, 0.4), 140, aim=(0, -1, 1.3))
# machine-gun: stage comets on the kicks
for j, k in enumerate(k for k in KICKS if SEC["machine-gun"] <= k < SEC["rewind"]):
    comet(k, (-5.2, -3.1, -1.0, 1.0, 3.1, 5.2)[j % 6], ("rose", "mint", "gold", "lilac")[j % 4])
# countdown: three gerb pulses
for e in EVENTS:
    if e["part"] == "sfx" and SEC["countdown"] <= e["t"] < ENCORE[0] and e["midi"] == 29:
        gerbs(e["t"], 0.3, rate=70, col="white", height=0.8)
# encore: a volley on every key change, the crew lights the racks one second before
KEYC = ["rose", "mint", "gold", "lilac"]
for i, ke in enumerate(ENCORE):
    c = KEYC[i]
    for j, r in enumerate(RACKS):
        shell(ke + j * 0.07, rnd_sky(xr=(-8 + j * 4, -4 + j * 4)), ("peony", "ring", "peony", "ring")[(i + j) % 4], c, "white", launch=r)
    gerbs(ke, 1.0, col=c)
    half = ke + (ENCORE[i + 1] - ke if i < 3 else SEC["fireworks"] - ke) / 2
    shell(half, rnd_sky(), "peony", KEYC[(i + 1) % 4], c, launch=random.choice(RACKS))
# roman candles held in the crowd (encore)
scene.frame_set(int(F(74.0)))
c_on, c_off = info["candle"]
for h in info["hands"]:
    if h["role"] != "candle":
        continue
    arm = bpy.data.objects[h["name"]]
    tip = arm.matrix_world @ Vector(h["tip"])
    t = c_on + random.uniform(0, 0.6)
    c = random.choice(("rose", "mint", "gold", "lilac"))
    while t < c_off - 0.3:
        v = Vector((random.uniform(-0.12, 0.12), random.uniform(0.0, 0.25), 1)).normalized() * random.uniform(10, 12.5)
        spark(tip, v, t, 1.25, 0.35, 1.0, 0.07, 0.07, c, 26.0)
        for s in range(6):                                          # muzzle sparks
            spark(tip, Vector([random.gauss(0, 1.2) for _ in range(2)] + [random.uniform(1, 3)]), t, 0.3, 2.0, 0.5, 0.02, 0.03, "warm", 14.0)
        t += random.uniform(0.55, 0.8)
# finale: fireworks + applause
fw = SEC["fireworks"]
plan = [(0.0, "willow", "gold"), (0.05, "peony", "rose"), (0.1, "peony", "mint"), (0.5, "ring", "lilac"), (0.9, "peony", "gold"),
        (1.3, "heart", "rose"), (1.6, "peony", "mint"), (2.0, "willow", "gold"), (2.3, "ring", "rose"), (2.6, "peony", "lilac"),
        (3.0, "peony", "gold"), (3.2, "heart", "rose"), (3.5, "willow", "gold"), (3.8, "peony", "mint"), (4.1, "ring", "gold"),
        (4.4, "peony", "rose"), (4.7, "willow", "gold"), (5.0, "peony", "lilac")]
for j, (dt, kind, c) in enumerate(plan):
    p = (0.0, 4.5, 12.5) if kind == "heart" else rnd_sky()
    shell(fw + dt, p, kind, c, "white", launch=RACKS[j % 4] if j > 2 else None, n=170)
gerbs(fw, 2.6, col="gold")
for x in (-4.0, 4.0):
    confetti(fw + 0.05, (x, -0.6, 0.4), 300, aim=(0, -1, 1.3))


# ------------------------------------------------------------------ objects
def data_object(name, rows, tree, mat, extra_vec=None):
    me = bpy.data.meshes.new(name)
    me.vertices.add(len(rows))
    me.vertices.foreach_set("co", [c for r in rows for c in r[0]])
    for aname, kind, idx in (("vel", "FLOAT_VECTOR", 1), ("t0", "FLOAT", 2), ("life", "FLOAT", 3), ("drag", "FLOAT", 4),
                             ("grav", "FLOAT", 5), ("size", "FLOAT", 6), ("trail", "FLOAT", 7), ("col", "FLOAT_VECTOR", 8),
                             ("flick", "FLOAT", 9)) + ((("spin", "FLOAT_VECTOR", 10),) if extra_vec else ()):
        a = me.attributes.new(aname, kind, "POINT")
        if kind == "FLOAT":
            a.data.foreach_set("value", [r[idx] for r in rows])
        else:
            a.data.foreach_set("vector", [c for r in rows for c in r[idx]])
    o = new_obj(name, me, coll=C)
    mod = o.modifiers.new("fw", "NODES")
    mod.node_group = tree
    o.visible_shadow = False
    sm = [n for n in tree.nodes if n.bl_idname == "GeometryNodeSetMaterial"][0]
    sm.inputs["Material"].default_value = mat
    return o


g_spark, _ = ballistic_tree("fw_ballistic")
g_conf, _ = ballistic_tree("fw_confetti", confetti=True)
data_object("FW_Sparks", SPARKS, g_spark, instancer_material("fw_spark"))
data_object("FW_Confetti", CONF, g_conf, instancer_material("fw_conf", emissive=False), extra_vec=True)

# burst lights: a pool of point lights hopping to each burst
POOL = 6
pool = []
for i in range(POOL):
    ld = bpy.data.lights.new("burst%d" % i, "POINT"); ld.shadow_soft_size = 1.0; ld.energy = 0; ld.volume_factor = 0.15
    ld.use_shadow = False
    pool.append(new_obj("burst%d" % i, ld, coll=C))
keys = {i: dict(loc=[], col=[], e=[(1, 0.0)]) for i in range(POOL)}
for j, (t, pos, col) in enumerate(sorted(BURSTS, key=lambda b: b[0])):
    i = j % POOL
    f = F(t)
    keys[i]["loc"].append((f - 1, pos))
    keys[i]["col"].append((f - 1, COL[col] if isinstance(col, str) else col))
    keys[i]["e"] += [(f - 0.5, 0.0), (f, 12000.0), (f + 8, 4000.0), (f + 40, 0.0)]
for i, o in enumerate(pool):
    for ax in range(3):
        bake(o, "location", ax, [(f, p[ax]) for f, p in keys[i]["loc"]] or [(1, 0)], interp="CONSTANT")
        bake(o.data, "color", ax, [(f, c[ax]) for f, c in keys[i]["col"]] or [(1, 1)], interp="CONSTANT")
    bake(o.data, "energy", 0, keys[i]["e"], interp="LINEAR")
gl = bpy.data.lights.new("gerb_glow", "AREA"); gl.size = 10; gl.color = lin(GOLD); gl.use_shadow = False; gl.volume_factor = 0.2
g_o = new_obj("gerb_glow", gl, loc=(0, -1.2, 0.3), coll=C)
g_o.rotation_euler = (math.radians(-80), 0, 0)
gk = [(1, 0.0)]
for t0, dur in ((d, 3.0), (n3, 2.0), (fw, 2.6)) + tuple((ke, 1.0) for ke in ENCORE):
    gk += [(F(t0) - 1, 0.0), (F(t0), 450.0), (F(t0 + dur), 350.0), (F(t0 + dur + 0.6), 0.0)]
bake(gl, "energy", 0, gk, interp="LINEAR")

# ------------------------------------------------------------------ sparklers (random sparks re-seeded every frame)
T = Tree("fw_sparkler")
seed_sock = T.g.interface.new_socket("Seed", in_out="INPUT", socket_type="NodeSocketInt")
st = T.n("GeometryNodeInputSceneTime")
frame_i = T.math("ADD", T.math("MULTIPLY", st.outputs["Frame"], 7.0), T.gi.outputs["Seed"])
pts = T.n("GeometryNodePoints"); pts.inputs["Count"].default_value = 26
rv = T.n("FunctionNodeRandomValue", data_type="FLOAT_VECTOR")
rv.inputs["Min"].default_value = (-1, -1, -1); rv.inputs["Max"].default_value = (1, 1, 1)
T.L(frame_i, rv.inputs["Seed"])
rl = T.n("FunctionNodeRandomValue", data_type="FLOAT")
rl.inputs["Min"].default_value, rl.inputs["Max"].default_value = 0.04, 0.26
T.L(T.math("ADD", frame_i, 13.0), rl.inputs["Seed"])
dvec = T.vmath("NORMALIZE", rv.outputs[0])
lenv = rl.outputs["Value"]
T.L(T.vmath("SCALE", dvec, scale=lenv), pts.inputs["Position"])
rv_id = T.n("GeometryNodeInputIndex").outputs[0]
T.L(rv_id, rv.inputs["ID"])
T.L(rv_id, rl.inputs["ID"])
inst = T.n("GeometryNodeInstanceOnPoints")
T.L(pts.outputs[0], inst.inputs["Points"])
cy = T.n("GeometryNodeMeshCylinder"); cy.inputs["Vertices"].default_value = 4
cy.inputs["Radius"].default_value, cy.inputs["Depth"].default_value = 1.0, 1.0
tr = T.n("GeometryNodeTransform"); T.L(cy.outputs["Mesh"], tr.inputs["Geometry"]); tr.inputs["Translation"].default_value = (0, 0, -0.5)
T.L(tr.outputs[0], inst.inputs["Instance"])
al = T.n("FunctionNodeAlignRotationToVector", axis="Z"); T.L(dvec, al.inputs["Vector"]); T.L(al.outputs[0], inst.inputs["Rotation"])
T.L(T.xyz(0.006, 0.006, T.math("MULTIPLY", lenv, 0.8)), inst.inputs["Scale"])
core = T.n("GeometryNodeMeshIcoSphere"); core.inputs["Radius"].default_value = 0.025; core.inputs["Subdivisions"].default_value = 1
join = T.n("GeometryNodeJoinGeometry")
T.L(inst.outputs[0], join.inputs[0]); T.L(core.outputs["Mesh"], join.inputs[0])
sm = T.n("GeometryNodeSetMaterial"); T.L(join.outputs[0], sm.inputs["Geometry"])
sm.inputs["Material"].default_value = emitter("fw_sparkler", "#ffd59a", 7.0)
rz = T.n("GeometryNodeRealizeInstances"); T.L(sm.outputs[0], rz.inputs[0])
T.L(rz.outputs[0], T.go.inputs[0])
seed_id = seed_sock.identifier
s_on, s_off = info["spark"]
dummy = bpy.data.meshes.get("sparkler_src") or bpy.data.meshes.new("sparkler_src")
n_sp = 0
for i, h in enumerate(info["hands"]):
    if h["role"] != "sparkler":
        continue
    arm = bpy.data.objects[h["name"]]
    o = new_obj("sparkler", dummy, coll=C, parent=arm, loc=h["tip"])
    m = o.modifiers.new("spark", "NODES"); m.node_group = T.g
    getattr(m.properties.inputs, seed_id).value = i * 101
    o.visible_shadow = False
    on, off = s_on + random.uniform(0, 1.5), s_off - random.uniform(0, 0.8)
    bake(o, "hide_render", 0, [(1, 1.0), (F(on), 0.0), (F(off), 1.0)], interp="CONSTANT")
    bake(o, "hide_viewport", 0, [(1, 1.0), (F(on), 0.0), (F(off), 1.0)], interp="CONSTANT")
    n_sp += 1
sg = bpy.data.lights.new("sparkler_glow", "POINT"); sg.color = lin("#ffd9a0"); sg.shadow_soft_size = 2.0; sg.use_shadow = False
new_obj("sparkler_glow", sg, loc=(1.0, -6.0, 1.6), coll=C)
bake(sg, "energy", 0, [(1, 0.0), (F(s_on), 0.0), (F(s_on + 1.0), 45.0), (F(s_off - 0.5), 45.0), (F(s_off), 0.0)], interp="LINEAR")
scene.frame_set(1)
print("fireworks ok:", len(SPARKS), "sparks,", len(CONF), "confetti,", len(BURSTS), "bursts,", n_sp, "sparklers")
