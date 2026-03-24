# MiniTickets Architecture

## Product shape

MiniTickets is a multi-workspace ticketing application for personal and small-team request tracking. The UX is intentionally calm, bilingual, and low-friction while keeping the core discipline of ownership, prioritization, and audit history.

## Technical choices

- Framework: Next.js App Router with React and TypeScript
- Styling: Global CSS with design tokens, responsive layout primitives, system light/dark theme support
- Typography: Inter + Noto Sans SC via `next/font`
- Database: Prisma ORM with SQLite for local/demo use, structured so PostgreSQL can be adopted later
- Auth: Email/password with server-side session table and hashed session tokens
- Authorization: Workspace membership checks on all ticket and workspace reads/writes
- i18n: Dictionary-driven UI strings with Simplified Chinese default and English secondary locale
- Notifications: Database event model for in-app activity now, email/push later

## Architecture

### Application layers

1. Presentation
   - App Router pages, layouts, server actions, and reusable UI components
   - Locale-aware labels and theme-aware design tokens
2. Domain
   - Ticket lifecycle helpers
   - Workspace access control
   - Admin catalog management for statuses, priorities, and categories
3. Data
   - Prisma models for users, workspaces, memberships, tickets, comments, activity, notifications, and sessions
4. Platform
   - Session cookies
   - Password hashing
   - Seed data
   - Future-ready auth provider/account tables for SSO expansion

### Deployment posture

- Optimized for deployment on a single Next.js service
- SQLite works for local/dev and seed/demo mode
- Environment variables isolate secrets and app URL
- The auth model includes `AuthAccount` so SSO for other `iandorsey.com` apps can be added without redesigning user identity

## Database schema

### Core entities

- `User`
  - identity, profile, language preference, accent color, theme preference, active flag
- `Workspace`
  - name, slug, description, archived flag
- `WorkspaceMembership`
  - links users to workspaces with `ADMIN` or `MEMBER` scope inside the workspace
- `Ticket`
  - title, description, number, due date, requester, assignee, workspace, status, priority, category
- `TicketComment`
  - threaded chronologically under a ticket
- `TicketActivity`
  - immutable audit trail for creation, assignment, status change, priority change, and comments
- `Notification`
  - user-targeted event inbox entries for future email/push expansion

### Support entities

- `Session`
  - secure persistent login sessions
- `AuthAccount`
  - optional external identity provider mapping for future SSO
- `StatusDefinition`
  - admin-managed status labels with seed defaults
- `PriorityDefinition`
  - admin-managed priorities with seed defaults
- `CategoryDefinition`
  - admin-managed categories with seed defaults

### Key relationships

- A user can belong to many workspaces
- A workspace has many tickets
- A ticket belongs to exactly one workspace
- A ticket has one requester and optional assignee
- A ticket has many comments and activity entries
- Definitions are global, active/inactive, and referenced by tickets

## Route map

### Public

- `/login`

### Authenticated

- `/`
  - redirects to dashboard
- `/dashboard`
- `/tickets`
- `/tickets/new`
- `/tickets/[ticketId]`
- `/workspaces`
- `/workspaces/[workspaceId]`
- `/settings`

### Admin only

- `/admin`
- `/admin/users`
- `/admin/workspaces`
- `/admin/catalog`

## UI structure

### Global shell

- Top bar
  - product name: `MiniTickets`
  - secondary label: `轻量工单`
  - workspace switcher
  - global search entry point
  - theme toggle
  - user menu
- Left navigation
  - Dashboard
  - Tickets
  - Create Ticket
  - Workspaces
  - Admin
  - Settings

### Page structure

- Dashboard
  - assigned to me
  - created by me
  - recent updates
  - status counts
- Ticket list
  - keyword search
  - filter bar
  - compact, legible results table/cards
- Ticket detail
  - header summary
  - key metadata panel
  - description
  - activity timeline
  - comments composer
- Workspace page
  - workspace summary
  - members
  - status counts
  - recent activity
  - workspace ticket list
- Admin
  - user management
  - workspace management
  - catalog management
- Settings
  - language
  - accent color
  - display name
  - password

## i18n strategy

- All user-visible strings live in locale dictionaries
- Locale values: `zh-CN` and `en`
- Default locale: `zh-CN`
- Locale resolution order:
  1. authenticated user preference
  2. locale cookie
  3. default locale
- Terminology is curated rather than literal:
  - Workspace: 工作区
  - Ticket: 工单
  - Create Ticket: 新建工单
  - Requester: 提交人
  - Assignee: 处理人
  - Settings: 设置

## Theme and accent system

- System light/dark support with user override
- Accent palette is restricted to curated tokens:
  - blue
  - cyan
  - teal
  - green
  - lime
  - yellow
  - orange
  - red
  - pink
  - purple
- Tokens drive buttons, links, active states, focus rings, and highlights
- Light and dark themes share semantic tokens so the product keeps the same calm identity in both modes

## Auth model

- Users authenticate with email and password
- Passwords are hashed with bcrypt
- Sessions are stored in the database
- Cookie contains only a session token, not user profile data
- Every authenticated request resolves the current user and allowed workspaces server-side
- Future SSO path:
  - keep local credentials as one auth method
  - add `AuthAccount` rows for OIDC/SAML later
  - centralize provider resolution in auth services

## Implementation plan

1. Scaffold Next.js, TypeScript, Prisma, and global design tokens
2. Implement schema, migrations, and seed data
3. Build auth, session handling, and access checks
4. Build the bilingual shell, dashboard, tickets, workspaces, admin, and settings
5. Verify flows with lint/build and local seed bootstrapping
