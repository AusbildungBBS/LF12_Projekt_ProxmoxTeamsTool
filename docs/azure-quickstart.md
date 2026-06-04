# Azure-Hosting — Quickstart (TL;DR)

Vom geklonten Repo zum laufenden Produktivbetrieb: **Frontend auf Azure Static Web Apps (SWA)**, **Bridge** als Docker-Container auf einer Proxmox-VM, erreichbar über einen **Cloudflare-Tunnel** (kein offener Inbound-Port), Auth über **Entra ID**.

> Das ist die Kurzfassung. Ausführlich (mit Diagramm, Härtung, Troubleshooting-Tabelle): **[deployment.md](deployment.md)**. Entra im Detail: **[entra-setup.md](entra-setup.md)**.

## Reihenfolge (wichtig — Henne-Ei vermeiden)

Die Schritte hängen voneinander ab. Zwei GitHub-Werte entstehen **erst spät**:
`VITE_API_BASE_URL` = die Tunnel-URL (erst nach Schritt 3), `AZURE_STATIC_WEB_APPS_API_TOKEN` = aus der SWA-Ressource (erst in Schritt 5). Deshalb **nicht** mit den GitHub-Secrets anfangen, sondern:

**Clone → Entra → Cloudflare-Tunnel → Backend starten → SWA + GitHub-Secrets → Nacharbeiten**

---

## 0. Voraussetzungen

- Proxmox-VM mit **Docker + Compose v2.20+** und ausgehendem 443; muss die Proxmox-API (`https://<proxmox>:8006`) erreichen.
- **Cloudflare**-Account mit einer Domain (für die `api.…`-Subdomain), **Azure**-Account (SWA Free reicht), **GitHub**-Repo (für die Deploy-Action).
- Entra-Admin im Tenant.

## 1. Repo clonen

Auf die VM (fürs Backend):

```bash
git clone <repo> && cd LF12_Projekt_ProxmoxTeamsTool
```

## 2. Entra-App-Registrierung

Einmal pro Tenant. Volle Schritt-für-Schritt-Anleitung: [entra-setup.md](entra-setup.md). Was am Ende existieren muss:

- [ ] App-Registration, **Single-Tenant**. Client-ID + Tenant-ID notieren.
- [ ] **Authentication → SPA-Redirect-URI:** `https://<swa-host>`.
- [ ] **Expose an API → Application ID URI** = `api://<swa-host>/<client-id>` ⟵ siehe Kasten unten.
- [ ] **Scope** `access_as_user` (sonst `AADSTS65005`).
- [ ] **Manifest** `requestedAccessTokenVersion: 2` (sonst lehnt die Bridge das Token mit `jwt issuer invalid` ab).
- [ ] **App Roles** `Proxmox.Admin`, `Proxmox.Teacher`, `Proxmox.Student` + Test-User in *Enterprise Applications → Users and groups* zuweisen.
- [ ] **API permissions → Microsoft Graph → Delegated `User.Read`** + *Grant admin consent*. Für EDU-Tenants zusätzlich `EduRoster.ReadBasic`.
- [ ] **Certificates & secrets → Client secret** anlegen → **Value sofort kopieren** (nur einmal sichtbar) → wird `AZURE_CLIENT_SECRET`.
- [ ] Optional: **Token configuration → groups claim** (Group ID) für die Klassen-Zuordnung.

> **Application ID URI = `api://<swa-host>/<client-id>`.**
> Das Frontend leitet die App-ID-URI aus dem Host ab ([src/config/runtime.ts](../src/config/runtime.ts) `defaultAppIdUri()`): MSAL fragt den Scope unter `api://<swa-host>/<client-id>/access_as_user` an — `VITE_AZURE_APP_ID_URI`, `API_AUDIENCE` (Bridge) und `webApplicationInfo.resource` (Teams-Manifest) müssen alle **exakt** dieser host-basierte Wert sein.

## 3. Cloudflare-Tunnel anlegen (liefert die öffentliche Backend-URL)

1. Cloudflare-Dashboard → **Zero Trust → Networks → Tunnels → Create a tunnel** → Connector-Typ **Cloudflared** → **Token** kopieren → wird `CF_TUNNEL_TOKEN`.
2. Im selben Tunnel **Public Hostname** anlegen:

   | Feld | Wert |
   |---|---|
   | Subdomain + Domain | z. B. `api` . `example.org` |
   | Service Type | `HTTP` |
   | URL | `bridge:3001` ⟵ Compose-Service-Name, **nicht** localhost/IP |

> Die Route lebt im Dashboard, **nicht** in einer lokalen `config.yml` (Token-/Remote-Managed-Tunnel). Die öffentliche API-URL ist ab jetzt `https://api.example.org` → das ist `VITE_API_BASE_URL` (Schritt 5).

## 4. Backend `.env` + Bridge starten

```bash
cp .env.backend.example .env      # Datei MUSS exakt ".env" heißen (Compose-Interpolation von ${CF_TUNNEL_TOKEN})
```

