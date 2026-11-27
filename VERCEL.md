# Vercel setup

Import `vishalx0707/easy-farm` from GitHub, using the repository root. Choose **Other** as the framework preset. `vercel.json` supplies the settings:

| Setting | Value |
| --- | --- |
| Node.js | 24.x |
| Install | `npm ci` |
| Build | `npm run typecheck && npm run build` |
| Output | `dist` |

The frontend runs on Vercel. The `/api` function forwards authenticated requests to the persistent Cloudflare Worker / SQLite Durable Object. Do not use a filesystem database in the Vercel function.

## Environment

Use `.env.vercel.example` as a reference. Configure these as **server-side runtime variables** in the intended Vercel environment:

- `EASYFARM_BACKEND_URL`: deployed Cloudflare Worker HTTPS origin, without a path.
- `EASYFARM_PROXY_SECRET`: same random shared secret configured on the Worker.
- `EASYFARM_TRUSTED_ORIGINS`: comma-separated exact frontend origins, including the production/custom domain.

On Cloudflare, configure `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, the matching `EASYFARM_PROXY_SECRET`, and `EASYFARM_TRUSTED_ORIGINS`. For standalone Cloudflare hosting, use the documented direct-access configuration in README.md.

Keep Clerk secret keys on Cloudflare; do not add them to the browser bundle or `VITE_*` variables. Clerk supplies the publishable key to the client through `/api/auth-config`.

For previews, explicitly allow each preview origin on both sides and in the applicable Clerk configuration. An explicit origin list overrides automatic Vercel system-origin discovery. Use a separate Worker/database for test previews so they do not write into production trades.

For production authentication, configure the production Clerk Google connection and the hosted application's origin. Google sign-in remains the only authentication method. Existing local Node data is not automatically uploaded to Cloudflare.

## Verify before release

```powershell
npm ci
npm run check:vercel
```

The readiness check validates production output, excludes authentication fixtures and private files, checks routes and headers, exercises the proxy against actual local Cloudflare SQLite storage, and checks rendered pages at 1440, 390 and 360 px. It creates isolated data and does not publish a deployment. Browser checks need a local Chrome installation.

After a separately requested deployment, complete Google sign-in on the hosted origin and verify a trade between two accounts. Payments, quality checks and market price references remain simulations. QR traceability and shared trade persistence are functional.
