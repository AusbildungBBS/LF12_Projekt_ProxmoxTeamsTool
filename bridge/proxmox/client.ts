import type { CloneOptions, Task, TaskRef, VM, VMConfig, VMID } from "./types";

// Low-level Proxmox API surface the Bridge needs.
//
// Implementations:
//   - RealProxmoxClient — talks to a Proxmox host via HTTP + API token.
//                         To be added once a Proxmox instance is reachable.
//
// Authorization is *not* this layer's concern. Role/ownership/class checks
// live in the Bridge endpoint handlers; this client just talks to Proxmox.
export interface ProxmoxClient {
  // ── Discovery ──────────────────────────────────────────────────────────
  listNodes(): Promise<string[]>;

  // ── VMs ────────────────────────────────────────────────────────────────
  // Optionally filter by required tag(s). Implementations may delegate
  // filtering to Proxmox or filter client-side — callers shouldn't care.
  listVMs(opts?: { node?: string; requireTags?: string[] }): Promise<VM[]>;
  getVM(node: string, vmid: VMID): Promise<VM>;

  // Clone a template into a new VM. Returns the task that performs the
  // clone — the new VM only exists once the task succeeds.
  cloneFromTemplate(
    node: string,
    templateVmid: VMID,
    opts: CloneOptions
  ): Promise<TaskRef>;

  startVM(node: string, vmid: VMID): Promise<TaskRef>;
  stopVM(node: string, vmid: VMID): Promise<TaskRef>;
  deleteVM(node: string, vmid: VMID): Promise<TaskRef>;

  // ── Config / tags ──────────────────────────────────────────────────────
  // Updates a subset of the VM config. Tags are read-modify-write on the
  // Proxmox side — implementations must take care not to clobber tags they
  // weren't asked to change.
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
