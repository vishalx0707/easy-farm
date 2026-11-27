const fs = require("fs");
const path = require("path");

// Vite compiles the React app; only referenced marketing/runtime media files are copied.
const fixtures = process.argv.includes("--fixtures");
const dist = path.resolve(
  __dirname,
  fixtures ? "../.easyfarm-react-test/dist" : "../dist",
);
const vite = path.join(
  path.dirname(require.resolve("vite/package.json")),
  "bin/vite.js",
);
const result = require("node:child_process").spawnSync(
  process.execPath,
  [vite, "build", ...(fixtures ? ["--mode", "fixtures"] : [])],
  { stdio: "inherit" },
);
if (result.status !== 0) process.exit(result.status || 1);

for (const name of [
  "index.html",
  "landing.css",
  "landing.js",
  "film-script.html",
]) {
  fs.copyFileSync(name, path.join(dist, name));
}

const distAssetsDir = path.join(dist, "assets");
const cssBundleText = fs.existsSync(distAssetsDir)
  ? fs
      .readdirSync(distAssetsDir)
      .filter((entry) => entry.endsWith(".css"))
      .map((entry) => fs.readFileSync(path.join(distAssetsDir, entry), "utf8"))
      .join("\n")
  : "";

const keptDirs = new Set([
  "assets",
  "assets/produce",
  "assets/auth",
  "assets/hero",
  "assets/posters",
  "hero-footage",
  "hero-footage/fresh-produce",
]);

const keptFiles = new Set([
  "assets/Montreal-400.woff",
  "assets/Montreal-500.woff",
  "assets/Geist.woff2",
  "assets/film-script.css",
  "assets/tomatoes-still-life.webp",
  "assets/potatoes-still-life.webp",
  "assets/produce-photo-placeholder.svg",
  "assets/hero/easyfarm-film-compact.mp4",
  "assets/hero/easyfarm-film-desktop.mp4",
  "assets/hero/easyfarm-film-poster.webp",
  "assets/posters/02-farmer-golden-field-4k.jpg",
  "assets/posters/03-tomato-harvest-4k.jpg",
  "assets/posters/05-warehouse-qr-scanning-4k.jpg",
  "hero-footage/fresh-produce/poster-10787015.jpg",
  "hero-footage/fresh-produce/poster-5479114.jpg",
]);

for (const svg of ["easyfarm-leaf-pattern.svg", "field-contours.svg"]) {
  if (cssBundleText.includes(svg)) {
    keptFiles.add(`assets/${svg}`);
  }
}

for (const name of ["assets", "hero-footage"]) {
  fs.cpSync(name, path.join(dist, name), {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(".", source).replaceAll("\\", "/");
      if (keptDirs.has(relative)) return true;
      if (
        relative.startsWith("assets/produce/") ||
        relative.startsWith("assets/auth/")
      ) {
        return true;
      }
      return keptFiles.has(relative);
    },
  });
}

console.log(
  "Built browser assets in dist; original source footage retained locally.",
);
