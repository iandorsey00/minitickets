import "dotenv/config";

import process from "node:process";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

import { getDatabaseUrl } from "../lib/database-url.ts";
import { sendWelcomeEmail } from "../lib/email.ts";

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function main() {
  const email = (readArg("--email") ?? "").trim().toLowerCase();
  const password = readArg("--password") ?? "";

  if (!email || !password) {
    console.error("Usage: npm run email:welcome -- --email you@example.com --password 'TemporaryPassword'");
    process.exit(1);
  }

  const adapter = new PrismaBetterSqlite3({
    url: getDatabaseUrl(),
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(`No user found for ${email}`);
      process.exit(1);
    }

    await sendWelcomeEmail({
      userEmail: user.email,
      displayName: user.displayName,
      locale: user.locale,
      password,
    });

    console.log(`Welcome email sent to ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
