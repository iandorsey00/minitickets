import crypto from "node:crypto";
import Database from "better-sqlite3";
import { ThemePreference, type AccentColor, type Locale } from "@prisma/client";
import { cookies } from "next/headers";
import { cache } from "react";

import {
  AUTH_COOKIE_NAMES,
  AUTH_ROUTES,
  AUTH_SHARED_COOKIE_DOMAIN,
  MINI_AUTH_LOGIN_REDIRECT_ENABLED,
} from "@/lib/auth-config";
import { getDatabaseUrl, resolveSqliteFilePath } from "@/lib/database-url";
import { ACCENT_COOKIE, LOCALE_COOKIE, THEME_COOKIE } from "@/lib/constants";
import { prisma } from "@/lib/prisma";

const SESSION_DAYS = 14;
const LOGIN_CHALLENGE_MINUTES = 10;
const DEFAULT_MINIAUTH_DATABASE_URL = "file:/srv/miniauth/data/miniauth.db";

type UserPreferenceSnapshot = {
  locale: Locale;
  themePreference: ThemePreference;
  accentColor: AccentColor;
};

type SessionUserSnapshot = UserPreferenceSnapshot & {
  id: string;
};

type MiniAuthIdentity = UserPreferenceSnapshot & {
  authUserId: string;
  email: string;
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

function toLocale(value: string | null | undefined): Locale {
  return value === "EN" ? "EN" : "ZH_CN";
}

function toTheme(value: string | null | undefined): ThemePreference {
  return value === "LIGHT" || value === "DARK" ? value : "SYSTEM";
}

function toAccent(value: string | null | undefined): AccentColor {
  switch (value) {
    case "CYAN":
    case "TEAL":
    case "GREEN":
    case "LIME":
    case "YELLOW":
    case "ORANGE":
    case "RED":
    case "PINK":
    case "PURPLE":
      return value;
    default:
      return "BLUE";
  }
}

function getMiniAuthDatabaseUrl() {
  return process.env.MINIAUTH_DATABASE_URL || DEFAULT_MINIAUTH_DATABASE_URL;
}

function getMiniAuthSessionCookieName() {
  return process.env.MINIAUTH_SESSION_COOKIE_NAME || "miniauth_session";
}

function getMiniAuthDb() {
  const filePath = resolveSqliteFilePath(getMiniAuthDatabaseUrl());
  return new Database(filePath, { readonly: true, fileMustExist: true });
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

export async function revokeMiniAuthSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(getMiniAuthSessionCookieName())?.value;

  if (!rawToken) {
    return;
  }

  try {
    const db = getMiniAuthDb();
    try {
      db.prepare('UPDATE "Session" SET "revokedAt" = CURRENT_TIMESTAMP WHERE "tokenHash" = ? AND "revokedAt" IS NULL').run(
        sha256(rawToken),
      );
    } finally {
      db.close();
    }
  } catch (error) {
    console.error("Failed to revoke MiniAuth session from MiniTickets", error);
  }

  cookieStore.delete(getMiniAuthSessionCookieName());
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

export const getMiniAuthIdentity = cache(async (): Promise<MiniAuthIdentity | null> => {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(getMiniAuthSessionCookieName())?.value;

  if (!rawToken) {
    return null;
  }

  try {
    const db = getMiniAuthDb();
    try {
      const row = db
        .prepare(
          `
            SELECT
              u.id AS authUserId,
              u.email AS email,
              u.locale AS locale,
              u.themePreference AS themePreference,
              u.accentColor AS accentColor,
              u.isActive AS isActive,
              s.revokedAt AS revokedAt,
              s.expiresAt AS expiresAt
            FROM "Session" s
            JOIN "User" u ON u.id = s.userId
            JOIN "AppAccess" a ON a.userId = u.id
            WHERE s.tokenHash = ?
              AND a.appKey = ?
              AND a.state = 'ACTIVE'
            LIMIT 1
          `,
        )
        .get(sha256(rawToken), "minitickets") as
        | {
            authUserId: string;
            email: string;
            locale: string;
            themePreference: string;
            accentColor: string;
            isActive: number;
            revokedAt: string | null;
            expiresAt: string;
          }
        | undefined;

      if (!row || row.revokedAt || !row.isActive || new Date(row.expiresAt) < new Date()) {
        return null;
      }

      return {
        authUserId: row.authUserId,
        email: row.email.toLowerCase(),
        locale: toLocale(row.locale),
        themePreference: toTheme(row.themePreference),
        accentColor: toAccent(row.accentColor),
      };
    } finally {
      db.close();
    }
  } catch (error) {
    console.error("Failed to resolve MiniAuth identity from MiniTickets", error);
    return null;
  }
});

export const getAuthenticatedUserId = cache(async () => {
  const miniAuthIdentity = await getMiniAuthIdentity();
  if (miniAuthIdentity) {
    const existingUser =
      (await prisma.user.findFirst({
        where: {
          OR: [{ authUserId: miniAuthIdentity.authUserId }, { email: miniAuthIdentity.email }],
        },
        select: {
          id: true,
          authUserId: true,
          email: true,
          isActive: true,
          locale: true,
          themePreference: true,
          accentColor: true,
        },
      })) ?? null;

    if (!existingUser || !existingUser.isActive) {
      return null;
    }

    if (
      existingUser.authUserId !== miniAuthIdentity.authUserId ||
      existingUser.email !== miniAuthIdentity.email ||
      existingUser.locale !== miniAuthIdentity.locale ||
      existingUser.themePreference !== miniAuthIdentity.themePreference ||
      existingUser.accentColor !== miniAuthIdentity.accentColor
    ) {
      await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          authUserId: miniAuthIdentity.authUserId,
          email: miniAuthIdentity.email,
          locale: miniAuthIdentity.locale,
          themePreference: miniAuthIdentity.themePreference,
          accentColor: miniAuthIdentity.accentColor,
        },
      });
    }

    return existingUser.id;
  }

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

export function getMiniAuthLoginUrl(currentPath?: string) {
  const baseUrl = process.env.MINIAUTH_BASE_URL?.trim();
  if (!baseUrl || !MINI_AUTH_LOGIN_REDIRECT_ENABLED) {
    return AUTH_ROUTES.login;
  }

  const redirectTarget = currentPath ? `${process.env.APP_URL || ""}${currentPath}` : process.env.APP_URL || "";
  if (!redirectTarget) {
    return `${baseUrl.replace(/\/$/, "")}/login`;
  }

  return `${baseUrl.replace(/\/$/, "")}/login?returnTo=${encodeURIComponent(redirectTarget)}`;
}

export function getMiniAuthLogoutUrl(currentPath?: string) {
  const baseUrl = process.env.MINIAUTH_BASE_URL?.trim();
  if (!baseUrl || !MINI_AUTH_LOGIN_REDIRECT_ENABLED) {
    return null;
  }

  const redirectTarget = currentPath ? `${process.env.APP_URL || ""}${currentPath}` : process.env.APP_URL || "";
  if (!redirectTarget) {
    return `${baseUrl.replace(/\/$/, "")}/logout`;
  }

  return `${baseUrl.replace(/\/$/, "")}/logout?returnTo=${encodeURIComponent(redirectTarget)}`;
}
