import type { CloneOptions, Task, TaskRef, VM, VMConfig, VMID } from "./types.js";

// Low-Level-Proxmox-API-Oberfläche, die die Bridge benötigt.
//
// Implementierungen:
//   - RealProxmoxClient — kommuniziert mit einem Proxmox-Host via HTTP + API-Token.
//                         Wird ergänzt, sobald eine Proxmox-Instanz erreichbar ist.
//
// Autorisierung ist *nicht* die Aufgabe dieser Schicht. Prüfungen von Role/Ownership/Class
// liegen in den Bridge-Endpoint-Handlern; dieser Client kommuniziert nur mit Proxmox.
export interface ProxmoxClient {
  // ── Discovery ──────────────────────────────────────────────────────────
  listNodes(): Promise<string[]>;

  // ── VMs ────────────────────────────────────────────────────────────────
  // Optional nach erforderlichen Tag(s) filtern. Implementierungen können das
  // Filtern an Proxmox delegieren oder client-seitig filtern — Aufrufer sollte das egal sein.
  listVMs(opts?: { node?: string; requireTags?: string[] }): Promise<VM[]>;
  getVM(node: string, vmid: VMID): Promise<VM>;

  // Klont ein Template in eine neue VM. Gibt den Task zurück, der den
  // Klon durchführt — die neue VM existiert erst, wenn der Task erfolgreich ist.
  cloneFromTemplate(
    node: string,
    templateVmid: VMID,
    opts: CloneOptions
  ): Promise<TaskRef>;

  startVM(node: string, vmid: VMID): Promise<TaskRef>;
  // Graceful — benötigt qemu-guest-agent in der VM.
  shutdownVM(node: string, vmid: VMID): Promise<TaskRef>;
  // Force — zieht den Stecker, brauch keinen Agent.
  stopVM(node: string, vmid: VMID): Promise<TaskRef>;
  deleteVM(node: string, vmid: VMID): Promise<TaskRef>;

  // Disk anhängen. `storage` = Proxmox-Storage-Name (z.B. "local-lvm"),
  // `sizeGb` = Größe in Gigabyte, `slot` = Bus + Index (default "scsi0").
  // Funktioniert nur an non-Templates (Proxmox erlaubt keine config-Changes
  // an Templates).
  attachDisk(
    node: string,
    vmid: VMID,
    opts: { storage: string; sizeGb: number; slot?: string }
  ): Promise<void>;

  // ── Config / tags ──────────────────────────────────────────────────────
  // Aktualisiert einen Teil der VM-Config. Tags sind auf der Proxmox-Seite
  // read-modify-write — Implementierungen müssen darauf achten, keine Tags zu
  // überschreiben, deren Änderung nicht angefordert wurde.
  updateConfig(node: string, vmid: VMID, patch: VMConfig): Promise<void>;

  // ── Tasks ──────────────────────────────────────────────────────────────
  getTask(ref: TaskRef): Promise<Task>;
}

export class ProxmoxNotConfiguredError extends Error {
  constructor() {
    super(
      "Proxmox client not configured. Set PROXMOX_URL / PROXMOX_TOKEN_ID / PROXMOX_TOKEN_SECRET."
    );
    this.name = "ProxmoxNotConfiguredError";
  }
}
