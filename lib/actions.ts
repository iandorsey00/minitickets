"use server";

import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AccentColor, Locale, ThemePreference, UserRole, WorkspaceRole } from "@prisma/client";
import { cookies, headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  clearLoginEmailChallenge,
  createLoginEmailChallenge,
  createSession,
  destroySession,
  getCurrentUser,
  getMiniAuthLoginUrl,
  getMiniAuthLogoutUrl,
  getPendingLoginChallenge,
  requireUser,
  revokeMiniAuthSession,
} from "@/lib/auth";
import { AUTH_ROUTES, MINI_AUTH_LOGIN_REDIRECT_ENABLED, MINI_AUTH_WORKSPACE_SYNC_ENABLED } from "@/lib/auth-config";
import {
  ACCENT_COOKIE,
  LOCALE_COOKIE,
  THEME_COOKIE,
  WORKSPACE_COOKIE,
  timeZoneValues,
} from "@/lib/constants";
import { getDefaultDefinitionIds } from "@/lib/data";
import { ensureCoreDefinitions } from "@/lib/catalog";
import {
  sendLoginCodeEmail,
  sendPasswordSetupEmail,
  sendTicketEmail,
  sendTicketDueDateInviteEmail,
  sendTicketEventEmail,
  sendWelcomeEmail,
} from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createPasswordSetupToken, hashPasswordSetupToken } from "@/lib/password-setup";
import { prisma } from "@/lib/prisma";
import { assertRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { sanitizeTicketEventReminderOffsets } from "@/lib/ticket-events";
import { getTicketAssigneeUsers, getTicketRecipientUsers } from "@/lib/ticket-assignees";
import { fallbackTicketPrefixFromSlug, formatTicketNumber, normalizeTicketPrefix } from "@/lib/tickets";
import { autoCloseResolvedTickets } from "@/lib/ticket-status";
import { MAX_ATTACHMENT_SIZE_BYTES, getTicketAttachmentDiskPath, getTicketAttachmentUrl, getUploadsRoot } from "@/lib/uploads";

const MAX_COMMENT_LENGTH = 10000;

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const ticketSchema = z.object({
  workspaceId: z.string().min(1),
  parentTicketId: z.string().optional(),
  title: z.string().min(3).max(120),
  description: z.string().max(5000).optional(),
  assigneeIds: z.array(z.string()).optional(),
  statusId: z.string().optional(),
  priorityId: z.string().optional(),
  dueDate: z.string().optional(),
  paymentLabel: z.string().max(60).optional(),
  paymentLast4: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

const commentSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().trim().min(2).max(MAX_COMMENT_LENGTH),
});

const attachmentSchema = z.object({
  ticketId: z.string().min(1),
});

const ticketEventSchema = z.object({
  ticketId: z.string().min(1),
  title: z.string().min(2).max(120),
  scheduledFor: z.string().datetime(),
  allDay: z.enum(["true", "false"]).transform((value) => value === "true"),
  notes: z.string().max(2000).optional(),
});

const updateTicketEventSchema = z.object({
  ticketId: z.string().min(1),
  eventId: z.string().min(1),
  title: z.string().min(2).max(120),
  scheduledFor: z.string().datetime(),
  allDay: z.enum(["true", "false"]).transform((value) => value === "true"),
  notes: z.string().max(2000).optional(),
});

const deleteTicketEventSchema = z.object({
  ticketId: z.string().min(1),
  eventId: z.string().min(1),
});

const settingsSchema = z.object({
  displayName: z.string().min(2).max(60),
  locale: z.nativeEnum(Locale),
  timeZone: z.enum(timeZoneValues),
  themePreference: z.nativeEnum(ThemePreference),
  accentColor: z.nativeEnum(AccentColor),
  emailMfaEnabled: z.boolean(),
  commentEmailsEnabled: z.boolean(),
  eventCalendarInvitesEnabled: z.boolean(),
  dueDateCalendarInvitesEnabled: z.boolean(),
  password: z.string().optional(),
  passwordConfirm: z.string().optional(),
});

const setupPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(8),
  passwordConfirm: z.string().min(8),
});

const verifyLoginCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

const reopenTicketSchema = z.object({
  ticketId: z.string().min(1),
});

const sendDueDateInviteSchema = z.object({
  ticketId: z.string().min(1),
  recipientIds: z.array(z.string().min(1)).min(1),
});

const deletePaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1),
  workspaceId: z.string().min(1),
});

const updatePaymentMethodSchema = z.object({
  paymentMethodId: z.string().min(1),
  workspaceId: z.string().min(1),
  label: z.string().trim().min(1).max(60),
  last4: z.string().regex(/^\d{4}$/),
});

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  );

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function getUtcDateForLocalTime(dateKey: string, hour: number, minute: number, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map((value) => Number.parseInt(value, 10));
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  const actual = getDatePartsInTimeZone(new Date(guess), timeZone);
  const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
  const desiredAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  return new Date(guess - (actualAsUtc - desiredAsUtc));
}

function normalizeTicketEventScheduledFor(rawScheduledFor: string, allDay: boolean) {
  const scheduledFor = new Date(rawScheduledFor);

  if (!allDay || Number.isNaN(scheduledFor.getTime())) {
    return scheduledFor;
  }

  const dateKey = scheduledFor.toISOString().slice(0, 10);
  const eventTimeZone = process.env.APP_TIMEZONE ?? "America/Los_Angeles";
  return getUtcDateForLocalTime(dateKey, 9, 0, eventTimeZone);
}

function uniqueRecipients<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function normalizeSelectedIds(values: FormDataEntryValue[]) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value))
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );
}

function buildAssigneeActivityMessage({
  addedUsers,
  removedUsers,
}: {
  addedUsers: Array<{ displayName: string }>;
  removedUsers: Array<{ displayName: string }>;
}) {
  const addedNames = addedUsers.map((user) => user.displayName);
  const removedNames = removedUsers.map((user) => user.displayName);

  if (addedNames.length && removedNames.length) {
    return {
      eventType: "ticket.assignees_updated",
      messageZh: `已更新处理人。新增：${addedNames.join("、")}；移除：${removedNames.join("、")}。`,
      messageEn: `Updated assignees. Added: ${addedNames.join(", ")}; removed: ${removedNames.join(", ")}.`,
    };
  }

  if (addedNames.length) {
    return {
      eventType: "ticket.assignees_updated",
      messageZh: `已添加处理人：${addedNames.join("、")}。`,
      messageEn: `Added assignees: ${addedNames.join(", ")}.`,
    };
  }

  if (removedNames.length) {
    return {
      eventType: "ticket.assignees_updated",
      messageZh: `已移除处理人：${removedNames.join("、")}。`,
      messageEn: `Removed assignees: ${removedNames.join(", ")}.`,
    };
  }

  return null;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getUserMentionAliases<T extends { displayName: string; email: string }>(user: T) {
  const aliases = new Set<string>();
  const displayName = user.displayName.trim();
  const email = user.email.trim();

  if (displayName) {
    aliases.add(displayName);

    const firstToken = displayName.split(/\s+/)[0]?.trim();
    if (firstToken && firstToken.length >= 2) {
      aliases.add(firstToken);
    }
  }

  if (email) {
    aliases.add(email);

    const localPart = email.split("@")[0]?.trim();
    if (localPart && localPart.length >= 2) {
      aliases.add(localPart);
    }
  }

  return Array.from(aliases);
}

function getMentionedUsersFromComment<T extends { id: string; displayName: string; email: string }>(
  body: string,
  users: T[],
  authorId: string,
) {
  const normalizedBody = body.normalize("NFKC");
  const sortedUsers = [...users].sort((a, b) => b.displayName.length - a.displayName.length);
  const mentioned: T[] = [];
  const aliasCounts = new Map<string, number>();

  for (const user of sortedUsers) {
    for (const alias of getUserMentionAliases(user)) {
      const normalizedAlias = alias.toLocaleLowerCase();
      aliasCounts.set(normalizedAlias, (aliasCounts.get(normalizedAlias) ?? 0) + 1);
    }
  }

  for (const user of sortedUsers) {
    if (user.id === authorId) {
      continue;
    }

    const patterns = getUserMentionAliases(user).filter((pattern) => {
      const normalizedPattern = pattern.toLocaleLowerCase();
      return pattern === user.displayName.trim() || pattern === user.email.trim() || aliasCounts.get(normalizedPattern) === 1;
    });
    const matched = patterns.some((pattern) => {
      const escaped = escapeRegExp(pattern);
      return new RegExp(`(^|[^\\p{L}\\p{N}_])@${escaped}(?=$|[\\s.,:;!?，。；：！？）)\\]\\}])`, "iu").test(normalizedBody);
    });

    if (matched) {
      mentioned.push(user);
    }
  }

  return uniqueRecipients(mentioned);
}

async function getClientIp() {
  const headerStore = await headers();
  const forwarded = headerStore.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }
  return headerStore.get("x-real-ip") || "unknown";
}

