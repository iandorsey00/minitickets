import type { Locale, PrismaClient } from "@prisma/client";

import { localeTokenMap } from "./constants.ts";
import { sendTicketEventEmail } from "./email.ts";
import { prisma } from "./prisma.ts";
import { formatReminderOffsetLabel } from "./reminder-labels.ts";

export const defaultTicketEventReminderOffsets = [120, 30, 0] as const;

export function sanitizeTicketEventReminderOffsets(values: string[]) {
  const parsed = Array.from(
    new Set(
      values
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value) && value >= 0 && value <= 7 * 24 * 60),
    ),
  );

  return parsed.sort((a, b) => b - a);
}

function formatScheduledFor(date: Date, locale: Locale, timeZone?: string) {
  return new Intl.DateTimeFormat(localeTokenMap[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
}

type EventReminderProcessorOptions = {
  prismaClient?: PrismaClient;
  now?: Date;
};

export async function processDueTicketEventReminders(options: EventReminderProcessorOptions = {}) {
  const prismaClient = options.prismaClient ?? prisma;
  const now = options.now ?? new Date();

  const pendingReminders = await prismaClient.ticketEventReminder.findMany({
    where: {
      sentAt: null,
    },
    include: {
      event: {
        include: {
          ticket: {
            include: {
              workspace: true,
              requester: true,
              assignee: true,
            },
          },
        },
      },
    },
    orderBy: {
      event: {
        scheduledFor: "asc",
      },
    },
  });

  let processedCount = 0;

  for (const reminder of pendingReminders) {
    const dueAt = new Date(reminder.event.scheduledFor.getTime() - reminder.offsetMinutes * 60 * 1000);
    if (dueAt > now) {
      continue;
    }

    const updated = await prismaClient.ticketEventReminder.updateMany({
      where: {
        id: reminder.id,
        sentAt: null,
      },
      data: {
        sentAt: now,
      },
    });

    if (!updated.count) {
      continue;
    }

    const recipients = Array.from(
      new Map(
        [reminder.event.ticket.requester, reminder.event.ticket.assignee]
          .filter((recipient): recipient is NonNullable<typeof reminder.event.ticket.requester> => Boolean(recipient))
          .map((recipient) => [recipient.id, recipient]),
      ).values(),
    );

    const notificationData = recipients.map((recipient) => ({
      userId: recipient.id,
      ticketId: reminder.event.ticket.id,
      eventType: "ticket.event.reminder",
      titleZh: `提醒：${reminder.event.title}`,
      titleEn: `Reminder: ${reminder.event.title}`,
      bodyZh: `${reminder.event.ticket.ticketNumber} · ${formatReminderOffsetLabel(reminder.offsetMinutes, "ZH_CN")} · ${formatScheduledFor(reminder.event.scheduledFor, "ZH_CN", recipient.timeZone)}`,
      bodyEn: `${reminder.event.ticket.ticketNumber} · ${formatReminderOffsetLabel(reminder.offsetMinutes, "EN")} · ${formatScheduledFor(reminder.event.scheduledFor, "EN", recipient.timeZone)}`,
    }));

    if (notificationData.length) {
      await prismaClient.notification.createMany({
        data: notificationData,
      });
    }

    for (const recipient of recipients) {
      try {
        await sendTicketEventEmail({
          kind: "reminder",
          recipient: {
            email: recipient.email,
            displayName: recipient.displayName,
            locale: recipient.locale,
            timeZone: recipient.timeZone,
          },
          ticket: {
            id: reminder.event.ticket.id,
            ticketNumber: reminder.event.ticket.ticketNumber,
            title: reminder.event.ticket.title,
            workspaceName: reminder.event.ticket.workspace.name,
          },
          event: {
            title: reminder.event.title,
            notes: reminder.event.notes ?? undefined,
            scheduledFor: reminder.event.scheduledFor,
          },
          offsetMinutes: reminder.offsetMinutes,
        });
      } catch (error) {
        console.error("Failed to send ticket-event reminder email", error);
      }
    }

    processedCount += 1;
  }

  return processedCount;
}
