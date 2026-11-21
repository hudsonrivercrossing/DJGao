#!/bin/zsh
# PolyHaven (CC0) assets through the installed blender-skills scripts.
set -e
cd "$(dirname "$0")/../.."
S=.claude/skills
node $S/polyhaven-scene-builder/scripts/polyhaven-scene-builder.js --hdri rogland_clear_night --resolution 2k
node $S/polyhaven-texture-apply/scripts/polyhaven-texture-apply.js --object ClubWalls --texture red_brick --resolution 2k
node $S/polyhaven-texture-apply/scripts/polyhaven-texture-apply.js --object DanceFloor --texture concrete_floor_painted --resolution 2k
