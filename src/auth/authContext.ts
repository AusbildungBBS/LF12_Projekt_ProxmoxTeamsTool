import { createContext, useContext } from "react";
import type { AccountInfo } from "@azure/msal-browser";
import type { ImpersonatedRole } from "./roles";

// ImpersonatedRole stammt aus der Rollen-SSOT (roles.ts); hier re-exportiert,
// damit bestehende Importe (z.B. TeamsAuthProvider) weiter funktionieren.
export type { ImpersonatedRole };

// Context, Hook + Typen leben hier (nicht in TeamsAuthProvider.tsx), damit die
// Provider-Datei ausschliesslich Komponenten exportiert — Voraussetzung dafuer,
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

export interface AuthContextType {
  isInTeams: boolean;
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
  // realIsAdmin gibt zurueck, ob der angemeldete User WIRKLICH Admin ist
  // (unabhaengig von der Impersonation), damit das Switcher-UI nur fuer
  // echte Admins angezeigt wird.
  realIsAdmin: boolean;
  impersonatedRole: ImpersonatedRole | null;
  setImpersonatedRole: (r: ImpersonatedRole | null) => void;
}

export const AuthContext = createContext<AuthContextType>({
  isInTeams: false,
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
