import type { VmDTO } from "../api/bridge";
import { bytesToMb } from "../lib/format";

// Live-Auslastung einer laufenden VM (CPU/RAM). Bevorzugt den 5-min-Average aus
// dem Proxmox-RRD, fällt auf den aktuellen Wert zurück. Rendert nichts, wenn
// die VM nicht läuft.
export function VmStatsPill({ vm }: { vm: VmDTO }) {
  if (vm.status !== "running") return null;
  const cpu = vm.cpuAvg5m ?? vm.cpu ?? 0;
  const mem = vm.memAvg5m ?? vm.mem ?? 0;
  const cpuPct = Math.round(cpu * 100);
  const memUsedMb = bytesToMb(mem);
  const memMaxMb = bytesToMb(vm.maxmem);
  const memPct = memMaxMb > 0 ? Math.round((memUsedMb / memMaxMb) * 100) : 0;
  const cpuTone = cpuPct > 85 ? "hot" : cpuPct > 60 ? "warm" : "";
  const memTone = memPct > 85 ? "hot" : memPct > 60 ? "warm" : "";
  const tooltip =
    vm.cpuAvg5m !== undefined
      ? "Durchschnitt letzte 5 min (Proxmox-RRD)"
      : "aktueller Wert (kein 5-min-Sample verfügbar)";
  return (
    <span className="stats-pill" title={tooltip}>
      <span className={`pill-chip ${cpuTone}`}>CPU {cpuPct}% Ø5m</span>
      <span className={`pill-chip ${memTone}`}>
        RAM {memUsedMb}/{memMaxMb} MB Ø5m
      </span>
    </span>
  );
}
