// Einheitliches Status-Badge — rendert <span class="badge badge-<status>">.
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{status}</span>;
}
