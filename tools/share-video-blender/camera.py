# Shot list. Every shot is one camera rig built from a blender-skills recipe:
#   slow-zoom   : TRACK_TO empty at the focus point, keyframed location + lens push-in
#   crane-shot  : TRACK_TO empty, camera keyed low -> high, lens widening
#   dolly-rotate: camera parented to a rotating pivot empty that it also tracks
# Timeline markers bound to each camera make the cuts. Keys are BEZIER as the skills ask.
# Rules from revision 2: three face-on hero close-ups (18 s beat-in, the drop, 84 s), the
# wide house shot only ~4 s then a new angle every 4 beats, cameras stay above the heads,
# important things inside the Instagram-safe middle (not the top 14 %, bottom 20 %, right edge).
# 67.1-67.6 s is replaced by reversed, blurred frames in post (rewind.sh).
# The last 2 s are a title card parented to the final camera.
# Run: node send.js common.py camera.py
C = fresh_collection("Cameras")
for m in list(scene.timeline_markers):
    scene.timeline_markers.remove(m)

S = SEC
FACE = (0, 0.45, 1.16)                       # her face
SYN = (-0.02, 0.04, 0.86)                    # the keys
SHOTS = [
    # name, kind, t0, t1, dict(...)
    ("01_hero_synth", "slow-zoom", 0.0, 3.0, dict(
        cam=((-0.44, 0.31, 1.17), (-0.37, 0.27, 1.10)), tgt=((-0.03, 0.11, 0.87), (-0.025, 0.12, 0.87)),
        lens=(34, 40), dof=(4.0, 4.0))),
    ("02_hands", "slow-zoom", 3.0, 8.0, dict(
        cam=((0.40, 0.40, 1.17), (0.32, 0.33, 1.08)), tgt=(SYN, (0.0, 0.03, 0.86)), lens=(30, 36), dof=(4.0, 4.5))),
    ("03_crane_reveal", "crane-shot", 8.0, 17.9, dict(
        cam=((0.32, 0.33, 1.08), (1.5, 2.1, 4.4)), tgt=((0.0, 0.03, 0.86), (0.0, -6.5, -0.4)), lens=(36, 17))),
    ("04_hero_face_beat", "slow-zoom", 17.9, S["house"], dict(
        cam=((0.28, -0.80, 1.32), (0.13, -0.52, 1.25)), tgt=(FACE, (0, 0.45, 1.13)), lens=(30, 34))),
    ("05_floor_wide", "dolly-rotate", S["house"], 26.2, dict(
        pivot=(0, -2.0, 0.6), ang=(230, 250), rad=(10.0, 9.0), h=(1.0, 0.85), lens=(18, 19))),
    ("06_crowd_hands", "slow-zoom", 26.2, 28.13, dict(        # from the stage edge at eye level: faces and hands
        cam=((-2.5, -0.3, 0.45), (-2.0, -0.3, 0.45)), tgt=((-0.3, -6.0, -0.15), (0.1, -6.0, -0.1)), lens=(22, 23))),
    ("07_booth_side", "dolly-rotate", 28.13, S["filter-dip"], dict(
        pivot=(0, 0.35, 1.0), ang=(166, 192), rad=(2.5, 2.2), h=(0.4, 0.3), lens=(28, 30))),
    ("08_booth_front", "slow-zoom", S["filter-dip"], S["name-2"], dict(
        cam=((1.3, -2.8, 0.75), (1.0, -2.3, 0.85)), tgt=((0, 0.4, 1.2), (0, 0.4, 1.2)), lens=(24, 26))),
    ("09_name2_hands", "slow-zoom", S["name-2"], S["stutter"], dict(
        cam=((0.9, -8.4, 1.35), (0.45, -5.6, 1.3)), tgt=((0, 0.5, 1.5), (0, 0.5, 1.4)), lens=(20, 24))),
    ("10_booth_orbit", "dolly-rotate", S["stutter"], S["breakdown"], dict(
        pivot=(0, 0.3, 1.0), ang=(208, 238), rad=(3.2, 2.6), h=(0.45, 0.3), lens=(26, 30))),
    ("11_breakdown_push", "slow-zoom", S["breakdown"], S["build"], dict(
        cam=((0.45, -2.3, 1.5), (0.13, -0.6, 1.26)), tgt=((0, 0.45, 1.18), (0, 0.45, 1.15)), lens=(28, 36))),
    ("12_build_rush", "slow-zoom", S["build"], S["drop"], dict(
        cam=((0.2, -10.5, 1.2), (0.05, -3.6, 1.25)), tgt=((0, 0.5, 1.6), (0, 0.5, 1.4)), lens=(18, 26))),
    ("13_drop_face", "slow-zoom", S["drop"], 52.6, dict(
        cam=((0.4, -9.0, 3.0), (0.3, -8.6, 2.95)), tgt=((0, 0.2, 1.0), (0, 0.2, 1.02)), lens=(105, 110))),
    ("14_drop_behind_dj", "crane-shot", 52.6, 55.5, dict(
        cam=((1.4, 1.7, 2.0), (-1.0, 1.7, 2.4)), tgt=((0, -6.0, 0.2), (0, -7.0, 0.1)), lens=(18, 16))),
    ("15_crowd_orbit", "dolly-rotate", 55.5, S["name-3"], dict(
        pivot=(0, -5.0, 0.0), ang=(65, 115), rad=(4.3, 4.0), h=(1.1, 0.9), lens=(18, 19))),
    ("16_name3_hearts", "slow-zoom", S["name-3"], S["machine-gun"], dict(
        cam=((-1.3, -8.8, 1.05), (-0.9, -6.6, 1.1)), tgt=((0, 1.0, 4.6), (0, 1.0, 5.2)), lens=(16, 17))),
    ("17_crane_up", "crane-shot", S["machine-gun"], S["rewind"] + 0.5, dict(
        cam=((3.0, -4.5, 0.9), (5.5, -10.5, 5.0)), tgt=((0, 0.2, 1.3), (0, -1.5, 2.2)), lens=(22, 16))),
    ("18_countdown_front", "slow-zoom", S["rewind"] + 0.5, S["encore-key-1"], dict(
        cam=((-1.8, -3.4, 1.6), (-1.2, -2.5, 1.45)), tgt=((0, 0.4, 1.3), (0, 0.4, 1.25)), lens=(24, 28))),
    ("19_encore_back_left", "slow-zoom", S["encore-key-1"], S["encore-key-3"], dict(   # whole club: stage, LED, sky, crowd
        cam=((-5.0, -12.2, 2.6), (-4.7, -11.6, 2.55)), tgt=((0.8, -1.0, 1.5), (0.8, -1.0, 1.55)), lens=(18, 18.5))),
    ("20_encore_back_right_crane", "crane-shot", S["encore-key-3"], S["fireworks"], dict(
        cam=((5.6, -12.0, 2.2), (5.0, -11.4, 3.0)), tgt=((-0.8, -1.0, 1.4), (-0.8, -1.0, 1.9)), lens=(19, 18))),
    ("21_finale_wide", "slow-zoom", S["fireworks"], 84.0, dict(
        cam=((0, -14.5, 4.6), (0, -10.0, 3.2)), tgt=((0, 1.0, 4.6), (0, 2.0, 4.0)), lens=(15, 17))),
    ("22_end_face", "slow-zoom", 84.0, 85.33, dict(
        cam=((0.05, -1.35, 1.42), (0.03, -1.25, 1.4)), tgt=((0, 0.45, 1.56), (0, 0.45, 1.54)), lens=(25, 26))),
    ("23_title_card", "slow-zoom", 85.33, SONG_LEN, dict(
        cam=((0, -9.4, 2.7), (0, -9.0, 2.7)), tgt=((0, 2.0, 9.0), (0, 2.0, 9.2)), lens=(18, 18))),   # sky; the LED wall stays out of frame
]


