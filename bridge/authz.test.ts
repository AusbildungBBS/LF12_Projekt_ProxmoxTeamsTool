import { describe, it, expect } from "vitest";
import type { VM } from "./proxmox";
import {
  type AppRole,
  type BridgeIdentity,
  filterAppRoles,
  mapEduRoleToAppRoles,
  isAdmin,
  isTeacher,
  isStudent,
  applyImpersonation,
  canSeeTemplate,
  canSeeVm,
  canModifyVm,
} from "./authz";

// ── Fixtures ───────────────────────────────────────────────────────────────────

function identity(
  roles: AppRole[],
  opts: Partial<BridgeIdentity> = {}
): BridgeIdentity {
  return {
    oid: opts.oid ?? "user-self",
    name: opts.name ?? "Test User",
    email: opts.email ?? "test@example.com",
    roles,
    classes: opts.classes ?? [],
    source: opts.source ?? "standard",
  };
}

function vm(tags: string[], opts: Partial<VM> = {}): VM {
  return {
    node: opts.node ?? "pve",
    vmid: opts.vmid ?? 100,
    name: opts.name ?? "vm",
    status: opts.status ?? "stopped",
    template: opts.template ?? false,
    tags,
  };
}

const ADMIN = identity(["Proxmox.Admin"]);
const NO_ROLE = identity([]);

// ── Role helpers ─────────────────────────────────────────────────────────────

describe("filterAppRoles", () => {
  it("liefert [] für undefined", () => {
    expect(filterAppRoles(undefined)).toEqual([]);
  });

  it("behält nur bekannte Proxmox-Rollen, verwirft Fremdes", () => {
    expect(
      filterAppRoles(["Proxmox.Admin", "Directory.Read", "Proxmox.Student", "junk"])
    ).toEqual(["Proxmox.Admin", "Proxmox.Student"]);
  });

  it("liefert [] wenn keine Proxmox-Rolle dabei ist (org-fremd / unprovisioniert)", () => {
    expect(filterAppRoles(["SomeOther.Role"])).toEqual([]);
  });
});

describe("mapEduRoleToAppRoles", () => {
  it("mappt teacher + faculty auf Teacher", () => {
    expect(mapEduRoleToAppRoles("teacher")).toEqual(["Proxmox.Teacher"]);
    expect(mapEduRoleToAppRoles("faculty")).toEqual(["Proxmox.Teacher"]);
  });

  it("mappt student auf Student", () => {
    expect(mapEduRoleToAppRoles("student")).toEqual(["Proxmox.Student"]);
  });

  it("liefert [] für unbekannt/undefined (Admin kommt nie aus EDU)", () => {
    expect(mapEduRoleToAppRoles(undefined)).toEqual([]);
    expect(mapEduRoleToAppRoles("admin")).toEqual([]);
    expect(mapEduRoleToAppRoles("principal")).toEqual([]);
  });
});

describe("isAdmin/isTeacher/isStudent", () => {
  it("erkennt die jeweilige Rolle", () => {
    expect(isAdmin(ADMIN)).toBe(true);
    expect(isTeacher(identity(["Proxmox.Teacher"]))).toBe(true);
    expect(isStudent(identity(["Proxmox.Student"]))).toBe(true);
  });

  it("ist false ohne die Rolle", () => {
    expect(isAdmin(identity(["Proxmox.Teacher"]))).toBe(false);
    expect(isStudent(NO_ROLE)).toBe(false);
  });
});

// ── Impersonation (Dev) ────────────────────────────────────────────────────────

describe("applyImpersonation", () => {
  it("in prod NIE impersoniert, auch nicht als Admin", () => {
    expect(applyImpersonation(ADMIN, "Proxmox.Student", true)).toBe(ADMIN);
  });

  it("ohne wantedRole bleibt die echte Identity", () => {
    expect(applyImpersonation(ADMIN, undefined, false)).toBe(ADMIN);
  });

  it("nur ein echter Admin darf impersonieren", () => {
    const teacher = identity(["Proxmox.Teacher"]);
    expect(applyImpersonation(teacher, "Proxmox.Student", false)).toBe(teacher);
  });

  it("Admin setzt eine gültige Rolle auf (ersetzt die Rollen-Liste)", () => {
    const res = applyImpersonation(ADMIN, "Proxmox.Teacher", false);
    expect(res.roles).toEqual(["Proxmox.Teacher"]);
  });

  it("ignoriert eine ungültige Wunschrolle", () => {
    expect(applyImpersonation(ADMIN, "Proxmox.SuperUser", false)).toBe(ADMIN);
  });

  it("mutiert die Original-Identity nicht", () => {
    const res = applyImpersonation(ADMIN, "Proxmox.Student", false);
    expect(ADMIN.roles).toEqual(["Proxmox.Admin"]);
    expect(res).not.toBe(ADMIN);
  });
});

// ── canSeeTemplate ───────────────────────────────────────────────────────────

