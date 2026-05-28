import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { app, authentication } from "@microsoft/teams-js";
import {
  PublicClientApplication,
  InteractionRequiredAuthError,
} from "@azure/msal-browser";
import { MsalProvider, useMsal } from "@azure/msal-react";
import { msalConfig, loginRequest } from "../config/authConfig";
import { apiUrl } from "../config/runtime";
import { AuthContext } from "./authContext";
import type {
  AuthSession,
  GraphProfile,
  BridgeIdentity,
  ImpersonatedRole,
} from "./authContext";
import { ROLES, isImpersonatedRole } from "./roles";

// ── MSAL Instance ──────────────────────────────────────────────────────────────

const msalInstance = new PublicClientApplication(msalConfig);

// Mappt HTTP-Status + strukturierten {code} der Bridge auf eine nutzer-
// verständliche Meldung. Ohne das schluckt das Frontend 401/403 von /api/me
// still und der Benutzer sieht eine leere App ohne jede Erklärung.
function bridgeAuthErrorMessage(status: number, code?: string): string {
  switch (code) {
    case "not_provisioned":
      return "Du bist angemeldet, aber dein Konto ist für dieses Tool nicht freigeschaltet. Bitte wende dich an einen Admin.";
    case "wrong_tenant":
      return "Dein Konto gehört nicht zu dieser Organisation.";
    case "token_expired":
      return "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.";
    case "idp_unavailable":
      return "Microsoft ist gerade nicht erreichbar. Bitte versuch es in ein paar Minuten erneut.";
    case "proxmox_unavailable":
      return "Die Proxmox-Verbindung ist gerade nicht erreichbar. Bitte versuch es in ein paar Minuten erneut.";
    case "upstream_unavailable":
      return "Ein Backend-Dienst ist gerade nicht erreichbar. Bitte versuch es in ein paar Minuten erneut.";
  }
  if (status === 403)
    return "Zugriff verweigert — dein Konto ist für dieses Tool nicht berechtigt. Bitte kontaktiere einen Admin.";
  if (status === 401) return "Anmeldung fehlgeschlagen. Bitte melde dich erneut an.";
  return "Anmeldung konnte nicht abgeschlossen werden. Bitte später erneut versuchen.";
}

// Relevante Claims aus einem ID-/Access-Token. MSAL liefert sie im Browser
// geparst (user.idTokenClaims); in Teams dekodieren wir sie selbst.
type JwtClaims = {
  name?: string;
  preferred_username?: string;
  roles?: string[];
  oid?: string;
};

