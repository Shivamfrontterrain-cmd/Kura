#!/bin/bash
set -e

ADMIN_EMAIL="${1:-admin@kura.com}"
ADMIN_PASS="${2:-MyPassword1234}"

# Determine accessible PocketBase URL
CANDIDATE_URLS=("http://127.0.0.1:8090" "http://localhost:8090" "https://kuraanime.duckdns.org")
AUTH_ENDPOINTS=("/api/collections/_superusers/auth-with-password" "/api/admins/auth-with-password" "/api/superusers/auth-with-password")

TOKEN=""
FOUND_URL=""

echo "1. Authenticating as superuser ($ADMIN_EMAIL)..."

for URL in "${CANDIDATE_URLS[@]}"; do
  for EP in "${AUTH_ENDPOINTS[@]}"; do
    AUTH_RESP=$(curl -s -k -X POST "$URL$EP" \
      -H "Content-Type: application/json" \
      -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}" || true)

    T=$(echo "$AUTH_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4 || true)
    if [ -n "$T" ]; then
      TOKEN="$T"
      FOUND_URL="$URL"
      echo "   ✓ Authenticated via $URL$EP"
      break 2
    fi
  done
done

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to obtain auth token. Last response was:"
  echo "$AUTH_RESP"
  echo ""
  echo "💡 Tip: You can also import collections in 10 seconds via the web UI:"
  echo "   1. Open https://kuraanime.duckdns.org/_/"
  echo "   2. Click 'Settings' (gear icon) in the top bar -> 'Import collections'"
  echo "   3. Click 'Load from JSON file' and choose docs/pb.json (or paste its content), then click Review and Confirm!"
  exit 1
fi

echo "2. Importing collections from docs/pb.json..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PB_JSON_FILE="$SCRIPT_DIR/docs/pb.json"

if [ ! -f "$PB_JSON_FILE" ]; then
  echo "❌ Could not find $PB_JSON_FILE"
  exit 1
fi

PAYLOAD=$(python3 -c "
import json
with open('$PB_JSON_FILE') as f:
    cols = json.load(f)
print(json.dumps({'collections': cols, 'deleteMissing': False}))
" 2>/dev/null || node -e "
const fs = require('fs');
const cols = JSON.parse(fs.readFileSync('$PB_JSON_FILE', 'utf8'));
console.log(JSON.stringify({ collections: cols, deleteMissing: false }));
")

IMPORT_RESP=$(curl -s -k -w "\n%{http_code}" -X PUT "$FOUND_URL/api/collections/import" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD")

HTTP_CODE=$(echo "$IMPORT_RESP" | tail -n1)
BODY=$(echo "$IMPORT_RESP" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 204 ]; then
  echo "✅ Collections successfully imported into PocketBase!"
  echo "All collections (users, bookmarks, comments, watched, sys_source_available) are now active."
else
  echo "⚠️ Import returned status $HTTP_CODE:"
  echo "$BODY"
fi
