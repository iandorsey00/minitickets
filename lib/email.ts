import type { Locale } from "@prisma/client";

import { localeTokenMap } from "./constants.ts";
import { formatReminderOffsetLabel } from "./reminder-labels.ts";

type MailRecipient = {
  email: string;
  displayName: string;
  locale: Locale;
  timeZone?: string;
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
  workspaceName?: string;
};

type LoginCodeEmailInput = {
  recipient: MailRecipient;
  code: string;
};

type TicketEmailInput = {
  kind: "created" | "assigned" | "comment_added" | "mentioned" | "resolved";
  recipient: MailRecipient;
  ticket: {
    id: string;
    ticketNumber: string;
    title: string;
    workspaceName: string;
    statusLabelZh?: string;
    statusLabelEn?: string;
    parentTicketNumber?: string;
    parentTitle?: string;
  };
  actorName?: string;
  commentBody?: string;
};

type TicketEventEmailInput = {
  kind: "created" | "reminder";
  recipient: MailRecipient;
  ticket: {
    id: string;
    ticketNumber: string;
    title: string;
    workspaceName: string;
  };
  event: {
    title: string;
    notes?: string;
    scheduledFor: Date;
  };
  offsetMinutes?: number;
};

type TicketDueDateReminderEmailInput = {
  recipient: MailRecipient;
  ticket: {
    id: string;
    ticketNumber: string;
    title: string;
    workspaceName: string;
    dueDate: Date;
  };
};

