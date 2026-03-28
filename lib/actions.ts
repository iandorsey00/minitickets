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
  getPendingLoginChallenge,
  requireUser,
} from "@/lib/auth";
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
  sendTicketEventEmail,
  sendWelcomeEmail,
} from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { createPasswordSetupToken, hashPasswordSetupToken } from "@/lib/password-setup";
import { prisma } from "@/lib/prisma";
import { assertRateLimit, clearRateLimit } from "@/lib/rate-limit";
import { sanitizeTicketEventReminderOffsets } from "@/lib/ticket-events";
import { fallbackTicketPrefixFromSlug, formatTicketNumber, normalizeTicketPrefix } from "@/lib/tickets";
import { autoCloseResolvedTickets } from "@/lib/ticket-status";
import { getTicketAttachmentDiskPath, getTicketAttachmentUrl, getUploadsRoot } from "@/lib/uploads";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const ticketSchema = z.object({
  workspaceId: z.string().min(1),
  parentTicketId: z.string().optional(),
  title: z.string().min(3).max(120),
  description: z.string().max(5000).optional(),
  assigneeId: z.string().optional(),
  statusId: z.string().optional(),
  priorityId: z.string().optional(),
  categoryId: z.string().optional(),
  dueDate: z.string().optional(),
  paymentLabel: z.string().max(60).optional(),
  paymentLast4: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

const commentSchema = z.object({
  ticketId: z.string().min(1),
  body: z.string().min(2).max(2000),
});

const attachmentSchema = z.object({
  ticketId: z.string().min(1),
});

const ticketEventSchema = z.object({
  ticketId: z.string().min(1),
  title: z.string().min(2).max(120),
  scheduledFor: z.string().datetime(),
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

function uniqueRecipients<T extends { id: string }>(items: T[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
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

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  try {
    await assertRateLimit("login", `${parsed.data.email.toLowerCase()}|${await getClientIp()}`, 5);
  } catch {
    redirect("/login?error=invalid");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    redirect("/login?error=invalid");
  }

  if (!user.isActive) {
    redirect("/login?error=inactive");
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
      redirect("/login?error=mfa_send");
    }

    await clearRateLimit("login", `${parsed.data.email.toLowerCase()}|${await getClientIp()}`);
    redirect("/verify-login");
  }

  await createSession(user.id);
  await clearRateLimit("login", `${parsed.data.email.toLowerCase()}|${await getClientIp()}`);

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, user.locale, { path: "/" });
  cookieStore.set(THEME_COOKIE, user.themePreference, { path: "/" });
  cookieStore.set(ACCENT_COOKIE, user.accentColor, { path: "/" });

  redirect("/tickets");
}

export async function verifyLoginCodeAction(formData: FormData) {
  const parsed = verifyLoginCodeSchema.safeParse({
    code: formData.get("code"),
  });

  const pendingChallenge = await getPendingLoginChallenge();
  if (!pendingChallenge) {
    redirect("/login");
  }

  if (!parsed.success) {
    redirect("/verify-login?error=invalid");
  }

  try {
    await assertRateLimit("login_mfa_verify", `${pendingChallenge.tokenHash}|${await getClientIp()}`, 5);
  } catch {
    redirect("/verify-login?error=expired");
  }

  const codeHash = crypto.createHash("sha256").update(parsed.data.code).digest("hex");
  if (codeHash !== pendingChallenge.codeHash) {
    redirect("/verify-login?error=invalid");
  }

  await prisma.loginEmailChallenge.update({
    where: { tokenHash: pendingChallenge.tokenHash },
    data: { usedAt: new Date() },
  });

  await clearRateLimit("login_mfa_verify", `${pendingChallenge.tokenHash}|${await getClientIp()}`);
  await clearLoginEmailChallenge();
  await createSession(pendingChallenge.userId);

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, pendingChallenge.user.locale, { path: "/" });
  cookieStore.set(THEME_COOKIE, pendingChallenge.user.themePreference, { path: "/" });
  cookieStore.set(ACCENT_COOKIE, pendingChallenge.user.accentColor, { path: "/" });

  redirect("/tickets");
}

export async function resendLoginCodeAction() {
  const pendingChallenge = await getPendingLoginChallenge();
  if (!pendingChallenge) {
    redirect("/login");
  }

  try {
    await assertRateLimit("login_mfa_send", `${pendingChallenge.userId}|${await getClientIp()}`, 3);
  } catch {
    redirect("/verify-login?error=expired");
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
    redirect("/verify-login?error=invalid");
  }

  redirect("/verify-login?sent=1");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
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

  redirect("/tickets");
}

export async function createTicketAction(formData: FormData) {
  const user = await requireUser();

  const parsed = ticketSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
    parentTicketId: formData.get("parentTicketId") || undefined,
    title: formData.get("title"),
    description: formData.get("description"),
    assigneeId: formData.get("assigneeId") || undefined,
    statusId: formData.get("statusId") || undefined,
    priorityId: formData.get("priorityId") || undefined,
    categoryId: formData.get("categoryId") || undefined,
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

  if (parsed.data.assigneeId) {
    const assigneeMembership = await prisma.workspaceMembership.findFirst({
      where: {
        userId: parsed.data.assigneeId,
        workspaceId: parsed.data.workspaceId,
      },
      select: { id: true },
    });

    const assignee = assigneeMembership
      ? null
      : await prisma.user.findUnique({
          where: { id: parsed.data.assigneeId },
          select: { role: true },
        });

    if (!assigneeMembership && assignee?.role !== UserRole.ADMIN) {
      redirect("/tickets/new?error=invalid");
    }
  }

  const parentTicket = await validateParentTicketSelection(parsed.data.parentTicketId, parsed.data.workspaceId);
  if (parsed.data.parentTicketId && !parentTicket) {
    redirect("/tickets/new?error=invalid");
  }

  const defaults = await getDefaultDefinitionIds();
  await ensureCoreDefinitions();
  if (
    (!parsed.data.statusId && !defaults.statusId) ||
    (!parsed.data.priorityId && !defaults.priorityId) ||
    (!parsed.data.categoryId && !defaults.categoryId)
  ) {
    redirect("/tickets/new?error=definitions");
  }
  const workspace = await prisma.workspace.findUniqueOrThrow({
    where: { id: parsed.data.workspaceId },
    select: { id: true, slug: true, ticketPrefix: true },
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
    parsed.data.assigneeId && inProgressStatus && (!parsed.data.statusId || parsed.data.statusId === defaults.statusId)
      ? inProgressStatus.id
      : parsed.data.statusId || defaults.statusId!;

  const ticket = await prisma.ticket.create({
    data: {
      serialNumber,
      ticketNumber,
      title: parsed.data.title,
      description: parsed.data.description?.trim() || "",
      workspaceId: parsed.data.workspaceId,
      parentTicketId: parentTicket?.id ?? null,
      requesterId: user.id,
      assigneeId: parsed.data.assigneeId || null,
      statusId: finalStatusId,
      priorityId: parsed.data.priorityId || defaults.priorityId!,
      categoryId: parsed.data.categoryId || defaults.categoryId!,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      paymentLabel: parsed.data.paymentLabel || null,
      paymentLast4: parsed.data.paymentLast4 || null,
      paymentMethods: {
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
      },
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
      status: true,
    },
  });

  if (ticket.assigneeId && ticket.assigneeId !== user.id) {
    await prisma.notification.create({
      data: {
        userId: ticket.assigneeId,
        ticketId: ticket.id,
        eventType: "ticket.assigned",
        titleZh: `你被分配到工单 ${ticket.ticketNumber}`,
        titleEn: `You were assigned ${ticket.ticketNumber}`,
        bodyZh: ticket.title,
        bodyEn: ticket.title,
      },
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
      },
    });
  } catch (error) {
    console.error("Failed to send created-ticket email", error);
  }

  if (ticket.assignee) {
    try {
      await sendTicketEmail({
        kind: "assigned",
        recipient: {
          email: ticket.assignee.email,
          displayName: ticket.assignee.displayName,
          locale: ticket.assignee.locale,
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

  const nextValues = {
    statusId: String(formData.get("statusId") ?? ticket.statusId),
    priorityId: String(formData.get("priorityId") ?? ticket.priorityId),
    categoryId: String(formData.get("categoryId") ?? ticket.categoryId),
    parentTicketId: String(formData.get("parentTicketId") ?? "") || null,
    assigneeId: String(formData.get("assigneeId") ?? "") || null,
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
    select: { key: true },
  });

  if (!nextStatus) {
    redirect(`/tickets/${ticketId}`);
  }

  if (nextValues.assigneeId) {
    const assigneeMembership = await prisma.workspaceMembership.findFirst({
      where: {
        userId: nextValues.assigneeId,
        workspaceId: ticket.workspaceId,
      },
      select: { id: true },
    });

    const assignee = assigneeMembership
      ? null
      : await prisma.user.findUnique({
          where: { id: nextValues.assigneeId },
          select: { role: true },
        });

    if (!assigneeMembership && assignee?.role !== UserRole.ADMIN) {
      redirect(`/tickets/${ticketId}`);
    }
  }

  if (ticket.childTickets.length && nextValues.parentTicketId && nextValues.parentTicketId !== ticket.parentTicketId) {
    redirect(`/tickets/${ticketId}`);
  }

  const parentTicket = await validateParentTicketSelection(nextValues.parentTicketId, ticket.workspaceId, ticket.id);
  if (nextValues.parentTicketId && !parentTicket) {
    redirect(`/tickets/${ticketId}`);
  }

  const activities = [];
  if (nextValues.statusId !== ticket.statusId) {
    activities.push({
      actorUserId: user.id,
      eventType: "ticket.status_changed",
      messageZh: "已更新状态。",
      messageEn: "Status updated.",
    });
  }
  if (nextValues.priorityId !== ticket.priorityId) {
    activities.push({
      actorUserId: user.id,
      eventType: "ticket.priority_changed",
      messageZh: "已更新优先级。",
      messageEn: "Priority updated.",
    });
  }
  if (nextValues.assigneeId !== ticket.assigneeId) {
    activities.push({
      actorUserId: user.id,
      eventType: "ticket.assigned",
      messageZh: "已更新处理人。",
      messageEn: "Assignee updated.",
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
  if (nextValues.paymentLast4 !== ticket.paymentLast4 || nextValues.paymentLabel !== ticket.paymentLabel) {
    activities.push({
      actorUserId: user.id,
      eventType: "ticket.payment_updated",
      messageZh: "已更新支付信息。",
      messageEn: "Payment information updated.",
    });
  }

  const updatedTicket = await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      ...nextValues,
      parentTicketId: parentTicket?.id ?? null,
      dueDate: nextValues.dueDate ? new Date(nextValues.dueDate) : null,
      resolvedAt:
        nextStatus.key === "RESOLVED"
          ? ticket.status.key === "RESOLVED" && ticket.resolvedAt
            ? ticket.resolvedAt
            : new Date()
          : nextStatus.key === "CLOSED"
            ? ticket.resolvedAt ?? new Date()
            : null,
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
      activities: activities.length ? { create: activities } : undefined,
    },
    include: {
      workspace: true,
      requester: true,
      assignee: true,
      status: true,
    },
  });

  if (nextValues.assigneeId && nextValues.assigneeId !== user.id) {
    await prisma.notification.create({
      data: {
        userId: nextValues.assigneeId,
        ticketId,
        eventType: "ticket.assigned",
        titleZh: `工单 ${ticket.ticketNumber} 已分配给你`,
        titleEn: `${ticket.ticketNumber} was assigned to you`,
        bodyZh: updatedTicket.title,
        bodyEn: updatedTicket.title,
      },
    });
  }

  if (updatedTicket.assignee && nextValues.assigneeId !== ticket.assigneeId) {
    try {
      await sendTicketEmail({
        kind: "assigned",
        recipient: {
          email: updatedTicket.assignee.email,
          displayName: updatedTicket.assignee.displayName,
          locale: updatedTicket.assignee.locale,
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

  if (nextValues.statusId !== ticket.statusId && ["RESOLVED", "CLOSED"].includes(updatedTicket.status.key)) {
    const recipients = uniqueRecipients(
      [updatedTicket.requester, updatedTicket.assignee].filter(
        (recipient): recipient is typeof updatedTicket.requester => Boolean(recipient),
      ),
    );

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
}

export async function createTicketEventAction(formData: FormData) {
  const user = await requireUser();
  const parsed = ticketEventSchema.safeParse({
    ticketId: formData.get("ticketId"),
    title: formData.get("title"),
    scheduledFor: formData.get("scheduledFor"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) {
    redirect(`/tickets/${String(formData.get("ticketId") ?? "")}`);
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    include: {
      workspace: true,
      requester: true,
      assignee: true,
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

  const reminderOffsets = sanitizeTicketEventReminderOffsets(
    formData.getAll("reminderOffsets").map((value) => String(value)),
  );
  const scheduledFor = new Date(parsed.data.scheduledFor);

  if (Number.isNaN(scheduledFor.getTime()) || scheduledFor.getTime() < Date.now() - 60_000) {
    redirect(`/tickets/${ticket.id}`);
  }

  const event = await prisma.ticketEvent.create({
    data: {
      ticketId: ticket.id,
      createdByUserId: user.id,
      title: parsed.data.title,
      notes: parsed.data.notes?.trim() || null,
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
  });

  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket.id,
      actorUserId: user.id,
      eventType: "ticket.event_created",
      messageZh: `已安排事件：${parsed.data.title}`,
      messageEn: `Scheduled event: ${parsed.data.title}`,
    },
  });

  const recipients = uniqueRecipients(
    [ticket.requester, ticket.assignee].filter((recipient): recipient is typeof ticket.requester => Boolean(recipient)),
  );

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
        event: {
          title: event.title,
          notes: event.notes ?? undefined,
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

  await prisma.ticketEvent.delete({
    where: {
      id: event.id,
    },
  });

  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket.id,
      actorUserId: user.id,
      eventType: "ticket.event_deleted",
      messageZh: `已删除事件：${event.title}`,
      messageEn: `Deleted event: ${event.title}`,
    },
  });

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath("/tickets");
  revalidatePath("/dashboard");
}

export async function addCommentAction(formData: FormData) {
  const user = await requireUser();
  const parsed = commentSchema.safeParse({
    ticketId: formData.get("ticketId"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    redirect(`/tickets/${formData.get("ticketId")}`);
  }

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
    include: {
      requester: true,
      assignee: true,
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

  await prisma.ticketComment.create({
    data: {
      ticketId: ticket.id,
      authorId: user.id,
      body: parsed.data.body,
    },
  });

  await prisma.ticketActivity.create({
    data: {
      ticketId: ticket.id,
      actorUserId: user.id,
      eventType: "ticket.comment_added",
      messageZh: "添加了评论。",
      messageEn: "Added a comment.",
    },
  });

  const mentionedUsers = getMentionedUsersFromComment(
    parsed.data.body,
    ticket.workspace.memberships.map((membership) => membership.user),
    user.id,
  );
  const mentionedUserIds = new Set(mentionedUsers.map((recipient) => recipient.id));
  const recipients = [ticket.requesterId, ticket.assigneeId].filter(
    (recipientId): recipientId is string => Boolean(recipientId && recipientId !== user.id && !mentionedUserIds.has(recipientId)),
  );

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
    [ticket.requester, ticket.assignee].filter(
      (recipient): recipient is typeof ticket.requester =>
        Boolean(
          recipient &&
            recipient.commentEmailsEnabled &&
            !mentionedUserIds.has(recipient.id),
        ),
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
  redirect(`/tickets/${ticket.id}`);
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

  const ticket = await prisma.ticket.findUnique({
    where: { id: parsed.data.ticketId },
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
    passwordHash?: string;
  } = {
    displayName: parsed.data.displayName,
    locale: parsed.data.locale,
    timeZone: parsed.data.timeZone,
    themePreference: parsed.data.themePreference,
    accentColor: parsed.data.accentColor,
    emailMfaEnabled: parsed.data.emailMfaEnabled,
    commentEmailsEnabled: parsed.data.commentEmailsEnabled,
  };

  if (parsed.data.password) {
    updateData.passwordHash = await hashPassword(parsed.data.password);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: updateData,
  });

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, parsed.data.locale, { path: "/" });
  cookieStore.set(THEME_COOKIE, parsed.data.themePreference, { path: "/" });
  cookieStore.set(ACCENT_COOKIE, parsed.data.accentColor, { path: "/" });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  redirect("/settings?saved=1");
}

export async function createUserAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
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
    redirect(`/setup-password?token=${encodeURIComponent(String(formData.get("token") ?? ""))}&error=invalid`);
  }

  try {
    await assertRateLimit("password_setup", `${hashPasswordSetupToken(parsed.data.token)}|${await getClientIp()}`, 5);
  } catch {
    redirect("/setup-password?error=expired");
  }

  const tokenHash = hashPasswordSetupToken(parsed.data.token);
  const setupToken = await prisma.passwordSetupToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!setupToken || setupToken.usedAt || setupToken.expiresAt < new Date() || !setupToken.user.isActive) {
    redirect("/setup-password?error=expired");
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
    await createSession(setupToken.userId);

    const cookieStore = await cookies();
    cookieStore.set(LOCALE_COOKIE, setupToken.user.locale, { path: "/" });
    cookieStore.set(THEME_COOKIE, setupToken.user.themePreference, { path: "/" });
    cookieStore.set(ACCENT_COOKIE, setupToken.user.accentColor, { path: "/" });
  }

  redirect("/tickets");
}

export async function toggleUserActiveAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
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
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/workspaces");
}

export async function updateWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const workspaceId = String(formData.get("workspaceId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const slug = String(formData.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  const ticketPrefix = normalizeTicketPrefix(String(formData.get("ticketPrefix") ?? ""));
  const description = String(formData.get("description") ?? "").trim() || null;

  if (!workspaceId || !name || !slug || !ticketPrefix) {
    redirect("/admin/workspaces");
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: {
      name,
      slug,
      ticketPrefix,
      description,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/workspaces");
}

export async function toggleWorkspaceArchiveAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const workspaceId = String(formData.get("workspaceId") ?? "");
  const workspace = await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } });
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { isArchived: !workspace.isArchived },
  });
  revalidatePath("/admin");
  revalidatePath("/admin/workspaces");
}

export async function assignMembershipAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
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
  } else if (kind === "category") {
    await prisma.categoryDefinition.create({ data });
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
  } else if (kind === "category") {
    const item = await prisma.categoryDefinition.findUniqueOrThrow({ where: { id } });
    await prisma.categoryDefinition.update({ where: { id }, data: { isActive: !item.isActive } });
  }

  revalidatePath("/admin");
  revalidatePath("/admin/catalog");
}
