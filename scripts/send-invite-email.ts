import "dotenv/config";

import process from "node:process";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

import { sendPasswordSetupEmail } from "../lib/email.ts";
import { createPasswordSetupToken } from "../lib/password-setup.ts";

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const email = (readArg("--email") ?? "").trim().toLowerCase();

  if (!email) {
    console.error("Usage: npm run email:invite -- --email you@example.com");
    process.exit(1);
  }

  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || "file:./dev.db",
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        memberships: {
          include: {
            workspace: true,
          },
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });
    if (!user) {
      console.error(`No user found for ${email}`);
      process.exit(1);
    }

    const setupToken = await createPasswordSetupToken(user.id);
    await sendPasswordSetupEmail({
      recipient: {
        email: user.email,
        displayName: user.displayName,
        locale: user.locale,
      },
      setupToken,
      workspaceName: user.memberships[0]?.workspace.name,
    });

    console.log(`Invite email sent to ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
