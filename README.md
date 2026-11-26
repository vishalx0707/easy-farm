# EasyFarm local marketplace

Run `npm install` and `npm start`, then open http://127.0.0.1:3000/app.html.
The landing page, HeroLoop media and `/film-script` page are separate and preserved.

## Glass workspace revision

The app now uses a single viewport frame with translucent olive acrylic surfaces, a cream lot record, restrained lime actions, simple line icons and no decorative action arrows. Longer catalogue and order views scroll inside the workspace. Phones have a separate persistent bottom bar with five labelled icons: Home, Crops/Produce, Offers, Orders and Messages. The desktop keeps its sidebar. This takes the simple app navigation idea from Cal AI and adapts it to farm trading. The marketing page and its footage are unchanged.

The built-in ImageGen tool created `assets/greenhouse-workspace.png`. Prompt: “Wide editorial greenhouse photograph; male grower in muted olive shirt and faded brown cap on the right inspecting a red bell pepper; defocused olive foliage and greenhouse structure on the left for interface content; natural daylight; documentary realism; no text, UI, logos or watermark.” This is illustrative generated background photography, not a photograph of a listed farm.

## Cloudflare hosting

This project is prepared for **Cloudflare Workers**, with static assets and a SQLite-backed Durable Object. The Node and Cloudflare servers use the same `marketplace-domain.cjs` rules. The Cloudflare database is persistent storage, not an ephemeral Worker filesystem. One object coordinates this demo marketplace's inventory and orders; a separate marketplace name would receive a separate object.

- `npm run build` creates `dist/` with browser assets only.
- `npm run dev:cloudflare` runs the app at http://127.0.0.1:8787 with local persistent Cloudflare storage.
- `npm run check:cloudflare` bundles the Worker and checks deployment packaging without deploying.
- `npm run deploy` deploys to the account authenticated with Wrangler. No remote deployment has been performed.

`wrangler.jsonc` includes the asset binding, Durable Object binding and SQLite migration. Cloudflare provisions that object namespace on the first deployment. Deploying starts with a separate seeded database; it does not upload the private Node database. The optimized HeroLoop films are included. Downloaded raw source footage remains intact locally and is excluded from the repository and deployment bundle. No Vercel or Netlify deployment configuration is included.

The full browser trade suite also passed in Wrangler's local Workers runtime at 1440, 390 and 360 pixels, including real PNG QR decode, simulated payment, touch navigation and reduced-height messaging. A dry-run build alone is not treated as runtime verification. Cloudflare uses the public host in trace URLs after deployment; local loopback QR links require the local computer.

## Workspaces

Switch between grower and buyer in the header. Growers select an active farm, edit profiles, publish and edit available lots, compare incoming offers, negotiate in their message threads, accept terms and advance delivery. Buyers search/filter produce, view farms and lots, propose quantity/price/pickup terms, negotiate, track orders and record sample payments. Detail URLs survive reload. The phone workspace menu opens every section without horizontal navigation.

This is a shared local demonstration, with no login or account isolation. The role and active farm selectors choose demo workspaces; they do not authenticate users. Seeded people, farms and market prices are illustrative. Photography represents farms and produce rather than verifying an individual lot.

## Persistence and integrations

- Listings, farm profiles, offers, messages, accepted orders, delivery events and sample payment status are saved atomically in `.easyfarm/market.json`. Set `EASYFARM_DATA_DIR` to use a separate database. Actions are serialized to prevent double stock reservation. Existing saved records are retained.
- Accepted offers reserve stock immediately. Orders progress through Accepted → Packed → Ready for pickup → Picked up → Delivered. Order history is ordinary persisted event data.
- QR images are real QR codes encoding a read-only order trace URL. The trace includes farm, crop, harvest date if supplied, grade, quality declaration, agreed terms, payment status and event history. The server binds to this computer's loopback address; a physical phone cannot reach it without additional network setup. QR decode/navigation was tested in the local browser.
- Payments are explicitly simulated. No payment processor is connected and no money moves.
- Quality is grower-declared unless a simulated sample check is recorded. No external inspector, certification provider or sensor is connected.
- Market charts use labelled illustrative sample values, not a live market feed.
- Messages are saved locally. No external messaging provider, push notification, carrier or dispatch integration is connected.
- No blockchain integration, hash-chain verification or blockchain UI remains. Older event records are converted to ordinary order history when read, retaining event details.

## Verification

Install dev dependencies and Chrome. In one terminal start an isolated server:

```powershell
$env:EASYFARM_PORT='3001'
$env:EASYFARM_DATA_DIR='C:/dev/easy farm/.easyfarm-test'
node server.js
```

In another terminal run `npm run test:browser`. It uses port 3001 by default; set `TEST_URL` to override. It creates clearly named QA lots in that separate database and does not reset existing data. Screenshots and the latest results are saved under `design/qa-*.png` and `design/verification-results.json`.

Verified at 1440, 390 and 360 pixels: publishing → search → offer → two-way messages → grower and buyer counteroffers → grower acceptance → all delivery milestones → simulated payment → reload → QR decode and read-only trace. Stock decreased exactly once and the browser reported no JavaScript errors. Phone menu navigation and a shortened viewport while focusing the message field also passed. This checks responsive browser behavior; a physical device's operating-system keyboard was not tested.

Additional API checks rejected duplicate acceptance, duplicate payment, unavailable quantity, invalid delivery progression and a wrong-farm quality update; persisted state stayed unchanged.