async function resolveSavedPaymentMethodIds(
  userId: string,
  workspaceId: string,
  selectedIds: string[],
  manualLabel?: string | null,
  manualLast4?: string | null,
  saveManualMethod?: boolean,
) {
  const normalizedSelectedIds = Array.from(new Set(selectedIds.filter(Boolean)));
  const existingMethods = normalizedSelectedIds.length
    ? await prisma.paymentMethod.findMany({
        where: {
          id: { in: normalizedSelectedIds },
          workspaceId,
        },
        select: { id: true },
      })
    : [];

  const validIds = existingMethods.map((method) => method.id);

  if (saveManualMethod && manualLabel && manualLast4) {
    const savedMethod = await prisma.paymentMethod.upsert({
      where: {
        workspaceId_label_last4: {
          workspaceId,
          label: manualLabel,
          last4: manualLast4,
        },
      },
      update: {},
      create: {
        workspaceId,
        createdByUserId: userId,
        label: manualLabel,
        last4: manualLast4,
      },
      select: { id: true },
    });
    validIds.push(savedMethod.id);
  }

  return Array.from(new Set(validIds));
}

async function validateParentTicketSelection(parentTicketId: string | undefined | null, workspaceId: string, ticketId?: string) {
  if (!parentTicketId) {
    return null;
  }

  const parentTicket = await prisma.ticket.findUnique({
    where: { id: parentTicketId },
    select: {
      id: true,
      workspaceId: true,
      parentTicketId: true,
      ticketNumber: true,
      title: true,
    },
  });

  if (!parentTicket || parentTicket.workspaceId !== workspaceId || parentTicket.parentTicketId) {
    return null;
  }

  if (ticketId && parentTicket.id === ticketId) {
    return null;
  }

  return parentTicket;
}

async function resolveTicketAssigneeUsers(workspaceId: string, assigneeIds: string[]) {
  const normalizedAssigneeIds = Array.from(new Set(assigneeIds.filter(Boolean)));

  if (!normalizedAssigneeIds.length) {
    return [];
  }

  const assignees = await prisma.user.findMany({
    where: {
      id: { in: normalizedAssigneeIds },
      isActive: true,
    },
    include: {
      memberships: {
        where: {
          workspaceId,
        },
        select: {
          id: true,
        },
      },
    },
    orderBy: { displayName: "asc" },
  });

  if (assignees.length !== normalizedAssigneeIds.length) {
    return null;
  }

  const invalidAssignee = assignees.find((assignee) => !assignee.memberships.length && assignee.role !== UserRole.ADMIN);
  if (invalidAssignee) {
    return null;
  }

  return assignees.sort((left, right) => left.displayName.localeCompare(right.displayName, "en"));
}

export async function loginAction(formData: FormData) {
  const miniAuthLoginUrl = getMiniAuthLoginUrl(AUTH_ROUTES.postLogin);
  if (miniAuthLoginUrl !== AUTH_ROUTES.login) {
    redirect(miniAuthLoginUrl);
  }

  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect(`${AUTH_ROUTES.login}?error=invalid`);
  }

  try {
    await assertRateLimit("login", `${parsed.data.email.toLowerCase()}|${await getClientIp()}`, 5);
  } catch {
    redirect(`${AUTH_ROUTES.login}?error=invalid`);
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    redirect(`${AUTH_ROUTES.login}?error=invalid`);
  }

  if (!user.isActive) {
    redirect(`${AUTH_ROUTES.login}?error=inactive`);
  }

  if (user.emailMfaEnabled) {
    try {
      const { code } = await createLoginEmailChallenge(user.id);
      await sendLoginCodeEmail({
        recipient: {
          email: user.email,
          displayName: user.displayName,
          locale: user.locale,
        },
        code,
      });
    } catch (error) {
      console.error("Failed to send login verification code", error);
      await clearLoginEmailChallenge();
      redirect(`${AUTH_ROUTES.login}?error=mfa_send`);
    }

    await clearRateLimit("login", `${parsed.data.email.toLowerCase()}|${await getClientIp()}`);
    redirect(AUTH_ROUTES.verifyLogin);
  }

  await createSession(user);
  await clearRateLimit("login", `${parsed.data.email.toLowerCase()}|${await getClientIp()}`);
  redirect(AUTH_ROUTES.postLogin);
}

export async function verifyLoginCodeAction(formData: FormData) {
  const miniAuthLoginUrl = getMiniAuthLoginUrl(AUTH_ROUTES.postLogin);
  if (miniAuthLoginUrl !== AUTH_ROUTES.login) {
    redirect(miniAuthLoginUrl);
  }

  const parsed = verifyLoginCodeSchema.safeParse({
    code: formData.get("code"),
  });

  const pendingChallenge = await getPendingLoginChallenge();
  if (!pendingChallenge) {
    redirect(AUTH_ROUTES.login);
  }

  if (!parsed.success) {
    redirect(`${AUTH_ROUTES.verifyLogin}?error=invalid`);
  }

  try {
    await assertRateLimit("login_mfa_verify", `${pendingChallenge.tokenHash}|${await getClientIp()}`, 5);
  } catch {
    redirect(`${AUTH_ROUTES.verifyLogin}?error=expired`);
  }

  const codeHash = crypto.createHash("sha256").update(parsed.data.code).digest("hex");
  if (codeHash !== pendingChallenge.codeHash) {
    redirect(`${AUTH_ROUTES.verifyLogin}?error=invalid`);
  }

  await prisma.loginEmailChallenge.update({
    where: { tokenHash: pendingChallenge.tokenHash },
    data: { usedAt: new Date() },
  });

  await clearRateLimit("login_mfa_verify", `${pendingChallenge.tokenHash}|${await getClientIp()}`);
  await clearLoginEmailChallenge();
  await createSession(pendingChallenge.user);
  redirect(AUTH_ROUTES.postLogin);
}

export async function resendLoginCodeAction() {
  const miniAuthLoginUrl = getMiniAuthLoginUrl(AUTH_ROUTES.postLogin);
  if (miniAuthLoginUrl !== AUTH_ROUTES.login) {
    redirect(miniAuthLoginUrl);
  }

  const pendingChallenge = await getPendingLoginChallenge();
  if (!pendingChallenge) {
    redirect(AUTH_ROUTES.login);
  }

  try {
    await assertRateLimit("login_mfa_send", `${pendingChallenge.userId}|${await getClientIp()}`, 3);
  } catch {
    redirect(`${AUTH_ROUTES.verifyLogin}?error=expired`);
  }

  try {
    const { code } = await createLoginEmailChallenge(pendingChallenge.userId);
    await sendLoginCodeEmail({
      recipient: {
        email: pendingChallenge.user.email,
        displayName: pendingChallenge.user.displayName,
        locale: pendingChallenge.user.locale,
      },
      code,
    });
  } catch (error) {
    console.error("Failed to resend login verification code", error);
    await clearLoginEmailChallenge();
    redirect(`${AUTH_ROUTES.verifyLogin}?error=invalid`);
  }

  redirect(`${AUTH_ROUTES.verifyLogin}?sent=1`);
}

