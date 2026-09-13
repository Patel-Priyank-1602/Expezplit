import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy API requests to the API Gateway during local dev
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
      // Proxy SSE requests to the SSE Gateway during local dev
      "/events": {
        target: "http://localhost:4001",
        changeOrigin: true,
      },
    },
  },
});
