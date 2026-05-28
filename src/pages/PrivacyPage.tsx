import { Link } from "react-router-dom";

// Platzhalter-Seite für die im Teams-Manifest referenzierte privacyUrl
// (/privacy). Kein rechtsverbindlicher Text — bewusst locker gehalten.
export function PrivacyPage() {
  return (
    <section className="page">
      <header className="page-header">
        <h2>Datenschutz</h2>
        <p className="page-subtitle">
          Platzhalter eines Schulprojekts — kein rechtsverbindlicher Text.
        </p>
      </header>
      <div className="card">
        <p>
          Dieses Tool ist ein Ausbildungsprojekt (LF12). Wir sammeln keine Daten,
          die für die Anmeldung und VM-Zuordnung nicht benötigt werden.
        </p>
        <p>
          Deine Microsoft-Anmeldung nutzen wir ausschließlich, um dir deine VMs
          und Vorlagen zu zeigen. Es gibt keine Tracking-Pixel, keine
          Werbe-Cookies und keinen Datenverkauf.
        </p>
        <p>
          <Link to="/">← Zurück zur Übersicht</Link>
        </p>
      </div>
    </section>
  );
}
