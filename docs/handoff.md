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
- Top-level tickets can start a child-ticket flow directly from ticket detail, with workspace and parent preselected
- Ticket events support reminder offsets such as months, hours, or “at time”
- Ticket events now support 2-week and 1-week reminder offsets, grouped reminder choices, and inline editing in addition to deletion
- Due dates trigger a 9 AM local reminder on the due date
- Ticket assignment automatically moves a still-new ticket to `处理中 / In Progress`
- The ticket detail page uses contextual save actions rather than a fixed “resolve” shortcut
- The settings page displays the current running app version as a read-only field
- Settings also includes a direct link to the public GitHub repository
- Admins can see remaining disk space in Settings
- Users can opt in to broad comment-email delivery; otherwise email is sent for targeted mentions by default
- Ticket comments now support long-form notes up to 10000 characters and should return a clear validation message instead of silently failing when that limit is exceeded
- The comment form should present the cautionary sensitivity note before the quieter character-limit note, preserving the existing yellow-over-gray visual hierarchy
- The comment form guidance should stay compact when possible, including an inline yellow sensitivity warning followed by a quieter gray character-limit note in the same paragraph
- Users can also opt in to receive `.ics` calendar attachments on:
  - event-created emails
  - due-date-related emails, including ticket-created emails when a due date exists
- Ticket detail now also includes a manual “send due-date calendar invite” flow with explicit recipient selection
- Payment information is workspace-controlled and defaults off
- Saved workspace payment methods can be deleted from workspace management
- Per-file uploads are capped at 30 MB and should return to the ticket cleanly after upload
- Ticket-detail uploads support both click-to-choose and drag-and-drop
- Ticket detail editing surfaces now repeat the ticket number, title, and current status to reduce wrong-ticket edits
- The global shell includes a lightweight MIT-license footer

## UX direction

- Chinese-first branding should prefer `轻量工单` in the main interface
- Non-Latin brand contexts should show a smaller `MiniTickets` subtitle beneath the localized product name
- The browser/app icon should remain a minimal black-square monogram with high-contrast white lettering rather than a decorative illustration
- The current visual language should feel calmer, more modern, and more standardized across screens rather than page-by-page custom
- Shared screens should prefer soft card surfaces, restrained shadows, and clearer visual grouping over bare divider-only layouts
- Form controls should default to low-noise boxed fields unless a lighter treatment is clearly better for that workflow
- Lucide is now the preferred icon system for consistency and MIT-friendly interoperability
- The login page should stay visually close to the GeoCompare homepage, especially in scale, spacing, and calmness
- On mobile Safari, the login card should preserve comfortable bottom padding beneath the primary `登入 / Sign in` button, including around browser bottom chrome and safe-area insets
- Mobile usage is a primary scenario, not an afterthought
- Mobile Safari should not force dash-typing workarounds for due dates, and long event titles should wrap without stretching the layout horizontally
- On mobile, the shell should collapse cleanly from the desktop sidebar into a compact top-of-page navigation/header flow without leaving dead space before content
- The mobile topbar should stay readable and sticky without content sliding underneath it
- Responsive behavior should preserve the primary task first, especially on form-heavy screens such as ticket creation and event scheduling
- Medium-width states should often reflow to two columns before collapsing all the way to one
- Dense tables should generally be avoided in favor of calmer stacked rows or compact lists
- Filters should stay available but not dominate the page when they are not in active use
- The ticket list should default to an open-only view that still includes resolved tickets while hiding closed and cancelled ones unless the user opts into seeing all tickets
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
- Calendar attachments are optional and user-controlled rather than always-on
- Manual due-date calendar invites should remain deliberate and recipient-scoped rather than automatic
- Browser notifications are expected for ticket and reminder notifications, but remain a secondary channel behind durable in-app notifications and email
- Low-disk-space warnings are expected for admins by both email and browser notification at threshold crossings
- In-app activity and notifications remain important even if email delivery is unavailable
- Invite and welcome emails should stay simple, direct, and clear for non-technical users
- Emails should now follow the same calm, modern, restrained tone as the product UI while staying highly interoperable across common mail clients
- Invitation emails should name the assigned workspace so the recipient understands the context immediately

## Operational guidance

- A fresh production environment should start without demo tickets or demo users
- The first real admin account should be created deliberately during deployment/bootstrap
- Workspaces should be created to match real contexts such as personal, household, studio, or small-business operations
- Workspaces that do not need payment references should keep the payment-information setting disabled
- Local file uploads are acceptable for a single-server deployment, but longer-term durability may call for external object storage
- Daily local backups are installed and should be paired with an off-droplet copy when practical
- Reminder processing should run from the dedicated scheduled service rather than relying on user traffic
- The standard droplet deploy path should be `bash scripts/deploy.sh` rather than a long manual command sequence
- The deploy script now reads `.env.deploy`, restores server-local `package-lock.json` drift, and restarts both the app and reminders services
- Attachment responses, including unauthorized and missing-file cases, should stay non-cacheable and non-indexable
- Low-disk-space alerts should remain deduplicated and should reset only after free space recovers above the threshold
- Event cards on narrow mobile Safari screens should keep long titles readable without stretching the page or collapsing Chinese text into a vertical strip
- Ticket disclosure summaries and event action buttons should also stay aligned on narrow mobile Safari screens without forcing horizontal overflow
- Ticket detail disclosure sections should use explicit title, preview, and toggle regions so expand/collapse behavior stays logical and readable on narrow mobile Safari screens
- When an inline event edit disclosure is opened on mobile Safari, the editor should expand to the full event card width instead of staying trapped in the action-button column
- Event cards on narrow mobile Safari screens should place the destructive delete action in its own top row and let the edit disclosure sit underneath at full width for a calmer, less cramped layout

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
