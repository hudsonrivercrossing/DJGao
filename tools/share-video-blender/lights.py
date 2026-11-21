# Club lighting driven by timeline.json sections and kick drums: DJ key/rim, moving
# heads with volumetric beams, crowd wash, strobes, bar + balcony practicals, LED wall
# content/colour and the end-title pop. Run: node send.js common.py lights.py
C = fresh_collection("Lights")
random.seed(21)

# each key change floods the venue with one clearly different colour
KEY_COL = {"encore-key-1": "#ff3d9a", "encore-key-2": "#1fe0b8", "encore-key-3": "#ffb21f", "encore-key-4": "#7a5cff"}
ORDER = [s["id"] for s in TL["sections"]]
STARTS = [(s["start"], s["id"]) for s in TL["sections"]]
HYPE = ("drop", "machine-gun", "encore-key-1", "encore-key-2", "encore-key-3", "encore-key-4")


def spot(name, loc, target, color, energy, size_deg, blend=0.3, radius=0.05):
    ld = bpy.data.lights.new(name, "SPOT")
    ld.color, ld.energy = lin(color) if isinstance(color, str) else color, energy
    ld.spot_size, ld.spot_blend = math.radians(size_deg), blend
    ld.shadow_soft_size = radius
    o = new_obj(name, ld, loc=loc, coll=C)
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def area(name, loc, target, color, energy, size):
    ld = bpy.data.lights.new(name, "AREA")
    ld.color, ld.energy, ld.size = lin(color), energy, size
    o = new_obj(name, ld, loc=loc, coll=C)
    o.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat("-Z", "Y").to_euler()
    return o


def point(name, loc, color, energy, radius=0.1):
    ld = bpy.data.lights.new(name, "POINT")
    ld.color, ld.energy, ld.shadow_soft_size = lin(color), energy, radius
    return new_obj(name, ld, loc=loc, coll=C)


def section_keys(levels, ramp=0.12, extra=()):
    """levels: {section_id: level}; sections not listed keep the previous level."""
    ks, cur = [(1, levels.get("windup", 0.0))], levels.get("windup", 0.0)
    for t, sid in STARTS:
        if sid in levels and levels[sid] != cur:
            ks += [(F(t - ramp), cur), (F(t), levels[sid])]
            cur = levels[sid]
    ks += list(extra)
    return sorted(ks)


def scaled(ks, k):
    return [(f, v * k) for f, v in ks]


def kick_pulse(base_keys, boost=1.5, decay=7, sections=HYPE + ("house", "stutter", "house-intro", "build", "countdown")):
    """Multiply a section level curve by a pulse on every kick inside the given sections."""
    def level(f):
        v = base_keys[0][1]
        for ff, vv in base_keys:
            if ff <= f:
                v = vv
        return v
    out = list(base_keys)
    for k in KICKS:
        if section_at(k) in sections:
            f = F(k)
            out += [(f - 0.6, level(f)), (f, level(f) * boost), (f + decay, level(f))]
    return sorted(out)


# ------------------------------------------------------------------ DJ key, rim, hand fill
MOVER = {"windup": 0.0, "musicbox": 0.0, "horn": 0.9, "house-intro": 0.55, "house": 1.0, "filter-dip": 0.45,
         "name-2": 0.35, "stutter": 0.9, "breakdown": 0.12, "build": 0.55, "silence": 0.0, "drop": 1.25,
         "name-3": 0.7, "machine-gun": 1.1, "rewind": 0.45, "countdown": 0.6, "encore-key-1": 1.2,
         "fireworks": 0.55}
WASH = {"windup": 0.12, "musicbox": 0.16, "horn": 0.65, "house-intro": 0.5, "house": 0.7, "filter-dip": 0.4,
        "name-2": 0.75, "stutter": 0.7, "breakdown": 0.3, "build": 0.45, "silence": 0.0, "drop": 1.0,
        "name-3": 0.9, "machine-gun": 0.9, "rewind": 0.5, "countdown": 0.55, "encore-key-1": 1.0, "fireworks": 0.8}