def camera(name, lens):
    cd = bpy.data.cameras.new(name)
    cd.sensor_fit, cd.sensor_height, cd.sensor_width = "VERTICAL", 36, 36
    cd.lens = lens
    cd.clip_start, cd.clip_end = 0.02, 200
    return new_obj(name, cd, coll=C)


def track(cam, tgt):
    trk = cam.constraints.new(type="TRACK_TO")
    trk.target, trk.track_axis, trk.up_axis = tgt, "TRACK_NEGATIVE_Z", "UP_Y"


def key2(idb, path, f0, f1, v0, v1, n=None):
    for i in range(n or 1):
        a = v0[i] if n else v0
        b = v1[i] if n else v1
        bake(idb, path, i if n else 0, [(f0, a), (f1, b)])


cams = {}
for name, kind, t0, t1, p in SHOTS:
    f0, f1 = F(t0), F(t1)
    if kind in ("slow-zoom", "crane-shot"):
        tgt = empty(name + "_target", loc=p["tgt"][0], coll=C)
        cam = camera(name, p["lens"][0])
        track(cam, tgt)
        key2(cam, "location", f0, f1, p["cam"][0], p["cam"][1], 3)
        key2(tgt, "location", f0, f1, p["tgt"][0], p["tgt"][1], 3)
    else:                                                    # dolly-rotate
        tgt = empty(name + "_pivot", loc=p["pivot"], coll=C)
        cam = camera(name, p["lens"][0])
        track(cam, tgt)
        cam.parent = tgt
        a0, a1 = (math.radians(a) for a in p["ang"])
        r0, r1 = p["rad"]
        h0, h1 = p["h"]
        bake(tgt, "rotation_euler", 2, [(f0, a0), (f1, a1)])
        key2(cam, "location", f0, f1, (r0, 0, h0), (r1, 0, h1), 3)
    key2(cam.data, "lens", f0, f1, p["lens"][0], p["lens"][1])
    if "dof" in p:
        cam.data.dof.use_dof = True
        cam.data.dof.focus_object = tgt
        bake(cam.data, "dof.aperture_fstop", 0, [(f0, p["dof"][0]), (f1, p["dof"][1])])
    mk = scene.timeline_markers.new(name, frame=int(round(f0)) if t0 > 0 else 1)
    mk.camera = cam
    cams[name] = cam
