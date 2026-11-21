# Straight top-down orthographic render of the FM-1 (collection FM1 only) at the photo's
# scale, for the side-by-side check against site/assets/fm1-pink.webp. Run after dj.py:
#   node send.js common.py fm1_compare.py      -> <out>/rev2/fm1-top.png
PX = 0.0005
REV = os.path.join(OUT, "rev2")
os.makedirs(REV, exist_ok=True)
main = scene
sc = bpy.data.scenes.get("FM1_compare") or bpy.data.scenes.new("FM1_compare")
for c in list(sc.collection.children):
    sc.collection.children.unlink(c)
for o in list(sc.collection.objects):
    bpy.data.objects.remove(o, do_unlink=True)
sc.collection.children.link(bpy.data.collections["FM1"])
w = bpy.data.worlds.get("fm1_compare_world") or bpy.data.worlds.new("fm1_compare_world")
w.use_nodes = True
w.node_tree.nodes["Background"].inputs["Color"].default_value = (0.5, 0.5, 0.5, 1)
w.node_tree.nodes["Background"].inputs["Strength"].default_value = 0.6
sc.world = w
root = bpy.data.objects["fm1_root"]
cd = bpy.data.cameras.new("fm1_top_cam"); cd.type = "ORTHO"; cd.ortho_scale = 1800 * PX
cd.sensor_fit = "HORIZONTAL"
cam = bpy.data.objects.new("fm1_top_cam", cd); sc.collection.objects.link(cam)
cam.location = root.matrix_world.translation + Vector((0, 0, 1.0))
cam.rotation_euler = (0, 0, math.pi)          # photo up = world -y
sc.camera = cam
ld = bpy.data.lights.new("fm1_top_sun", "SUN"); ld.energy = 1.6; ld.angle = math.radians(8)
sun = bpy.data.objects.new("fm1_top_sun", ld); sc.collection.objects.link(sun)
sun.rotation_euler = (math.radians(35), 0, math.radians(180 + 45))   # light from the photo's top-left
r = sc.render
r.engine = "BLENDER_EEVEE"
r.resolution_x, r.resolution_y, r.resolution_percentage = 1800, 1238, 100
r.film_transparent = False
sc.eevee.taa_render_samples = 32
sc.view_settings.view_transform = "Standard"
sc.frame_current = 1
r.filepath = os.path.join(REV, "fm1-top.png")
r.image_settings.file_format = "PNG"
soft = bpy.data.objects["fm1_soft"]
soft.hide_render = True                        # the in-club soft light is not part of this check
glow = bpy.data.materials["fm1_photo"].node_tree.nodes["fm1_glow"].outputs[0]
g0 = glow.default_value
glow.default_value = 0.0
bpy.context.window.scene = sc
bpy.ops.render.render(write_still=True, scene=sc.name)
bpy.context.window.scene = main
soft.hide_render = False
glow.default_value = g0
print("wrote", r.filepath)
