# Entra-App-Registrierung

Ohne diese Schritte funktioniert kein Login. Das Frontend holt via MSAL ein Access-Token für die Bridge-API, die Bridge validiert die `aud` dieses Tokens — beide Seiten erwarten, dass im Tenant eine App-Registration mit einer bestimmten Application ID URI und einem `access_as_user`-Scope existiert. Die App-Registration selbst wird einmalig pro Tenant angelegt; die Client-/Tenant-IDs landen anschließend in der `.env`.

> Die Anleitung beschreibt den Stand für lokale Entwicklung (`http://localhost:5173`) und Teams-/SWA-Betrieb. Für Teams-SSO muss die Application ID URI den Frontend-Host enthalten.

> **Single-Tenant ist Pflicht.** Die Bridge ist bewusst auf **einen** Tenant festgenagelt: `AZURE_TENANT_ID` muss die konkrete **Directory-(Tenant-)GUID** sein. Fehlt sie oder steht dort eine Multi-Tenant-Authority (`common` / `organizations` / `consumers`), **startet die Bridge nicht** (harter Abbruch beim Boot). Zusätzlich prüft die Bridge bei jedem Token den `tid`-Claim gegen diese GUID. Ein Konto aus einer fremden Organisation bekommt so `401 Invalid token` bzw. `403` mit `code: wrong_tenant` — siehe [bridge/index.ts](../bridge/index.ts).

## Tenant-Typ wählen — Standard vs. EDU

Die Bridge unterstützt **zwei Wege**, Rollen + Klassen für einen User aufzulösen. Steuerung via `AUTH_MODE` in der `.env`:

| Modus | Roles | Klassen | Geeignet für |
|---|---|---|---|
| `standard` | App Roles in Entra, pro User zugewiesen (`Proxmox.Admin`/`Teacher`/`Student`) | `groups`-Claim → Group-OIDs, Fallback Graph `/me/getMemberGroups` | Plain M365-Tenants ohne EDU. Funktioniert auf Free-Tier. |
| `edu` | `primaryRole` aus `/education/me/user` (`teacher`/`student`/`faculty`) → mapped auf App Roles. `Proxmox.Admin` bleibt zusätzlich eine manuelle App-Role-Zuweisung. | `/education/me/classes?$expand=group` → Group-OID der Underlying-M365-Group | Schul-Tenants mit aktivem Teams for Education / School Data Sync. Spart per-User-Zuweisung — kommt aus dem SDS-Sync. |
| `auto` (Default) | Bridge probiert beim ersten Request pro User `GET /education/me`. 200 → EDU. 403/404 → Standard. Ergebnis 1 h gecached. | dito | Default. Funktioniert in beiden Tenant-Typen, ohne Build-/Deploy-Konfig. |

Schritte 1–6 dieser Doku gelten für **beide Modi** — die Entra-App-Registration ist identisch. Was sich unterscheidet:

- **Im `standard`-Modus** brauchst du Schritt 3 (App Roles + Per-User-Zuweisung) zwingend.
- **Im `edu`-Modus** ist Schritt 3 fast überflüssig — `Proxmox.Teacher`/`Student` kommt aus EDU. Du legst die App-Roles trotzdem an (für eventuelle Admin-User), aber nur Admins müssen manuell zugewiesen werden.
- **Im `edu`-Modus** zusätzlich Schritt 5 erweitern: API permissions → Microsoft Graph → `EduRoster.ReadBasic` (delegated) hinzufügen + **Grant admin consent**. Ohne den Consent funktioniert `/education/me` nicht (`AADSTS65001`).
- **`AUTH_MODE=auto` macht den Probe-Call** — wenn Education-Permission fehlt, fällt der Tenant einfach auf Standard zurück, ohne dass irgendwas bricht.

**Test, ob EDU im Tenant verfügbar ist** (Graph Explorer, im Ziel-Tenant eingeloggt):

```http
GET https://graph.microsoft.com/v1.0/education/me
```

- 200 mit JSON → EDU verfügbar, Bridge kann auf `edu`-Modus.
- 403 mit „insufficient privileges" → EDU vorhanden, aber Education-Scope nicht consented. Tenant-Admin muss `EduRoster.ReadBasic` für die App freigeben.
- 404 → kein EDU im Tenant. Standard-Modus ist der einzige Pfad.

## Voraussetzungen

