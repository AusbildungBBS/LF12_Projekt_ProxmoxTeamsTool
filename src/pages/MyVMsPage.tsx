import { useAuth } from "../auth/TeamsAuthProvider";

export function MyVMsPage() {
  const { hasRole, isAuthenticated } = useAuth();
  const isStudent = hasRole("Proxmox.Student");

  if (!isAuthenticated) {
    return <p>Bitte einloggen.</p>;
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>{isStudent ? "Meine VMs" : "VMs deiner Klassen"}</h2>
        <p className="page-subtitle">
          {isStudent
            ? "Deine eigenen VMs, eine pro zugewiesenem Template."
            : "Schüler-VMs aus den Klassen, die du betreust."}
        </p>
      </header>

      <div className="card empty">
        <p>
          Noch keine VMs zu zeigen — die Bridge ist noch nicht mit einer
          Proxmox-Instanz verbunden. Sobald der ProxmoxClient implementiert
          ist und die Bridge mit einem PROXMOX_URL läuft, erscheinen hier
          die VMs aus der Proxmox-API (gefiltert nach Owner / Klasse).
        </p>
      </div>
    </section>
  );
}
