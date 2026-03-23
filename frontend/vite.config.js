import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const port = parseInt(env.VITE_PORT || "5000", 10);
  const host = env.VITE_HOST || "0.0.0.0";

  return {
    plugins: [react()],
    server: {
      host: host,
      port: port,
      allowedHosts: true,
      proxy: {
        "/api": {
          target: env.VITE_API_URL || "http://localhost:8000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ""),
        },
      },
    },
  };
});
