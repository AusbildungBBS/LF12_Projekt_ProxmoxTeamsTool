# Proxmox Teams Tool

Microsoft-Teams-Tab, mit dem Lehrer Schülern Proxmox-VE-VMs aus Templates zur Verfügung stellen. Drei Rollen (Admin / Lehrer / Schüler), Klassen kommen aus M365-Groups, alle Proxmox-Metadaten leben als Tags in Proxmox selbst.

> **Status:** frühe Konzeptphase. Frontend + Auth-Gerüst + Bridge-Skeleton mit JWT-Validierung stehen. Die Anbindung an Proxmox ist als Interface deklariert, aber noch nicht implementiert — siehe [Roadmap](#roadmap).

Mehr Details:
- **Setup-Anleitung (Onboarding):** [docs/setup.md](docs/setup.md)
- **Entra-App-Registrierung (Pflicht für Login):** [docs/entra-setup.md](docs/entra-setup.md)
- **Proxmox-Dev-Setup (Hyper-V) + API-Pointer:** [docs/proxmox-dev-setup.md](docs/proxmox-dev-setup.md)
- **Architektur:** [KONZEPT.md](KONZEPT.md)

---

## Komponenten

| | |
|---|---|
| **Frontend** | React 19 + TypeScript + Vite. Läuft als Teams-Tab. |
| **Bridge** ([bridge/](bridge/)) | Express-Backend im Proxmox-Netz, validiert Entra-JWTs, prüft Rollen + Klasse + Ownership, ruft die Proxmox-API. |
| **Auth** | Teams SSO via `@microsoft/teams-js`, MSAL, On-Behalf-Of zu Microsoft Graph. |
| **Proxmox-Anbindung** | `ProxmoxClient`-Interface in [bridge/proxmox/](bridge/proxmox/). Implementation folgt. |

---

## Schnellstart (lokal)

```bash
# Abhängigkeiten
npm install

# .env aus Vorlage anlegen — Werte können erstmal leer bleiben für die UI-Vorschau
cp .env.example .env

# Frontend (5173) + Bridge (3001) starten
npm run dev
```

Aufrufen: <http://localhost:5173>

> **Hinweis:** Ohne gültige Entra-App-Registrierung und Test-Tenant funktioniert der Login-Flow nicht. Für die reine UI-Vorschau gibt es einen Dev-Bypass — siehe unten.

---

## UI-Vorschau ohne Login

Solange wir keinen erreichbaren Test-Tenant haben, lässt sich die UI über einen URL-Parameter als beliebige Rolle ansehen. Wird einmal gesetzt, persistiert die Wahl in `localStorage`, bis explizit wieder abgeschaltet wird.

| URL | Effekt |
|---|---|
| `http://localhost:5173/?devauth=student` | als Schüler eingeloggt |
| `http://localhost:5173/?devauth=teacher` | als Lehrer eingeloggt |
| `http://localhost:5173/?devauth=admin` | als Admin eingeloggt |
| `http://localhost:5173/?devauth=off` | Dev-Modus aus, zurück zum echten Login-Flow |

Ist der Dev-Modus aktiv, erscheint oben ein gelber Banner mit Switch-Buttons zwischen den Rollen — dort lässt sich auch ein Klick-Logout/Switch auslösen.

Der Bypass greift **ausschließlich** wenn explizit aktiviert. Im Auslieferungszustand läuft der normale MSAL/Teams-SSO-Pfad. Implementation: [src/auth/DevFakeAuth.tsx](src/auth/DevFakeAuth.tsx).

---

## Docker (Bridge produktiv)

Die Bridge ist containerisiert (Multi-Stage Node-Build, läuft als `node`-User):

```bash
docker compose up --build bridge
```

In Produktion läuft die Bridge im Proxmox-Netz. Zwei Wege, sie erreichbar zu machen sind in [docker-compose.yml](docker-compose.yml) als Kommentar dokumentiert:

1. **Klassisches Port-Mapping** (Default) — Bridge wird auf Host-Port 3001 exponiert, davor ein Reverse-Proxy mit TLS.
2. **Cloudflare Tunnel** (auskommentiert) — `cloudflared` als Sidecar-Container; keine eingehenden Ports auf dem Host nötig, der Tunnel öffnet nur eine ausgehende Verbindung. Empfohlen, wenn man die Firewall im Schul-Netz nicht aufmachen will.

---

## Konfiguration

Alle Variablen leben in `.env` (siehe `.env.example`). Frontend-Variablen tragen ein `VITE_`-Prefix; alle anderen liest die Bridge.

| Variable | Wofür |
|---|---|
| `VITE_AZURE_CLIENT_ID` / `AZURE_CLIENT_ID` | Application (Client) ID der Entra-App |
| `VITE_AZURE_TENANT_ID` / `AZURE_TENANT_ID` | Tenant ID |
| `AZURE_CLIENT_SECRET` | Client Secret (Bridge-seitig für OBO-Token-Exchange) |
| `API_AUDIENCE` | Erwartete `aud` der eingehenden Tokens (default: `api://<AZURE_CLIENT_ID>`) |
| `AUTH_MODE` | `standard` / `edu` / `auto` (Default). Steuert, ob Rollen + Klassen aus App-Roles + `groups`-Claim (Standard) oder aus Microsoft Education Graph (EDU) kommen. Details: [docs/entra-setup.md](docs/entra-setup.md). |
| `PROXMOX_URL` / `PROXMOX_TOKEN_ID` / `PROXMOX_TOKEN_SECRET` | Proxmox-Anbindung — kommt mit der Implementation des `ProxmoxClient` |
| `CF_TUNNEL_TOKEN` | Optional, wenn Cloudflare-Tunnel-Service in Compose aktiviert wird |

---

## Roadmap

1. **`RealProxmoxClient`** — HTTP-Wrapper für die Proxmox-API gegen eine Hyper-V-Proxmox-VM (Setup-Anleitung: [docs/proxmox-dev-setup.md](docs/proxmox-dev-setup.md)).
2. **Erste Bridge-Endpoints** — `GET /api/vms`, `GET /api/templates`, gefiltert nach Rolle + Klassen-Membership.
3. **Frontend-Wiring** — die aktuell als Empty-State stehenden Seiten gegen echte Endpoints fetchen.
4. **Teams-Manifest aktualisieren** — auf die produktive Bridge-URL.
5. **Cloudflare-Tunnel-Deployment** der Bridge im Schulnetz.
