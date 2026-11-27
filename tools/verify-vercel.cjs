const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { createReadStream } = require("node:fs");
const { stat } = require("node:fs/promises");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { generateKeyPairSync, sign, randomUUID } = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { chromium } = require("playwright");
const { PNG } = require("pngjs");
const decode = require("jsqr");
const { Miniflare, convertV4MiniflareOptions } = require("miniflare");
const domain = require("../marketplace-domain.cjs");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".svg": "image/svg+xml",
};

function walkFiles(dir, prefix = "") {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? prefix + "/" + entry.name : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkFiles(full, rel));
    } else {
      results.push({ rel, full });
    }
  }
  return results;
}

function verifyProductionDistAndConfig() {
  const distRoot = path.resolve("dist");
  assert(fs.existsSync(distRoot), "dist/ must exist before running verify-vercel");

  for (const required of [
    "index.html",
    "landing.css",
    "landing.js",
    "film-script.html",
    "app.html",
    "login.html",
    "onboarding.html",
    "assets/film-script.css",
    "assets/hero/easyfarm-film-compact.mp4",
    "assets/Geist.woff2",
    "assets/Montreal-400.woff",
    "assets/Montreal-500.woff",
    "assets/tomatoes-still-life.webp",
  ]) {
    assert(
      fs.existsSync(path.join(distRoot, required)),
      "Missing required production asset in dist/: " + required,
    );
  }

  const distFiles = walkFiles(distRoot);
  for (const forbidden of [
    "server.js",
    "worker.mjs",
    "auth.mjs",
    "origin.mjs",
    "marketplace-api.js",
    "marketplace-domain.cjs",
    "marketplace-service.mjs",
    ".dev.vars",
  ]) {
    assert(
      !distFiles.some((f) => f.rel === forbidden || f.rel.startsWith("src/") || f.rel.startsWith("api/")),
      "Private source or config leaked into dist/: " + forbidden,
    );
  }

  for (const f of distFiles) {
    if (!/\.(js|mjs|html|css)$/i.test(f.rel)) continue;
    const content = fs.readFileSync(f.full, "utf8");
    for (const marker of [
      "qa_clerk_token",
      "react-auth-fixture",
      "clerk-fixtures",
      "test-fixture.clerk.accounts.dev",
      "EASYFARM_PROXY_SECRET",
    ]) {
      assert(
        !content.includes(marker),
        `Production dist/${f.rel} must never contain ${marker}`,
      );
    }
  }

  const vercelConfig = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  assert.equal(vercelConfig.framework, null);
  assert.equal(vercelConfig.installCommand, "npm ci");
  assert.equal(vercelConfig.buildCommand, "npm run typecheck && npm run build");
  assert.equal(vercelConfig.outputDirectory, "dist");
  assert.equal(vercelConfig.trailingSlash, false);
  assert(vercelConfig.functions?.["api/marketplace.mjs"]?.maxDuration >= 10);

  const rewrites = new Map(
    (vercelConfig.rewrites || []).map((r) => [r.source, r.destination]),
  );
  for (const source of [
    "/api/:path*",
    "/film-script",
    "/login",
    "/onboarding",
    "/buyer",
    "/grower",
  ]) {
    assert(rewrites.has(source), "Missing Vercel rewrite for " + source);
  }

  for (const rule of vercelConfig.headers || []) {
    for (const h of rule.headers || []) {
      if (h.key.toLowerCase() === "access-control-allow-origin") {
        assert.notEqual(h.value.trim(), "*", "Wildcard CORS is forbidden");
      }
    }
  }

  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  assert.equal(pkg.engines?.node, "24.x", "package.json must pin Vercel Node 24.x");
}

