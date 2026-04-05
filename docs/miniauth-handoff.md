# MiniAuth Migration Handoff For MiniTickets

## Purpose

Use this handoff when moving MiniTickets from app-local auth toward MiniAuth as the shared identity and session layer.

The goal is a calm migration:

- keep MiniTickets working
- move identity and session concerns first
- keep workspace authorization local
- avoid turning the migration into a broad rewrite

## Core Boundary

MiniAuth should own:

- email identity
- password hashes
- account active or inactive state
- password setup flows
- email-code login challenges
- shared sessions
- shared preference values for locale, theme, and accent, if enabled
- app access grants such as `minitickets`
- shared workspace identity
- shared workspace memberships

MiniTickets should keep owning:

- app-specific workspace fields and behavior
- ticket permissions
- ticket assignments
- app-specific notification settings
- app-specific UI implementation
- app-specific theme rendering details

MiniAuth answers:

- who is this user?
- is this account active?
- does this user have access to MiniTickets?
- what shared preferences should be applied?
- what shared workspaces exist?
- which shared workspaces does this user belong to?

MiniTickets answers:

- what can this user do in this workspace?
- what tickets, comments, and actions are allowed here?

Disabled-user expectation:

- MiniAuth should be the source of truth for whether the account is active
- MiniTickets should block inactive users from current participation and active pickers
- MiniTickets should preserve historical records authored by now-inactive users

## Migration Principle

Migrate identity first.

Do not migrate workspace authorization at the same time.

Do not make MiniAuth the owner of MiniTickets business logic.

## Current MiniTickets Auth Surface To Replace

MiniTickets currently owns local implementations for:

- session lookup
- login and logout
- password setup
- email-code challenge mechanics
- account preference cookies tied to auth/session setup

These should be redirected behind the existing auth seam rather than removed all at once.

## Data To Move

Move these user fields from MiniTickets into MiniAuth:

- email
- password hash
- account active state
- locale
- theme preference
- accent color
- email MFA enabled

Recommended shared profile fields to move early:

- display name

Move these auth records from MiniTickets into MiniAuth:

- `Session`
- `PasswordSetupToken`
- `LoginEmailChallenge`
- `AuthRateLimit`

Create in MiniAuth:

- `AppAccess` for `minitickets`

Recommended `AppAccess` minimum:

- user id
- app key = `minitickets`
- role or access state
- created and updated timestamps

## Do Not Move Yet

Keep these in MiniTickets during the first migration phase:

- app-specific fields on `Workspace`
- ticket roles and permissions
- any ticket-scoped or workspace-scoped authorization logic
- app-specific notification preferences
- app-specific settings that do not clearly belong across apps

Recommended workspace split:

- MiniAuth owns shared workspace identity and shared membership truth
- MiniTickets keeps a local workspace shell for app-specific fields such as `ticketPrefix`, `paymentInfoEnabled`, and any product-local behavior
- MiniTickets syncs shared workspace identity and memberships from MiniAuth rather than treating its local table as the long-term source of truth

## Shared Preference Model

MiniAuth now supports shared preference values for:

- locale
- theme
- accent

Current MiniTickets-compatible values:

- theme: `SYSTEM`, `LIGHT`, `DARK`
- accent: `BLUE`, `CYAN`, `TEAL`, `GREEN`, `LIME`, `YELLOW`, `ORANGE`, `RED`, `PINK`, `PURPLE`
- locale: `ZH_CN`, `EN`

Recommended MiniTickets behavior:

1. read MiniAuth shared cookies first
2. fall back to MiniTickets-local cookie values during migration
3. fall back to MiniTickets-local stored values only if still needed
4. keep MiniTickets CSS variables and component styling app-local

Current rollout behavior:

- when MiniAuth-backed shared login is enabled, MiniTickets should treat locale, theme, and accent as MiniAuth-managed settings
- MiniTickets settings should keep app-local preferences such as notification and time-zone choices, while linking signed-in users to MiniAuth for shared preference updates

Recommended shared cookie names:

- `mini_locale`
- `mini_theme`
- `mini_accent`

MiniTickets should continue using:

- `data-theme`
- `data-accent`

MiniAuth should define the values.

MiniTickets should still define the actual rendering.

Current MiniTickets visual direction to preserve:

- neutral light and dark surfaces
- restrained accent usage rather than full-surface color
- soft radial accent glows in the page background
- pill-shaped primary and secondary controls
- one accent value that drives:
  - primary buttons
  - focus rings
  - badges and emphasis states
  - subtle background glow and soft-fill treatments

## Authentication Flow Migration

### Phase 1: Preserve Current Seam

Keep the existing MiniTickets auth wrapper and service boundaries intact.

Do not rewrite app-level current-user loading from scratch.

Instead, replace the implementation under the seam.

Targets:

- `lib/auth-service.ts`
- `lib/auth.ts`
- auth-related server actions and routes

### Phase 2: Replace Sign-In Entry

Replace MiniTickets local sign-in entry points with redirects to MiniAuth.

Recommended result:

