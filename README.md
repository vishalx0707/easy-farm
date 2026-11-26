# EasyFarm local marketplace

Use Node 24 or later. Run `npm install` and `npm start`, then open http://127.0.0.1:3000/login.
The landing page, HeroLoop media and `/film-script` page are separate and preserved.

## Glass workspace revision

The app now uses a single viewport frame with translucent olive acrylic surfaces, a cream lot record, restrained lime actions, simple line icons and no decorative action arrows. Longer catalogue and order views scroll inside the workspace. Phones have a separate persistent bottom bar with five labelled icons: Home, Crops/Produce, Offers, Orders and Messages. The desktop keeps its sidebar. This takes the simple app navigation idea from Cal AI and adapts it to farm trading. The marketing page and its footage are unchanged.

The built-in ImageGen tool created `assets/greenhouse-workspace.png`. Prompt: “Wide editorial greenhouse photograph; male grower in muted olive shirt and faded brown cap on the right inspecting a red bell pepper; defocused olive foliage and greenhouse structure on the left for interface content; natural daylight; documentary realism; no text, UI, logos or watermark.” This is illustrative generated background photography, not a photograph of a listed farm.

## Cloudflare hosting

This project is prepared for **Cloudflare Workers**, with static assets and a SQLite-backed Durable Object. The Node and Cloudflare servers use the same `marketplace-domain.cjs` rules. The Cloudflare database is persistent storage, not an ephemeral Worker filesystem. One object coordinates this demo marketplace's inventory and orders; a separate marketplace name would receive a separate object.

- `npm run build` creates `dist/` with browser assets only.
- `npm run dev:cloudflare` creates an ignored local sign-in secret if needed, then runs the app at http://127.0.0.1:8787 with persistent local Cloudflare storage in `.wrangler/local`.
- `npm run check:cloudflare` bundles the Worker and checks deployment packaging without deploying.
- `npm run deploy` deploys to the account authenticated with Wrangler. No remote deployment has been performed.

`wrangler.jsonc` includes the asset binding, Durable Object binding and SQLite migration. Cloudflare provisions that object namespace on the first deployment. Deploying starts with a separate seeded database; it does not upload the private Node database. The optimized HeroLoop films are included. Downloaded raw source footage remains intact locally and is excluded from the repository and deployment bundle. No Vercel or Netlify deployment configuration is included.

Before a remote deployment, configure a strong `BETTER_AUTH_SECRET` with Wrangler's secret command. Local `.dev.vars` secrets are not uploaded automatically. Hosted authentication fails closed with a 503 response if the secret is missing. Authentication tables are migrated automatically on startup. No remote deployment has been performed.

## Google sign-in setup

Google is the only sign-in method. Email/password registration, sign-in and their forms are disabled. Actual Google OAuth credentials have **not** been configured in this workspace, so the Google button shows a clear unavailable state until connected.

1. Create a **Web application** OAuth client in Google Cloud Console and configure its consent screen/test users as appropriate.
2. Register exact authorized redirect URIs for each origin you use:
   - `http://127.0.0.1:3000/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` if using localhost
   - `http://127.0.0.1:8787/api/auth/callback/google` for local Cloudflare
   - `https://YOUR-HOST/api/auth/callback/google` for a hosted deployment
3. Add `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` to the ignored `.dev.vars` file alongside the existing `BETTER_AUTH_SECRET`, then restart Node or Wrangler. `.dev.vars.example` shows variable names with placeholders; keep the existing generated signing secret. Node also accepts these variables directly from its environment.
4. For hosting, configure all three variables using Cloudflare secrets. `.dev.vars` is local and is not deployed. No secret values belong in Git or browser JavaScript.

The provider uses the current request origin for its OAuth callback. Origins and redirect URIs must match exactly. Better Auth performs the authorization-code exchange and validates OAuth state. This app does not fake a successful Google sign-in when credentials are absent. Google selects the account; first-time users then complete their portal/farm/business profile. Returning users keep their existing role.

The full browser trade suite also passed in Wrangler's local Workers runtime at 1440, 390 and 360 pixels, including real PNG QR decode, simulated payment, touch navigation and reduced-height messaging. A dry-run build alone is not treated as runtime verification. Cloudflare uses the public host in trace URLs after deployment; local loopback QR links require the local computer.

## Buyer and grower portals

Start at `/login?portal=buyer` or `/login?portal=grower` and choose **Continue with Google**. New Google accounts are initially pending and cannot access marketplace actions. After Google returns, users choose their buyer/grower portal and enter their business/farm name and location. The server assigns that role once, using an atomic conditional update. Returning accounts go straight to their existing portal, including when someone enters through the other portal's sign-in screen. The account button opens account details and sign-out; there is no role-switch control.

- `/buyer`: produce discovery, farm profiles, the buyer's own offers/conversations, purchases, payment status and delivery tracking. The home screen shows a buying desk with open offers, active orders and the next pickup.
- `/grower`: an owned farm created from registration, harvest publishing, incoming buyer offers, buyer business identities, negotiation, sales orders and fulfillment. The home screen starts with the grower's farm and harvest rather than produce sourcing. The farm selector contains only that account's farms; “Manage farms” allows additional owned profiles.
- Phone navigation remains role-specific: Home, Crops/Produce, Offers, Orders and Messages. The desktop retains its sidebar. Detail URLs and sessions survive reload.

