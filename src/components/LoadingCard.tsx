// Schlichte Lade-Karte (<div class="card">Lade ...</div>).
export function LoadingCard({ label }: { label: string }) {
  return <div className="card">{label}</div>;
}