- unauthenticated MiniTickets users are sent to MiniAuth
- MiniAuth performs password or MFA checks
- MiniAuth issues the shared session cookie
- MiniTickets `/login` should hand off directly to MiniAuth rather than stopping on an app-local intermediary screen
- MiniTickets sends a trusted `returnTo` target so MiniAuth redirects successful sign-in back to the MiniTickets post-login route
- MiniTickets reads identity from the shared session
- MiniTickets sign-out should also route through MiniAuth logout so shared-session sign-out and app-local sign-out stay consistent

Recommended rollout safeguard:

- keep MiniTickets identity resolution from MiniAuth enabled first
- enable MiniAuth login redirects only after identity resolution is stable in production
- use an explicit MiniTickets env toggle such as `MINIAUTH_LOGIN_REDIRECT_ENABLED=true` for the cutover step

### Phase 3: Replace Session Resolution

Replace MiniTickets local session lookup with MiniAuth-backed identity resolution.

Recommended behavior:

1. MiniTickets reads the shared session cookie
2. MiniTickets resolves the MiniAuth identity
3. MiniTickets checks whether the user has `AppAccess` for `minitickets`
4. MiniTickets resolves identity by `authUserId` when available, and only falls back to email during migration
5. MiniTickets loads or maps the local user shell and workspace memberships
6. MiniTickets continues app-local authorization from there

### Phase 4: Retire Local Auth Records

Only after MiniTickets is stable on MiniAuth-backed identity:

- stop issuing local MiniTickets sessions
- stop issuing local MiniTickets password setup tokens
- stop issuing local MiniTickets login email challenges
- remove obsolete local auth tables in a later cleanup release

Do not delete fallback data until the new path is proven in production.

## Recommended MiniTickets Data Strategy

Use a transitional local user mapping.

Recommended options:

- keep the existing local `User` record temporarily and map by email
- or add a dedicated `authUserId` field for the MiniAuth user id

Preferred long-term direction:

- add `authUserId` to MiniTickets
- treat MiniAuth as the canonical identity source
- keep MiniTickets-local records for app-specific relationships and permissions

This keeps joins stable even if display name, locale, or other fields evolve over time.

## Password Hash Guidance

Copy existing password hashes into MiniAuth only if:

- the hashing algorithm matches
- verification rules match
- no normalization mismatch exists

If MiniTickets and MiniAuth use the same hashing stack, direct migration is acceptable.

If not, prefer a password reset or password setup migration path rather than trying to reinterpret old hashes.

## Cookie And Domain Guidance

If MiniAuth and MiniTickets live on the same parent domain:

- use a parent-domain session cookie
- use parent-domain shared preference cookies

Example pattern:

- MiniAuth at `miniauth.example.com`
- MiniTickets at `minitickets.example.com`
- shared cookie domain `.example.com`

If the apps do not share a parent domain:

- do not force cross-domain cookie hacks
- use a server-side identity verification or handoff flow instead

## Safe Migration Order

1. Back up the MiniTickets database.
2. Build MiniAuth with matching user/account semantics.
3. Add any missing fields needed for compatibility:
   - locale
   - theme
   - accent
   - MFA flag
   - optional `authUserId`
4. Copy or import MiniTickets identity records into MiniAuth.
5. Create `AppAccess` rows for `minitickets`.
6. Verify MiniAuth sign-in works independently.
7. Update MiniTickets to read shared preference cookies first.
8. Update MiniTickets to resolve identity from MiniAuth sessions.
9. Keep workspace authorization unchanged.
10. Test production behavior carefully.
11. Retire old MiniTickets auth paths only after stability is proven.

## Verification Checklist

Before cutting MiniTickets over:

- MiniAuth can authenticate a migrated MiniTickets user
- MiniAuth correctly preserves account active or inactive state
- MiniAuth correctly preserves locale, theme, and accent
- MiniAuth issues shared cookies on the expected parent domain
- MiniTickets can read shared cookies
- MiniTickets can resolve a signed-in identity from MiniAuth
- MiniTickets still enforces workspace membership and local authorization correctly
- sign-out behavior is clear and consistent
- fallback behavior exists while rollout is in progress

## Risks To Avoid

Avoid:

- migrating auth and authorization in one step
- deleting MiniTickets auth tables too early
- forcing MiniAuth to understand MiniTickets workspace rules
- making MiniTickets depend on app-specific cookies after shared-cookie rollout
- copying hashes blindly without verifying compatibility
- assuming shared cookies work before confirming domain and HTTPS behavior in production

## Recommended MiniTickets Changes

MiniTickets should plan for these concrete changes:

- add a MiniAuth identity resolution path in the auth service layer
- add shared-cookie-first preference resolution
- optionally add `authUserId` for a stronger user mapping
- replace local login/logout routes with MiniAuth redirects
- keep workspace membership lookup local
- keep app-local CSS token rendering even when preference values are shared

## Final Rule

Treat MiniAuth as the shared identity and preference source.

Treat MiniTickets as the source of workspace truth and ticket authorization.

That boundary should stay calm, explicit, and stable throughout the migration.
