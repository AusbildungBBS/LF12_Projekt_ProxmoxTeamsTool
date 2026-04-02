# Proxmox-Entwicklungs-VM auf Windows (Hyper-V)

Für die Bridge-Entwicklung brauchen wir eine erreichbare Proxmox-Instanz. Produktiv läuft die im Schulnetz, dort haben wir aber selten Zugriff. Lokal lösen wir das mit einer Proxmox-VM auf Windows + Hyper-V. macOS funktioniert dafür nicht zuverlässig (kein Hyper-V, VMware/VirtualBox auf Apple Silicon machen kein x86-nested-virt) — Entwicklung mit echter Proxmox-API also nur auf dem Windows-Rechner.

## Voraussetzungen

- **Windows 11 Pro / Enterprise / Education** (Home reicht nicht — Hyper-V fehlt dort).
- **CPU mit Virtualisierung** und im BIOS aktiviert (Intel VT-x / AMD-V).
- **Hyper-V als Windows-Feature** installiert. Wer WSL2 nutzt, hat den Hypervisor schon — den Hyper-V-Manager ggf. trotzdem nachinstallieren:
  `Settings → Apps → Optional features → More Windows features → Hyper-V`.
- Reicht für eine flotte Dev-Maschine: **~16 GB RAM** im Host (4–8 GB davon für die Proxmox-VM).
- ~40 GB freier Plattenplatz.

## VM anlegen

1. Proxmox-VE-ISO von der offiziellen Seite herunterladen.
2. **Hyper-V Manager → New → Virtual Machine**
   - **Generation 2**
   - **Memory:** 6144 MB (fest, kein Dynamic Memory — siehe unten)
   - **Network:** vorerst **Default Switch** (NAT, vom Host aus erreichbar) — für späteren LAN-Zugriff später auf External Switch wechseln.
   - **Virtual Hard Disk:** 40+ GB VHDX
   - **Installation:** Proxmox-ISO mounten

3. **Vor dem ersten Boot:** Secure Boot ausschalten (sonst bootet die ISO nicht):
   - VM-Settings → Security → „Enable Secure Boot" ausschalten.

4. **Vor dem ersten Boot, PowerShell als Admin:**

   ```powershell
   # Nested Virtualization an dieser VM erlauben — sonst können VMs *innerhalb*
   # von Proxmox nicht starten. (Für reine API-Tests nicht zwingend nötig.)
   Set-VMProcessor -VMName "Proxmox" -ExposeVirtualizationExtensions $true

   # MAC-Spoofing erlauben — sonst kommt Traffic von verschachtelten VMs nicht
   # zurück durch den Hyper-V-Switch.
   Set-VMNetworkAdapter -VMName "Proxmox" -MacAddressSpoofing On

   # Dynamic Memory aus — verträgt sich nicht zuverlässig mit nested virt.
   Set-VMMemory -VMName "Proxmox" -DynamicMemoryEnabled $false
   ```

5. VM starten, Proxmox installieren (Standard-Setup, root-Passwort merken, IP/Hostname notieren).

## Nach der Installation

Proxmox bootet ins Web-UI auf `https://<vm-ip>:8006` (User `root`, Realm `pam`).

Zwei Aufräumarbeiten:

- **Enterprise-Repo deaktivieren** (sonst nölt `apt update`):

  ```bash
  # in /etc/apt/sources.list.d/pve-enterprise.list die einzige Zeile auskommentieren
  # und no-subscription-Repo hinzufügen:
  echo "deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription" \
    > /etc/apt/sources.list.d/pve-no-subscription.list
  apt update
  ```

- **API-Token für die Bridge anlegen** (statt root-Passwort hardcoden):
  - Web-UI → Datacenter → Permissions → API Tokens → Add
  - User: `root@pam` (für Dev ok; in Prod eigener User mit beschränkten Rechten)
  - Token-ID frei wählen, „Privilege Separation" für jetzt deaktivieren
  - Den Token-Secret **einmalig** kopieren — kommt nie wieder.

Werte landen dann in `.env` (siehe `.env.example`):

```
PROXMOX_URL=https://<vm-ip>:8006
PROXMOX_TOKEN_ID=root@pam!bridgedev
PROXMOX_TOKEN_SECRET=<das-secret>
```

## Erreichbarkeit prüfen

Vom Host aus (= dort wo die Bridge läuft):

```powershell
curl.exe -k https://<vm-ip>:8006/api2/json/version `
  -H "Authorization: PVEAPIToken=root@pam!bridgedev=<secret>"
```

Antwortet das mit JSON, redet die Bridge gleich genauso mit Proxmox.

## Reicht nested virt nicht / ist's zu langsam?

Für unsere **Bridge-Entwicklung reicht reine API-Verfügbarkeit** — die Proxmox-VM muss selbst *keine* nested VMs erfolgreich booten können. Tags lesen/schreiben, VM-Definitionen anlegen, Start-Befehle absetzen funktioniert alles ohne nested virt; die inneren VMs blieben halt im Boot-Loop hängen, was uns für API-Tests egal ist.

Heißt: wenn nested virt auf dem Host-Rechner zickt, einfach `Set-VMProcessor … -ExposeVirtualizationExtensions $false` belassen und weiterentwickeln — Funktionalitätstests der „echten" VM-Boots machen wir später am Schul-Proxmox.

## Proxmox-API — wo dokumentiert

- **Interaktiver API-Viewer** (das Wichtigste): https://pve.proxmox.com/pve-docs/api-viewer/ — Baumansicht aller Endpoints, Parameter, Required-Privileges. Wenn du eine konkrete Operation suchst, hier zuerst gucken.
- **Wiki-Übersicht** (Auth-Konzepte, Tickets vs. Tokens, Pagination): https://pve.proxmox.com/wiki/Proxmox_VE_API
- **API direkt aus deiner Instanz:** jede Proxmox-Installation liefert die Schema-Doku unter `https://<vm-ip>:8006/api2/json/_apidoc` — gleicher Datenstand wie der Viewer, nur auf deinem System.
- **Offline-Snapshot im Repo:** [proxmox-apidoc-snapshot.js](./proxmox-apidoc-snapshot.js) — der Rohdatensatz, den der Viewer auswertet (`const apiSchema = [...]`, ~470 Endpoints). Gezogen von `https://pve.proxmox.com/pve-docs/api-viewer/apidoc.js`. Wenn Proxmox neue Endpoints rausbringt, einfach mit `curl -o` überschreiben.
- **Tags-spezifisch** (für unser Modell relevant): `/nodes/{node}/qemu/{vmid}/config` akzeptiert `tags` als Komma-separierten String (Proxmox 7+). Tags lassen sich nur per Config-Update setzen, nicht direkt einzeln hinzufügen — heißt: read-modify-write.

Auth-Form, die wir nutzen (API-Token statt Ticket):

```
Authorization: PVEAPIToken=<USER>@<REALM>!<TOKENID>=<SECRET>
```

Keine Session, kein CSRF — passt zu unserem stateless Bridge-Modell.

## Was *nicht* funktioniert auf dem MacBook

Falls die Frage aufkommt: auf Apple Silicon gibt es keinen praktikablen Weg, x86-Proxmox mit nested virt laufen zu lassen. UTM/QEMU emuliert x86 zwar, aber ohne KVM-artige Beschleunigung ist die Performance Spielzeug-Level, und nested virt fehlt erst recht. Auf dem Mac arbeiten wir an Bridge + UI, der Proxmox-Teil wandert auf den Windows-Rechner.
