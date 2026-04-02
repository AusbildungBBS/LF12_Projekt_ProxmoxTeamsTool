import { useAuth } from "../auth/TeamsAuthProvider";

export function TemplatesPage() {
  const { hasRole, isAuthenticated } = useAuth();
  const isStudent = hasRole("Proxmox.Student");

  if (!isAuthenticated) {
    return <p>Bitte einloggen.</p>;
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Templates</h2>
        <p className="page-subtitle">
          {isStudent
            ? "Templates, die dir über deine Klasse(n) zugewiesen wurden."
            : "Templates, die du erstellt oder zugewiesen bekommen hast."}
        </p>
      </header>

      <div className="card empty">
        <p>
          Noch keine Templates zu zeigen. Diese Liste füllt sich, sobald die
          Bridge VM-Templates aus Proxmox liest und nach Tags filtert
          (tpl-owner, tpl-class, tpl-public).
        </p>
      </div>
    </section>
  );
}
