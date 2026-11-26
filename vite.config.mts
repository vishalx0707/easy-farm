import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const projectDirectory = fileURLToPath(new URL(".", import.meta.url));
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: "easyfarm-portal-routes",
      configureServer(server) {
        server.middlewares.use((request, _response, next) => {
          if (request.url)
            request.url = request.url.replace(
              /^\/(buyer|grower|login|onboarding)(?=\?|$)/,
              "/app.html",
            );
          next();
        });
      },
    },
  ],
  publicDir: false,
  resolve: {
    alias: {
      "@": resolve(projectDirectory, "src"),
      ...(mode === "fixtures"
        ? {
            "@clerk/react": resolve(
              projectDirectory,
              "tools/react-auth-fixture.tsx",
            ),
          }
        : {}),
    },
  },
  build: {
    outDir: mode === "fixtures" ? ".easyfarm-react-test/dist" : "dist",
    emptyOutDir: true,
    rolldownOptions: {
      input: {
        app: resolve(projectDirectory, "app.html"),
        login: resolve(projectDirectory, "login.html"),
        onboarding: resolve(projectDirectory, "onboarding.html"),
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
}));
