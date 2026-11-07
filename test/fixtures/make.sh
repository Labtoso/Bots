#!/usr/bin/env sh
# Creates test audio, covers and pages for the API test. Needs ffmpeg.
cd "$(dirname "$0")" || exit 1
names="Nachtfahrt Kupferhimmel Leise_Wellen"
colors="0x1d4ed8 0x16a34a 0x9333ea"
i=1
for n in $names; do
  c=$(echo $colors | cut -d' ' -f$i)
  ffmpeg -loglevel error -y -f lavfi -i "sine=frequency=$((220*i)):duration=$((20+i*5))" -ac 2 song$i.mp3
  ffmpeg -loglevel error -y -f lavfi -i "color=c=$c:s=480x480" -frames:v 1 cover$i.jpg
  t=$(echo "$n" | tr '_' ' ')
  cat > track$i.html <<HTML
<!doctype html><html><head><title>$t</title>
<meta property="og:title" content="$t">
<meta property="og:image" content="http://127.0.0.1:9000/cover$i.jpg"></head>
<body><audio controls src="http://127.0.0.1:9000/song$i.mp3"></audio></body></html>
HTML
  i=$((i+1))
done
cat > playlist.html <<'HTML'
<!doctype html><html><head><title>Testliste</title></head><body>
<audio src="http://127.0.0.1:9000/song1.mp3"></audio><audio src="http://127.0.0.1:9000/song2.mp3"></audio></body></html>
HTML
