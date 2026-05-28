import type { ProxmoxClient } from "./proxmox";

// Whitelist aktiver Klassen. Eine Group wird zu einer "Pttool-Klasse" dadurch,
// dass mindestens ein Template in Proxmox mit `tpl-class-<group-oid>` getaggt ist.
// Ohne ein solches Tag ist die Gruppe nur eine M365-Gruppe aus dem
// `groups`-Claim des Benutzers und wird herausgefiltert — hält "All Company" usw. aus
// der UI heraus, auch wenn der Benutzer technisch gesehen Mitglied ist.

const ACTIVE_CLASS_CACHE_TTL_MS = 5 * 60 * 1000;
let cache: { oids: Set<string>; expiresAt: number } | null = null;

// Proxmox VE 8 beschränkt Tags auf [a-z0-9_-]+ — keine Doppelpunkte. Wir verwenden `-` als
// Schlüssel/Wert-Trenner anstelle von `:`. OIDs sind UUIDs (die ebenfalls Bindestriche enthalten),
// daher erkennen wir sie über `startsWith(TAG_PREFIX)` und schneiden das Präfix ab.
const TAG_PREFIX = "tpl-class-";

export async function getActiveClassOids(
  client: ProxmoxClient | null
): Promise<Set<string> | null> {
  // Kein Client konfiguriert -> kein Filter -> Bridge reicht alle Gruppen durch.
  // Nützlich in der Entwicklung, bevor Proxmox angebunden ist.
  if (!client) return null;

  if (cache && cache.expiresAt > Date.now()) return cache.oids;

  const vms = await client.listVMs();
  const oids = new Set<string>();
  for (const vm of vms) {
    for (const tag of vm.tags) {
      if (tag.startsWith(TAG_PREFIX)) {
        const oid = tag.slice(TAG_PREFIX.length).trim();
        if (oid) oids.add(oid);
      }
    }
  }
  cache = { oids, expiresAt: Date.now() + ACTIVE_CLASS_CACHE_TTL_MS };
  return oids;
}

// Für Tests / Debug-Endpoints — Cache verwerfen, damit der nächste Aufruf Proxmox erreicht.
export function clearActiveClassCache(): void {
  cache = null;
}

export async function filterToActiveClasses(
  client: ProxmoxClient | null,
  candidateOids: string[]
): Promise<string[]> {
  const active = await getActiveClassOids(client);
  if (active === null) return candidateOids;
  return candidateOids.filter((oid) => active.has(oid));
}
