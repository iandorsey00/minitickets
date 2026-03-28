import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { processDueTicketReminders } from "@/lib/ticket-events";

const secureHeaders = {
  "Cache-Control": "no-store",
  "X-Robots-Tag": "noindex, noarchive",
} as const;

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ notifications: [] }, { status: 401, headers: secureHeaders });
  }

  await processDueTicketReminders();

  const notifications = await prisma.notification.findMany({
    where: {
      userId: user.id,
      browserDeliveredAt: null,
      createdAt: {
        gte: new Date(Date.now() - 30 * 60 * 1000),
      },
    },
    orderBy: { createdAt: "asc" },
    take: 12,
  });

  return Response.json(
    {
      notifications: notifications.map((notification) => ({
        id: notification.id,
        title: user.locale === "EN" ? notification.titleEn : notification.titleZh,
        body: user.locale === "EN" ? notification.bodyEn : notification.bodyZh,
        url: notification.ticketId ? `/tickets/${notification.ticketId}` : "/tickets",
      })),
    },
    { headers: secureHeaders },
  );
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return Response.json({ ok: false }, { status: 401, headers: secureHeaders });
  }

  const body = (await request.json().catch(() => null)) as { ids?: string[] } | null;
  const ids = Array.isArray(body?.ids) ? body.ids.filter(Boolean) : [];

  if (ids.length) {
    await prisma.notification.updateMany({
      where: {
        id: { in: ids },
        userId: user.id,
        browserDeliveredAt: null,
      },
      data: {
        browserDeliveredAt: new Date(),
      },
    });
  }

  return Response.json({ ok: true }, { headers: secureHeaders });
}
