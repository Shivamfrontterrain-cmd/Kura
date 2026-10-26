#!/bin/bash
set -e

PB_URL="http://127.0.0.1:8090"
ADMIN_EMAIL="${1:-admin@kura.com}"
ADMIN_PASS="${2:-MyPassword1234}"

echo "1. Authenticating as superuser ($ADMIN_EMAIL)..."
# Try superusers endpoint (v0.23+) first, fallback to admins (v0.22)
AUTH_RESP=$(curl -s -X POST "$PB_URL/api/superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")

TOKEN=$(echo "$AUTH_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  AUTH_RESP=$(curl -s -X POST "$PB_URL/api/admins/auth-with-password" \
    -H "Content-Type: application/json" \
    -d "{\"identity\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
  TOKEN=$(echo "$AUTH_RESP" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$TOKEN" ]; then
  echo "❌ Failed to obtain auth token. Response was:"
  echo "$AUTH_RESP"
  exit 1
fi

echo "2. Importing collections from docs/pb.json..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PB_JSON_FILE="$SCRIPT_DIR/docs/pb.json"

if [ ! -f "$PB_JSON_FILE" ]; then
  echo "❌ Could not find $PB_JSON_FILE"
  exit 1
fi

# Wrap collections in JSON payload expected by PocketBase: {"collections": [...], "deleteMissing": false}
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

IMPORT_RESP=$(curl -s -w "\n%{http_code}" -X PUT "$PB_URL/api/collections/import" \
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