- Ein Microsoft-365-/Entra-Tenant, in dem du App-Registrierungen anlegen darfst (eigener Dev-Tenant oder Test-Tenant mit Application-Developer-Rolle).
- Browser-Zugang zum [Entra Admin Center](https://entra.microsoft.com) bzw. zum klassischen Azure-Portal.

## 1. App-Registrierung anlegen

1. Entra Admin Center → **Identity → Applications → App registrations → New registration**
2. **Name:** z. B. `Proxmox Teams Tool (Dev)`
3. **Supported account types:** *Accounts in this organizational directory only* (Single Tenant) reicht für Dev.
4. **Redirect URI:**
   - Plattform: **Single-page application (SPA)**
   - URI: `http://localhost:5173`
5. **Register** klicken.
6. Auf der Übersichtsseite **Application (client) ID** und **Directory (tenant) ID** kopieren — die landen gleich in `.env` als `VITE_AZURE_CLIENT_ID` und `VITE_AZURE_TENANT_ID` (und ihre Bridge-Mirror `AZURE_CLIENT_ID` / `AZURE_TENANT_ID`).

## 2. „Expose an API" konfigurieren

Das ist der Schritt, an dem AAD sonst mit `AADSTS500011: The resource principal named ... was not found in the tenant` abbricht.

1. Linke Sidebar → **Expose an API**
2. Neben „Application ID URI" → **Set**
3. Für Teams-/SWA-Betrieb den Wert auf das Frontend mappen:

   ```txt
   api://<frontend-host>/<client-id>
   ```

   Beispiel:

   ```txt
   api://lively-stone-0d50e8810.7.azurestaticapps.net/05e8c4d6-e619-4c4f-8cab-13393345c5c2
   ```

   Für rein lokale Browser-Entwicklung ohne Teams geht auch `api://<client-id>`, aber Teams-SSO (`authentication.getAuthToken()`) braucht den Host.
4. **Add a scope:**
   - Scope name: `access_as_user`
   - Who can consent: *Admins and users*
   - Admin consent display name: *Access Proxmox Teams Tool API*
   - Admin consent description: *Erlaubt der App, im Namen des angemeldeten Users gegen die Bridge zu sprechen.*
   - State: **Enabled**
5. Speichern.

Im Frontend ([src/config/authConfig.ts](../src/config/authConfig.ts)) wird genau dieser Scope (`<application-id-uri>/access_as_user`) angefragt. Die Bridge ([bridge/index.ts](../bridge/index.ts)) validiert `aud`; bei hostbasierter Teams-SSO-URI daher `API_AUDIENCE=<application-id-uri>` setzen.

## 2a. Access-Token-Version auf v2 stellen

Wichtige Falle: für custom API Scopes stellt Entra per Default **v1-Access-Tokens** aus, auch wenn die OAuth-Endpoints v2 sind. Der `iss`-Claim ist dann `https://sts.windows.net/<tenant>/` statt `https://login.microsoftonline.com/<tenant>/v2.0` — und die Bridge lehnt das mit `jwt issuer invalid` ab.

1. Linke Sidebar → **Manifest**
2. Im JSON die Zeile suchen: `"requestedAccessTokenVersion": null` (in manchen Manifest-Versionen unter `"api": { "requestedAccessTokenVersion": null }`)
3. Auf **`2`** setzen, speichern.

Danach geben alle frisch ausgestellten Access-Tokens den v2-Issuer zurück. Cached Tokens sind weiter v1 — User müssen einmal Sign-out + Sign-in, damit ein neues Token gezogen wird.

## 3. App Roles definieren

Die Rollen-Logik der App ([siehe KONZEPT.md](../KONZEPT.md)) hängt am `roles`-Claim im Token. Drei App Roles anlegen:

1. Linke Sidebar → **App roles → Create app role**
2. Für jede der drei Rollen:

   | Display name | Value | Allowed member types |
   |---|---|---|
   | Proxmox Admin | `Proxmox.Admin` | Users/Groups |
   | Proxmox Teacher | `Proxmox.Teacher` | Users/Groups |
   | Proxmox Student | `Proxmox.Student` | Users/Groups |

3. Nach dem Anlegen: **Enterprise applications → [unsere App] → Users and groups** und mindestens einen Test-User der gewünschten Rolle zuweisen. (App-Roles werden über die Enterprise-Application-Seite vergeben, nicht über die App-Registration-Seite.)

## 4. Groups-Claim ins Token einbauen (für Klassen)

Klassen kommen aus M365-Group-Memberships. Damit die Bridge das ohne separaten Graph-Call sieht, den `groups`-Claim ins Access-Token aufnehmen:

1. Linke Sidebar → **Token configuration → Add groups claim**
2. **Welche Groups:** Empfehlung **„All groups (incl. SecurityGroups, DirectoryRoles, DistributionLists)"** ankreuzen — das funktioniert auf jedem Lizenztier. Die Alternative *„Groups assigned to the application"* wäre sauberer (nur Klassen-Groups landen im Token), setzt aber **Azure AD P1** voraus, weil Free-/Office-365-Tier keine Group-Assignments an Enterprise Apps erlaubt.
3. Format: **Group ID** (Object-ID der Group). Passt zum Domänenmodell (Group-OID = `class-id`, siehe [KONZEPT.md](../KONZEPT.md)).
4. Bei „All groups": Bridge muss serverseitig filtern auf Klassen-Groups (Proxmox-Tag `tpl-class-<oid>` als Whitelist). Der Token enthält dann Security-Groups, Distribution Lists usw. — alles, was wir nicht in einer der `tpl-class`-Tags wiederfinden, ignorieren wir einfach.
5. Speichern.

**Overage-Fallback:** Bei >150 Group-Memberships ersetzt Entra die `groups`-Array durch einen `_claim_names`-Pointer. Die Bridge erkennt das in [bridge/index.ts → `getUserGroups`](../bridge/index.ts) und lädt die Memberships dann per Graph `POST /v1.0/me/getMemberGroups` nach. Das Ergebnis wird pro User-OID 10 min in einer In-Memory-Map gecacht — kein Graph-Hagel pro UI-Klick, aber neue Klassenzuweisungen werden in unter 10 min sichtbar.

## 5. Microsoft-Graph-Berechtigung für OBO

Die Bridge tauscht das eingehende Token via On-Behalf-Of in ein Graph-Token. Dafür braucht die App eine delegated permission:

1. Linke Sidebar → **API permissions → Add a permission**
2. **Microsoft Graph → Delegated permissions → User.Read** (sollte standardmäßig schon eingetragen sein — falls nicht, hinzufügen).
3. **Grant admin consent for <Tenant>** klicken, falls die Permission noch ungranted ist.

## 6. Client-Secret für die Bridge

Die Bridge braucht für den OBO-Exchange ein Secret:

1. **Certificates & secrets → Client secrets → New client secret**
2. Beschreibung + Gültigkeit (max. 24 Monate für Microsoft-Cloud) setzen.
3. **Value** sofort kopieren — der Wert ist nur einmal sichtbar. In `.env` als `AZURE_CLIENT_SECRET` eintragen.

## 7. `.env` befüllen

Aus den oben gesammelten Werten:

```env
VITE_AZURE_CLIENT_ID=<application-client-id>
VITE_AZURE_TENANT_ID=<directory-tenant-id>
VITE_AZURE_APP_ID_URI=api://<frontend-host>/<application-client-id>

AZURE_CLIENT_ID=<application-client-id>
AZURE_TENANT_ID=<directory-tenant-id>
AZURE_APP_ID_URI=api://<frontend-host>/<application-client-id>
API_AUDIENCE=api://<frontend-host>/<application-client-id>
AZURE_CLIENT_SECRET=<secret-value-aus-schritt-6>
```

`VITE_AZURE_APP_ID_URI` ist bei gehosteten Frontends optional, weil die SPA aus dem aktuellen Host denselben Default ableitet. Explizit setzen ist trotzdem sauberer, besonders bei Custom Domains. `API_AUDIENCE` auf der Bridge muss exakt derselbe Wert sein.

## Smoke-Test

`npm run dev`, `http://localhost:5173` aufrufen, „Mit Microsoft anmelden" klicken.

- **Klappt's:** Frontend hat ein Access-Token mit `aud=<application-id-uri>` und den App-Roles im `roles`-Claim. Bridge-Endpoints sollten unter `Authorization: Bearer …` antworten.
- **`AADSTS500011`:** Schritt 2 (Expose an API) wurde nicht oder falsch durchgeführt.
- **`AADSTS65005: scope … does not exist`:** Application ID URI ist gesetzt, aber unter „Expose an API" wurde noch kein `access_as_user`-Scope angelegt.
- **`AADSTS65001` / Consent-Prompt taucht jedesmal auf:** Schritt 5 (Admin Consent) fehlt.
- **Bridge `401 Invalid token` mit `jwt issuer invalid` im Bridge-Log:** Schritt 2a (Token-Version auf v2) fehlt — Token kommt als v1 raus.
- **`roles`-Claim fehlt:** User ist der App nicht zugewiesen (Schritt 3, Enterprise Applications).
- **`groups`-Claim fehlt oder hat „overage":** Schritt 4, Format ist „Groups assigned to the application", nicht „All".
- **Bridge startet nicht, Log `FATAL: AZURE_TENANT_ID … required` bzw. `… is a multi-tenant authority`:** `AZURE_TENANT_ID` fehlt oder ist `common`/`organizations`/`consumers` — die Bridge erzwingt Single-Tenant. Konkrete Directory-(Tenant-)GUID eintragen.
- **Bridge `403` mit `code: wrong_tenant`:** Token stammt aus einem anderen Tenant als `AZURE_TENANT_ID`.
- **Bridge `403` mit `code: not_provisioned`:** Token ist gültig + im richtigen Tenant, aber der OBO-/Graph-Call scheitert (kein Admin-Consent, externer Gast, nicht zugewiesen) — siehe Schritt 5/6.

## Was wir bewusst *nicht* automatisieren

Die App-Registration selbst lässt sich per Bicep / Terraform / Microsoft Graph PowerShell anlegen, aber im Schulkontext sitzt die Tenant-Administration in der IT, nicht bei uns — wir liefern die Anleitung, jemand mit Tenant-Rechten klickt sie einmal durch. Die App-Role-Zuweisung von Lehrern/Schülern und das Anlegen der Klassen-Groups bleibt ebenfalls Tenant-Aufgabe, dafür bauen wir kein UI ([KONZEPT.md → M365 statt EDU](../KONZEPT.md)).
