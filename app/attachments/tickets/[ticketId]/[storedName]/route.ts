import { readFile } from "node:fs/promises";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canRenderInline, getSafeAttachmentMimeType, getTicketAttachmentDiskPath } from "@/lib/uploads";

const secureHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, noarchive",
} as const;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ ticketId: string; storedName: string }> },
) {
  const user = await getCurrentUser();
  const { ticketId, storedName } = await params;

  if (!user) {
    return new Response("Unauthorized", {
      status: 401,
      headers: secureHeaders,
    });
  }

  const attachment = await prisma.ticketAttachment.findFirst({
    where: {
      ticketId,
      storedName,
    },
    include: {
      ticket: {
        select: {
          workspaceId: true,
        },
      },
    },
  });

  if (!attachment) {
    return new Response("Not found", { status: 404, headers: secureHeaders });
  }

  const allowed =
    user.role === "ADMIN" ||
    (await prisma.workspaceMembership.findFirst({
      where: {
        userId: user.id,
        workspaceId: attachment.ticket.workspaceId,
      },
      select: { id: true },
    }));

  if (!allowed) {
    return new Response("Forbidden", { status: 403, headers: secureHeaders });
  }

  const file = await readFile(getTicketAttachmentDiskPath(ticketId, storedName));
  return new Response(file, {
    status: 200,
    headers: {
      "Content-Type": getSafeAttachmentMimeType(attachment.mimeType),
      "Content-Disposition": `${canRenderInline(attachment.mimeType) ? "inline" : "attachment"}; filename="${encodeURIComponent(attachment.originalName)}"`,
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
      "X-Content-Type-Options": "nosniff",
      "X-Robots-Tag": "noindex, noarchive",
    },
  });
}
