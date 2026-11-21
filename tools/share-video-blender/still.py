# Render single frames from the running Blender (quick checks while building):
#   DJGAO_FRAMES="t49.9,t56" node send.js common.py still.py   -> <out>/rev2/t49.9.png ...
# Items are "t<seconds>" (frame (N-1)/30 rule) or plain frame numbers.
import time
REV = os.path.join(OUT, "rev2")
os.makedirs(REV, exist_ok=True)
items = [x for x in os.environ.get("DJGAO_FRAMES", globals().get("FRAMES", "t49.9")).split(",") if x]
pct = int(os.environ.get("DJGAO_PCT", globals().get("PCT", 100)))
r = scene.render
old = (r.filepath, r.resolution_percentage)
r.resolution_percentage = pct
times = []
for it in items:
    f = int(round(F(float(it[1:])))) if it.startswith("t") else int(it)
    scene.frame_set(f)
    r.filepath = os.path.join(REV, (it if it.startswith("t") else "f%04d" % f) + ".png")
    t0 = time.time()
    bpy.ops.render.render(write_still=True)
    times.append((it, f, round(time.time() - t0, 2)))
r.filepath, r.resolution_percentage = old
print(times)