scene.camera = cams[SHOTS[0][0]]

# ------------------------------------------------------------------ title card: 生日快乐 / DJ GAO
card_cam = cams["23_title_card"]
t_card = F(85.33)
font = bpy.data.fonts.load(os.path.join(HERE, "fonts", "fusion-pixel-title.otf"), check_existing=True)
latin = bpy.data.fonts.load(os.path.join(HERE, "fonts", "pixelify.woff2"), check_existing=True)
for fo in (font, latin):
    if not fo.packed_file:
        fo.pack()
m_card = emitter("card_title", INK, 4.0)
m_card2 = emitter("card_sub", ROSE, 5.0)
dim = bpy.data.materials.get("card_dim")
if dim:
    bpy.data.materials.remove(dim)
dim = bpy.data.materials.new("card_dim")                  # a dark veil behind the card: transparent -> 65 % night violet
dim.use_nodes = True
nt = dim.node_tree
nt.nodes.clear()
tr, em = nt.nodes.new("ShaderNodeBsdfTransparent"), nt.nodes.new("ShaderNodeEmission")
em.inputs["Color"].default_value = hexrgb("#100c18"); em.inputs["Strength"].default_value = 0.3
mxs = nt.nodes.new("ShaderNodeMixShader")
nt.links.new(tr.outputs[0], mxs.inputs[1]); nt.links.new(em.outputs[0], mxs.inputs[2])
nt.links.new(mxs.outputs[0], nt.nodes.new("ShaderNodeOutputMaterial").inputs[0])
dim.surface_render_method = "BLENDED"
bake(nt, 'nodes["%s"].inputs[0].default_value' % mxs.name, 0, [(1, 0.0), (t_card, 0.0), (t_card + 9, 0.72)], interp="LINEAR")
D = 1.0                                     # card distance in front of the lens
vis_h = D * 36 / 18                         # visible height at 18 mm (vertical sensor 36 mm)
bm = bmesh.new()
bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
bmesh.ops.scale(bm, vec=(vis_h * 1.6, vis_h * 1.6, 1), verts=bm.verts)
new_obj("card_dim", mesh_from_bm("card_dim", bm, False), dim, parent=card_cam, loc=(0, 0, -D - 0.05), coll=C)
for name, body, y, size, mat, fnt in (("card_line1", "生日快乐", 0.14, 0.36, m_card, font),
                                      ("card_line2", "DJ GAO", -0.16, 0.24, m_card2, latin)):
    cu = bpy.data.curves.new(name, "FONT")
    cu.body, cu.font, cu.size = body, fnt, size
    cu.align_x, cu.align_y = "CENTER", "CENTER"
    o = new_obj(name, cu, mat, parent=card_cam, loc=(0, y, -D), coll=C)
    for ax in range(3):
        bake(o, "scale", ax, [(1, 0.0), (t_card + (0 if name == "card_line1" else 4), 0.0),
                              (t_card + (6 if name == "card_line1" else 10), 1.08),
                              (t_card + (10 if name == "card_line1" else 14), 1.0)])
