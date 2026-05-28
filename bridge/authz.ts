import { TAG, tagValue, tagValues, hasTag } from "./tags.js";
import type { VM } from "./proxmox/index.js";

// Reine Identitäts-, Rollen- und Autorisierungslogik der Bridge — bewusst
// ohne I/O / Express / Seiteneffekte, damit sie isoliert unit-testbar ist.
// index.ts importiert von hier; die HTTP-Verdrahtung bleibt dort.

// ── Identität / Rollen ───────────────────────────────────────────────────────────

export type AppRole = "Proxmox.Admin" | "Proxmox.Teacher" | "Proxmox.Student";

export interface BridgeIdentity {
  oid: string;
  name: string;
  email: string;
  roles: AppRole[];
  classes: string[];
  source: "standard" | "edu";
}

// EDU `primaryRole` → App-Roles. Admin ist nie ein EDU-primaryRole und bleibt
// eine explizite App-Role.
export function mapEduRoleToAppRoles(primaryRole?: string): AppRole[] {
  switch (primaryRole) {
    case "teacher":
    case "faculty":
      return ["Proxmox.Teacher"];
    case "student":
      return ["Proxmox.Student"];
    default:
      return [];
  }
}

// Behält nur bekannte Proxmox-App-Roles aus einem rohen roles-Claim.
export function filterAppRoles(roles: string[] | undefined): AppRole[] {
  if (!roles) return [];
  const allowed: AppRole[] = ["Proxmox.Admin", "Proxmox.Teacher", "Proxmox.Student"];
  return roles.filter((r): r is AppRole => allowed.includes(r as AppRole));
}

export function isAdmin(id: BridgeIdentity): boolean {
  return id.roles.includes("Proxmox.Admin");
}
export function isTeacher(id: BridgeIdentity): boolean {
  return id.roles.includes("Proxmox.Teacher");
}
export function isStudent(id: BridgeIdentity): boolean {
  return id.roles.includes("Proxmox.Student");
}

// Dev-Impersonation (rein): nur außerhalb prod und nur ein echter Admin darf
// eine andere Rolle aufsetzen. Der HTTP-Header-Wrapper lebt in index.ts.
export function applyImpersonation(
  real: BridgeIdentity,
  wantedRole: string | undefined,
  isProd: boolean
): BridgeIdentity {
  if (isProd) return real;
  if (!wantedRole) return real;
  if (!real.roles.includes("Proxmox.Admin")) return real;
  const allowed = ["Proxmox.Admin", "Proxmox.Teacher", "Proxmox.Student"];
  if (!allowed.includes(wantedRole)) return real;
  return { ...real, roles: [wantedRole as AppRole] };
}

// ── Autorisierung ──────────────────────────────────────────────────────────────

// Sichtbarkeit — Lesezugriff auf ein Template.
export function canSeeTemplate(tpl: VM, id: BridgeIdentity): boolean {
  if (isAdmin(id)) return true;
  if (isTeacher(id)) {
    const ownerOid = tagValue(tpl.tags, TAG.TPL_OWNER_PREFIX);
    // Ungeclaimte Templates sind für jeden Lehrer sichtbar -- sonst könnte
    // er sie nicht via UI claimen.
    if (!ownerOid) return true;
    if (ownerOid === id.oid) return true;
    if (hasTag(tpl.tags, TAG.TPL_PUBLIC)) return true;
    const tplClasses = tagValues(tpl.tags, TAG.TPL_CLASS_PREFIX);
    return tplClasses.some((c) => id.classes.includes(c));
  }
  if (isStudent(id)) {
    const tplClasses = tagValues(tpl.tags, TAG.TPL_CLASS_PREFIX);
    return tplClasses.some((c) => id.classes.includes(c));
  }
  return false;
}

export function canSeeVm(
  vm: VM,
  id: BridgeIdentity,
  templatesByVmid: Map<number, VM>
): boolean {
  if (isAdmin(id)) return true;
  if (isStudent(id)) {
    return tagValue(vm.tags, TAG.VM_OWNER_PREFIX) === id.oid;
  }
  if (isTeacher(id)) {
    const srcId = tagValue(vm.tags, TAG.VM_TPL_PREFIX);
    if (!srcId) return false;
    const srcTpl = templatesByVmid.get(Number(srcId));
    if (!srcTpl) return false;
    const tplClasses = tagValues(srcTpl.tags, TAG.TPL_CLASS_PREFIX);
    return tplClasses.some((c) => id.classes.includes(c));
  }
  return false;
}

export function canModifyVm(
  vm: VM,
  id: BridgeIdentity,
  templatesByVmid: Map<number, VM>
): boolean {
  if (isAdmin(id)) return true;
  if (isStudent(id)) {
    return tagValue(vm.tags, TAG.VM_OWNER_PREFIX) === id.oid;
  }
  if (isTeacher(id)) {
    return canSeeVm(vm, id, templatesByVmid);
  }
  return false;
}
