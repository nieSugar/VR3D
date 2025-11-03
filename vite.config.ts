import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import mkcert from "vite-plugin-mkcert";

// https://vite.dev/config/
export default defineConfig({
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
});
