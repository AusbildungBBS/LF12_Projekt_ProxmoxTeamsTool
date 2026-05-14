import { defineConfig } from "vitest/config";

// Eigene Config (erbt NICHT vite.config.ts), damit die Bridge-Tests in einer
// reinen Node-Umgebung ohne das React-Frontend-Setup laufen.
export default defineConfig({
  test: {
    include: ["bridge/**/*.test.ts"],
    environment: "node",
  },
});