# ------------------------------------------------------------------ encore crowd wave, seen through each encore camera
# For the two encore shots, every crowd point gets a screen-space diagonal coordinate (0 at the
# bottom-left of the frame, 1 at the top-right) so the GN wave band is a straight diagonal in
# that shot; the rows nearest the lens raise their arms, and some of them turn three-quarter
# toward the camera. A beam from the truss rides along the band.
from bpy_extras.object_utils import world_to_camera_view
crowd_o = bpy.data.objects["CrowdGN"]
me = crowd_o.data
pts = [crowd_o.matrix_world @ v.co for v in me.vertices]
rz0 = [0.0] * len(pts)
me.attributes["rz"].data.foreach_get("value", rz0)
rng = random.Random(5)
beam_aims = []
for suffix, shot, t_key, t0, t1 in (("a", "19_encore_back_left", 71.0, ENCORE[0], ENCORE[2]),
                                    ("b", "20_encore_back_right_crane", 76.0, ENCORE[2], SEC["fireworks"]),
                                    ("c", "13_drop_face", 49.9, None, None)):
    cam = cams[shot]
    scene.frame_set(int(F(t_key)))
    cpos = cam.matrix_world.translation.copy()
    wave, near, turn = [], [], []
    for p_, r_ in zip(pts, rz0):
        u, v, z = world_to_camera_view(scene, cam, p_ + Vector((0, 0, 1.0)))
        wave.append(max(-0.2, min(1.3, 0.5 * (u + v))))
        d = (p_.xy - cpos.xy).length
        if suffix == "c":                                           # telephoto: the rows in the bottom third of the frame
            is_near = z > 0 and -0.05 < u < 1.05 and v < 0.32
        else:                                                       # the 2-3 rows nearest the lens
            is_near = z > 0 and d < 8.5 and -0.05 < u < 1.05 and v < 0.3
        near.append(1.0 if is_near else 0.0)
        tgt = math.atan2(-(cpos.x - p_.x), cpos.y - p_.y)
        dr = (tgt - r_ + math.pi) % (2 * math.pi) - math.pi
        r = rng.random()                                            # ~60 % turn round: a third face-on, the rest three-quarter
        turn.append((dr if r < 0.22 else 0.7 * dr) if (is_near and r < 0.6) else 0.0)
    for name, vals in (("wave_" + suffix, wave), ("near_" + suffix, near), ("turn_" + suffix, turn)):
        if name in me.attributes:
            me.attributes.remove(me.attributes[name])
        me.attributes.new(name, "FLOAT", "POINT").data.foreach_set("value", vals)
    for ke in ([k for k in ENCORE if t0 <= k < t1] if t0 is not None else []):               # beam aim follows the band centre (WaveT keys in crowd.py)
        for j in range(13):
            w = -0.15 + j / 12.0
            sel = [p_ for p_, wv in zip(pts, wave) if abs(wv - w) < 0.06 and wv > -0.15]
            if sel:
                c = sum(sel, Vector()) / len(sel)
                beam_aims.append((F(ke - 0.7 + 2.4 * j / 12.0), c))
scene.frame_set(1)
me.update()
bl = bpy.data.lights.new("wave_beam", "SPOT"); bl.spot_size = math.radians(24); bl.spot_blend = 0.5
bl.color = (1.0, 0.95, 0.9); bl.use_shadow = False; bl.volume_factor = 1.5
beam = new_obj("wave_beam", bl, loc=(0, -0.4, 5.3), coll=C)
aim = empty("wave_beam_aim", loc=(0, -6, -0.5), coll=C)
tc_ = beam.constraints.new("TRACK_TO"); tc_.target, tc_.track_axis, tc_.up_axis = aim, "TRACK_NEGATIVE_Z", "UP_Y"
for ax in range(3):
    bake(aim, "location", ax, [(f, c[ax]) for f, c in beam_aims] or [(1, 0.0)])
ek = [(1, 0.0)]
for ke in ENCORE:
    ek += [(F(ke - 0.9), 0.0), (F(ke - 0.6), 2200.0), (F(ke + 1.6), 2200.0), (F(ke + 2.0), 0.0)]
bake(bl, "energy", 0, ek, interp="LINEAR")
print("cameras ok:", [(m.name, m.frame) for m in sorted(scene.timeline_markers, key=lambda m: m.frame)])
