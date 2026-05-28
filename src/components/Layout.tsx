import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { useRoleFlags } from "../auth/useRoleFlags";
import { ErrorCard } from "./ErrorCard";

// Label des Rückweg-Links zum jeweiligen Teams-Tab-Root (Pfad -> Anzeigename).
const TEAMS_TAB_LABELS: Record<string, string> = {
  "/": "Übersicht",
  "/templates": "Vorlagen",
  "/my-vms": "Meine VMs",
};

export function Layout() {
  const { isAuthenticated, isInTeams, teamsTabRoot, error } = useAuth();
  const { isAdmin, isStaff } = useRoleFlags();
  const { pathname } = useLocation();

  // Rollenspezifische Nav-Einträge (Klassen/Admin) richten sich nach der
  // EFFEKTIVEN Rolle — eine per Rollenwechsel emulierte Rolle färbt also AUCH die
  // Nav, auf BEIDEN Plattformen gleich: Admin emuliert Schüler -> Klassen/Admin
  // verschwinden, genau wie beim echten Schüler. Zurück kommt der Admin über den
  // Rollen-Switcher in der Profilleiste — der bleibt sichtbar, weil er an der
  // ECHTEN Adminrolle hängt (siehe UserProfile / realIsAdmin).
  //
  // In Teams kommen Übersicht/Vorlagen/Meine VMs über die statischen
  // Teams-Tabs — die blenden wir aus der App-Nav aus (s.u.) und zeigen nur Ziele
  // OHNE Tab (Klassen/Admin).
  const navStaff = isStaff;
  const navAdmin = isAdmin;

  // Root-Route + Label des AKTIVEN Teams-Tabs. Der aktive Tab kommt aus
  // getContext (teamsTabRoot), NICHT aus dem Pfad: ein per Dashboard-Karte
  // erreichtes /templates zählt so nicht als Tab-Root (aktiver Tab ist Proxmox)
  // -> man strandet nicht.
  const tabRoot = teamsTabRoot ?? "/";
  const tabLabel = TEAMS_TAB_LABELS[tabRoot] ?? "Übersicht";
  const atTabRoot = isInTeams && pathname === tabRoot;
  // In Teams: Rückweg-Link zum Root des AKTIVEN Tabs (z.B. "Vorlagen"), sobald
  // man nicht dort ist — NICHT stur "Übersicht"/Dashboard. Im Browser zeigt die
  // volle Nav ohnehin alle Ziele.
  const showReturnLink = isInTeams && !atTabRoot;
  // Header nur anzeigen, wenn er überhaupt einen Button hätte (Rückweg ODER
  // Rollen-Nav). Sonst (leerer Header) ausblenden — inkl. Brand.
  const showHeader =
    !isInTeams || (isAuthenticated && (showReturnLink || navStaff));

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
                {/* In Teams: EIN Rückweg-Link zum Root des aktiven Tabs (mit
                    dessen Label), sichtbar sobald man nicht dort ist. Im Browser
                    die volle Nav — in Teams haben Übersicht/Meine VMs/Vorlagen
                    eigene Teams-Tabs. */}
                {isInTeams ? (
                  showReturnLink && (
                    <NavLink to={tabRoot} end={tabRoot === "/"}>
                      {tabLabel}
                    </NavLink>
                  )
                ) : (
                  <>
                    <NavLink to="/" end>Übersicht</NavLink>
                    <NavLink to="/my-vms">Meine VMs</NavLink>
                    <NavLink to="/templates">Vorlagen</NavLink>
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
        {/* Auth-/Bridge-Fehler global (auf JEDER Seite) anzeigen — nicht nur auf
            dem Dashboard. Greift im angemeldeten Zustand (dort entstehen
            Bridge-/Berechtigungsfehler); Login-Fehler zeigt der Willkommens-
            Screen. Meldungen sind bereits fertig formuliert -> prefix="". */}
        {isAuthenticated && <ErrorCard message={error} prefix="" />}
        <Outlet />
      </main>
    </div>
  );
}
