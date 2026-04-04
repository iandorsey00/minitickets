export const DEFAULT_SQLITE_DATABASE_URL = "file:./data/minitickets.db";

export function getDatabaseUrl() {
  return process.env.DATABASE_URL || DEFAULT_SQLITE_DATABASE_URL;
}
