import { defineConfig, type HtmlTagDescriptor, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const projectDirectory = fileURLToPath(new URL(".", import.meta.url));
function preloadMontrealFonts(): Plugin {
  return {
    name: "preload-montreal-fonts",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (!ctx.bundle) return html;
        const fontFiles = Object.keys(ctx.bundle)
          .filter((fileName) =>
            /^assets\/Montreal-(?:400|500)-[^/]+\.woff$/i.test(fileName),
          )
          .sort();
        if (!fontFiles.length) return html;
        const tags: HtmlTagDescriptor[] = fontFiles.map((fileName) => ({
          tag: "link",
          attrs: {
            rel: "preload",
            href: `/${fileName}`,
            as: "font",
            type: "font/woff",
            crossorigin: true,
          },
          injectTo: "head",
        }));
        return { html, tags };
      },
    },
  };
}
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    preloadMontrealFonts(),
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
      output: {
        codeSplitting: {
          includeDependenciesRecursively: false,
          groups: [
            {
              name: "react-vendor",
              priority: 30,
              test: /[\\/]node_modules[\\/](?:react|react-dom|scheduler|react-router|react-router-dom)[\\/]/,
            },
            {
              name: "query",
              priority: 20,
              test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
            },
            {
              name: "clerk",
              priority: 10,
              test: /[\\/]node_modules[\\/]@clerk[\\/](?:react|shared)[\\/]/,
            },
          ],
        },
      },
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: { "/api": "http://127.0.0.1:3000" },
  },
}));
