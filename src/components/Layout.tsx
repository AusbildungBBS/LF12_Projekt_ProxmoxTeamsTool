import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../auth/TeamsAuthProvider";

export function Layout() {
  const { isAuthenticated, hasRole } = useAuth();
  const isStaff = hasRole("Proxmox.Admin") || hasRole("Proxmox.Teacher");
  const isAdmin = hasRole("Proxmox.Admin");

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-inner">
          <div className="app-brand">
            <div className="app-brand-mark" aria-hidden>P</div>
            <h1 className="app-title">
              Proxmox <span className="app-title-accent">Teams Tool</span>
            </h1>
          </div>
          {isAuthenticated && (
            <nav className="app-nav">
              <NavLink to="/" end>Übersicht</NavLink>
              <NavLink to="/my-vms">Meine VMs</NavLink>
              <NavLink to="/templates">Templates</NavLink>
              {isStaff && <NavLink to="/classes">Klassen</NavLink>}
              {isAdmin && <NavLink to="/admin">Admin</NavLink>}
            </nav>
          )}
        </div>
      </header>

      <main className="app-main">
        <Outlet />
      </main>
    </div>
  );
}
