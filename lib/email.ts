import type { Locale } from "@prisma/client";

type MailRecipient = {
  email: string;
  displayName: string;
  locale: Locale;
};

type WelcomeEmailInput = {
  userEmail: string;
  displayName: string;
  locale: Locale;
  password: string;
};

type PasswordSetupEmailInput = {
  recipient: MailRecipient;
  setupToken: string;
};

type TicketEmailInput = {
  kind: "created" | "assigned" | "comment_added" | "resolved";
  recipient: MailRecipient;
  ticket: {
    id: string;
    ticketNumber: string;
    title: string;
    workspaceName: string;
    statusLabelZh?: string;
    statusLabelEn?: string;
  };
  actorName?: string;
  commentBody?: string;
};

function getBaseUrl() {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}

function getMailFrom() {
  return process.env.MAIL_FROM ?? "MiniTickets <noreply@minitickets.iandorsey.com>";
}

function getResendApiKey() {
  return process.env.RESEND_API_KEY ?? process.env.SMTP_PASS ?? "";
}

function buildWelcomeEmail({ displayName, locale, password, userEmail }: WelcomeEmailInput) {
  const loginUrl = `${getBaseUrl()}/login`;

  if (locale === "EN") {
    return {
      subject: "Welcome to MiniTickets",
      text: [
        `Hi ${displayName},`,
        "",
        "Your MiniTickets admin account is ready.",
        `Email: ${userEmail}`,
        `Temporary password: ${password}`,
        `Sign in: ${loginUrl}`,
        "",
        "Please sign in and change your password in Settings.",
      ].join("\n"),
      html: `
        <p>Hi ${displayName},</p>
        <p>Your MiniTickets admin account is ready.</p>
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
      "你的轻量工单管理员账户已经创建完成。",
      `邮箱：${userEmail}`,
      `临时密码：${password}`,
      `登录地址：${loginUrl}`,
      "",
      "请先登录，并在“设置”中修改密码。",
    ].join("\n"),
    html: `
      <p>${displayName}，你好：</p>
      <p>你的轻量工单管理员账户已经创建完成。</p>
      <p><strong>邮箱：</strong>${userEmail}<br /><strong>临时密码：</strong>${password}</p>
      <p><a href="${loginUrl}">登录轻量工单</a></p>
      <p>请先登录，并在“设置”中修改密码。</p>
    `,
  };
}

function buildPasswordSetupEmail({ recipient, setupToken }: PasswordSetupEmailInput) {
  const setupUrl = `${getBaseUrl()}/setup-password?token=${encodeURIComponent(setupToken)}`;

  if (recipient.locale === "EN") {
    return {
      subject: "Set your MiniTickets password",
      text: [
        `Hi ${recipient.displayName},`,
        "",
        "Your MiniTickets account has been created.",
        "This link opens the password setup screen directly.",
        `Set your password now: ${setupUrl}`,
        "",
        "This link expires in 24 hours.",
      ].join("\n"),
      html: `
        <p>Hi ${recipient.displayName},</p>
        <p>Your MiniTickets account has been created.</p>
        <p><a href="${setupUrl}">Open the password setup screen</a></p>
        <p>This link expires in 24 hours.</p>
      `,
    };
  }

    return {
      subject: "设置你的轻量工单密码",
      text: [
        `${recipient.displayName}，你好：`,
        "",
        "你的轻量工单账户已经创建。",
        "这个链接会直接打开设置密码页面。",
        `请立即设置密码：${setupUrl}`,
        "",
        "此链接将在 24 小时后失效。",
      ].join("\n"),
      html: `
        <p>${recipient.displayName}，你好：</p>
        <p>你的轻量工单账户已经创建。</p>
        <p><a href="${setupUrl}">打开设置密码页面</a></p>
        <p>此链接将在 24 小时后失效。</p>
      `,
    };
  }

function buildTicketEmail({ actorName, commentBody, kind, recipient, ticket }: TicketEmailInput) {
  const ticketUrl = `${getBaseUrl()}/tickets/${ticket.id}`;
  const statusText =
    recipient.locale === "EN" ? ticket.statusLabelEn ?? "Updated" : ticket.statusLabelZh ?? "已更新";

  if (recipient.locale === "EN") {
    if (kind === "created") {
      return {
        subject: `${ticket.ticketNumber} created`,
        text: [
          `Hi ${recipient.displayName},`,
          "",
          `Your ticket ${ticket.ticketNumber} has been created in ${ticket.workspaceName}.`,
          `Title: ${ticket.title}`,
          `Open: ${ticketUrl}`,
        ].join("\n"),
      };
    }

    if (kind === "assigned") {
      return {
        subject: `${ticket.ticketNumber} assigned to you`,
        text: [
          `Hi ${recipient.displayName},`,
          "",
          `${actorName ?? "A teammate"} assigned ${ticket.ticketNumber} to you.`,
          `Title: ${ticket.title}`,
          `Open: ${ticketUrl}`,
        ].join("\n"),
      };
    }

    if (kind === "comment_added") {
      return {
        subject: `New comment on ${ticket.ticketNumber}`,
        text: [
          `Hi ${recipient.displayName},`,
          "",
          `${actorName ?? "A teammate"} added a comment on ${ticket.ticketNumber}.`,
          `Title: ${ticket.title}`,
          commentBody ? `Comment: ${commentBody}` : "",
          `Open: ${ticketUrl}`,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    return {
      subject: `${ticket.ticketNumber} marked ${statusText}`,
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `${actorName ?? "A teammate"} changed ${ticket.ticketNumber} to ${statusText}.`,
        `Title: ${ticket.title}`,
        `Open: ${ticketUrl}`,
      ].join("\n"),
    };
  }

  if (kind === "created") {
    return {
      subject: `${ticket.ticketNumber} 已创建`,
      text: [
        `${recipient.displayName}，你好：`,
        "",
        `你的工单 ${ticket.ticketNumber} 已在「${ticket.workspaceName}」中创建。`,
        `标题：${ticket.title}`,
        `查看工单：${ticketUrl}`,
      ].join("\n"),
    };
  }

  if (kind === "assigned") {
    return {
      subject: `${ticket.ticketNumber} 已分配给你`,
      text: [
        `${recipient.displayName}，你好：`,
        "",
        `${actorName ?? "有同事"} 已将工单 ${ticket.ticketNumber} 分配给你。`,
        `标题：${ticket.title}`,
        `查看工单：${ticketUrl}`,
      ].join("\n"),
    };
  }

  if (kind === "comment_added") {
    return {
      subject: `${ticket.ticketNumber} 有新评论`,
      text: [
        `${recipient.displayName}，你好：`,
        "",
        `${actorName ?? "有同事"} 在工单 ${ticket.ticketNumber} 中添加了评论。`,
        `标题：${ticket.title}`,
        commentBody ? `评论：${commentBody}` : "",
        `查看工单：${ticketUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return {
    subject: `${ticket.ticketNumber} 已更新为${statusText}`,
    text: [
      `${recipient.displayName}，你好：`,
      "",
      `${actorName ?? "有同事"} 已将工单 ${ticket.ticketNumber} 更新为「${statusText}」。`,
      `标题：${ticket.title}`,
      `查看工单：${ticketUrl}`,
    ].join("\n"),
  };
}

async function sendViaResend(to: string, subject: string, text: string, html?: string) {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return false;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: getMailFrom(),
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Resend API error (${response.status}): ${errorBody}`);
  }

  return true;
}

export async function sendWelcomeEmail(input: WelcomeEmailInput) {
  const message = buildWelcomeEmail(input);
  return sendViaResend(input.userEmail, message.subject, message.text, message.html);
}

export async function sendPasswordSetupEmail(input: PasswordSetupEmailInput) {
  const message = buildPasswordSetupEmail(input);
  return sendViaResend(input.recipient.email, message.subject, message.text, message.html);
}

export async function sendTicketEmail(input: TicketEmailInput) {
  const message = buildTicketEmail(input);
  return sendViaResend(input.recipient.email, message.subject, message.text);
}
