import { useAuth } from "../auth/TeamsAuthProvider";

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
  } = useAuth();

  if (loading) {
    return (
      <div className="profile-card loading">
        <p>Authenticating...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="welcome">
        <div className="welcome-mark" aria-hidden>P</div>
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
  const email = profile?.mail || profile?.userPrincipalName || user?.username || "";

  return (
    <div className="profile-card">
      <div className="profile-header">
        <div className="avatar">{displayName.charAt(0).toUpperCase()}</div>
        <div className="profile-info">
          <h2>{displayName}</h2>
          <p className="email">{email}</p>
          {isInTeams && <span className="badge">Running in Teams</span>}
        </div>
      </div>

      <div className="profile-details">
        {profile?.jobTitle && (
          <div className="detail-row">
            <span className="label">Job Title:</span>
            <span className="value">{profile.jobTitle}</span>
          </div>
        )}
        {profile?.officeLocation && (
          <div className="detail-row">
            <span className="label">Office:</span>
            <span className="value">{profile.officeLocation}</span>
          </div>
        )}
        <div className="detail-row">
          <span className="label">Tenant ID:</span>
          <span className="value">{user?.tenantId || "N/A"}</span>
        </div>
        <div className="detail-row">
          <span className="label">Environment:</span>
          <span className="value">
            {isInTeams ? "Microsoft Teams" : "Browser (Standalone)"}
          </span>
        </div>
        <div className="detail-row">
          <span className="label">Roles:</span>
          <span className="value">
            {roles.length === 0 ? (
              <em>none assigned</em>
            ) : (
              roles.map((r) => (
                <span key={r} className="badge role-badge">
                  {r}
                </span>
              ))
            )}
          </span>
        </div>
      </div>

      <button onClick={logout} className="btn btn-secondary">
        Sign out
      </button>
    </div>
  );
}
