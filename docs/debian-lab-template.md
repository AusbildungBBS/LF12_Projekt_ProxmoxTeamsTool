# Debian-Lab-VM-Template für Proxmox (Self-Init, DHCP, Connect-Banner)

Erzeugt ein Proxmox-Template aus einem Debian-Cloud-Image, das

- sich **selbst initialisiert** und per **DHCP** eine IP zieht,
- beim **ersten** Boot ein zufälliges **10-stelliges Zahlen-Passwort** für `root` würfelt,
- bei **jedem** Boot in der **VNC-Konsole** anzeigt, wie man sich verbindet: `root@<ip>` + Passwort.

Jeder Klon bekommt ein **eigenes** Passwort (das Passwort entsteht erst beim ersten Boot des Klons, nicht im Template).

---

## Voraussetzungen

- Zugriff auf den **Proxmox-Host** (Shell als `root`).
- Eine Linux-Bridge (im Beispiel `vmbr0`) mit DHCP im Netz.
- Storage `local-lvm` für Disks und `local` mit aktivierten **Snippets**
  (Datacenter → Storage → `local` → Content → *Snippets* anhaken).
- Internet auf dem Host (zum Laden des Cloud-Images).

---

## Schritt 1 — cloud-init user-data anlegen

Datei `/var/lib/vz/snippets/lab-userdata.yaml` auf dem Proxmox-Host:

```yaml
#cloud-config
disable_root: false
ssh_pwauth: true
write_files:
  - path: /usr/local/sbin/vm-connect-banner.sh
    permissions: '0755'
    content: |
      #!/bin/bash
      set -uo pipefail
      CRED=/etc/vm-connect.cred

      # SSH-Hostkeys nachziehen, falls beim Templating entfernt (eindeutig pro Klon)
      ls /etc/ssh/ssh_host_*_key >/dev/null 2>&1 || { ssh-keygen -A; systemctl restart ssh 2>/dev/null || true; }

      # Erst-Boot: 10-stelliges Zahlen-Passwort fÃ¼r root erzeugen + persistieren
      if [ ! -f "$CRED" ]; then
        PW="$(tr -dc 0-9 </dev/urandom | head -c 10)"
        echo "root:$PW" | chpasswd
        ( umask 077; printf 'LOGIN=root\nPASS=%s\n' "$PW" > "$CRED" )
      fi
      . "$CRED"

      # Auf DHCP-IPv4 warten (bis ~30s)
      IP=""
      for _ in $(seq 1 30); do
        IP="$(ip -4 -o addr show scope global up 2>/dev/null | awk '{print $4}' | cut -d/ -f1 | head -n1)"
        [ -n "$IP" ] && break; sleep 1
      done
      IP="${IP:-<keine IP - DHCP?>}"

      # Banner bauen
      {
        echo
        echo "=========================================================="
        echo "   VM bereit - per SSH verbinden:"
        echo
        echo "       ssh ${LOGIN}@${IP}"
        echo "       Passwort:  ${PASS}"
        echo
        echo "   (nach erstem Login Ã¤ndern:  passwd)"
        echo "=========================================================="
        echo
      } > /etc/issue

      # Sofort sichtbar auf allen Konsolen (VGA tty1 + Serial ttyS0 + aktive console)
      for dev in /dev/tty1 /dev/ttyS0 /dev/console; do
        [ -w "$dev" ] && cat /etc/issue > "$dev" 2>/dev/null || true
      done
      # Login-Prompt mit frischem /etc/issue neu zeichnen
      systemctl restart getty@tty1 2>/dev/null || true
      systemctl restart serial-getty@ttyS0 2>/dev/null || true
      logger -t vm-connect "ready: ${LOGIN}@${IP}"
  - path: /etc/systemd/system/vm-connect-banner.service
    content: |
      [Unit]
      Description=VM connect banner (root@ip + password) on console
      After=network-online.target
      Wants=network-online.target
      [Service]
      Type=oneshot
      ExecStart=/usr/local/sbin/vm-connect-banner.sh
      [Install]
      WantedBy=multi-user.target
  - path: /etc/ssh/sshd_config.d/99-lab.conf
    content: |
      PermitRootLogin yes
      PasswordAuthentication yes
runcmd:
  - [ systemctl, daemon-reload ]
  - [ systemctl, enable, --now, vm-connect-banner.service ]
  - [ sh, -c, "systemctl restart ssh 2>/dev/null || systemctl restart sshd 2>/dev/null || true" ]
```

> **Hinweis zur YAML-Einrückung:** Die Skript-Zeilen unter `content: |` müssen
> gleich tief eingerückt bleiben (hier 6 Leerzeichen). Beim Kopieren nicht
> verschieben — sonst bricht cloud-init.

---

## Schritt 2 — Template bauen

Auf dem Proxmox-Host als `root`:

