#!/bin/zsh
# Picture rewind for the "rewind" moment (67.1-67.6 s): those 15 frames are replaced by the
# 2 s before them played backwards at 4x, each one a 4-frame smear plus a horizontal blur.
#   rewind.sh <src frames dir> <dst frames dir> [frame ...]
# Links every other frame from src into dst unchanged (so dst is what you encode). With
# frame numbers, only those output frames are made (used for the keyframe still).
set -e
SRC=${1:?src}; DST=${2:?dst}; shift 2
R0=2014; R1=2028                      # F(67.1) .. F(67.6)-1, frame N <-> (N-1)/30 s
mkdir -p "$DST"
if [ $# -eq 0 ]; then
  for f in "$SRC"/[0-9][0-9][0-9][0-9].png; do
    n=${${f:t}%.png}; ln -sf "$f" "$DST/${f:t}"
  done
  set -- $(seq $R0 $R1)
fi
for n in "$@"; do
  s=$(( R0 - 1 - 4 * (n - R0) ))
  ins=(); for k in 0 1 2 3; do ins+=(-i "$SRC/$(printf %04d $((s + k))).png"); done
  rm -f "$DST/$(printf %04d $n).png"
  ffmpeg -loglevel error -y "${ins[@]}" -filter_complex \
    "[0:v][1:v][2:v][3:v]mix=inputs=4,gblur=sigma=6:sigmaV=0.6,eq=saturation=0.8:contrast=1.08" \
    -frames:v 1 "$DST/$(printf %04d $n).png"
done
echo "rewind frames: $*"
