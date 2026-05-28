import type { VmDTO } from "../api/bridge";

// Aktionen, deren Wirkung auf Proxmox asynchron eintritt (Task). Pro VM gemerkt,
// zeigt die UI eine Übergangs-Pill und pollt eifrig, bis der Zielzustand da ist.
export type TransitionAction = "start" | "shutdown" | "stop" | "delete";

export const TRANSITION_LABEL: Record<TransitionAction, string> = {
  start: "startet …",
  shutdown: "fährt herunter …",
  stop: "wird gestoppt …",
  delete: "wird gelöscht …",
};

// Ist der Zielzustand der Aktion erreicht? (delete: VM verschwunden)
export function transitionDone(
  action: TransitionAction,
  vm: VmDTO | undefined
): boolean {
  if (action === "delete") return !vm;
  if (!vm) return false;
  if (action === "start") return vm.status === "running";
  return vm.status === "stopped"; // shutdown | stop
}

// Entfernt erledigte Übergänge aus der Map (gegen die aktuelle VM-Liste).
// Gibt dieselbe Referenz zurück, wenn sich nichts ändert (kein Re-Render).
export function pruneTransitions(
  prev: Map<number, TransitionAction>,
  vms: VmDTO[]
): Map<number, TransitionAction> {
  if (prev.size === 0) return prev;
  const byId = new Map(vms.map((v) => [v.vmid, v]));
  const next = new Map(prev);
  for (const [id, action] of prev) {
    if (transitionDone(action, byId.get(id))) next.delete(id);
  }
  return next.size === prev.size ? prev : next;
}
