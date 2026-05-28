import { useAuth } from "../auth/authContext";
import { ROLES, type ImpersonatedRole } from "../auth/roles";

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
        <img src="/logo.svg" alt="Proxmox Teams Tool" className="welcome-mark" />
        <h2>Willkommen beim Proxmox Teams Tool</h2>
        {isInTeams ? (
          // In Teams uebernimmt Teams-SSO den Login (kein MSAL-Redirect-Button,
          // der im iFrame ohnehin scheitern wuerde). Dieser Zweig greift nur,
          // wenn das stille SSO (noch) kein Token geliefert hat.
          <p>Anmeldung über Microsoft Teams …</p>
        ) : (
          <p>
            Melde dich mit deinem Microsoft-Account an, um auf deine VMs und
            Templates zuzugreifen.
          </p>
        )}
        {error && <p className="error">{error}</p>}
        {!isInTeams && (
          <button onClick={login} className="btn btn-primary btn-large">
            Mit Microsoft anmelden
          </button>
        )}
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
            value={impersonatedRole ?? ROLES.ADMIN}
            onChange={(e) => {
              const v = e.target.value;
              setImpersonatedRole(v === ROLES.ADMIN ? null : (v as ImpersonatedRole));
            }}
          >
            <option value={ROLES.ADMIN}>Admin (echt)</option>
            <option value={ROLES.TEACHER}>Lehrer</option>
            <option value={ROLES.STUDENT}>Schueler</option>
          </select>
        </label>
      )}
      {!isInTeams && (
        // In Teams kommt Logout/Identitaet aus dem Teams-Client selbst.
        <button onClick={logout} className="btn btn-sm">
          Sign out
        </button>
      )}
    </div>
  );
}