type DiskSpaceAlertEmailInput = {
  recipient: MailRecipient;
  freePercent: number;
  freeBytes: number;
  totalBytes: number;
  thresholdPercent: number;
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

function formatEventDate(date: Date, locale: Locale, timeZone?: string) {
  return new Intl.DateTimeFormat(localeTokenMap[locale], {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone,
  }).format(date);
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

function buildPasswordSetupEmail({ recipient, setupToken, workspaceName }: PasswordSetupEmailInput) {
  const setupUrl = `${getBaseUrl()}/setup-password?token=${encodeURIComponent(setupToken)}`;
  const workspaceLineEn = workspaceName ? `Workspace: ${workspaceName}` : "";
  const workspaceLineZh = workspaceName ? `工作区：${workspaceName}` : "";

  if (recipient.locale === "EN") {
    return {
      subject: "Set your MiniTickets password",
      text: [
        `Hi ${recipient.displayName},`,
        "",
        "Your MiniTickets account has been created.",
        workspaceLineEn,
        "This link opens the password setup screen directly.",
        `Set your password now: ${setupUrl}`,
        "",
        "This link expires in 24 hours.",
      ].join("\n"),
      html: `
        <p>Hi ${recipient.displayName},</p>
        <p>Your MiniTickets account has been created.</p>
        ${workspaceName ? `<p><strong>Workspace:</strong> ${workspaceName}</p>` : ""}
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
      workspaceLineZh,
      "这个链接会直接打开设置密码页面。",
      `请立即设置密码：${setupUrl}`,
      "",
      "此链接将在 24 小时后失效。",
    ].join("\n"),
    html: `
      <p>${recipient.displayName}，你好：</p>
      <p>你的轻量工单账户已经创建。</p>
      ${workspaceName ? `<p><strong>工作区：</strong>${workspaceName}</p>` : ""}
      <p><a href="${setupUrl}">打开设置密码页面</a></p>
      <p>此链接将在 24 小时后失效。</p>
    `,
  };
}

function buildLoginCodeEmail({ recipient, code }: LoginCodeEmailInput) {
  if (recipient.locale === "EN") {
    return {
      subject: "Your MiniTickets verification code",
      text: [
        `Hi ${recipient.displayName},`,
        "",
        "Use this verification code to finish signing in to MiniTickets:",
        "",
        code,
        "",
        "This code expires in 10 minutes.",
      ].join("\n"),
      html: `
        <p>Hi ${recipient.displayName},</p>
        <p>Use this verification code to finish signing in to MiniTickets:</p>
        <p style="font-size: 2rem; font-weight: 700; letter-spacing: 0.18em;">${code}</p>
        <p>This code expires in 10 minutes.</p>
      `,
    };
  }

  return {
    subject: "你的轻量工单验证码",
    text: [
      `${recipient.displayName}，你好：`,
      "",
      "请使用以下验证码完成轻量工单登录：",
      "",
      code,
      "",
      "此验证码将在 10 分钟后失效。",
    ].join("\n"),
    html: `
      <p>${recipient.displayName}，你好：</p>
      <p>请使用以下验证码完成轻量工单登录：</p>
      <p style="font-size: 2rem; font-weight: 700; letter-spacing: 0.18em;">${code}</p>
      <p>此验证码将在 10 分钟后失效。</p>
    `,
  };
}

function formatStorage(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function buildTicketEmail({ actorName, commentBody, kind, recipient, ticket }: TicketEmailInput) {
  const ticketUrl = `${getBaseUrl()}/tickets/${ticket.id}`;
  const statusText =
    recipient.locale === "EN" ? ticket.statusLabelEn ?? "Updated" : ticket.statusLabelZh ?? "已更新";
  const parentLineEn =
    ticket.parentTicketNumber && ticket.parentTitle
      ? `Parent: ${ticket.parentTicketNumber} ${ticket.parentTitle}`
      : "";
  const parentLineZh =
    ticket.parentTicketNumber && ticket.parentTitle
      ? `父工单：${ticket.parentTicketNumber} ${ticket.parentTitle}`
      : "";

  if (recipient.locale === "EN") {
    if (kind === "created") {
      return {
        subject: `${ticket.ticketNumber} created`,
        text: [
          `Hi ${recipient.displayName},`,
          "",
          `Your ticket ${ticket.ticketNumber} has been created in ${ticket.workspaceName}.`,
          `Title: ${ticket.title}`,
          parentLineEn,
          `Open: ${ticketUrl}`,
        ]
          .filter(Boolean)
          .join("\n"),
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

    if (kind === "mentioned") {
      return {
        subject: `You were mentioned on ${ticket.ticketNumber}`,
        text: [
          `Hi ${recipient.displayName},`,
          "",
          `${actorName ?? "A teammate"} mentioned you on ${ticket.ticketNumber}.`,
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
        parentLineZh,
        `查看工单：${ticketUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
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

  if (kind === "mentioned") {
    return {
      subject: `${ticket.ticketNumber} 中有人提到了你`,
      text: [
        `${recipient.displayName}，你好：`,
        "",
        `${actorName ?? "有同事"} 在工单 ${ticket.ticketNumber} 中提到了你。`,
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

function buildDiskSpaceAlertEmail({
  recipient,
  freePercent,
  freeBytes,
  totalBytes,
  thresholdPercent,
}: DiskSpaceAlertEmailInput) {
  const settingsUrl = `${getBaseUrl()}/settings`;
  const freePercentText = `${freePercent.toFixed(1)}%`;
  const freeText = formatStorage(freeBytes);
  const totalText = formatStorage(totalBytes);

  if (recipient.locale === "EN") {
    return {
      subject: `MiniTickets disk space warning (${freePercentText} free)`,
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `MiniTickets storage has dropped below the ${thresholdPercent}% free-space threshold.`,
        `Free space: ${freeText} (${freePercentText})`,
        `Total disk size: ${totalText}`,
        `Open Settings: ${settingsUrl}`,
      ].join("\n"),
    };
  }

  return {
    subject: `轻量工单磁盘空间告警（剩余 ${freePercentText}）`,
    text: [
      `${recipient.displayName}，你好：`,
      "",
      `轻量工单所在磁盘空间已低于 ${thresholdPercent}% 的剩余阈值。`,
      `剩余空间：${freeText}（${freePercentText}）`,
      `磁盘总量：${totalText}`,
      `查看设置：${settingsUrl}`,
    ].join("\n"),
  };
}

function buildTicketEventEmail({ event, kind, offsetMinutes, recipient, ticket }: TicketEventEmailInput) {
  const ticketUrl = `${getBaseUrl()}/tickets/${ticket.id}`;
  const scheduledForText = formatEventDate(event.scheduledFor, recipient.locale, recipient.timeZone);
  const reminderText =
    kind === "reminder" ? formatReminderOffsetLabel(offsetMinutes ?? 0, recipient.locale) : null;

  if (recipient.locale === "EN") {
    if (kind === "created") {
      return {
        subject: `Event scheduled for ${ticket.ticketNumber}`,
        text: [
          `Hi ${recipient.displayName},`,
          "",
          `A ticket event has been scheduled for ${ticket.ticketNumber}.`,
          `Event: ${event.title}`,
          `When: ${scheduledForText}`,
          `Workspace: ${ticket.workspaceName}`,
          event.notes ? `Notes: ${event.notes}` : "",
          `Open: ${ticketUrl}`,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    }

    return {
      subject: `Reminder: ${event.title}`,
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `This is your reminder for ${ticket.ticketNumber}.`,
        `Event: ${event.title}`,
        reminderText ? `Reminder: ${reminderText}` : "",
        `When: ${scheduledForText}`,
        event.notes ? `Notes: ${event.notes}` : "",
        `Open: ${ticketUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  if (kind === "created") {
    return {
      subject: `${ticket.ticketNumber} 已安排事件`,
      text: [
        `${recipient.displayName}，你好：`,
        "",
        `工单 ${ticket.ticketNumber} 已安排新的事件。`,
        `事件：${event.title}`,
        `时间：${scheduledForText}`,
        `工作区：${ticket.workspaceName}`,
        event.notes ? `备注：${event.notes}` : "",
        `查看工单：${ticketUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    };
  }

  return {
    subject: `提醒：${event.title}`,
    text: [
      `${recipient.displayName}，你好：`,
      "",
      `这是工单 ${ticket.ticketNumber} 的提醒。`,
      `事件：${event.title}`,
      reminderText ? `提醒时间：${reminderText}` : "",
      `事件时间：${scheduledForText}`,
      event.notes ? `备注：${event.notes}` : "",
      `查看工单：${ticketUrl}`,
    ]
      .filter(Boolean)
      .join("\n"),
  };
}

function buildTicketDueDateReminderEmail({ recipient, ticket }: TicketDueDateReminderEmailInput) {
  const ticketUrl = `${getBaseUrl()}/tickets/${ticket.id}`;
  const dueDateText = formatEventDate(ticket.dueDate, recipient.locale, recipient.timeZone);

  if (recipient.locale === "EN") {
    return {
      subject: `Due today: ${ticket.ticketNumber}`,
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `${ticket.ticketNumber} is due today.`,
        `Title: ${ticket.title}`,
        `Due date: ${dueDateText}`,
        `Workspace: ${ticket.workspaceName}`,
        `Open: ${ticketUrl}`,
      ].join("\n"),
    };
  }

  return {
    subject: `今日到期：${ticket.ticketNumber}`,
    text: [
      `${recipient.displayName}，你好：`,
      "",
      `工单 ${ticket.ticketNumber} 今天到期。`,
      `标题：${ticket.title}`,
      `截止日期：${dueDateText}`,
      `工作区：${ticket.workspaceName}`,
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

export async function sendLoginCodeEmail(input: LoginCodeEmailInput) {
  const message = buildLoginCodeEmail(input);
  return sendViaResend(input.recipient.email, message.subject, message.text, message.html);
}

export async function sendTicketEmail(input: TicketEmailInput) {
  const message = buildTicketEmail(input);
  return sendViaResend(input.recipient.email, message.subject, message.text);
}

export async function sendTicketEventEmail(input: TicketEventEmailInput) {
  const message = buildTicketEventEmail(input);
  return sendViaResend(input.recipient.email, message.subject, message.text);
}

export async function sendTicketDueDateReminderEmail(input: TicketDueDateReminderEmailInput) {
  const message = buildTicketDueDateReminderEmail(input);
  return sendViaResend(input.recipient.email, message.subject, message.text);
}

export async function sendDiskSpaceAlertEmail(input: DiskSpaceAlertEmailInput) {
  const message = buildDiskSpaceAlertEmail(input);
  return sendViaResend(input.recipient.email, message.subject, message.text);
}
