export function timingSafeEqualStrings(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a.length || !b.length) {
    return false;
  }
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);
  let diff = left.length ^ right.length;
  for (let i = 0; i < length; i++) {
    diff |= (left[i % left.length] ?? 0) ^ (right[i % right.length] ?? 0);
  }
  return diff === 0;
}

export function normalizeOrigin(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (url.origin !== trimmed) return null;
    return url.origin;
  } catch {
    return null;
  }
}

const MAX_ORIGIN_CACHE = 32;
const originListCache = new Map();

export function parseOriginList(value) {
  if (typeof value !== "string") return new Set();
  const cached = originListCache.get(value);
  if (cached) return cached;
  const origins = new Set();
  for (const part of value.split(",")) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const origin = normalizeOrigin(trimmed);
    if (!origin) {
      throw new Error("Invalid trusted origin configuration.");
    }
    origins.add(origin);
  }
  if (originListCache.size >= MAX_ORIGIN_CACHE) {
    originListCache.delete(originListCache.keys().next().value);
  }
  originListCache.set(value, origins);
  return origins;
}

export function resolveBackendRequestOrigin(request, config = {}) {
  const directOrigin = new URL(request.url).origin;
  const secret = config.EASYFARM_PROXY_SECRET || "";
  if (!secret) {
    return { ok: true, origin: directOrigin, proxied: false };
  }

  const allowed = parseOriginList(
    [config.EASYFARM_TRUSTED_ORIGINS, config.EASYFARM_FRONTEND_ORIGIN]
      .filter(Boolean)
      .join(","),
  );
  const providedSecret = request.headers.get("X-EasyFarm-Proxy-Secret");
  if (!providedSecret) {
    if (
      (config.EASYFARM_ALLOW_DIRECT === "true" ||
        config.EASYFARM_ALLOW_DIRECT === "1") &&
      (allowed.size === 0 || allowed.has(directOrigin))
    ) {
      return { ok: true, origin: directOrigin, proxied: false };
    }
    return {
      ok: false,
      status: 403,
      error: "Direct access to this backend is disabled.",
    };
  }

  if (!timingSafeEqualStrings(providedSecret, secret)) {
    return { ok: false, status: 403, error: "Forbidden." };
  }

  const forwardedOrigin = normalizeOrigin(
    request.headers.get("X-EasyFarm-Origin"),
  );
  if (!forwardedOrigin) {
    return {
      ok: false,
      status: 403,
      error: "Missing or invalid frontend origin.",
    };
  }
  if (allowed.size > 0 && !allowed.has(forwardedOrigin)) {
    return { ok: false, status: 403, error: "Untrusted frontend origin." };
  }

  return { ok: true, origin: forwardedOrigin, proxied: true };
}

export function resolveVercelTrustedOrigin(request, env = {}) {
  let candidateOrigin;
  try {
    candidateOrigin = new URL(request.url).origin;
  } catch {
    return { ok: false, status: 400, error: "Invalid request URL." };
  }

  const explicit = parseOriginList(
    [env.EASYFARM_TRUSTED_ORIGINS, env.EASYFARM_FRONTEND_ORIGIN]
      .filter(Boolean)
      .join(","),
  );
  const allowed = new Set(explicit);

  if (explicit.size === 0 && env.VERCEL === "1") {
    for (const host of [
      env.VERCEL_PROJECT_PRODUCTION_URL,
      env.VERCEL_BRANCH_URL,
      env.VERCEL_URL,
    ]) {
      if (typeof host === "string" && host.trim()) {
        const normalized = normalizeOrigin("https://" + host.trim());
        if (normalized) allowed.add(normalized);
      }
    }
  }

  if (!allowed.has(candidateOrigin)) {
    return { ok: false, status: 403, error: "Untrusted request origin." };
  }

  return { ok: true, origin: candidateOrigin };
}