function createVercelStaticAndApiServer({
  staticRoot,
  vercelConfig,
  apiHandler,
}) {
  const rewriteRules = vercelConfig.rewrites || [];
  return createServer(async (req, res) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Content-Security-Policy",
      "frame-ancestors 'self'; object-src 'none'; base-uri 'self'",
    );

    const hostHeader = req.headers.host || "127.0.0.1";
    let parsedUrl;
    try {
      parsedUrl = new URL(req.url, "http://" + hostHeader);
    } catch {
      res.writeHead(400).end();
      return;
    }

    const pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname.startsWith("/api/")) {
      // Simulate Vercel rewrite `/api/:path*` -> `/api/marketplace?__route=/:path*`
      const routeSubpath = pathname.slice(4); // starts with '/'
      const rewrittenSearch = new URLSearchParams(parsedUrl.search);
      rewrittenSearch.set("__route", routeSubpath);
      const rewrittenUrl =
        parsedUrl.origin + "/api/marketplace?" + rewrittenSearch.toString();

      const chunks = [];
      let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > 32000) {
          res.writeHead(413, { "Content-Type": "application/json" }).end(
            JSON.stringify({ error: "Request is too large." }),
          );
          return;
        }
        chunks.push(chunk);
      }

      const headers = new Headers();
      for (const [k, v] of Object.entries(req.headers)) {
        if (Array.isArray(v)) v.forEach((entry) => headers.append(k, entry));
        else if (v !== undefined) headers.set(k, v);
      }

      const webRequest = new Request(rewrittenUrl, {
        method: req.method,
        headers,
        ...(!["GET", "HEAD"].includes(req.method) && chunks.length
          ? { body: Buffer.concat(chunks) }
          : {}),
      });

      const result = await apiHandler(webRequest);
      result.headers.forEach((value, key) => res.setHeader(key, value));
      res.writeHead(result.status);
      res.end(Buffer.from(await result.arrayBuffer()));
      return;
    }

    if (!["GET", "HEAD"].includes(req.method)) {
      res.writeHead(405, { Allow: "GET, HEAD" }).end();
      return;
    }

    let targetPath = pathname === "/" ? "/index.html" : pathname;
    for (const rule of rewriteRules) {
      if (!rule.source.includes(":") && rule.source === pathname) {
        targetPath = rule.destination;
        break;
      }
    }

    const file = path.resolve(staticRoot, "." + targetPath);
    const type = MIME_TYPES[path.extname(file)];
    if (!file.startsWith(staticRoot + path.sep) || !type) {
      res.writeHead(404).end();
      return;
    }

    const info = await stat(file).catch(() => null);
    if (!info?.isFile()) {
      res.writeHead(404).end();
      return;
    }

    const headers = {
      "Content-Type": type,
      "Cache-Control": targetPath.endsWith(".html") ? "no-cache" : "public, max-age=3600",
      "Content-Length": info.size,
    };
    res.writeHead(200, headers);
    if (req.method === "HEAD") {
      res.end();
      return;
    }
    createReadStream(file).pipe(res);
  });
}

