# EasyFarm

A responsive React + TypeScript B2B farm marketplace with separate buyer and grower portals, Google-only Clerk authentication and persistent Cloudflare Workers storage. Use Node 24 or later.

```powershell
npm install
npm start
```

Open [EasyFarm sign-in](http://127.0.0.1:3000/login). The marketing landing page, HeroLoop footage and `/film-script` page are preserved.

## App stack and development

The app is built with React 19, TypeScript, Vite 8, React Router, Tailwind CSS 4 and shadcn/ui (Radix) components. TanStack Query owns server state, mutations and refresh; React Hook Form and Zod validate profile and trade forms. The backend remains the shared, ownership-checked marketplace API. No trade data or permissions live only in the browser.

GSAP handles short, scoped screen transitions. Motion for React animates the shared navigation highlight and brief leaf opening. Lenis smooths the internal desktop workspace only; phone scrolling, messages, dialogs and reduced-motion users keep native scrolling. A lazy React Three Fiber / Three.js leaf scene appears on desktop sign-in with a static brand pattern as fallback. It is skipped on phones and for reduced motion. No 3D code is required to trade.

`npm start` builds the React app and runs the local Node server. For hot reloading, keep the Node server running and use `npm run dev` at http://127.0.0.1:5173; Vite proxies its API requests to Node. `npm run typecheck` validates TypeScript. The original marketing page, HeroLoop and film page remain independent.

## Authentication

The workspace is linked to the connected Clerk **development** application. Google is enabled; email sign-in, email sign-up and passwords are disabled in that instance. The tracked `clerk-config.json` documents these settings without credentials. There is no shipped demo login or alternative password endpoint.

Local keys live in the ignored `.dev.vars` file. To provision another checkout, link the intended Clerk app and pull its development keys:

```powershell
npx -y clerk@latest link --app YOUR_APP_ID
npx -y clerk@latest env pull --file .dev.vars --instance dev
```

The required variables are `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`; see `.dev.vars.example`. Node reads `.dev.vars` and `.env.local`, with existing process variables taking precedence. Wrangler reads `.dev.vars`. Restart the server after changing keys. The CLI doctor checks `.env.local` rather than `.dev.vars`, so its missing-env warning alone does not mean this app lacks keys.

ClerkProvider from @clerk/react, with the bundled @clerk/ui components, handles Google authorization, callback, session refresh and sign-out. The API validates the SDK's bearer session token using `@clerk/backend`, restricts its authorized party to the request origin, checks that the remote session is active and requires a Google-linked account with a verified primary email. Browser role values and Clerk user metadata never grant marketplace permissions. Only the publishable key is returned to the browser.

The clean full-screen `/login` page contains only Google sign-in. After Google returns, new users go to a separate full-page `/onboarding` route to choose their buyer/grower role and enter their farm/business name and location. That role is assigned once in the marketplace database. Returning accounts open their assigned portal even when entering through the other portal's login screen. `/buyer` and `/grower` share inventory while private offers, conversations, orders and history remain scoped to their participants.

The development instance uses Clerk's shared Google development credentials. A production release requires a Clerk production instance, an owned domain and production Google OAuth configuration in Clerk. A hosted demo is available at https://easy-farm-seven.vercel.app using this development instance. Production Clerk authentication has not been provisioned. Google redirect is checked on the hosted origin; account completion remains a manual check.

## Vercel & Cloudflare Hosting

EasyFarm is configured for **Vercel** frontend/API hosting backed by the persistent **Cloudflare Workers** SQLite-backed Durable Object backend (`worker.mjs`), while preserving standalone Cloudflare and local Node (`server.js`) operation.

### Architecture

- **Vercel static output (`dist/`)**: `vercel.json` sets `"framework": null`, `"buildCommand": "npm run typecheck && npm run build"`, `"outputDirectory": "dist"`, `"trailingSlash": false`, and pins Node `24.x` via `package.json` `engines.node`. `tools/build.cjs` emits only compiled React bundles (`app.html`, `login.html`, `onboarding.html`), marketing/film assets (`index.html`, `landing.css`, `landing.js`, `film-script.html`), `assets/`, and `hero-footage/fresh-produce/*.jpg`. Source files, `.dev.vars`, `.easyfarm*`, and fixture code are excluded by `tools/build.cjs` and `.vercelignore`.
- **Routes & deep links**: `vercel.json` rewrites `/film-script`, `/login`, `/onboarding`, `/buyer`, `/grower`, and `/api/:path*` (`-> /api/marketplace?__route=/:path*`). `/app.html?batch=...` is served directly for public QR traces. Security headers (`X-Content-Type-Options`, `Referrer-Policy`, `Content-Security-Policy`) and `Cache-Control: no-cache` for HTML routes / `Cache-Control: no-store` + `Vary: Origin, Authorization` for `/api/*` are configured without wildcard CORS.
- **Authenticated API proxy (`api/marketplace.mjs`, `api/_proxy.mjs`, `origin.mjs`)**: Runs on Vercel's Node 24 runtime, validates the request's canonical origin against `EASYFARM_TRUSTED_ORIGINS` (or Vercel-assigned system domains, never trusting `X-Forwarded-Host`), enforces same-origin `application/json` checks on `POST` writes, enforces the 16 KB body limit, fails closed (`503`) if unconfigured, and forwards requests to `EASYFARM_BACKEND_URL` with `X-EasyFarm-Proxy-Secret` and `X-EasyFarm-Origin`.
- **Cloudflare Worker backend (`worker.mjs`, `auth.mjs`, `marketplace-service.mjs`, `wrangler.jsonc`)**: Uses Workers Static Assets plus a SQLite-backed Durable Object (`Marketplace`). When `EASYFARM_PROXY_SECRET` is set, direct requests to `workers.dev` without the matching secret or from an untrusted `X-EasyFarm-Origin` fail closed with `403`. `auth.mjs` binds Clerk JWT `authorizedParties` (`azp`) to the verified frontend origin, `marketplace-service.mjs` checks write `Origin` against that verified origin, and `/api/qr/:orderId` encodes the verified frontend origin.

### Commands

See [VERCEL.md](VERCEL.md) for the GitHub import settings and [.env.vercel.example](.env.vercel.example) for the three Vercel runtime variables.

- `npm run check:vercel` — runs TypeScript plus the full isolated Vercel/Cloudflare readiness check without deploying.
- `npm run build` — compiles React into `dist/` and copies public marketing/media assets.
- `npm run dev:cloudflare` — runs the local Worker at [127.0.0.1:8787](http://127.0.0.1:8787/login) with persistent local storage in `.wrangler/local`.
- `npm run check:cloudflare` — validates Cloudflare Worker packaging (`wrangler deploy --dry-run`) without deploying.
- `npm run deploy` — explicit Cloudflare Worker deployment command; deployed Worker secrets must be maintained separately.
- `vercel build` / `vercel deploy` — Vercel local build / remote deployment commands for the linked project.

### Required Environment Variables & Provisioning

Local `.dev.vars` files are never uploaded automatically. Before an authorized production deployment, provision:

1. **Cloudflare Worker secrets/variables** (`wrangler secret put` / Cloudflare dashboard):
   - `CLERK_PUBLISHABLE_KEY` (`pk_live_...` for production)
   - `CLERK_SECRET_KEY` (`sk_live_...` for production)
   - `EASYFARM_PROXY_SECRET` (random shared secret matching Vercel)
   - `EASYFARM_TRUSTED_ORIGINS` (comma-separated canonical HTTPS origins, e.g. `https://app.example.com`)
2. **Vercel Project environment variables**:
   - `EASYFARM_BACKEND_URL` (the `https://` origin of the deployed Cloudflare Worker, with no path or trailing slash)
   - `EASYFARM_PROXY_SECRET` (same shared secret as the Worker)
   - `EASYFARM_TRUSTED_ORIGINS` (canonical HTTPS frontend origins; if unset in preview/non-custom-domain setups, Vercel system URLs are used)
3. **Clerk & Google OAuth production setup**:
   - A Clerk **production** instance, an owned custom domain, and production Google OAuth credentials in Clerk (email/password remain disabled per `clerk-config.json`).

### Readiness Limitations & Vercel Plan Constraints

- **Commercial B2B launch requires Vercel Pro (or Enterprise)**: Vercel's free Hobby plan is restricted to personal, non-commercial use under Vercel's Terms of Service and Fair Use Guidelines.
- **Hosted demo**: the local CLI is linked to the `easy-farm` project in `vishalx0707s-projects`, with Node 24 and the Other framework preset. The Vercel production target serves the public demo; Clerk still uses its development instance. See VERCEL.md for the current release and authentication status.
- **Runtime & scaling constraints**: `vercel.json` sets `maxDuration: 30` (within Hobby's 300s cap), and `api/_proxy.mjs` enforces a 16 KB API payload cap (well under Vercel's 4.5 MB limit). The backend currently coordinates marketplace state in a single SQLite-backed Durable Object (`easyfarm-demo`); multi-region or high-volume commercial traffic would require sharding or a dedicated external database.
- **Non-production product placeholders**: Payments remain explicitly simulated, quality checks are grower-declared/simulated, market charts use illustrative values, and live Google OAuth login on the hosted domain requires manual verification after provisioning production Clerk/Google credentials. First Worker deployment initializes a separate seeded marketplace; it does not upload the private Node `.easyfarm/market.json` database. No Netlify configuration is included.

## Portals and presentation

The workspace follows `design/app-references/01-primary-ui.png`: translucent olive acrylic surfaces, cream lot records, restrained lime actions and quiet line icons. The desktop workspace fills the screen, with account access in the bottom-left sidebar. Desktop uses a persistent sidebar; phone layouts use five labelled bottom icons for Home, Crops/Produce, Offers, Orders and Messages. Catalogue and order views scroll within the workspace. Forms, filters, messaging and delivery timelines support narrow phone screens.

The fieldwork redesign uses the same self-hosted PP Neue Montreal fonts as the user's Grit Listening Studio, quiet forest gradients and fine contour texture. Home groups harvests, price perspective and trade activity. Ready-to-trade filtering and price sorting distinguish seller-published lots from examples. Farm discovery searches farm, grower and locality. Illustrative Chevella/Moinabad examples do not imply registered nearby growers or GPS distance. Authenticated portals check for updates every six seconds while open. [Design and generated-image prompt](design/fieldwork-redesign.md).

- Growers manage farm profiles, publish harvest lots, compare incoming offers, negotiate, accept orders and update delivery milestones.
- Buyers search/filter produce, view farms and lot terms, submit offers, negotiate, message and track purchases.
- Accepted offers reserve stock once. Delivery progresses through Accepted, Packed, Ready for pickup, Picked up and Delivered.
- Quantity, price per kg, totals and pickup terms are saved with each trade. Public read-only QR traces include lot/order details and ordinary event history, omitting buyer identities and private conversations.

`assets/greenhouse-workspace.png` is generated illustrative photography, not a photograph of a listed farm. Its ImageGen prompt described an editorial greenhouse photograph with an olive-shirted grower inspecting a red pepper on the right and defocused foliage on the left, with natural light and no text/UI. Seed farms and prices are labelled samples. Produce photos are representative rather than evidence of lot quality.

## Storage and integration status

- Node persists marketplace data atomically in `.easyfarm/market.json`. `EASYFARM_DATA_DIR` selects another directory. Writes are serialized; existing records are retained.
- Cloudflare persists the same profile and trade records in Durable Object SQLite storage. Clerk owns identities and sessions; its private signing keys are never stored in the marketplace database.
- Older account databases are retained read-only. Previously verified Google accounts can retain their original ownership IDs only when both verified email and Google provider subject match. Email alone cannot claim a legacy account. Old password sessions do not authenticate through Clerk.
- QR images are real, decodable PNG QR codes. Local QR URLs require access to the local computer; hosted URLs use the request origin.
- Payments are explicitly simulated; no processor is connected and no money moves.
- Quality is grower-declared or labelled as a simulated sample check. No external inspection or certification service is connected.
- Market charts use illustrative values. No live price feed, carrier, dispatch, push notification or external messaging provider is connected.
- Blockchain is excluded. History uses ordinary persistent records.

Credentials, private databases, `.clerk`, `.wrangler`, build output and QA records are ignored by Git. Optimized runtime footage is versioned; original downloaded footage stays local.

## Verification

```powershell
npm run typecheck
npm run test:auth
npm run test:worker
npm run test:vercel
npm run test:browser
```

`test:auth` uses the real Clerk backend SDK with a generated RSA test key, isolated fake provider records and an ephemeral test server. It verifies signature rejection, expiry, origin binding, session revocation, one-time profile completion, CSRF checks, disabled legacy auth endpoints, persistence round-trip and strict legacy Google account matching. Fixtures are never imported by the running application or served as endpoints.

`test:browser` first builds a separate fixture bundle under the ignored `.easyfarm-react-test/dist`, then starts its own isolated server. Vite aliases @clerk/react to a test provider only for that build; the production build imports the actual Clerk package, contains no fixture tokens/provider, and exposes no testing endpoint. It uses signed fixture tokens and mocked Clerk React session state to test the actual app/API at 1440, 390 and 360 pixels: profile completion, portal routing, harvest publishing, buyer discovery, offer, messages, counteroffers, acceptance, delivery, simulated payment, reload, QR decode, sign-out and returning-session routing. It checks account isolation, role spoofing rejection, single stock reservation, mobile navigation, overflow and reduced-height messaging. The suite verifies that profile setup happens on `/onboarding`, that the workspace fills the viewport, and that account controls remain in the correct desktop/mobile location. Screenshots and results are written under `design/qa-*.png` and `design/verification-results.json`.

`test:worker` bundles the actual Worker and runs it in Cloudflare's local workerd/Miniflare runtime with SQLite persistence isolated under `.wrangler/worker-fixtures`. It tests profile ownership, trade, messaging, single stock reservation, payment/delivery records, public trace privacy, QR decoding and persistence after the runtime restarts. Internal RPC receives fixture identities, so this validates Worker storage/domain behavior rather than the Google exchange.

`test:vercel` validates production `dist/` hygiene (no source/secret leaks or fixture tokens), `vercel.json` routing/header rules, and runs `api/_proxy.mjs` against both a real Miniflare SQLite Durable Object Worker (including direct-access `403` lockouts, QR origin encoding, and restart persistence) and an isolated Clerk RSA SDK backend server. It verifies fail-closed `503`/`502` behavior, spoofed `Host` / `X-Forwarded-Host` / `Origin` / `azp` / revoked-token rejection, `Cache-Control: no-store`, omitted wildcard CORS, concurrent double-accept stock reservation, private data isolation, and rendered Playwright desktop (`1440px`) and mobile (`390px`, `360px`) routes (`/`, `/film-script`, `/login`, `/onboarding`, `/buyer`, `/grower`, `/app.html?batch=...`) with zero overflow or clipped dialogs.

TypeScript checks, the full React browser trade suite, backend token checks and Cloudflare SQLite restart checks passed. Additional browser checks exercised the real Clerk React UI in both Node and the local Workers runtime, the Google authorization handoff, Google-only signup continuation, source/secret isolation and the desktop Three.js canvas. User-supplied HTML in messages was rendered as text. The actual Clerk React SDK also loaded at desktop and phone sizes, and its Google button reached Google's authorization screen. The automated suites do not establish real Google account consent, callback exchange or production deployment. Complete the manual Google login on the regular local server to verify that last provider-dependent step.

## Quiet workspace refinement

The app workspace and public trace use forest gradients and a subtle procedural grain texture instead of full-screen photography. Produce/farm photos stay within their cards and profiles. The refinement in `src/refinement.css` increases supporting type sizes, establishes clearer heading/price hierarchy, and spaces related information together. Mobile trading actions remain accessible within their panel; dialog actions stay visible while scrolling. Offer/counteroffer forms display a live kg × ₹/kg total before submission, while the server remains authoritative for accepted trade totals.

The video reference was visually reviewed using 54 frames across its 13:31 duration, including product imagery comparisons, spacing/type refinements, price/quantity regrouping and persistent purchase controls. Its narration could not be retrieved, so no claim of full audio review is made. The adaptation uses honest farm/quality labels rather than inventing reviews, urgency or certification. Reference video and analysis captures remain local and ignored.

Validation: TypeScript and the complete React browser trade suite passed at 1440, 390 and 360 px, including responsive overflow, keyboard-height dialogs, live offer totals, negotiation, account isolation, persisted reload and QR decoding.

## Loading improvements

Route code is loaded on demand, the optional desktop 3D scene waits until authentication is ready, and the Node server compresses text assets and caches versioned bundles. The initial script transfer in a fresh local browser fell from about 904 KB to 141 KB; total measured local script transfer was about 357 KB. Actual Clerk Google sign-in became ready in 1.5–2 seconds in the measured desktop/phone runs; provider/network conditions can vary and the originally reported indefinite delay was not reproduced.

Backend verified Google profile lookups are deduplicated and cached for at most 60 seconds per process (bounded to 500 entries; failures are evicted). Session active/revoked checks and JWT signature/origin verification still run for every request; marketplace roles/permissions still come from the database. Token retrieval and API requests are bounded, and stalled Clerk startup displays a retry prompt after 12 seconds. Token/security tests verify that repeated requests reuse the profile while still checking sessions and rejecting revoked tokens.
