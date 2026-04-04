import { Prisma } from "@prisma/client";
import { cookies } from "next/headers";

import {
  ACCENT_COOKIE,
  LOCALE_COOKIE,
  THEME_COOKIE,
  WORKSPACE_COOKIE,
  defaultPriorityKey,
  defaultStatusKey,
  localeTokenMap,
} from "@/lib/constants";
import { getCurrentUser, requireUser } from "@/lib/auth";
import { ensureCoreDefinitions } from "@/lib/catalog";
import { getDictionary } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";
import { autoCloseResolvedTickets } from "@/lib/ticket-status";

export async function getPreferencesForLayout() {
  const user = await getCurrentUser();
  const cookieStore = await cookies();
  return {
    locale: user?.locale ?? (cookieStore.get(LOCALE_COOKIE)?.value as "ZH_CN" | "EN" | undefined) ?? "ZH_CN",
    themePreference:
      user?.themePreference ??
      (cookieStore.get(THEME_COOKIE)?.value as "SYSTEM" | "LIGHT" | "DARK" | undefined) ??
      "SYSTEM",
    accentColor:
      user?.accentColor ??
      (cookieStore.get(ACCENT_COOKIE)?.value as
        | "BLUE"
        | "CYAN"
        | "TEAL"
        | "GREEN"
        | "LIME"
        | "YELLOW"
        | "ORANGE"
        | "RED"
        | "PINK"
        | "PURPLE"
        | undefined) ??
      "BLUE",
  };
}

export async function getViewerContext(requestedWorkspaceId?: string) {
  await autoCloseResolvedTickets();
  const user = await requireUser();
  const cookieStore = await cookies();

  const memberships =
    user.role === "ADMIN"
      ? (await prisma.workspace.findMany({
          where: { isArchived: false },
          orderBy: { name: "asc" },
        })).map((workspace) => ({
          id: `admin-${workspace.id}`,
          userId: user.id,
          workspaceId: workspace.id,
          role: "ADMIN" as const,
          createdAt: new Date(),
          workspace,
        }))
      : user.memberships.filter((membership) => !membership.workspace.isArchived);
  const preferredWorkspaceId = requestedWorkspaceId ?? cookieStore.get(WORKSPACE_COOKIE)?.value;
  const currentWorkspace =
    memberships.find((membership) => membership.workspaceId === preferredWorkspaceId)?.workspace ??
    memberships[0]?.workspace ??
    null;

  return {
    user,
    memberships,
    currentWorkspace,
    dictionary: getDictionary(user.locale),
    locale: user.locale,
    localeCode: localeTokenMap[user.locale],
    timeZone: user.timeZone,
    accessibleWorkspaceIds: memberships.map((membership) => membership.workspaceId),
  };
}

export async function getDefinitions() {
  await ensureCoreDefinitions();
  const [statuses, priorities] = await Promise.all([
    prisma.statusDefinition.findMany({ orderBy: [{ sortOrder: "asc" }, { labelZh: "asc" }] }),
    prisma.priorityDefinition.findMany({ orderBy: [{ sortOrder: "asc" }, { labelZh: "asc" }] }),
  ]);

  return { statuses, priorities };
}

export async function getDefaultDefinitionIds() {
  await ensureCoreDefinitions();
  const [statuses, priorities] = await Promise.all([
    prisma.statusDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { labelZh: "asc" }],
    }),
    prisma.priorityDefinition.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { labelZh: "asc" }],
    }),
  ]);

  const status = statuses.find((item) => item.key === defaultStatusKey) ?? statuses[0] ?? null;
  const priority = priorities.find((item) => item.key === defaultPriorityKey) ?? priorities[0] ?? null;

  return {
    statusId: status?.id,
    priorityId: priority?.id,
  };
}

