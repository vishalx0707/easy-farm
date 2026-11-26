const { createServer } = require("node:http");
const { createReadStream } = require("node:fs");
const { stat } = require("node:fs/promises");
const { extname, resolve, sep } = require("node:path");
const marketplaceApi = require("./marketplace-api");

const root = __dirname;
const host = "127.0.0.1";
const port = Number(process.env.EASYFARM_PORT || 3000);
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2"
};

const server = createServer(async (request, response) => {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (pathname.startsWith("/api/")) return marketplaceApi(request, response, pathname);
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const page = pathname === "/" ? "/index.html" : pathname === "/film-script" ? "/film-script.html" : pathname;
  const file = resolve(root, "." + page);
  const type = types[extname(file)];
  if (!file.startsWith(root + sep) || !type ||
      !["/index.html", "/film-script.html", "/app.html", "/app.js", "/app.css", "/landing.js", "/landing.css", "/EasyFarm Footage.html", "/Antigravity Footage.html"].includes(page) &&
      !pathname.startsWith("/assets/") && !pathname.startsWith("/hero-footage/")) {
    response.writeHead(404).end();
    return;
  }
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) {
    response.writeHead(404).end();
    return;
  }

  const headers = { "Content-Type": type, "Cache-Control": "no-cache", "Accept-Ranges": "bytes" };
  let start = 0;
  let end = info.size - 1;
  let status = 200;
  if (request.headers.range) {
    const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range);
    if (range && (range[1] || range[2])) {
      start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
      end = range[1] && range[2] ? Math.min(end, Number(range[2])) : end;
    }
    if (!range || (!range[1] && !range[2]) || start > end) {
      response.writeHead(416, { "Content-Range": "bytes */" + info.size }).end();
      return;
    }
    status = 206;
    headers["Content-Range"] = `bytes ${start}-${end}/${info.size}`;
  }
  headers["Content-Length"] = end - start + 1;
  response.writeHead(status, headers);
  if (request.method === "HEAD" || !info.size) {
    response.end();
    return;
  }
  const stream = createReadStream(file, { start, end });
  stream.on("error", () => response.destroy());
  response.on("close", () => stream.destroy());
  stream.pipe(response);
});

server.listen(port, host, () => console.log(`EasyFarm running at http://${host}:${port}`));
