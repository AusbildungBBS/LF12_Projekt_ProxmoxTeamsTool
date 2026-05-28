import { createContext, useContext } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import type { ImpersonatedRole } from "./roles";

// ImpersonatedRole stammt aus der Rollen-SSOT (roles.ts); hier re-exportiert,
// damit bestehende Importe (z.B. TeamsAuthProvider) weiter funktionieren.
export type { ImpersonatedRole };

// Context, Hook + Typen leben hier (nicht in TeamsAuthProvider.tsx), damit die
// Provider-Datei ausschließlich Komponenten exportiert — Voraussetzung dafür,
// dass React Fast Refresh / HMR sauber funktioniert
// (react-refresh/only-export-components).

export interface GraphProfile {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle?: string | null;
  officeLocation?: string | null;
}

export interface BridgeIdentity {
  oid: string;
  name: string;
  email: string;
  roles: string[];
  classes: string[];
  source: "standard" | "edu";
}

// Normalisierte Auth-Session: EIN Identitäts-Objekt, egal ob der Login via
// MSAL (Browser) oder Teams-SSO (Tab) kam. Der Provider baut es aus den
// jeweiligen Claims; die Bridge-Identity (oben) ist autoritativ und reichert es
// an. Bewusst minimal — nur was die UI auch OHNE Bridge braucht.
export interface AuthSession {
  source: "msal" | "teams";
  accessToken: string;
  oid: string;
  displayName: string;
  email: string;
  roles: string[];
}

export interface AuthContextType {
  isInTeams: boolean;
  // In Teams: Root-Route des aktiven Teams-Tabs (entityId -> Pfad: "/",
  // "/templates", "/my-vms"). null im Browser. Damit erkennt das Layout, ob man
  // am Tab-Root ist (Header ausblendbar) oder intern woanders hin navigiert hat.
  teamsTabRoot: string | null;
  isAuthenticated: boolean;
  user: AccountInfo | null;
  accessToken: string | null;
  profile: GraphProfile | null;
  identity: BridgeIdentity | null;
  roles: string[];
  classes: string[];
  hasRole: (role: string) => boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  loading: boolean;
  error: string | null;
  // Demo-Impersonation: ein echter Admin kann eine andere Rolle "aufsetzen".
  // realIsAdmin gibt zurück, ob der angemeldete Benutzer WIRKLICH Admin ist
  // (unabhängig von der Impersonation), damit das Switcher-UI nur für
  // echte Admins angezeigt wird.
  realIsAdmin: boolean;
  impersonatedRole: ImpersonatedRole | null;
  setImpersonatedRole: (r: ImpersonatedRole | null) => void;
}

export const AuthContext = createContext<AuthContextType>({
  isInTeams: false,
  teamsTabRoot: null,
  isAuthenticated: false,
  user: null,
  accessToken: null,
  profile: null,
  identity: null,
  roles: [],
  classes: [],
  hasRole: () => false,
  login: async () => {},
  logout: async () => {},
  getToken: async () => null,
  loading: true,
  error: null,
  realIsAdmin: false,
  impersonatedRole: null,
  setImpersonatedRole: () => {},
});

export const useAuth = () => useContext(AuthContext);