```bash
cd /tmp
wget -O debian12.qcow2 \
  https://cloud.debian.org/images/cloud/bookworm/latest/debian-12-genericcloud-amd64.qcow2

VMID=9000   # freie VMID wÃ¤hlen

qm create $VMID --name debian12-lab --memory 2048 --cores 2 \
  --net0 virtio,bridge=vmbr0 --scsihw virtio-scsi-pci
qm importdisk $VMID debian12.qcow2 local-lvm
qm set $VMID --scsi0 local-lvm:vm-$VMID-disk-0
qm set $VMID --ide2 local-lvm:cloudinit
qm set $VMID --boot order=scsi0
qm set $VMID --vga std                                   # VGA -> Banner im noVNC sichtbar
qm set $VMID --serial0 socket                            # Serial-Konsole zusÃ¤tzlich (genericcloud)
qm set $VMID --ipconfig0 ip=dhcp                         # DHCP
qm set $VMID --cicustom "user=local:snippets/lab-userdata.yaml"
qm set $VMID --tags pttool-tpl                           # Tag, damit das Proxmox-Teams-Tool es findet

# (optional) Disk vergrÃ¶Ãern, das Cloud-Image ist klein:
qm disk resize $VMID scsi0 +8G

qm template $VMID
```

---

## Schritt 3 — Testen

```bash
qm clone 9000 123 --name test-vm --full
qm start 123
```

Dann im Proxmox-Webinterface **VM 123 → Console** öffnen. Nach dem Boot steht dort:

```
==========================================================
   VM bereit - per SSH verbinden:

       ssh root@10.x.x.x
       Passwort:  1234567890

   (nach erstem Login Ã¤ndern:  passwd)
==========================================================
```

Aufräumen: `qm stop 123 && qm destroy 123`.

---

## Wie es funktioniert

| Anforderung | Umsetzung |
|---|---|
| Self-Init + DHCP | Debian-Cloud-Image + cloud-init, `--ipconfig0 ip=dhcp` |
| IP + Connect-Info bei jedem Boot | oneshot-systemd-Service (`vm-connect-banner.service`) nach `network-online`; schreibt `/etc/issue` **und** direkt auf die Konsolen (`tty1`/`ttyS0`) |
| Random User/PW initial | `/etc/vm-connect.cred` fehlt im Template → jeder Klon würfelt beim ersten Boot ein eigenes 10-Ziffern-Passwort für `root` und persistiert es |
| Eindeutigkeit pro Klon | cloud-init erzeugt machine-id + SSH-Hostkeys pro Instanz neu; das Cred-File entsteht erst zur Laufzeit |

---

## Sicherheits-Hinweise

- **Das Passwort steht im Klartext auf der Konsole** (vor dem Login) — genau so gewollt, damit Lernende sich verbinden können. Wer Console-Zugriff hat, sieht es.
- **`root`-Login per SSH mit Passwort ist aktiviert** (`99-lab.conf`). Für ein abgeschottetes Lab-/Schulnetz okay, **nicht** für öffentlich erreichbare VMs.
- **10 Ziffern = schwach** (~33 bit Entropie). Für „erst mal" okay; Lernende sollen mit `passwd` ändern.

---

## Anpassungen

**Stärkeres Passwort** (alphanumerisch, 14 Stellen) — im Skript ersetzen:
```bash
PW="$(tr -dc A-Za-z0-9 </dev/urandom | head -c 14)"
```

**Eigener Benutzername statt `root`** — statt `chpasswd` für root z. B.:
```bash
USER="lab$(tr -dc 0-9 </dev/urandom | head -c 4)"
useradd -m -s /bin/bash "$USER"; echo "$USER:$PW" | chpasswd
usermod -aG sudo "$USER"
printf 'LOGIN=%s\nPASS=%s\n' "$USER" "$PW" > "$CRED"
```
(dann im sshd-Drop-in `PermitRootLogin yes` entfernen).

**Andere Debian-Version** — Image-URL anpassen (z. B. `trixie` statt `bookworm`).

---

## Troubleshooting

- **Banner kommt nicht / kein Passwort:** `systemctl status vm-connect-banner.service` und `journalctl -t vm-connect` in der VM prüfen. Häufig: cloud-init-`runcmd` lief nicht (YAML-Einrückung in `lab-userdata.yaml`).
- **Keine IP:** im Proxmox-Netz ist kein DHCP, oder die Bridge ist nicht `vmbr0`. `qm set <id> --net0 virtio,bridge=<deine-bridge>`.
- **`Permission denied` bei SSH:** `99-lab.conf` nicht geladen → `sshd -T | grep -Ei 'permitrootlogin|passwordauth'` in der VM.
- **Alle Klone haben dasselbe Passwort:** Das Template wurde mit vorhandenem `/etc/vm-connect.cred` erstellt. Im Template `rm -f /etc/vm-connect.cred`, dann erneut `qm template`.
- **cloud-init läuft beim Klon nicht erneut:** nur bei **Full Clones** bekommt der Klon eine neue Instanz-ID. Linked Clones ggf. mit `cloud-init clean` vorbereiten.
