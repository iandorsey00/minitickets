import { redirect } from "next/navigation";
import { cache } from "react";

import { AUTH_ROUTES } from "@/lib/auth-config";
import {
  clearLocalLoginEmailChallenge,
  createLocalLoginEmailChallenge,
  destroyLocalAppSession,
  getAuthenticatedUserId,
  getMiniAuthLoginUrl,
  getMiniAuthLogoutUrl,
  getPendingLocalLoginChallenge,
  revokeMiniAuthSession,
  startLocalAppSession,
} from "@/lib/auth-service";
import { prisma } from "@/lib/prisma";

export const getCurrentUser = cache(async () => {
  const userId = await getAuthenticatedUserId();

  if (!userId) {
    return null;
  }

  return prisma.user.findUnique({
    where: { id: userId },
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
  });
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) {
    redirect(getMiniAuthLoginUrl());
  }
  return user;
}

export {
  clearLocalLoginEmailChallenge as clearLoginEmailChallenge,
  createLocalLoginEmailChallenge as createLoginEmailChallenge,
  destroyLocalAppSession as destroySession,
  getMiniAuthLoginUrl,
  getMiniAuthLogoutUrl,
  getPendingLocalLoginChallenge as getPendingLoginChallenge,
  revokeMiniAuthSession,
  startLocalAppSession as createSession,
};
