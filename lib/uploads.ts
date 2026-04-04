import path from "node:path";

import { getDatabaseUrl, resolveSqliteFilePath } from "./database-url.ts";

export const MAX_ATTACHMENT_SIZE_BYTES = 30 * 1024 * 1024;

const safeInlineMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "application/pdf",
]);

function getDatabaseDirectory() {
  return path.dirname(resolveSqliteFilePath(getDatabaseUrl()));
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
