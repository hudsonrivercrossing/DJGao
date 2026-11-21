#!/bin/zsh
# Rebuild the whole venue in the running Blender (blender-mcp on :9876) and save venue.blend.
set -e
cd "$(dirname "$0")"
run() { echo "== $*"; node send.js common.py "$@"; }
run scene.py
./polyhaven.sh
run polyhaven_tune.py
run dj.py
run crowd.py
run lights.py
run fireworks.py
run camera.py
run render.py
