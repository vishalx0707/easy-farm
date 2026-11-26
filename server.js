const { createServer } = require("node:http");
const { createReadStream } = require("node:fs");
const { stat } = require("node:fs/promises");
const { extname, resolve, sep } = require("node:path");
const marketplaceApi = require("./marketplace-api");

const projectRoot = __dirname;
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
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml"
};

function createAppServer(api = marketplaceApi, { staticRoot = resolve(projectRoot,'dist') } = {}) { const root=staticRoot; return createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options','nosniff');
  response.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  response.setHeader('Content-Security-Policy',"frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
  } catch {
    response.writeHead(400).end();
    return;
  }
  if (pathname.startsWith("/api/")) return api(request, response, pathname);
  if (!["GET", "HEAD"].includes(request.method)) {
    response.writeHead(405, { Allow: "GET, HEAD" }).end();
    return;
  }
  const page = pathname === "/" ? "/index.html" : pathname === "/film-script" ? "/film-script.html" : pathname === '/login' ? '/login.html' : pathname === '/onboarding' ? '/onboarding.html' : ['/buyer','/grower'].includes(pathname) ? '/app.html' : pathname;
  const file = resolve(root, "." + page);
  const type = types[extname(file)];
  if (!file.startsWith(root + sep) || !type ||
      !["/index.html", "/film-script.html", "/app.html", "/login.html", "/onboarding.html", "/landing.js", "/landing.css"].includes(page) &&
      !pathname.startsWith("/assets/") && !pathname.startsWith("/hero-footage/")) {
    response.writeHead(404).end();
    return;
  }
  const info = await stat(file).catch(() => null);
  if (!info?.isFile()) {
    response.writeHead(404).end();
    return;
  }

  const headers = { "Content-Type": type, "Cache-Control": /\/assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(js|css|woff2)$/.test(page) ? "public, max-age=31536000, immutable" : "no-cache", "Accept-Ranges": "bytes" };
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
  const gzip=status===200&&/\b(gzip)\b/.test(request.headers["accept-encoding"]||"")&&[".js",".css",".svg",".html"].includes(extname(file));
  if(gzip){headers["Content-Encoding"]="gzip";headers.Vary="Accept-Encoding";}else headers["Content-Length"] = end - start + 1;
  response.writeHead(status, headers);
  if (request.method === "HEAD" || !info.size) {
    response.end();
    return;
  }
  const stream = createReadStream(file, { start, end });
  stream.on("error", () => response.destroy());
  response.on("close", () => stream.destroy());
  if(gzip){const compressor=require("node:zlib").createGzip();compressor.on("error",()=>response.destroy());stream.pipe(compressor).pipe(response);}else stream.pipe(response);
}); }

if(require.main===module)createAppServer().listen(port,host,()=>console.log(`EasyFarm running at http://${host}:${port}`));
module.exports={createAppServer};
