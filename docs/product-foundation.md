# MiniTickets Product Foundation

## Product shape

MiniTickets is a bilingual, multi-workspace ticketing product for personal and small-team request tracking. It is intentionally lightweight, calm, and low-friction while still behaving like a real operational system with ownership, prioritization, scheduling, and audit history.

## Product principles

- Keep the product understandable for non-technical users
- Prefer clear ownership and visible progress over workflow complexity
- Treat workspace boundaries as real access boundaries
- Make mobile use a first-class scenario
- Reveal complexity progressively instead of front-loading every option

## Core domain model

### People

- A person has:
  - identity
  - profile information
  - language preference
  - theme and accent preferences
  - optional stronger sign-in protection
- A person can belong to one or many workspaces

### Workspaces

- A workspace is the primary boundary for visibility and collaboration
- Each workspace has:
  - a human-readable name
  - a short identifier
  - a ticket prefix
  - optional descriptive context
  - an optional payment-information capability
  - an active or archived state

### Tickets

- A ticket belongs to exactly one workspace
- A ticket has:
  - ticket number
  - title
  - optional description
  - requester
  - optional assignee
  - status
  - priority
  - category
  - optional due date
  - optional saved payment-method references when the workspace enables payment information
- A ticket may have:
  - one parent ticket
  - many child tickets
- Parent/child relationships are intentionally shallow:
  - one child level is supported
  - status does not automatically propagate up or down

### Comments and activity

- A ticket keeps a chronological record of:
  - system activity
  - comments
  - attachments
- The activity record should remain readable as one unified timeline

### Events and reminders

- A ticket may have scheduled events
- An event has:
  - title
  - scheduled time
  - optional notes
- An event can have multiple reminder offsets
- Due dates remain simpler than events:
  - they are date-based
  - they can trigger a morning reminder
  - they are not the same as a scheduled event

### Notifications

- Notifications support:
  - in-product inbox behavior
  - browser delivery
  - email delivery
  - optional calendar invite attachments for suitable email types
- Notification behavior should be durable and auditable rather than purely ephemeral
- Mentions are high-signal notification events and should notify only the mentioned recipient by default
- Broader new-comment email delivery should remain a user preference, not a forced default
- Operational alerts such as low disk space should be threshold-based, deduplicated, and aimed at admins

## Access model

- Users can only access workspaces they belong to
- Ticket visibility follows workspace membership
- Attachment visibility follows ticket visibility
- Admins can manage the product globally
- Assignment should remain grounded in real workspace membership

## Product surfaces

### Global shell

- The shell should provide:
  - product branding
  - workspace context
  - search
  - account actions
  - primary navigation
- a lightweight product footer for ownership and license context
- Workspace switching belongs in the shell, not as a separate primary destination

### Ticket list

- The ticket list is the main operational workspace view
- It should support:
  - keyword search
  - filters
  - compact readable rows
  - clear status and ownership cues
- When already scoped to one workspace, repeated workspace labels should be minimized

### Ticket detail page

- The ticket detail page is the main working surface for one ticket
- It should present:
  - key metadata
  - editable ticket data
  - chronological activity
  - comments
  - attachments
  - events and reminders
  - parent/child relationships
  - deliberate due-date calendar-invite actions when a due date exists
- Editable sections should repeat enough ticket identity context to reduce accidental edits on the wrong record
- Less-frequent sections should collapse cleanly
- Collapsed sections should still hint at their contents
- The primary action on this page should favor saving meaningful edits over one-off shortcut actions

### Dashboard

- The dashboard should emphasize:
  - assigned work
  - created work
  - recent movement
  - status distribution

### Admin

- Admin is the structural control center
- It should support:
  - user lifecycle management
  - workspace management
  - catalog management
  - global visibility where appropriate
  - workspace-level enablement and cleanup of optional payment-method data

### Settings

- Settings should combine:
  - profile preferences
  - language
  - time zone
  - theme
  - accent
  - password management
  - optional additional sign-in protection
  - optional notification and interoperability preferences
  - visible application version
  - open-source provenance details when relevant
- Admin-only operational indicators when they directly support safe single-server operation

## Language and localization

- The product is Simplified Chinese first and English second
- Terminology should be curated rather than literal
- Brand presentation in non-Latin contexts should keep a smaller `MiniTickets` subtitle visible
- Time, reminders, and due-date notifications should respect the recipient’s own time zone

## Visual system

- The interface should feel calm, intentional, and legible
- Accent colors should influence both controls and surrounding atmosphere
- Dense tables should generally give way to compact lists or stacks when that improves readability
- Mobile and desktop should feel like the same product, not separate experiences
- Browser-tab titles should stay short, stable, and scannable

## Authentication and trust

- Sign-in is based on email and password
- Optional additional sign-in verification can be enabled by the user
- Invitations should lead directly into password setup rather than distributing fixed passwords
- Session handling should remain quiet and secure rather than performative

## Delivery expectations

- Email is appropriate for:
  - invitation and password setup
  - first-admin onboarding
  - ticket created
  - ticket assigned
  - targeted comment delivery such as mentions
  - resolved or closed status changes
  - scheduled-event confirmation
  - scheduled reminders
  - due-date reminders
- Calendar invites should remain opt-in and targeted:
  - timed event emails may include a standard calendar attachment
  - due-date-related emails may include an all-day calendar attachment
  - reminder emails should stay lighter than creation/confirmation emails unless the user explicitly opts in
  - manual due-date invite actions should let the sender choose recipients instead of broadcasting by default
- Browser notifications are helpful, but should remain secondary to durable in-product and email channels

## Product defaults

- New tickets default to:
  - status: `New`
  - priority: `Medium`
  - category: `General Request`
- When a ticket is assigned and would otherwise still be `New`, it should move to `In Progress`
- Ticket description is optional
- Event reminders should be intentional rather than preselected by default
- Due-date reminders should occur at a practical daytime hour, not midnight
- Per-file uploads should remain bounded by a practical size limit

## Security and privacy posture

- Workspace boundaries are real privacy boundaries
- Private attachments must never be publicly reachable by URL alone
- Even negative attachment responses should avoid cacheable or indexable behavior
- The product is appropriate for routine and moderately sensitive matters, not highly sensitive financial or legal data
- The interface should remind users not to upload highly sensitive payment information

## Operating assumptions

- The product is healthy as a single-service deployment for personal and early small-team use
- Backups are part of normal operation, not an optional extra
- Longer-term durability can expand beyond local file storage when needed
- Single-server operation benefits from visible storage health and proactive admin warnings before disk exhaustion

## Evolution path

1. Preserve clarity and trust in the core ticket workflow
2. Continue improving notification quality and scheduling reliability
3. Keep access control and attachment protection conservative
4. Expand interoperability and export features where they help real work
5. Add broader authentication or enterprise identity options only if the product genuinely needs them
