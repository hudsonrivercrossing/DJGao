#!/bin/zsh
# Render test stills headless from the saved venue.blend and tile them into sheet.jpg.
#   stills.sh <out-dir> <prefix> <frame,frame,...>
set -e
OUT=${1:?out dir}; PREFIX=${2:-s}; FRAMES=${3:-120,450,700,1000,1250,1550,1900,2200,2400,2600}
cd "$OUT"
[ -n "$SKIP_RENDER" ] || /Applications/Blender.app/Contents/MacOS/Blender -b venue.blend -o "$OUT/stills/${PREFIX}_####" -F PNG -f "$FRAMES" 2>&1 | grep -E "Time:|Error" || true
ins=(); for f in ${(s:,:)FRAMES}; do ins+=(-i "stills/${PREFIX}_$(printf %04d $f).png"); done
n=${#${(s:,:)FRAMES}}
cols=$(( n > 5 ? (n + 1) / 2 : n )); rows=$(( (n + cols - 1) / cols ))
ffmpeg -loglevel error -y "${ins[@]}" -filter_complex "$(for i in $(seq 0 $((n-1))); do printf "[%d]scale=360:640[v%d];" $i $i; done)$(for i in $(seq 0 $((n-1))); do printf "[v%d]" $i; done)xstack=inputs=${n}:layout=$(python3 -c "
c=$cols;n=$n;print('|'.join(f'{(i%c)*360}_{(i//c)*640}' for i in range(n)))"):fill=black" -frames:v 1 "${PREFIX}-sheet.jpg"
echo "$OUT/${PREFIX}-sheet.jpg"
