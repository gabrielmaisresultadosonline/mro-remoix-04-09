# Architecture rules

- Instagram profile sessions must use collision-proof client IDs and preserve the selected username across cloud hydration, because multiple profiles can be restored in the same millisecond.
- Screenshot uploads must persist their cloud URL even when the auxiliary profile row does not exist yet, and login hydration must merge that auxiliary URL into active and archived sessions, because storage and profile registration can complete in either order.
- On the VPS, user session load/save must run natively in Express and hydrate screenshot URLs from `squarecloud_user_profiles`, because the Deno fallback can fail before the panel receives existing admin prints.
- Every VPS update must apply all committed additive SQL migrations and fail visibly on migration errors, because quick deployments must not leave session columns behind the application code.- Whitelabel billing must flow through the unified InfiniPay webhook via WLFEE/WLSALE NSU prefixes handled in _shared/whitelabel-core.ts, so reseller fees and link sales settle in one place.
