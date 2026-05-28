# Teams-App-Sideload (lokales Testen)

Schnellster Weg, die App als nativen Teams-Tab zu installieren — ohne
Org-weites Rollout. Reine Dev-/Demo-Variante; fuer Produktivbetrieb siehe
[deployment.md](deployment.md).

## Was du brauchst

- Eine **HTTPS-erreichbare URL** fuer das Frontend. Localhost geht nicht
  — Teams iframed die App und braucht ein vertrauenswuerdiges TLS-Cert.
- Eine **Entra-App-Registration** (siehe [entra-setup.md](entra-setup.md))
  mit dieser HTTPS-URL als SPA-Redirect.
- `python3` + `zip` auf dem Mac (sind beide standard da).

## Tunnel aufmachen (Tailscale Funnel — schnellster Weg)

Falls Tailscale schon installiert (haben wir fuer Proxmox eh):

1. Im Tailscale Admin-Console (`login.tailscale.com`) → **Settings →
   Funnel** → fuer den Mac enablen.
2. Auf dem Mac:

   ```bash
   sudo tailscale funnel --bg 5173
   ```

   Gibt dir eine URL aus wie
   `https://macbook-pro-von-alexander.<deintailnet>.ts.net/`.
   Diese URL ist public-HTTPS mit Let's-Encrypt-Cert von Tailscale,
   kein Login noetig.

Alternative: Cloudflare Tunnel fuer das Backend (Service `cloudflared` unter
dem `tunnel`-Profil in `docker-compose.backend.yml`). Mehr Setup, dafuer fuer
Prod geeignet; das Frontend laeuft dort in der Regel auf Azure Static Web Apps.

## Entra-App vorbereiten

Im Entra-Portal die App-Registration oeffnen:

1. **Authentication** → bei der bestehenden Single-page-application-
   Plattform den Tunnel-Host als zweite Redirect-URI hinzufuegen:

   ```
   https://<dein-tunnel-host>
   ```

   Localhost-Redirect kannst du dabeilassen (fuer weiter parallel
   `npm run dev`-Entwicklung).

2. **Expose an API** → Application ID URI muss zum Host passen:

   ```txt
   api://<dein-tunnel-host>/<client-id>
   ```

   Dazu den Scope `access_as_user` anlegen und unter **Authorized client
   applications** die Teams-Clients fuer diesen Scope hinterlegen:

   ```txt
   1fec8e78-bce4-4aaf-ab1b-5451cc387264  # Teams Desktop/Mobile
   5e3ce6c0-2b1f-4285-8d4b-75ee78787346  # Teams Web
   ```

## Manifest + Icons in ein Sideload-Zip packen

```bash
cd appPackage

# entweder Variablen explizit setzen:
FRONTEND_HOST=macbook-pro-von-alexander.<deintailnet>.ts.net \
AZURE_CLIENT_ID=05e8c4d6-... \
  bash build.sh

# oder einfach build.sh laufen lassen, die zieht AZURE_CLIENT_ID aus .env
# falls dort gesetzt — du musst nur noch FRONTEND_HOST vorne dranschreiben.
```

Das Script:

- Setzt im `manifest.json` die Platzhalter `{{FRONTEND_HOST}}` und
  `{{AZURE_CLIENT_ID}}` ein, baut `AZURE_APP_ID_URI` standardmaessig als
  `api://<frontend-host>/<client-id>` und validiert das JSON.
- Zippt das mit `color.png` (192×192) und `outline.png` (32×32) auf
  oberster Ebene zu `pttool-teams-app.zip`.

Die Zip liegt anschliessend im `appPackage/`-Ordner. Sie ist
gitignored, das Manifest-Template bleibt versioniert.

## In Teams hochladen

1. Teams oeffnen (Desktop oder Web)
2. Linke Sidebar → **Apps** (das Icon ganz unten)
3. Unten links **„Apps verwalten"** → oben rechts **„App hochladen"**
4. **„Eine App fuer mich oder mein Team hochladen"** → die
   `pttool-teams-app.zip` waehlen
5. **Hinzufuegen** → Teams loggt dich via Entra ein und der erste
   Static-Tab (Dashboard) oeffnet sich

Du hast jetzt drei Tabs im App-Header: **Proxmox** (Dashboard),
**Templates**, **Meine VMs**. Pin links in der Sidebar, dann ist die
App in jeder Teams-Session direkt da.

## Troubleshooting

- **„Diese App kann nicht ausgefuehrt werden"** im Tab: meistens das
  Cert. Pruefe ob die Tunnel-URL im Browser direkt erreichbar ist und
  kein Cert-Fehler kommt.
- **Login-Schleife**: Redirect-URI in Entra fehlt fuer den Tunnel-Host.
  Vergleiche genau (https + Hostname, kein trailing slash).
- **„AADSTS"-Fehler im Tab-Inhalt**: gleiche Ursachen wie beim normalen
  Browser-Login. Siehe [entra-setup.md → Smoke-Test](entra-setup.md#smoke-test).
- **Keine Konsole im Tab sichtbar**: Teams-Browser ist im Strict-Mode,
  manche WebSockets brauchen `validDomains`-Eintrag. Pruefe ob alle
  Hosts, die das Frontend kontaktiert, im `validDomains`-Array des
  Manifests stehen.

## Wenn du das fuer den Schul-Tenant deployen willst

- Produktivpfad nach [deployment.md](deployment.md): Frontend auf Azure Static
  Web Apps, Bridge auf der Proxmox-VM hinter Cloudflare-Tunnel.
- Stabile Domains verwenden: SWA-Host oder Custom Domain fuer das Frontend,
  Cloudflare Public Hostname fuer die API.
- Manifest-Version inkrementieren (jede Update-Variante braucht hoehere
  `version` in `manifest.json`).
- Statt Sideload: Manifest in der Teams Admin Console org-weit
  approven. Dann taucht die App fuer alle Schueler/Lehrer im
  „App-Katalog" auf — kein manuelles Hochladen mehr pro User.
