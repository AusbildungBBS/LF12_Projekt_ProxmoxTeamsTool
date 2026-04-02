import { Link } from "react-router-dom";
import { useAuth } from "../auth/TeamsAuthProvider";
import { UserProfile } from "../components/UserProfile";

export function HomePage() {
  const { isAuthenticated, hasRole, roles } = useAuth();
  const isAdmin = hasRole("Proxmox.Admin");
  const isTeacher = hasRole("Proxmox.Teacher");
  const isStudent = hasRole("Proxmox.Student");
  const hasAnyRole = roles.length > 0;

  return (
    <>
      <UserProfile />

      {isAuthenticated && !hasAnyRole && (
        <div className="card warning">
          <h3>Keine Rolle zugewiesen</h3>
          <p>
            Du bist eingeloggt, hast aber noch keine Rolle. Ein Admin muss
            dir eine Rolle zuweisen (Proxmox.Student, Proxmox.Teacher oder
            Proxmox.Admin).
          </p>
        </div>
      )}

      {isStudent && (
        <Link to="/my-vms" className="card card-link">
          <h3>Meine VMs</h3>
          <p>Aus zugewiesenen Templates VMs erstellen, starten, stoppen, löschen oder neu erzeugen.</p>
        </Link>
      )}

      {(isAdmin || isTeacher) && (
        <Link to="/my-vms" className="card card-link">
          <h3>VMs deiner Klassen</h3>
          <p>Schüler-VMs einsehen und verwalten — erstellen, starten, stoppen, löschen.</p>
        </Link>
      )}

      {(isAdmin || isTeacher) && (
        <Link to="/templates" className="card card-link">
          <h3>Templates</h3>
          <p>Eigene Templates erstellen, öffentlich machen oder Klassen zuweisen.</p>
        </Link>
      )}

      {(isAdmin || isTeacher) && (
        <Link to="/classes" className="card card-link">
          <h3>Klassen</h3>
          <p>Welche Klassen du betreust und wer drin ist.</p>
        </Link>
      )}

      {isAdmin && (
        <Link to="/admin" className="card card-link">
          <h3>Admin Console</h3>
          <p>Volle Kontrolle: User, Klassen, alle Templates und VMs.</p>
        </Link>
      )}
    </>
  );
}
