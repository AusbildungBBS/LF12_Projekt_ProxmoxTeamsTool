import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { useRoleFlags } from "../auth/useRoleFlags";

export function Layout() {
  const { isAuthenticated, isInTeams, realIsAdmin, teamsTabRoot } = useAuth();
  const { isAdmin, isStaff } = useRoleFlags();
  const { pathname } = useLocation();

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

  // "Am Root des aktiven Teams-Tabs" — dort reicht die Teams-Tableiste, der
  // App-Header waere redundant. Der aktive Tab kommt aus getContext (teamsTabRoot),
  // NICHT aus dem Pfad: ein per Dashboard-Karte erreichtes /templates zaehlt so
  // nicht als Tab-Root (aktiver Tab ist Proxmox) -> man strandet nicht.
  const atTabRoot = isInTeams && pathname === (teamsTabRoot ?? "/");
  // Uebersicht = Rueckweg zur Standardseite: Browser immer, in Teams nur abseits
  // des aktiven Tab-Roots.
  const showOverview = !isInTeams || !atTabRoot;
  // Header nur anzeigen, wenn er ueberhaupt einen Button haette (Uebersicht ODER
  // Rollen-Nav). Sonst (leerer Header) ausblenden — inkl. Brand.
  const showHeader =
    !isInTeams || (isAuthenticated && (showOverview || navStaff));

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
                {/* Uebersicht = Rueckweg zur Standardseite. Browser immer; in
                    Teams nur abseits des aktiven Tab-Roots (sonst redundant zur
                    Teams-Tableiste). Meine VMs/Templates haben eigene Teams-Tabs
                    -> in Teams ausgeblendet. */}
                {showOverview && (
                  <NavLink to="/" end>
                    Übersicht
                  </NavLink>
                )}
                {!isInTeams && (
                  <>
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
