import nodemailer from "nodemailer";
import type { Locale } from "@prisma/client";

type WelcomeEmailInput = {
  userEmail: string;
  displayName: string;
  locale: Locale;
  password: string;
};

function getMailConfig() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.MAIL_FROM ?? "MiniTickets <noreply@minitickets.iandorsey.com>";

  if (!host || !user || !pass) {
    return null;
  }

  return {
    host,
    port,
    user,
    pass,
    from,
    secure: process.env.SMTP_SECURE === "true" || port === 465,
  };
}

function getBaseUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function buildWelcomeEmail({ displayName, locale, password, userEmail }: WelcomeEmailInput) {
  const loginUrl = `${getBaseUrl()}/login`;

  if (locale === "EN") {
    return {
      subject: "Welcome to MiniTickets",
      text: [
        `Hi ${displayName},`,
        "",
        "Your MiniTickets account is ready.",
        `Email: ${userEmail}`,
        `Temporary password: ${password}`,
        `Sign in: ${loginUrl}`,
        "",
        "Please sign in and change your password in Settings.",
      ].join("\n"),
      html: `
        <p>Hi ${displayName},</p>
        <p>Your MiniTickets account is ready.</p>
        <p><strong>Email:</strong> ${userEmail}<br /><strong>Temporary password:</strong> ${password}</p>
        <p><a href="${loginUrl}">Sign in to MiniTickets</a></p>
        <p>Please sign in and change your password in Settings.</p>
      `,
    };
  }

  return {
    subject: "欢迎使用轻量工单",
    text: [
      `${displayName}，你好：`,
      "",
      "你的轻量工单账户已经创建完成。",
      `邮箱：${userEmail}`,
      `临时密码：${password}`,
      `登录地址：${loginUrl}`,
      "",
      "请先登录，并在“设置”中修改密码。",
    ].join("\n"),
    html: `
      <p>${displayName}，你好：</p>
      <p>你的轻量工单账户已经创建完成。</p>
      <p><strong>邮箱：</strong>${userEmail}<br /><strong>临时密码：</strong>${password}</p>
      <p><a href="${loginUrl}">登录轻量工单</a></p>
      <p>请先登录，并在“设置”中修改密码。</p>
    `,
  };
}

export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  const config = getMailConfig();
  if (!config) {
    return false;
  }

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  const message = buildWelcomeEmail(input);
  await transporter.sendMail({
    from: config.from,
    to: input.userEmail,
    subject: message.subject,
    text: message.text,
    html: message.html,
  });

  return true;
}
