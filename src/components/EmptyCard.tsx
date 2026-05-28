import type { ReactNode } from "react";

// Empty-State-Karte (<div class="card empty">…</div>).
export function EmptyCard({ children }: { children: ReactNode }) {
  return <div className="card empty">{children}</div>;
}
