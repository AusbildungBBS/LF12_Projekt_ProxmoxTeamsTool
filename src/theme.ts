// Theme-Controller: bestimmt Hell/Dunkel und setzt data-theme auf <html>.
// Eine Quelle gewinnt:
//   - In Teams: das Teams-Theme (default/dark/contrast), live über den
//     Theme-Change-Handler. „contrast" wird wie „dark" behandelt.
//   - Standalone (Browser): die OS-Präferenz (prefers-color-scheme), live.
// Bewusst ohne manuellen Umschalter — die App folgt automatisch.
import { app } from "@microsoft/teams-js";

type Mode = "light" | "dark";

function setMode(mode: Mode): void {
  document.documentElement.dataset.theme = mode;
}

// Teams: default -> hell; dark/contrast -> dunkel.
function modeFromTeamsTheme(theme: string | undefined): Mode {
  return theme === "dark" || theme === "contrast" ? "dark" : "light";
}

export async function initTheme(): Promise<void> {
  // Browser-Default: OS-Präferenz, live. Der synchrone Teil unten setzt das
  // Theme sofort (kein Aufblitzen vor dem ersten Render).
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const applyOs = () => setMode(mq.matches ? "dark" : "light");
  applyOs();
  mq.addEventListener("change", applyOs);

  // In Teams gewinnt das Teams-Theme und reagiert live auf Umschalten.
  try {
    await app.initialize();
    const ctx = await app.getContext();
    if (ctx) {
      mq.removeEventListener("change", applyOs); // ab jetzt steuert Teams
      setMode(modeFromTeamsTheme(ctx.app?.theme));
      app.registerOnThemeChangeHandler((theme) =>
        setMode(modeFromTeamsTheme(theme))
      );
    }
  } catch {
    // Nicht in Teams -> der OS-Listener bleibt aktiv.
  }
}
