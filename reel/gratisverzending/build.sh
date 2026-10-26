#!/usr/bin/env bash
# Bouwt reel.mp4 (1080x1920) en post.jpg (1080x1350) uit de achtergronden,
# productfoto's (images.txt) en de voice-over in voice/gratisverzending/out.
set -euo pipefail
cd "$(dirname "$0")"
AUDIO=${AUDIO_DIR:-../../voice/gratisverzending/out}
mkdir -p work out
while read -r k url; do [ -n "$k" ] && curl -sSL -o "work/$k.jpg" "$url"; done < images.txt
segs=()
for n in 1 2 3 4 5; do
  s="s$n"; a="$AUDIO/0$n.mp3"
  d=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$a"); d=$(python3 -c "print(round($d+0.45,2))")
  if [ -f "work/$s.jpg" ]; then
    ffmpeg -y -v error -loop 1 -i "bg_$s.png" -loop 1 -i "work/$s.jpg" -i "$a" -filter_complex \
      "[1:v]scale=760:760:force_original_aspect_ratio=decrease,format=rgba[p];[0:v][p]overlay=x=110+(860-w)/2:y=620+(860-h)/2,format=yuv420p,fade=t=in:st=0:d=0.25[v];[2:a]apad[a]" \
      -map "[v]" -map "[a]" -t "$d" -r 30 -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar 44100 -ac 2 "work/seg$n.mp4"
  else
    ffmpeg -y -v error -loop 1 -i "bg_$s.png" -i "$a" -filter_complex "[0:v]format=yuv420p,fade=t=in:st=0:d=0.25[v];[1:a]apad[a]" \
      -map "[v]" -map "[a]" -t "$d" -r 30 -c:v libx264 -preset veryfast -crf 20 -c:a aac -ar 44100 -ac 2 "work/seg$n.mp4"
  fi
  segs+=("file 'seg$n.mp4'")
done
printf "%s\n" "${segs[@]}" > work/list.txt
ffmpeg -y -v error -f concat -safe 0 -i work/list.txt -c copy -movflags +faststart out/reel.mp4
ffmpeg -y -v error -i bg_post.png -i work/s1.jpg -i work/s2.jpg -filter_complex \
  "[1:v]scale=410:580:force_original_aspect_ratio=decrease[a];[2:v]scale=410:580:force_original_aspect_ratio=decrease[b];[0:v][a]overlay=x=70+(450-w)/2:y=330+(640-h)/2[t];[t][b]overlay=x=560+(450-w)/2:y=330+(640-h)/2" \
  -q:v 2 out/post.jpg
ffprobe -v error -show_entries format=duration -of csv=p=0 out/reel.mp4
