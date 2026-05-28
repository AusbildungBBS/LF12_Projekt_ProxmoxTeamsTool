// Single Source of Truth für die Proxmox-App-Role-Claims — vermeidet die roh
// verstreuten "Proxmox.Admin"/"Proxmox.Teacher"/"Proxmox.Student"-Literale.
export const ROLES = {
  ADMIN: "Proxmox.Admin",
  TEACHER: "Proxmox.Teacher",
  STUDENT: "Proxmox.Student",
} as const;

export type RoleClaim = (typeof ROLES)[keyof typeof ROLES];

export const ALL_ROLE_CLAIMS: RoleClaim[] = [
  ROLES.ADMIN,
  ROLES.TEACHER,
  ROLES.STUDENT,
];

// Eine impersonierbare Rolle ist genau einer der Role-Claims.
export type ImpersonatedRole = RoleClaim;

export function isImpersonatedRole(v: unknown): v is ImpersonatedRole {
  return typeof v === "string" && (ALL_ROLE_CLAIMS as string[]).includes(v);
}
