# Team Plan + Extension + Website Save — Implementation

Adds a **Personal vs Team** save destination to every save path (website + Chrome extension), with quick-save (remembered destination) and team membership/permission checks — **only new functionality, nothing removed, existing private saves byte-identical**.

> **Architecture note — teams per user:** ContextOS models **one team per user** (`organizations.owner_user_id` is unique; a user belongs to a single org). So the spec's "select among multiple teams" reduces to a single team — no team picker is needed today. The backend was still made **forward-compatible** with an explicit `team_id`, so multi-team can be added later without API changes.

---

## 1. Exact files modified
| File | Change |
|---|---|
| `backend/app/api/v1/endpoints/memories.py` | `create_memory` accepts optional `team_id`; validates the caller is a member of that exact team + active plan (also added in the prior task: `?scope=personal\|team` and creator fields). |
| `extension/background.js` | Team-save context menus, remembered destination (quick-save), `visibility` on saves, `TEAM_INFO`/`GET`/`SET_SAVE_DESTINATION` messages, cached team lookup. |
| `frontend/src/pages/SaveMemoryPage.tsx` | Quick-save: remembers the last destination in `localStorage`; no longer resets to Personal after each save. |
| *(prior task, same feature family)* `frontend/src/pages/MemoriesPage.tsx`, `components/team/TeamMemories.tsx`, `services/memory.service.ts`, `hooks/useMemories.ts` | Personal/Team separation, 🔒/👥 labels, Team Memories workspace. |

No DB migration files needed — the required columns already exist.

## 2. Database changes
**None required.** The schema already has everything the spec asks for:
- `documents.visibility` (`"private"` / `"team"`, default `"private"`),
- `documents.org_id` (nullable — the `team_id`),
- `documents.user_id` (the `created_by`).

Existing personal records are untouched (`visibility` defaults to private, `org_id` stays null). 100% backward compatible.

## 3. Backend API changes (additive, backward compatible)
- `POST /api/v1/memories` now accepts optional `visibility: "private"|"team"` (already added previously) **and** optional `team_id`.
  - `visibility` omitted / `"private"` → saved exactly as before (personal, private).
  - `visibility:"team"` with no `team_id` → saved to the caller's own team (must be an active member).
  - `visibility:"team"` with `team_id` → saved to that team **only if the caller is a member** and the team plan is active; otherwise `403`.
- `GET /api/v1/memories?scope=personal|team|all` (default `all` = legacy mixed → extension & old clients unchanged).
- Existing request shapes still work verbatim — no breaking changes.

## 4. Frontend changes
- **Save form** already had a "Share with team" selector (Team plans only). Added **quick-save**: it remembers the last destination (`localStorage["ctxos:saveDestination"]`) and defaults to it next time.
- **Memories page** shows only the user's **private** memories (`scope=personal`) with a 🔒 **Private** / 👥 **Team** badge.
- **Team page** has a dedicated **Team Memories** section (`scope=team`) showing shared memories with creator name/avatar, date, and search.

## 5. Chrome Extension changes (`background.js`)
- New context-menu items: **"Save selection to Team"** and **"Save this page to Team"** (the original "Save to ContextOS" items remain Personal — unchanged).
- **Quick-save:** the chosen destination is remembered in `chrome.storage.local` (`saveDestination`). Saving via a Team item sets it to `team`; via a Personal item sets it back to `personal`. `SAVE_MEMORY` (used by the in-page panel and popup) defaults to the remembered destination, so once you pick Team, subsequent saves stay Team until you change it — matching the spec's "Last Save = Team → next save selects Team."
- **No extra API call on the save path:** team membership is cached in-memory for 5 minutes (`getActiveTeam`).
- New messages for the popup/in-page UI to build a toggle when ready: `TEAM_INFO` (returns `{hasTeam, team, destination}`), `GET_SAVE_DESTINATION`, `SET_SAVE_DESTINATION`.
- Personal payloads are byte-identical to before (no `visibility` field) → existing behavior preserved.
- **Note:** the extension must be **repackaged/reloaded** (and republished to the Web Store) for users to get these menus. The big in-page panel (`content.js`) and popup UIs were intentionally **not** rewritten — they already route through `SAVE_MEMORY`, so they inherit the remembered destination; an explicit in-panel toggle can be added later via the new messages without backend changes.

## 6. Permission & security checks (enforced server-side on every save)
- **Authentication:** Clerk JWT (website) or `X-Api-Key` (extension) → resolves the user id.
- **Team membership:** team saves require an `OrganizationMember` row for the caller (and the exact `team_id` when supplied). You **cannot save into a team you don't belong to** — returns `403`.
- **Active subscription:** `org_team_active()` requires the team owner's plan to be `team`/`founder`; lapsed plans block new team saves.
- **Isolation (reads):** `GET /memories` derives `org_id` from the caller's membership server-side; team scope only returns that team's shared memories — never another team's, never others' private memories.
- **Delete:** `DELETE /memories/{id}` is still scoped to `user_id == caller` (members can only delete their own).

## 7. Testing checklist
- [x] Personal users: no team option appears (website selector hidden when plan ≠ team); extension team menus 403 → not on a team. *(code-verified)*
- [x] Team-plan users: Personal + Team options on website; Team context menus work in the extension. *(code-verified)*
- [x] Personal memories stay private (`user_id == caller`, no team leakage). *(query-verified)*
- [x] Team memories appear only in the correct team (`org_id` derived server-side). *(query-verified)*
- [x] Team memories do NOT appear in Personal Memories (`scope=personal`). *(verified)*
- [x] Saving into a team you don't belong to → 403. *(code-verified)*
- [x] Existing memories & APIs unchanged; personal save payload byte-identical. *(verified)*
- [x] Quick-save remembers last destination (website `localStorage`, extension `chrome.storage`). *(verified)*
- [x] Backend `py_compile` + app import OK (47 routes); extension `node --check` OK; frontend `tsc` clean.
- [ ] **Run once on a live Team-plan account:** member A saves a Team memory → member B sees it in Team Memories but not in Personal; an unrelated team sees nothing. (Needs a paid Team account + live DB.)
- [ ] Repackage the extension and reload it to pick up the new context menus.

## Multiple teams (future, no breaking changes needed)
The backend already accepts `team_id` and validates membership in that specific team. To enable multiple teams later: allow a user to belong to >1 org (relax `get_org_for_user`/`get_user_org_id` to return a list), add a team `<select>` to the save form and an extension submenu, and pass `team_id`. No change to the save contract.
