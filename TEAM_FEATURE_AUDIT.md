# ContextOS — Team Feature Verification & Memory Visibility Enhancement

**Method:** Every verdict below is from reading the actual implementation (models, services, endpoints, React pages) — nothing assumed. Code references are included. Runtime behaviour that requires a live DB + paid Team plan is verified by code logic; noted where end-to-end runtime confirmation is still recommended.

In ContextOS a **"Team" = Organization** (`organizations` table). One org per owner; members join via unguessable invite tokens; memories with `visibility="team"` and `org_id` set are the shared/team memories.

---

## PART 1 — Verification (PASS / FAIL per section)

### 1. Team Creation — **PASS** (1 exception)
- Create team: `org_service.create_organization()` ✓
- Name saved: `Organization.name` ✓
- **Description saved: FAIL** — there is no `description` field on `Organization` or `CreateOrgRequest`. The feature does not support a team description.
- Owner assigned: `owner_user_id` + an `OrganizationMember` row with `role="owner"` ✓
- Team ID unique: UUID primary key (`UUIDMixin`) + `owner_user_id` is `unique=True` (one org per user) ✓

### 2. Team Subscription — **PASS** (design note)
- Buying the Team Plan activates immediately: `/billing/verify` + `/reconcile` set `plan="team"`; `org_team_active()` reads the owner's live plan ✓
- Status Active, expiry stored, billing correct, auto-renew: all on `user_subscriptions` (`status`, `current_period_end`, `auto_renew`) + `payments` ✓
- **Note:** there is no separate "team subscription" entity — the team is "active" while the **owner's** personal plan is `team`/`founder`; members inherit access and lose it automatically on cancel/expiry (`org_team_active`). This is a valid design, just not a per-team billing row.

