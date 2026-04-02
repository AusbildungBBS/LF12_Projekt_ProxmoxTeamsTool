import { useAuth } from "../auth/TeamsAuthProvider";

export function AdminPage() {
  const { hasRole, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return <p>Bitte einloggen.</p>;
  }
  if (!hasRole("Proxmox.Admin")) {
    return (
      <section className="page">
        <p>Diese Seite ist nur für Admins.</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Admin Console</h2>
        <p className="page-subtitle">Globale Sicht über alle VMs, Templates und Klassen.</p>
      </header>

      <div className="card empty">
        <p>Noch leer. Hier kommt die globale Verwaltung hin.</p>
      </div>
    </section>
  );
}
