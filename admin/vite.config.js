import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" → le back-office peut être servi depuis n'importe quel
// sous-dossier (ex. https://votre-site.re/admin/) sans casser les chemins.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { outDir: "dist" },
});