### 3. Team Members — **PASS** (1 note)
- Invite: `create_invite()` (token-based) ✓ · Join: `accept_invite()` ✓ · Appear on Team page: `_serialize_org` returns members with names/emails ✓
- Duplicate prevention: existing pending invites for the same email are expired, `OrganizationMember` has a `UniqueConstraint(org_id, user_id)`, and `accept_invite` rejects already-members ✓
- Remove member: `remove_member()` (owner can't remove self) ✓
- **Note:** the invite token is **not bound to the invited email** — any authenticated user who has the link can join. Fine for link-sharing, but it's not an email-restricted invite.

### 4. Shared Memories — **PASS** (after this enhancement; was PARTIAL)
- Members can access team memories: `list_memories` team branch (now also `?scope=team`) ✓
- Personal/private stay private: filter is `user_id == caller AND visibility != "team"` ✓
- Team memories visible only to team members: `org_id == caller's org AND visibility == "team" AND owner plan active` ✓
- Visible to all members after refresh (no real-time, acceptable): re-fetch shows new shared memories ✓
- Not visible to other teams: enforced by `org_id` derived **server-side** from the caller's membership ✓
- **Team memories must NOT appear in Personal Memories:** previously they were returned **mixed** in `/memories` (FAIL). **Fixed** in this enhancement — the Memories page now requests `?scope=personal` (private only); team memories live in the new Team Memories section. ✓

### 5. Memory Visibility Rules — **PASS**
- Private → only owner (`user_id == caller`) ✓ · Team → all members of the same org ✓ · Other teams → never (org isolation) ✓

### 6. Permissions — **PARTIAL**
- Owner: Create ✓ · Invite ✓ (`owner_user_id` check) · Remove ✓ (owner-only) · **Delete Team: FAIL — no delete-org endpoint exists** · **Edit Team (rename): FAIL — no update-org endpoint exists**
- Member: View team ✓ · View team memories ✓ · Create team memories ✓ (if plan active) · Cannot perform owner actions ✓ (403 on invite/remove/revoke)
- **Note:** memories support create + delete only — there is **no edit/update memory endpoint** (so "last updated" never changes and "edit your own memory" isn't possible yet).

### 7. Security — **PASS** (2 minor notes)
- Cross-team access via ID manipulation: **prevented** — `org_id` is always derived from the caller's own `OrganizationMember` row, never accepted from the client. There is no `GET /memories/{id}` single-fetch, and `DELETE /memories/{id}` is scoped to `user_id == caller`.
- Membership verified before returning team memories ✓ · IDs unguessable (UUID + `secrets.token_urlsafe(32)`) ✓ · All org endpoints authorize owner-only actions ✓
- **Minor:** (a) invite link not email-bound (see §3); (b) `documents.org_id` has **no foreign key** to `organizations` (see §8).

### 8. Database — **PASS** (1 note)
- Users ↔ Teams: `Organization.owner_user_id` FK ✓ · Teams ↔ Members: FK + unique ✓ · Members ↔ Users: FK ✓ · Subscription: via owner's `user_subscriptions` ✓
- Cascade deletes configured on org/member/invite (no orphaned members/invites) ✓
- **Note (orphan risk):** Team Memories link to a team via `documents.org_id`, which is a plain indexed string **without a FK/cascade**. If an org were deleted, its team memories would keep a dangling `org_id`. Low risk today because **no delete-org endpoint exists**, and dangling rows are inaccessible (no membership matches), but it should get a FK or cleanup if delete-team is added.

### 9. UI — **PASS** (after this enhancement; was PARTIAL)
- Team page loads, members displayed, empty state (create-team form), loading spinner, server-unreachable banner: all present ✓
- **Team memories displayed: previously FAIL (no section).** **Fixed** — new `TeamMemories` section on the Team page (search, creator avatar/name, date, expand/collapse, empty + loading states). ✓
- Console/network errors: the cross-cutting 500s were fixed earlier (CORS handler + `user_subscriptions` column backfill); Team page degrades gracefully when offline.

### 10. Performance — **PASS** (1 note)
- Team page: 2 calls (`GET /organizations`, `GET /organizations/invites`); Team Memories: 1 call. No duplicate queries; `get_org_for_user` uses `selectinload` (no N+1). Team memory list is a single indexed query with one `JOIN users` for creator names.
- **Note:** memory lists use `limit=100` with **no pagination/infinite scroll**. Fine at the current 5-seat cap, but add pagination if teams/memories grow large.

---

## PART 2 — Final report

**Overall completion:** Core Team feature ≈ **90%** as found; ≈ **95%** after this enhancement.

**Section results:** 1 PASS\* · 2 PASS · 3 PASS · 4 PASS (post-fix) · 5 PASS · 6 PARTIAL · 7 PASS · 8 PASS · 9 PASS (post-fix) · 10 PASS. (\* = minor exception)

**Bugs found**
1. Team memories appeared inside Personal Memories (mixed list). **Fixed** (scope separation).
2. No Team Memories UI anywhere. **Fixed** (new section).

**Security issues**
- None critical. Server-side derivation of `org_id` + membership checks make team data safe against ID tampering. Minor hardening: bind invites to the invited email; add a FK on `documents.org_id`.

**Missing functionality (pre-existing, not regressions)**
- Team **description** field. · **Delete Team** + **Edit/rename Team** endpoints. · **Edit/update memory** endpoint (only create/delete today). · Email-bound invites. · Pagination on memory lists.

**Recommended fixes (future, low-risk)**
- Add `Organization.description` (nullable) + expose in create/edit. · Add `DELETE /organizations` (owner-only, cascade team docs) and `PATCH /organizations` (rename). · Add `PATCH /memories/{id}` (creator-only) to enable edit + real "last updated". · Add a FK/cleanup for `documents.org_id`. · Add cursor pagination to `/memories`.

**Production readiness score: 8 / 10** — secure, correctly isolated, performant core. Points off for missing delete/edit-team, no memory edit, and the soft `org_id` link.

**Would you deploy this Team feature to production? YES** — the create → subscribe → invite → join → shared-memory → isolation path is functionally complete and secure, and the enhancement closes the personal/team separation gap. Treat the "Missing functionality" items as a fast-follow backlog, not blockers.

---

## PART 3 — Memory Visibility enhancement (implemented, backward compatible)

Added as a **new capability only** — no existing feature removed, no UI redesign, existing private memories untouched (no data migration needed; `visibility`/`org_id` columns already existed and default to private/null).

**Backend — `backend/app/api/v1/endpoints/memories.py`**
- `GET /memories` gains an optional `scope` param: `personal` (caller's private only), `team` (the caller's active-team shared memories, with creator name/email via a `JOIN users`), or omitted/`all` (legacy mixed behaviour — **unchanged default**, so the Chrome extension and any existing caller keep working).
- `MemoryOut` gains additive optional fields `user_id`, `creator_name`, `creator_email` (null for personal listings).
- Team-scope membership and active-plan are derived from the authenticated caller — a client cannot request another team's memories.
- Create-memory logic was already correct (validates active team membership before allowing `visibility="team"`) and is unchanged.

**Frontend**
- `services/memory.service.ts`, `hooks/useMemories.ts`: pass `scope` through; `Memory` gains `creator_name`/`creator_email`.
- `pages/MemoriesPage.tsx`: requests `scope="personal"` so **team memories no longer appear in Personal Memories**, and each card shows a 🔒 Private / 👥 Team visibility badge.
- `components/team/TeamMemories.tsx` (new) + `pages/TeamPage.tsx`: a dedicated **Team Memories** section showing shared memories only, with creator avatar/name, created date, search, expand/collapse, and empty/loading states.
- `pages/SaveMemoryPage.tsx` already provides the visibility selector ("Share with team", shown only for Team plans) — left as-is.

**Verification:** backend `py_compile` + full app import OK (47 routes); frontend `tsc --noEmit` clean. End-to-end runtime check (create a team memory, confirm it shows for a second member and not in their Personal list, and not for an unrelated team) should be run once on the deployed Team-plan environment.