async function verifyWorkerProxyIntegration(createVercelProxyHandler) {
  const bundlePath = path.resolve(".wrangler/test-bundle/worker.js");
  if (!fs.existsSync(bundlePath)) {
    const buildRes = spawnSync(
      process.platform === "win32" ? "npx.cmd" : "npx",
      ["wrangler", "deploy", "--dry-run", "--outdir", ".wrangler/test-bundle"],
      { stdio: "inherit" },
    );
    assert.equal(buildRes.status, 0, "wrangler dry-run bundle failed");
  }

  const persistencePath = path.resolve(".wrangler/vercel-fixtures");
  await fsp.rm(persistencePath, { recursive: true, force: true });

  const proxySecret = "qa-proxy-secret-" + randomUUID();
  const trustedOrigin = "https://easyfarm-preview.example";
  const mfOptions = convertV4MiniflareOptions({
    name: "easyfarm-vercel-worker-test",
    modules: true,
    scriptPath: ".wrangler/test-bundle/worker.js",
    compatibilityDate: "2026-11-26",
    compatibilityFlags: ["nodejs_compat"],
    durableObjects: {
      MARKETPLACE: { className: "Marketplace", useSQLite: true },
    },
    bindings: {
      EASYFARM_PROXY_SECRET: proxySecret,
      EASYFARM_TRUSTED_ORIGINS: trustedOrigin,
      CLERK_PUBLISHABLE_KEY: "pk_test_Y2xlcmsuZXhhbXBsZS5jb20k",
      CLERK_SECRET_KEY: "sk_test_worker_proxy_check",
    },
  });
  mfOptions.resourcePersistencePath = persistencePath;

  let mf = new Miniflare(mfOptions);
  try {
    const ns = await mf.getDurableObjectNamespace("MARKETPLACE");
    const market = ns.getByName("easyfarm-demo");

    // Seed an order directly on the DO so we can verify proxy -> DO -> QR origin & persistence
    const grower = {
      clerkId: "user_mf_grower",
      name: "MF Grower",
      email: "mf-grower@example.test",
      googleSubject: "mf-g",
    };
    const buyer = {
      clerkId: "user_mf_buyer",
      name: "MF Buyer",
      email: "mf-buyer@example.test",
      googleSubject: "mf-b",
    };
    await market.complete(grower, {
      role: "grower",
      organization: "Miniflare Farm",
      location: "Nashik",
    });
    await market.complete(buyer, {
      role: "buyer",
      organization: "Miniflare Buyer",
      location: "Pune",
    });
    const farm = (await market.state(grower)).farms.find((f) => f.owned).id;
    const { id: listing } = await market.change(
      {
        action: "listing",
        farm,
        crop: "Worker Proxy Peppers",
        quantity: 50,
        price: 35,
        category: "Peppers",
        grade: "A",
        pickup: "Tomorrow",
        harvest: "2026-11-27",
        notes: "",
      },
      grower,
    );
    const { id: offer } = await market.change(
      { action: "offer", listing, quantity: 10, price: 35, pickup: "Tomorrow" },
      buyer,
    );
    const { id: order } = await market.change(
      { action: "accept", offer, farm },
      grower,
    );

    // Direct access to Worker without proxy secret must fail closed with 403
    const directMissing = await mf.dispatchFetch("http://worker.internal/api/trace/" + order);
    assert.equal(directMissing.status, 403);

    // Direct access with wrong proxy secret must fail with 403
    const directWrong = await mf.dispatchFetch("http://worker.internal/api/trace/" + order, {
      headers: {
        "X-EasyFarm-Proxy-Secret": "wrong-secret",
        "X-EasyFarm-Origin": trustedOrigin,
      },
    });
    assert.equal(directWrong.status, 403);

    // Direct access with valid secret but untrusted origin must fail with 403
    const directBadOrigin = await mf.dispatchFetch("http://worker.internal/api/trace/" + order, {
      headers: {
        "X-EasyFarm-Proxy-Secret": proxySecret,
        "X-EasyFarm-Origin": "https://evil.example",
      },
    });
    assert.equal(directBadOrigin.status, 403);

    // Now invoke the real Vercel proxy handler targeting the Miniflare Worker
    const vercelProxy = createVercelProxyHandler(
      {
        EASYFARM_BACKEND_URL: "http://127.0.0.1",
        EASYFARM_PROXY_SECRET: proxySecret,
        EASYFARM_TRUSTED_ORIGINS: trustedOrigin,
      },
      (url, init) => mf.dispatchFetch(url, init),
    );

    const authConfigRes = await vercelProxy(
      new Request(trustedOrigin + "/api/auth-config"),
    );
    assert.equal(authConfigRes.status, 200);
    assert.equal(authConfigRes.headers.get("cache-control"), "no-store");
    const authConfig = await authConfigRes.json();
    assert.equal(authConfig.google, true);

    // QR via Vercel proxy must encode the Vercel frontend origin, NOT http://127.0.0.1 or worker.internal!
    const qrRes = await vercelProxy(
      new Request(trustedOrigin + "/api/qr/" + order, {
        headers: { "X-Forwarded-Host": "attacker.example" },
      }),
    );
    assert.equal(qrRes.status, 200);
    assert.equal(qrRes.headers.get("cache-control"), "no-store");
    const png = PNG.sync.read(Buffer.from(await qrRes.arrayBuffer()));
    const decoded = decode(new Uint8ClampedArray(png.data), png.width, png.height);
    assert.equal(decoded.data, trustedOrigin + "/app.html?batch=" + order);

    // Restart Miniflare runtime and verify SQLite DO persistence via Vercel proxy
    await mf.dispose();
    mf = new Miniflare(mfOptions);
    const reloadedProxy = createVercelProxyHandler(
      {
        EASYFARM_BACKEND_URL: "http://127.0.0.1",
        EASYFARM_PROXY_SECRET: proxySecret,
        EASYFARM_TRUSTED_ORIGINS: trustedOrigin,
      },
      (url, init) => mf.dispatchFetch(url, init),
    );
    const traceRes = await reloadedProxy(
      new Request(trustedOrigin + "/api/trace/" + order),
    );
    assert.equal(traceRes.status, 200);
    const trace = await traceRes.json();
    assert.equal(trace.orders[0].id, order);
    assert(!trace.orders[0].buyer);
    assert.equal(trace.offers.length, 0);
  } finally {
    await mf.dispose();
    await fsp.rm(persistencePath, { recursive: true, force: true });
  }
}

