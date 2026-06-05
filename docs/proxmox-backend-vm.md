# Backend-Host-VM in Proxmox (Docker, cloud-init)

Eine schlanke Debian-VM **in Proxmox**, die das Backend spielt: den **Bridge**-Container + **cloudflared** (Cloudflare-Tunnel) via Docker Compose. Nur **ausgehende** Verbindungen (kein offener Inbound-Port), erreicht die Proxmox-API im selben Netz.

> Diese Doku endet, wenn die VM steht und Docker läuft. Das Ausrollen des Backends darauf (Repo klonen, `.env`, `docker compose … up`) macht **[deployment.md §3](deployment.md)** bzw. **[azure-quickstart.md](azure-quickstart.md)**.

## Voraussetzungen

- Zugriff auf den **Proxmox-Host** (Shell als `root`).
- Linux-Bridge (im Beispiel `vmbr0`) mit DHCP; Storage `local-lvm` für Disks und `local` mit aktivierten **Snippets** (*Datacenter → Storage → `local` → Content → Snippets* anhaken).
- Internet auf dem Host (zum Laden des Cloud-Images und der Docker-Pakete beim ersten Boot).
- Dein **SSH-Public-Key** (für den Login auf der VM).

---

## Schritt 1 — cloud-init user-data anlegen

Datei `/var/lib/vz/snippets/pttool-bridge-userdata.yaml` auf dem Proxmox-Host. Installiert Docker (offizielles Repo, inkl. Compose-v2-Plugin) und legt einen User `pttool` mit deinem SSH-Key an:

```yaml
#cloud-config
hostname: pttool-bridge
manage_etc_hosts: true

users:
  - name: pttool
    groups: [sudo]
    shell: /bin/bash
    sudo: 'ALL=(ALL) NOPASSWD:ALL'
    lock_passwd: true
    ssh_authorized_keys:
      - ssh-ed25519 AAAA...DEIN_PUBLIC_KEY... user@host   # <-- ersetzen

package_update: true
package_upgrade: true
packages:
  - ca-certificates
  - curl
  - git
  - qemu-guest-agent

runcmd:
  # Docker offizielles Repo (Compose-v2-Plugin inklusive, > v2.20)
  - install -m 0755 -d /etc/apt/keyrings
  - curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc
  - chmod a+r /etc/apt/keyrings/docker.asc
  - sh -c 'echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" > /etc/apt/sources.list.d/docker.list'
  - apt-get update
  - apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  - usermod -aG docker pttool
  - systemctl enable --now docker
  - systemctl enable --now qemu-guest-agent
```

> **YAML-Einrückung:** beim Kopieren die Tiefe beibehalten — sonst bricht cloud-init. Den `ssh-ed25519 …`-Platzhalter durch deinen echten Public-Key ersetzen (Passwort-Login ist absichtlich aus, `lock_passwd: true`).

---

## Schritt 2 — VM bauen

Auf dem Proxmox-Host als `root`:

```bash
cd /tmp
wget -O debian12.qcow2 \
  https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-genericcloud-amd64.qcow2

VMID=200    # freie VMID waehlen

qm create $VMID --name pttool-bridge --memory 4096 --cores 2 \
  --net0 virtio,bridge=vmbr0 --scsihw virtio-scsi-pci --agent enabled=1
qm importdisk $VMID debian12.qcow2 local-lvm
qm set $VMID --scsi0 local-lvm:vm-$VMID-disk-0
qm set $VMID --ide2 local-lvm:cloudinit
qm set $VMID --boot order=scsi0
qm set $VMID --serial0 socket --vga std
qm set $VMID --ipconfig0 ip=dhcp
qm set $VMID --cicustom "user=local:snippets/pttool-bridge-userdata.yaml"
qm set $VMID --tags pttool-backend

qm disk resize $VMID scsi0 +20G   # Cloud-Image ist nur ~2 GB

qm start $VMID
```