Better Auth handles Google OAuth, signed HttpOnly session cookies, sign-out and persistent database rate limits. Sessions last seven days. The server derives identity/role from the session and checks farm ownership and trade participation for every write. State responses contain only the signed-in account's private offers, messages, orders and history; public produce and farm profiles are shared for discovery. Changing a query string or submitting a different role does not grant access. The account role cannot be changed after profile completion.

Google supplies identity and its email-verification status. App-managed password reset, password sign-in and multifactor authentication are not enabled. Existing local users, stored credentials and marketplace data remain intact; existing sessions are not forcibly revoked. There are no shipped demo credentials. Sign-in with a real Google account remains unverified until OAuth credentials are connected and the complete provider exchange is exercised.

Seeded profiles and unowned legacy listings remain preserved as labelled samples, viewable by buyers but unavailable for real offers. New grower accounts do not inherit other farms or legacy private records. Photography represents farms and produce rather than verifying an individual lot.

## Persistence and integrations

- Listings, farm profiles, offers, messages, accepted orders, delivery events and sample payment status are saved atomically in `.easyfarm/market.json`. Set `EASYFARM_DATA_DIR` to use a separate database. Actions are serialized to prevent double stock reservation. Existing saved records are retained.
- Local accounts and sessions are stored in `.easyfarm/accounts.sqlite`; the generated local signing secret is stored in `.easyfarm/auth-secret`. Cloudflare stores authentication tables alongside market data in its SQLite-backed Durable Object. Database files, secrets and QA fixtures are excluded from Git and the static build.
- Accepted offers reserve stock immediately. Orders progress through Accepted → Packed → Ready for pickup → Picked up → Delivered. Order history is ordinary persisted event data.
- QR images are real QR codes encoding a public read-only order trace URL. Trace responses omit buyer identity and private messages. They include farm, crop, harvest date if supplied, grade, quality declaration, agreed terms, payment status and event history. Newly created lot/offer/order IDs use full random UUIDs. The local Node server binds to loopback; a physical phone cannot reach it without additional network setup.
- Payments are explicitly simulated. No payment processor is connected and no money moves.
- Quality is grower-declared unless a simulated sample check is recorded. No external inspector, certification provider or sensor is connected.
- Market charts use labelled illustrative sample values, not a live market feed.
- Messages are saved locally. No external messaging provider, push notification, carrier or dispatch integration is connected.
- No blockchain integration, hash-chain verification or blockchain UI remains. Older event records are converted to ordinary order history when read, retaining event details.

## Verification

Install dev dependencies and Chrome. In one terminal start an isolated server:

```powershell
$env:EASYFARM_PORT='3002'
$env:EASYFARM_DATA_DIR='C:/dev/easy farm/.easyfarm-auth-test'
node server.js
```

In another terminal run `npm run test:browser`. It uses port 3002 by default. The test-only `tools/auth-fixture.cjs` creates isolated users and signed session fixtures directly in the local test SQLite database to stand in for Google's completed callback. It is not served as an HTTP route or imported by the application. The suite then exercises the real profile-completion endpoint and marketplace. These fixtures do **not** test Google's network exchange. Set `EASYFARM_TEST_DATA_DIR` if changing the isolated Node database location. No production database or remote target is permitted for fixtures. Screenshots and results are saved under `design/qa-*.png` and `design/verification-results.json`.

For manual Cloudflare QA, use a separate storage directory: run `node tools/dev-secret.cjs`, `npm run build`, then `npx wrangler dev --port 8788 --persist-to .wrangler/auth-tests`. Configure real Google credentials and its exact callback URI before signing in. The direct SQLite fixture harness supports Node only. Keep QA accounts and produce out of the normal local marketplace.

Current Google-only revision: the UI was reviewed at 1440, 390 and 360 pixels; there are no email/password inputs, and missing Google configuration disables sign-in honestly. `npm run test:google` checks a Google authorization redirect with dummy provider credentials, state cookies, callback URI, invalid-state rejection, disabled email/password endpoints, missing-credentials response and one-time portal completion. It uses an in-memory isolated database and does not contact Google to sign in.

The Node browser suite passed at all three widths using isolated session fixtures: profile completion → portal routing → publishing → buyer discovery → offer → messages → counteroffers → acceptance → delivery milestones → simulated payment → reload → QR decode → sign-out → returning-session routing. Stock decreased once, and browsers reported no JavaScript errors. Phone navigation and reduced-height messaging passed. The preceding email/password revision was also tested in Cloudflare's local runtime; that historical result does not establish a completed Google OAuth exchange.

Separate buyer and grower fixture accounts were unable to see private trade records, message another trade, edit another farm, pay another order or update its delivery. A buyer submitting a forged grower role remained a buyer. Public trace records exposed no buyer identity or messages. `tools/check-session.cjs prepare|verify <url>` supports isolated Node session restart/replay checks. Real Google account consent, token exchange and provider account linking remain to be tested with configured credentials.
