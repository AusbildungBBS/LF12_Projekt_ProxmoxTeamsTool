import { readFileSync } from "node:fs";

// Liest einen Config-Wert aus der Environment-Variable <name> ODER, falls
// <name>_FILE gesetzt ist, aus der referenzierten Datei (Docker-/Compose-
// Secrets werden als Dateien unter /run/secrets/<name> gemountet). So
// funktionieren Environment-Variablen UND Secrets gleichermassen — die
// direkte Env-Var hat Vorrang, sonst greift die Datei.
export function envOrFile(name: string): string | undefined {
  const direct = process.env[name];
  if (direct !== undefined && direct !== "") return direct;

  const file = process.env[`${name}_FILE`];
  if (file) {
    try {
      const value = readFileSync(file, "utf8").trim();
      if (value) return value;
    } catch (e) {
      console.error(
        `[bridge] ${name}_FILE gesetzt (${file}), aber nicht lesbar:`,
        e instanceof Error ? e.message : e
      );
    }
  }
  return undefined;
}
