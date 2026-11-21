# Share video (Blender venue)

This is a wide club version of the birthday share video. It has an open-roof venue, about 1,100 toy figures in the crowd, a bar, a balcony, a crowd barrier, moving-head beams, and fireworks set off by the stage crew and the crowd. The scene is built in a running Blender 5.2 through the blender-mcp socket (port 9876), using only the [kevinbadi/blender-skills](https://github.com/kevinbadi/blender-skills) (install them into `.claude/skills/`; they are not part of this repo).

## Skills used

| Shot (s) | What you see | Skill |
|---|---|---|
| 01 0–3 | Hero: the pink FM-1 under a spotlight, her finger presses the first note (Reels cover) | slow-zoom (DOF) |
| 02 3–8 | Both hands on the keys, each pressed key's slot glows | slow-zoom (DOF) |
| 03 8–17.9 | Rises over her shoulder, the club wakes up | crane-shot |
| 04 17.9–22.3 | Face-on close-up of her as the beat comes in | slow-zoom |
| 05 22.3–26.2 | Low sweep across the dance floor toward the stage | dolly-rotate |
| 06 26.2–28.1 | From the stage at the front row's eye level: faces, hands on the barrier, pumps | slow-zoom |
| 07 28.1–30.1 | Side of the booth | dolly-rotate |
| 08 30.1–32.0 | Booth from the front, low | slow-zoom |
| 09 32.0–35.9 | "dear ___": hands up, push toward the DJ | slow-zoom |
| 10 35.9–38.1 | Stutter, orbit around the booth | dolly-rotate |
| 11 38.1–45.8 | Breakdown: slow push-in to her while the lights go out one by one | slow-zoom |
| 12 45.8–49.7 | Build rush to the stage, one beat of black | slow-zoom |
| 13 49.7–52.6 | DROP face-on: confetti cannons, the crowd jumps together | slow-zoom |
| 14 52.6–55.5 | Behind the DJ: gerbs, shells, the floor jumping | crane-shot |
| 15 55.5–61.3 | Above the crowd, sparklers | dolly-rotate |
| 16 61.3–65.2 | "dear ___" with the whole crowd, heart shells | slow-zoom |
| 17 65.2–67.6 | Machine-gun comets, rising high (67.1–67.6 rewound in post) | crane-shot |
| 18 67.6–70.4 | Countdown, booth from the front | slow-zoom |
| 19 70.4–75.6 | Whole venue in the encore, steady; venue colour follows the key | dolly-rotate |
| 20 75.6–80.8 | High side view, steady, the sky full of fireworks | slow-zoom |
| 21 80.8–84.0 | Finale wide | slow-zoom |
| 22 84.0–85.3 | Her close-up | slow-zoom |
| 23 85.3–87.3 | Title card 生日快乐 / DJ GAO, held | slow-zoom |

PolyHaven (CC0) assets come in through the skill scripts (`polyhaven.sh`):

- `polyhaven-scene-builder` loads the `rogland_clear_night` sky.
- `polyhaven-texture-apply` loads `red_brick` for the walls and `concrete_floor_painted` for the floor.
- `polyhaven_tune.py` grades them into the site palette and adds haze.

There is no skill for building geometry, so the club, DJ, crowd and fireworks go through the same `execute_code` transport (`send.js`). The camera rigs follow the skill recipes: TRACK_TO empties, keyframed location and lens, BEZIER keys, and for dolly-rotate a camera parented to a rotating pivot. Timeline markers switch between the cameras.

## Files

- `common.py`: helpers and timeline loading. `send.js` prepends it to every script and passes `DJGAO_*` shell variables into Blender's `os.environ`.
- `scene.py`: the venue, the crowd barrier, the LED wall and the LED-wall titles.
- `dj.py`: the booth, the FM-1, the figurine and her hands. The FM-1 is measured off `site/assets/fm1-pink.webp`: capsule keys at the `preview/panel-geometry.json` centres in a sunken tray, buttons, knobs and screen as solids whose tops are UV-projected from the photo. Only the pressed key's slot lights, inside its cap.
- `fm1_compare.py`: a straight top-down orthographic render of the FM-1 at the photo's scale, for checking it against the photo.
- `crowd.py`: the figures. The crowd is a point cloud posed every frame by a Geometry Nodes tree (`crowd_gn`) that the music drives through keyed modifier inputs (beat counter, bounce, groove, hands up, phones, sync, crouch, wave, leap). Sync locks the rows to the kick, Leap puts everybody in the air on the first frame of the drop, knees bend on landing, and a raised arm grows so hands, sticks and phones clear the big toy heads. The sparkler and roman-candle holders, crew and bartenders are object rigs, because `fireworks.py` hangs sparks on their hands.
- `lights.py`: moving heads that sweep across the crowd on the beat, stage rim spots and glow-stick fills on the crowd, lights per section, the breakdown dimming, the blackout before the drop, the key-change colours, the LED wall content and the title pop. Only eight lights cast shadows (render speed).
- `fireworks.py`: every spark is precomputed and moved by a Geometry Nodes tree that applies linear-drag ballistics.
- `camera.py`: the shot list and the end title card.
- `render.py`: EEVEE at 1080×1920, 30 fps, 20 samples, AgX, bloom, light motion blur. It packs everything and saves `venue.blend` (or `$DJGAO_BLEND`).
- `still.py`: renders single frames from the running Blender (`DJGAO_FRAMES=t49.9,t56 DJGAO_PCT=50`).
- `rewind.sh`: replaces 67.1–67.6 s with the 2 s before it played backwards at 4× and blurred.

Frame N shows time (N−1)/30 s. There are 2620 frames, 87.3 s in total.

## Rebuild and render

```zsh
tools/share-video-blender/build.sh            # Blender running with blender-mcp connected
node tools/share-video-blender/send.js common.py fm1_compare.py   # optional: <out>/rev2/fm1-top.png
cd spikes/blender-venue
tools/share-video-blender/stills.sh $PWD s 150,1560,2600   # optional test stills + sheet
/Applications/Blender.app/Contents/MacOS/Blender -b venue.blend -a   # frames/####.png, about 2.1 s per frame
tools/share-video-blender/rewind.sh frames final       # links every frame, rewinds 2014-2028
V=(-c:v libx264 -preset slow -tune film -b:v 3500k -maxrate 5000k -bufsize 10M -pix_fmt yuv420p -profile:v high -level 4.2 -g 60)
ffmpeg -framerate 30 -start_number 1 -i final/%04d.png "${V[@]}" -pass 1 -passlogfile p4 -an -f mp4 /dev/null
ffmpeg -framerate 30 -start_number 1 -i final/%04d.png -i song.wav "${V[@]}" -pass 2 -passlogfile p4 -c:a aac -b:a 160k -movflags +faststart -shortest happy-birthday-blender.mp4
```

`build.sh` writes to `spikes/blender-venue/` in the repo (git-ignored). Set `DJGAO_OUT` to write somewhere else, and `DJGAO_BLEND` (relative to the output folder) to save the scene under another name.

The `--search` option of `polyhaven-texture-apply` sends `categories`, but this add-on version expects `category`. Search through `node send.js cmd search_polyhaven_assets '{"asset_type":"textures","category":"..."}'` instead.