describe("canSeeTemplate", () => {
  const ownTpl = vm(["pttool-tpl", "tpl-owner-teacher-1"], { template: true });
  const foreignPrivate = vm(["pttool-tpl", "tpl-owner-other"], { template: true });
  const foreignPublic = vm(["pttool-tpl", "tpl-owner-other", "tpl-public"], { template: true });
  const unclaimed = vm(["pttool-tpl"], { template: true });
  const classTpl = vm(["pttool-tpl", "tpl-owner-other", "tpl-class-math"], { template: true });

  it("Admin sieht jedes Template", () => {
    expect(canSeeTemplate(foreignPrivate, ADMIN)).toBe(true);
    expect(canSeeTemplate(unclaimed, ADMIN)).toBe(true);
  });

  it("ohne Rolle: nichts sichtbar", () => {
    expect(canSeeTemplate(unclaimed, NO_ROLE)).toBe(false);
    expect(canSeeTemplate(foreignPublic, NO_ROLE)).toBe(false);
  });

  describe("Lehrer", () => {
    const teacher = identity(["Proxmox.Teacher"], { oid: "teacher-1", classes: ["math"] });

    it("sieht ungeclaimte Templates (zum Claimen)", () => {
      expect(canSeeTemplate(unclaimed, teacher)).toBe(true);
    });
    it("sieht eigene Templates", () => {
      expect(canSeeTemplate(ownTpl, teacher)).toBe(true);
    });
    it("sieht öffentliche fremde Templates", () => {
      expect(canSeeTemplate(foreignPublic, teacher)).toBe(true);
    });
    it("sieht fremde Templates, die einer seiner Klassen zugewiesen sind", () => {
      expect(canSeeTemplate(classTpl, teacher)).toBe(true);
    });
    it("sieht KEIN fremdes, privates Template ohne Klassen-Bezug", () => {
      expect(canSeeTemplate(foreignPrivate, teacher)).toBe(false);
    });
    it("sieht ein klassengebundenes Template NICHT, wenn er nicht in der Klasse ist", () => {
      const other = identity(["Proxmox.Teacher"], { oid: "teacher-1", classes: ["physics"] });
      expect(canSeeTemplate(classTpl, other)).toBe(false);
    });
  });

  describe("Schüler", () => {
    it("sieht nur Templates seiner Klasse(n)", () => {
      const student = identity(["Proxmox.Student"], { classes: ["math"] });
      expect(canSeeTemplate(classTpl, student)).toBe(true);
    });
    it("sieht weder ungeclaimte noch public Templates außerhalb seiner Klasse", () => {
      const student = identity(["Proxmox.Student"], { classes: ["math"] });
      expect(canSeeTemplate(unclaimed, student)).toBe(false);
      expect(canSeeTemplate(foreignPublic, student)).toBe(false);
    });
    it("sieht nichts, wenn er in keiner passenden Klasse ist", () => {
      const student = identity(["Proxmox.Student"], { classes: ["physics"] });
      expect(canSeeTemplate(classTpl, student)).toBe(false);
    });
  });
});

// ── canSeeVm / canModifyVm ─────────────────────────────────────────────────────

describe("canSeeVm / canModifyVm", () => {
  // Quell-Template 9000 ist Klasse "math" zugewiesen.
  const srcTpl = vm(["pttool-tpl", "tpl-class-math"], { vmid: 9000, template: true });
  const templates = new Map<number, VM>([[9000, srcTpl]]);

  const myVm = vm(["pttool", "vm-owner-student-1", "vm-tpl-9000"], { vmid: 101 });
  const otherStudentsVm = vm(["pttool", "vm-owner-student-2", "vm-tpl-9000"], { vmid: 102 });
  const vmNoSource = vm(["pttool", "vm-owner-student-1"], { vmid: 103 });

  describe("Admin", () => {
    it("sieht und ändert jede VM", () => {
      expect(canSeeVm(otherStudentsVm, ADMIN, templates)).toBe(true);
      expect(canModifyVm(otherStudentsVm, ADMIN, templates)).toBe(true);
    });
  });

  describe("Schüler", () => {
    const student = identity(["Proxmox.Student"], { oid: "student-1", classes: ["math"] });

    it("sieht/ändert nur die eigene VM (owner == self)", () => {
      expect(canSeeVm(myVm, student, templates)).toBe(true);
      expect(canModifyVm(myVm, student, templates)).toBe(true);
    });

    it("kann die VM eines ANDEREN Schülers nicht sehen/ändern", () => {
      expect(canSeeVm(otherStudentsVm, student, templates)).toBe(false);
      expect(canModifyVm(otherStudentsVm, student, templates)).toBe(false);
    });
  });

  describe("Lehrer", () => {
    const teacher = identity(["Proxmox.Teacher"], { oid: "teacher-1", classes: ["math"] });

    it("sieht/ändert VMs, deren Quell-Template in seiner Klasse ist", () => {
      expect(canSeeVm(myVm, teacher, templates)).toBe(true);
      expect(canModifyVm(otherStudentsVm, teacher, templates)).toBe(true);
    });

    it("sieht KEINE VM, deren Quell-Template nicht in seiner Klasse ist", () => {
      const otherTeacher = identity(["Proxmox.Teacher"], { oid: "t2", classes: ["physics"] });
      expect(canSeeVm(myVm, otherTeacher, templates)).toBe(false);
    });

    it("sieht KEINE VM ohne vm-tpl-Tag", () => {
      expect(canSeeVm(vmNoSource, teacher, templates)).toBe(false);
    });

    it("sieht KEINE VM, deren Quell-Template nicht (mehr) existiert", () => {
      expect(canSeeVm(myVm, teacher, new Map())).toBe(false);
    });
  });

  describe("ohne Rolle", () => {
    it("sieht/ändert nichts", () => {
      expect(canSeeVm(myVm, NO_ROLE, templates)).toBe(false);
      expect(canModifyVm(myVm, NO_ROLE, templates)).toBe(false);
    });
  });
});
