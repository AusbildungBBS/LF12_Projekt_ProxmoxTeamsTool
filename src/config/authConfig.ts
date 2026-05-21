import type { Configuration } from "@azure/msal-browser";
import { LogLevel } from "@azure/msal-browser";

// Laufzeit-Config: im Container injiziert der Entrypoint window.__APP_CONFIG__
// aus den Compose-Env-Vars/Secrets (public/config.js + Dockerfile.frontend).
// Lokal in der Dev bleibt window.__APP_CONFIG__ leer -> Fallback auf die
// VITE_*-Build-Env. So ist EIN Image fuer alle Umgebungen konfigurierbar.
declare global {
  interface Window {
    __APP_CONFIG__?: { AZURE_CLIENT_ID?: string; AZURE_TENANT_ID?: string };
  }
}
const runtimeConfig =
  (typeof window !== "undefined" && window.__APP_CONFIG__) || {};
const CLIENT_ID =
  runtimeConfig.AZURE_CLIENT_ID || import.meta.env.VITE_AZURE_CLIENT_ID || "";
const TENANT_ID =
  runtimeConfig.AZURE_TENANT_ID ||
  import.meta.env.VITE_AZURE_TENANT_ID ||
  "common";

/**
 * MSAL configuration for Azure AD authentication.
 *
 * Required: Register an app in Azure Portal (Microsoft Entra ID)
 * and set the environment variables accordingly.
 */
export const msalConfig: Configuration = {
  auth: {
    clientId: CLIENT_ID,
    authority: `https://login.microsoftonline.com/${TENANT_ID}`,
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
  system: {
    loggerOptions: {
      loggerCallback: (level, message, containsPii) => {
        if (containsPii) return;
        switch (level) {
          case LogLevel.Error:
            console.error(message);
            break;
          case LogLevel.Warning:
            console.warn(message);
            break;
          case LogLevel.Info:
            console.info(message);
            break;
          case LogLevel.Verbose:
            console.debug(message);
            break;
        }
      },
      logLevel: LogLevel.Warning,
    },
  },
};

/**
 * The custom scope exposed by our backend API in Azure App Registration
 * (configured under "Expose an API" → access_as_user).
 *
 * The frontend requests a token for THIS scope. The backend then exchanges
 * it via the On-Behalf-Of flow for a Microsoft Graph token.
 */
const apiScope = `api://${CLIENT_ID}/access_as_user`;

/**
 * Scopes for the initial login request.
 */
export const loginRequest = {
  scopes: [apiScope],
};

/**
 * Microsoft Graph API endpoint (called server-side via OBO).
 */
export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
};
