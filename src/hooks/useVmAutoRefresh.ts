import { useEffect } from "react";
import type { VmDTO } from "../api/bridge";

export const REFRESH_INTERVAL_MS = 5000;

// Pollt `refresh` alle intervalMs, solange mindestens eine VM läuft — sonst
// nicht. `vms` darf null/undefined sein (wird als leer behandelt).
export function useVmAutoRefresh(
  vms: VmDTO[] | null | undefined,
  refresh: () => void,
  intervalMs: number = REFRESH_INTERVAL_MS
): void {
  useEffect(() => {
    const anyRunning = (vms ?? []).some((v) => v.status === "running");
    if (!anyRunning) return;
    const id = setInterval(refresh, intervalMs);
    return () => clearInterval(id);
  }, [vms, refresh, intervalMs]);
}
