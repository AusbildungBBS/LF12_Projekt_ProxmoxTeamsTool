import type { ReactNode } from "react";
import { AuthContext, type GraphProfile } from "./TeamsAuthProvider";
import type { AccountInfo } from "@azure/msal-browser";

// Dev-only auth bypass. Enabled via:
//   - URL param `?devauth=admin|teacher|student` (one-time, stores in localStorage)
//   - or localStorage.dev_auth_role = "admin" | "teacher" | "student"
//   - or VITE_DEV_FAKE_AUTH env at build time
// Tear down with `?devauth=off`.
//
// Exists because we can't reach the real Entra tenant right now and still want
// to develop / preview the UI in all role states.

const STORAGE_KEY = "dev_auth_role";
const VALID_ROLES = ["admin", "teacher", "student"] as const;
type DevRole = (typeof VALID_ROLES)[number];

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

const ROLE_CLAIM_MAP: Record<DevRole, string> = {
  admin: "Proxmox.Admin",
  teacher: "Proxmox.Teacher",
  student: "Proxmox.Student",
};

const FAKE_PROFILES: Record<DevRole, GraphProfile> = {
  admin: {
    id: "dev-admin",
    displayName: "Dev Admin",
    mail: "admin@dev.local",
    userPrincipalName: "admin@dev.local",
    jobTitle: "IT-Administration",
    officeLocation: "Schul-IT",
  },
  teacher: {
    id: "dev-teacher",
    displayName: "Dev Lehrer",
    mail: "lehrer@dev.local",
    userPrincipalName: "lehrer@dev.local",
    jobTitle: "Lehrkraft",
    officeLocation: "Berufsschule",
  },
  student: {
    id: "dev-student",
    displayName: "Dev Schüler",
    mail: "schueler@dev.local",
    userPrincipalName: "schueler@dev.local",
    jobTitle: "Auszubildende:r",
    officeLocation: "Klasse 12a",
  },
};

export function DevFakeAuthProvider({
  role,
  children,
}: {
  role: DevRole;
  children: ReactNode;
}) {
  const roles = [ROLE_CLAIM_MAP[role]];
  const profile = FAKE_PROFILES[role];

  const fakeUser = {
    homeAccountId: profile.id,
    environment: "dev.local",
    tenantId: "00000000-0000-0000-0000-000000000000",
    username: profile.userPrincipalName,
    localAccountId: profile.id,
    name: profile.displayName,
  } as unknown as AccountInfo;

  return (
    <AuthContext.Provider
      value={{
        isInTeams: false,
        isAuthenticated: true,
        user: fakeUser,
        accessToken: "dev-fake-token",
        profile,
        roles,
        hasRole: (r: string) => roles.includes(r),
        login: async () => {},
        logout: async () => {
          localStorage.removeItem(STORAGE_KEY);
          window.location.reload();
        },
        getToken: async () => "dev-fake-token",
        loading: false,
        error: null,
      }}
    >
      <DevAuthBanner role={role} />
      {children}
    </AuthContext.Provider>
  );
}

function DevAuthBanner({ role }: { role: DevRole }) {
  const switchTo = (next: DevRole | "off") => {
    if (next === "off") {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, next);
    }
    window.location.assign(window.location.pathname);
  };

  return (
    <div className="dev-auth-banner">
      <strong>DEV-MODE</strong> · eingeloggt als <em>{role}</em> ·
      switch:{" "}
      {VALID_ROLES.filter((r) => r !== role).map((r) => (
        <button key={r} onClick={() => switchTo(r)}>
          {r}
        </button>
      ))}
      <button onClick={() => switchTo("off")}>logout</button>
    </div>
  );
}
