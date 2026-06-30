import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base: "./" → relative asset paths. This is what lets the same build work both
// on a GitHub Pages project URL (https://user.github.io/repo/) and when HubSpot
// loads it inside the iframe modal with a long ?d= query string appended.
export default defineConfig({
  base: "./",
  plugins: [react()],
});