export async function logoutAction() {
  await destroySession();
  const miniAuthLogoutUrl = getMiniAuthLogoutUrl(AUTH_ROUTES.login);

  if (miniAuthLogoutUrl) {
    redirect(miniAuthLogoutUrl);
  }

  await revokeMiniAuthSession();
  redirect(AUTH_ROUTES.login);
}

export async function switchWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");

  const allowed =
    user.role === UserRole.ADMIN
      ? await prisma.workspace.findFirst({
          where: {
            id: workspaceId,
            isArchived: false,
          },
          select: { id: true },
        })
      : await prisma.workspaceMembership.findFirst({
          where: {
            userId: user.id,
            workspaceId,
          },
          select: { id: true },
        });

  if (allowed) {
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, workspaceId, { path: "/" });
  }

  redirect(AUTH_ROUTES.postLogin);
}

export async function createTicketAction(formData: FormData) {
  const user = await requireUser();

  const parsed = ticketSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    parentTicketId: formData.get("parentTicketId") || undefined,
    title: formData.get("title"),
    description: formData.get("description"),
    assigneeIds: normalizeSelectedIds(formData.getAll("assigneeIds")),
    statusId: formData.get("statusId") || undefined,
    priorityId: formData.get("priorityId") || undefined,
    dueDate: formData.get("dueDate") || undefined,
    paymentLabel: formData.get("paymentLabel") || undefined,
    paymentLast4: formData.get("paymentLast4") || undefined,
  });

  if (!parsed.success) {
    redirect("/tickets/new?error=invalid");
  }

  const selectedPaymentMethodIds = formData
    .getAll("savedPaymentMethodIds")
    .map((value) => String(value))
    .filter(Boolean);

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
    },
  });

  if (!membership && user.role !== UserRole.ADMIN) {
    redirect("/tickets/new?error=forbidden");
  }

  const assignees = await resolveTicketAssigneeUsers(parsed.data.workspaceId, parsed.data.assigneeIds ?? []);
  if (!assignees) {
    redirect("/tickets/new?error=invalid");
  }

  const parentTicket = await validateParentTicketSelection(parsed.data.parentTicketId, parsed.data.workspaceId);
  if (parsed.data.parentTicketId && !parentTicket) {
    redirect("/tickets/new?error=invalid");
  }

  const defaults = await getDefaultDefinitionIds();
  await ensureCoreDefinitions();
  if (
    (!parsed.data.statusId && !defaults.statusId) ||
    (!parsed.data.priorityId && !defaults.priorityId)
  ) {
    redirect("/tickets/new?error=definitions");
  }
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: parsed.data.workspaceId },
    select: { id: true, slug: true, ticketPrefix: true, paymentInfoEnabled: true },
  });
  const latest = await prisma.ticket.findFirst({
    where: { workspaceId: workspace.id },
    orderBy: { serialNumber: "desc" },
    select: { serialNumber: true },
  });
  const serialNumber = (latest?.serialNumber ?? 0) + 1;
  const ticketPrefix = workspace.ticketPrefix || fallbackTicketPrefixFromSlug(workspace.slug);
  const ticketNumber = formatTicketNumber(ticketPrefix, serialNumber);
  const inProgressStatus = await prisma.statusDefinition.findUnique({
    where: { key: "IN_PROGRESS" },
    select: { id: true },
  });
  const finalStatusId =
    assignees.length && inProgressStatus && (!parsed.data.statusId || parsed.data.statusId === defaults.statusId)
      ? inProgressStatus.id
      : parsed.data.statusId || defaults.statusId!;
  const primaryAssigneeId = assignees[0]?.id ?? null;

  const ticket = await prisma.ticket.create({
    data: {
      serialNumber,
      ticketNumber,
      title: parsed.data.title,
      description: parsed.data.description?.trim() || "",
      workspaceId: parsed.data.workspaceId,
      parentTicketId: parentTicket?.id ?? null,
      requesterId: user.id,
      assigneeId: primaryAssigneeId,
      assignees: assignees.length
        ? {
            create: assignees.map((assignee) => ({
              userId: assignee.id,
            })),
          }
        : undefined,
      statusId: finalStatusId,
      priorityId: parsed.data.priorityId || defaults.priorityId!,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      paymentLabel: workspace.paymentInfoEnabled ? parsed.data.paymentLabel || null : null,
      paymentLast4: workspace.paymentInfoEnabled ? parsed.data.paymentLast4 || null : null,
      paymentMethods: workspace.paymentInfoEnabled
        ? {
            create:
              (
                await resolveSavedPaymentMethodIds(
                  user.id,
                  parsed.data.workspaceId,
                  selectedPaymentMethodIds,
                  parsed.data.paymentLabel || null,
                  parsed.data.paymentLast4 || null,
                  formData.get("savePaymentMethod") === "yes",
                )
              ).map((paymentMethodId) => ({
                paymentMethodId,
              })),
          }
        : undefined,
      activities: {
        create: {
          actorUserId: user.id,
          eventType: "ticket.created",
          messageZh: "已提交工单。",
          messageEn: "Request submitted.",
        },
      },
    },
    include: {
      workspace: true,
      requester: true,
      assignee: true,
      assignees: {
        include: {
          user: true,
        },
      },
      status: true,
    },
  });

  const newlyAssignedUsers = getTicketAssigneeUsers(ticket).filter((assignee) => assignee.id !== user.id);

  if (newlyAssignedUsers.length) {
    await prisma.notification.createMany({
      data: newlyAssignedUsers.map((assignee) => ({
        userId: assignee.id,
        ticketId: ticket.id,
        eventType: "ticket.assigned",
        titleZh: `你被分配到工单 ${ticket.ticketNumber}`,
        titleEn: `You were assigned ${ticket.ticketNumber}`,
        bodyZh: ticket.title,
        bodyEn: ticket.title,
      })),
    });
  }

  try {
    await sendTicketEmail({
      kind: "created",
      recipient: {
        email: ticket.requester.email,
        displayName: ticket.requester.displayName,
        locale: ticket.requester.locale,
      },
      ticket: {
        id: ticket.id,
        ticketNumber: ticket.ticketNumber,
        title: ticket.title,
        workspaceName: ticket.workspace.name,
        parentTicketNumber: parentTicket?.ticketNumber,
        parentTitle: parentTicket?.title,
        dueDate: ticket.dueDate ?? undefined,
      },
      attachDueDateInvite: ticket.requester.dueDateCalendarInvitesEnabled,
    });
  } catch (error) {
    console.error("Failed to send created-ticket email", error);
  }

  for (const assignee of newlyAssignedUsers) {
    try {
      await sendTicketEmail({
        kind: "assigned",
        recipient: {
          email: assignee.email,
          displayName: assignee.displayName,
          locale: assignee.locale,
        },
        actorName: user.displayName,
        ticket: {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          workspaceName: ticket.workspace.name,
          parentTicketNumber: parentTicket?.ticketNumber,
          parentTitle: parentTicket?.title,
        },
      });
    } catch (error) {
      console.error("Failed to send assignment email", error);
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/tickets");
  revalidatePath(`/workspaces/${ticket.workspaceId}`);
  redirect(`/tickets/${ticket.id}`);
}

export async function updateTicketAction(formData: FormData) {
  await autoCloseResolvedTickets();
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "");
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      workspace: {
        select: {
          paymentInfoEnabled: true,
        },
      },
      status: true,
      parentTicket: {
        select: {
          id: true,
          ticketNumber: true,
          title: true,
        },
      },
      childTickets: {
        select: { id: true },
        take: 1,
      },
      assignees: {
        include: {
          user: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  if (!ticket) {
    redirect("/tickets");
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id, workspaceId: ticket.workspaceId },
  });

  if (!membership && user.role !== UserRole.ADMIN) {
    redirect("/tickets");
  }

  if (ticket.status.key === "CLOSED") {
    redirect(`/tickets/${ticketId}?closed=1`);
  }

  const nextValues = {
    statusId: String(formData.get("statusId") ?? ticket.statusId),
    priorityId: String(formData.get("priorityId") ?? ticket.priorityId),
    parentTicketId: String(formData.get("parentTicketId") ?? "") || null,
    assigneeIds: normalizeSelectedIds(formData.getAll("assigneeIds")),
    dueDate: String(formData.get("dueDate") ?? "") || null,
    paymentLabel: String(formData.get("paymentLabel") ?? "") || null,
    paymentLast4: String(formData.get("paymentLast4") ?? "") || null,
    title: String(formData.get("title") ?? ticket.title),
    description: String(formData.get("description") ?? ticket.description),
  };
  const selectedPaymentMethodIds = formData
    .getAll("savedPaymentMethodIds")
    .map((value) => String(value))
    .filter(Boolean);

  const nextStatus = await prisma.statusDefinition.findUnique({
    where: { id: nextValues.statusId },
    select: { key: true, labelZh: true, labelEn: true },
  });
  const inProgressStatus = await prisma.statusDefinition.findUnique({
    where: { key: "IN_PROGRESS" },
    select: { id: true, key: true, labelZh: true, labelEn: true },
  });

  if (!nextStatus) {
    redirect(`/tickets/${ticketId}`);
  }

  const nextAssignees = await resolveTicketAssigneeUsers(ticket.workspaceId, nextValues.assigneeIds);
  if (!nextAssignees) {
    redirect(`/tickets/${ticketId}`);
  }

  if (ticket.childTickets.length && nextValues.parentTicketId && nextValues.parentTicketId !== ticket.parentTicketId) {
    redirect(`/tickets/${ticketId}`);
  }

  const parentTicket = await validateParentTicketSelection(nextValues.parentTicketId, ticket.workspaceId, ticket.id);
  if (nextValues.parentTicketId && !parentTicket) {
    redirect(`/tickets/${ticketId}`);
  }

  const activities = [];
  const currentAssigneeUsers = getTicketAssigneeUsers(ticket);
  const currentAssigneeIds = new Set(currentAssigneeUsers.map((assignee) => assignee.id));
  const nextAssigneeIds = new Set(nextAssignees.map((assignee) => assignee.id));
  const addedAssignees = nextAssignees.filter((assignee) => !currentAssigneeIds.has(assignee.id));
  const removedAssignees = currentAssigneeUsers.filter((assignee) => !nextAssigneeIds.has(assignee.id));

  if (nextValues.priorityId !== ticket.priorityId) {
    activities.push({
      actorUserId: user.id,
      eventType: "ticket.priority_changed",
      messageZh: "已更新优先级。",
      messageEn: "Priority updated.",
    });
  }
  const assigneeActivity = buildAssigneeActivityMessage({
    addedUsers: addedAssignees,
    removedUsers: removedAssignees,
  });
  if (assigneeActivity) {
    activities.push({
      actorUserId: user.id,
      ...assigneeActivity,
    });
  }
  if (nextValues.parentTicketId !== ticket.parentTicketId) {
    activities.push({
      actorUserId: user.id,
      eventType: "ticket.parent_updated",
      messageZh: "已更新父工单。",
      messageEn: "Parent ticket updated.",
    });
  }
  if (
    ticket.workspace.paymentInfoEnabled &&
    (nextValues.paymentLast4 !== ticket.paymentLast4 || nextValues.paymentLabel !== ticket.paymentLabel)
  ) {
    activities.push({
      actorUserId: user.id,
      eventType: "ticket.payment_updated",
      messageZh: "已更新支付信息。",
      messageEn: "Payment information updated.",
    });
  }

  const finalStatusId =
    nextAssignees.length &&
    inProgressStatus &&
    (nextStatus.key === "NEW" || nextStatus.key === "OPEN")
      ? inProgressStatus.id
      : nextValues.statusId;
  const finalStatusKey =
    nextAssignees.length &&
    inProgressStatus &&
    (nextStatus.key === "NEW" || nextStatus.key === "OPEN")
      ? inProgressStatus.key
      : nextStatus.key;
  const finalStatusLabelZh =
    nextAssignees.length &&
    inProgressStatus &&
    (nextStatus.key === "NEW" || nextStatus.key === "OPEN")
      ? inProgressStatus.labelZh
      : nextStatus.labelZh;
  const finalStatusLabelEn =
    nextAssignees.length &&
    inProgressStatus &&
    (nextStatus.key === "NEW" || nextStatus.key === "OPEN")
      ? inProgressStatus.labelEn
      : nextStatus.labelEn;
  const statusChanged = finalStatusId !== ticket.statusId;

  if (statusChanged) {
    activities.push({
      actorUserId: user.id,
      eventType: "ticket.status_changed",
      messageZh: `状态已从「${ticket.status.labelZh}」改为「${finalStatusLabelZh}」。`,
      messageEn: `Status changed from "${ticket.status.labelEn}" to "${finalStatusLabelEn}".`,
    });
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      statusId: finalStatusId,
      priorityId: nextValues.priorityId,
      assigneeId: nextAssignees[0]?.id ?? null,
      assignees: {
        deleteMany: {},
        create: nextAssignees.map((assignee) => ({
          userId: assignee.id,
        })),
      },
      title: nextValues.title,
      description: nextValues.description,
      parentTicketId: parentTicket?.id ?? null,
      dueDate: nextValues.dueDate ? new Date(nextValues.dueDate) : null,
      resolvedAt:
        finalStatusKey === "RESOLVED"
          ? ticket.status.key === "RESOLVED" && ticket.resolvedAt
            ? ticket.resolvedAt
            : new Date()
          : finalStatusKey === "CLOSED"
            ? ticket.resolvedAt ?? new Date()
            : null,
      ...(ticket.workspace.paymentInfoEnabled
        ? {
            paymentLabel: nextValues.paymentLabel,
            paymentLast4: nextValues.paymentLast4,
            paymentMethods: {
              deleteMany: {},
              create:
                (
                  await resolveSavedPaymentMethodIds(
                    user.id,
                    ticket.workspaceId,
                    selectedPaymentMethodIds,
                    nextValues.paymentLabel,
                    nextValues.paymentLast4,
                    formData.get("savePaymentMethod") === "yes",
                  )
                ).map((paymentMethodId) => ({
                  paymentMethodId,
                })),
            },
          }
        : {}),
      activities: activities.length ? { create: activities } : undefined,
    },
    include: {
      workspace: true,
      requester: true,
      assignee: true,
      assignees: {
        include: {
          user: true,
        },
      },
      status: true,
    },
  });

  const addedAssignableRecipients = addedAssignees.filter((assignee) => assignee.id !== user.id);

  if (addedAssignableRecipients.length) {
    await prisma.notification.createMany({
      data: addedAssignableRecipients.map((assignee) => ({
        userId: assignee.id,
        ticketId,
        eventType: "ticket.assigned",
        titleZh: `工单 ${ticket.ticketNumber} 已分配给你`,
        titleEn: `${ticket.ticketNumber} was assigned to you`,
        bodyZh: updatedTicket.title,
        bodyEn: updatedTicket.title,
      })),
    });
  }

  for (const assignee of addedAssignableRecipients) {
    try {
      await sendTicketEmail({
        kind: "assigned",
        recipient: {
          email: assignee.email,
          displayName: assignee.displayName,
          locale: assignee.locale,
        },
        actorName: user.displayName,
        ticket: {
          id: updatedTicket.id,
          ticketNumber: updatedTicket.ticketNumber,
          title: updatedTicket.title,
          workspaceName: updatedTicket.workspace.name,
        },
      });
    } catch (error) {
      console.error("Failed to send assignment email", error);
    }
  }

  if (statusChanged && ["RESOLVED", "CLOSED"].includes(updatedTicket.status.key)) {
    const recipients = getTicketRecipientUsers(updatedTicket);

    if (recipients.length) {
      await prisma.notification.createMany({
        data: recipients.map((recipient) => ({
          userId: recipient.id,
          ticketId: updatedTicket.id,
          eventType: "ticket.resolved",
          titleZh: `${updatedTicket.ticketNumber} 已更新为${updatedTicket.status.labelZh}`,
          titleEn: `${updatedTicket.ticketNumber} is now ${updatedTicket.status.labelEn}`,
          bodyZh: updatedTicket.title,
          bodyEn: updatedTicket.title,
        })),
      });
    }

    for (const recipient of recipients) {
      try {
        await sendTicketEmail({
          kind: "resolved",
          recipient: {
            email: recipient.email,
            displayName: recipient.displayName,
            locale: recipient.locale,
          },
          actorName: user.displayName,
          ticket: {
            id: updatedTicket.id,
            ticketNumber: updatedTicket.ticketNumber,
            title: updatedTicket.title,
            workspaceName: updatedTicket.workspace.name,
            statusLabelZh: updatedTicket.status.labelZh,
            statusLabelEn: updatedTicket.status.labelEn,
          },
        });
      } catch (error) {
        console.error("Failed to send resolved-ticket email", error);
      }
    }
  }

  revalidatePath(`/tickets/${ticketId}`);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  redirect(`/tickets/${ticketId}?saved=1`);
}

