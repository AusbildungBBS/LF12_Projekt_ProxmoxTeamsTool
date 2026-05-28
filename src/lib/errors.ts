// Einheitliches Stringify für unbekannte Fehler: Error -> message, sonst String().
export function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
