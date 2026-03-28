import crypto from "node:crypto";

import { prisma } from "@/lib/prisma";

const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;

function hashKey(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export async function assertRateLimit(action: string, rawKey: string, maxAttempts: number) {
  const now = new Date();
  const key = hashKey(rawKey);

  const existing = await prisma.authRateLimit.findUnique({
    where: {
      action_key: {
        action,
        key,
      },
    },
  });

  if (!existing) {
    await prisma.authRateLimit.create({
      data: {
        action,
        key,
        attempts: 1,
        windowStartedAt: now,
      },
    });
    return;
  }

  if (existing.blockedUntil && existing.blockedUntil > now) {
    throw new Error("RATE_LIMITED");
  }

  const windowExpired = now.getTime() - existing.windowStartedAt.getTime() > WINDOW_MS;
  const attempts = windowExpired ? 1 : existing.attempts + 1;
  const blockedUntil = attempts > maxAttempts ? new Date(now.getTime() + BLOCK_MS) : null;

  await prisma.authRateLimit.update({
    where: {
      action_key: {
        action,
        key,
      },
    },
    data: {
      attempts,
      windowStartedAt: windowExpired ? now : existing.windowStartedAt,
      blockedUntil,
    },
  });

  if (blockedUntil) {
    throw new Error("RATE_LIMITED");
  }
}

export async function clearRateLimit(action: string, rawKey: string) {
  const key = hashKey(rawKey);
  await prisma.authRateLimit.deleteMany({
    where: {
      action,
      key,
    },
  });
}
