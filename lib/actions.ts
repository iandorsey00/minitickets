"use server";

import crypto from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { AccentColor, Locale, ThemePreference, UserRole, WorkspaceRole } from "@prisma/client";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSession, destroySession, requireUser } from "@/lib/auth";
import {
  ACCENT_COOKIE,
  LOCALE_COOKIE,
  THEME_COOKIE,
  WORKSPACE_COOKIE,
} from "@/lib/constants";
import { getDefaultDefinitionIds } from "@/lib/data";
import { sendWelcomeEmail } from "@/lib/email";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { fallbackTicketPrefixFromSlug, formatTicketNumber, normalizeTicketPrefix } from "@/lib/tickets";

const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

const ticketSchema = z.object({
  workspaceId: z.string().min(1),
  title: z.string().min(3).max(120),
  description: z.string().min(10).max(5000),
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

const settingsSchema = z.object({
  displayName: z.string().min(2).max(60),
  locale: z.nativeEnum(Locale),
  themePreference: z.nativeEnum(ThemePreference),
  accentColor: z.nativeEnum(AccentColor),
  password: z.string().optional(),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
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

  await createSession(user.id);

  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, user.locale, { path: "/" });
  cookieStore.set(THEME_COOKIE, user.themePreference, { path: "/" });
  cookieStore.set(ACCENT_COOKIE, user.accentColor, { path: "/" });

  redirect("/tickets");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}

export async function switchWorkspaceAction(formData: FormData) {
  const user = await requireUser();
  const workspaceId = String(formData.get("workspaceId") ?? "");
  const nextPath = String(formData.get("nextPath") ?? "/tickets");

  const allowed = await prisma.workspaceMembership.findFirst({
    where: {
      userId: user.id,
      workspaceId,
    },
  });

  if (allowed) {
    const cookieStore = await cookies();
    cookieStore.set(WORKSPACE_COOKIE, workspaceId, { path: "/" });
  }

  redirect(nextPath);
}

export async function createTicketAction(formData: FormData) {
  const user = await requireUser();

  const parsed = ticketSchema.safeParse({
    workspaceId: formData.get("workspaceId"),
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

  const membership = await prisma.workspaceMembership.findFirst({
    where: {
      userId: user.id,
      workspaceId: parsed.data.workspaceId,
    },
  });

  if (!membership && user.role !== UserRole.ADMIN) {
    redirect("/tickets/new?error=forbidden");
  }

  const defaults = await getDefaultDefinitionIds();
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

  const ticket = await prisma.ticket.create({
    data: {
      serialNumber,
      ticketNumber,
      title: parsed.data.title,
      description: parsed.data.description,
      workspaceId: parsed.data.workspaceId,
      requesterId: user.id,
      assigneeId: parsed.data.assigneeId || null,
      statusId: parsed.data.statusId || defaults.statusId,
      priorityId: parsed.data.priorityId || defaults.priorityId,
      categoryId: parsed.data.categoryId || defaults.categoryId,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
      paymentLabel: parsed.data.paymentLabel || null,
      paymentLast4: parsed.data.paymentLast4 || null,
      activities: {
        create: {
          actorUserId: user.id,
          eventType: "ticket.created",
          messageZh: "已提交请求。",
          messageEn: "Request submitted.",
        },
      },
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
      },
    });
  }

  revalidatePath("/dashboard");
  revalidatePath("/tickets");
  revalidatePath(`/workspaces/${ticket.workspaceId}`);
  redirect(`/tickets/${ticket.id}`);
}

export async function updateTicketAction(formData: FormData) {
  const user = await requireUser();
  const ticketId = String(formData.get("ticketId") ?? "");
  const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });

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
    assigneeId: String(formData.get("assigneeId") ?? "") || null,
    dueDate: String(formData.get("dueDate") ?? "") || null,
    paymentLabel: String(formData.get("paymentLabel") ?? "") || null,
    paymentLast4: String(formData.get("paymentLast4") ?? "") || null,
    title: String(formData.get("title") ?? ticket.title),
    description: String(formData.get("description") ?? ticket.description),
  };

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
  if (nextValues.paymentLast4 !== ticket.paymentLast4 || nextValues.paymentLabel !== ticket.paymentLabel) {
    activities.push({
      actorUserId: user.id,
      eventType: "ticket.payment_updated",
      messageZh: "已更新支付信息。",
      messageEn: "Payment information updated.",
    });
  }

  await prisma.ticket.update({
    where: { id: ticketId },
    data: {
      ...nextValues,
      dueDate: nextValues.dueDate ? new Date(nextValues.dueDate) : null,
      activities: activities.length ? { create: activities } : undefined,
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
      },
    });
  }

  revalidatePath(`/tickets/${ticketId}`);
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

  const recipients = [ticket.requesterId, ticket.assigneeId].filter(
    (recipientId): recipientId is string => Boolean(recipientId && recipientId !== user.id),
  );

  if (recipients.length) {
    await prisma.notification.createMany({
      data: recipients.map((recipientId) => ({
        userId: recipientId,
        ticketId: ticket.id,
        eventType: "ticket.comment_added",
        titleZh: `工单 ${ticket.ticketNumber} 有新评论`,
        titleEn: `New comment on ${ticket.ticketNumber}`,
      })),
    });
  }

  revalidatePath(`/tickets/${ticket.id}`);
  revalidatePath("/dashboard");
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
  const directory = path.join(process.cwd(), "public", "uploads", "tickets", ticket.id);
  await mkdir(directory, { recursive: true });
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(directory, storedName), buffer);

  await prisma.ticketAttachment.create({
    data: {
      ticketId: ticket.id,
      uploadedByUserId: user.id,
      originalName: file.name,
      storedName,
      mimeType: file.type || null,
      fileSizeBytes: file.size,
      filePath: `/uploads/tickets/${ticket.id}/${storedName}`,
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
    themePreference: formData.get("themePreference"),
    accentColor: formData.get("accentColor"),
    password: formData.get("password") || undefined,
  });

  if (!parsed.success) {
    redirect("/settings?error=invalid");
  }

  const updateData: {
    displayName: string;
    locale: Locale;
    themePreference: ThemePreference;
    accentColor: AccentColor;
    passwordHash?: string;
  } = {
    displayName: parsed.data.displayName,
    locale: parsed.data.locale,
    themePreference: parsed.data.themePreference,
    accentColor: parsed.data.accentColor,
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
}

export async function createUserAction(formData: FormData) {
  const user = await requireUser();
  if (user.role !== UserRole.ADMIN) {
    redirect("/dashboard");
  }

  const password = String(formData.get("password") ?? "MiniTickets123!");
  const createdUser = await prisma.user.create({
    data: {
      email: String(formData.get("email") ?? "").toLowerCase(),
      displayName: String(formData.get("displayName") ?? ""),
      passwordHash: await hashPassword(password),
      locale: (String(formData.get("locale") ?? "ZH_CN") as Locale) ?? "ZH_CN",
      accentColor: (String(formData.get("accentColor") ?? "BLUE") as AccentColor) ?? "BLUE",
      role: String(formData.get("role") ?? "USER") === "ADMIN" ? UserRole.ADMIN : UserRole.USER,
      themePreference: ThemePreference.SYSTEM,
    },
  });

  try {
    await sendWelcomeEmail({
      userEmail: createdUser.email,
      displayName: createdUser.displayName,
      locale: createdUser.locale,
      password,
    });
  } catch (error) {
    console.error("Failed to send welcome email", error);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/users");
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