export async function reopenTicketAction(formData: FormData) {
  const user = await requireUser();
  const parsed = reopenTicketSchema.safeParse({
    ticketId: formData.get("ticketId"),
  });

  if (!parsed.success) {
    redirect("/tickets");
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    include: {
      workspace: true,
      requester: true,
      assignee: true,
      assignees: {
        include: {
          user: true,
        },
      },
      status: true,
    },
  });

  if (!ticket) {
    redirect("/tickets");
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id, workspaceId: ticket.workspaceId },
  });

  if (!membership && user.role !== UserRole.ADMIN) {
    redirect("/tickets");
  }

  if (ticket.status.key !== "CLOSED") {
    redirect(`/tickets/${ticket.id}`);
  }

  const inProgressStatus = await prisma.statusDefinition.findUnique({
    where: { key: "IN_PROGRESS" },
    select: { id: true },
  });

  if (!inProgressStatus) {
    redirect(`/tickets/${ticket.id}`);
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticket.id },
    data: {
      statusId: inProgressStatus.id,
      resolvedAt: null,
      activities: {
        create: {
          actorUserId: user.id,
          eventType: "ticket.reopened",
          messageZh: "已重新打开工单。",
          messageEn: "Reopened the ticket.",
        },
      },
    },
    include: {
      requester: true,
      assignee: true,
      assignees: {
        include: {
          user: true,
        },
      },
    },
  });

  const recipients = getTicketRecipientUsers(updatedTicket);

  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        ticketId: updatedTicket.id,
        eventType: "ticket.reopened",
        titleZh: `${updatedTicket.ticketNumber} 已重新打开`,
        titleEn: `${updatedTicket.ticketNumber} was reopened`,
        bodyZh: updatedTicket.title,
        bodyEn: updatedTicket.title,
      })),
    });
  }

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  redirect(`/tickets/${ticket.id}?saved=1`);
}

