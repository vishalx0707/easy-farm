# EasyFarm project preferences

- Complete requested changes, verify the affected flows, then commit and push to the configured EasyFarm GitHub remote at the end of each completed task. Do not force-push.
- Keep hosting ready for Cloudflare Workers. Do not add Netlify configuration. Production deployment is a separate action and has not been requested.
- Preserve the existing marketing landing page, HeroLoop footage and film-script page when working on the marketplace.
- Match `design/app-references/01-primary-ui.png`: translucent olive acrylic surfaces, cream lot records, restrained lime actions, quiet navigation, compact app layouts. Avoid repeated decorative arrows and long dashboard stacks.
- Mobile has its own persistent bottom icon navigation, inspired by the simplicity of Cal AI and adapted to EasyFarm trading. Preserve the desktop sidebar separately.
- Buyer and grower are separate authenticated portals (`/buyer`, `/grower`). Google is the only sign-in method through Better Auth; email/password authentication is disabled. New Google users complete their portal and farm/business profile once after OAuth. Account role is then fixed. Enforce ownership in the API, never from a submitted role or farm selector. Keep private offers/messages/orders scoped to their participants. QR trace records are public and read-only, with buyer identity and messages omitted.
- Keep blockchain out of the product. Use ordinary persistent order history.
- Label illustrative data, generated imagery and simulated payment/quality checks accurately. Do not imply production authentication, payment, inspection or live market integrations.
- Keep QA data isolated from the regular local database. Do not commit private database records, credentials, raw footage downloads or build output. Optimized runtime media is versioned.
