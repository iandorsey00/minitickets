import crypto from "node:crypto";
import { ThemePreference, type AccentColor, type Locale } from "@prisma/client";
import { cookies } from "next/headers";
import { cache } from "react";

import { AUTH_COOKIE_NAMES, AUTH_SHARED_COOKIE_DOMAIN } from "@/lib/auth-config";
import { ACCENT_COOKIE, LOCALE_COOKIE, THEME_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const SESSION_DAYS = 14;
const LOGIN_CHALLENGE_MINUTES = 10;

type UserPreferenceSnapshot = {
  locale: Locale;
  themePreference: ThemePreference;
  accentColor: AccentColor;
};

type SessionUserSnapshot = UserPreferenceSnapshot & {
  id: string;
};

function sha256(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex");
}

function getSharedCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
    ...(AUTH_SHARED_COOKIE_DOMAIN ? { domain: AUTH_SHARED_COOKIE_DOMAIN } : {}),
  };
}

export async function applyUserPreferenceCookies(preferences: UserPreferenceSnapshot) {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, preferences.locale, { path: "/" });
  cookieStore.set(THEME_COOKIE, preferences.themePreference, { path: "/" });
  cookieStore.set(ACCENT_COOKIE, preferences.accentColor, { path: "/" });
}

export async function startLocalAppSession(user: SessionUserSnapshot) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAMES.session, rawToken, getSharedCookieOptions(expiresAt));
  await applyUserPreferenceCookies(user);
}

export async function destroyLocalAppSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAMES.session)?.value;
  if (rawToken) {
    await prisma.session.deleteMany({
      where: { tokenHash: sha256(rawToken) },
    });
  }
  cookieStore.delete(AUTH_COOKIE_NAMES.session);
}

export async function createLocalLoginEmailChallenge(userId: string) {
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = sha256(rawToken);
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  const codeHash = sha256(code);
  const expiresAt = new Date(Date.now() + LOGIN_CHALLENGE_MINUTES * 60 * 1000);

  await prisma.loginEmailChallenge.deleteMany({
    where: { userId },
  });

  await prisma.loginEmailChallenge.create({
    data: {
      userId,
      tokenHash,
      codeHash,
      expiresAt,
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(AUTH_COOKIE_NAMES.loginChallenge, rawToken, getSharedCookieOptions(expiresAt));

  return { code, expiresAt };
}

export async function clearLocalLoginEmailChallenge() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAMES.loginChallenge)?.value;
  if (rawToken) {
    await prisma.loginEmailChallenge.deleteMany({
      where: { tokenHash: sha256(rawToken) },
    });
  }
  cookieStore.delete(AUTH_COOKIE_NAMES.loginChallenge);
}

export const getPendingLocalLoginChallenge = cache(async () => {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAMES.loginChallenge)?.value;

  if (!rawToken) {
    return null;
  }

  const challenge = await prisma.loginEmailChallenge.findUnique({
    where: { tokenHash: sha256(rawToken) },
    include: {
      user: true,
    },
  });

  if (!challenge || challenge.usedAt || challenge.expiresAt < new Date() || !challenge.user.isActive) {
    return null;
  }

  return challenge;
});

export const getAuthenticatedUserId = cache(async () => {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(AUTH_COOKIE_NAMES.session)?.value;

  if (!rawToken) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: sha256(rawToken) },
    select: {
      userId: true,
      expiresAt: true,
      user: {
        select: {
          isActive: true,
        },
      },
    },
  });

  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }

  return session.userId;
});
