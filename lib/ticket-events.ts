import type { Locale, PrismaClient } from "@prisma/client";

import { localeTokenMap } from "./constants.ts";
import { sendDiskSpaceAlertEmail, sendTicketDueDateReminderEmail, sendTicketEventEmail } from "./email.ts";
import { getDiskSpaceSummary, diskSpaceWarningThresholds } from "./disk-space.ts";
import { prisma } from "./prisma.ts";
import { formatReminderOffsetLabel } from "./reminder-labels.ts";

const monthMinutes = 30 * 24 * 60;
const weekMinutes = 7 * 24 * 60;

export const defaultTicketEventReminderOffsets = [monthMinutes * 2, monthMinutes, weekMinutes * 2, weekMinutes, 24 * 60, 120, 60, 30, 0] as const;

export function sanitizeTicketEventReminderOffsets(values: string[], options?: { allDay?: boolean }) {
  const parsed = Array.from(
    new Set(
      values
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value) && value >= 0 && value <= monthMinutes * 2),
    ),
  );

  const filtered = options?.allDay ? parsed.filter((value) => value === 0 || value >= 24 * 60) : parsed;

  return filtered.sort((a, b) => b - a);
}

export async function getWorkspaceEventRecipients(prismaClient: PrismaClient, workspaceId: string) {
  const memberships = await prismaClient.workspaceMembership.findMany({
    where: {
      workspaceId,
      user: {
        isActive: true,
      },
    },
    include: {
      user: true,
    },
    orderBy: {
      user: {
        displayName: "asc",
      },
    },
  });

  return Array.from(new Map(memberships.map((membership) => [membership.user.id, membership.user])).values());
}

function formatScheduledFor(date: Date, locale: Locale, allDay: boolean, timeZone?: string) {
  return new Intl.DateTimeFormat(localeTokenMap[locale], {
    dateStyle: "medium",
    ...(allDay ? { timeZone: "UTC" } : { timeStyle: "short", timeZone }),
  }).format(date);
}

