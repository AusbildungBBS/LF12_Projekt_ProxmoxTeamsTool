import { useEffect, useState, createContext, useContext } from "react";
import type { ReactNode } from "react";
import { app, authentication } from "@microsoft/teams-js";
import {
  PublicClientApplication,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import type { AccountInfo } from "@azure/msal-browser";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { msalConfig, loginRequest } from "../config/authConfig";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface GraphProfile {
  id: string;
  displayName: string;
  mail: string | null;
  userPrincipalName: string;
  jobTitle?: string | null;
  officeLocation?: string | null;
}

interface AuthContextType {
  isInTeams: boolean;
  isAuthenticated: boolean;
  user: AccountInfo | null;
  accessToken: string | null;
  profile: GraphProfile | null;
  roles: string[];
  hasRole: (role: string) => boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getToken: () => Promise<string | null>;
  loading: boolean;
  error: string | null;
}

export const AuthContext = createContext<AuthContextType>({
  isInTeams: false,
  isAuthenticated: false,
  user: null,
  accessToken: null,
  profile: null,
  roles: [],
  hasRole: () => false,
  login: async () => {},
  logout: async () => {},
  getToken: async () => null,
  loading: true,
  error: null,
});

export const useAuth = () => useContext(AuthContext);

// ── MSAL Instance ──────────────────────────────────────────────────────────────

const msalInstance = new PublicClientApplication(msalConfig);

// ── Inner Auth Provider (needs MSAL context) ───────────────────────────────────

function AuthProviderInner({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const [isInTeams, setIsInTeams] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<GraphProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const user = accounts[0] ?? null;
  const isAuthenticated = !!user;

  const idTokenClaims = user?.idTokenClaims as
    | { roles?: string[] }
    | undefined;
  const roles = idTokenClaims?.roles ?? [];
  const hasRole = (role: string) => roles.includes(role);

  // Detect if running inside Teams
  useEffect(() => {
    const initTeams = async () => {
      try {
        await app.initialize();
        const context = await app.getContext();
        if (context) {
          setIsInTeams(true);
          // Try Teams SSO
          await teamsSSO();
        }
      } catch {
        // Not in Teams – that's fine, use regular MSAL flow
        setIsInTeams(false);
      } finally {
        setLoading(false);
      }
    };

    const handleRedirect = async () => {
      try {
        await instance.initialize();
        const response = await instance.handleRedirectPromise();
        if (response?.accessToken) {
          setAccessToken(response.accessToken);
        }
      } catch (err) {
        console.error("Redirect handling failed:", err);
      }
    };

    handleRedirect().then(initTeams);
  }, [instance]);

  // After page refresh we have an account but no token — acquire silently
  useEffect(() => {
    if (!user || accessToken) return;
    instance
      .acquireTokenSilent({ ...loginRequest, account: user })
      .then((res) => setAccessToken(res.accessToken))
      .catch((err) => {
        console.warn("Silent token acquisition failed:", err);
      });
  }, [user, accessToken, instance]);

  // Once we have an access token, fetch profile + roles from the backend
  useEffect(() => {
    if (!accessToken) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/me", {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!res.ok) {
          console.error("Failed to fetch /api/me:", res.status, await res.text());
          return;
        }
        const data = await res.json();
        if (!cancelled) setProfile(data.profile ?? null);
      } catch (err) {
        console.error("Failed to fetch /api/me:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  /**
   * Teams SSO: get a token silently from Teams client.
   */
  const teamsSSO = async () => {
    try {
      const token = await authentication.getAuthToken();
      setAccessToken(token);

      // Optionally exchange token on backend for Graph access
      // via the On-Behalf-Of flow
      return token;
    } catch (err) {
      console.warn("Teams SSO failed, falling back to MSAL popup:", err);
      setError("Teams SSO failed – try manual login");
      return null;
    }
  };

  /**
   * Login via MSAL redirect (robust in popups, iframes, and webviews).
   * The page navigates away to login.microsoftonline.com and comes back —
   * the response is handled by handleRedirectPromise() above.
   */
  const login = async () => {
    try {
      setError(null);
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      console.error("Login failed:", err);
      const msg =
        err instanceof Error
          ? `${(err as { errorCode?: string }).errorCode ?? err.name}: ${err.message}`
          : "Login failed. Please try again.";
      setError(msg);
    }
  };

  /**
   * Logout via redirect.
   */
  const logout = async () => {
    try {
      setAccessToken(null);
      await instance.logoutRedirect();
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  /**
   * Get a valid access token (silently if possible, redirect if interaction needed).
   */
  const getToken = async (): Promise<string | null> => {
    if (!user) return null;

    try {
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: user,
      });
      setAccessToken(response.accessToken);
      return response.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        // Token expired or consent needed – navigate to login
        await instance.acquireTokenRedirect(loginRequest);
        return null; // page navigates away
      }
      console.error("Token acquisition failed:", err);
      return null;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isInTeams,
        isAuthenticated,
        user,
        accessToken,
        profile,
        roles,
        hasRole,
        login,
        logout,
        getToken,
        loading,
        error,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Exported Provider (wraps MSAL + Auth) ──────────────────────────────────────

import { DevFakeAuthProvider, readDevAuthRole } from "./DevFakeAuth";

export function TeamsAuthProvider({ children }: { children: ReactNode }) {
  const devRole = readDevAuthRole();
  if (devRole) {
    return <DevFakeAuthProvider role={devRole}>{children}</DevFakeAuthProvider>;
  }
  return (
    <MsalProvider instance={msalInstance}>
      <AuthProviderInner>{children}</AuthProviderInner>
    </MsalProvider>
  );
}
