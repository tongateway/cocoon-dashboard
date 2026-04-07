#!/bin/bash
set -e

echo "=== Cocoon Dashboard — Cloudflare Deploy ==="

# 1. Build frontend
echo "[1/4] Building frontend..."
npm run build

# 2. Create KV namespace if not exists
echo "[2/4] Setting up KV namespace..."
KV_ID=$(npx wrangler kv namespace list 2>/dev/null | grep -A1 'COCOON_KV' | grep 'id' | awk -F'"' '{print $4}')
if [ -z "$KV_ID" ]; then
  echo "  Creating COCOON_KV namespace..."
  KV_OUTPUT=$(npx wrangler kv namespace create COCOON_KV --cwd worker 2>&1)
  KV_ID=$(echo "$KV_OUTPUT" | grep -o 'id = "[^"]*"' | awk -F'"' '{print $2}')
  echo "  Created: $KV_ID"
  # Update wrangler.toml
  sed -i.bak "s/^id = .*/id = \"$KV_ID\"/" worker/wrangler.toml
  rm -f worker/wrangler.toml.bak
else
  echo "  KV namespace exists: $KV_ID"
  sed -i.bak "s/^id = .*/id = \"$KV_ID\"/" worker/wrangler.toml
  rm -f worker/wrangler.toml.bak
fi

# 3. Deploy Worker
echo "[3/4] Deploying Worker..."
cd worker
npx wrangler deploy
cd ..

echo ""
echo "  Don't forget to set the API key secret (one-time):"
echo "    cd worker && npx wrangler secret put TONCENTER_API_KEY"
echo ""

# 4. Deploy Pages
echo "[4/4] Deploying Pages..."
npx wrangler pages deploy dist --project-name cocoon-dashboard

echo ""
echo "=== Deploy complete ==="
echo "Set up Pages → Worker routing:"
echo "  1. Go to Cloudflare Dashboard → Pages → cocoon-dashboard → Settings"
echo "  2. Under Functions, add a Service Binding:"
echo "     Path: /api/*  →  Worker: cocoon-dashboard-api"
echo ""
echo "Or use _worker.js approach (see README)"
