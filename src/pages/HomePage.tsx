import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { useRoleFlags } from "../auth/useRoleFlags";
import { UserProfile } from "../components/UserProfile";
import {
  useBridgeApi,
  type ClassInfo,
  type Template,
  type VmDTO,
} from "../api/bridge";
import { VmStatsPill } from "../components/VmStatsPill";
import { StatusBadge } from "../components/StatusBadge";
import { ErrorCard } from "../components/ErrorCard";
import { useVmAutoRefresh } from "../hooks/useVmAutoRefresh";
import { errMsg } from "../lib/errors";
import { shortOid } from "../lib/format";

export function HomePage() {
  const { isAuthenticated, roles, accessToken, identity, impersonatedRole, error: authError } = useAuth();
  const { isAdmin, isTeacher, isStudent } = useRoleFlags();
  const api = useBridgeApi();
  const hasAnyRole = roles.length > 0;

  const [classes, setClasses] = useState<ClassInfo[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [vms, setVms] = useState<VmDTO[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!hasAnyRole) return;
    try {
      const wantsClasses = isAdmin || isTeacher || isStudent;
      const [c, t, v] = await Promise.all([
        wantsClasses ? api.listClasses() : Promise.resolve([]),
        api.listTemplates().catch(() => []),
        api.listVms().catch(() => []),
      ]);
      setClasses(c);
      setTemplates(t);
      setVms(v);
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [api, hasAnyRole, isAdmin, isTeacher, isStudent]);

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      await refresh();
    })();
  }, [accessToken, refresh]);

  // Beim Wechsel der impersonierten Rolle: alte Daten sofort verwerfen,
  // damit die UI nicht 1-2 Sekunden lang stale Admin-Daten zeigt, bevor
  // der refresh() durch ist. classes auf null triggert den "Lade ..."-
  // Empty-State. Wir erkennen den Wechsel beim Render (mit Vorwert-Guard)
  // statt im Effect, um den Cascading-Render / setState-in-effect zu vermeiden.
  const [lastImpersonatedRole, setLastImpersonatedRole] =
    useState(impersonatedRole);
  if (impersonatedRole !== lastImpersonatedRole) {
    setLastImpersonatedRole(impersonatedRole);
    setClasses(null);
    setTemplates([]);
    setVms([]);
  }

  useVmAutoRefresh(vms, refresh);

  const ownedTemplates = identity
    ? templates.filter((t) => t.ownerOid === identity.oid)
    : [];

  return (
    <>
      <UserProfile />

      <ErrorCard message={authError} prefix="" />

      {isAuthenticated && !hasAnyRole && !authError && (
        <div className="card warning">
          <h3>Keine Rolle zugewiesen</h3>
          <p>
            Du bist eingeloggt, hast aber noch keine Rolle. Ein Admin muss dir
            eine Rolle zuweisen (Proxmox.Student, Proxmox.Teacher oder
            Proxmox.Admin).
          </p>
        </div>
      )}

      <ErrorCard message={error} />

      {/* Admin: 3-Spalten-Overview wie /admin */}
      {isAdmin && (
        <div className="admin-grid">
          <div className="card">
            <h3>
              Templates ({templates.length}){" "}
              <Link to="/templates" className="card-section-link">
                verwalten →
              </Link>
            </h3>
            <ul>
              {templates.map((t) => (
                <li key={t.vmid}>
                  <Link to={`/templates#template-${t.vmid}`}>
                    <strong>{t.name}</strong>
                  </Link>{" "}
                  <span className="muted">(VMID {t.vmid})</span>
                  {t.isPublic && (
                    <span className="badge badge-public">public</span>
                  )}
                  <br />
                  <small className="muted">
                    {t.classes.length} Klasse(n) · Owner{" "}
                    {shortOid(t.ownerOid)}
                  </small>
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3>
              VMs ({vms.length}){" "}
              <Link to="/my-vms" className="card-section-link">
                verwalten →
              </Link>
            </h3>
            <ul>
              {vms.map((v) => (
                <li key={v.vmid}>
                  <Link to={`/my-vms#vm-${v.vmid}`}>
                    <strong>{v.name}</strong>
                  </Link>{" "}
                  <StatusBadge status={v.status} />
                  {v.status === "running" && (
                    <Link
                      to={`/vms/${v.vmid}/console`}
                      title="Console"
                      className="inline-icon-link"
                    >
                      🖥
                    </Link>
                  )}
                  <br />
                  <VmStatsPill vm={v} />
                </li>
              ))}
            </ul>
          </div>

          <div className="card">
            <h3>
              Aktive Klassen ({classes?.length ?? "—"}){" "}
              <Link to="/classes" className="card-section-link">
                verwalten →
              </Link>
            </h3>
            <ul>
              {classes?.map((c) => (
                <li key={c.oid}>
                  <strong>{c.displayName ?? "(unbekannt)"}</strong>
                  <br />
                  <small className="muted">{c.oid}</small>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Lehrer: Klassen + eigene Templates */}
      {isTeacher && !isAdmin && (
        <>
          <Link to="/classes" className="card card-link">
            <h3>Klassen ({classes?.length ?? "—"})</h3>
            {classes && classes.length > 0 ? (
              <ul className="home-inline">
                {classes.map((c) => (
                  <li key={c.oid}>{c.displayName ?? c.oid}</li>
                ))}
              </ul>
            ) : (
              <p>Noch keine aktiven Klassen — weise einem deiner Templates eine Klasse zu.</p>
            )}
          </Link>

          <Link to="/templates" className="card card-link">
            <h3>Deine Templates ({ownedTemplates.length})</h3>
            {ownedTemplates.length > 0 ? (
              <ul className="home-inline">
                {ownedTemplates.map((t) => (
                  <li key={t.vmid}>
                    {t.name}
                    {t.isPublic && (
                      <span className="badge badge-public">public</span>
                    )}{" "}
                    <span className="muted">· {t.classes.length} Klasse(n)</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                Du hast noch keine Templates uebernommen. In der Templates-Seite
                kannst du ungeclaimte Templates per <strong>Mir zuweisen</strong>{" "}
                claimen.
              </p>
            )}
          </Link>
        </>
      )}

      {/* Schueler: Klassen + verfuegbare Templates + eigene VMs */}
      {isStudent && !isAdmin && !isTeacher && (
        <>
          <Link to="/classes" className="card card-link">
            <h3>Deine Klassen ({classes?.length ?? "—"})</h3>
            {classes && classes.length > 0 ? (
              <ul className="home-inline">
                {classes.map((c) => (
                  <li key={c.oid}>{c.displayName ?? c.oid}</li>
                ))}
              </ul>
            ) : (
              <p>Du bist (noch) in keiner aktiven Klasse fuer dieses Tool.</p>
            )}
          </Link>

          <Link to="/templates" className="card card-link">
            <h3>Verfuegbare Templates ({templates.length})</h3>
            {templates.length > 0 ? (
              <ul className="home-inline">
                {templates.map((t) => (
                  <li key={t.vmid}>
                    <strong>{t.name}</strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                Aktuell keine Templates fuer deine Klasse(n) — sobald ein
                Lehrer eines freigibt, taucht es hier auf.
              </p>
            )}
          </Link>

          <Link to="/my-vms" className="card card-link">
            <h3>Meine VMs ({vms.length})</h3>
            {vms.length > 0 ? (
              <ul className="home-inline">
                {vms.map((v) => (
                  <li key={v.vmid}>
                    <strong>{v.name}</strong>{" "}
                    <StatusBadge status={v.status} />
                    <VmStatsPill vm={v} />
                  </li>
                ))}
              </ul>
            ) : (
              <p>
                Noch keine eigenen VMs. Klick auf der Templates-Seite auf{" "}
                <strong>+</strong>, um eine VM aus einem Template zu erstellen.
              </p>
            )}
          </Link>
        </>
      )}
    </>
  );
}
