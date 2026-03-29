# MiniTickets

MiniTickets is a lightweight bilingual ticketing application for personal and small-team workflows. The interface is Simplified Chinese first, English second, with workspace-based access control, email/password authentication, and a restrained design system inspired by the GeoCompare feel.

## Product foundation

- Architecture, schema, routes, UI structure, auth model, theme system, and implementation plan:
  - [docs/product-foundation.md](/Users/iandorsey/dev/minitickets/docs/product-foundation.md)
- Current product state and handoff notes:
  - [docs/handoff.md](/Users/iandorsey/dev/minitickets/docs/handoff.md)

## Setup

Recommended runtime:

- Node `24.x` LTS

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
- Ticket numbers with a global MiniTickets prefix, such as `MTSR00001`
- Invite-link onboarding for newly created accounts
- Welcome email delivery for bootstrap admin accounts
- Seed data for realistic local testing

## Future extension path

- OIDC/SAML SSO through the existing external-account model
- Email/push delivery using the current notification event structure
- Migration to a more production-oriented relational database if scale or durability requires it

## Deployment

Recommended first deployment:

- You can share the GeoCompare droplet if it has enough RAM/CPU and you keep MiniTickets isolated as its own app directory, env file, service, and reverse-proxy host.
- A separate droplet is cleaner long term, but not required for an initial personal deployment.

Suggested layout on the droplet:

- app directory: `/var/www/minitickets/app`
- env file: `/var/www/minitickets/.env.production`
- sqlite db: `/var/www/minitickets/data/dev.db`
- service name: `minitickets`
- app port: `3010`

Included deployment helpers:

- deploy script: [scripts/deploy.sh](/Users/iandorsey/dev/minitickets/scripts/deploy.sh)
- auto-deploy wrapper: [scripts/autodeploy.sh](/Users/iandorsey/dev/minitickets/scripts/autodeploy.sh)
- backup script: [scripts/backup.sh](/Users/iandorsey/dev/minitickets/scripts/backup.sh)
- deploy file renderer: [scripts/render-deploy-files.sh](/Users/iandorsey/dev/minitickets/scripts/render-deploy-files.sh)
- service template: [deploy/minitickets.service.example](/Users/iandorsey/dev/minitickets/deploy/minitickets.service.example)
- backup service template: [deploy/minitickets-backup.service.example](/Users/iandorsey/dev/minitickets/deploy/minitickets-backup.service.example)
- backup timer template: [deploy/minitickets-backup.timer.example](/Users/iandorsey/dev/minitickets/deploy/minitickets-backup.timer.example)
- reverse-proxy template: [deploy/nginx/site.conf.example](/Users/iandorsey/dev/minitickets/deploy/nginx/site.conf.example)
- deploy env example: [.env.deploy.example](/Users/iandorsey/dev/minitickets/.env.deploy.example)
- production env example: [.env.production.example](/Users/iandorsey/dev/minitickets/.env.production.example)

Basic deployment flow:

1. Clone the repo to `/var/www/minitickets/app`
2. Copy `.env.production.example` to `/var/www/minitickets/.env.production` and fill in real values
3. Install Node 24 and nginx
4. Copy `.env.deploy.example` to `.env.deploy` and fill in host-specific values
5. Run `bash scripts/render-deploy-files.sh`
6. Copy the rendered systemd unit and nginx config into place
7. Run `bash scripts/deploy.sh`
8. Enable TLS with your existing reverse-proxy flow

What `bash scripts/deploy.sh` does:

- reads `.env.deploy` if present for deploy-specific values such as service names and Node path
- sources the production env file
- restores any server-local `package-lock.json` drift before pulling
- fast-forwards `main`
- runs `npm ci`
- runs `npm run db:push`
- runs `npm run build`
- restarts both the main app service and the reminders service

Notes:

- Current uploads are local-disk storage under the app data directory and are served only through authenticated routes, which is acceptable for a single-server deployment.
- For stronger durability later, move attachments to object storage such as S3 or R2.
- Welcome and ticket emails use the Resend API key from `.env` or `.env.production`.

## Backups

MiniTickets now includes a daily backup path for the production SQLite database and app data directory.

Suggested backup env values in `.env.deploy`:

- `BACKUP_SERVICE_NAME=minitickets-backup`
- `BACKUP_USER=root`
- `BACKUP_GROUP=root`
- `BACKUP_ROOT=/var/backups/minitickets`
- `RETENTION_DAYS=14`
- `BACKUP_PREFIX=minitickets`
- `INCLUDE_ENV_FILE=0`
- `BACKUP_ON_CALENDAR=*-*-* 03:30:00`

To install the backup automation on the droplet after rendering deploy files:

1. Copy the rendered units into systemd:
   ```bash
   sudo cp deploy/rendered/minitickets-backup.service /etc/systemd/system/minitickets-backup.service
   sudo cp deploy/rendered/minitickets-backup.timer /etc/systemd/system/minitickets-backup.timer
   sudo systemctl daemon-reload
   ```
2. Create the backup directory with restricted access:
   ```bash
   sudo mkdir -p /var/backups/minitickets
   sudo chown root:root /var/backups/minitickets
   sudo chmod 700 /var/backups/minitickets
   ```
3. Enable the timer:
   ```bash
   sudo systemctl enable --now minitickets-backup.timer
   ```
4. Run one manual backup to verify:
   ```bash
   sudo systemctl start minitickets-backup.service
   sudo systemctl status minitickets-backup.service --no-pager
   ```

Each backup run creates a timestamped directory containing:

- a SQLite `.backup` snapshot
- a compressed archive of the app data directory except the live database file
- a small manifest

If you also want the runtime env file copied into backups, set `INCLUDE_ENV_FILE=1`. Keeping it at `0` is safer unless you have another secret backup path.

## First production admin

For a clean production deployment, create your first admin with:

```bash
set -a
source /var/www/minitickets/.env.production
set +a
npm run bootstrap:admin -- --email you@example.com --name "Your Name" --password "ChooseAStrongPassword" --locale ZH_CN
```

This creates or updates an admin account without demo users or demo tickets.

## User invitations

Admin-created users now receive an email link to set their own password. You can also resend that link from the admin users page or with:

```bash
npm run email:invite -- --email user@example.com
```
