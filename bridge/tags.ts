// Tag-Schema (Proxmox VE 8 erlaubt nur [a-z0-9_-] in Tags, daher kein `:`).
//
//  Templates (template=1 + pttool-tpl Marker):
//    pttool-tpl            — generischer Marker, "dies ist ein von Pttool verwaltetes Template"
//    tpl-owner-<user-oid>  — Lehrer, der das Template erstellt hat
//    tpl-public            — andere Lehrer dürfen es zuweisen (m:n)
//    tpl-class-<oid>       — Klassenzuweisung (mehrfach möglich)
//
//  VMs (template=0 + pttool Marker):
//    pttool                — generischer Marker, "dies ist eine von Pttool verwaltete VM"
//    vm-owner-<user-oid>   — Schüler, dem die VM gehört
//    vm-tpl-<vmid>         — Source-Template-VMID (für Recreate-Action)

export const TAG = {
  VM_MARKER: "pttool",
  TPL_MARKER: "pttool-tpl",
  TPL_PUBLIC: "tpl-public",
  TPL_CLASS_PREFIX: "tpl-class-",
  TPL_OWNER_PREFIX: "tpl-owner-",
  VM_OWNER_PREFIX: "vm-owner-",
  VM_TPL_PREFIX: "vm-tpl-",
} as const;

export function tagValue(tags: string[], prefix: string): string | undefined {
  for (const t of tags) if (t.startsWith(prefix)) return t.slice(prefix.length);
  return undefined;
}

export function tagValues(tags: string[], prefix: string): string[] {
  return tags.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length));
}

export function hasTag(tags: string[], tag: string): boolean {
  return tags.includes(tag);
}
