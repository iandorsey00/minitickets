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
    dueDate?: Date;
  };
  actorName?: string;
  commentBody?: string;
  attachDueDateInvite?: boolean;
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
    id?: string;
    title: string;
    notes?: string;
    scheduledFor: Date;
  };
  offsetMinutes?: number;
  attachCalendarInvite?: boolean;
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
  attachCalendarInvite?: boolean;
};

type TicketDueDateInviteEmailInput = {
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

type MailAttachment = {
  filename: string;
  content: string;
  type?: string;
};

type BuiltEmail = {
  subject: string;
  text: string;
  html?: string;
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

function formatCalendarDate(date: Date, locale: Locale) {
  return new Intl.DateTimeFormat(localeTokenMap[locale], {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function formatIcsDateTime(date: Date) {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
}

function formatIcsDateOnly(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function escapeIcsText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

function toBase64(value: string) {
  return Buffer.from(value, "utf8").toString("base64");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function nl2br(value: string) {
  return escapeHtml(value).replace(/\r?\n/g, "<br />");
}

function renderEmailLayout({
  locale,
  title,
  intro,
  details = [],
  body,
  ctaLabel,
  ctaUrl,
  footnote,
}: {
  locale: Locale;
  title: string;
  intro: string;
  details?: Array<{ label: string; value: string }>;
  body?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footnote?: string;
}) {
  const brand = locale === "EN" ? "MiniTickets" : "轻量工单";
  const detailsHtml = details.length
    ? `
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin: 20px 0 0; border-collapse: collapse;">
        ${details
          .map(
            (detail) => `
              <tr>
                <td style="padding: 10px 0 2px; color: #697586; font-size: 13px; vertical-align: top;">${escapeHtml(detail.label)}</td>
              </tr>
              <tr>
                <td style="padding: 0 0 10px; color: #101828; font-size: 15px; line-height: 1.5; border-bottom: 1px solid #eaecf0;">${nl2br(detail.value)}</td>
              </tr>
            `,
          )
          .join("")}
      </table>
    `
    : "";

  const bodyHtml = body
    ? `<div style="margin-top: 18px; padding: 14px 16px; border-radius: 16px; background: #f8fafc; color: #334155; font-size: 14px; line-height: 1.65; white-space: normal;">${body}</div>`
    : "";

  const ctaHtml =
    ctaLabel && ctaUrl
      ? `
        <div style="margin-top: 24px;">
          <a href="${escapeHtml(ctaUrl)}" style="display: inline-block; padding: 12px 18px; border-radius: 999px; background: #2563eb; color: #ffffff; text-decoration: none; font-weight: 700; font-size: 14px;">
            ${escapeHtml(ctaLabel)}
          </a>
        </div>
      `
      : "";

  const footnoteHtml = footnote
    ? `<p style="margin: 22px 0 0; color: #697586; font-size: 12px; line-height: 1.6;">${nl2br(footnote)}</p>`
    : "";

  return `<!doctype html>
<html lang="${locale === "EN" ? "en" : "zh-CN"}">
  <body style="margin: 0; padding: 0; background: transparent; color: #101828;">
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="padding: 24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 620px; border-collapse: collapse;">
            <tr>
              <td style="padding: 0 0 14px; color: #2563eb; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 14px; font-weight: 700; letter-spacing: 0.02em;">
                ${escapeHtml(brand)}
              </td>
            </tr>
            <tr>
              <td style="background: #ffffff; border: 1px solid #e5e7eb; border-radius: 28px; padding: 28px 28px 24px; box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);">
                <h1 style="margin: 0; font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 28px; line-height: 1.1; letter-spacing: -0.04em; color: #101828;">
                  ${escapeHtml(title)}
                </h1>
                <p style="margin: 16px 0 0; color: #475467; font-size: 15px; line-height: 1.7;">
                  ${nl2br(intro)}
                </p>
                ${detailsHtml}
                ${bodyHtml}
                ${ctaHtml}
                ${footnoteHtml}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function buildEventInviteAttachment({
  locale,
  ticket,
  event,
}: {
  locale: Locale;
  ticket: TicketEventEmailInput["ticket"];
  event: TicketEventEmailInput["event"];
}): MailAttachment {
  const url = `${getBaseUrl()}/tickets/${ticket.id}`;
  const uid = `${event.id ?? `event-${ticket.id}-${formatIcsDateTime(event.scheduledFor)}`}@minitickets`;
  const nowStamp = formatIcsDateTime(new Date());
  const startStamp = formatIcsDateTime(event.scheduledFor);
  const endStamp = formatIcsDateTime(new Date(event.scheduledFor.getTime() + 60 * 60 * 1000));
  const description =
    locale === "EN"
      ? [
          `Ticket: ${ticket.ticketNumber}`,
          `Title: ${ticket.title}`,
          `Event: ${event.title}`,
          `Workspace: ${ticket.workspaceName}`,
          event.notes ? `Notes: ${event.notes}` : "",
          `Open: ${url}`,
        ]
          .filter(Boolean)
          .join("\n")
      : [
          `工单：${ticket.ticketNumber}`,
          `标题：${ticket.title}`,
          `事件：${event.title}`,
          `工作区：${ticket.workspaceName}`,
          event.notes ? `备注：${event.notes}` : "",
          `查看工单：${url}`,
        ]
          .filter(Boolean)
          .join("\n");
  const summary =
    locale === "EN"
      ? `${ticket.ticketNumber} · ${ticket.title} · ${event.title}`
      : `${ticket.ticketNumber} · ${ticket.title} · ${event.title}`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MiniTickets//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART:${startStamp}`,
    `DTEND:${endStamp}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${escapeIcsText(url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return {
    filename: `${ticket.ticketNumber}-${event.title}`.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-") + ".ics",
    content: toBase64(ics),
    type: "text/calendar; charset=utf-8",
  };
}

function buildDueDateInviteAttachment({
  locale,
  ticket,
}: {
  locale: Locale;
  ticket: { id: string; ticketNumber: string; title: string; workspaceName: string; dueDate: Date };
}): MailAttachment {
  const url = `${getBaseUrl()}/tickets/${ticket.id}`;
  const uid = `due-${ticket.id}-${formatIcsDateOnly(ticket.dueDate)}@minitickets`;
  const nowStamp = formatIcsDateTime(new Date());
  const startDate = formatIcsDateOnly(ticket.dueDate);
  const nextDay = new Date(ticket.dueDate.getTime() + 24 * 60 * 60 * 1000);
  const endDate = formatIcsDateOnly(nextDay);
  const description =
    locale === "EN"
      ? [
          `Ticket: ${ticket.ticketNumber}`,
          `Title: ${ticket.title}`,
          `Due date: ${formatCalendarDate(ticket.dueDate, locale)}`,
          `Workspace: ${ticket.workspaceName}`,
          `Open: ${url}`,
        ].join("\n")
      : [
          `工单：${ticket.ticketNumber}`,
          `标题：${ticket.title}`,
          `截止日期：${formatCalendarDate(ticket.dueDate, locale)}`,
          `工作区：${ticket.workspaceName}`,
          `查看工单：${url}`,
        ].join("\n");
  const summary =
    locale === "EN"
      ? `${ticket.ticketNumber} · ${ticket.title} · Due date`
      : `${ticket.ticketNumber} · ${ticket.title} · 截止日期`;

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MiniTickets//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${nowStamp}`,
    `DTSTART;VALUE=DATE:${startDate}`,
    `DTEND;VALUE=DATE:${endDate}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${escapeIcsText(url)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  return {
    filename: `${ticket.ticketNumber}-due-date.ics`,
    content: toBase64(ics),
    type: "text/calendar; charset=utf-8",
  };
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
      html: renderEmailLayout({
        locale,
        title: "Welcome to MiniTickets",
        intro: `Hi ${displayName},\n\nYour MiniTickets admin account is ready.`,
        details: [
          { label: "Email", value: userEmail },
          { label: "Temporary password", value: password },
        ],
        ctaLabel: "Sign in to MiniTickets",
        ctaUrl: loginUrl,
        footnote: "Please sign in and change your password in Settings.",
      }),
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
    html: renderEmailLayout({
      locale,
      title: "欢迎使用轻量工单",
      intro: `${displayName}，你好：\n\n你的轻量工单管理员账户已经创建完成。`,
      details: [
        { label: "邮箱", value: userEmail },
        { label: "临时密码", value: password },
      ],
      ctaLabel: "登录轻量工单",
      ctaUrl: loginUrl,
      footnote: "请先登录，并在“设置”中修改密码。",
    }),
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
      html: renderEmailLayout({
        locale: recipient.locale,
        title: "Set your password",
        intro: `Hi ${recipient.displayName},\n\nYour MiniTickets account has been created.`,
        details: workspaceName ? [{ label: "Workspace", value: workspaceName }] : [],
        ctaLabel: "Open the password setup screen",
        ctaUrl: setupUrl,
        footnote: "This link expires in 24 hours.",
      }),
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
    html: renderEmailLayout({
      locale: recipient.locale,
      title: "设置你的密码",
      intro: `${recipient.displayName}，你好：\n\n你的轻量工单账户已经创建。`,
      details: workspaceName ? [{ label: "工作区", value: workspaceName }] : [],
      ctaLabel: "打开设置密码页面",
      ctaUrl: setupUrl,
      footnote: "此链接将在 24 小时后失效。",
    }),
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
      html: renderEmailLayout({
        locale: recipient.locale,
        title: "Your verification code",
        intro: `Hi ${recipient.displayName},\n\nUse this verification code to finish signing in to MiniTickets.`,
        body: `<div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 32px; font-weight: 800; letter-spacing: 0.18em; color: #101828;">${escapeHtml(code)}</div>`,
        footnote: "This code expires in 10 minutes.",
      }),
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
    html: renderEmailLayout({
      locale: recipient.locale,
      title: "你的验证码",
      intro: `${recipient.displayName}，你好：\n\n请使用以下验证码完成轻量工单登录。`,
      body: `<div style="font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 32px; font-weight: 800; letter-spacing: 0.18em; color: #101828;">${escapeHtml(code)}</div>`,
      footnote: "此验证码将在 10 分钟后失效。",
    }),
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

function buildTicketEmail({ actorName, commentBody, kind, recipient, ticket }: TicketEmailInput): BuiltEmail {
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
        html: renderEmailLayout({
          locale: recipient.locale,
          title: `${ticket.ticketNumber} created`,
          intro: `Hi ${recipient.displayName},\n\nYour ticket has been created in ${ticket.workspaceName}.`,
          details: [
            { label: "Ticket", value: ticket.ticketNumber },
            { label: "Title", value: ticket.title },
            ...(parentLineEn ? [{ label: "Parent", value: `${ticket.parentTicketNumber} ${ticket.parentTitle}` }] : []),
          ],
          ctaLabel: "Open ticket",
          ctaUrl: ticketUrl,
        }),
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
        html: renderEmailLayout({
          locale: recipient.locale,
          title: `${ticket.ticketNumber} assigned to you`,
          intro: `Hi ${recipient.displayName},\n\n${actorName ?? "A teammate"} assigned this ticket to you.`,
          details: [
            { label: "Ticket", value: ticket.ticketNumber },
            { label: "Title", value: ticket.title },
          ],
          ctaLabel: "Open ticket",
          ctaUrl: ticketUrl,
        }),
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
        html: renderEmailLayout({
          locale: recipient.locale,
          title: `New comment on ${ticket.ticketNumber}`,
          intro: `Hi ${recipient.displayName},\n\n${actorName ?? "A teammate"} added a comment.`,
          details: [
            { label: "Ticket", value: ticket.ticketNumber },
            { label: "Title", value: ticket.title },
          ],
          body: commentBody ? nl2br(commentBody) : undefined,
          ctaLabel: "Open ticket",
          ctaUrl: ticketUrl,
        }),
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
        html: renderEmailLayout({
          locale: recipient.locale,
          title: `You were mentioned on ${ticket.ticketNumber}`,
          intro: `Hi ${recipient.displayName},\n\n${actorName ?? "A teammate"} mentioned you in a comment.`,
          details: [
            { label: "Ticket", value: ticket.ticketNumber },
            { label: "Title", value: ticket.title },
          ],
          body: commentBody ? nl2br(commentBody) : undefined,
          ctaLabel: "Open ticket",
          ctaUrl: ticketUrl,
        }),
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
      html: renderEmailLayout({
        locale: recipient.locale,
        title: `${ticket.ticketNumber} marked ${statusText}`,
        intro: `Hi ${recipient.displayName},\n\n${actorName ?? "A teammate"} updated this ticket.`,
        details: [
          { label: "Ticket", value: ticket.ticketNumber },
          { label: "Title", value: ticket.title },
          { label: "Status", value: statusText },
        ],
        ctaLabel: "Open ticket",
        ctaUrl: ticketUrl,
      }),
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
      html: renderEmailLayout({
        locale: recipient.locale,
        title: `${ticket.ticketNumber} 已创建`,
        intro: `${recipient.displayName}，你好：\n\n你的工单已在「${ticket.workspaceName}」中创建。`,
        details: [
          { label: "工单", value: ticket.ticketNumber },
          { label: "标题", value: ticket.title },
          ...(parentLineZh ? [{ label: "父工单", value: `${ticket.parentTicketNumber} ${ticket.parentTitle}` }] : []),
        ],
        ctaLabel: "查看工单",
        ctaUrl: ticketUrl,
      }),
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
      html: renderEmailLayout({
        locale: recipient.locale,
        title: `${ticket.ticketNumber} 已分配给你`,
        intro: `${recipient.displayName}，你好：\n\n${actorName ?? "有同事"} 已将这个工单分配给你。`,
        details: [
          { label: "工单", value: ticket.ticketNumber },
          { label: "标题", value: ticket.title },
        ],
        ctaLabel: "查看工单",
        ctaUrl: ticketUrl,
      }),
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
      html: renderEmailLayout({
        locale: recipient.locale,
        title: `${ticket.ticketNumber} 有新评论`,
        intro: `${recipient.displayName}，你好：\n\n${actorName ?? "有同事"} 添加了评论。`,
        details: [
          { label: "工单", value: ticket.ticketNumber },
          { label: "标题", value: ticket.title },
        ],
        body: commentBody ? nl2br(commentBody) : undefined,
        ctaLabel: "查看工单",
        ctaUrl: ticketUrl,
      }),
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
      html: renderEmailLayout({
        locale: recipient.locale,
        title: `${ticket.ticketNumber} 中有人提到了你`,
        intro: `${recipient.displayName}，你好：\n\n${actorName ?? "有同事"} 在评论中提到了你。`,
        details: [
          { label: "工单", value: ticket.ticketNumber },
          { label: "标题", value: ticket.title },
        ],
        body: commentBody ? nl2br(commentBody) : undefined,
        ctaLabel: "查看工单",
        ctaUrl: ticketUrl,
      }),
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
    html: renderEmailLayout({
      locale: recipient.locale,
      title: `${ticket.ticketNumber} 已更新`,
      intro: `${recipient.displayName}，你好：\n\n${actorName ?? "有同事"} 更新了工单状态。`,
      details: [
        { label: "工单", value: ticket.ticketNumber },
        { label: "标题", value: ticket.title },
        { label: "状态", value: statusText },
      ],
      ctaLabel: "查看工单",
      ctaUrl: ticketUrl,
    }),
  };
}

function buildDiskSpaceAlertEmail({
  recipient,
  freePercent,
  freeBytes,
  totalBytes,
  thresholdPercent,
}: DiskSpaceAlertEmailInput): BuiltEmail {
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
      html: renderEmailLayout({
        locale: recipient.locale,
        title: "Disk space warning",
        intro: `Hi ${recipient.displayName},\n\nMiniTickets storage has dropped below the ${thresholdPercent}% free-space threshold.`,
        details: [
          { label: "Free space", value: `${freeText} (${freePercentText})` },
          { label: "Total disk size", value: totalText },
        ],
        ctaLabel: "Open Settings",
        ctaUrl: settingsUrl,
      }),
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
    html: renderEmailLayout({
      locale: recipient.locale,
      title: "磁盘空间告警",
      intro: `${recipient.displayName}，你好：\n\n轻量工单所在磁盘空间已低于 ${thresholdPercent}% 的剩余阈值。`,
      details: [
        { label: "剩余空间", value: `${freeText}（${freePercentText}）` },
        { label: "磁盘总量", value: totalText },
      ],
      ctaLabel: "查看设置",
      ctaUrl: settingsUrl,
    }),
  };
}

function buildTicketEventEmail({ event, kind, offsetMinutes, recipient, ticket }: TicketEventEmailInput): BuiltEmail {
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
        html: renderEmailLayout({
          locale: recipient.locale,
          title: `Event scheduled for ${ticket.ticketNumber}`,
          intro: `Hi ${recipient.displayName},\n\nA ticket event has been scheduled.`,
          details: [
            { label: "Ticket", value: `${ticket.ticketNumber} · ${ticket.title}` },
            { label: "Event", value: event.title },
            { label: "When", value: scheduledForText },
            { label: "Workspace", value: ticket.workspaceName },
          ],
          body: event.notes ? nl2br(event.notes) : undefined,
          ctaLabel: "Open ticket",
          ctaUrl: ticketUrl,
        }),
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
      html: renderEmailLayout({
        locale: recipient.locale,
        title: `Reminder: ${event.title}`,
        intro: `Hi ${recipient.displayName},\n\nThis is your reminder for ${ticket.ticketNumber}.`,
        details: [
          { label: "Event", value: event.title },
          ...(reminderText ? [{ label: "Reminder", value: reminderText }] : []),
          { label: "When", value: scheduledForText },
        ],
        body: event.notes ? nl2br(event.notes) : undefined,
        ctaLabel: "Open ticket",
        ctaUrl: ticketUrl,
      }),
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
      html: renderEmailLayout({
        locale: recipient.locale,
        title: `${ticket.ticketNumber} 已安排事件`,
        intro: `${recipient.displayName}，你好：\n\n工单已安排新的事件。`,
        details: [
          { label: "工单", value: `${ticket.ticketNumber} · ${ticket.title}` },
          { label: "事件", value: event.title },
          { label: "时间", value: scheduledForText },
          { label: "工作区", value: ticket.workspaceName },
        ],
        body: event.notes ? nl2br(event.notes) : undefined,
        ctaLabel: "查看工单",
        ctaUrl: ticketUrl,
      }),
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
    html: renderEmailLayout({
      locale: recipient.locale,
      title: `提醒：${event.title}`,
      intro: `${recipient.displayName}，你好：\n\n这是工单 ${ticket.ticketNumber} 的提醒。`,
      details: [
        { label: "事件", value: event.title },
        ...(reminderText ? [{ label: "提醒时间", value: reminderText }] : []),
        { label: "事件时间", value: scheduledForText },
      ],
      body: event.notes ? nl2br(event.notes) : undefined,
      ctaLabel: "查看工单",
      ctaUrl: ticketUrl,
    }),
  };
}

function buildTicketDueDateReminderEmail({ recipient, ticket }: TicketDueDateReminderEmailInput): BuiltEmail {
  const ticketUrl = `${getBaseUrl()}/tickets/${ticket.id}`;
  const dueDateText = formatCalendarDate(ticket.dueDate, recipient.locale);

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
      html: renderEmailLayout({
        locale: recipient.locale,
        title: `Due today: ${ticket.ticketNumber}`,
        intro: `Hi ${recipient.displayName},\n\nThis ticket is due today.`,
        details: [
          { label: "Title", value: ticket.title },
          { label: "Due date", value: dueDateText },
          { label: "Workspace", value: ticket.workspaceName },
        ],
        ctaLabel: "Open ticket",
        ctaUrl: ticketUrl,
      }),
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
    html: renderEmailLayout({
      locale: recipient.locale,
      title: `今日到期：${ticket.ticketNumber}`,
      intro: `${recipient.displayName}，你好：\n\n这个工单今天到期。`,
      details: [
        { label: "标题", value: ticket.title },
        { label: "截止日期", value: dueDateText },
        { label: "工作区", value: ticket.workspaceName },
      ],
      ctaLabel: "查看工单",
      ctaUrl: ticketUrl,
    }),
  };
}

function buildTicketDueDateInviteEmail({ recipient, ticket }: TicketDueDateInviteEmailInput): BuiltEmail {
  const ticketUrl = `${getBaseUrl()}/tickets/${ticket.id}`;
  const dueDateText = formatCalendarDate(ticket.dueDate, recipient.locale);

  if (recipient.locale === "EN") {
    return {
      subject: `Calendar invite: ${ticket.ticketNumber} due date`,
      text: [
        `Hi ${recipient.displayName},`,
        "",
        `Here is the calendar invite for the due date on ${ticket.ticketNumber}.`,
        `Title: ${ticket.title}`,
        `Due date: ${dueDateText}`,
        `Workspace: ${ticket.workspaceName}`,
        `Open: ${ticketUrl}`,
      ].join("\n"),
      html: renderEmailLayout({
        locale: recipient.locale,
        title: "Due-date calendar invite",
        intro: `Hi ${recipient.displayName},\n\nHere is the calendar invite for this ticket due date.`,
        details: [
          { label: "Ticket", value: `${ticket.ticketNumber} · ${ticket.title}` },
          { label: "Due date", value: dueDateText },
          { label: "Workspace", value: ticket.workspaceName },
        ],
        ctaLabel: "Open ticket",
        ctaUrl: ticketUrl,
      }),
    };
  }

  return {
    subject: `日历邀请：${ticket.ticketNumber} 截止日期`,
    text: [
      `${recipient.displayName}，你好：`,
      "",
      `这是工单 ${ticket.ticketNumber} 的截止日期日历邀请。`,
      `标题：${ticket.title}`,
      `截止日期：${dueDateText}`,
      `工作区：${ticket.workspaceName}`,
      `查看工单：${ticketUrl}`,
    ].join("\n"),
    html: renderEmailLayout({
      locale: recipient.locale,
      title: "截止日期日历邀请",
      intro: `${recipient.displayName}，你好：\n\n这是这个工单的截止日期日历邀请。`,
      details: [
        { label: "工单", value: `${ticket.ticketNumber} · ${ticket.title}` },
        { label: "截止日期", value: dueDateText },
        { label: "工作区", value: ticket.workspaceName },
      ],
      ctaLabel: "查看工单",
      ctaUrl: ticketUrl,
    }),
  };
}

async function sendViaResend(to: string, subject: string, text: string, html?: string, attachments?: MailAttachment[]) {
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
      attachments,
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
  const attachments =
    input.kind === "created" && input.attachDueDateInvite && input.ticket.dueDate
      ? [buildDueDateInviteAttachment({
          locale: input.recipient.locale,
          ticket: {
            id: input.ticket.id,
            ticketNumber: input.ticket.ticketNumber,
            title: input.ticket.title,
            workspaceName: input.ticket.workspaceName,
            dueDate: input.ticket.dueDate,
          },
        })]
      : undefined;
  return sendViaResend(input.recipient.email, message.subject, message.text, message.html, attachments);
}

export async function sendTicketEventEmail(input: TicketEventEmailInput) {
  const message = buildTicketEventEmail(input);
  const attachments =
    input.kind === "created" && input.attachCalendarInvite
      ? [buildEventInviteAttachment({
          locale: input.recipient.locale,
          ticket: input.ticket,
          event: input.event,
        })]
      : undefined;
  return sendViaResend(input.recipient.email, message.subject, message.text, message.html, attachments);
}

export async function sendTicketDueDateReminderEmail(input: TicketDueDateReminderEmailInput) {
  const message = buildTicketDueDateReminderEmail(input);
  const attachments =
    input.attachCalendarInvite ? [buildDueDateInviteAttachment({ locale: input.recipient.locale, ticket: input.ticket })] : undefined;
  return sendViaResend(input.recipient.email, message.subject, message.text, message.html, attachments);
}

export async function sendTicketDueDateInviteEmail(input: TicketDueDateInviteEmailInput) {
  const message = buildTicketDueDateInviteEmail(input);
  const attachments = [buildDueDateInviteAttachment({ locale: input.recipient.locale, ticket: input.ticket })];
  return sendViaResend(input.recipient.email, message.subject, message.text, message.html, attachments);
}

export async function sendDiskSpaceAlertEmail(input: DiskSpaceAlertEmailInput) {
  const message = buildDiskSpaceAlertEmail(input);
  return sendViaResend(input.recipient.email, message.subject, message.text, message.html);
}
