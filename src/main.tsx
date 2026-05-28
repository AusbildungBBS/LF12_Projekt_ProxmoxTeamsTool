import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { initTheme } from "./theme";

// Theme (Hell/Dunkel) früh setzen — folgt dem Teams-Theme bzw. der OS-Präferenz.
void initTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
