import { useAuth } from "../auth/authContext";

export function UserProfile() {
  const {
    isAuthenticated,
    user,
    profile,
    roles,
    isInTeams,
    login,
    logout,
    loading,
    error,
    realIsAdmin,
    impersonatedRole,
    setImpersonatedRole,
  } = useAuth();

  if (loading) {
    return <div className="profile-bar loading">Authenticating...</div>;
  }

  if (!isAuthenticated) {
    return (
      <div className="welcome">
        <div className="welcome-mark" aria-hidden>
          P
        </div>
        <h2>Willkommen beim Proxmox Teams Tool</h2>
        <p>
          Melde dich mit deinem Microsoft-Account an, um auf deine VMs und
          Templates zuzugreifen.
        </p>
        {error && <p className="error">{error}</p>}
        <button onClick={login} className="btn btn-primary btn-large">
          Mit Microsoft anmelden
        </button>
      </div>
    );
  }

  const displayName = profile?.displayName || user?.name || "Unknown User";
  const email =
    profile?.mail || profile?.userPrincipalName || user?.username || "";

  return (
    <div
      className="profile-bar"
      title={
        `Tenant: ${user?.tenantId ?? "N/A"} · Environment: ${
          isInTeams ? "Microsoft Teams" : "Browser (Standalone)"
        }`
      }
    >
      <div className="avatar avatar-sm">{displayName.charAt(0).toUpperCase()}</div>
      <div className="profile-bar-info">
        <strong>{displayName}</strong>
        <span className="muted">{email}</span>
      </div>
      <div className="profile-bar-roles">
        {roles.length === 0 ? (
          <span className="badge">keine Rolle</span>
        ) : (
          roles.map((r) => (
            <span key={r} className="badge role-badge">
              {r}
            </span>
          ))
        )}
        {impersonatedRole && <span className="badge badge-impersonate">impersonating</span>}
      </div>
      {realIsAdmin && (
        <label className="impersonate-select" title="Demo: andere Rolle aufsetzen">
          View as:
          <select
            value={impersonatedRole ?? "Proxmox.Admin"}
            onChange={(e) => {
              const v = e.target.value;
              setImpersonatedRole(v === "Proxmox.Admin" ? null : (v as
                | "Proxmox.Teacher"
                | "Proxmox.Student"));
            }}
          >
            <option value="Proxmox.Admin">Admin (echt)</option>
            <option value="Proxmox.Teacher">Lehrer</option>
            <option value="Proxmox.Student">Schueler</option>
          </select>
        </label>
      )}
      <button onClick={logout} className="btn btn-sm">
        Sign out
      </button>
    </div>
  );
}