DJ = {"windup": 0.55, "musicbox": 0.7, "horn": 1.0, "breakdown": 0.8, "build": 0.9, "silence": 0.03, "drop": 1.0}

# take 1: the club "wakes up" during the crane reveal
wake = [(F(9.0), 0.0), (F(15.5), 0.35), (F(17.3), 0.45)]


def with_wake(ks, wake_keys):
    return sorted([k for k in ks if not (F(8.9) <= k[0] <= F(17.3))] + wake_keys)


mover_keys = with_wake(section_keys(MOVER), wake)
wash_keys = with_wake(section_keys(WASH), [(F(9.0), 0.16), (F(16.0), 0.42), (F(17.3), 0.45)])
dj_keys = section_keys(DJ)

key = spot("dj_key", (0.3, -0.45, 5.2), (0, 0.5, 1.15), "#ffe2cc", 1, 22, 0.5, 0.2)
bake(key.data, "energy", 0, scaled(dj_keys, 500))
fill = area("hand_fill", (-0.15, 0.4, 1.4), (-0.12, 0.12, 0.86), "#ffe6d6", 1, 0.5)
bake(fill.data, "energy", 0, scaled(section_keys({"windup": 4, "house-intro": 2, "silence": 0.2, "drop": 2}), 1))
face = spot("face_fill", (-0.5, -1.6, 1.9), (0, 0.5, 1.2), "#fff1ed", 1, 25, 0.6, 0.3)
bake(face.data, "energy", 0, scaled(dj_keys, 90))
for name, loc, col in (("rim_rose", (-1.6, 3.4, 5.4), ROSE), ("rim_lilac", (1.6, 3.4, 5.4), LILAC), ("rim_mint", (0, 3.3, 5.8), MINT)):
    o = spot(name, loc, (0, 0.5, 1.2), col, 1, 24, 0.4)
    bake(o.data, "energy", 0, scaled(section_keys({"windup": 0.25, "horn": 1.0, "silence": 0.0, "drop": 1.0, "breakdown": 0.6}), 900))
up = spot("uplight", (0, -0.65, 0.02), (0, 0.4, 1.6), GOLD, 1, 30, 0.5)
bake(up.data, "energy", 0, scaled(section_keys({"windup": 0.0, "house": 0.6, "silence": 0.0, "drop": 1.0, "breakdown": 0.2, "build": 0.6}), 250))

# ------------------------------------------------------------------ moving heads (beams in the haze)
m_fix = principled("fixture", "#1c1824", rough=0.4, metal=0.6)
m_lens = emitter("fixture_lens", INK, 0.0)
movers = []
for i in range(10):
    x = -6.3 + i * 1.4
    col = PALETTE[i % 4]
    o = spot("mover%d" % i, (x, -0.25, 5.05), (x, -6, -0.9), col, 1, 13, 0.3, 0.04)
    tgt = empty("mover%d_aim" % i, loc=(x, -6, -0.9), coll=C)
    trk = o.constraints.new("TRACK_TO")
    trk.target, trk.track_axis, trk.up_axis = tgt, "TRACK_NEGATIVE_Z", "UP_Y"
    head = cyl("mover_head", (0, 0, 0.12), 0.11, 0.26, m_fix, seg=16, coll=C, parent=o)
    lens = cyl("mover_lens", (0, 0, -0.012), 0.08, 0.01, m_lens, seg=16, coll=C, parent=o)
    # aim wanders over the floor every two beats, crossing patterns in hype sections
    aims, t = [], 0.0
    while t < SONG_LEN + 1:
        sec = section_at(t)
        if sec in ("name-2", "name-3", "fireworks"):
            p = (x * 0.4, -3.5, 6.0 + 2.0 * math.sin(t + i))          # beams fan up into the sky
        elif sec in HYPE + ("house", "house-intro", "stutter", "build", "filter-dip"):
            # beams sweep across the crowd at head height: a full pass every 8 beats, rows of light every 16
            ph8 = 2 * math.pi * t / (8 * 60 / 124)
            p = (7.5 * math.sin(ph8 + i * 0.63), -2.5 - 9.0 * (0.5 + 0.5 * math.sin(ph8 / 2 + i * 0.9)), 0.0)
        else:
            p = (x + random.uniform(-3, 3), random.uniform(-12, -2), -0.9)
        aims.append((F(t), p))
        t += 0.242 if section_at(t) in HYPE + ("house", "house-intro", "stutter", "build", "filter-dip") else 1.94
    for ax in range(3):
        bake(tgt, "location", ax, [(f, p[ax]) for f, p in aims])
    movers.append(o)
