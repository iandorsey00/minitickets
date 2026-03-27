import path from "node:path";

function getDatabaseDirectory() {
  const rawUrl = process.env.DATABASE_URL ?? "file:./dev.db";
  const fileUrl = rawUrl.startsWith("file:") ? rawUrl.slice(5) : rawUrl;
  const resolvedFile = path.isAbsolute(fileUrl)
    ? fileUrl
    : path.join(/* turbopackIgnore: true */ process.cwd(), fileUrl);
  return path.dirname(resolvedFile);
}

export function getUploadsRoot() {
  return process.env.UPLOADS_DIR || path.join(getDatabaseDirectory(), "uploads");
}

export function getTicketAttachmentDiskPath(ticketId: string, storedName: string) {
  return path.join(getUploadsRoot(), "tickets", ticketId, storedName);
}
