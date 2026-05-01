# Demo-Screenshots — Proxmox Teams Tool

13 Aufnahmen zu Demonstrations-Zwecken, einmal pro Rolle einmal pro Seite.
Erzeugt am 2026-05-28 ueber den Impersonation-Switcher in der Profile-Bar.

## Admin (echte App-Role)

Voller Zugriff, sieht alle Templates, alle VMs, alle aktiven Klassen.

| # | Seite | Datei |
|---|---|---|
| 01 | Home — 3-Spalten-Dashboard | [01-admin-home.png](01-admin-home.png) |
| 02 | Templates — alle Templates mit Manage-Buttons | [02-admin-templates.png](02-admin-templates.png) |
| 03 | Meine VMs — Action-Buttons + Live-Gauges | [03-admin-my-vms.png](03-admin-my-vms.png) |
| 04 | Klassen — Templates + VMs der Klasse, Bulk-Actions | [04-admin-classes.png](04-admin-classes.png) |
| 05 | Admin Console | [05-admin-admin.png](05-admin-admin.png) |

## Lehrer (impersoniert)

Kein Admin-Nav-Eintrag. Sieht ungeclaimte + eigene + class-zugeordnete Templates.
Klassen-Page erlaubt Sammel-Aktionen auf VMs der Klasse.

| # | Seite | Datei |
|---|---|---|
| 06 | Home — Klassen + eigene Templates | [06-teacher-home.png](06-teacher-home.png) |
| 07 | Templates — mit Manage-Buttons fuer eigene | [07-teacher-templates.png](07-teacher-templates.png) |
| 08 | VMs der Klassen, die er betreut | [08-teacher-my-vms.png](08-teacher-my-vms.png) |
| 09 | Klassen | [09-teacher-classes.png](09-teacher-classes.png) |

## Schueler (impersoniert)

Nav reduziert auf Uebersicht / Meine VMs / Templates. Sieht nur Templates
seiner Klassen, eigene VMs (Owner-Match), keine Manage-Buttons.

| # | Seite | Datei |
|---|---|---|
| 10 | Home — Klassen / verfuegbare Templates / eigene VMs | [10-student-home.png](10-student-home.png) |
| 11 | Templates — nur ➕-Button (VM erstellen) | [11-student-templates.png](11-student-templates.png) |
| 12 | Meine VMs | [12-student-my-vms.png](12-student-my-vms.png) |

## Console (rolle-unabhaengig)

| # | Seite | Datei |
|---|---|---|
| 13 | VNC-Console mit eingebetteter Ubuntu-Installer-VM, Toolbar + virt. Tastatur | [13-console.png](13-console.png) |

---

## Wie nachstellen

1. App als echter Admin oeffnen.
2. Profile-Bar oben rechts → `View as:` → Rolle waehlen.
3. Frontend setzt `X-Impersonate-Role`-Header auf jedem Bridge-Call und ueberschreibt die UI-Rolle.
4. Persistiert in `localStorage["pttool.impersonate"]`, ueberlebt Page-Reload.
5. Production-gated: Bridge ignoriert den Header wenn `NODE_ENV=production`.

Reset: `View as:` zurueck auf `Admin (echt)`.
