import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { useRoleFlags } from "../auth/useRoleFlags";

export function Layout() {
  const { isAuthenticated, isInTeams, realIsAdmin } = useAuth();
  const { isAdmin, isStaff } = useRoleFlags();

  // In Teams navigiert man ueber die statischen Teams-Tabs (Proxmox/Templates/
  // Meine VMs) — diese Eintraege blenden wir aus der App-Nav aus und zeigen nur
  // Ziele OHNE Tab (Klassen/Admin). Hat die Rolle keinen solchen Eintrag, gibt
  // es nichts zu navigieren: dann blenden wir den ganzen Header inkl. Brand aus
  // (Titel + Identitaet liefert Teams selbst).
  //
  // WICHTIG: In Teams richten sich Header UND diese Nav-Eintraege nach der
  // ECHTEN Rolle (realIsAdmin), nicht nach einer per "View as" emulierten.
  // Sonst verloere ein Admin, der einen Schueler emuliert, in Teams seinen
  // Header + Navigation + den Zugang zum Rollen-Switcher. Emulation faerbt nur
  // Daten/Content, nicht das Admin-Chrome. (Nur Admins koennen emulieren, daher
  // deckt realIsAdmin den Fall ab.) Im Browser bleibt die effektive Rolle.
  const navStaff = isInTeams ? isStaff || realIsAdmin : isStaff;
  const navAdmin = isInTeams ? realIsAdmin : isAdmin;
  const showHeader = !isInTeams || (isAuthenticated && navStaff);

  return (
    <div className="app">
      {showHeader && (
        <header className="app-header">
          <div className="app-header-inner">
            <div className="app-brand">
              <img src="/logo.svg" alt="" aria-hidden className="app-brand-mark" />
              <h1 className="app-title">
                Proxmox <span className="app-title-accent">Teams Tool</span>
              </h1>
            </div>
            {isAuthenticated && (
              <nav className="app-nav">
                {!isInTeams && (
                  <>
                    <NavLink to="/" end>Übersicht</NavLink>
                    <NavLink to="/my-vms">Meine VMs</NavLink>
                    <NavLink to="/templates">Templates</NavLink>
                  </>
                )}
                {navStaff && <NavLink to="/classes">Klassen</NavLink>}
                {navAdmin && <NavLink to="/admin">Admin</NavLink>}
              </nav>
            )}
          </div>
        </header>
      )}

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
