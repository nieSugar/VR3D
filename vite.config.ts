import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import mkcert from "vite-plugin-mkcert";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  plugins: [
    vue(),
    mkcert({
      hosts: ["localhost", "127.0.0.1", "192.168.12.72"],
    }),
  ],
  server: {
    port: 3500,
    host: "0.0.0.0",
  },
  assetsInclude: ["**/*.hdr"],
});
