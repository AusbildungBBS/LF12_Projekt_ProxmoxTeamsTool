// Einheitliches Status-Badge — rendert <span class="badge badge-<status>">.
export function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    running: "läuft",
    stopped: "gestoppt",
    paused: "pausiert",
    unknown: "unbekannt",
    connecting: "verbindet",
    connected: "verbunden",
    disconnected: "getrennt",
    error: "Fehler",
  };

  return <span className={`badge badge-${status}`}>{labels[status] ?? status}</span>;
}
