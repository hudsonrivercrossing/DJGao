# Shared helpers for the venue build. send.js prepends this file to every
# build script, because blender-mcp runs each execute_code call in a fresh namespace.
import bpy, bmesh, json, math, os, random
from mathutils import Euler, Matrix, Vector

REPO = os.environ.get("DJGAO_REPO") or globals().get("DJGAO_REPO_DEFAULT") or os.getcwd()
HERE = os.path.join(REPO, "tools", "share-video-blender")
OUT = os.environ.get("DJGAO_OUT") or os.path.join(REPO, "spikes", "blender-venue")  # spikes/ is git-ignored

FPS = 30
TL = json.load(open(os.path.join(HERE, "timeline.json")))
SONG_LEN = 87.325                      # 85.825 s music + 1.5 s tail
END_F = 2620                           # frame N <-> time (N-1)/30 s


def F(t):
    """Seconds -> Blender frame (frame 1 is t=0)."""
    return 1.0 + t * FPS


SEC = {s["id"]: s["start"] for s in TL["sections"]}
TAKE = TL["takeStarts"]
EVENTS = TL["events"]
KICKS = sorted({round(e["t"], 4) for e in EVENTS if e["part"] == "drums" and e["midi"] == 17})
ENCORE = [SEC["encore-key-%d" % i] for i in range(1, 5)]

BG, INK, MUTED = "#100c18", "#fff1ed", "#b7a5c6"
ROSE, LILAC, MINT, MINT2, GOLD = "#fa8bc7", "#b9a4ff", "#8debd9", "#9ef1da", "#f6d38c"
PALETTE = [ROSE, LILAC, MINT, GOLD]

scene = bpy.context.scene


