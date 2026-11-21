# Grade the PolyHaven assets the skills downloaded into the club palette:
# tint brick/concrete toward the site's night violet, dim the night-sky HDRI and
# add haze so the moving-head beams read. Run after polyhaven.sh.

def tint(obj_name, color, rough_mul=1.0, coat=0.0, bump=0.4):
    m = bpy.data.objects[obj_name].data.materials[0]
    nt = m.node_tree
    p = nt.nodes["Principled BSDF"]
    for l in list(nt.links):
        if l.to_node.bl_idname == "ShaderNodeOutputMaterial" and l.to_socket.name == "Displacement":
            nt.links.remove(l)
    base = next(l for l in nt.links if l.to_node == p and l.to_socket.name == "Base Color")
    src = base.from_socket
    mix = nt.nodes.get("club_tint") or nt.nodes.new("ShaderNodeMix")
    mix.name, mix.data_type, mix.blend_type = "club_tint", "RGBA", "MULTIPLY"
    ins = [s for s in mix.inputs if s.type == "RGBA"]
    mix.inputs[0].default_value = 1.0
    nt.links.new(src, ins[0])
    ins[1].default_value = hexrgb(color)
    nt.links.new([s for s in mix.outputs if s.type == "RGBA"][0], p.inputs["Base Color"])
    rl = next((l for l in nt.links if l.to_node == p and l.to_socket.name == "Roughness"), None)
    if rl and rough_mul != 1.0:
        mm = nt.nodes.get("club_rough") or nt.nodes.new("ShaderNodeMath")
        mm.name, mm.operation = "club_rough", "MULTIPLY"
        mm.inputs[1].default_value = rough_mul
        nt.links.new(rl.from_socket, mm.inputs[0])
        nt.links.new(mm.outputs[0], p.inputs["Roughness"])
    p.inputs["Coat Weight"].default_value = coat
    nm = nt.nodes.get("Normal Map")
    if nm:
        nm.inputs["Strength"].default_value = bump


tint("ClubWalls", "#5a4470", bump=0.8)
tint("DanceFloor", "#3b3050", rough_mul=0.45, coat=0.35, bump=0.3)

w = scene.world
nt = w.node_tree
nt.nodes["Background"].inputs["Strength"].default_value = 0.8
sky_tint = nt.nodes.get("club_sky_tint") or nt.nodes.new("ShaderNodeMix")
sky_tint.name, sky_tint.data_type, sky_tint.blend_type = "club_sky_tint", "RGBA", "MULTIPLY"
sky_tint.inputs[0].default_value = 1.0
_si = [s for s in sky_tint.inputs if s.type == "RGBA"]
nt.links.new(nt.nodes["Environment Texture"].outputs["Color"], _si[0])
_si[1].default_value = hexrgb("#9a86d0")
nt.links.new([s for s in sky_tint.outputs if s.type == "RGBA"][0], nt.nodes["Background"].inputs["Color"])
nt.nodes["Mapping"].inputs["Rotation"].default_value = (0, 0, math.radians(200))
vol = nt.nodes.get("club_haze") or nt.nodes.new("ShaderNodeVolumeScatter")
vol.name = "club_haze"
vol.inputs["Density"].default_value = 0.005
vol.inputs["Anisotropy"].default_value = 0.45
nt.links.new(vol.outputs[0], nt.nodes["World Output"].inputs["Volume"])

for win in bpy.context.window_manager.windows:
    for area in win.screen.areas:
        if area.type == "VIEW_3D":
            for sp in area.spaces:
                if sp.type == "VIEW_3D":
                    sp.shading.type = "SOLID"
for im in bpy.data.images:
    if im.source == "FILE" and not im.packed_file:
        im.pack()
print("tuned")
