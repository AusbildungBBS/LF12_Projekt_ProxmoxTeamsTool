import type { ReactNode } from "react";
import {
  AuthContext,
  type GraphProfile,
  type BridgeIdentity,
} from "./authContext";
import type { AccountInfo } from "@azure/msal-browser";
import { STORAGE_KEY, VALID_ROLES, type DevRole } from "./devAuthRole";
import { ROLES, type RoleClaim } from "./roles";

const ROLE_CLAIM_MAP: Record<DevRole, RoleClaim> = {
  admin: ROLES.ADMIN,
  teacher: ROLES.TEACHER,
  student: ROLES.STUDENT,
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

const FAKE_CLASSES: Record<DevRole, string[]> = {
  admin: [],
  teacher: ["dev-class-12a", "dev-class-12b"],
  student: ["dev-class-12a"],
};

export function DevFakeAuthProvider({
  role,
  children,
}: {
  role: DevRole;
  children: ReactNode;
}) {
  const roles: string[] = [ROLE_CLAIM_MAP[role]];
  const profile = FAKE_PROFILES[role];
  const classes = FAKE_CLASSES[role];

  const identity: BridgeIdentity = {
    oid: profile.id,
    name: profile.displayName,
    email: profile.userPrincipalName,
    roles,
    classes,
    source: "standard",
  };

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
        teamsTabRoot: null,
        isAuthenticated: true,
        user: fakeUser,
        accessToken: "dev-fake-token",
        profile,
        identity,
        roles,
        classes,
        hasRole: (r: string) => roles.includes(r),
        login: async () => {},
        logout: async () => {
          localStorage.removeItem(STORAGE_KEY);
          window.location.reload();
        },
        getToken: async () => "dev-fake-token",
        loading: false,
        error: null,
        realIsAdmin: role === "admin",
        impersonatedRole: null,
        setImpersonatedRole: () => {},
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
