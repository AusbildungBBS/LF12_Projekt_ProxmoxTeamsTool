import { useEffect, useState } from "react";
import { useAuth } from "../auth/TeamsAuthProvider";
import { useBridgeApi, type ClassInfo } from "../api/bridge";

export function ClassesPage() {
  const { hasRole, isAuthenticated, accessToken } = useAuth();
  const api = useBridgeApi();
  const isStaff = hasRole("Proxmox.Admin") || hasRole("Proxmox.Teacher");

  const [classes, setClasses] = useState<ClassInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setError(null);
    api.listClasses().then(setClasses).catch((e) =>
      setError(e instanceof Error ? e.message : String(e))
    );
  }, [accessToken, api]);

  if (!isAuthenticated) return <p>Bitte einloggen.</p>;
  if (!isStaff) {
    return (
      <section className="page">
        <p>Diese Seite ist nur fuer Lehrer und Admins.</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Klassen</h2>
        <p className="page-subtitle">
          Klassen sind M365-Gruppen, fuer die in Proxmox mindestens ein
          Template mit <code>tpl-class-&lt;oid&gt;</code> getagged ist.
        </p>
      </header>

      {error && <div className="card error">Fehler: {error}</div>}
      {classes === null && <div className="card">Lade Klassen ...</div>}

      {classes && classes.length === 0 && (
        <div className="card empty">
          <p>
            Du bist (noch) in keiner aktiven Klasse fuer dieses Tool. Das
            heisst entweder: keine deiner M365-Gruppen ist in Proxmox als
            Klasse markiert, oder du bist in keiner relevanten Gruppe.
          </p>
        </div>
      )}

      {classes && classes.length > 0 && (
        <ul className="card-list">
          {classes.map((c) => (
            <li key={c.oid} className="card">
              <div className="card-row">
                <strong>{c.displayName ?? "(unbekannt)"}</strong>
                {c.visibility && <span className="badge">{c.visibility}</span>}
              </div>
              <div className="card-meta">
                <span>OID {c.oid}</span>
              </div>
              {c.description && <p className="card-desc">{c.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
