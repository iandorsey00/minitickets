# MiniTickets

MiniTickets is a lightweight bilingual ticketing application for personal and small-team workflows. The interface is Simplified Chinese first, English second, with workspace-based access control, email/password authentication, and a restrained design system inspired by the GeoCompare feel.

## Stack

- Next.js App Router
- React + TypeScript
- Prisma + SQLite
- Custom server-side session auth
- Dictionary-based i18n

## Product foundation

- Architecture, schema, routes, UI structure, auth model, theme system, and implementation plan:
  - [docs/product-foundation.md](/Users/iandorsey/dev/minitickets/docs/product-foundation.md)

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Push the schema to SQLite:
   ```bash
   npm run db:push
   ```
3. Seed demo data:
   ```bash
   npm run db:seed
   ```
4. Start the app:
   ```bash
   npm run dev
   ```

## Demo accounts

- Admin: `admin@minitickets.local` / `MiniTickets123!`
- User: `meilin@minitickets.local` / `MiniTickets123!`
- User: `alex@minitickets.local` / `MiniTickets123!`

## Included features

- Email/password login with secure database-backed sessions
- Multi-workspace ticketing
- Dashboard, ticket list, ticket detail, workspaces, admin, and settings
- Bilingual interface with user language preference
- Light/dark/system theme preference
- Curated accent color selection
- Admin management for users, workspaces, and catalog definitions
- Seed data for realistic local testing

## Future extension path

- OIDC/SAML SSO via the existing `AuthAccount` model
- Email/push delivery using the current notification event structure
- PostgreSQL deployment by changing Prisma datasource settings
