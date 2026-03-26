import "dotenv/config";

import process from "node:process";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { Locale, PrismaClient, ThemePreference, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

async function sendWelcomeEmail(input: {
  userEmail: string;
  displayName: string;
  locale: Locale;
  password: string;
}) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    return false;
  }

  const baseUrl = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
  const loginUrl = `${baseUrl}/login`;
  const subject = input.locale === Locale.EN ? "Welcome to MiniTickets" : "欢迎使用轻量工单";
  const text =
    input.locale === Locale.EN
      ? [
          `Hi ${input.displayName},`,
          "",
          "Your MiniTickets account is ready.",
          `Email: ${input.userEmail}`,
          `Temporary password: ${input.password}`,
          `Sign in: ${loginUrl}`,
        ].join("\n")
      : [
          `${input.displayName}，你好：`,
          "",
          "你的轻量工单账户已经创建完成。",
          `邮箱：${input.userEmail}`,
          `临时密码：${input.password}`,
          `登录地址：${loginUrl}`,
        ].join("\n");

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
    auth: { user, pass },
  });

  await transporter.sendMail({
    from: process.env.MAIL_FROM ?? "MiniTickets <noreply@minitickets.iandorsey.com>",
    to: input.userEmail,
    subject,
    text,
  });

  return true;
}

async function main() {
  const email = (readArg("--email") ?? process.env.BOOTSTRAP_ADMIN_EMAIL ?? "").trim().toLowerCase();
  const displayName = (readArg("--name") ?? process.env.BOOTSTRAP_ADMIN_NAME ?? "").trim();
  const password = readArg("--password") ?? process.env.BOOTSTRAP_ADMIN_PASSWORD ?? "";
  const localeArg = (readArg("--locale") ?? process.env.BOOTSTRAP_ADMIN_LOCALE ?? "ZH_CN").toUpperCase();
  const locale = localeArg === "EN" ? Locale.EN : Locale.ZH_CN;

  if (!email || !displayName || !password) {
    console.error(
      "Usage: npm run bootstrap:admin -- --email you@example.com --name 'Your Name' --password 'StrongPassword123!' [--locale ZH_CN|EN]",
    );
    process.exit(1);
  }

  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL || "file:./dev.db",
  });
  const prisma = new PrismaClient({ adapter });

  try {
    const passwordHash = await hashPassword(password);
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        displayName,
        passwordHash,
        role: UserRole.ADMIN,
        locale,
        themePreference: ThemePreference.SYSTEM,
        isActive: true,
      },
      create: {
        email,
        displayName,
        passwordHash,
        role: UserRole.ADMIN,
        locale,
        themePreference: ThemePreference.SYSTEM,
      },
    });

    try {
      await sendWelcomeEmail({
        userEmail: user.email,
        displayName: user.displayName,
        locale: user.locale,
        password,
      });
    } catch (error) {
      console.error("Failed to send welcome email", error);
    }

    console.log(`Admin account ready: ${user.email}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
