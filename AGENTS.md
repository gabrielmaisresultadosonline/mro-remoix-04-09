# Architecture rules

- The public Whitelabel activation offer lives in an isolated presentation page with scoped theme tokens and one shared contact link, because adding marketing must not alter reseller billing, existing links or global styling.

- Instagram profile sessions must use collision-proof client IDs and preserve the selected username across cloud hydration, because multiple profiles can be restored in the same millisecond.
- Screenshot uploads must persist their cloud URL even when the auxiliary profile row does not exist yet, and login hydration must merge that auxiliary URL into active and archived sessions, because storage and profile registration can complete in either order.
- On the VPS, user session load/save must run natively in Express and hydrate screenshot URLs from `squarecloud_user_profiles`, because the Deno fallback can fail before the panel receives existing admin prints.
- Every VPS update must apply all committed additive SQL migrations and fail visibly on migration errors, because quick deployments must not leave session columns behind the application code.
- Whitelabel billing must flow through the unified InfiniPay webhook via WLFEE/WLSALE NSU prefixes handled in _shared/whitelabel-core.ts, so reseller fees and link sales settle in one place.
- Whitelabel sales must render the original MRO and Renda Extra sales components with optional branding and checkout context, because videos and content must stay synchronized without changing affiliate behavior.
- The official annual offer must be shared by sales pages and Whitelabel billing, because displayed and charged prices must stay aligned.
- Whitelabel logos must use reseller-scoped signed storage uploads and server-validated paths, because one reseller must never overwrite another reseller's branding.
