# MiniTickets Product Foundation

## Product shape

MiniTickets is a multi-workspace ticketing application for personal and small-team request tracking. The UX is intentionally calm, bilingual, and low-friction while keeping the core discipline of ownership, prioritization, and audit history.

## Architecture

### Application layers

1. Presentation
   - A responsive web application shell, focused entry points, and reusable interface patterns
   - Locale-aware labels and theme-aware design tokens
2. Domain
   - Ticket lifecycle helpers
   - Workspace access control
   - Admin catalog management for statuses, priorities, and categories
3. Data
   - Structured records for users, workspaces, memberships, tickets, comments, activity, notifications, and sessions
4. Platform
   - Session cookies
   - Password hashing
   - Seed data
   - Future-ready auth provider/account tables for SSO expansion

### Deployment posture

- Optimized for deployment as a single web service
- A lightweight relational store works well for local, personal, or early production use
- Environment variables isolate secrets and app URL
- The auth model includes external-account mapping so SSO for other `iandorsey.com` apps can be added without redesigning user identity

## Database schema

### Core entities

- `User`
  - identity, profile, language preference, accent color, theme preference, active flag
- `Workspace`
  - name, slug, ticket prefix, description, archived flag
- `WorkspaceMembership`
  - links users to workspaces with `ADMIN` or `MEMBER` scope inside the workspace
- `Ticket`
  - title, description, number, due date, requester, assignee, workspace, status, priority, category, optional payment reference
- `TicketComment`
  - threaded chronologically under a ticket
- `TicketActivity`
  - immutable audit trail for creation, assignment, status change, priority change, comments, and attachments
- `Notification`
  - user-targeted event inbox entries for in-app alerts and future delivery expansion

### Support entities

- `Session`
  - secure persistent login sessions
- `AuthAccount`
  - optional external identity provider mapping for future SSO
- `PasswordSetupToken`
  - single-use invitation and password-setup tokens with expiry
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
- A ticket has many comments, attachments, and activity entries
- Definitions are global, active/inactive, and referenced by tickets

## Route map

### Public

- `/login`
- `/setup-password`

### Authenticated

- `/`
  - redirects to tickets
- `/tickets`
- `/tickets/new`
- `/tickets/[ticketId]`
- `/dashboard`
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
  - product name in Chinese-first contexts: `轻量工单`
  - workspace switcher
  - global search entry point
  - account actions
- Left navigation
  - Tickets
  - Create Ticket
  - Dashboard
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
  - collapsible filter bar
  - compact, legible result list
- Ticket detail
  - header summary
  - key metadata panel
  - description
  - attachments
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
  - theme
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
  - Submit Ticket: 提交工单
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
- Users created by an admin must be associated with a workspace immediately
- Admin-created users complete onboarding through an expiring password-setup link instead of receiving a fixed password
- Future SSO path:
  - keep local credentials as one auth method
  - add external account mappings for OIDC/SAML later
  - centralize provider resolution in auth services

## Current product defaults

- New tickets default to:
  - status: `New`
  - priority: `Medium`
  - category: `General Request`
- Ticket description is optional during creation
- Ticket numbers use a global `MT` prefix plus a workspace prefix, for example `MTSR00001`
- Users only see tickets and workspaces they are associated with, except platform admins
- Invite emails identify the user’s assigned workspace and link directly to password setup

## Delivery model

- Email is recommended for:
  - account invitation and password setup
  - first-admin welcome message
  - ticket created
  - ticket assigned
  - new comment
  - resolved or closed
- In-app notifications should remain available even if external delivery is temporarily unavailable

## Product evolution phases

1. Establish the bilingual shell, navigation, and workspace-scoped access model
2. Define the ticketing record model, default catalogs, and seed-ready sample data
3. Add authentication, session handling, and server-side permission checks
4. Deliver the core operational surfaces: tickets, workspaces, admin, and settings
5. Expand onboarding, notifications, and deployment readiness for real-world use