export async function createTicketEventAction(formData: FormData) {
  const user = await requireUser();
  const parsed = ticketEventSchema.safeParse({
    ticketId: formData.get("ticketId"),
    title: formData.get("title"),
    scheduledFor: formData.get("scheduledFor"),
    allDay: formData.get("allDay"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    redirect(`/tickets/${String(formData.get("ticketId") ?? "")}`);
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    include: {
      status: true,
      workspace: true,
      requester: true,
      assignee: true,
      assignees: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!ticket) {
    redirect("/tickets");
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      userId: user.id,
      workspaceId: ticket.workspaceId,
    },
  });

  if (!membership && user.role !== UserRole.ADMIN) {
    redirect("/tickets");
  }

  if (ticket.status.key === "CLOSED") {
    redirect(`/tickets/${ticket.id}?closed=1`);
  }

  const reminderOffsets = sanitizeTicketEventReminderOffsets(
    formData.getAll("reminderOffsets").map((value) => String(value)),
    { allDay: parsed.data.allDay },
  );
  const scheduledFor = normalizeTicketEventScheduledFor(parsed.data.scheduledFor, parsed.data.allDay);

  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() < Date.now() - 60_000) {
    redirect(`/tickets/${ticket.id}`);
  }

  const [event] = await prisma.$transaction([
    prisma.ticketEvent.create({
      data: {
        ticketId: ticket.id,
        createdByUserId: user.id,
        title: parsed.data.title,
        notes: parsed.data.notes?.trim() || null,
        allDay: parsed.data.allDay,
        scheduledFor,
        reminders: reminderOffsets.length
          ? {
              create: reminderOffsets.map((offsetMinutes) => ({
                offsetMinutes,
              })),
            }
          : undefined,
      },
      include: {
        reminders: true,
      },
    }),
    prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        actorUserId: user.id,
        eventType: "ticket.event_created",
        messageZh: `已安排事件：${parsed.data.title}`,
        messageEn: `Scheduled event: ${parsed.data.title}`,
      },
    }),
    prisma.ticket.update({
      where: { id: ticket.id },
      data: {},
    }),
  ]);

  const recipients = getTicketRecipientUsers(ticket);

  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((recipient) => ({
        userId: recipient.id,
        ticketId: ticket.id,
        eventType: "ticket.event.created",
        titleZh: `已安排事件：${event.title}`,
        titleEn: `Scheduled event: ${event.title}`,
        bodyZh: `${ticket.ticketNumber} · ${event.title}`,
        bodyEn: `${ticket.ticketNumber} · ${event.title}`,
      })),
    });
  }

  for (const recipient of recipients) {
    try {
      await sendTicketEventEmail({
        kind: "created",
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
        },
        attachCalendarInvite: recipient.eventCalendarInvitesEnabled,
        event: {
          id: event.id,
          title: event.title,
          notes: event.notes ?? undefined,
          allDay: event.allDay,
          scheduledFor: event.scheduledFor,
        },
      });
    } catch (error) {
      console.error("Failed to send created-event email", error);
    }
  }

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  redirect(`/tickets/${ticket.id}?saved=1`);
}

export async function deleteTicketEventAction(formData: FormData) {
  const user = await requireUser();
  const parsed = deleteTicketEventSchema.safeParse({
    ticketId: formData.get("ticketId"),
    eventId: formData.get("eventId"),
  });

  if (!parsed.success) {
    redirect("/tickets");
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    select: {
      id: true,
      workspaceId: true,
      status: true,
    },
  });

  if (!ticket) {
    redirect("/tickets");
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      userId: user.id,
      workspaceId: ticket.workspaceId,
    },
  });

  if (!membership && user.role !== UserRole.ADMIN) {
    redirect("/tickets");
  }

  if (ticket.status.key === "CLOSED") {
    redirect(`/tickets/${ticket.id}?closed=1`);
  }

  const event = await prisma.ticketEvent.findFirst({
    where: {
      id: parsed.data.eventId,
      ticketId: ticket.id,
    },
    select: {
      id: true,
      title: true,
    },
  });

  if (!event) {
    redirect(`/tickets/${ticket.id}`);
  }

  await prisma.$transaction([
    prisma.ticketEvent.delete({
      where: {
        id: event.id,
      },
    }),
    prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        actorUserId: user.id,
        eventType: "ticket.event_deleted",
        messageZh: `已删除事件：${event.title}`,
        messageEn: `Deleted event: ${event.title}`,
      },
    }),
    prisma.ticket.update({
      where: { id: ticket.id },
      data: {},
    }),
  ]);

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  redirect(`/tickets/${ticket.id}?saved=1`);
}