function getLocalDateParts(date: Date, timeZone?: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    dateKey: `${values.year}-${values.month}-${values.day}`,
    hour: Number.parseInt(values.hour, 10),
    minute: Number.parseInt(values.minute, 10),
  };
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

    const recipients = await getWorkspaceEventRecipients(prismaClient, reminder.event.ticket.workspaceId);

    const notificationData = recipients.map((recipient) => ({
      userId: recipient.id,
      ticketId: reminder.event.ticket.id,
      eventType: "ticket.event.reminder",
      titleZh: `提醒：${reminder.event.title}`,
      titleEn: `Reminder: ${reminder.event.title}`,
      bodyZh: `${reminder.event.ticket.ticketNumber} · ${formatReminderOffsetLabel(reminder.offsetMinutes, "ZH_CN")} · ${formatScheduledFor(reminder.event.scheduledFor, "ZH_CN", reminder.event.allDay, recipient.timeZone)}`,
      bodyEn: `${reminder.event.ticket.ticketNumber} · ${formatReminderOffsetLabel(reminder.offsetMinutes, "EN")} · ${formatScheduledFor(reminder.event.scheduledFor, "EN", reminder.event.allDay, recipient.timeZone)}`,
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
            allDay: reminder.event.allDay,
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

export async function processDueTicketDeadlineReminders(options: EventReminderProcessorOptions = {}) {
  const prismaClient = options.prismaClient ?? prisma;
  const now = options.now ?? new Date();

  const tickets = await prismaClient.ticket.findMany({
    where: {
      dueDate: {
        not: null,
      },
      status: {
        key: {
          notIn: ["RESOLVED", "CLOSED", "CANCELLED"],
        },
      },
    },
    include: {
      workspace: true,
      status: true,
    },
    orderBy: {
      dueDate: "asc",
    },
  });

  let processedCount = 0;

  for (const ticket of tickets) {
    if (!ticket.dueDate) {
      continue;
    }

    const dueDateKey = ticket.dueDate.toISOString().slice(0, 10);
    const recipients = await getWorkspaceEventRecipients(prismaClient, ticket.workspaceId);

    for (const recipient of recipients) {
      const localNow = getLocalDateParts(now, recipient.timeZone);

      if (localNow.dateKey !== dueDateKey || localNow.hour < 9) {
        continue;
      }

      try {
        await prismaClient.ticketDueDateReminder.create({
          data: {
            ticketId: ticket.id,
            userId: recipient.id,
            dueDate: ticket.dueDate,
          },
        });
      } catch {
        continue;
      }

      await prismaClient.notification.create({
        data: {
          userId: recipient.id,
          ticketId: ticket.id,
          eventType: "ticket.due_date.reminder",
          titleZh: `今日到期：${ticket.ticketNumber}`,
          titleEn: `Due today: ${ticket.ticketNumber}`,
          bodyZh: `${ticket.ticketNumber} · ${ticket.title} · 今天上午提醒`,
          bodyEn: `${ticket.ticketNumber} · ${ticket.title} · 9 AM reminder`,
        },
      });

      try {
        await sendTicketDueDateReminderEmail({
          recipient: {
            email: recipient.email,
            displayName: recipient.displayName,
            locale: recipient.locale,
            timeZone: recipient.timeZone,
          },
          ticket: {
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            title: ticket.title,
            workspaceName: ticket.workspace.name,
            dueDate: ticket.dueDate,
          },
          attachCalendarInvite: recipient.dueDateCalendarInvitesEnabled,
        });
      } catch (error) {
        console.error("Failed to send due-date reminder email", error);
      }

      processedCount += 1;
    }
  }

  return processedCount;
}

export async function processDueTicketReminders(options: EventReminderProcessorOptions = {}) {
  const [eventCount, deadlineCount, diskAlertCount] = await Promise.all([
    processDueTicketEventReminders(options),
    processDueTicketDeadlineReminders(options),
    processDiskSpaceAlerts(options),
  ]);

  return eventCount + deadlineCount + diskAlertCount;
}

export async function processDiskSpaceAlerts(options: EventReminderProcessorOptions = {}) {
  const prismaClient = options.prismaClient ?? prisma;
  const disk = await getDiskSpaceSummary();

  if (!disk) {
    return 0;
  }

  const admins = await prismaClient.user.findMany({
    where: {
      role: "ADMIN",
      isActive: true,
    },
    orderBy: { displayName: "asc" },
  });

  if (!admins.length) {
    return 0;
  }

  let processedCount = 0;

  for (const threshold of diskSpaceWarningThresholds) {
    const key = `disk_space_below_${threshold}`;
    const isBelow = disk.freePercent <= threshold;
    const existing = await prismaClient.systemAlertState.findUnique({
      where: { key },
    });

    if (!isBelow) {
      if (existing?.isActive) {
        await prismaClient.systemAlertState.update({
          where: { key },
          data: {
            isActive: false,
            clearedAt: new Date(),
          },
        });
      }
      continue;
    }

    if (existing?.isActive) {
      continue;
    }

    await prismaClient.systemAlertState.upsert({
      where: { key },
      update: {
        isActive: true,
        triggeredAt: new Date(),
      },
      create: {
        key,
        isActive: true,
        triggeredAt: new Date(),
      },
    });

    await prismaClient.notification.createMany({
      data: admins.map((admin) => ({
        userId: admin.id,
        eventType: "system.disk_space.warning",
        titleZh: `磁盘空间不足（剩余 ${disk.freePercent.toFixed(1)}%）`,
        titleEn: `Low disk space (${disk.freePercent.toFixed(1)}% free)`,
        bodyZh: `剩余 ${threshold}% 阈值已触发，请查看设置中的磁盘状态。`,
        bodyEn: `The ${threshold}% free-space threshold has been triggered. Review disk status in Settings.`,
      })),
    });

    for (const admin of admins) {
      try {
        await sendDiskSpaceAlertEmail({
          recipient: {
            email: admin.email,
            displayName: admin.displayName,
            locale: admin.locale,
          },
          freePercent: disk.freePercent,
          freeBytes: disk.freeBytes,
          totalBytes: disk.totalBytes,
          thresholdPercent: threshold,
        });
      } catch (error) {
        console.error("Failed to send disk-space alert email", error);
      }
    }

    processedCount += 1;
  }

  return processedCount;
}