mk = kick_pulse(scaled(mover_keys, 2600), boost=1.35)
bd0, bd1 = F(SEC["breakdown"]), F(SEC["build"])
for i, o in enumerate(movers):
    o.data.volume_factor = 5.0
    off = F(SEC["breakdown"] + 0.6 + 0.62 * ((i * 7) % 10))          # the lights go out one at a time
    ks = [kv for kv in mk if not (bd0 - 4 <= kv[0] <= bd1)]
    ks += [(bd0 - 4, 2600 * 0.35), (bd0, 2600 * 0.5), (off - 2, 2600 * 0.5), (off, 0.0), (bd1 - 1, 0.0)]
    bake(o.data, "energy", 0, sorted(ks))
# encore: all movers take the key colour
for o, base in zip(movers, [PALETTE[i % 4] for i in range(10)]):
    ck = {0: [], 1: [], 2: []}
    for f, col in [(1, base), (F(ENCORE[0]) - 1, base)] + [(F(SEC[k]), KEY_COL[k]) for k in KEY_COL] + [(F(SEC["fireworks"]), base)]:
        for ax in range(3):
            ck[ax].append((f, lin(col)[ax]))
    for ax in range(3):
        bake(o.data, "color", ax, ck[ax], interp="CONSTANT")
bake(m_lens.node_tree, socket_path(m_lens.node_tree.nodes["Emission"], "Strength"), 0, scaled(mover_keys, 30))

# ------------------------------------------------------------------ crowd wash, practicals, strobes
w1 = area("wash_front", (0, -3.5, 6.4), (0, -4, -0.9), LILAC, 1, 7)
w2 = area("wash_back", (0, -9.5, 6.4), (0, -9.5, -0.9), ROSE, 1, 8)
w3 = area("wash_side", (7.5, -7, 5.5), (0, -7, -0.9), MINT, 1, 5)
# breakdown: the washes sink step by step under the push-in
bd_steps = [(bd0, 1.0)] + [(F(SEC["breakdown"] + 1.4 * (j + 1)), 1.0 - 0.18 * (j + 1)) for j in range(5)]
wash_keys = [kv for kv in wash_keys if not (bd0 <= kv[0] < bd1)]
for f, lv in bd_steps:
    wash_keys += [(f - 3, (lv + 0.18) * 0.3 if f > bd0 else 0.3), (f, lv * 0.3)]
wash_keys = sorted(wash_keys)
wk = kick_pulse(scaled(wash_keys, 520), boost=1.5, decay=9)
for o in (w1, w2):
    bake(o.data, "energy", 0, wk)
bake(w3.data, "energy", 0, scaled(wash_keys, 450))
# stage-front washes that light the faces of the crowd (no haze cone)
fw_l = spot("crowd_face_l", (-3.2, -0.3, 5.3), (-1.5, -5.5, -0.4), ROSE, 1, 55, 0.6, 0.3)
fw_r = spot("crowd_face_r", (3.2, -0.3, 5.3), (1.5, -5.5, -0.4), LILAC, 1, 55, 0.6, 0.3)
for o in (fw_l, fw_r):
    o.data.volume_factor = 0.0
    bake(o.data, "energy", 0, kick_pulse(scaled(wash_keys, 330), boost=1.4, decay=8))