// Dekodiert den Payload eines JWT (ohne Signaturprüfung) — NUR zur Anzeige von
// Name/Rollen in Teams (dort gibt es kein MSAL-ID-Token). Sicherheit und
// Autorisierung macht weiterhin die Bridge serverseitig.
function decodeJwtPayload(token: string | null): JwtClaims | null {
  if (!token) return null;
  const part = token.split(".")[1];
  if (!part) return null;
  try {
    const bin = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const json = decodeURIComponent(
      bin
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Mappt die Teams-Tab-entityId (aus app.getContext().page.id) auf die App-Route,
// die dieser Tab als Root lädt. Damit erkennt das Layout, ob man am Root des
// AKTIVEN Tabs ist (Header ausblendbar) oder intern woanders hin navigiert hat.
function tabRootForEntity(entityId?: string): string {
  switch (entityId) {
    case "templates":
      return "/templates";
    case "vms":
      return "/my-vms";
    default: // "dashboard" + Fallback
      return "/";
  }
}

// ── Inner Auth Provider (needs MSAL context) ───────────────────────────────────

function AuthProviderInner({ children }: { children: ReactNode }) {
  const { instance, accounts } = useMsal();
  const [isInTeams, setIsInTeams] = useState(false);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [profile, setProfile] = useState<GraphProfile | null>(null);
  const [identity, setIdentity] = useState<BridgeIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // In Teams gibt es kein MSAL-Konto/ID-Token: Name/UPN merken wir aus dem
  // Teams-Kontext, Rollen kommen aus dem dekodierten SSO-Token (siehe unten).
  const [teamsUser, setTeamsUser] = useState<{
    displayName?: string;
    upn?: string;
  } | null>(null);
  // Root-Route des aktiven Teams-Tabs (siehe tabRootForEntity).
  const [teamsTabRoot, setTeamsTabRoot] = useState<string | null>(null);
  const IMPERSONATE_KEY = "pttool.impersonate";
  const [impersonatedRole, setImpersonatedRoleState] = useState<ImpersonatedRole | null>(
    () => {
      if (typeof window === "undefined") return null;
      const v = localStorage.getItem(IMPERSONATE_KEY);
      if (isImpersonatedRole(v)) return v;
      return null;
    }
  );
  const setImpersonatedRole = (r: ImpersonatedRole | null) => {
    setImpersonatedRoleState(r);
    if (r) localStorage.setItem(IMPERSONATE_KEY, r);
    else localStorage.removeItem(IMPERSONATE_KEY);
  };

  const user = accounts[0] ?? null;

  // ── EINE normalisierte Session, egal woher der Login kam ───────────────────
  // Zwei Erwerbs-/Refresh-Wege (MSAL im Browser, Teams-SSO im Tab — siehe
  // getToken()), aber genau EIN normalisiertes Identitäts-Objekt, mit dem der
  // Rest arbeitet. Die Bridge-Identity (/api/me) ist autoritativ und reichert
  // dieses an bzw. überschreibt es.
  const session: AuthSession | null = useMemo(() => {
    // Browser: das MSAL-Konto ist die Quelle der Wahrheit für "angemeldet" —
    // auch schon, bevor das accessToken still nachgeladen wurde.
    if (user) {
      const c = user.idTokenClaims as JwtClaims | undefined;
      return {
        source: "msal",
        accessToken: accessToken ?? "",
        oid: c?.oid ?? "",
        displayName: c?.name || c?.preferred_username || user.username || "",
        email: c?.preferred_username || user.username || "",
        roles: c?.roles ?? [],
      };
    }
    // Teams: kein MSAL-Konto — das SSO-Token (+ Teams-Kontext) ist die Quelle.
    if (isInTeams && accessToken) {
      const c = decodeJwtPayload(accessToken);
      return {
        source: "teams",
        accessToken,
        oid: c?.oid ?? "",
        displayName:
          c?.name ||
          teamsUser?.displayName ||
          c?.preferred_username ||
          teamsUser?.upn ||
          "",
        email: teamsUser?.upn || c?.preferred_username || "",
        roles: c?.roles ?? [],
      };
    }
    return null;
  }, [user, accessToken, isInTeams, teamsUser]);

  const isAuthenticated = !!session;

  // Rollen: Bridge-Identity autoritativ, sonst aus der normalisierten Session.
  // realRoles = die ECHTEN Rollen (ohne Impersonation), damit der Switcher
  // erkennt, ob der Benutzer wirklich Admin ist.
  const realRoles = identity?.roles ?? session?.roles ?? [];
  const realIsAdmin = realRoles.includes(ROLES.ADMIN);

  // Anzeige-Profil: echtes Graph-Profil (Bridge, state `profile`) hat Vorrang,
  // sonst das aus der Session abgeleitete Minimal-Profil (greift v.a. in Teams
  // ohne Bridge — und im Browser vor dem /api/me-Roundtrip).
  const effectiveProfile: GraphProfile | null =
    profile ??
    (session
      ? {
          id: session.oid,
          displayName: session.displayName || session.email,
          mail: session.email || null,
          userPrincipalName: session.email,
        }
      : null);

  // Die "gefühlten" Rollen für die UI: bei aktiver Impersonation überschrieben.
  const roles = impersonatedRole ? [impersonatedRole] : realRoles;
  const classes = identity?.classes ?? [];
  const hasRole = (role: string) => roles.includes(role);

  // Teams SSO: holt still ein Token vom Teams-Client. Vor dem ersten useEffect
  // deklariert, da dieser sie aufruft (react-hooks/immutability).
  const teamsSSO = async () => {
    try {
      const token = await authentication.getAuthToken();
      setAccessToken(token);

      // Optional kann die Bridge das Token per On-Behalf-Of-Flow gegen
      // Graph-Zugriff tauschen.
      return token;
    } catch (err) {
      console.warn("Teams-SSO fehlgeschlagen, weiche auf MSAL aus:", err);
      setError("Teams-SSO fehlgeschlagen. Bitte manuell anmelden.");
      return null;
    }
  };

  // Beim Wegfall des Tokens (Logout/Expiry) Profil + Identity verwerfen — beim
  // Render erkannt (Vorwert-Guard) statt im Effect (react-hooks/set-state-in-effect).
  const [hadAccessToken, setHadAccessToken] = useState(!!accessToken);
  if (!!accessToken !== hadAccessToken) {
    setHadAccessToken(!!accessToken);
    if (!accessToken) {
      setProfile(null);
      setIdentity(null);
    }
  }

  // Prüft, ob die App innerhalb von Teams läuft.
  useEffect(() => {
    const initTeams = async () => {
      try {
        await app.initialize();
        const context = await app.getContext();
        if (context) {
          setIsInTeams(true);
          // Aktiven Teams-Tab merken (dessen Root-Route), damit das Layout den
          // Header am Tab-Root ausblenden kann.
          setTeamsTabRoot(tabRootForEntity(context.page?.id));
          // Name/UPN aus dem Teams-Kontext merken — dient zusammen mit den
          // Rollen aus dem SSO-Token als Anzeige-Fallback, falls die Bridge
          // (die das echte Graph-Profil liefert) gerade aus ist.
          setTeamsUser({
            displayName: context.user?.displayName,
            upn: context.user?.userPrincipalName,
          });
          // Teams-SSO versuchen.
          await teamsSSO();
        }
      } catch {
        // Nicht in Teams — dann normaler MSAL-Ablauf.
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
        console.error("Redirect-Verarbeitung fehlgeschlagen:", err);
      }
    };

    handleRedirect().then(initTeams);
  }, [instance]);

  // Nach einem Seiten-Refresh gibt es ein Konto, aber noch kein Token.
  // Das Token wird still nachgeladen.
  useEffect(() => {
    if (!user || accessToken) return;
    instance
      .acquireTokenSilent({ ...loginRequest, account: user })
      .then((res) => setAccessToken(res.accessToken))
      .catch((err) => {
        console.warn("Stille Token-Anforderung fehlgeschlagen:", err);
      });
  }, [user, accessToken, instance]);

  // Sobald ein Access-Token da ist, Profil + Identität von der Bridge laden.
  // Re-fetcht bei Impersonation-Switch, damit die Server-seitig gerechnete
  // Identity (Klassen-Filter etc.) zur impersonierten Rolle passt.
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        const headers: Record<string, string> = {
          Authorization: `Bearer ${accessToken}`,
        };
        if (impersonatedRole) headers["X-Impersonate-Role"] = impersonatedRole;
        const res = await fetch(apiUrl("/api/me"), { headers });
        if (!res.ok) {
          // Strukturierten {error, code} der Bridge auslesen, damit ein
          // angemeldeter-aber-nicht-berechtigter Benutzer eine klare Meldung sieht
          // statt einer stillen, leeren App.
          let code: string | undefined;
          let serverMsg: string | undefined;
          try {
            const body = await res.json();
            code = body?.code;
            serverMsg = body?.error;
          } catch {
            /* kein JSON-Body */
          }
          console.error("Abruf von /api/me fehlgeschlagen:", res.status, code ?? serverMsg);
          if (!cancelled) {
            setProfile(null);
            setIdentity(null);
            setError(bridgeAuthErrorMessage(res.status, code));
          }
          return;
        }
        const data = await res.json();
        if (!cancelled) {
          setProfile(data.profile ?? null);
          setIdentity(data.identity ?? null);
          setError(null);
        }
      } catch (err) {
        console.error("Abruf von /api/me fehlgeschlagen:", err);
        if (!cancelled) {
          setError("Verbindung zur Bridge fehlgeschlagen. Bitte später erneut versuchen.");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [accessToken, impersonatedRole]);

  /**
   * Anmeldung per MSAL-Redirect (robust in Popups, iFrames und Webviews).
   * Die Seite navigiert zu login.microsoftonline.com und kommt zurück;
   * die Antwort verarbeitet handleRedirectPromise() weiter oben.
   */
  const login = async () => {
    try {
      setError(null);
      await instance.loginRedirect(loginRequest);
    } catch (err) {
      console.error("Anmeldung fehlgeschlagen:", err);
      const msg =
        err instanceof Error
          ? `${(err as { errorCode?: string }).errorCode ?? err.name}: ${err.message}`
          : "Anmeldung fehlgeschlagen. Bitte erneut versuchen.";
      setError(msg);
    }
  };

  /**
   * Abmeldung per Redirect.
   */
  const logout = async () => {
    try {
      setAccessToken(null);
      await instance.logoutRedirect();
    } catch (err) {
      console.error("Abmeldung fehlgeschlagen:", err);
    }
  };

  /**
   * Hol ein gültiges Access-Token und aktualisiere den State.
   * - In Teams: authentication.getAuthToken() (Teams zwischenspeichert/erneuert selbst).
   * - Im Browser: MSAL acquireTokenSilent (nutzt das Refresh-Token).
   * Wird proaktiv (Timer unten) UND reaktiv (401-Retry im Bridge-Client)
   * aufgerufen, damit Sessions nicht nach ~1 h Token-Ablauf ausfallen.
   */
  const getToken = useCallback(async (): Promise<string | null> => {
    try {
      if (isInTeams) {
        const token = await authentication.getAuthToken();
        setAccessToken(token);
        return token;
      }
      if (!user) return null;
      const response = await instance.acquireTokenSilent({
        ...loginRequest,
        account: user,
      });
      setAccessToken(response.accessToken);
      return response.accessToken;
    } catch (err) {
      if (err instanceof InteractionRequiredAuthError) {
        // Interaktion nötig (Consent / Refresh-Token abgelaufen). Im Browser
        // zur Anmeldung navigieren; in Teams gibt es keinen Redirect-Flow.
        if (!isInTeams) await instance.acquireTokenRedirect(loginRequest);
        return null;
      }
      console.error("Token-Aktualisierung fehlgeschlagen:", err);
      return null;
    }
  }, [isInTeams, user, instance]);

  // Proaktiver Refresh: Access-Tokens sind ~60 min gültig. Alle ~45 min
  // zentral erneuern, damit ALLE Consumer (Bridge-API, /api/me, VNC-WebSocket)
  // ein frisches Token sehen. Greift im Browser (MSAL) wie in Teams (SSO).
  useEffect(() => {
    if (!accessToken) return;
    const id = setInterval(() => {
      void getToken();
    }, 45 * 60 * 1000);
    return () => clearInterval(id);
  }, [accessToken, getToken]);

  return (
    <AuthContext.Provider
      value={{
        isInTeams,
        teamsTabRoot,
        isAuthenticated,
        user,
        accessToken,
        profile: effectiveProfile,
        identity,
        roles,
        classes,
        hasRole,
        login,
        logout,
        getToken,
        loading,
        error,
        realIsAdmin,
        impersonatedRole,
        setImpersonatedRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ── Exported Provider (wraps MSAL + Auth) ──────────────────────────────────────

import { DevFakeAuthProvider } from "./DevFakeAuth";
import { readDevAuthRole } from "./devAuthRole";

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
