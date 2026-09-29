# Architecture rules

- Instagram profile sessions must use collision-proof client IDs and preserve the selected username across cloud hydration, because multiple profiles can be restored in the same millisecond.
- Screenshot uploads must persist their cloud URL even when the auxiliary profile row does not exist yet, because storage and profile registration can complete in either order.