def hexrgb(h, a=1.0):
    h = h.lstrip("#")
    srgb = [int(h[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return (*[c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in srgb], a)


def lin(h, k=1.0):
    return tuple(x * k for x in hexrgb(h)[:3])


def smoothstep(a, b, x):
    t = min(1.0, max(0.0, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)


# ------------------------------------------------------------- collections
def fresh_collection(name):
    """Delete a collection and everything in it, then recreate it (idempotent rebuilds)."""
    old = bpy.data.collections.get(name)
    if old:
        for o in list(old.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        for c in list(old.children_recursive):
            bpy.data.collections.remove(c)
        bpy.data.collections.remove(old)
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c


# ------------------------------------------------------------- materials
def principled(name, color, rough=0.45, coat=0.3, emit=None, strength=0.0, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    if not m.node_tree or "Principled BSDF" not in m.node_tree.nodes:
        m.use_nodes = True
    p = m.node_tree.nodes["Principled BSDF"]
    p.inputs["Base Color"].default_value = hexrgb(color) if isinstance(color, str) else color
    p.inputs["Roughness"].default_value = rough
    p.inputs["Coat Weight"].default_value = coat
    p.inputs["Metallic"].default_value = metal
    if emit:
        p.inputs["Emission Color"].default_value = hexrgb(emit) if isinstance(emit, str) else emit
    p.inputs["Emission Strength"].default_value = strength
    return m


def emitter(name, color, strength):
    m = bpy.data.materials.get(name)
    if m:
        bpy.data.materials.remove(m)
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    e = nt.nodes.new("ShaderNodeEmission")
    e.inputs["Color"].default_value = hexrgb(color) if isinstance(color, str) else color
    e.inputs["Strength"].default_value = strength
    nt.links.new(e.outputs[0], nt.nodes.new("ShaderNodeOutputMaterial").inputs[0])
    return m


# ------------------------------------------------------------- objects + meshes
def new_obj(name, data, mat=None, parent=None, loc=(0, 0, 0), coll=None):
    o = bpy.data.objects.new(name, data)
    (coll or scene.collection).objects.link(o)
    if mat is not None and data is not None and len(data.materials) == 0:
        data.materials.append(mat)
    o.parent = parent
    o.location = loc
    return o


def empty(name, parent=None, loc=(0, 0, 0), rot=(0, 0, 0), coll=None):
    o = new_obj(name, None, parent=parent, loc=loc, coll=coll)
    o.rotation_euler = rot
    o.empty_display_size = 0.1
    return o


def mesh_from_bm(name, bm, smooth=True):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = smooth
    return me


def sphere_mesh(name, r=1.0, seg=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=max(4, seg // 2), radius=r)
    return mesh_from_bm(name, bm)


def sphere(name, loc, scale, mat, parent=None, seg=24, coll=None):
    o = new_obj(name, sphere_mesh(name, 1.0, seg), mat, parent, loc, coll)
    o.scale = scale
    return o


def capsule_mesh(name, r, length, seg=16):
    """Capsule from y=0 to y=-length (hemisphere centres at both ends)."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2 + 1, radius=r)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(math.pi / 2, 3, "X"))
    for v in bm.verts:
        if v.co.y < -1e-6:
            v.co.y -= length
    return mesh_from_bm(name, bm)


def rounded_box_mesh(name, hx, hy, hz, p=0.55, seg=24):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1)
    for v in bm.verts:
        c = v.co
        v.co = Vector((math.copysign(abs(c.x) ** p, c.x) * hx,
                       math.copysign(abs(c.y) ** p, c.y) * hy,
                       math.copysign(abs(c.z) ** p, c.z) * hz))
    return mesh_from_bm(name, bm)


def tube_mesh(name, r0, r1, seg=20):
    """Tapered tube from y=0 (r0) to y=1 (r1) for Stretch-To arms."""
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r0, radius2=r1, depth=1.0)
    bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=Matrix.Rotation(-math.pi / 2, 3, "X"))
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0.5, 0))
    return mesh_from_bm(name, bm)


def box_mesh(name, size, uv_scale=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1, calc_uvs=True)
    bmesh.ops.scale(bm, vec=size, verts=bm.verts)
    return mesh_from_bm(name, bm, False)


def rbox(name, loc, size, mat, bevel=0.02, parent=None, coll=None, segs=3):
    o = new_obj(name, box_mesh(name, size), mat, parent, loc, coll)
    if bevel:
        b = o.modifiers.new("bev", "BEVEL")
        b.width, b.segments = bevel, segs
    return o


def cyl(name, loc, r, depth, mat, seg=24, coll=None, parent=None, rot=(0, 0, 0)):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=depth)
    o = new_obj(name, mesh_from_bm(name, bm), mat, parent, loc, coll)
    o.rotation_euler = rot
    return o


def box_uv_world(me, scale=1.0):
    """Cube-project UVs in object space so tiling PolyHaven textures keep a constant size."""
    if not me.uv_layers:
        me.uv_layers.new()
    uv = me.uv_layers.active.data
    for p in me.polygons:
        n = p.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            u, v = [(co.y, co.z), (co.x, co.z), (co.x, co.y)][ax]
            uv[li].uv = (u * scale, v * scale)


# ------------------------------------------------------------- animation
def bake(idb, path, index, pairs, interp=None):
    """Bulk keyframes (frame, value) on any ID data path (Blender 5.x layered actions)."""
    if idb.animation_data is None:
        idb.animation_data_create()
    if idb.animation_data.action is None:
        idb.animation_data.action = bpy.data.actions.new(idb.name + "_act")
    fc = idb.animation_data.action.fcurve_ensure_for_datablock(idb, path, index=index)
    fc.keyframe_points.clear()
    pairs = sorted(pairs)
    clean = []
    for f, v in pairs:
        if clean and f - clean[-1][0] < 0.05:
            clean[-1] = (clean[-1][0], v)
        else:
            clean.append((f, v))
    fc.keyframe_points.add(len(clean))
    fc.keyframe_points.foreach_set("co", [x for fv in clean for x in fv])
    if interp:
        fc.keyframe_points.foreach_set("interpolation", [bpy.types.Keyframe.bl_rna.properties["interpolation"].enum_items[interp].value] * len(clean))
    else:
        for k in fc.keyframe_points:
            k.handle_left_type = k.handle_right_type = "AUTO_CLAMPED"
    fc.update()
    return fc


def socket_path(node, name):
    return node.inputs[name].path_from_id("default_value")


def section_at(t):
    cur = TL["sections"][0]["id"]
    for s in TL["sections"]:
        if s["start"] <= t + 1e-6:
            cur = s["id"]
    return cur
