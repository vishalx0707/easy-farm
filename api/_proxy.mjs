import { normalizeOrigin, resolveVercelTrustedOrigin } from "../origin.mjs";

const MAX_BODY_BYTES = 16000;

function jsonResponse(body, status = 200, extraHeaders = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      Vary: "Origin, Authorization",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function resolveBackendUrl(rawUrl) {
  if (typeof rawUrl !== "string" || !rawUrl.trim()) return null;
  let parsed;
  try {
    parsed = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  const isLocal =
    parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocal)) {
    return null;
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash) {
    return null;
  }
  const basePath = parsed.pathname.replace(/\/+$/, "");
  if (basePath && basePath !== "") return null;
  return parsed.origin;
}

function reconstructApiPath(requestUrl) {
  const incoming = new URL(requestUrl);
  const search = new URLSearchParams(incoming.search);
  let pathname = incoming.pathname;
  if (pathname === "/api/marketplace" && search.has("__route")) {
    const route = search.get("__route") || "";
    search.delete("__route");
    pathname = "/api/" + route.replace(/^\/+/, "");
  }
  return { pathname, search };
}

function isAllowedApiRoute(method, pathname) {
  if (method === "GET") {
    if (
      pathname === "/api/auth-config" ||
      pathname === "/api/auth/session" ||
      pathname === "/api/state"
    ) {
      return { allowed: true };
    }
    if (
      (pathname.startsWith("/api/trace/") && pathname.length > 11) ||
      (pathname.startsWith("/api/qr/") && pathname.length > 8)
    ) {
      return { allowed: true };
    }
    if (pathname.startsWith("/api/auth/")) {
      return {
        allowed: false,
        status: 404,
        error: "Use Google sign-in through Clerk.",
      };
    }
    return { allowed: false, status: 404, error: "Endpoint not found." };
  }
  if (method === "POST") {
    if (pathname === "/api/profile" || pathname === "/api/action") {
      return { allowed: true };
    }
    if (
      pathname.startsWith("/api/auth/") &&
      pathname !== "/api/auth/session"
    ) {
      return {
        allowed: false,
        status: 404,
        error: "Use Google sign-in through Clerk.",
      };
    }
    return { allowed: false, status: 404, error: "Endpoint not found." };
  }
  return { allowed: false, status: 405, error: "Method not allowed." };
}

async function readLimitedBody(request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "Request is too large." };
  }
  if (!request.body) {
    return { ok: true, body: new Uint8Array(0) };
  }
  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BODY_BYTES) {
      await reader.cancel();
      return { ok: false, status: 413, error: "Request is too large." };
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, body };
}

export function createVercelProxyHandler(
  env = process.env,
  fetchImpl = fetch,
) {
  return async function handleVercelApi(request) {
    let pathname, search;
    try {
      ({ pathname, search } = reconstructApiPath(request.url));
    } catch {
      return jsonResponse({ error: "Invalid request." }, 400);
    }

    if (!["GET", "POST"].includes(request.method)) {
      return jsonResponse({ error: "Method not allowed." }, 405, {
        Allow: "GET, POST",
      });
    }

    const routeCheck = isAllowedApiRoute(request.method, pathname);
    if (!routeCheck.allowed) {
      return jsonResponse({ error: routeCheck.error }, routeCheck.status);
    }

    const backendOrigin = resolveBackendUrl(env.EASYFARM_BACKEND_URL);
    const proxySecret =
      typeof env.EASYFARM_PROXY_SECRET === "string"
        ? env.EASYFARM_PROXY_SECRET.trim()
        : "";
    if (!backendOrigin || !proxySecret) {
      return jsonResponse(
        { error: "Marketplace backend is not configured." },
        503,
      );
    }

    let originCheck;
    try {
      originCheck = resolveVercelTrustedOrigin(request, env);
    } catch {
      return jsonResponse({ error: "Server configuration error." }, 500);
    }
    if (!originCheck.ok) {
      return jsonResponse({ error: originCheck.error }, originCheck.status);
    }
    const trustedOrigin = originCheck.origin;

    if (request.method === "POST") {
      const requestOrigin = normalizeOrigin(request.headers.get("origin"));
      const contentType = request.headers.get("content-type") || "";
      if (
        requestOrigin !== trustedOrigin ||
        !contentType.toLowerCase().startsWith("application/json")
      ) {
        return jsonResponse(
          { error: "Use the EasyFarm app on this server." },
          403,
        );
      }
    }

    let bodyBytes;
    if (request.method === "POST") {
      const bodyResult = await readLimitedBody(request);
      if (!bodyResult.ok) {
        return jsonResponse({ error: bodyResult.error }, bodyResult.status);
      }
      bodyBytes = bodyResult.body;
    }

    const query = search.toString();
    const targetUrl =
      backendOrigin + pathname + (query ? "?" + query : "");
    const forwardHeaders = new Headers();
    for (const headerName of [
      "authorization",
      "origin",
      "content-type",
      "accept",
    ]) {
      const value = request.headers.get(headerName);
      if (value) forwardHeaders.set(headerName, value);
    }
    forwardHeaders.set("X-EasyFarm-Proxy-Secret", proxySecret);
    forwardHeaders.set("X-EasyFarm-Origin", trustedOrigin);

    let upstream;
    try {
      upstream = await fetchImpl(targetUrl, {
        method: request.method,
        headers: forwardHeaders,
        ...(bodyBytes ? { body: bodyBytes } : {}),
        redirect: "manual",
      });
    } catch {
      return jsonResponse(
        { error: "The marketplace backend is temporarily unavailable." },
        502,
      );
    }

    if (upstream.status >= 300 && upstream.status < 400) {
      return jsonResponse(
        { error: "The marketplace backend is temporarily unavailable." },
        502,
      );
    }

    const responseHeaders = new Headers();
    const contentType = upstream.headers.get("content-type");
    if (contentType) responseHeaders.set("Content-Type", contentType);
    responseHeaders.set("Cache-Control", "no-store");
    responseHeaders.set("Vary", "Origin, Authorization");
    responseHeaders.set("X-Content-Type-Options", "nosniff");

    const responseBody = await upstream.arrayBuffer();
    return new Response(responseBody, {
      status: upstream.status,
      headers: responseHeaders,
    });
  };
}
