# NEW WORLD — Security Architecture Specification

## 1. Data Invariants
1. **Civilization & Resources Integrity**: Only authenticated, email-verified Founder/Admins (`isAdmin()`) may create, update, or delete `/civilizations/{civId}`, `/buildings/{buildingId}`, `/chronicles/{chronicleId}`, or `/news/{newsId}`. Standard citizens can never alter population, food, water, energy, treasury, health, education, or happiness directly.
2. **Decision & Results Integrity**: Only `isAdmin()` may create, update, approve, or close `/decisions/{decisionId}`. Voting options, deadlines, `winningOptionId`, and `status` cannot be modified by standard users.
3. **One-Vote-Per-Citizen Invariant**: Under `/decisions/{decisionId}/votes/{userId}`, the document ID MUST match `request.auth.uid`, the user must be verified (`email_verified == true`), the citizen account must not be suspended, the parent decision must exist with `status == 'active'` and `request.time < decision.endsAt`, and updates/deletes are strictly forbidden (`allow update, delete: if false`).
4. **Privilege Escalation Prevention**: On `/citizens/{userId}` creation, non-admins MUST set `role == 'citizen'`, `status == 'active'`, `votesCount == 0`, and `participationsCount == 0`. On update, non-admins can never change `role` or `status`, and can only increment `votesCount`/`participationsCount` by `+1` when atomically creating a vote or updating their display name/photo. `/admins/{userId}` is readable only by the owner or an admin and writable only by `isAdmin()`.
5. **PII Isolation**: User email addresses are stored exclusively in `/users_private/{userId}` where `read`/`write` is strictly restricted to `isOwner(userId) || isAdmin()`. Public `/citizens/{userId}` contains zero PII.
6. **Temporal Integrity & Size Bounds**: Every `createdAt`, `updatedAt`, `publishedAt`, `executedAt`, and `joinedAt` is verified against `request.time`, and every string and list enforces explicit `.size()` bounds.

## 2. Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. Standard user attempts `updateDoc('/civilizations/civ-newworld', { treasury: 9999999 })`.
2. Standard user attempts `updateDoc('/decisions/dec-1', { status: 'approved', winningOptionId: 'opt_a' })`.
3. Standard user attempts `setDoc('/decisions/dec-1/votes/otherUserUid', { userId: 'otherUserUid', ... })` (identity spoofing).
4. Standard user attempts `updateDoc('/decisions/dec-1/votes/myUid', { optionId: 'opt_b' })` (double vote / vote tampering).
5. Standard user attempts `setDoc('/decisions/dec-1/votes/myUid', ...)` when `decision.status != 'active'` or `request.time >= decision.endsAt`.
6. Unverified email user (`email_verified == false`) attempts to cast a vote or create a citizen record.
7. Standard user attempts `setDoc('/citizens/myUid', { ..., role: 'admin', votesCount: 500 })` (self-assigned privilege & fake score).
8. Standard user attempts `updateDoc('/citizens/myUid', { role: 'founder' })` (privilege escalation).
9. Standard user attempts `updateDoc('/citizens/myUid', { votesCount: 1000 })` (counter tampering beyond +1 atomic vote).
10. Standard user attempts `setDoc('/admins/myUid', { uid: 'myUid', ... })`.
11. Standard user attempts `getDoc('/users_private/otherUserUid')` or `list('/users_private')` (PII scraping).
12. Malicious user sends a Shadow Update containing an unexpected ghost field (`isVerified: true`) or oversized 10KB string on `/citizens/myUid` or `/decisions/dec-1/votes/myUid`.