export async function updateTicketEventAction(formData: FormData) {
  const user = await requireUser();
  const parsed = updateTicketEventSchema.safeParse({
    ticketId: formData.get("ticketId"),
    eventId: formData.get("eventId"),
    title: formData.get("title"),
    scheduledFor: formData.get("scheduledFor"),
    allDay: formData.get("allDay"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    redirect(`/tickets/${String(formData.get("ticketId") ?? "")}`);
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    select: {
      id: true,
      workspaceId: true,
      status: true,
    },
  });

  if (!ticket) {
    redirect("/tickets");
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      userId: user.id,
      workspaceId: ticket.workspaceId,
    },
  });

  if (!membership && user.role !== UserRole.ADMIN) {
    redirect("/tickets");
  }

  if (ticket.status.key === "CLOSED") {
    redirect(`/tickets/${ticket.id}?closed=1`);
  }

  const event = await prisma.ticketEvent.findFirst({
    where: {
      id: parsed.data.eventId,
      ticketId: ticket.id,
    },
    select: {
      id: true,
    },
  });

  if (!event) {
    redirect(`/tickets/${ticket.id}`);
  }

  const reminderOffsets = sanitizeTicketEventReminderOffsets(
    formData.getAll("reminderOffsets").map((value) => String(value)),
    { allDay: parsed.data.allDay },
  );
  const scheduledFor = normalizeTicketEventScheduledFor(parsed.data.scheduledFor, parsed.data.allDay);

  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() < Date.now() - 60_000) {
    redirect(`/tickets/${ticket.id}`);
  }

  await prisma.$transaction([
    prisma.ticketEvent.update({
      where: {
        id: event.id,
      },
      data: {
        title: parsed.data.title,
        notes: parsed.data.notes?.trim() || null,
        allDay: parsed.data.allDay,
        scheduledFor,
        reminders: reminderOffsets.length
          ? {
              deleteMany: {},
              create: reminderOffsets.map((offsetMinutes) => ({
                offsetMinutes,
              })),
            }
          : {
              deleteMany: {},
            },
      },
    }),
    prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        actorUserId: user.id,
        eventType: "ticket.event_updated",
        messageZh: `已更新事件：${parsed.data.title}`,
        messageEn: `Updated event: ${parsed.data.title}`,
      },
    }),
    prisma.ticket.update({
      where: { id: ticket.id },
      data: {},
    }),
  ]);

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  redirect(`/tickets/${ticket.id}?saved=1`);
}

export async function addCommentAction(formData: FormData) {
  const user = await requireUser();
  const rawTicketId = String(formData.get("ticketId") ?? "");
  const parsed = commentSchema.safeParse({
    ticketId: rawTicketId,
    body: formData.get("body"),
  });

  if (!parsed.success) {
    const bodyIssue = parsed.error.issues.find((issue) => issue.path[0] === "body");

    if (bodyIssue?.code === "too_big") {
      redirect(`/tickets/${rawTicketId}?comment=too_long`);
    }

    redirect(`/tickets/${rawTicketId}?comment=invalid`);
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    include: {
      status: true,
      requester: true,
      assignee: true,
      assignees: {
        include: {
          user: true,
        },
      },
      workspace: {
        include: {
          memberships: {
            where: {
              user: {
                isActive: true,
              },
            },
            include: {
              user: true,
            },
          },
        },
      },
    },
  });

  if (!ticket) {
    redirect("/tickets");
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id, workspaceId: ticket.workspaceId },
  });

  if (!membership && user.role !== UserRole.ADMIN) {
    redirect("/tickets");
  }

  if (ticket.status.key === "CLOSED") {
    redirect(`/tickets/${ticket.id}?closed=1`);
  }

  await prisma.$transaction([
    prisma.ticketComment.create({
      data: {
        ticketId: ticket.id,
        authorId: user.id,
        body: parsed.data.body,
      },
    }),
    prisma.ticketActivity.create({
      data: {
        ticketId: ticket.id,
        actorUserId: user.id,
        eventType: "ticket.comment_added",
        messageZh: "添加了评论。",
        messageEn: "Added a comment.",
      },
    }),
    prisma.ticket.update({
      where: { id: ticket.id },
      data: {},
    }),
  ]);

  const mentionedUsers = getMentionedUsersFromComment(
    parsed.data.body,
    ticket.workspace.memberships.map((membership) => membership.user),
    user.id,
  );
  const mentionedUserIds = new Set(mentionedUsers.map((recipient) => recipient.id));
  const recipients = getTicketRecipientUsers(ticket)
    .map((recipient) => recipient.id)
    .filter((recipientId) => recipientId !== user.id && !mentionedUserIds.has(recipientId));

  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((recipientId) => ({
        userId: recipientId,
        ticketId: ticket.id,
        eventType: "ticket.comment_added",
        titleZh: `工单 ${ticket.ticketNumber} 有新评论`,
        titleEn: `New comment on ${ticket.ticketNumber}`,
        bodyZh: parsed.data.body.slice(0, 140),
        bodyEn: parsed.data.body.slice(0, 140),
      })),
    });
  }

  if (mentionedUsers.length) {
    await prisma.notification.createMany({
      data: mentionedUsers.map((recipient) => ({
        userId: recipient.id,
        ticketId: ticket.id,
        eventType: "ticket.mentioned",
        titleZh: `你在工单 ${ticket.ticketNumber} 中被提到`,
        titleEn: `You were mentioned on ${ticket.ticketNumber}`,
        bodyZh: parsed.data.body.slice(0, 140),
        bodyEn: parsed.data.body.slice(0, 140),
      })),
    });
  }

  const emailRecipients = uniqueRecipients(
    getTicketRecipientUsers(ticket).filter(
      (recipient) => recipient.commentEmailsEnabled && !mentionedUserIds.has(recipient.id),
    ),
  );

  for (const recipient of emailRecipients) {
    try {
      await sendTicketEmail({
        kind: "comment_added",
        recipient: {
          email: recipient.email,
          displayName: recipient.displayName,
          locale: recipient.locale,
        },
        actorName: user.displayName,
        commentBody: parsed.data.body,
        ticket: {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          workspaceName: ticket.workspace.name,
        },
      });
    } catch (error) {
      console.error("Failed to send comment email", error);
    }
  }

  for (const recipient of mentionedUsers) {
    try {
      await sendTicketEmail({
        kind: "mentioned",
        recipient: {
          email: recipient.email,
          displayName: recipient.displayName,
          locale: recipient.locale,
        },
        actorName: user.displayName,
        commentBody: parsed.data.body,
        ticket: {
          id: ticket.id,
          ticketNumber: ticket.ticketNumber,
          title: ticket.title,
          workspaceName: ticket.workspace.name,
        },
      });
    } catch (error) {
      console.error("Failed to send mention email", error);
    }
  }

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  redirect(`/tickets/${ticket.id}?saved=1`);
}

