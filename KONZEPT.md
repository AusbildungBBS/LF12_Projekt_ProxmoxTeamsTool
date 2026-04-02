# Konzept — Proxmox Teams Tool

> Stand: 2026-05-21 — frühe Konzeptphase. Repo enthält aktuell nur ein Teams-SSO-Gerüst (React + Express OBO). Das hier beschreibt die geplante Zielarchitektur.

## Idee in einem Satz

Ein Microsoft-Teams-Tab, mit dem Lehrer Schülern Proxmox-VMs aus Templates zur Verfügung stellen. Alle Aufrufe gegen Proxmox laufen über eine **Bridge** im Proxmox-Netz, die Tokens prüft, die Berechtigung gegen das Domänenmodell auswertet und den Befehl dann an die Proxmox-API durchreicht.

---

## Komponenten

```
┌─────────────────────┐         ┌─────────────────────┐         ┌──────────────┐
│  Teams Tab (React)  │ ──────► │       Bridge        │ ──────► │    Proxmox   │
│  (Browser im Teams) │  HTTPS  │ (im Proxmox-Netz)   │   API   │              │
└──────────┬──────────┘         └──────────┬──────────┘         └──────────────┘
           │                               │
           │ Teams SSO                     │ JWT-Validierung
           │ MSAL                          │ Graph (Gruppen)
           ▼                               ▼
        ┌──────────────────────────────────────┐
        │  Microsoft Entra ID / Graph API      │
        │  - User-Identität                    │
        │  - App Roles (Admin/Teacher/Student) │
        │  - M365-Groups (= Klassen)           │
        └──────────────────────────────────────┘
```

### 1. Frontend (Teams Tab)
- React + TypeScript + Vite, eingebettet als Teams Tab.
- Authentisiert via Teams SSO (`@microsoft/teams-js`) + MSAL.
- Spricht **nur mit der Bridge**, nie direkt mit Proxmox.
- Sendet semantische Befehle: „Create VM from Template X", „Start VM Y", „List my VMs".

### 2. Bridge
- Läuft im selben Netz wie Proxmox (Reachability + Latenz).
- Im besten Fall ein **dünner Proxmox-API-Wrapper** + Auth-Layer davor.
- Zwei externe Abhängigkeiten:
  - **Proxmox-API** für die eigentlichen Operationen.
  - **Microsoft Entra/Graph** für Token-Validierung und ggf. Gruppen­mit­glied­schaft.
- Hält möglichst **keinen State** (siehe Tags unten). Caching optional, später.

### 3. Proxmox
- Source of Truth für VMs, Templates **und deren Metadaten** (Owner, Klasse, Public-Flag) — alles in Proxmox-Tags.

### 4. Microsoft Entra / Graph
- Identität: User-OID aus Token-Claims.
- Rollen: App Roles `Proxmox.Admin`, `Proxmox.Teacher`, `Proxmox.Student` als Claim.
- Klassen: Vorschlag — eine M365-Group/Team pro Klasse, Group-OID ist die Klassen-ID. Mitgliedschaft per Graph abfragbar.

---

## Tokenfluss

1. Teams Tab lädt → Teams SSO gibt ein ID-Token für die App heraus.
2. Frontend holt via MSAL ein **Access-Token für die Bridge-API** (`api://<bridge>/access_as_user`).
3. Frontend ruft Bridge mit `Authorization: Bearer <token>` auf.
4. Bridge validiert das JWT (Signatur via JWKS, `iss`, `aud`, `exp`, App-Role-Claim).
5. Bridge extrahiert **User-OID** und **Rolle** aus Claims.
6. Falls Gruppenmitgliedschaft (= Klassenzugehörigkeit) gebraucht wird: Bridge tauscht das Token via **On-Behalf-Of** gegen ein Graph-Token und fragt Group-Memberships ab.

---

## Datenmodell — alles in Proxmox-Tags

Proxmox-Tags sind plain strings ohne Key/Value. Konvention: `prefix:value`.

