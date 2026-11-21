# Render settings for the share video (EEVEE, opaque 1080x1920, 30 fps PNG frames),
# bloom in the compositor, then pack and save venue.blend. Run last:
#   node send.js common.py render.py
SAMPLES = int(os.environ.get("DJGAO_SAMPLES", "20"))   # 20: keeps the busiest encore frames under 2.5 s
r = scene.render
r.engine = "BLENDER_EEVEE"
r.resolution_x, r.resolution_y, r.resolution_percentage = 1080, 1920, 100
r.fps, r.fps_base = FPS, 1.0
scene.frame_start, scene.frame_end = 1, END_F
r.film_transparent = False
r.use_motion_blur = True               # light blur for fast camera moves
r.motion_blur_shutter = 0.3            # EEVEE skips blur on the spark meshes (topology changes), so they stay crisp
ee_steps = 1
r.image_settings.file_format = "PNG"
r.image_settings.color_mode = "RGB"
r.image_settings.color_depth = "8"
r.image_settings.compression = 15
r.filepath = os.path.join(OUT, "frames", "####")
r.use_file_extension = True
r.use_overwrite = False
r.use_placeholder = True                 # lets a second Blender process share the frame range

ee = scene.eevee
ee.taa_render_samples = SAMPLES
ee.motion_blur_steps = ee_steps
ee.use_raytracing = False
ee.use_shadows = True
ee.shadow_ray_count = 1
ee.shadow_step_count = 4
ee.shadow_resolution_scale = 0.5
ee.volumetric_tile_size = "8"
ee.volumetric_samples = 48
ee.volumetric_end = 60.0
ee.use_volumetric_shadows = False
ee.use_fast_gi = False

vs = scene.view_settings
scene.display_settings.display_device = "sRGB"
vs.view_transform = "AgX"
vs.look = "AgX - Medium High Contrast"
vs.exposure, vs.gamma = 0.0, 1.0

# compositor: bloom for emissives, fireworks and the LED wall
g = bpy.data.node_groups.get("venue_comp")
if g:
    bpy.data.node_groups.remove(g)
g = bpy.data.node_groups.new("venue_comp", "CompositorNodeTree")
g.interface.new_socket("Image", in_out="OUTPUT", socket_type="NodeSocketColor")
rl = g.nodes.new("CompositorNodeRLayers")
glare = g.nodes.new("CompositorNodeGlare")
glare.inputs["Type"].default_value = "Bloom"
glare.inputs["Quality"].default_value = "Medium"
glare.inputs["Threshold"].default_value = 1.2
glare.inputs["Strength"].default_value = 0.55
glare.inputs["Size"].default_value = 0.6
out = g.nodes.new("NodeGroupOutput")
g.links.new(rl.outputs["Image"], glare.inputs["Image"])
g.links.new(glare.outputs[0], out.inputs[0])
scene.compositing_node_group = g
r.use_compositing = True

bpy.ops.file.pack_all()
os.makedirs(OUT, exist_ok=True)
bpy.data.orphans_purge(do_recursive=True)
blend = os.path.join(OUT, os.environ.get("DJGAO_BLEND", "venue.blend"))
os.makedirs(os.path.dirname(blend), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=blend, copy=True)
print("saved", blend, "samples", SAMPLES, "look", vs.look)