```env
# Pflicht — ohne die startet die Bridge nicht (FATAL):
AZURE_TENANT_ID=<directory-tenant-id>     # konkrete GUID, NICHT "common"
AZURE_CLIENT_ID=<application-client-id>
AZURE_CLIENT_SECRET=<secret>
AUTH_MODE=auto

# Proxmox (optional — leer = keine Klassenfilterung, Bridge läuft trotzdem):
PROXMOX_URL=https://<proxmox>:8006
PROXMOX_TOKEN_ID=<user@realm!name>        # Proxmox-WebUI: Datacenter → Permissions → API Tokens → Add
PROXMOX_TOKEN_SECRET=<uuid>
# PROXMOX_TLS_REJECT_UNAUTHORIZED=false   # nur bei Self-Signed-Cert

# Tunnel + CORS:
CF_TUNNEL_TOKEN=<token-aus-schritt-3>
API_AUDIENCE=api://<swa-host>/<client-id>
CORS_ALLOWED_ORIGINS=https://<swa-host>   # kann erst final gesetzt werden, wenn SWA-Host bekannt (Schritt 6)
```

Starten (Bridge + Tunnel):

```bash
docker compose -f docker-compose.backend.yml --profile tunnel up -d --build
curl https://api.example.org/api/health   # → 200 {"status":"ok",...}
```

> `--profile tunnel` ist Pflicht, sonst startet `cloudflared` nicht. Bei `502`/`error 1033` erreicht der Tunnel `bridge:3001` nicht. Logs: `docker compose -f docker-compose.backend.yml logs -f cloudflared`.

## 5. SWA anlegen + GitHub-Secrets setzen

1. Azure-Portal → **Static Web Apps → Create** (Plan **Free**, Deployment-Quelle **Other/Manual**, damit Azure keinen zweiten Workflow schreibt). SWA-Host (`<name>.azurestaticapps.net`) + **Deployment-Token** (*Overview → Manage deployment token*) notieren.
2. GitHub → *Settings → Secrets and variables → Actions*:
   - **Secret** `AZURE_STATIC_WEB_APPS_API_TOKEN` = Deployment-Token
   - **Variables** (öffentlich, kein Secret):
     - `VITE_AZURE_CLIENT_ID`
     - `VITE_AZURE_TENANT_ID`
     - `VITE_AZURE_APP_ID_URI` = `api://<swa-host>/<client-id>`
     - `VITE_API_BASE_URL` = `https://api.example.org` (aus Schritt 3)
3. Deploy: Push auf `main` (Workflow [.github/workflows/azure-static-web-apps.yml](../.github/workflows/azure-static-web-apps.yml) existiert bereits; die `VITE_*`-Werte werden zur Build-Zeit eingebacken).

> `VITE_*` sind **Build-Zeit** → eine Änderung an `VITE_API_BASE_URL` bedeutet: Frontend neu deployen.

## 6. Nacharbeiten (wenn SWA-Host final feststeht)

- **Entra → Authentication:** Redirect-URI `https://<swa-host>` ergänzen (falls in Schritt 2 noch nicht).
- **Bridge-`.env`:** `CORS_ALLOWED_ORIGINS` + `API_AUDIENCE` auf den SWA-Host setzen → `docker compose -f docker-compose.backend.yml --profile tunnel up -d` (CORS wird nur beim Start gelesen).
- **Teams-Manifest** bauen + hochladen:
  ```bash
  FRONTEND_HOST=<swa-host-ohne-https> AZURE_CLIENT_ID=<client-id> bash appPackage/build.sh
  ```
  Erzeugt `appPackage/pttool-teams-app.zip`. Bei Updates die `version` in [appPackage/manifest.json](../appPackage/manifest.json) erhöhen, sonst cached Teams die alte Version.

## Verifikation (Ende-zu-Ende)

- [ ] `https://api.example.org/api/health` → `200`.
- [ ] SWA-URL im Browser → Login-Screen, „Mit Microsoft anmelden" führt zurück (kein Loop).
- [ ] Nach Login: `/api/*`-Calls gehen an `https://api.example.org` und liefern `200` (kein CORS-Fehler in der Konsole).
- [ ] VM öffnen → VNC-Console verbindet (`wss://api.example.org/ws/vnc/…`).
- [ ] In Teams als Tab → identisches Verhalten.

## Top-Stolpersteine

| Symptom | Ursache / Fix |
|---|---|
| `cloudflared` unhealthy / Tunnel leer | `.env` heißt nicht exakt `.env` → `${CF_TUNNEL_TOKEN}` wird leer interpoliert. Oder `--profile tunnel` vergessen. |
| Bridge `FATAL … multi-tenant authority` | `AZURE_TENANT_ID` ist `common`/`organizations` — konkrete GUID eintragen. |
| `CORS policy … No 'Access-Control-Allow-Origin'` | `CORS_ALLOWED_ORIGINS` fehlt/falsch (Schema + Host exakt, kein Trailing-Slash). Bridge neu starten. |
| `AADSTS500011` / `403 bad_audience` | App-ID-URI / `API_AUDIENCE` / `VITE_AZURE_APP_ID_URI` stimmen nicht exakt überein (alle host-basiert: `api://<swa-host>/<client-id>`). |
| Login-Loop / `AADSTS50011` | SWA-Origin fehlt als SPA-Redirect-URI in Entra (Schritt 6). |
| API-Calls gehen an die SWA-Origin statt an die API | `VITE_API_BASE_URL` war beim Build leer/falsch → Repo-Variable prüfen, neu deployen. |

Volle Troubleshooting-Tabelle: [deployment.md → Troubleshooting](deployment.md#troubleshooting).
