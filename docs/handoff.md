# MiniTickets Handoff

## Product status

MiniTickets is live as a bilingual, workspace-based ticketing system for personal and small-team workflows. The current product direction is calm, mobile-aware, and Chinese-first, with an intentionally lightweight feel that still behaves like a real operational tool.

## Current behavior

- Users sign in with email and password
- Users can optionally enable email MFA
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
- Tickets can have a single parent level and many child tickets
- Ticket events support reminder offsets such as months, hours, or “at time”
- Due dates trigger a 9 AM local reminder on the due date
- Ticket assignment automatically moves a still-new ticket to `处理中 / In Progress`
- The ticket detail page uses contextual save actions rather than a fixed “resolve” shortcut
- The settings page displays the current running app version as a read-only field
- Settings also includes a direct link to the public GitHub repository
- Users can opt in to broad comment-email delivery; otherwise email is sent for targeted mentions by default
- Per-file uploads are capped at 30 MB and should return to the ticket cleanly after upload
- Ticket detail editing surfaces now repeat the ticket number, title, and current status to reduce wrong-ticket edits
- The global shell includes a lightweight MIT-license footer

## UX direction

- Chinese-first branding should prefer `轻量工单` in the main interface
- Non-Latin brand contexts should show a smaller `MiniTickets` subtitle beneath the localized product name
- The login page should stay visually close to the GeoCompare homepage, especially in scale, spacing, and calmness
- Mobile usage is a primary scenario, not an afterthought
- Dense tables should generally be avoided in favor of calmer stacked rows or compact lists
- Filters should stay available but not dominate the page when they are not in active use
- The ticket detail page should reveal complexity progressively through collapsible sections with lightweight previews
- Browser-tab titles should stay concise; ticket detail uses the ticket number rather than verbose page text

## Notification and email expectations

- Email is currently expected for:
  - account invitation / password setup
  - first-admin welcome message
  - ticket created
  - ticket assigned
  - direct mention notifications
  - new comment, but only for users who explicitly opt in
  - ticket resolved or closed
- Scheduled events also send:
  - an event-created confirmation
  - timed reminder emails
- Browser notifications are expected for ticket and reminder notifications, but remain a secondary channel behind durable in-app notifications and email
- In-app activity and notifications remain important even if email delivery is unavailable
- Invite and welcome emails should stay simple, direct, and clear for non-technical users
- Invitation emails should name the assigned workspace so the recipient understands the context immediately

## Operational guidance

- A fresh production environment should start without demo tickets or demo users
- The first real admin account should be created deliberately during deployment/bootstrap
- Workspaces should be created to match real contexts such as personal, household, studio, or small-business operations
- Local file uploads are acceptable for a single-server deployment, but longer-term durability may call for external object storage
- Daily local backups are installed and should be paired with an off-droplet copy when practical
- Reminder processing should run from the dedicated scheduled service rather than relying on user traffic
- Attachment responses, including unauthorized and missing-file cases, should stay non-cacheable and non-indexable

## Near-term follow-ups

- Continue softening any remaining dense admin layouts on narrow screens
- Consider whether browser notifications should become opt-in per reminder category instead of all-or-nothing
- Consider a calmer inline way to preview accent colors live before saving
- Continue validating that all ticket, event, reminder, and attachment queries remain properly scoped by workspace membership
- Consider whether additional per-notification-category settings are worthwhile beyond the current comment-email toggle

## Decision notes

- `INC`-style ticket-type prefixes were intentionally not adopted
- The current ticket format favors short, readable identifiers over enterprise-style complexity
- The product intentionally uses `工作区` instead of `domain`
- Resolution should be explicit and understandable, not buried in jargon or overbuilt workflow rules
