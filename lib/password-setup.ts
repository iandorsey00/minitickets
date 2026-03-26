import crypto from "node:crypto";

import { prisma } from "./prisma.ts";

const PASSWORD_SETUP_HOURS = 24;

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function createPasswordSetupToken(userId: string) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_SETUP_HOURS * 60 * 60 * 1000);

  await prisma.passwordSetupToken.deleteMany({
    where: { userId },
  });

  await prisma.passwordSetupToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  return rawToken;
}

export function hashPasswordSetupToken(rawToken: string) {
  return sha256(rawToken);
}
