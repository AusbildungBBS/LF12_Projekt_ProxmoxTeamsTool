import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { useRoleFlags } from "../auth/useRoleFlags";
import { ErrorCard } from "./ErrorCard";

// Label des Rueckweg-Links zum jeweiligen Teams-Tab-Root (Pfad -> Anzeigename).
const TEAMS_TAB_LABELS: Record<string, string> = {
  "/": "Übersicht",
  "/templates": "Templates",
  "/my-vms": "Meine VMs",
};

export function Layout() {
  const { isAuthenticated, isInTeams, realIsAdmin, teamsTabRoot, error } =
    useAuth();
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

  // Root-Route + Label des AKTIVEN Teams-Tabs. Der aktive Tab kommt aus
  // getContext (teamsTabRoot), NICHT aus dem Pfad: ein per Dashboard-Karte
  // erreichtes /templates zaehlt so nicht als Tab-Root (aktiver Tab ist Proxmox)
  // -> man strandet nicht.
  const tabRoot = teamsTabRoot ?? "/";
  const tabLabel = TEAMS_TAB_LABELS[tabRoot] ?? "Übersicht";
  const atTabRoot = isInTeams && pathname === tabRoot;
  // In Teams: Rueckweg-Link zum Root des AKTIVEN Tabs (z.B. "Templates"), sobald
  // man nicht dort ist — NICHT stur "Übersicht"/Dashboard. Im Browser zeigt die
  // volle Nav ohnehin alle Ziele.
  const showReturnLink = isInTeams && !atTabRoot;
  // Header nur anzeigen, wenn er ueberhaupt einen Button haette (Rueckweg ODER
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
                {/* In Teams: EIN Rueckweg-Link zum Root des aktiven Tabs (mit
                    dessen Label), sichtbar sobald man nicht dort ist. Im Browser
                    die volle Nav — in Teams haben Uebersicht/Meine VMs/Templates
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
