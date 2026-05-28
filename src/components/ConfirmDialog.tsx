import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";
import "./ConfirmDialog.css";

// In-App-Bestätigung statt window.confirm(): native Browser-Dialoge sind im
// Teams-Tab (iframe/Webview) blockiert — confirm() liefert dort i.d.R. `false`,
// die Aktion würde stillschweigend abbrechen. Dieser Dialog ist reines DOM und
// funktioniert in Teams UND im Browser.

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

type ConfirmFn = (opts: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((ok: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((opts) => {
    const o = typeof opts === "string" ? { message: opts } : opts;
    return new Promise<boolean>((resolve) => {
      // Falls schon ein Dialog offen ist (sollte UI-seitig nicht passieren),
      // den alten als abgebrochen auflösen, bevor der neue übernimmt.
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setPending(o);
    });
  }, []);

  const close = useCallback((ok: boolean) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setPending(null);
    resolve?.(ok);
  }, []);

  // Tastatur: Esc = abbrechen, Enter = bestätigen.
  useEffect(() => {
    if (!pending) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close(false);
      else if (e.key === "Enter") close(true);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, close]);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {pending && (
        <div className="modal-overlay" onClick={() => close(false)}>
          <div
            className="modal"
            role="alertdialog"
            aria-modal="true"
            aria-label={pending.title ?? "Bestätigen"}
            onClick={(e) => e.stopPropagation()}
          >
            {pending.title && <h3 className="modal-title">{pending.title}</h3>}
            <p className="modal-message">{pending.message}</p>
            <div className="modal-actions">
              <button
                type="button"
                className="modal-btn"
                onClick={() => close(false)}
              >
                {pending.cancelLabel ?? "Abbrechen"}
              </button>
              <button
                type="button"
                className={`modal-btn ${pending.danger ? "danger" : "primary"}`}
                onClick={() => close(true)}
                autoFocus
              >
                {pending.confirmLabel ?? "Bestätigen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