async function main() {
  verifyProductionDistAndConfig();

  const { createVercelProxyHandler } = await import("../api/_proxy.mjs");
  await verifyWorkerProxyIntegration(createVercelProxyHandler);

  // Build isolated fixture bundle into .easyfarm-react-test/dist (never touches dist/)
  const fixtureBuild = spawnSync(
    process.execPath,
    ["tools/build.cjs", "--fixtures"],
    { stdio: "inherit" },
  );
  assert.equal(fixtureBuild.status, 0, "fixture build failed");

  const { createClerkClient } = await import("@clerk/backend");
  const { createAuth } = await import("../auth.mjs");
  const { handleMarketplace } = await import("../marketplace-service.mjs");

  const dataDir = path.resolve(".easyfarm-vercel-test");
  await fsp.rm(dataDir, { recursive: true, force: true });
  await fsp.mkdir(dataDir, { recursive: true });
  const dbFile = path.join(dataDir, "market.json");

  let db = structuredClone(domain.seed);
  db.profiles = [];
  const save = async () => {
    await fsp.writeFile(dbFile + ".tmp", JSON.stringify(db, null, 2));
    await fsp.rename(dbFile + ".tmp", dbFile);
  };
  const reload = async () => {
    db = JSON.parse(await fsp.readFile(dbFile, "utf8"));
  };
  await save();

  let queue = Promise.resolve();
  const serialize = (fn) => {
    const p = queue.then(fn);
    queue = p.catch(() => {});
    return p;
  };

  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const clerkHost = "test-fixture.clerk.accounts.dev";
  const pk =
    "pk_test_" + Buffer.from(clerkHost + "$").toString("base64").replace(/=+$/, "");
  const proxySecret = "vercel-qa-secret-" + randomUUID();
  const people = new Map();
  const sessions = new Map();

  let vercelBase = "";
  let backendBase = "";

  const backendConfig = {
    CLERK_PUBLISHABLE_KEY: pk,
    CLERK_SECRET_KEY: "sk_test_fixture",
    CLERK_JWT_KEY: publicKey.export({ type: "spki", format: "pem" }),
    EASYFARM_PROXY_SECRET: proxySecret,
    EASYFARM_TRUSTED_ORIGINS: "", // populated once vercelBase is bound
  };

  const sdk = createClerkClient({
    publishableKey: pk,
    secretKey: backendConfig.CLERK_SECRET_KEY,
    jwtKey: backendConfig.CLERK_JWT_KEY,
  });
  const auth = createAuth(backendConfig, {
    authenticateRequest: async (request, options) =>
      sdk.authenticateRequest(request, {
        ...options,
        jwtKey: backendConfig.CLERK_JWT_KEY,
      }),
    users: { getUser: async (id) => people.get(id) },
    sessions: { getSession: async (id) => sessions.get(id) },
  });

  const store = {
    read: async () => db,
    user: (identity) =>
      serialize(async () => {
        const user = domain.portalUser(db, identity);
        if (user.role !== "pending") await save();
        return user;
      }),
    complete: (identity, values) =>
      serialize(async () => {
        const user = domain.completeProfile(db, identity, values);
        await save();
        return { role: user.role };
      }),
    state: (identity) =>
      serialize(async () => {
        const user = domain.portalUser(db, identity);
        if (domain.ensureFarm(db, user)) await save();
        return domain.visibleState(db, user);
      }),
    change: (values, identity) =>
      serialize(async () => {
        const user = domain.portalUser(db, identity);
        const result = domain.actionResult(db, values, user);
        await save();
        return result;
      }),
  };

  const backendServer = createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const headers = new Headers();
    for (const [k, v] of Object.entries(req.headers)) {
      if (Array.isArray(v)) v.forEach((e) => headers.append(k, e));
      else if (v !== undefined) headers.set(k, v);
    }
    const request = new Request(backendBase + req.url, {
      method: req.method,
      headers,
      ...(!["GET", "HEAD"].includes(req.method) && chunks.length
        ? { body: Buffer.concat(chunks) }
        : {}),
    });
    const result = await handleMarketplace(request, {
      auth,
      store,
      config: backendConfig,
    });
    result.headers.forEach((v, k) => res.setHeader(k, v));
    res.writeHead(result.status);
    res.end(Buffer.from(await result.arrayBuffer()));
  });

  await new Promise((r) => backendServer.listen(0, "127.0.0.1", r));
  backendBase = "http://127.0.0.1:" + backendServer.address().port;

  const vercelConfig = JSON.parse(fs.readFileSync("vercel.json", "utf8"));
  const proxyEnv = {
    EASYFARM_BACKEND_URL: backendBase,
    EASYFARM_PROXY_SECRET: proxySecret,
    EASYFARM_TRUSTED_ORIGINS: "",
  };
  const apiHandler = createVercelProxyHandler(proxyEnv);
  const vercelServer = createVercelStaticAndApiServer({
    staticRoot: path.resolve(".easyfarm-react-test/dist"),
    vercelConfig,
    apiHandler,
  });

  await new Promise((r) => vercelServer.listen(0, "127.0.0.1", r));
  vercelBase = "http://127.0.0.1:" + vercelServer.address().port;
  backendConfig.EASYFARM_TRUSTED_ORIGINS = vercelBase;
  proxyEnv.EASYFARM_TRUSTED_ORIGINS = vercelBase;

  function tokenFor(person, claims = {}) {
    const id = person.id || "user_" + randomUUID();
    const sid = "sess_" + randomUUID();
    person.id = id;
    people.set(id, {
      id,
      firstName: person.name,
      lastName: "",
      primaryEmailAddressId: "email_" + id,
      emailAddresses: [
        {
          id: "email_" + id,
          emailAddress: person.email,
          verification: { status: "verified" },
        },
      ],
      externalAccounts: [
        { provider: "oauth_google", providerUserId: "google_" + id },
      ],
    });
    sessions.set(sid, { id: sid, userId: id, status: "active" });
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(
      JSON.stringify({
        alg: "RS256",
        typ: "JWT",
        kid: "test",
        cat: "cl_B7d4PD111AAA",
      }),
    ).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        v: 2,
        sub: id,
        sid,
        iss: "https://" + clerkHost,
        azp: vercelBase,
        iat: now,
        nbf: now - 1,
        exp: now + 3600,
        ...claims,
      }),
    ).toString("base64url");
    const data = header + "." + payload;
    return (
      data +
      "." +
      sign("RSA-SHA256", Buffer.from(data), privateKey).toString("base64url")
    );
  }

  function revoke(token) {
    const { sid } = JSON.parse(
      Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
    );
    sessions.get(sid).status = "revoked";
  }

  const browser = await chromium.launch({ channel: "chrome", headless: true });

  try {
    // 1. Fail-closed proxy checks when unconfigured / unreachable
    const unconfigured = createVercelProxyHandler({});
    assert.equal(
      (await unconfigured(new Request(vercelBase + "/api/auth-config"))).status,
      503,
    );
    const badBackendScheme = createVercelProxyHandler({
      EASYFARM_BACKEND_URL: "http://remote.example",
      EASYFARM_PROXY_SECRET: proxySecret,
      EASYFARM_TRUSTED_ORIGINS: vercelBase,
    });
    assert.equal(
      (await badBackendScheme(new Request(vercelBase + "/api/auth-config")))
        .status,
      503,
    );
    const unreachable = createVercelProxyHandler(
      {
        EASYFARM_BACKEND_URL: "https://backend.invalid",
        EASYFARM_PROXY_SECRET: proxySecret,
        EASYFARM_TRUSTED_ORIGINS: vercelBase,
      },
      async () => {
        throw new Error("ECONNREFUSED");
      },
    );
    assert.equal(
      (await unreachable(new Request(vercelBase + "/api/auth-config"))).status,
      502,
    );

    // 2. Static routes, deep links, security headers, and blocked private files
    for (const route of [
      "/",
      "/film-script",
      "/login",
      "/onboarding",
      "/buyer",
      "/grower",
      "/app.html?batch=missing",
      "/landing.css",
      "/landing.js",
    ]) {
      const r = await fetch(vercelBase + route);
      assert.equal(r.status, 200, "Expected 200 on " + route);
      assert.equal(r.headers.get("x-content-type-options"), "nosniff");
      assert.equal(
        r.headers.get("referrer-policy"),
        "strict-origin-when-cross-origin",
      );
    }
    for (const hidden of ["/server.js", "/.dev.vars", "/api/_proxy.mjs", "/api/marketplace"]) {
      const r = await fetch(vercelBase + hidden);
      assert.equal(r.status, 404, "Expected 404 on " + hidden);
    }

    // 3. Origin, CORS, caching, and token security checks through Vercel proxy
    const alice = { name: "Alice Proxy", email: "alice-proxy@example.test" };
    const aliceToken = tokenFor(alice);
    const wrongAzpBackend = tokenFor(alice, { azp: backendBase });
    const wrongAzpOther = tokenFor(alice, { azp: "https://evil.example" });
    const expired = tokenFor(alice, { exp: Math.floor(Date.now() / 1000) - 30 });

    assert.equal(
      (
        await fetch(vercelBase + "/api/state", {
          headers: { Authorization: "Bearer " + aliceToken },
        })
      ).status,
      409,
    );
    for (const badToken of [
      "forged",
      wrongAzpBackend,
      wrongAzpOther,
      expired,
      aliceToken.slice(0, -10) + "tampered00",
    ]) {
      assert.equal(
        (
          await fetch(vercelBase + "/api/state", {
            headers: { Authorization: "Bearer " + badToken },
          })
        ).status,
        401,
      );
    }

    // Spoofed Host header on Vercel proxy must be rejected 403
    const spoofedHost = await apiHandler(
      new Request("https://evil.example/api/state", {
        headers: { Authorization: "Bearer " + aliceToken },
      }),
    );
    assert.equal(spoofedHost.status, 403);

    // Mismatched Origin and non-JSON Content-Type on POST must be rejected 403
    assert.equal(
      (
        await fetch(vercelBase + "/api/profile", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + aliceToken,
            Origin: "https://evil.example",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ role: "grower", organization: "X", location: "Y" }),
        })
      ).status,
      403,
    );
    assert.equal(
      (
        await fetch(vercelBase + "/api/profile", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + aliceToken,
            Origin: vercelBase,
            "Content-Type": "text/plain",
          },
          body: JSON.stringify({ role: "grower", organization: "X", location: "Y" }),
        })
      ).status,
      403,
    );
    // Oversized body > 16KB must fail 413
    assert.equal(
      (
        await fetch(vercelBase + "/api/action", {
          method: "POST",
          headers: {
            Authorization: "Bearer " + aliceToken,
            Origin: vercelBase,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pad: "a".repeat(17000) }),
        })
      ).status,
      413,
    );
    // OPTIONS must not return wildcard CORS
    const optRes = await fetch(vercelBase + "/api/state", { method: "OPTIONS" });
    assert.equal(optRes.status, 405);
    assert.equal(optRes.headers.get("access-control-allow-origin"), null);

    // 4. Concurrency / double acceptance, private data isolation & revocation
    const grower = { name: "Concurrency Grower", email: "cg@example.test" };
    const buyer = { name: "Concurrency Buyer", email: "cb@example.test" };
    const outsider = { name: "Outsider Buyer", email: "co@example.test" };
    const gTok = tokenFor(grower);
    const bTok = tokenFor(buyer);
    const oTok = tokenFor(outsider);

    const apiPost = (token, endpoint, data) =>
      fetch(vercelBase + endpoint, {
        method: "POST",
        headers: {
          Authorization: "Bearer " + token,
          Origin: vercelBase,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

    assert.equal(
      (
        await apiPost(gTok, "/api/profile", {
          role: "grower",
          organization: "Vercel Test Farm",
          location: "Nashik",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await apiPost(bTok, "/api/profile", {
          role: "buyer",
          organization: "Vercel Test Kitchen",
          location: "Pune",
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await apiPost(oTok, "/api/profile", {
          role: "buyer",
          organization: "Outsider Corp",
          location: "Mumbai",
        })
      ).status,
      200,
    );

    const gStateRes = await fetch(vercelBase + "/api/state", {
      headers: { Authorization: "Bearer " + gTok },
    });
    assert.equal(gStateRes.status, 200);
    assert.equal(gStateRes.headers.get("cache-control"), "no-store");
    assert.equal(gStateRes.headers.get("vary"), "Origin, Authorization");
    assert.equal(gStateRes.headers.get("access-control-allow-origin"), null);
    const gState = await gStateRes.json();
    const farmId = gState.farms.find((f) => f.owned).id;

    const { id: lotId } = await (
      await apiPost(gTok, "/api/action", {
        action: "listing",
        farm: farmId,
        crop: "Vercel Peppers",
        category: "Peppers",
        quantity: 100,
        price: 42,
        grade: "A",
        pickup: "Tomorrow 8am",
        harvest: "2026-11-27",
        notes: "",
      })
    ).json();

    const { id: offerId } = await (
      await apiPost(bTok, "/api/action", {
        action: "offer",
        listing: lotId,
        quantity: 60,
        price: 40,
        pickup: "Tomorrow 8am",
        message: "Private buyer note",
      })
    ).json();

    // Concurrent double-acceptance: exactly ONE succeeds, ONE fails, stock becomes 40
    const [acc1, acc2] = await Promise.all([
      apiPost(gTok, "/api/action", { action: "accept", offer: offerId, farm: farmId }),
      apiPost(gTok, "/api/action", { action: "accept", offer: offerId, farm: farmId }),
    ]);
    assert.equal([acc1.status, acc2.status].filter((s) => s === 200).length, 1);
    assert.equal([acc1.status, acc2.status].filter((s) => s === 400).length, 1);
    const orderId = (await (acc1.status === 200 ? acc1 : acc2).json()).id;

    // Reload backend JSON from disk and verify persistence through Vercel proxy
    await reload();
    const afterAccept = await (
      await fetch(vercelBase + "/api/state", {
        headers: { Authorization: "Bearer " + gTok },
      })
    ).json();
    assert.equal(afterAccept.listings.find((l) => l.id === lotId).quantity, 40);
    assert.equal(afterAccept.orders.length, 1);

    // Outsider cannot see or mutate private trade
    const oState = await (
      await fetch(vercelBase + "/api/state", {
        headers: { Authorization: "Bearer " + oTok },
      })
    ).json();
    assert.equal(oState.offers.length, 0);
    assert.equal(oState.orders.length, 0);
    assert.equal(
      (
        await apiPost(oTok, "/api/action", {
          action: "message",
          offer: offerId,
          farm: farmId,
          message: "Spy",
        })
      ).status,
      400,
    );

    // QR generation must use Vercel frontend origin and ignore X-Forwarded-Host
    const qrRes = await fetch(vercelBase + "/api/qr/" + orderId, {
      headers: { "X-Forwarded-Host": "evil.example" },
    });
    assert.equal(qrRes.status, 200);
    assert.equal(qrRes.headers.get("cache-control"), "no-store");
    const qrPng = PNG.sync.read(Buffer.from(await qrRes.arrayBuffer()));
    const qrText = decode(
      new Uint8ClampedArray(qrPng.data),
      qrPng.width,
      qrPng.height,
    ).data;
    assert.equal(qrText, vercelBase + "/app.html?batch=" + orderId);

    // Revoked token rejected
    revoke(aliceToken);
    assert.equal(
      (
        await fetch(vercelBase + "/api/state", {
          headers: { Authorization: "Bearer " + aliceToken },
        })
      ).status,
      401,
    );

    // 5. Real rendered browser verification across desktop & mobile (1440, 390, 360)
    for (const width of [1440, 390, 360]) {
      const errors = [];
      const context = await browser.newContext({
        viewport: { width, height: width === 1440 ? 950 : 844 },
        isMobile: width < 600,
        hasTouch: width < 600,
        reducedMotion: "reduce",
      });
      const page = await context.newPage();
      page.on("pageerror", (e) => errors.push(e.message));

      // Check landing, film-script, public QR trace, and authenticated portal routes
      for (const publicRoute of ["/", "/film-script", "/app.html?batch=" + orderId]) {
        await page.goto(vercelBase + publicRoute);
        if (publicRoute.startsWith("/app.html")) {
          await page.locator(".trace-panel").waitFor();
        }
        assert(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
          "Public route overflow on " + publicRoute + " at " + width,
        );
      }

      const uiGrower = {
        name: "UI Grower " + width,
        email: "ui-grower-" + width + "@example.test",
      };
      const uiToken = tokenFor(uiGrower);
      await page.goto(vercelBase + "/login?portal=grower");
      await page.locator("#google-signin").waitFor();
      await page.evaluate((t) => localStorage.setItem("qa_clerk_token", t), uiToken);
      await page.goto(vercelBase + "/login?portal=grower");
      await page.waitForURL("**/onboarding**");
      await page.locator("[name=organization]").fill("Vercel UI Farm " + width);
      await page.locator("[name=location]").fill("Nashik");
      await page.locator("#profile-submit").click();
      await page.waitForURL("**/grower**");
      await page.locator(".app-shell").waitFor();
      await page.evaluate(() => document.fonts.ready);
      assert(await page.evaluate(() => document.fonts.check("14px Montreal")), "Montreal fonts must load through Vercel static asset serving");

      assert(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        "Grower portal overflow at " + width,
      );

      // Refresh deep link preserves route
      await page.goto(vercelBase + "/grower?view=listings");
      await page.locator("[data-action=edit-lot]").waitFor();
      if (width < 600) {
        await page.locator("#mobile-nav").waitFor();
        await page.locator("[data-action=edit-lot]").click();
        await page.getByRole("dialog").waitFor();
        await page.setViewportSize({ width, height: 440 });
        await page.waitForFunction(
          () =>
            parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue(
                "--app-height",
              ),
            ) < 450,
        );
        const box = await page.getByRole("dialog").boundingBox();
        assert(
          box.y >= 0 && box.y + box.height <= 441,
          "Dialog clipped above keyboard at " + width,
        );
        await page.setViewportSize({ width, height: 844 });
      }

      assert.deepEqual(errors, [], "Browser page errors at " + width);
      await context.close();
    }

    console.log(
      "PASS Vercel readiness: production dist/ hygiene, vercel.json rules, Miniflare Worker proxy + SQLite persistence, origin/CSRF/azp/revocation checks, double-accept concurrency, QR origin, and 1440/390/360px browser checks.",
    );
  } finally {
    await browser.close();
    await new Promise((r) => vercelServer.close(r));
    await new Promise((r) => backendServer.close(r));
    await fsp.rm(dataDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
