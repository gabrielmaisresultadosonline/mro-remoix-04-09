# Architecture rules

- MRO training themes share the existing module data and welcome settings, with scoped styling and a browser-only layout preference, because presentation changes must not fork tutorials or authentication.

- The public Whitelabel activation offer lives in an isolated presentation page with scoped theme tokens and one shared contact link, because adding marketing must not alter reseller billing, existing links or global styling.

- Instagram profile sessions must use collision-proof client IDs and preserve the selected username across cloud hydration, because multiple profiles can be restored in the same millisecond.
- Screenshot uploads must persist their cloud URL even when the auxiliary profile row does not exist yet, and login hydration must merge that auxiliary URL into active and archived sessions, because storage and profile registration can complete in either order.
- On the VPS, user session load/save must run natively in Express and hydrate screenshot URLs from `squarecloud_user_profiles`, because the Deno fallback can fail before the panel receives existing admin prints.
- Every VPS update must apply all committed additive SQL migrations and fail visibly on migration errors, because quick deployments must not leave session columns behind the application code.
- Whitelabel billing must flow through the unified InfiniPay webhook via WLFEE/WLSALE NSU prefixes handled in _shared/whitelabel-core.ts, so reseller fees and link sales settle in one place.
- Whitelabel sales must render the original MRO and Renda Extra sales components with optional branding and checkout context, because videos and content must stay synchronized without changing affiliate behavior.
- The official annual offer must be shared by sales pages and Whitelabel billing, because displayed and charged prices must stay aligned.
- Whitelabel logos must use reseller-scoped signed storage uploads and server-validated paths, because one reseller must never overwrite another reseller's branding.

- MRO sales refreshes share presentation-only introductory and feature sections with a scoped semantic theme, because original videos, checkout handlers and affiliate attribution must remain unchanged.

- The promotional MRO route renders the official sales page with an explicit offer variant, because full content and configured videos must stay synchronized while promotional billing remains isolated.

- Large video uploads to the video-server must use the chunked upload routes (parts under 100MB), because the Cloudflare proxy rejects larger request bodies before they reach Nginx.

- Ao Vivo streaming runs natively in the VPS Express server (ffmpeg loop to RTMPS, files on local disk), because long-lived processes cannot run in edge functions.
- IG Online (`ig-online-api`) is served natively by the VPS Express server against the server's own PostgreSQL (server/src/functions/ig-online-native.ts), with the Deno function kept only as a fallback with the same JSON contract, because frequent extension pings must not depend on cold starts or external infrastructure.
- Shared sales wording lives in one language-keyed copy module whose default is the original language; a route opts into another language only through its own prop, because localizing one sales page must never reword the other sales routes.
- The Euro sales page keeps its own video settings and visit log behind a dedicated admin function, reusing the shared HLS player and video server, because Euro changes must not alter the promo video or its metrics.
- Video job tracking (stage, stall detection, retry) lives in the chunk-upload module the update already reinstalls, reading the real job.json/transcode.log, because progress must never be simulated and server.js must not be re-patched.
- IG Online approved-image gallery stores files on the VPS disk with PostgreSQL rows that expire after a fixed retention and are purged by the server itself, and the public gallery endpoint returns only image and caption, because the showcase must never expose client data or grow storage indefinitely.
- Embedded YouTube videos in sales popups open behind a click-to-play poster with a direct-watch fallback link, because autoplay without a user gesture is blocked on mobile and tracker-blocking extensions kill the embed iframe the moment the popup opens.
- Each Instagram profile has one server-side initial reference (ig_profile_baselines) written once by the first valid reading (analyzed print or extension metrics) and read by both the client panel and admin metrics, because the two views must never show diverging starting numbers and later prints must not rewrite history.
