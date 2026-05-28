// Bytes -> ganze Megabyte (0 bei undefined).
export function bytesToMb(bytes?: number): number {
  return bytes ? Math.round(bytes / 1024 / 1024) : 0;
}

// Gekuerzte OID-Darstellung (erste 8 Zeichen) bzw. "—" wenn leer.
export function shortOid(oid?: string | null): string {
  return oid ? oid.slice(0, 8) : "—";
}