### VM-Tags
| Tag | Bedeutung |
|---|---|
| `pttool` | Marker: vom Tool verwaltet (Discovery/Filter) |
| `owner:<user-oid>` | Schüler, dem die VM gehört |
| `tpl:<template-id>` | Aus welchem Template erstellt (für „Recreate") |

### Template-Tags (Proxmox-VM-Templates)
| Tag | Bedeutung |
|---|---|
| `pttool-tpl` | Marker: ein vom Tool nutzbares Template |
| `tpl-owner:<teacher-oid>` | Ersteller (Lehrer) |
| `tpl-public` | Public-Flag — andere Lehrer dürfen es zuweisen |
| `tpl-class:<class-id>` | Klassenzuweisung (mehrfach möglich → m:n) |

**Vorteil:** Keine separate DB. Proxmox bleibt Single Source of Truth. Backups/Snapshots des Proxmox-Clusters enthalten automatisch das Domänenmodell.

**Nachteil/offen:** Pro Auth-Entscheidung müssen Tags gelesen werden. Für die erste Iteration **bewusst akzeptiert** — wir messen, bevor wir optimieren.

---

## Berechtigungs­prüfung (Bridge)

Pro eingehendem Request:

1. **Token validieren** → User-OID, Rolle.
2. **Befehl klassifizieren** — Read vs. Write, Target = VM / Template / Klasse.
3. **Target-Tags lesen** aus Proxmox (oder, bei Listen, Filterung über Tags).
4. **Regel auswerten:**

| Rolle | Darf |
|---|---|
| Admin | alles |
| Teacher | Templates erstellen; eigene Templates oder `tpl-public` als `tpl-class:<seine-klasse>` zuweisen/entziehen; VMs in seinen Klassen sehen + start/stop/delete |
| Student | aus zugewiesenen Templates **eine** VM pro Template erstellen; nur eigene VMs (`owner == self`) start/stop/delete/recreate |

5. **Erlauben** → Proxmox-Call durchreichen. **Verweigern** → 403.

> Auth-Checks prüfen **immer Rolle + Ownership/Class** — reine Rollen-Checks reichen nie aus.

---

## Klassen

**Entschieden:** Eine **M365-Group pro Klasse**, *kein* EDU-Plan an der Schule.

- Group-OID = `class-id` (landet auch als `tpl-class:<group-oid>` in den Proxmox-Tags).
- **Lehrer und Schüler sind beide ganz normale Mitglieder** derselben Group — innerhalb der Group nicht unterscheidbar.
- Die Lehrer/Schüler-Differenzierung kommt **ausschließlich aus der App Role** (`Proxmox.Teacher` vs. `Proxmox.Student`) im Token-Claim.
- „Lehrer Müller ist Lehrer der Klasse 12a" = `App Role == Teacher` **UND** `User ∈ Group(12a)`. Beide Bedingungen prüft die Bridge.
- Schüler analog: `App Role == Student` **UND** `User ∈ Group(12a)`.

### Wie die Bridge an die Mitgliedschaft kommt
- **Bevorzugt:** `groups`-Claim direkt im Access-Token (in Entra konfigurierbar — Token Configuration → Groups Claim). Spart pro Request einen Graph-Call. Achtung: bei >~200 Group-Memberships schaltet Entra auf einen „overage"-Claim um und man muss doch über Graph nachladen — für Schüler praktisch kein Thema, für Lehrer mit vielen Klassen evtl. doch.
- **Fallback / wenn Graph eh nötig:** Bridge fragt per OBO + `/me/memberOf` oder `/me/transitiveMemberOf` ab und cached pro Session.

### Pflege der Klassen
- Liegt komplett im Tenant: Klassen-Group anlegen, Lehrer + Schüler hinzufügen — fertig. Kann über Schulverwaltung/IT/Teams-Admin laufen, **wir bauen dafür kein eigenes UI**.

---

## Performance — bewusst auf später vertagt

- Erste Iteration: Tags pro Request live aus Proxmox lesen.
- Wenn das ruckelt → in dieser Reihenfolge eskalieren:
  1. In-Memory-Cache in der Bridge (Tags pro Resource, kurze TTL).
  2. Batch-Reads (Proxmox liefert Listen mit Tags inklusive).
  3. Dedizierter Endpoint / Sekundärindex in der Bridge.
- **Nicht** vorab bauen.

---

## Was als nächstes ansteht

1. Bridge-Skeleton (eigener Service oder erstmal der bestehende `server/` ausgebaut) mit JWT-Validierung gegen Entra.
2. Tag-Schema festklopfen (siehe oben — Strings finalisieren).
3. Erste Read-Operation: „Liste meine VMs" (Schüler-Sicht) — End-to-End: Frontend → Bridge → Proxmox → gefilterte Antwort.
4. Template-Erstellung + Klassenzuweisung (Lehrer-Sicht).
5. VM-Erstellung aus Template (Schüler-Sicht) inkl. „eine pro Template"-Constraint.

Bis dahin: das hier ist ein Konzeptpapier, kein Implementations­plan.
