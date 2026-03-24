import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { SESSION_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const SESSION_DAYS = 14;

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export async function createSession(userId: string) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;
  if (rawToken) {
    await prisma.session.deleteMany({
      where: { tokenHash: sha256(rawToken) },
    });
  }
  cookieStore.delete(SESSION_COOKIE);
}

export const getCurrentUser = cache(async () => {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(SESSION_COOKIE)?.value;

  if (!rawToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: {
      user: {
        include: {
          memberships: {
            include: {
              workspace: true,
            },
            orderBy: {
              workspace: {
                name: "asc",
              },
            },
          },
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    cookieStore.delete(SESSION_COOKIE);
    if (session) {
      await prisma.session.delete({ where: { id: session.id } });
    }
    return null;
  }

  return session.user;
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}
