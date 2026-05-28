import type { ReactNode } from "react";

// Fehler-Karte. Rendert nichts, wenn weder message noch children gesetzt sind —
// der `{error && ...}`-Guard beim Caller entfaellt damit. `prefix` ist per
// Default "Fehler: " (auf "" setzen fuer bereits formatierte Meldungen).
export function ErrorCard({
  message,
  prefix = "Fehler: ",
  children,
}: {
  message?: string | null;
  prefix?: string;
  children?: ReactNode;
}) {
  if (!message && !children) return null;
  return (
    <div className="card error">
      {message ? `${prefix}${message}` : null}
      {children}
    </div>
  );
}
