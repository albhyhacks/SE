#!/bin/sh
# Build, start MoveProof and expose it through a Cloudflare quick tunnel.
# The public https URL is printed below ("trycloudflare.com"); login codes print here too.
set -e
cd "$(dirname "$0")/.."
npm run build
npx next start -p 3000 &
APP=$!
trap 'kill $APP 2>/dev/null' EXIT INT TERM
# http2 (TCP): many campus/home networks block QUIC (UDP).
cloudflared tunnel --no-autoupdate --protocol http2 --url http://localhost:3000
