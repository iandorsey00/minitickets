import { prisma } from "@/lib/prisma";

const defaultStatuses = [
  { key: "NEW", labelZh: "新建", labelEn: "New", sortOrder: 0 },
  { key: "OPEN", labelZh: "已打开", labelEn: "Open", sortOrder: 1 },
  { key: "IN_PROGRESS", labelZh: "处理中", labelEn: "In Progress", sortOrder: 2 },
  { key: "WAITING", labelZh: "等待中", labelEn: "Waiting", sortOrder: 3 },
  { key: "RESOLVED", labelZh: "已解决", labelEn: "Resolved", sortOrder: 4 },
  { key: "CLOSED", labelZh: "已关闭", labelEn: "Closed", sortOrder: 5 },
  { key: "CANCELLED", labelZh: "已取消", labelEn: "Cancelled", sortOrder: 6 },
] as const;

const defaultPriorities = [
  { key: "LOW", labelZh: "低", labelEn: "Low", sortOrder: 0 },
  { key: "MEDIUM", labelZh: "中", labelEn: "Medium", sortOrder: 1 },
  { key: "HIGH", labelZh: "高", labelEn: "High", sortOrder: 2 },
  { key: "URGENT", labelZh: "紧急", labelEn: "Urgent", sortOrder: 3 },
] as const;

const defaultCategories = [
  { key: "GENERAL_REQUEST", labelZh: "一般请求", labelEn: "General Request", sortOrder: 0 },
  { key: "ISSUE", labelZh: "问题", labelEn: "Issue", sortOrder: 1 },
  { key: "TASK", labelZh: "任务", labelEn: "Task", sortOrder: 2 },
  { key: "ACCESS", labelZh: "权限", labelEn: "Access", sortOrder: 3 },
  { key: "PURCHASE", labelZh: "采购", labelEn: "Purchase", sortOrder: 4 },
  { key: "ADMIN", labelZh: "行政", labelEn: "Admin", sortOrder: 5 },
] as const;

export async function ensureCoreDefinitions() {
  await prisma.$transaction([
    ...defaultStatuses.map((item) =>
      prisma.statusDefinition.upsert({
        where: { key: item.key },
        update: {
          labelZh: item.labelZh,
          labelEn: item.labelEn,
          sortOrder: item.sortOrder,
          isActive: true,
        },
        create: {
          key: item.key,
          labelZh: item.labelZh,
          labelEn: item.labelEn,
          sortOrder: item.sortOrder,
          isActive: true,
        },
      }),
    ),
    ...defaultPriorities.map((item) =>
      prisma.priorityDefinition.upsert({
        where: { key: item.key },
        update: {
          labelZh: item.labelZh,
          labelEn: item.labelEn,
          sortOrder: item.sortOrder,
          isActive: true,
        },
        create: {
          key: item.key,
          labelZh: item.labelZh,
          labelEn: item.labelEn,
          sortOrder: item.sortOrder,
          isActive: true,
        },
      }),
    ),
    ...defaultCategories.map((item) =>
      prisma.categoryDefinition.upsert({
        where: { key: item.key },
        update: {
          labelZh: item.labelZh,
          labelEn: item.labelEn,
          sortOrder: item.sortOrder,
          isActive: true,
        },
        create: {
          key: item.key,
          labelZh: item.labelZh,
          labelEn: item.labelEn,
          sortOrder: item.sortOrder,
          isActive: true,
        },
      }),
    ),
  ]);
}
