#!/usr/bin/env bash
# Baut ein sideload-faehiges Teams-App-Paket aus manifest.json + Icons.
#
# Pflicht-Env (oder via .env aus dem Repo-Root):
#   FRONTEND_HOST       Public Host:Port ohne https://, z.B. macbook.tail-xxxx.ts.net
#   AZURE_CLIENT_ID     Entra-Client-ID (steht in .env)
# Optional:
#   AZURE_APP_ID_URI    Default: api://$FRONTEND_HOST/$AZURE_CLIENT_ID
#
# Ausgabe: pttool-teams-app.zip im appPackage-Ordner
#
# Nutzung:
#   FRONTEND_HOST=macbook.tail-xxxx.ts.net AZURE_CLIENT_ID=05e8c4d6-... bash build.sh

set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"

# Repo-.env durchladen falls vorhanden. Explizit gesetzte Env-Werte gewinnen
# gegen die .env, damit lokale Demo-Builds leicht ueberschreibbar bleiben.
FRONTEND_HOST_ENV="${FRONTEND_HOST:-}"
AZURE_CLIENT_ID_ENV="${AZURE_CLIENT_ID:-}"
AZURE_APP_ID_URI_ENV="${AZURE_APP_ID_URI:-}"

if [ -f "$HERE/../.env" ]; then
  set -a; . "$HERE/../.env"; set +a
fi

[ -n "$FRONTEND_HOST_ENV" ] && FRONTEND_HOST="$FRONTEND_HOST_ENV"
[ -n "$AZURE_CLIENT_ID_ENV" ] && AZURE_CLIENT_ID="$AZURE_CLIENT_ID_ENV"
[ -n "$AZURE_APP_ID_URI_ENV" ] && AZURE_APP_ID_URI="$AZURE_APP_ID_URI_ENV"

AZURE_CLIENT_ID="${AZURE_CLIENT_ID:-${VITE_AZURE_CLIENT_ID:-}}"
AZURE_APP_ID_URI="${AZURE_APP_ID_URI:-${VITE_AZURE_APP_ID_URI:-}}"

: "${FRONTEND_HOST:?FRONTEND_HOST muss gesetzt sein (z.B. macbook.tail-xxxx.ts.net)}"
: "${AZURE_CLIENT_ID:?AZURE_CLIENT_ID muss gesetzt sein}"
AZURE_APP_ID_URI="${AZURE_APP_ID_URI:-api://$FRONTEND_HOST/$AZURE_CLIENT_ID}"

OUT="$HERE/pttool-teams-app.zip"
TMP="$(mktemp -d)"

# Manifest mit Werten befuellen
python3 - "$HERE/manifest.json" "$TMP/manifest.json" "$FRONTEND_HOST" "$AZURE_CLIENT_ID" "$AZURE_APP_ID_URI" <<'PY'
import json, sys
src, dst, host, client, app_id_uri = sys.argv[1:6]
with open(src) as f: raw = f.read()
raw = (
    raw.replace("{{AZURE_CLIENT_ID}}", client)
       .replace("{{FRONTEND_HOST}}", host)
       .replace("{{AZURE_APP_ID_URI}}", app_id_uri)
)
parsed = json.loads(raw)  # Validierung — JSON-Fehler hier statt im Teams-Upload
with open(dst, "w") as f: json.dump(parsed, f, indent=2)
PY

cp "$HERE/color.png" "$TMP/color.png"
cp "$HERE/outline.png" "$TMP/outline.png"

rm -f "$OUT"
( cd "$TMP" && zip -q "$OUT" manifest.json color.png outline.png )
rm -rf "$TMP"

echo "OK -- $OUT"
echo
echo "Naechste Schritte:"
echo "  1. Entra-App-Registration:"
echo "     Expose an API -> Application ID URI:"
echo "       $AZURE_APP_ID_URI"
echo "     Authentication -> Single-page application -> Redirect URI hinzufuegen:"
echo "       https://$FRONTEND_HOST"
echo "  2. Teams oeffnen -> Apps -> 'Apps verwalten' -> 'App hochladen'"
echo "     -> 'Eine App fuer mich oder mein Team hochladen' -> $OUT waehlen"
echo "  3. App im Sidebar anpinnen, fertig."
