import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "hyperCare",
        short_name: "hyperCare",
        description: "A blood pressure companion for safer home monitoring.",
        theme_color: "#0f766e",
        background_color: "#f8fafc",
        display: "standalone",
        icons: [
          { src: "/pwa.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      }
    })
  ],
  server: {
    port: 5173
  }
});