# rim light from the stage: four low spots at the stage lip, at head height into the crowd
for j, (x_, col) in enumerate(zip((-4.5, -1.5, 1.5, 4.5), (ROSE, MINT, LILAC, GOLD))):
    rl = spot("stage_rim%d" % j, (x_, -0.65, 0.35), (x_ * 0.6, -7.5, 0.1), col, 1, 42, 0.5, 0.2)
    rl.data.volume_factor = 0.25
    bake(rl.data, "energy", 0, kick_pulse(scaled(wash_keys, 260), boost=1.8, decay=6))
    if j < 2:
        ck = {0: [], 1: [], 2: []}
        for f, c in [(1, col), (F(ENCORE[0]) - 1, col)] + [(F(SEC[k_]), KEY_COL[k_]) for k_ in KEY_COL] + [(F(SEC["fireworks"]), col)]:
            for ax in range(3):
                ck[ax].append((f, lin(c)[ax]))
        for ax in range(3):
            bake(rl.data, "color", ax, ck[ax], interp="CONSTANT")
# glow sticks and phones light the faces: soft coloured fills down among the heads
for j, (x_, y_, col) in enumerate(((-3.5, -4.0, MINT), (2.5, -5.5, ROSE), (-1.0, -8.5, LILAC), (4.5, -10.0, MINT))):
    gl_ = point("glow_fill%d" % j, (x_, y_, 0.9), col, 1, 1.5)
    gl_.data.volume_factor = 0.0
    bake(gl_.data, "energy", 0, kick_pulse(scaled(section_keys({"windup": 0.1, "house-intro": 0.6, "house": 1.0, "breakdown": 0.7,
                                                                   "silence": 0.0, "drop": 1.2, "fireworks": 0.8}), 45), boost=1.5, decay=6))
# a soft key from the stage onto the front rows' faces
fk_ = area("crowd_front_key", (0, -0.4, 1.3), (0, -4.0, -0.2), "#ffd6ea", 1, 6)
fk_.data.volume_factor = 0.0
bake(fk_.data, "energy", 0, scaled(wash_keys, 110))
# breakdown: phones light the faces
ph = area("phone_glow", (0, -6.5, 1.2), (0, -6.5, -0.9), "#dfeaff", 1, 12)
ph.data.volume_factor = 0.0
bake(ph.data, "energy", 0, [(1, 0.0), (F(SEC["breakdown"]) - 2, 0.0), (F(SEC["breakdown"]) + 6, 260.0),
                             (F(SEC["build"]) - 2, 260.0), (F(SEC["build"]) + 6, 0.0)])
# washes take the key colour in the encore
for o, base in ((w1, LILAC), (w2, ROSE), (w3, MINT), (fw_l, ROSE), (fw_r, LILAC)):
    ck = {0: [], 1: [], 2: []}
    for f, col in [(1, base), (F(ENCORE[0]) - 1, base)] + [(F(SEC[k_]), KEY_COL[k_]) for k_ in KEY_COL] + [(F(SEC["fireworks"]), base)]:
        for ax in range(3):
            ck[ax].append((f, lin(col)[ax]))
    for ax in range(3):
        bake(o.data, "color", ax, ck[ax], interp="CONSTANT")
for y in (-5.2, -8.6):
    o = point("bar_lamp", (-8.3, y, 1.9), GOLD, 1, 0.3)
    bake(o.data, "energy", 0, scaled(section_keys({"windup": 1.0, "silence": 0.1, "drop": 1.0}), 140))
