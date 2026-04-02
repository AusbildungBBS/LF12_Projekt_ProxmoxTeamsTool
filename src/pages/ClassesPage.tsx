import { useAuth } from "../auth/TeamsAuthProvider";

export function ClassesPage() {
  const { hasRole, isAuthenticated } = useAuth();
  const isStaff = hasRole("Proxmox.Admin") || hasRole("Proxmox.Teacher");

  if (!isAuthenticated) {
    return <p>Bitte einloggen.</p>;
  }

  if (!isStaff) {
    return (
      <section className="page">
        <p>Diese Seite ist nur für Lehrer und Admins.</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Klassen</h2>
        <p className="page-subtitle">
          Klassen entsprechen M365-Gruppen. Pflege findet im Tenant statt;
          hier siehst du nur, in welchen Gruppen du Mitglied bist.
        </p>
      </header>

      <div className="card empty">
        <p>
          Hier landet später die Liste der Klassen-Groups, in denen du
          Mitglied bist — gelesen aus dem groups-Claim des Tokens (Fallback
          Microsoft Graph).
        </p>
      </div>
    </section>
  );
}
