import {DurableObject} from 'cloudflare:workers';
import {createAuth} from './auth.mjs';
import {handleMarketplace} from './marketplace-service.mjs';
import {resolveBackendRequestOrigin} from './origin.mjs';
import domain from './marketplace-domain.cjs';

const MAX_BODY_BYTES = 16000;
const apiJson = (body, status = 200, extraHeaders = {}) =>
  Response.json(body, {
    status,
    headers: { 'Cache-Control': 'no-store', ...extraHeaders },
  });

function publicAuthConfig(env = {}) {
  const publishableKey =
    env.CLERK_PUBLISHABLE_KEY || env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY || '';
  const google = Boolean(publishableKey && env.CLERK_SECRET_KEY);
  return { provider: 'clerk', publishableKey, google };
}

export class Marketplace extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.sql = ctx.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS market (id INTEGER PRIMARY KEY, document TEXT NOT NULL)');
    this.auth = createAuth(env);
    this._db = null;
    this._legacyChecked = false;
    this._legacyPendingSave = false;
  }

  read() {
    if (!this._db) {
      const rows = this.sql.exec('SELECT document FROM market WHERE id=1').toArray();
      const db = rows.length ? JSON.parse(rows[0].document) : structuredClone(domain.seed);
      db.profiles ||= [];
      this._db = db;
    }
    if (!this._legacyChecked) {
      try {
        let added = false;
        if (this.sql.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='user'").toArray().length) {
          const profiles = this.sql.exec("SELECT u.id,u.name,u.email,u.role,u.organization,u.location,a.accountId AS googleSubject FROM user u JOIN account a ON a.userId=u.id WHERE a.providerId='google' AND u.emailVerified=1").toArray();
          const existingIds = new Set(this._db.profiles.map((p) => p.id));
          for (const profile of profiles) {
            if (['buyer', 'grower'].includes(profile.role) && profile.organization && !existingIds.has(profile.id)) {
              this._db.profiles.push({ ...profile, clerkId: null });
              existingIds.add(profile.id);
              added = true;
            }
          }
        }
        this._legacyChecked = true;
        this._legacyPendingSave = added;
      } catch (error) {
        this._db = null;
        throw error;
      }
    }
    return this._db;
  }

  save(db) {
    this.sql.exec('INSERT INTO market (id,document) VALUES (1,?) ON CONFLICT(id) DO UPDATE SET document=excluded.document', JSON.stringify(db));
    this._legacyPendingSave = false;
  }

  _withDb(fn) {
    try {
      return fn(this.read());
    } catch (error) {
      this._db = null;
      if (this._legacyPendingSave) {
        this._legacyChecked = false;
        this._legacyPendingSave = false;
      }
      throw error;
    }
  }

  user(identity) {
    return this._withDb((db) => {
      const { user, linked } = domain.portalUserMeta(db, identity);
      if (linked) this.save(db);
      return user;
    });
  }

  complete(identity, values) {
    return this._withDb((db) => {
      const user = domain.completeProfile(db, identity, values);
      this.save(db);
      return { role: user.role };
    });
  }

  state(identity) {
    return this._withDb((db) => {
      const { user, linked } = domain.portalUserMeta(db, identity);
      const farmCreated = domain.ensureFarm(db, user);
      if (linked || farmCreated) this.save(db);
      return domain.visibleState(db, user);
    });
  }

  portalState(identity) {
    return this._withDb((db) => {
      const { user, linked } = domain.portalUserMeta(db, identity);
      if (!['buyer', 'grower'].includes(user.role)) {
        if (linked) this.save(db);
        return { onboarding: true };
      }
      const farmCreated = domain.ensureFarm(db, user);
      if (linked || farmCreated) this.save(db);
      return { onboarding: false, state: domain.visibleState(db, user) };
    });
  }

  change(values, identity) {
    return this._withDb((db) => {
      const { user } = domain.portalUserMeta(db, identity);
      const result = domain.actionResult(db, values, user);
      this.save(db);
      return result;
    });
  }

  async fetch(request) {
    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
      await request.body?.cancel?.().catch(() => {});
      return apiJson({ error: 'Request is too large.' }, 413);
    }
    if (request.body) {
      const reader = request.body.getReader();
      let size = 0;
      const chunks = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > MAX_BODY_BYTES) {
          await reader.cancel();
          return apiJson({ error: 'Request is too large.' }, 413);
        }
        chunks.push(value);
      }
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const part of chunks) {
        bytes.set(part, offset);
        offset += part.length;
      }
      request = new Request(request, { body: bytes });
    }
    return handleMarketplace(request, { auth: this.auth, store: this, config: this.env });
  }
}

function handleApiEdge(request, env, pathname) {
  let originCheck;
  try {
    originCheck = resolveBackendRequestOrigin(request, env);
  } catch (error) {
    console.error(JSON.stringify({ event: 'worker_edge_error', message: error.message }));
    return apiJson({ error: 'Could not complete this request. Try again.' }, 500);
  }
  if (!originCheck.ok) {
    return apiJson({ error: originCheck.error }, originCheck.status);
  }
  if (!['GET', 'POST'].includes(request.method)) {
    return apiJson({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
  }
  if (request.method === 'GET' && pathname === '/api/auth-config') {
    return apiJson(publicAuthConfig(env));
  }
  if (pathname.startsWith('/api/auth/') && pathname !== '/api/auth/session') {
    return apiJson({ error: 'Use Google sign-in through Clerk.' }, 404);
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let result;
    if (url.pathname.startsWith('/api/')) {
      result = handleApiEdge(request, env, url.pathname) ||
        (await env.MARKETPLACE.getByName('easyfarm-demo').fetch(request));
    } else {
      if (url.pathname === '/') url.pathname = '/index.html';
      if (url.pathname === '/film-script') url.pathname = '/film-script.html';
      if (url.pathname === '/login') url.pathname = '/login.html';
      if (url.pathname === '/onboarding') url.pathname = '/onboarding.html';
      if (['/buyer', '/grower'].includes(url.pathname)) url.pathname = '/app.html';
      result = await env.ASSETS.fetch(new Request(url, request));
    }
    const response = new Response(result.body, result);
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set('Content-Security-Policy', "frame-ancestors 'self'; object-src 'none'; base-uri 'self'");
    return response;
  },
};
