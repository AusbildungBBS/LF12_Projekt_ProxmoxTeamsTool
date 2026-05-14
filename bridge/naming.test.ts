import { describe, it, expect } from "vitest";
import { buildVmName } from "./naming";

describe("buildVmName", () => {
  it("baut <localpart>-tpl<templateId>-<vmid>", () => {
    expect(buildVmName("alice.meier@school.de", 9000, 142)).toBe(
      "alice-meier-tpl9000-142"
    );
  });

  it("ersetzt Zeichen ausserhalb [a-z0-9-] durch '-'", () => {
    expect(buildVmName("j_smith@contoso.com", 100, 105)).toBe("j-smith-tpl100-105");
    expect(buildVmName("a+b@x", 1, 2)).toBe("a-b-tpl1-2");
  });

  it("lowercased alles", () => {
    expect(buildVmName("Bob.X@Foo", 1, 2)).toBe("bob-x-tpl1-2");
  });

  it("nutzt nur den localpart vor dem @", () => {
    expect(buildVmName("user@really.long.domain.example.com", 7, 8)).toBe(
      "user-tpl7-8"
    );
  });

  it("kuerzt hart auf 60 Zeichen", () => {
    const longLocal = "a".repeat(80);
    const name = buildVmName(`${longLocal}@x.de`, 1, 1);
    expect(name.length).toBe(60);
    expect(name.startsWith("aaaa")).toBe(true);
  });

  it("erzeugt nur DNS-taugliche Zeichen [a-z0-9-]", () => {
    const name = buildVmName("Wéird.Näme!@x", 12, 34);
    expect(name).toMatch(/^[a-z0-9-]+$/);
  });
});
