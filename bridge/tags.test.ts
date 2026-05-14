import { describe, it, expect } from "vitest";
import { TAG, tagValue, tagValues, hasTag } from "./tags";

describe("tags", () => {
  describe("TAG-Schema", () => {
    it("nutzt '-'-Separatoren, kein ':' (Proxmox VE 8 erlaubt nur [a-z0-9_-])", () => {
      for (const v of Object.values(TAG)) {
        expect(v).not.toContain(":");
        expect(v).toMatch(/^[a-z0-9_-]+$/);
      }
    });

    it("hat die erwarteten Marker + Prefixe", () => {
      expect(TAG.VM_MARKER).toBe("pttool");
      expect(TAG.TPL_MARKER).toBe("pttool-tpl");
      expect(TAG.TPL_PUBLIC).toBe("tpl-public");
      expect(TAG.TPL_CLASS_PREFIX).toBe("tpl-class-");
      expect(TAG.TPL_OWNER_PREFIX).toBe("tpl-owner-");
      expect(TAG.VM_OWNER_PREFIX).toBe("vm-owner-");
      expect(TAG.VM_TPL_PREFIX).toBe("vm-tpl-");
    });
  });

  describe("tagValue", () => {
    it("liefert den Wert nach dem Prefix", () => {
      expect(tagValue(["vm-owner-abc"], TAG.VM_OWNER_PREFIX)).toBe("abc");
    });

    it("liefert undefined, wenn kein Tag das Prefix hat", () => {
      expect(tagValue(["pttool"], TAG.VM_OWNER_PREFIX)).toBeUndefined();
      expect(tagValue([], TAG.VM_OWNER_PREFIX)).toBeUndefined();
    });

    it("liefert den ERSTEN Treffer bei mehreren passenden Tags", () => {
      expect(tagValue(["vm-owner-a", "vm-owner-b"], TAG.VM_OWNER_PREFIX)).toBe("a");
    });

    it("erlaubt einen leeren Wert (Prefix ohne Rest)", () => {
      expect(tagValue(["vm-owner-"], TAG.VM_OWNER_PREFIX)).toBe("");
    });
  });

  describe("tagValues", () => {
    it("liefert alle Werte mit dem Prefix (m:n-Klassenzuweisung)", () => {
      expect(
        tagValues(["tpl-class-a", "tpl-class-b", "pttool-tpl"], TAG.TPL_CLASS_PREFIX)
      ).toEqual(["a", "b"]);
    });

    it("liefert [] wenn keiner passt", () => {
      expect(tagValues(["pttool"], TAG.TPL_CLASS_PREFIX)).toEqual([]);
    });
  });

  describe("hasTag", () => {
    it("erkennt exakte Tags", () => {
      expect(hasTag(["pttool", "tpl-public"], TAG.TPL_PUBLIC)).toBe(true);
      expect(hasTag(["pttool"], TAG.TPL_PUBLIC)).toBe(false);
    });

    it("matcht nicht auf Teil-Strings/Prefixe", () => {
      expect(hasTag(["tpl-public-extra"], TAG.TPL_PUBLIC)).toBe(false);
    });
  });
});
