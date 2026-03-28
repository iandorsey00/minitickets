import path from "node:path";

const safeInlineMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

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

export function getTicketAttachmentUrl(ticketId: string, storedName: string) {
  return `/attachments/tickets/${ticketId}/${storedName}`;
}

export function canRenderInline(mimeType?: string | null) {
  return Boolean(mimeType && safeInlineMimeTypes.has(mimeType));
}

export function getSafeAttachmentMimeType(mimeType?: string | null) {
  return canRenderInline(mimeType) ? mimeType! : "application/octet-stream";
}
