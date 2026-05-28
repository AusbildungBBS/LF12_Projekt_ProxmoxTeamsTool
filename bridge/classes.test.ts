import { describe, it, expect, beforeEach } from "vitest";
import type { ProxmoxClient, VM } from "./proxmox";
import {
  getActiveClassOids,
  filterToActiveClasses,
  clearActiveClassCache,
} from "./classes";

function vmWithTags(tags: string[]): VM {
  return { node: "pve", vmid: 1, name: "x", status: "stopped", template: false, tags };
}

// Minimaler Fake — classes.ts nutzt nur listVMs(). Zählt die Aufrufe, um das
// Caching zu prüfen.
function fakeClient(vms: VM[]) {
  let calls = 0;
  const client = {
    listVMs: async () => {
      calls++;
      return vms;
    },
  } as unknown as ProxmoxClient;
  return { client, getCalls: () => calls };
}

describe("classes", () => {
  beforeEach(() => {
    clearActiveClassCache();
  });

  describe("ohne Proxmox-Client (Dev-Fallback)", () => {
    it("getActiveClassOids liefert null (= kein Filter)", async () => {
      expect(await getActiveClassOids(null)).toBeNull();
    });

    it("filterToActiveClasses lässt alle Kandidaten durch", async () => {
      expect(await filterToActiveClasses(null, ["a", "b"])).toEqual(["a", "b"]);
    });
  });

  describe("mit Proxmox-Client", () => {
    it("sammelt die OIDs aus tpl-class-Tags über alle VMs", async () => {
      const { client } = fakeClient([
        vmWithTags(["pttool-tpl", "tpl-class-math", "tpl-class-physics"]),
        vmWithTags(["pttool-tpl", "tpl-class-math"]),
        vmWithTags(["pttool"]),
      ]);
      const oids = await getActiveClassOids(client);
      expect(oids).not.toBeNull();
      expect([...oids!].sort()).toEqual(["math", "physics"]);
    });

    it("filtert Kandidaten auf aktive Klassen (Whitelist)", async () => {
      const { client } = fakeClient([vmWithTags(["tpl-class-math"])]);
      // 'all-company' ist eine M365-Group ohne tpl-class-Tag -> fällt raus.
      expect(await filterToActiveClasses(client, ["math", "all-company"])).toEqual([
        "math",
      ]);
    });

    it("liefert [] wenn kein Kandidat aktiv ist", async () => {
      const { client } = fakeClient([vmWithTags(["tpl-class-math"])]);
      expect(await filterToActiveClasses(client, ["sales"])).toEqual([]);
    });

    it("ignoriert leere tpl-class-Werte", async () => {
      const { client } = fakeClient([vmWithTags(["tpl-class-", "tpl-class-math"])]);
      const oids = await getActiveClassOids(client);
      expect([...oids!]).toEqual(["math"]);
    });

    it("cached: zweiter Aufruf trifft Proxmox nicht erneut", async () => {
      const { client, getCalls } = fakeClient([vmWithTags(["tpl-class-math"])]);
      await getActiveClassOids(client);
      await getActiveClassOids(client);
      expect(getCalls()).toBe(1);
    });

    it("nach clearActiveClassCache wird Proxmox erneut befragt", async () => {
      const { client, getCalls } = fakeClient([vmWithTags(["tpl-class-math"])]);
      await getActiveClassOids(client);
      clearActiveClassCache();
      await getActiveClassOids(client);
      expect(getCalls()).toBe(2);
    });
  });
});
