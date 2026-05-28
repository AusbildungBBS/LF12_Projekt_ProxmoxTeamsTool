import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../auth/authContext";
import { useRoleFlags } from "../auth/useRoleFlags";
import {
  useBridgeApi,
  type Template,
  type VmDTO,
  type ClassInfo,
} from "../api/bridge";
import { VmStatsPill } from "../components/VmStatsPill";
import { StatusBadge } from "../components/StatusBadge";
import { ErrorCard } from "../components/ErrorCard";
import { useVmAutoRefresh } from "../hooks/useVmAutoRefresh";
import { errMsg } from "../lib/errors";
import { shortOid } from "../lib/format";

export function AdminPage() {
  const { isAuthenticated, accessToken } = useAuth();
  const { isAdmin } = useRoleFlags();
  const api = useBridgeApi();

  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [vms, setVms] = useState<VmDTO[] | null>(null);
  const [classes, setClasses] = useState<ClassInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const [t, v, c] = await Promise.all([
        api.listTemplates(),
        api.listVms(),
        api.listClasses(),
      ]);
      setTemplates(t);
      setVms(v);
      setClasses(c);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [api]);

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      await refresh();
    })();
  }, [accessToken, refresh]);

  useVmAutoRefresh(vms, refresh);

  if (!isAuthenticated) return <p>Bitte einloggen.</p>;
  if (!isAdmin) {
    return (
      <section className="page">
        <p>Diese Seite ist nur für Admins.</p>
      </section>
    );
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Admin-Konsole</h2>
        <p className="page-subtitle">Globale Sicht über alle Vorlagen, VMs und Klassen.</p>
      </header>

      <ErrorCard message={error} />

      <div className="admin-grid">
        <div className="card">
          <h3>Vorlagen ({templates?.length ?? "—"})</h3>
          <ul>
            {templates?.map((t) => (
              <li key={t.vmid}>
                <strong>{t.name}</strong> (VMID {t.vmid})
                {t.isPublic && <span className="badge badge-public">öffentlich</span>}
                <br />
                <small>{t.classes.length} Klassen, Besitzer {shortOid(t.ownerOid)}</small>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>VMs ({vms?.length ?? "—"})</h3>
          <ul>
            {vms?.map((v) => (
              <li key={v.vmid}>
                <Link to={`/my-vms#vm-${v.vmid}`}>
                  <strong>{v.name}</strong>
                </Link>{" "}
                (VMID {v.vmid})
                <StatusBadge status={v.status} />
                {v.status === "running" && (
                  <Link
                    to={`/vms/${v.vmid}/console`}
                    title="Konsole"
                    className="inline-icon-link"
                  >
                    🖥
                  </Link>
                )}
                <br />
                <small>
                  Besitzer {shortOid(v.ownerOid)} · aus Vorlage{" "}
                  {v.sourceTemplate
                    ? v.sourceTemplate.name ?? `VMID ${v.sourceTemplate.vmid}`
                    : "—"}
                </small>
                <br />
                <VmStatsPill vm={v} />
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>Aktive Klassen ({classes?.length ?? "—"})</h3>
          <ul>
            {classes?.map((c) => (
              <li key={c.oid}>
                <strong>{c.displayName ?? "(unbekannt)"}</strong>
                <br />
                <small>{c.oid}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