bal = area("balcony_wash", (0, -15.0, 5.4), (0, -15, 2.3), LILAC, 1, 6)
bake(bal.data, "energy", 0, scaled(section_keys({"windup": 0.4, "house": 1.0, "silence": 0.0, "drop": 1.2, "breakdown": 0.5}), 500))
amb = area("festoon_ambient", (0, -7, 6.6), (0, -7, -0.9), GOLD, 1, 14)
bake(amb.data, "energy", 0, scaled(section_keys({"windup": 1.0, "house": 0.7, "silence": 0.0, "drop": 0.6, "breakdown": 1.0, "build": 0.5}), 420))
bulb = bpy.data.materials.get("v_bulb")
if bulb:
    en = bulb.node_tree.nodes["Emission"]
    bake(bulb.node_tree, socket_path(en, "Strength"), 0,
         scaled(section_keys({"windup": 1.0, "breakdown": 0.5, "build": 1.0, "silence": 0.0, "drop": 1.0}), 9))
    ck = {0: [], 1: [], 2: []}
    for f, col in [(1, GOLD), (F(ENCORE[0]) - 1, GOLD)] + [(F(SEC[k_]), KEY_COL[k_]) for k_ in KEY_COL] + [(F(SEC["fireworks"]), GOLD)]:
        for ax in range(3):
            ck[ax].append((f, hexrgb(col)[ax]))
    for ax in range(3):
        bake(bulb.node_tree, socket_path(en, "Color"), ax, ck[ax], interp="CONSTANT")

strobes = [point("strobe_l", (-3.5, -1.5, 5.0), "#ffffff", 0, 0.05), point("strobe_r", (3.5, -1.5, 5.0), "#ffffff", 0, 0.05)]
flashes = [F(e["t"]) for e in EVENTS if e["part"] == "drums" and e["midi"] in (18, 19)
           and section_at(e["t"]) in ("build", "stutter", "machine-gun")]
flashes += [F(e["t"]) for e in EVENTS if e["part"] == "sfx"]
for i, o in enumerate(strobes):
    ks = [(1, 0.0)]
    for j, f in enumerate(sorted(set(round(x, 2) for x in flashes))):
        if j % 2 == i or section_at((f - 1) / FPS) == "build":
            ks += [(f - 0.4, 0.0), (f, 9000.0), (f + 1.6, 0.0)]
    bake(o.data, "energy", 0, ks, interp="LINEAR")

# ------------------------------------------------------------------ LED wall content
m_led = bpy.data.materials["led_wall"]
nt = m_led.node_tree


def node_val(name):
    return 'nodes["%s"].outputs[0].default_value' % name


WALL = {"windup": 0.6, "musicbox": 0.9, "horn": 1.6, "house-intro": 1.3, "house": 1.6, "name-2": 1.8, "breakdown": 0.7,
        "build": 1.2, "silence": 0.0, "drop": 2.0, "name-3": 2.0, "rewind": 1.2, "countdown": 1.4, "encore-key-1": 2.0,
        "fireworks": 1.8}
wall_keys = kick_pulse(scaled(section_keys(WALL), 3.0), boost=1.3)
tf_dim = F(SEC["fireworks"] + 1.6)
wall_keys = [(f, v * (1.0 if f < tf_dim else 0.4)) for f, v in wall_keys] + [(tf_dim - 1, 1.8 * 3.0), (tf_dim + 8, 0.7 * 3.0)]
bake(nt, node_val("level"), 0, wall_keys)
bake(nt, node_val("art_mix"), 0, section_keys({"windup": 0.0, "name-2": 1.0, "stutter": 0.0, "name-3": 1.0,
                                                  "machine-gun": 0.0, "fireworks": 1.0}, ramp=0.25))
bake(nt, node_val("chase"), 0, section_keys({"windup": 0.15, "house": 0.4, "breakdown": 0.15, "drop": 0.6, "name-3": 0.4,
                                                "encore-key-1": 0.6, "fireworks": 0.4}))
