import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Important: Allow access from outside (0.0.0.0)
    port: 5173, // Make sure it runs on port 3000
    strictPort: true, // Don't change port automatically
    allowedHosts: [
      "smartprice.workstation.work.gd",
      "smartprice-api.workstation.work.gd",
      ".workstation.work.gd", // Allows all subdomains under workstation.work.gd
      "localhost",
      "127.0.0.1",
    ],
    proxy: {
      "/api": {
        target: "http://localhost:4000", // ← Your backend port (you said 4000 here)
        changeOrigin: true,
        secure: false,
      },
    },
  },
});
