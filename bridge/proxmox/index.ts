export type { ProxmoxClient } from "./client.js";
export { ProxmoxNotConfiguredError } from "./client.js";
export type {
  CloneOptions,
  Task,
  TaskRef,
  TaskStatus,
  VM,
  VMConfig,
  VMID,
  VMRef,
  VMStatus,
} from "./types.js";
export {
  RealProxmoxClient,
  parseTags,
  serializeTags,
} from "./RealProxmoxClient.js";

import { RealProxmoxClient } from "./RealProxmoxClient.js";
import type { ProxmoxClient } from "./client.js";
import { envOrFile } from "../env.js";

// Factory — gibt einen ProxmoxClient zurück, wenn die Env vollständig konfiguriert ist, sonst null
// (in diesem Fall verzichtet die Bridge serverseitig auf das Filtern von Klassen).
export function createProxmoxClientFromEnv(): ProxmoxClient | null {
  const baseUrl = envOrFile("PROXMOX_URL");
  const tokenId = envOrFile("PROXMOX_TOKEN_ID");
  const tokenSecret = envOrFile("PROXMOX_TOKEN_SECRET");
  if (!baseUrl || !tokenId || !tokenSecret) return null;

  const rejectUnauthorized =
    (process.env.PROXMOX_TLS_REJECT_UNAUTHORIZED ?? "true").toLowerCase() !==
    "false";

  return new RealProxmoxClient({ baseUrl, tokenId, tokenSecret, rejectUnauthorized });
}