export async function getDashboardData(workspaceId?: string) {
  const context = await getViewerContext(workspaceId);
  const selectedWorkspaceIds = context.currentWorkspace
    ? [context.currentWorkspace.id]
    : context.accessibleWorkspaceIds;

  const baseWhere: Prisma.TicketWhereInput = {
    workspaceId: { in: selectedWorkspaceIds },
  };

  const [assignedToMe, createdByMe, recentUpdates, statusCounts] = await Promise.all([
    prisma.ticket.findMany({
      where: { ...baseWhere, assigneeId: context.user.id },
      include: ticketIncludes,
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.ticket.findMany({
      where: { ...baseWhere, requesterId: context.user.id },
      include: ticketIncludes,
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.ticketActivity.findMany({
      where: { ticket: { is: baseWhere } },
      include: {
        ticket: true,
        actor: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
    prisma.ticket.groupBy({
      by: ["statusId"],
      where: baseWhere,
      _count: { _all: true },
    }),
  ]);

  const statuses = await prisma.statusDefinition.findMany();
  const statusMap = new Map(statuses.map((status) => [status.id, status]));

  return {
    ...context,
    assignedToMe,
    createdByMe,
    recentUpdates,
    statusCounts: statusCounts.map((item) => ({
      definition: statusMap.get(item.statusId),
      count: item._count._all,
    })),
  };
}

export type TicketFilters = {
  workspaceId?: string;
  statusId?: string;
  priorityId?: string;
  assigneeId?: string;
  requesterId?: string;
  q?: string;
  openOnly?: string;
};

export async function getTicketsData(filters: TicketFilters) {
  const context = await getViewerContext(filters.workspaceId);
  const workspaceIds = context.user.role === "ADMIN" && !context.currentWorkspace
    ? context.accessibleWorkspaceIds
    : context.currentWorkspace
      ? [context.currentWorkspace.id]
      : context.accessibleWorkspaceIds;

  const where: Prisma.TicketWhereInput = {
    workspaceId: { in: workspaceIds },
    statusId: filters.statusId || undefined,
    status:
      filters.statusId || filters.openOnly === "0"
        ? undefined
        : {
            key: {
              notIn: ["CLOSED", "CANCELLED"],
            },
          },
    priorityId: filters.priorityId || undefined,
    assigneeId: filters.assigneeId || undefined,
    requesterId: filters.requesterId || undefined,
    OR: filters.q
      ? [
          { title: { contains: filters.q } },
          { description: { contains: filters.q } },
          { ticketNumber: { contains: filters.q } },
        ]
      : undefined,
  };

  const [tickets, definitions, people] = await Promise.all([
    prisma.ticket.findMany({
      where,
      include: ticketIncludes,
      orderBy: { updatedAt: "desc" },
    }),
    getDefinitions(),
    prisma.user.findMany({
      where: {
        memberships: {
          some: {
            workspaceId: { in: context.accessibleWorkspaceIds },
          },
        },
      },
      orderBy: { displayName: "asc" },
    }),
  ]);

  return { ...context, tickets, definitions, people };
}

export async function getTicketDetail(ticketId: string) {
  const context = await getViewerContext();
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    include: {
      ...ticketIncludes,
      comments: {
        include: {
          author: true,
        },
        orderBy: { createdAt: "asc" },
      },
      activities: {
        include: {
          actor: true,
        },
        orderBy: { createdAt: "asc" },
      },
      attachments: {
        include: {
          uploadedBy: true,
        },
        orderBy: { createdAt: "asc" },
      },
      events: {
        include: {
          createdBy: true,
          reminders: {
            orderBy: { offsetMinutes: "desc" },
          },
        },
        orderBy: { scheduledFor: "asc" },
      },
      paymentMethods: {
        include: {
          paymentMethod: true,
        },
        orderBy: {
          paymentMethod: {
            label: "asc",
          },
        },
      },
    },
  });

  if (!ticket || !context.accessibleWorkspaceIds.includes(ticket.workspaceId)) {
    return null;
  }

  const [definitions, workspacePeople, savedPaymentMethods, parentTicketCandidates] = await Promise.all([
    getDefinitions(),
    prisma.user.findMany({
      where: {
        OR: [
          {
            memberships: {
              some: {
                workspaceId: ticket.workspaceId,
              },
            },
          },
          {
            role: "ADMIN",
          },
        ],
      },
      orderBy: { displayName: "asc" },
    }),
    prisma.paymentMethod.findMany({
      where: {
        workspaceId: ticket.workspaceId,
      },
      orderBy: [{ label: "asc" }, { last4: "asc" }],
    }),
    prisma.ticket.findMany({
      where: {
        workspaceId: ticket.workspaceId,
        parentTicketId: null,
        id: { not: ticket.id },
      },
      select: {
        id: true,
        ticketNumber: true,
        title: true,
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return {
    ...context,
    ticket,
    definitions,
    workspacePeople,
    savedPaymentMethods: ticket.workspace.paymentInfoEnabled ? savedPaymentMethods : [],
    parentTicketCandidates: ticket.childTickets.length ? [] : parentTicketCandidates,
  };
}

export async function getWorkspacesOverview() {
  const context = await getViewerContext();
  const workspaces = await prisma.workspace.findMany({
    where:
      context.user.role === "ADMIN"
        ? undefined
        : { id: { in: context.accessibleWorkspaceIds } },
    include: {
      memberships: {
        include: { user: true },
      },
      tickets: true,
    },
    orderBy: { name: "asc" },
  });

  return { ...context, workspaces };
}

export async function getWorkspaceDetail(workspaceId: string) {
  const context = await getViewerContext(workspaceId);
  if (!context.accessibleWorkspaceIds.includes(workspaceId) && context.user.role !== "ADMIN") {
    return null;
  }

  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    include: {
      memberships: {
        include: { user: true },
        orderBy: { user: { displayName: "asc" } },
      },
      tickets: {
        include: ticketIncludes,
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!workspace) {
    return null;
  }

  const recentActivity = await prisma.ticketActivity.findMany({
    where: { ticket: { is: { workspaceId } } },
    include: {
      actor: true,
      ticket: true,
    },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return { ...context, workspace, recentActivity };
}

export async function getAdminData() {
  const context = await getViewerContext();
  if (context.user.role !== "ADMIN") {
    return null;
  }

  const [users, workspaces, definitions, tickets] = await Promise.all([
    prisma.user.findMany({
      include: {
        memberships: {
          include: { workspace: true },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.workspace.findMany({
      include: {
        memberships: {
          include: { user: true },
        },
        paymentMethods: {
          orderBy: [{ label: "asc" }, { last4: "asc" }],
        },
        tickets: true,
      },
      orderBy: { name: "asc" },
    }),
    getDefinitions(),
    prisma.ticket.findMany({
      include: ticketIncludes,
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  return { ...context, users, workspaces, definitions, tickets };
}

export const ticketIncludes = {
  workspace: true,
  parentTicket: {
    select: {
      id: true,
      ticketNumber: true,
      title: true,
    },
  },
  childTickets: {
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      status: true,
    },
    orderBy: { createdAt: "asc" },
  },
  requester: true,
  assignee: true,
  status: true,
  priority: true,
} satisfies Prisma.TicketInclude;
