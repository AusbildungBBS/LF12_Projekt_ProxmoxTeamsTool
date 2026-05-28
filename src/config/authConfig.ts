import type { Configuration } from "@azure/msal-browser";
import { LogLevel } from "@azure/msal-browser";
import {
  AZURE_APP_ID_URI,
  AZURE_CLIENT_ID as CLIENT_ID,
  AZURE_TENANT_ID as TENANT_ID,
} from "./runtime";

// Laufzeit-Config (Client-/Tenant-ID, API-Basis) lebt zentral in ./runtime.ts:
// dort wird window.__APP_CONFIG__ ausgelesen (Container) mit Fallback auf die
// VITE_*-Build-Env (Dev/SWA-Build). So ist EIN Image/Build für alle Umgebungen
// konfigurierbar.

/**
 * MSAL-Konfiguration für die Azure-AD-Anmeldung.
 *
 * Voraussetzung: App im Azure Portal (Microsoft Entra ID) registrieren
 * und die Umgebungsvariablen passend setzen.
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
 * Der eigene Scope der Backend-API aus der Azure-App-Registrierung
 * (konfiguriert unter "Expose an API" → access_as_user).
 *
 * Das Frontend fordert ein Token für genau diesen Scope an. Das Backend tauscht
 * es danach per On-Behalf-Of-Flow gegen ein Microsoft-Graph-Token.
 */
const apiScope = `${AZURE_APP_ID_URI}/access_as_user`;

/**
 * Scopes für die erste Anmeldung.
 */
export const loginRequest = {
  scopes: [apiScope],
};

/**
 * Microsoft-Graph-API-Endpunkt (serverseitiger Aufruf via OBO).
 */
export const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me",
};
