import { defineConfig } from "vite";
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 5173,
    watch: {
      ignored: [
        "**/tmp/**",
        "**/android/**",
        "**/server/private/**",
        "**/output/**",
      ],
    },
    fs: { deny: [".env", ".env.*", "**/server/private/**", "**/tmp/**"] },
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8787",
        changeOrigin: false,
        xfwd: true,
      },
    },
  },
});
