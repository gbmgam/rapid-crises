# QuantumLink Security Specification

## Data Invariants
- An Emergency must have a valid `userId` (the reporter).
- Users can only read their own Emergencies, unless they are `staff` or `admin`.
- `staff` can transition Emergency status but cannot change the original `userId` or `createdAt`.
- Logs are immutable (created only).
- User roles (`isAdmin`, `role`) cannot be changed by the user themselves after creation.

## The Dirty Dozen Payloads (Target: DENY)
1. **Identity Spoofing**: Create an emergency with someone else's `userId`.
2. **Privilege Escalation**: Update own profile to set `role: 'admin'`.
3. **Data Deletion**: Attempt to delete a resolved emergency as a guest.
4. **State Shortcutting**: Transition from `reported` to `resolved` without being `staff`.
5. **PII Scraping**: List all users as a guest.
6. **Resource Exhaustion**: Send a 1MB string in `aiClassification`.
7. **Orphaned Record**: Create an emergency referencing a non-existent `venueId`.
8. **Silent Update**: Modify `createdAt` on an existing emergency.
9. **Role Hijacking**: Create a user profile with `isVerified: true` manually.
10. **Cross-Tenant Access**: Access a venue's logs without being registered at that venue.
11. **Timestamp Forgery**: Provide a client-side timestamp for `updatedAt`.
12. **Tampering**: Attempt to update a Log entry.

## Status: DRAFT_firestore.rules in progress.
