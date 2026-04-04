# MiniAuth Handoff

## Purpose

MiniAuth should be a small central login service for MiniTickets and future related small apps.

The goal is one calm, reusable account system across small self-hosted apps without taking on full enterprise SSO complexity.

## What MiniAuth Is

- local-account auth shared across multiple apps
- invite and password-setup support
- email-code verification / optional MFA support
- session issuance and revocation
- app access grants and basic account status

## What MiniAuth Is Not

- a generic enterprise identity platform
- a SAML product
- a broad OAuth provider meant for third parties
- a Microsoft / Google workforce-login integration project
- a large policy engine

## Why This Exists

MiniTickets already has local auth, but the current need is broader than one app:

- one login across MiniTickets and MiniAssets
- shared account lifecycle
- less duplicated auth logic in each app
- calmer long-term maintenance than copy-pasting login flows app by app

## Product Shape

MiniAuth should stay:

- minimal
- self-hostable
- implementation-light
- Chinese/English ready
- security-minded but not enterprise-heavy

## Recommended V0.1 Scope

- users
- password hashes
- account active/inactive state
- password-setup tokens
- email login-code challenges
- sessions
- auth rate limits
- optional MFA preference
- app membership / app access records

## Recommended V0.1 Non-Scope

- SAML
- external identity-provider federation
- provider marketplace
- SCIM
- advanced org policy
- social login sprawl
- overbuilt consent / token management

## MiniTickets Boundary

### Move to MiniAuth later

- `User` identity/auth fields:
  - email
  - password hash
  - account active state
  - locale if you want auth emails to stay localized
- `Session`
- `PasswordSetupToken`
- `LoginEmailChallenge`
- `AuthRateLimit`
- `AuthAccount` if external providers ever matter later
- login, logout, password-setup, and login-code verification flows

### Keep in MiniTickets

- workspaces
- workspace memberships and roles
- ticket permissions
- ticket assignments
- notification preferences that are clearly app-specific
- theme/accent/workspace cookies unless you intentionally want them shared

## MiniTickets Prep Already Done

MiniTickets now has a cleaner seam for a future central login service:

- auth routes are centralized in the app auth config
- local session/challenge mechanics are isolated in a dedicated auth service layer
- app-facing current-user loading stays behind a thin app auth wrapper

This means a future MiniAuth integration should mainly replace:

- session resolution
- login challenge issuance/verification
- sign-in / sign-out entry points

without forcing ticket/workspace logic to move at the same time.

## Recommended Integration Model

For the first shared-login version, prefer:

- a central auth service on the same parent domain
- one shared session cookie if deployment makes that practical
- app-local authorization after identity is established

That means:

- MiniAuth answers “who is this user?”
- MiniTickets answers “what can this user do here?”
- MiniAssets answers “what can this user do here?”

## Suggested Initial Data Model

- `User`
- `Session`
- `PasswordSetupToken`
- `LoginEmailChallenge`
- `AuthRateLimit`
- `AppAccess`

Possible `AppAccess` shape:

- user id
- app key such as `minitickets` or `miniassets`
- role or access state
- created / updated timestamps

Do not try to push workspace membership itself into MiniAuth unless multiple apps truly need the exact same workspace model.

## Migration Path

1. Keep MiniTickets local auth working.
2. Build MiniAuth with the same basic account semantics.
3. Move identity/session records first.
4. Leave MiniTickets workspace authorization in place.
5. Swap MiniTickets from local session lookup to MiniAuth-backed identity lookup.
6. Only after MiniTickets is stable, connect MiniAssets to the same login.

## Implementation Preference

Prefer practical shared auth over “real SSO.”

For this family of apps, the priority is:

- one login
- simple operations
- low maintenance
- clear boundaries

not enterprise identity theater.