export async function addAttachmentAction(formData: FormData) {
  const user = await requireUser();
  const parsed = attachmentSchema.safeParse({
    ticketId: formData.get("ticketId"),
  });

  if (!parsed.success) {
    redirect("/tickets");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/tickets/${parsed.data.ticketId}`);
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    redirect(`/tickets/${parsed.data.ticketId}?upload=size`);
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    include: {
      status: true,
    },
  });

  if (!ticket) {
    redirect("/tickets");
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id, workspaceId: ticket.workspaceId },
  });

  if (!membership && user.role !== UserRole.ADMIN) {
    redirect("/tickets");
  }

  if (ticket.status.key === "CLOSED") {
    redirect(`/tickets/${ticket.id}?closed=1`);
  }

  const extension = path.extname(file.name).slice(0, 16);
  const storedName = `${crypto.randomUUID()}${extension}`;
  const directory = path.join(getUploadsRoot(), "tickets", ticket.id);
  await mkdir(directory, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(getTicketAttachmentDiskPath(ticket.id, storedName), buffer);

  await prisma.ticketAttachment.create({
    data: {
      ticketId: ticket.id,
      uploadedByUserId: user.id,
      originalName: file.name,
      storedName,
      mimeType: file.type || null,
      fileSizeBytes: file.size,
      filePath: getTicketAttachmentUrl(ticket.id, storedName),
    },
  });

  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket.id,
      actorUserId: user.id,
      eventType: "ticket.attachment_added",
      messageZh: "上传了附件。",
      messageEn: "Uploaded an attachment.",
    },
  });

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath("/dashboard");
  redirect(`/tickets/${ticket.id}?upload=success&saved=1`);
}

export async function sendDueDateInviteAction(formData: FormData) {
  const user = await requireUser();
  const parsed = sendDueDateInviteSchema.safeParse({
    ticketId: formData.get("ticketId"),
    recipientIds: formData.getAll("recipientIds").map((value) => String(value)),
  });

  if (!parsed.success) {
    redirect(`/tickets/${String(formData.get("ticketId") ?? "")}`);
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    include: {
      workspace: true,
      status: true,
    },
  });

  if (!ticket) {
    redirect("/tickets");
  }

  const membership = await prisma.workspaceMembership.findFirst({
    where: { userId: user.id, workspaceId: ticket.workspaceId },
  });

  if (!membership && user.role !== UserRole.ADMIN) {
    redirect("/tickets");
  }

  if (!ticket.dueDate) {
    redirect(`/tickets/${ticket.id}`);
  }

  const recipients = await prisma.user.findMany({
    where: {
      id: { in: parsed.data.recipientIds },
      isActive: true,
      OR: [
        {
          memberships: {
            some: {
              workspaceId: ticket.workspaceId,
            },
          },
        },
        {
          role: UserRole.ADMIN,
        },
      ],
    },
    orderBy: { displayName: "asc" },
  });

  for (const recipient of recipients) {
    try {
      await sendTicketDueDateInviteEmail({
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
      });
    } catch (error) {
      console.error("Failed to send due-date invite email", error);
    }
  }

  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket.id,
      actorUserId: user.id,
      eventType: "ticket.due_date_invite_sent",
      messageZh: "已发送截止日期日历邀请。",
      messageEn: "Sent due-date calendar invite.",
      metadata: {
        recipientIds: recipients.map((recipient) => recipient.id),
      },
    },
  });

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
  redirect(`/tickets/${ticket.id}?saved=1`);
}

export async function updateSettingsAction(formData: FormData) {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse({
    displayName: formData.get("displayName"),
    locale: formData.get("locale"),
    timeZone: formData.get("timeZone"),
    themePreference: formData.get("themePreference"),
    accentColor: formData.get("accentColor"),
    emailMfaEnabled: formData.get("emailMfaEnabled") === "on",
    commentEmailsEnabled: formData.get("commentEmailsEnabled") === "on",
    eventCalendarInvitesEnabled: formData.get("eventCalendarInvitesEnabled") === "on",
    dueDateCalendarInvitesEnabled: formData.get("dueDateCalendarInvitesEnabled") === "on",
    password: formData.get("password") || undefined,
    passwordConfirm: formData.get("passwordConfirm") || undefined,
  });

  if (!parsed.success) {
    redirect("/settings?error=invalid");
  }

  if ((parsed.data.password || parsed.data.passwordConfirm) && parsed.data.password !== parsed.data.passwordConfirm) {
    redirect("/settings?error=password_mismatch");
  }

  const updateData: {
    displayName: string;
    locale: Locale;
    timeZone: string;
    themePreference: ThemePreference;
    accentColor: AccentColor;
    emailMfaEnabled: boolean;
    commentEmailsEnabled: boolean;
    eventCalendarInvitesEnabled: boolean;
    dueDateCalendarInvitesEnabled: boolean;
    passwordHash?: string;
  } = {
    displayName: parsed.data.displayName,
    locale: MINI_AUTH_LOGIN_REDIRECT_ENABLED ? user.locale : parsed.data.locale,
    timeZone: parsed.data.timeZone,
    themePreference: MINI_AUTH_LOGIN_REDIRECT_ENABLED ? user.themePreference : parsed.data.themePreference,
    accentColor: MINI_AUTH_LOGIN_REDIRECT_ENABLED ? user.accentColor : parsed.data.accentColor,
    emailMfaEnabled: parsed.data.emailMfaEnabled,
    commentEmailsEnabled: parsed.data.commentEmailsEnabled,
    eventCalendarInvitesEnabled: parsed.data.eventCalendarInvitesEnabled,
    dueDateCalendarInvitesEnabled: parsed.data.dueDateCalendarInvitesEnabled,
  };

  if (parsed.data.password) {
    updateData.passwordHash = await hashPassword(parsed.data.password);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });

  const cookieStore = await cookies();
  if (!MINI_AUTH_LOGIN_REDIRECT_ENABLED) {
    cookieStore.set(LOCALE_COOKIE, parsed.data.locale, { path: "/" });
    cookieStore.set(THEME_COOKIE, parsed.data.themePreference, { path: "/" });
    cookieStore.set(ACCENT_COOKIE, parsed.data.accentColor, { path: "/" });
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?saved=1");
}

export async function createUserAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  if (MINI_AUTH_WORKSPACE_SYNC_ENABLED) {
    redirect("/admin/users?shared=1");
  }

  if (MINI_AUTH_LOGIN_REDIRECT_ENABLED) {
    redirect("/admin/users?shared=1");
  }

  const workspaceId = String(formData.get("workspaceId") ?? "");
  const workspaceRole =
    String(formData.get("workspaceRole") ?? "MEMBER") === "ADMIN" ? WorkspaceRole.ADMIN : WorkspaceRole.MEMBER;

  if (!workspaceId) {
    redirect("/admin/users");
  }

  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: workspaceId },
    select: { id: true, name: true },
  });

  const createdUser = await prisma.user.create({
    data: {
      email: String(formData.get("email") ?? "").toLowerCase(),
      displayName: String(formData.get("displayName") ?? ""),
      passwordHash: await hashPassword(crypto.randomUUID()),
      locale: (String(formData.get("locale") ?? "ZH_CN") as Locale) ?? "ZH_CN",
      accentColor: (String(formData.get("accentColor") ?? "BLUE") as AccentColor) ?? "BLUE",
      role: String(formData.get("role") ?? "USER") === "ADMIN" ? UserRole.ADMIN : UserRole.USER,
      themePreference: ThemePreference.SYSTEM,
      memberships: {
        create: {
          workspaceId: workspace.id,
          role: workspaceRole,
        },
      },
    },
  });

  try {
    const setupToken = await createPasswordSetupToken(createdUser.id);
    await sendPasswordSetupEmail({
      recipient: {
        email: createdUser.email,
        displayName: createdUser.displayName,
        locale: createdUser.locale,
      },
      setupToken,
      workspaceName: workspace.name,
    });
  } catch (error) {
    console.error("Failed to send password setup email", error);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
}

export async function resendUserInviteAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  if (MINI_AUTH_LOGIN_REDIRECT_ENABLED) {
    redirect("/admin/users?shared=1");
  }

  const userId = String(formData.get("userId") ?? "");
  const targetUser = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      memberships: {
        include: {
          workspace: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      },
    },
  });

  try {
    const setupToken = await createPasswordSetupToken(targetUser.id);
    await sendPasswordSetupEmail({
      recipient: {
        email: targetUser.email,
        displayName: targetUser.displayName,
        locale: targetUser.locale,
      },
      setupToken,
      workspaceName: targetUser.memberships[0]?.workspace.name,
    });
  } catch (error) {
    console.error("Failed to resend invite email", error);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
}

export async function completePasswordSetupAction(formData: FormData) {
  const currentUser = await getCurrentUser();
  const parsed = setupPasswordSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    passwordConfirm: formData.get("passwordConfirm"),
  });

  if (!parsed.success || parsed.data.password !== parsed.data.passwordConfirm) {
    redirect(`${AUTH_ROUTES.setupPassword}?token=${encodeURIComponent(String(formData.get("token") ?? ""))}&error=invalid`);
  }

  try {
    await assertRateLimit("password_setup", `${hashPasswordSetupToken(parsed.data.token)}|${await getClientIp()}`, 5);
  } catch {
    redirect(`${AUTH_ROUTES.setupPassword}?error=expired`);
  }

  const tokenHash = hashPasswordSetupToken(parsed.data.token);
  const setupToken = await prisma.passwordSetupToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!setupToken || setupToken.usedAt || setupToken.expiresAt < new Date() || !setupToken.user.isActive) {
    redirect(`${AUTH_ROUTES.setupPassword}?error=expired`);
  }

  const passwordHash = await hashPassword(parsed.data.password);

  await prisma.$transaction([
    prisma.user.update({
      where: { id: setupToken.userId },
      data: { passwordHash },
    }),
    prisma.passwordSetupToken.update({
      where: { tokenHash },
      data: { usedAt: new Date() },
    }),
  ]);

  await clearRateLimit("password_setup", `${tokenHash}|${await getClientIp()}`);

  if (!currentUser) {
    await createSession(setupToken.user);
  }

  redirect(AUTH_ROUTES.postLogin);
}

export async function toggleUserActiveAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  if (MINI_AUTH_LOGIN_REDIRECT_ENABLED) {
    redirect("/admin/users?shared=1");
  }

  const targetId = String(formData.get("userId") ?? "");
  const target = await prisma.user.findUniqueOrThrow({ where: { id: targetId } });
  await prisma.user.update({
    where: { id: targetId },
    data: { isActive: !target.isActive },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/users");
}

export async function createWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  if (MINI_AUTH_WORKSPACE_SYNC_ENABLED) {
    redirect("/admin/workspaces?shared=1");
  }

  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const ticketPrefix = normalizeTicketPrefix(String(formData.get("ticketPrefix") ?? ""));

  await prisma.workspace.create({
    data: {
      name,
      slug,
      ticketPrefix,
      description: String(formData.get("description") ?? "").trim() || null,
      paymentInfoEnabled: formData.get("paymentInfoEnabled") === "yes",
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/workspaces");
  redirect("/admin/workspaces?saved=1");
}

export async function updateWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const workspaceId = String(formData.get("workspaceId") ?? "");
  const ticketPrefix = normalizeTicketPrefix(String(formData.get("ticketPrefix") ?? ""));
  const paymentInfoEnabled = formData.get("paymentInfoEnabled") === "yes";

  if (!workspaceId || !ticketPrefix) {
    redirect("/admin/workspaces");
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: MINI_AUTH_WORKSPACE_SYNC_ENABLED
      ? {
          ticketPrefix,
          paymentInfoEnabled,
        }
      : {
          name: String(formData.get("name") ?? "").trim(),
          slug: String(formData.get("slug") ?? "")
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9-]+/g, "-"),
          ticketPrefix,
          description: String(formData.get("description") ?? "").trim() || null,
          paymentInfoEnabled,
        },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/workspaces");
  redirect("/admin/workspaces?saved=1");
}

export async function toggleWorkspaceArchiveAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  if (MINI_AUTH_WORKSPACE_SYNC_ENABLED) {
    redirect("/admin/workspaces?shared=1");
  }

  const workspaceId = String(formData.get("workspaceId") ?? "");
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { isArchived: !workspace.isArchived },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/workspaces");
  redirect("/admin/workspaces?saved=1");
}

export async function deletePaymentMethodAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const parsed = deletePaymentMethodSchema.safeParse({
    paymentMethodId: formData.get("paymentMethodId"),
    workspaceId: formData.get("workspaceId"),
  });

  if (!parsed.success) {
    redirect("/admin/workspaces");
  }

  await prisma.paymentMethod.deleteMany({
    where: {
      id: parsed.data.paymentMethodId,
      workspaceId: parsed.data.workspaceId,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/workspaces");
  redirect("/admin/workspaces?saved=1");
}

export async function updatePaymentMethodAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const parsed = updatePaymentMethodSchema.safeParse({
    paymentMethodId: formData.get("paymentMethodId"),
    workspaceId: formData.get("workspaceId"),
    label: formData.get("label"),
    last4: formData.get("last4"),
  });

  if (!parsed.success) {
    redirect("/admin/workspaces?payment=invalid");
  }

  const existing = await prisma.paymentMethod.findFirst({
    where: {
      workspaceId: parsed.data.workspaceId,
      label: parsed.data.label,
      last4: parsed.data.last4,
      id: {
        not: parsed.data.paymentMethodId,
      },
    },
    select: { id: true },
  });

  if (existing) {
    redirect("/admin/workspaces?payment=duplicate");
  }

  await prisma.paymentMethod.updateMany({
    where: {
      id: parsed.data.paymentMethodId,
      workspaceId: parsed.data.workspaceId,
    },
    data: {
      label: parsed.data.label,
      last4: parsed.data.last4,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/workspaces");
  redirect("/admin/workspaces?saved=1");
}

export async function assignMembershipAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  if (MINI_AUTH_WORKSPACE_SYNC_ENABLED) {
    redirect("/admin/users?shared=1");
  }

  const targetUserId = String(formData.get("userId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const role = String(formData.get("role") ?? "MEMBER") === "ADMIN" ? WorkspaceRole.ADMIN : WorkspaceRole.MEMBER;

  await prisma.workspaceMembership.upsert({
    where: {
      userId_workspaceId: { userId: targetUserId, workspaceId },
    },
    update: { role },
    create: { userId: targetUserId, workspaceId, role },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/workspaces");
}

export async function removeMembershipAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  if (MINI_AUTH_WORKSPACE_SYNC_ENABLED) {
    redirect("/admin/users?shared=1");
  }

  const targetUserId = String(formData.get("userId") ?? "");
  const workspaceId = String(formData.get("workspaceId") ?? "");

  if (!targetUserId || !workspaceId) {
    redirect("/admin/users");
  }

  await prisma.workspaceMembership.deleteMany({
    where: {
      userId: targetUserId,
      workspaceId,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/workspaces");
}

export async function createDefinitionAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const kind = String(formData.get("kind") ?? "");
  const data = {
    key: String(formData.get("key") ?? "")
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_"),
    labelZh: String(formData.get("labelZh") ?? "").trim(),
    labelEn: String(formData.get("labelEn") ?? "").trim(),
    sortOrder: Number(formData.get("sortOrder") ?? 99),
    isActive: true,
  };

  if (kind === "status") {
    await prisma.statusDefinition.create({ data });
  } else if (kind === "priority") {
    await prisma.priorityDefinition.create({ data });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/catalog");
}

export async function toggleDefinitionActiveAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const kind = String(formData.get("kind") ?? "");
  const id = String(formData.get("id") ?? "");

  if (kind === "status") {
    const item = await prisma.statusDefinition.findUniqueOrThrow({ where: { id } });
    await prisma.statusDefinition.update({ where: { id }, data: { isActive: !item.isActive } });
  } else if (kind === "priority") {
    const item = await prisma.priorityDefinition.findUniqueOrThrow({ where: { id } });
    await prisma.priorityDefinition.update({ where: { id }, data: { isActive: !item.isActive } });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/catalog");
}
