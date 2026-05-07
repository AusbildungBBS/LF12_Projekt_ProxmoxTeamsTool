// Dev-only auth bypass — Rollen-Erkennung aus URL / localStorage / env.
// Enabled via:
//   - URL param `?devauth=admin|teacher|student` (one-time, stores in localStorage)
//   - or localStorage.dev_auth_role = "admin" | "teacher" | "student"
//   - or VITE_DEV_FAKE_AUTH env at build time
// Tear down with `?devauth=off`.
//
// Liegt getrennt von DevFakeAuth.tsx, damit jene Datei nur Komponenten
// exportiert (react-refresh/only-export-components). Existiert, weil wir den
// echten Entra-Tenant gerade nicht erreichen und die UI trotzdem in allen
// Rollen-Zustaenden entwickeln / previewen wollen.

export const STORAGE_KEY = "dev_auth_role";
export const VALID_ROLES = ["admin", "teacher", "student"] as const;
export type DevRole = (typeof VALID_ROLES)[number];

export function readDevAuthRole(): DevRole | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("devauth");
  if (fromUrl === "off") {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
  if (fromUrl && (VALID_ROLES as readonly string[]).includes(fromUrl)) {
    localStorage.setItem(STORAGE_KEY, fromUrl);
    return fromUrl as DevRole;
  }

  const fromStorage = localStorage.getItem(STORAGE_KEY);
  if (fromStorage && (VALID_ROLES as readonly string[]).includes(fromStorage)) {
    return fromStorage as DevRole;
  }

  const fromEnv = import.meta.env.VITE_DEV_FAKE_AUTH as string | undefined;
  if (fromEnv && (VALID_ROLES as readonly string[]).includes(fromEnv)) {
    return fromEnv as DevRole;
  }

  return null;
}
