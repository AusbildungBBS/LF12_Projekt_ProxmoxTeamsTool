// Domänentypen für die Kommunikation mit Proxmox VE.
//
// Tags sind auf der Proxmox-Seite einfache, kommagetrennte Strings. Wir bilden sie
// hier als string[] ab und die Client-Implementierung übernimmt das join/split.

export type VMID = number;

export interface VMRef {
  node: string;
  vmid: VMID;
}

export type VMStatus = "running" | "stopped" | "paused" | "unknown";

export interface VM extends VMRef {
  name: string;
  status: VMStatus;
  template: boolean;
  tags: string[];
  cpus?: number;
  maxmem?: number;
  // Live-Stats aus cluster/resources — nur für running VMs sinnvoll.
  cpu?: number;       // Auslastung 0..1 (1.0 == alle vCPUs voll)
  mem?: number;       // belegter Arbeitsspeicher in Bytes
  uptime?: number;    // Sekunden seit Start
  disk?: number;      // belegte Disk
  maxdisk?: number;
  diskread?: number;
  diskwrite?: number;
  netin?: number;
  netout?: number;
}

export interface VMConfig {
  name?: string;
  tags?: string[];
  cores?: number;
  memory?: number;
}

export interface CloneOptions {
  newid: VMID;
  name: string;
  target?: string;
  full?: boolean;
}

// Proxmox-Task-Bezeichner (UPID). Asynchrone Operationen geben einen solchen zurück;
// der Aufrufer kann getTask() abfragen, um zu erfahren, wann die Operation fertig ist.
export interface TaskRef {
  node: string;
  upid: string;
}

export type TaskStatus = "running" | "stopped";

export interface Task {
  node: string;
  upid: string;
  status: TaskStatus;
  exitstatus?: string;
}
