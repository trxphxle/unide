#!/bin/sh
# frames + soundtrack → H.264 MP4: a master, and a lighter one for sharing
set -e
OUT="$(cd "$(dirname "$0")/.." && pwd)/out"
mkdir -p "$OUT"
FF=/opt/homebrew/bin/ffmpeg
$FF -v error -y -framerate 30 -i out/f%05d.jpg -i music.wav -c:v libx264 -preset slow -crf 19 -pix_fmt yuv420p -profile:v high -tune film \
  -c:a aac -b:a 256k -movflags +faststart -shortest "$OUT/unide-demo-master.mp4"
$FF -v error -y -framerate 30 -i out/f%05d.jpg -vf scale=1920:1080:flags=lanczos -c:v libx264 -preset slow -b:v 6M -pass 1 -passlogfile x2p -pix_fmt yuv420p -tune film -an -f null /dev/null
$FF -v error -y -framerate 30 -i out/f%05d.jpg -i music.wav -vf scale=1920:1080:flags=lanczos -c:v libx264 -preset slow -b:v 6M -maxrate 10M -bufsize 20M -pass 2 -passlogfile x2p -pix_fmt yuv420p -profile:v high -tune film \
  -c:a aac -b:a 192k -movflags +faststart -shortest "$OUT/unide-demo.mp4"
ls -lh "$OUT"
