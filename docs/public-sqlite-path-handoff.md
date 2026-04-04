# Public SQLite Path Handoff

## Recommendation

For small self-hosted apps that use SQLite in production, do not leave the production database at a repo-relative path such as:

- `file:./dev.db`

Prefer an explicit durable data location instead, such as:

- a dedicated `data/` directory for local development
- an external app-data path in production

## Why

- repo-relative database files are easy to mix up with development defaults
- deploys and working-directory assumptions become harder to reason about
- backups are less obvious to target
- related file-storage paths may accidentally inherit an awkward or fragile base location

## Better Default Pattern

- local development:
  - `DATABASE_URL="file:./data/app-name.db"`
- production:
  - `DATABASE_URL="file:/path/to/app-data/app-name.db"`

## Implementation Guidance

- keep the SQLite path behind one shared helper instead of repeating string fallbacks in multiple files
- make uploads and other derived storage paths resolve from the configured database location when that is part of the app’s design
- ignore local data directories in git
- document the production database path expectation in the app handoff or deploy docs

## Suggested Public Framing

Use this as a lightweight small-app operations rule:

- If a production app still uses SQLite, keep the database in an explicit app-data location, not in the repo root or behind a `dev.db` default.
