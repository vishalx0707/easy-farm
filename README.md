# EasyFarm

A local B2B farm marketplace with separate buyer and grower portals, Google-only Clerk authentication and Cloudflare Workers hosting support. Use Node 24 or later.

```powershell
npm install
npm start
```

Open [EasyFarm sign-in](http://127.0.0.1:3000/login). The marketing landing page, HeroLoop footage and `/film-script` page are preserved.

## Authentication

The workspace is linked to the connected Clerk **development** application. Google is enabled; email sign-in, email sign-up and passwords are disabled in that instance. The tracked `clerk-config.json` documents these settings without credentials. There is no shipped demo login or alternative password endpoint.

Local keys live in the ignored `.dev.vars` file. To provision another checkout, link the intended Clerk app and pull its development keys:

```powershell
npx -y clerk@latest link --app YOUR_APP_ID
npx -y clerk@latest env pull --file .dev.vars --instance dev
```

The required variables are `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`; see `.dev.vars.example`. Node reads `.dev.vars` and `.env.local`, with existing process variables taking precedence. Wrangler reads `.dev.vars`. Restart the server after changing keys. The CLI doctor checks `.env.local` rather than `.dev.vars`, so its missing-env warning alone does not mean this app lacks keys.

Clerk's browser SDK handles Google authorization, callback, session refresh and sign-out. The API validates the SDK's bearer session token using `@clerk/backend`, restricts its authorized party to the request origin, checks that the remote session is active and requires a Google-linked account with a verified primary email. Browser role values and Clerk user metadata never grant marketplace permissions. Only the publishable key is returned to the browser.

New users complete their farm/business name, location and buyer/grower role after Google returns. That role is assigned once in the marketplace database. Returning accounts open their assigned portal even when entering through the other portal's login screen. `/buyer` and `/grower` share inventory while private offers, conversations, orders and history remain scoped to their participants.

The development instance uses Clerk's shared Google development credentials. A production release requires a Clerk production instance, an owned domain and production Google OAuth configuration in Clerk. No production auth instance or hosted release has been configured. Clerk's Google redirect opens successfully; completion with a real Google account is a separate manual check and is not established by the fixture tests below.

## Cloudflare

The project is configured for the connected Cloudflare account in `wrangler.jsonc`. It uses Workers Static Assets plus a SQLite-backed Durable Object. The Node and Worker backends share `marketplace-domain.cjs` and the authenticated API service. One object coordinates this demo marketplace, serializing stock reservation and keeping persistent profiles and trade records.

- `npm run build` copies browser assets into `dist/`, excluding credentials, databases, server source and raw footage.
- `npm run dev:cloudflare` runs at [127.0.0.1:8787](http://127.0.0.1:8787/login) with persistent local storage in `.wrangler/local`.
- `npm run check:cloudflare` validates packaging without deploying.
- `npm run deploy` is the explicit remote deployment command. It has not been run.

Local `.dev.vars` files are not uploaded automatically. Before an authorized deployment, provision the intended instance's Clerk keys securely as Worker secrets and configure its application domain. Missing keys cause protected APIs to fail closed. The SQLite migration and binding are tracked. First deployment initializes a separate seeded marketplace; it does not upload the private Node database. No Netlify configuration is included.

## Portals and presentation

The workspace follows `design/app-references/01-primary-ui.png`: translucent olive acrylic surfaces, cream lot records, restrained lime actions and quiet line icons. Desktop uses a persistent sidebar; phone layouts use five labelled bottom icons for Home, Crops/Produce, Offers, Orders and Messages. Catalogue and order views scroll within the workspace. Forms, filters, messaging and delivery timelines support narrow phone screens.

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
npm run test:auth
npm run test:browser
npm run test:worker
```

`test:auth` uses the real Clerk backend SDK with a generated RSA test key, isolated fake provider records and an ephemeral test server. It verifies signature rejection, expiry, origin binding, session revocation, one-time profile completion, CSRF checks, disabled legacy auth endpoints, persistence round-trip and strict legacy Google account matching. Fixtures are never imported by the running application or served as endpoints.

`test:browser` starts its own isolated server. It uses signed fixture tokens and a mocked browser Clerk session to test the actual app/API at 1440, 390 and 360 pixels: profile completion, portal routing, harvest publishing, buyer discovery, offer, messages, counteroffers, acceptance, delivery, simulated payment, reload, QR decode, sign-out and returning-session routing. It checks account isolation, role spoofing rejection, single stock reservation, mobile navigation, overflow and reduced-height messaging. Callback tests ensure EasyFarm preserves Clerk's provider-return parameters. Screenshots and results are written under `design/qa-*.png` and `design/verification-results.json`.

`test:worker` bundles the actual Worker and runs it in Cloudflare's local workerd/Miniflare runtime with SQLite persistence isolated under `.wrangler/worker-fixtures`. It tests profile ownership, trade, messaging, single stock reservation, payment/delivery records, public trace privacy, QR decoding and persistence after the runtime restarts. Internal RPC receives fixture identities, so this validates Worker storage/domain behavior rather than the Google exchange.

All three suites passed for this revision. The actual Clerk browser SDK also loaded at desktop and phone sizes, and its Google button reached Google's authorization screen. The automated suites do not establish real Google account consent, callback exchange or production deployment. Complete the manual Google login on the regular local server to verify that last provider-dependent step.
