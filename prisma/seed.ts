import bcrypt from "bcryptjs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

import { getDatabaseUrl } from "../lib/database-url.ts";

function formatTicketNumber(prefix: string, serialNumber: number) {
  return `MT${prefix}${String(serialNumber).padStart(5, "0")}`;
}

const adapter = new PrismaBetterSqlite3({
  url: getDatabaseUrl(),
});

const prisma = new PrismaClient({ adapter });

const statuses = [
  ["NEW", "新建", "New"],
  ["IN_PROGRESS", "处理中", "In Progress"],
  ["WAITING", "等待中", "Waiting"],
  ["RESOLVED", "已解决", "Resolved"],
  ["CLOSED", "已关闭", "Closed"],
  ["CANCELLED", "已取消", "Cancelled"],
] as const;

const priorities = [
  ["LOW", "低", "Low"],
  ["MEDIUM", "中", "Medium"],
  ["HIGH", "高", "High"],
  ["URGENT", "紧急", "Urgent"],
] as const;

async function upsertDefinitions() {
  for (const [index, [key, labelZh, labelEn]] of statuses.entries()) {
    await prisma.statusDefinition.upsert({
      where: { key },
      update: { labelZh, labelEn, sortOrder: index, isActive: true },
      create: { key, labelZh, labelEn, sortOrder: index, isActive: true },
    });
  }

  for (const [index, [key, labelZh, labelEn]] of priorities.entries()) {
    await prisma.priorityDefinition.upsert({
      where: { key },
      update: { labelZh, labelEn, sortOrder: index, isActive: true },
      create: { key, labelZh, labelEn, sortOrder: index, isActive: true },
    });
  }

}

