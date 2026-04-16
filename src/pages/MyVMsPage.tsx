import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/TeamsAuthProvider";
import { useBridgeApi, type VmDTO } from "../api/bridge";

export function MyVMsPage() {
  const { hasRole, isAuthenticated, accessToken } = useAuth();
  const api = useBridgeApi();
  const isStudent = hasRole("Proxmox.Student");

  const [vms, setVms] = useState<VmDTO[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      setVms(await api.listVms());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  useEffect(() => {
    if (!accessToken) return;
    refresh();
  }, [accessToken, refresh]);

  if (!isAuthenticated) return <p>Bitte einloggen.</p>;

  async function run(
    vm: VmDTO,
    action: "start" | "stop" | "delete"
  ) {
    if (action === "delete" && !confirm(`VM "${vm.name}" wirklich loeschen?`)) return;
    setBusyId(vm.vmid);
    setError(null);
    try {
      if (action === "start") await api.startVm(vm.vmid);
      else if (action === "stop") await api.stopVm(vm.vmid);
      else await api.deleteVm(vm.vmid);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>{isStudent ? "Meine VMs" : "VMs deiner Klassen"}</h2>
        <p className="page-subtitle">
          {isStudent
            ? "Deine eigenen VMs, eine pro zugewiesenem Template."
            : "Schueler-VMs aus den Klassen, die du betreust."}
        </p>
      </header>

      {error && <div className="card error">Fehler: {error}</div>}
      {vms === null && <div className="card">Lade VMs ...</div>}

      {vms && vms.length === 0 && (
        <div className="card empty">
          <p>
            Aktuell keine VMs in deinem Sichtbereich. {isStudent
              ? "Klick auf der Templates-Seite auf \"VM aus diesem Template anlegen\"."
              : "Schueler in deinen Klassen haben noch keine VMs erstellt."}
          </p>
        </div>
      )}

      {vms && vms.length > 0 && (
        <ul className="card-list">
          {vms.map((v) => (
            <li key={v.vmid} className="card">
              <div className="card-row">
                <strong>{v.name}</strong>
                <span className="badge">VMID {v.vmid}</span>
                <span className={`badge badge-${v.status}`}>{v.status}</span>
              </div>
              <div className="card-meta">
                {v.sourceTemplateVmid && (
                  <span>aus Template {v.sourceTemplateVmid}</span>
                )}
                <span>{v.cpus ?? "?"} CPU</span>
                <span>{v.maxmem ? Math.round(v.maxmem / 1024 / 1024) + " MB" : "? MB"}</span>
                <span>Node {v.node}</span>
              </div>
              <div className="card-actions">
                <button
                  disabled={busyId === v.vmid || v.status === "running"}
                  onClick={() => run(v, "start")}
                >
                  Start
                </button>
                <button
                  disabled={busyId === v.vmid || v.status === "stopped"}
                  onClick={() => run(v, "stop")}
                >
                  Stop
                </button>
                <button
                  className="danger"
                  disabled={busyId === v.vmid}
                  onClick={() => run(v, "delete")}
                >
                  Loeschen
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
