import { useCallback, useEffect, useState } from "react";
import { useAuth } from "../auth/authContext";
import {
  useBridgeApi,
  type ClassInfo,
  type Template,
} from "../api/bridge";

export function TemplatesPage() {
  const { hasRole, isAuthenticated, accessToken, identity } = useAuth();
  const api = useBridgeApi();
  const isStudent = hasRole("Proxmox.Student");
  const isTeacher = hasRole("Proxmox.Teacher");
  const isAdmin = hasRole("Proxmox.Admin");
  const canManage = isTeacher || isAdmin;

  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [assignable, setAssignable] = useState<ClassInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const list = await api.listTemplates();
      setTemplates(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api]);

  useEffect(() => {
    if (!accessToken) return;
    void (async () => {
      await refresh();
    })();
    if (canManage) {
      api.listAssignableClasses().then(setAssignable).catch(() => setAssignable([]));
    }
  }, [accessToken, refresh, canManage, api]);

  if (!isAuthenticated) return <p>Bitte einloggen.</p>;

  async function withBusy<T>(vmid: number, op: () => Promise<T>) {
    setBusyId(vmid);
    setError(null);
    setHint(null);
    try {
      return await op();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      throw e;
    } finally {
      setBusyId(null);
    }
  }

  async function instantiate(t: Template) {
    await withBusy(t.vmid, async () => {
      const res = await api.createVmFromTemplate(t.vmid);
      setHint(
        `Klon-Task fuer VMID ${res.newVmid} an Proxmox uebergeben (UPID ${res.task.upid}).`
      );
    });
  }

  async function claim(t: Template) {
    await withBusy(t.vmid, async () => {
      await api.claimTemplate(t.vmid);
      await refresh();
    });
  }

  async function release(t: Template) {
    if (!confirm(`Template "${t.name}" freigeben? Es wird wieder claimbar.`)) return;
    await withBusy(t.vmid, async () => {
      await api.releaseTemplate(t.vmid);
      await refresh();
    });
  }

  async function togglePublic(t: Template) {
    await withBusy(t.vmid, async () => {
      await api.updateTemplate(t.vmid, { isPublic: !t.isPublic });
      await refresh();
    });
  }

  async function toggleClass(t: Template, oid: string) {
    const newClasses = t.classes.includes(oid)
      ? t.classes.filter((c) => c !== oid)
      : [...t.classes, oid];
    await withBusy(t.vmid, async () => {
      await api.updateTemplate(t.vmid, { classes: newClasses });
      await refresh();
    });
  }

  return (
    <section className="page">
      <header className="page-header">
        <h2>Templates</h2>
        <p className="page-subtitle">
          {isStudent
            ? "Templates, die dir ueber deine Klasse(n) zugewiesen wurden."
            : "Templates verwalten — Owner, Public-Flag, Klassen-Zuweisung."}
        </p>
      </header>

      {error && <div className="card error">Fehler: {error}</div>}
      {hint && <div className="card hint">{hint}</div>}

      {templates === null && <div className="card">Lade Templates ...</div>}

      {templates && templates.length === 0 && (
        <div className="card empty">
          <p>
            Keine Templates in deinem Sichtbereich.{" "}
            {isStudent
              ? "Sobald ein Lehrer ein Template fuer deine Klasse freigibt, taucht es hier auf."
              : "Lege ein Template in Proxmox an und tag es mit pttool-tpl."}
          </p>
        </div>
      )}

      {templates && templates.length > 0 && (
        <ul className="card-list">
          {templates.map((t) => {
            // "isOwn" nur, wenn der User auch managen darf -- sonst zeigen
            // wir einem Schueler, der zufaellig die gleiche OID wie der Owner
            // hat (oder in Impersonation-Demos), keine Edit-Buttons.
            const isOwn = !!t.ownerOid && identity?.oid === t.ownerOid && canManage;
            // Edit-Buttons (Public / Classes / Release) brauchen einen Owner,
            // sonst gibt's nichts zu freizugeben und Public/Classes-Setzen waere
            // ein verkappter Claim. Solange ungeclaimt, ist die einzige
            // sinnvolle Aktion "Mir zuweisen".
            const canEdit = !!t.ownerOid && (isAdmin || isOwn);
            const editing = editingId === t.vmid;
            return (
              <li key={t.vmid} id={`template-${t.vmid}`} className="card">
                <div className="card-row">
                  <strong>{t.name}</strong>
                  <span className="badge">VMID {t.vmid}</span>
                  {t.isPublic && (
                    <span className="badge badge-public">public</span>
                  )}
                  {!t.ownerOid && (
                    <span className="badge badge-unclaimed">ungeclaimt</span>
                  )}
                  {isOwn && <span className="badge badge-own">dein Template</span>}
                </div>
                <div className="card-meta">
                  <span>Klassen: {t.classes.length}</span>
                  <span>Node: {t.node}</span>
                  {t.ownerOid && !isOwn && (
                    <span>Owner: {t.ownerOid.slice(0, 8)}…</span>
                  )}
                </div>

                <div className="card-actions icon-actions">
                  <button
                    className="icon-button"
                    aria-label="VM aus diesem Template erstellen"
                    data-tooltip={
                      isStudent
                        ? "VM aus diesem Template erstellen (max. eine pro Template)"
                        : "VM aus diesem Template erstellen (Test/Demo)"
                    }
                    title="VM aus diesem Template erstellen"
                    onClick={() => instantiate(t)}
                    disabled={busyId === t.vmid}
                  >
                    {busyId === t.vmid ? "…" : "➕"}
                  </button>

                  {canManage && !t.ownerOid && (
                    <button
                      className="icon-button wide"
                      aria-label="Mir zuweisen"
                      data-tooltip="Mir zuweisen (Owner werden)"
                      title="Mir zuweisen"
                      onClick={() => claim(t)}
                      disabled={busyId === t.vmid}
                    >
                      Mir zuweisen
                    </button>
                  )}

                  {canEdit && (
                    <>
                      <button
                        className={`icon-button ${t.isPublic ? "active" : ""}`}
                        aria-label="Public toggeln"
                        data-tooltip={t.isPublic ? "Public-Flag entfernen" : "Public machen"}
                        title="Public-Flag"
                        onClick={() => togglePublic(t)}
                        disabled={busyId === t.vmid}
                      >
                        🌐
                      </button>
                      <button
                        className={`icon-button ${editing ? "active" : ""}`}
                        aria-label="Klassen zuweisen"
                        data-tooltip="Klassen zuweisen"
                        title="Klassen zuweisen"
                        onClick={() => setEditingId(editing ? null : t.vmid)}
                        disabled={busyId === t.vmid}
                      >
                        🏷
                      </button>
                      <button
                        className="icon-button"
                        aria-label="Freigeben"
                        data-tooltip="Freigeben (kein Owner mehr)"
                        title="Freigeben"
                        onClick={() => release(t)}
                        disabled={busyId === t.vmid}
                      >
                        🪄
                      </button>
                    </>
                  )}
                </div>

                {canEdit && editing && (
                  <div className="card-edit">
                    <h4>Klassen-Zuweisung</h4>
                    {assignable === null && <p>Lade Klassen...</p>}
                    {assignable && assignable.length === 0 && (
                      <p className="muted">
                        Du bist in keiner M365-Group, die du als Klasse zuweisen koenntest.
                      </p>
                    )}
                    {assignable && assignable.length > 0 && (
                      <ul className="class-picker">
                        {assignable.map((c) => (
                          <li key={c.oid}>
                            <label>
                              <input
                                type="checkbox"
                                checked={t.classes.includes(c.oid)}
                                onChange={() => toggleClass(t, c.oid)}
                                disabled={busyId === t.vmid}
                              />
                              {c.displayName ?? c.oid}
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