async function main() {
  await upsertDefinitions();

  const passwordHash = await bcrypt.hash("MiniTickets123!", 10);

  const admin = await prisma.user.upsert({
    where: { email: "admin@minitickets.local" },
    update: {
      displayName: "Ian Dorsey",
      role: "ADMIN",
      locale: "ZH_CN",
      accentColor: "BLUE",
      themePreference: "SYSTEM",
      isActive: true,
      passwordHash,
    },
    create: {
      email: "admin@minitickets.local",
      displayName: "Ian Dorsey",
      role: "ADMIN",
      locale: "ZH_CN",
      accentColor: "BLUE",
      themePreference: "SYSTEM",
      isActive: true,
      passwordHash,
    },
  });

  const meilin = await prisma.user.upsert({
    where: { email: "meilin@minitickets.local" },
    update: {
      displayName: "Meilin",
      role: "USER",
      locale: "ZH_CN",
      accentColor: "TEAL",
      themePreference: "LIGHT",
      isActive: true,
      passwordHash,
    },
    create: {
      email: "meilin@minitickets.local",
      displayName: "Meilin",
      role: "USER",
      locale: "ZH_CN",
      accentColor: "TEAL",
      themePreference: "LIGHT",
      isActive: true,
      passwordHash,
    },
  });

  const alex = await prisma.user.upsert({
    where: { email: "alex@minitickets.local" },
    update: {
      displayName: "Alex",
      role: "USER",
      locale: "EN",
      accentColor: "ORANGE",
      themePreference: "DARK",
      isActive: true,
      passwordHash,
    },
    create: {
      email: "alex@minitickets.local",
      displayName: "Alex",
      role: "USER",
      locale: "EN",
      accentColor: "ORANGE",
      themePreference: "DARK",
      isActive: true,
      passwordHash,
    },
  });

  const personal = await prisma.workspace.upsert({
    where: { slug: "personal-ops" },
    update: {
      ticketPrefix: "PO",
      name: "个人事务",
      description: "个人请求、家庭任务和轻量记录。",
      isArchived: false,
    },
    create: {
      slug: "personal-ops",
      ticketPrefix: "PO",
      name: "个人事务",
      description: "个人请求、家庭任务和轻量记录。",
      isArchived: false,
    },
  });

  const studio = await prisma.workspace.upsert({
    where: { slug: "studio-requests" },
    update: {
      ticketPrefix: "SR",
      name: "Studio Requests",
      description: "Small business and side-project operational requests.",
      isArchived: false,
    },
    create: {
      slug: "studio-requests",
      ticketPrefix: "SR",
      name: "Studio Requests",
      description: "Small business and side-project operational requests.",
      isArchived: false,
    },
  });

  const workspaceMemberships = [
    [admin.id, personal.id, "ADMIN"],
    [admin.id, studio.id, "ADMIN"],
    [meilin.id, personal.id, "MEMBER"],
    [alex.id, studio.id, "MEMBER"],
  ] as const;

  for (const [userId, workspaceId, role] of workspaceMemberships) {
    await prisma.workspaceMembership.upsert({
      where: { userId_workspaceId: { userId, workspaceId } },
      update: { role },
      create: { userId, workspaceId, role },
    });
  }

  const [statusNew, statusProgress, statusWaiting] = await Promise.all([
    prisma.statusDefinition.findUniqueOrThrow({ where: { key: "NEW" } }),
    prisma.statusDefinition.findUniqueOrThrow({ where: { key: "IN_PROGRESS" } }),
    prisma.statusDefinition.findUniqueOrThrow({ where: { key: "WAITING" } }),
  ]);
  const [priorityMedium, priorityHigh, priorityUrgent] = await Promise.all([
    prisma.priorityDefinition.findUniqueOrThrow({ where: { key: "MEDIUM" } }),
    prisma.priorityDefinition.findUniqueOrThrow({ where: { key: "HIGH" } }),
    prisma.priorityDefinition.findUniqueOrThrow({ where: { key: "URGENT" } }),
  ]);
  const tickets = [
    {
      ticketNumber: formatTicketNumber("PO", 1),
      serialNumber: 1,
      title: "整理家庭账单文件",
      description: "把最近三个月的账单整理到统一的云端文件夹，并补充标签。",
      workspaceId: personal.id,
      requesterId: admin.id,
      assigneeId: meilin.id,
      statusId: statusNew.id,
      priorityId: priorityMedium.id,
    },
    {
      ticketNumber: formatTicketNumber("SR", 1),
      serialNumber: 1,
      title: "Approve new domain purchase",
      description: "Review and approve the domain purchase for the next side project launch.",
      workspaceId: studio.id,
      requesterId: alex.id,
      assigneeId: admin.id,
      statusId: statusWaiting.id,
      priorityId: priorityHigh.id,
    },
    {
      ticketNumber: formatTicketNumber("SR", 2),
      serialNumber: 2,
      title: "Grant access to shared design folder",
      description: "Please add Alex to the shared design folder with edit permission.",
      workspaceId: studio.id,
      requesterId: admin.id,
      assigneeId: admin.id,
      statusId: statusProgress.id,
      priorityId: priorityUrgent.id,
    },
  ] as const;

  for (const ticket of tickets) {
    await prisma.ticket.upsert({
      where: {
        workspaceId_serialNumber: {
          workspaceId: ticket.workspaceId,
          serialNumber: ticket.serialNumber,
        },
      },
      update: ticket,
      create: ticket,
    });
  }

  const seededTickets = await prisma.ticket.findMany({
    where: {
      ticketNumber: {
        in: [formatTicketNumber("PO", 1), formatTicketNumber("SR", 1), formatTicketNumber("SR", 2)],
      },
    },
  });

  for (const ticket of seededTickets) {
    const existingActivity = await prisma.ticketActivity.findFirst({
      where: {
        ticketId: ticket.id,
        actorUserId: ticket.requesterId,
        eventType: "ticket.created",
      },
    });

    if (!existingActivity) {
      await prisma.ticketActivity.create({
        data: {
          ticketId: ticket.id,
          actorUserId: ticket.requesterId,
          eventType: "ticket.created",
          messageZh: "已提交工单。",
          messageEn: "Request submitted.",
        },
      });
    }
  }

  console.log("Seed complete");
  console.log("Admin login: admin@minitickets.local / MiniTickets123!");
  console.log("User login: meilin@minitickets.local / MiniTickets123!");
  console.log("User login: alex@minitickets.local / MiniTickets123!");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