bake(nt, node_val("phase"), 0, [(1, 0.0), (F(SONG_LEN), SONG_LEN * 5.0)], interp="LINEAR")
for node, base in (("text_tint", INK), ("bg_tint", LILAC)):
    ck = {0: [], 1: [], 2: []}
    seq = [(1, base), (F(SEC["drop"]), ROSE if node == "bg_tint" else INK), (F(SEC["name-3"]), GOLD if node == "bg_tint" else INK),
           (F(SEC["countdown"]), base)]
    seq += [(F(SEC[k]), KEY_COL[k] if node == "text_tint" else KEY_COL[k]) for k in KEY_COL]
    seq += [(F(SEC["fireworks"]), INK if node == "text_tint" else ROSE)]
    for f, col in seq:
        for ax in range(3):
            ck[ax].append((f, lin(col)[ax]))
    for ax in range(3):
        bake(nt, 'nodes["%s"].outputs[0].default_value' % node, ax, ck[ax], interp="CONSTANT")

# ------------------------------------------------------------------ hero lights for the close-ups
hs = spot("hero_synth", (0.05, -0.35, 2.3), (0, 0.04, 0.86), "#ffc2e2", 1, 32, 0.6, 0.25)
bake(hs.data, "energy", 0, [(1, 95.0), (F(8.0), 95.0), (F(14.0), 50.0), (F(SEC["silence"]), 60.0), (F(SEC["silence"]) + 1, 0.0),
                            (F(SEC["drop"]), 60.0)])
hf = spot("hero_face", (0.35, -1.5, 1.75), (0, 0.42, 1.18), "#fff0f4", 1, 18, 0.7, 0.3)
hf.data.volume_factor = 0.0
FACE_SHOTS = [(17.9, SEC["house"]), (SEC["breakdown"] + 2.0, SEC["silence"]), (SEC["drop"], 52.6), (84.0, SONG_LEN)]
fk = [(1, 0.0)]
for a, b in FACE_SHOTS:
    fk += [(F(a) - 2, 0.0), (F(a), 220.0), (F(b) - 1, 220.0), (F(b) + 1, 0.0)]
fk = [kv for kv in fk if not (F(SEC["silence"]) <= kv[0] < F(SEC["drop"]))] + [(F(SEC["silence"]) + 0.5, 0.0), (F(SEC["drop"]) - 0.5, 0.0)]
bake(hf.data, "energy", 0, sorted(fk), interp="LINEAR")
# one beat of real black before the drop
bake(scene, "view_settings.exposure", 0, [(1, -0.3), (F(SEC["silence"]) + 0.5, -0.3), (F(SEC["silence"]) + 1, -14.0),
                                          (F(SEC["drop"]) - 0.5, -14.0), (F(SEC["drop"]), -0.3)], interp="CONSTANT")
pm = bpy.data.materials.get("fm1_photo")
if pm:
    gv = pm.node_tree.nodes["fm1_glow"]
    bake(pm.node_tree, 'nodes["fm1_glow"].outputs[0].default_value', 0,
         [(1, 0.14), (F(8.0), 0.14), (F(12.0), 0.12)], interp="LINEAR")

# ------------------------------------------------------------------ end title pop
tf = F(SEC["fireworks"] + 1.6)
for name, f0 in (("Title", tf), ("Subtitle", tf + 14)):
    o = bpy.data.objects[name]
    for ax in range(3):
        bake(o, "scale", ax, [(1, 0.0), (f0, 0.0), (f0 + 7, 1.12), (f0 + 12, 1.0)])
# shadows only from the few lights that shape her, the synth and the floor: every shadowed
# light re-renders the 1,000-figure crowd into its shadow map (7 s/frame with all 33 on, ~2 s with these)
SHADOW_KEEP = ("dj_key", "hero_synth", "hero_face", "fm1_soft", "hand_fill", "face_fill", "wash_front", "wash_back")
for o in scene.objects:
    if o.type == "LIGHT":
        o.data.use_shadow = o.name.startswith(SHADOW_KEEP)
print("lights ok:", len(C.objects), "objects,", len(flashes), "strobe hits")