> Anders als beim Lab-Template **kein** `qm template` — das hier ist eine dauerhaft laufende VM. Beim Einsatz von `--cicustom user=…` ignoriert Proxmox `--ciuser`/`--sshkeys`; User + Key kommen daher aus dem Snippet (Schritt 1). `--ipconfig0` (Netz) gilt weiterhin.

---

## Schritt 3 — Verifizieren

```bash
# IP der VM herausfinden (Guest-Agent) — oder im Web-UI unter VM -> Summary:
qm guest cmd $VMID network-get-interfaces

ssh pttool@<vm-ip>
docker --version
docker compose version    # muss >= v2.20 sein
```

Der erste Boot dauert etwas (Paket-Update + Docker-Install via cloud-init). Bis cloud-init durch ist: `cloud-init status --wait` in der VM.

---

## Weiter geht's

Die VM ist jetzt der „Docker-VM"-Host aus dem Deployment. Direkt weiter mit **[deployment.md §3](deployment.md)** (oder **[azure-quickstart.md Schritt 4](azure-quickstart.md)**):

```bash
git clone <repo> && cd LF12_Projekt_ProxmoxTeamsTool
cp .env.backend.example .env        # Datei MUSS exakt ".env" heissen
# Werte fuellen (AZURE_*, PROXMOX_*, CF_TUNNEL_TOKEN, CORS_ALLOWED_ORIGINS, API_AUDIENCE)
docker compose -f docker-compose.backend.yml --profile tunnel up -d --build
```

---

## Sizing & Netz

| Ressource | Empfehlung |
|---|---|
| vCPU | 2 |
| RAM | 4 GB (2 GB reichen zur Laufzeit; 4 GB geben Luft fürs `docker build`) |
| Disk | ~25 GB (Cloud-Image ~2 GB + 20 GB) |
| Netz | DHCP geht; für einen Server besser **statische IP / DHCP-Reservierung**. **Nur ausgehend 443** nötig (Cloudflare-Tunnel), **keine** Inbound-Ports. Muss die **Proxmox-API** (`https://<proxmox>:8006`) erreichen. |

---

## Härtung (empfohlen)

- SSH ausschließlich per Key (Passwort-Login ist im Cloud-Image ohnehin aus).
- `unattended-upgrades` aktivieren (`apt-get install -y unattended-upgrades`).
- Dedizierter Proxmox-API-User statt `root@pam` ([deployment.md §2](deployment.md)).
- `BRIDGE_BIND` auf Loopback lassen (Default) — der Tunnel ist der einzige Ingress.
- Secrets als Datei (`<NAME>_FILE` + Compose-`secrets`) statt Klartext-`.env` ([README → Konfiguration](../README.md#konfiguration)).
- `cloudflared`-Image auf ein datiertes Tag pinnen statt `:latest`.

---

## Troubleshooting

- **Kein Docker / cloud-init fehlgeschlagen:** in der VM `cloud-init status --long` und `journalctl -u cloud-final`. Häufigste Ursache: YAML-Einrückung im Snippet, oder kein Internet beim ersten Boot.
- **`docker compose` fehlt / < v2.20:** `docker-compose-plugin` wurde nicht installiert → in der VM `sudo apt-get update && sudo apt-get install -y docker-compose-plugin`.
- **Keine IP:** im Netz kein DHCP oder falsche Bridge → `qm set $VMID --net0 virtio,bridge=<deine-bridge>` und neu starten.
- **SSH `Permission denied`:** Public-Key fehlt/falsch im Snippet, oder falscher User (`pttool`).
- **`Snippet … not found`:** im `local`-Storage ist *Snippets* im Content nicht aktiviert (siehe Voraussetzungen).
- **`pttool` ist nicht in der `docker`-Gruppe:** Ab-/wieder-anmelden (Gruppen greifen erst bei neuer Session) oder `newgrp docker`.
