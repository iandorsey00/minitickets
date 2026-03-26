# MiniTickets Handoff

## Product status

MiniTickets is live as a bilingual, workspace-based ticketing system for personal and small-team workflows. The current product direction is calm, mobile-aware, and Chinese-first, with an intentionally lightweight feel that still behaves like a real operational tool.

## Current behavior

- Users sign in with email and password
- Every non-admin user is limited to the workspace or workspaces they belong to
- Admins can manage users, workspaces, and global ticket definitions
- New users are created together with a required workspace assignment
- New users receive an expiring password-setup link instead of a fixed password
- Password setup links can be completed even if the viewer is already signed in to a different account
- New tickets default to:
  - status: `New`
  - priority: `Medium`
  - category: `General Request`
- Ticket description is optional at creation time
- Ticket numbers use a global MiniTickets prefix plus a workspace prefix, for example `MTSR00001`
- The create-ticket action label in Chinese is `提交工单`

## UX direction

- Chinese-first branding should prefer `轻量工单` in the main interface
- The login page should stay visually close to the GeoCompare homepage, especially in scale, spacing, and calmness
- Mobile usage is a primary scenario, not an afterthought
- Dense tables should generally be avoided in favor of calmer stacked rows or compact lists
- Filters should stay available but not dominate the page when they are not in active use

## Notification and email expectations

- Email is currently expected for:
  - account invitation / password setup
  - first-admin welcome message
  - ticket created
  - ticket assigned
  - new comment
  - ticket resolved or closed
- In-app activity and notifications remain important even if email delivery is unavailable
- Invite and welcome emails should stay simple, direct, and clear for non-technical users
- Invitation emails should name the assigned workspace so the recipient understands the context immediately

## Operational guidance

- A fresh production environment should start without demo tickets or demo users
- The first real admin account should be created deliberately during deployment/bootstrap
- Workspaces should be created to match real contexts such as personal, household, studio, or small-business operations
- Local file uploads are acceptable for a single-server deployment, but longer-term durability may call for external object storage

## Near-term follow-ups

- Continue softening crowded admin and settings layouts where narrow widths still feel dense
- Consider a more guided user-creation flow if workspace role selection becomes confusing
- Consider stronger password requirements if broader external use is expected
- Continue validating that all ticket and workspace queries remain properly scoped by workspace membership

## Decision notes

- `INC`-style ticket-type prefixes were intentionally not adopted
- The current ticket format favors short, readable identifiers over enterprise-style complexity
- The product intentionally uses `工作区` instead of `domain`
- Resolution should be explicit and understandable, not buried in jargon or overbuilt workflow rules
