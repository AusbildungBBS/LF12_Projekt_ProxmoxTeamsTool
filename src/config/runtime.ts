// Zentrale Laufzeit-Config der SPA.
//
// Im Container injiziert der Entrypoint (docker-entrypoint.frontend.sh) ein
// window.__APP_CONFIG__ nach /config.js — aus den Compose-Env-Vars/Secrets.
// Lokal in der Dev bleibt window.__APP_CONFIG__ leer -> Fallback auf die
// VITE_*-Build-Env. So ist EIN Image fuer alle Umgebungen konfigurierbar.
//
// Diese Datei ist die EINZIGE Stelle, die window.__APP_CONFIG__ typisiert und
// ausliest — alle anderen Module importieren die aufgeloesten Werte hier.
declare global {
  interface Window {
    __APP_CONFIG__?: {
      AZURE_CLIENT_ID?: string;
      AZURE_TENANT_ID?: string;
      AZURE_APP_ID_URI?: string;
      API_BASE_URL?: string;
    };
  }
}

const runtimeConfig =
  (typeof window !== "undefined" && window.__APP_CONFIG__) || {};

export const AZURE_CLIENT_ID =
  runtimeConfig.AZURE_CLIENT_ID || import.meta.env.VITE_AZURE_CLIENT_ID || "";

export const AZURE_TENANT_ID =
  runtimeConfig.AZURE_TENANT_ID ||
  import.meta.env.VITE_AZURE_TENANT_ID ||
  "common";

function defaultAppIdUri(): string {
  if (!AZURE_CLIENT_ID) return "";

  if (typeof window === "undefined") {
    return `api://${AZURE_CLIENT_ID}`;
  }

  const host = window.location.host;
  const isLocalhost =
    host.startsWith("localhost") || host.startsWith("127.0.0.1");

  // Teams SSO erwartet bei gehosteten Tabs api://<frontend-host>/<client-id>.
  // Fuer lokale Browser-Entwicklung bleibt der alte Default ohne Host nutzbar.
  return isLocalhost
    ? `api://${AZURE_CLIENT_ID}`
    : `api://${host}/${AZURE_CLIENT_ID}`;
}

export const AZURE_APP_ID_URI = (
  runtimeConfig.AZURE_APP_ID_URI ||
  import.meta.env.VITE_AZURE_APP_ID_URI ||
  defaultAppIdUri()
).replace(/\/+$/, "");

// Absolute Basis-Origin der Bridge (API + VNC-WebSocket).
//   leer    -> relative Pfade (/api, /ws): Frontend und Bridge teilen sich eine
//              Origin (Dev-Proxy bzw. Single-Host hinter Reverse-Proxy).
//   gesetzt -> z.B. https://api.example.org: Frontend und Bridge liegen auf
//              verschiedenen Origins (Azure Static Web Apps + Cloudflare-Tunnel).
//              Erfordert CORS_ALLOWED_ORIGINS auf der Bridge.
function normalizeApiBase(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, ""); // Trailing-Slashes weg; "" bleibt "".
  if (!trimmed) return "";
  // Ohne Schema ist der Wert KEIN absolutes Origin, sondern ein relativer Pfad:
  // fetch haengt ihn an die Frontend-Origin (.../api.example.org/api/me) und
  // `new URL(...)` in wsUrl() wirft. Fehlt das Schema, https:// annehmen (Prod
  // laeuft ueber TLS).
  if (!/^https?:\/\//i.test(trimmed)) return `https://${trimmed}`;
  return trimmed;
}

export const API_BASE_URL = normalizeApiBase(
  runtimeConfig.API_BASE_URL || import.meta.env.VITE_API_BASE_URL || ""
);

// Baut die HTTP-URL fuer einen API-Pfad. `path` ist ein absoluter App-Pfad wie
// "/api/templates". Bei leerer Basis bleibt der Pfad relativ (same-origin).
export function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

// Baut die ws(s)://-URL fuer einen WebSocket-Pfad. Mit gesetzter Basis lebt der
// WebSocket auf der Bridge-Origin; sonst Fallback auf die aktuelle Seiten-Origin.
export function wsUrl(path: string): string {
  const httpBase =
    API_BASE_URL || `${window.location.protocol}//${window.location.host}`;
  const u = new URL(httpBase);
  const proto = u.protocol === "https:" ? "wss:" : "ws:";
  const prefix = u.pathname.replace(/\/+$/, "");
  return `${proto}//${u.host}${prefix}${path}`;
}
