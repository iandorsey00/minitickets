import Link from "next/link";
import type { Metadata } from "next";
import type { ReactNode } from "react";

import { addAttachmentAction, addCommentAction, createTicketEventAction, deleteTicketEventAction, reopenTicketAction, sendDueDateInviteAction, updateTicketAction, updateTicketEventAction } from "@/lib/actions";
import { getTicketDetail } from "@/lib/data";
import { formatDate, formatDateTime, formatFileSize, localizeDefinition } from "@/lib/format";
import { formatReminderOffsetLabel } from "@/lib/reminder-labels";
import { defaultTicketEventReminderOffsets } from "@/lib/ticket-events";
import { MAX_ATTACHMENT_SIZE_BYTES, canRenderInline, getTicketAttachmentUrl } from "@/lib/uploads";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ChildTicketIcon, CommentIcon, DocumentIcon, UploadIcon } from "@/components/icons";
import { FilePicker } from "@/components/file-picker";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui";
import { TicketEventForm } from "@/components/ticket-event-form";
import { TicketShareMenu } from "@/components/ticket-share-menu";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}): Promise<Metadata> {
  const user = await getCurrentUser();

  if (!user) {
    return { title: "Ticket" };
  }

  const { ticketId } = await params;
  const ticket = await prisma.ticket.findUnique({
    where: { id: ticketId },
    select: {
      ticketNumber: true,
      workspaceId: true,
    },
  });

  if (!ticket) {
    return { title: "Ticket" };
  }

  if (user.role !== "ADMIN") {
    const membership = await prisma.workspaceMembership.findFirst({
      where: {
        userId: user.id,
        workspaceId: ticket.workspaceId,
      },
      select: { id: true },
    });

    if (!membership) {
      return { title: "Ticket" };
    }
  }

  return {
    title: ticket.ticketNumber,
  };
}

function linkifyCommentBody(body: string): ReactNode[] {
  const parts = body.split(/(https?:\/\/[^\s<]+)/giu);

  return parts.map((part, index) => {
    if (!/^https?:\/\//iu.test(part)) {
      return part;
    }

    return (
      <a key={`${part}-${index}`} href={part} target="_blank" rel="noreferrer" className="comment-link">
        {part}
      </a>
    );
  });
}

export default async function TicketDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ ticketId: string }>;
  searchParams: Promise<{ upload?: string; closed?: string; saved?: string; comment?: string }>;
}) {
  const { ticketId } = await params;
  const query = await searchParams;
  const data = await getTicketDetail(ticketId);

  if (!data) {
    return <div />;
  }

  const t = data.dictionary;
  const uploadMessage =
    query.upload === "size"
      ? { tone: "danger" as const, label: t.common.uploadTooLarge }
      : query.upload === "success"
        ? { tone: "success" as const, label: t.common.uploadSuccess }
        : null;
  const savedMessage = query.saved === "1" ? { tone: "success" as const, label: t.common.savedChanges } : null;
  const closedMessage = query.closed === "1" ? { tone: "warning" as const, label: t.tickets.closedReadOnly } : null;
  const commentMessage =
    query.comment === "too_long"
      ? { tone: "danger" as const, label: t.tickets.commentTooLong }
      : query.comment === "invalid"
        ? { tone: "danger" as const, label: t.tickets.commentInvalid }
        : null;
  const isClosed = data.ticket.status.key === "CLOSED";
  const canCreateChildTicket = !isClosed && !data.ticket.parentTicketId;
  const ticketContext = (
    <div className="edit-context">
      <div className="edit-context-copy">
        <strong>{data.ticket.title}</strong>
        <span>{data.ticket.ticketNumber}</span>
      </div>
      <Badge label={localizeDefinition(data.ticket.status, data.locale)} tone="accent" />
    </div>
  );
  const selectedPaymentMethodIds = new Set(data.ticket.paymentMethods.map((item) => item.paymentMethodId));
  const defaultDueDateInviteRecipientIds = Array.from(
    new Set([data.ticket.requester.id, data.ticket.assignee?.id].filter((value): value is string => Boolean(value))),
  );
  const showEventsOpenByDefault = data.ticket.events.length > 0;
  const showChildrenOpenByDefault = data.ticket.childTickets.length > 0 || Boolean(data.ticket.parentTicket);
  const descriptionPreview = data.ticket.description ? data.ticket.description.replace(/\s+/g, " ").slice(0, 80) : "";
  const eventsPreview = data.ticket.events.length
    ? `${data.ticket.events.length} · ${data.ticket.events[0].title} · ${formatDateTime(data.ticket.events[0].scheduledFor, data.localeCode, data.timeZone)}`
    : "";
  const childrenPreview = data.ticket.parentTicket
    ? `${t.common.parentTicket} · ${data.ticket.parentTicket.ticketNumber}`
    : data.ticket.childTickets.length
      ? `${t.common.childTickets} · ${data.ticket.childTickets.length}`
      : "";
  const historyItems = [
    ...data.ticket.activities
      .filter((activity) => !["ticket.comment_added", "ticket.attachment_added"].includes(activity.eventType))
      .map((activity) => ({
        id: `activity-${activity.id}`,
        createdAt: activity.createdAt,
        kind: "activity" as const,
        actorName: activity.actor?.displayName ?? (data.locale === "ZH_CN" ? "系统" : "System"),
        title: data.locale === "ZH_CN" ? activity.messageZh : activity.messageEn,
      })),
    ...data.ticket.comments.map((comment) => ({
      id: `comment-${comment.id}`,
      createdAt: comment.createdAt,
      kind: "comment" as const,
      actorName: comment.author.displayName,
      body: comment.body,
    })),
    ...data.ticket.attachments.map((attachment) => ({
      id: `attachment-${attachment.id}`,
      createdAt: attachment.createdAt,
      kind: "attachment" as const,
      actorName: attachment.uploadedBy.displayName,
      originalName: attachment.originalName,
      filePath: getTicketAttachmentUrl(data.ticket.id, attachment.storedName),
      fileSizeBytes: attachment.fileSizeBytes,
      mimeType: attachment.mimeType,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const ticketUrl = `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/+$/, "")}/tickets/${data.ticket.id}`;
  const titleExport = `${data.ticket.ticketNumber} ${data.ticket.title}\n${ticketUrl}`;
  const summaryLines = [
    `${data.ticket.ticketNumber} ${data.ticket.title}`,
    `${t.common.workspace}：${data.ticket.workspace.name}`,
    `${t.common.status}：${localizeDefinition(data.ticket.status, data.locale)}`,
    `${t.common.assignee}：${data.ticket.assignee?.displayName ?? t.common.none}`,
    `${t.common.updatedAt}：${formatDateTime(data.ticket.updatedAt, data.localeCode, data.timeZone)}`,
    ticketUrl,
  ];
  const threadLines = [
    ...summaryLines,
    "",
    ...historyItems.flatMap((item) => {
      const timestamp = formatDateTime(item.createdAt, data.localeCode, data.timeZone);
      if (item.kind === "activity") {
        return [`${timestamp} · ${item.actorName}`, item.title, ""];
      }
      if (item.kind === "comment") {
        return [`${timestamp} · ${item.actorName}`, item.body, ""];
      }
      return [
        `${timestamp} · ${item.actorName}`,
        `${t.common.attachments}：${item.originalName} (${formatFileSize(item.fileSizeBytes)})`,
        item.filePath,
        "",
      ];
    }),
  ];

  return (
    <>
      <PageHeader
        title={data.ticket.title}
        subtitle={`${data.ticket.ticketNumber} · ${data.ticket.workspace.name}`}
        action={
          <TicketShareMenu
            label={t.common.share}
            copiedLabel={t.common.copied}
            copyTitleLabel={t.common.copyTicketTitle}
            copySummaryLabel={t.common.copyTicketSummary}
            copyThreadLabel={t.common.copyTicketThread}
            titleText={titleExport}
            summaryText={summaryLines.join("\n")}
            threadText={threadLines.join("\n")}
          />
        }
      />

      <div className="detail-layout">
        <div className="stack ticket-page-section-stack">
          {savedMessage ? <Badge label={savedMessage.label} tone={savedMessage.tone} /> : null}
          {data.ticket.description && !isClosed ? (
            <details className="panel detail-disclosure">
              <summary className="panel-title detail-summary">
                <span className="detail-summary-copy">
                  <span className="detail-summary-main">{t.common.description}</span>
                  <span className="detail-summary-preview">{descriptionPreview}</span>
                </span>
                <span
                  className="detail-summary-toggle"
                  data-closed-label={t.common.expand}
                  data-open-label={t.common.collapse}
                />
              </summary>
              <form action={updateTicketAction} className="stack disclosure-body">
                <input type="hidden" name="ticketId" value={data.ticket.id} />
                <div className="field">
                  <label htmlFor="description-inline" className="sr-only">
                    {t.common.description}
                  </label>
                  <textarea
                    id="description-inline"
                    name="description"
                    defaultValue={data.ticket.description}
                    placeholder={t.common.description}
                  />
                </div>
                <div>
                  <button type="submit">{t.common.save}</button>
                </div>
              </form>
            </details>
          ) : null}

          <Panel title={t.common.activity}>
            {closedMessage ? <Badge label={closedMessage.label} tone={closedMessage.tone} /> : null}
            <div className="timeline">
              {historyItems.length ? (
                historyItems.map((item) => (
                  <div key={item.id} className="timeline-item">
                    {item.kind === "activity" ? <strong>{item.title}</strong> : null}
                    {item.kind === "comment" ? (
                      <>
                        <strong>{item.actorName}</strong>
                        <div className="comment-body">{linkifyCommentBody(item.body)}</div>
                      </>
                    ) : null}
                    {item.kind === "attachment" ? (
                      <>
                        <strong>
                          <a href={item.filePath} target="_blank" rel="noreferrer">
                            {item.originalName}
                          </a>
                        </strong>
                        {canRenderInline(item.mimeType) && item.mimeType?.startsWith("image/") ? (
                          <a href={item.filePath} target="_blank" rel="noreferrer" className="attachment-preview-link">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={item.filePath} alt={item.originalName} className="attachment-preview" />
                          </a>
                        ) : (
                          <a href={item.filePath} target="_blank" rel="noreferrer" className="document-preview-card">
                            <DocumentIcon className="document-preview-icon" />
                            <span>{item.originalName}</span>
                          </a>
                        )}
                        <div className="muted">{formatFileSize(item.fileSizeBytes)}</div>
                      </>
                    ) : null}
                    <div className="muted">
                      {item.actorName} · {formatDateTime(item.createdAt, data.localeCode, data.timeZone)}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title={t.common.activity} body={t.states.emptySearch} />
              )}
            </div>

            {!isClosed ? (
              <>
                <form action={addCommentAction} className="stack ticket-subsection">
                  <input type="hidden" name="ticketId" value={data.ticket.id} />
                  <div className="ticket-subsection-header">
                    <div className="ticket-section-heading">
                      <CommentIcon className="inline-icon" />
                      <span>{t.tickets.addComment}</span>
                    </div>
                    {ticketContext}
                  </div>
                  {commentMessage ? <Badge label={commentMessage.label} tone={commentMessage.tone} /> : null}
                  <div className="field">
                    <label htmlFor="body" className="sr-only">
                      {t.tickets.addComment}
                    </label>
                    <textarea id="body" name="body" placeholder={t.tickets.commentPlaceholder} required maxLength={10000} />
                    <p className="caution-text">
                      {t.tickets.confidentialityNotice} <span className="muted">{t.tickets.commentLimitHint}</span>
                    </p>
                  </div>
                  <div>
                    <button type="submit">
                      <span className="button-content">
                        <CommentIcon className="button-icon" />
                        <span>{t.tickets.addComment}</span>
                      </span>
                    </button>
                  </div>
                </form>
                <form action={addAttachmentAction} className="stack ticket-subsection" encType="multipart/form-data">
                  <input type="hidden" name="ticketId" value={data.ticket.id} />
                  <div className="ticket-subsection-header">
                    <div className="ticket-section-heading">
                      <UploadIcon className="inline-icon" />
                      <span>{t.common.uploadFile}</span>
                    </div>
                    {ticketContext}
                  </div>
                  {uploadMessage ? <Badge label={uploadMessage.label} tone={uploadMessage.tone} /> : null}
                  <div className="field">
                    <label htmlFor="file" className="sr-only">
                      {t.common.uploadFile}
                    </label>
                    <FilePicker
                      name="file"
                      label={t.common.chooseFile}
                      emptyLabel={t.common.noFileSelected}
                      dropLabel={t.common.dragAndDropFile}
                      required
                    />
                    <p className="warning-text">{t.common.uploadWarning}</p>
                    <p className="muted">{t.common.uploadMaxSize.replace("{size}", formatFileSize(MAX_ATTACHMENT_SIZE_BYTES))}</p>
                  </div>
                  <div>
                    <button type="submit">
                      <span className="button-content">
                        <UploadIcon className="button-icon" />
                        <span>{t.common.uploadFile}</span>
                      </span>
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="ticket-subsection">
                <p className="muted">{t.tickets.closedReadOnly}</p>
              </div>
            )}
          </Panel>
        </div>

        <div className="stack ticket-page-section-stack">
          <Panel title={t.common.status}>
            {isClosed ? (
              <form action={reopenTicketAction} className="stack">
                <input type="hidden" name="ticketId" value={data.ticket.id} />
                <button type="submit">{t.tickets.reopenTicket}</button>
              </form>
            ) : null}
            <div className="meta-grid">
              <div className="meta-item">
                <span>{t.common.status}</span>
                <Badge label={localizeDefinition(data.ticket.status, data.locale)} tone="accent" />
              </div>
              <div className="meta-item">
                <span>{t.common.priority}</span>
                <span>{localizeDefinition(data.ticket.priority, data.locale)}</span>
              </div>
              <div className="meta-item">
                <span>{t.common.category}</span>
                <span>{localizeDefinition(data.ticket.category, data.locale)}</span>
              </div>
              <div className="meta-item">
                <span>{t.common.assignee}</span>
                <span>{data.ticket.assignee?.displayName ?? t.common.none}</span>
              </div>
              <div className="meta-item">
                <span>{t.common.requester}</span>
                <span>{data.ticket.requester.displayName}</span>
              </div>
              <div className="meta-item">
                <span>{t.common.dueDate}</span>
                <span>{formatDate(data.ticket.dueDate, data.localeCode, data.timeZone)}</span>
                {data.ticket.dueDate && !isClosed ? (
                  <details className="due-date-invite-disclosure">
                    <summary className="muted due-date-invite-summary">
                      {data.locale === "ZH_CN" ? "发送截止日期日历邀请" : "Send due-date calendar invite"}
                    </summary>
                    <form action={sendDueDateInviteAction} className="stack due-date-invite-form">
                      <input type="hidden" name="ticketId" value={data.ticket.id} />
                      <span className="muted">
                        {data.locale === "ZH_CN" ? "收件人" : "Recipients"}
                      </span>
                      <div className="recipient-checklist">
                        {data.workspacePeople.map((person) => (
                          <label key={person.id} htmlFor={`recipientIds-due-date-${person.id}`} className="checkbox-row recipient-checklist-row">
                            <input
                              id={`recipientIds-due-date-${person.id}`}
                              type="checkbox"
                              name="recipientIds"
                              value={person.id}
                              defaultChecked={defaultDueDateInviteRecipientIds.includes(person.id)}
                            />
                            <span>{person.displayName}</span>
                          </label>
                        ))}
                      </div>
                      <div>
                        <button type="submit" className="ghost-button due-date-invite-button">
                          {data.locale === "ZH_CN" ? "发送邀请" : "Send invite"}
                        </button>
                      </div>
                    </form>
                  </details>
                ) : null}
              </div>
              <div className="meta-item">
                <span>{t.common.parentTicket}</span>
                {data.ticket.parentTicket ? (
                  <Link href={`/tickets/${data.ticket.parentTicket.id}`}>
                    {data.ticket.parentTicket.ticketNumber} · {data.ticket.parentTicket.title}
                  </Link>
                ) : (
                  <span>{t.common.none}</span>
                )}
              </div>
              {data.ticket.workspace.paymentInfoEnabled ? (
                <div className="meta-item">
                  <span>{t.common.paymentMethods}</span>
                  {data.ticket.paymentMethods.length ? (
                    <div className="stack" style={{ gap: "0.4rem" }}>
                      {data.ticket.paymentMethods.map((item) => (
                        <span key={item.id}>{item.paymentMethod.label} · {item.paymentMethod.last4}</span>
                      ))}
                    </div>
                  ) : data.ticket.paymentLabel || data.ticket.paymentLast4 ? (
                    <span>
                      {[data.ticket.paymentLabel, data.ticket.paymentLast4].filter(Boolean).join(" · ")}
                    </span>
                  ) : (
                    <span>{t.common.none}</span>
                  )}
                </div>
              ) : null}
            </div>
          </Panel>
        </div>
      </div>

      <div className="detail-secondary-layout">
        <div className="stack ticket-page-section-stack">
          {!isClosed ? (
            <details className="panel detail-disclosure" open={false}>
            <summary className="panel-title detail-summary">
              <span className="detail-summary-copy">
                <span className="detail-summary-main">{t.common.edit}</span>
              </span>
              <span
                className="detail-summary-toggle"
                data-closed-label={t.common.expand}
                data-open-label={t.common.collapse}
              />
            </summary>
            <form action={updateTicketAction} className="stack disclosure-body" id="ticket-edit-form">
              <input type="hidden" name="ticketId" value={data.ticket.id} />
              {ticketContext}
              <div className="field">
                <label htmlFor="title">{t.common.title}</label>
                <input id="title" name="title" defaultValue={data.ticket.title} required />
              </div>
              <div className="field">
                <label htmlFor="statusId">{t.common.status}</label>
                <select id="statusId" name="statusId" defaultValue={data.ticket.statusId}>
                  {data.definitions.statuses.filter((item) => item.isActive).map((item) => (
                    <option key={item.id} value={item.id}>
                      {localizeDefinition(item, data.locale)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="priorityId">{t.common.priority}</label>
                <select id="priorityId" name="priorityId" defaultValue={data.ticket.priorityId}>
                  {data.definitions.priorities.map((item) => (
                    <option key={item.id} value={item.id}>
                      {localizeDefinition(item, data.locale)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="categoryId">{t.common.category}</label>
                <select id="categoryId" name="categoryId" defaultValue={data.ticket.categoryId}>
                  {data.definitions.categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {localizeDefinition(item, data.locale)}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="assigneeId">{t.common.assignee}</label>
                <select id="assigneeId" name="assigneeId" defaultValue={data.ticket.assigneeId ?? ""}>
                  <option value="">{t.common.none}</option>
                  {data.workspacePeople.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="dueDate">{t.common.dueDate}</label>
                <input
                  id="dueDate"
                  name="dueDate"
                  type="date"
                  defaultValue={data.ticket.dueDate ? new Date(data.ticket.dueDate).toISOString().slice(0, 10) : ""}
                />
              </div>
              {data.ticket.workspace.paymentInfoEnabled ? (
                <>
                  <div className="field">
                    <label htmlFor="savedPaymentMethodIds">
                      {t.common.paymentMethods} <span className="muted">({t.common.optional})</span>
                    </label>
                    <select
                      id="savedPaymentMethodIds"
                      name="savedPaymentMethodIds"
                      multiple
                      size={Math.min(4, Math.max(2, data.savedPaymentMethods.length || 2))}
                      defaultValue={Array.from(selectedPaymentMethodIds)}
                    >
                      {data.savedPaymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>
                          {method.label} · {method.last4}
                        </option>
                      ))}
                    </select>
                    {!data.savedPaymentMethods.length ? <p className="muted">{t.common.noSavedPaymentMethods}</p> : null}
                  </div>
                  <div className="field">
                    <label htmlFor="paymentLabel">{t.common.paymentLabel}</label>
                    <input id="paymentLabel" name="paymentLabel" defaultValue={data.ticket.paymentLabel ?? ""} maxLength={60} />
                  </div>
                  <div className="field">
                    <label htmlFor="paymentLast4">{t.common.paymentLast4}</label>
                    <input
                      id="paymentLast4"
                      name="paymentLast4"
                      defaultValue={data.ticket.paymentLast4 ?? ""}
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                    />
                  </div>
                  <div className="field">
                    <label>
                      <input type="checkbox" name="savePaymentMethod" value="yes" style={{ width: "auto", marginRight: "0.55rem" }} />
                      {t.common.savePaymentMethod}
                    </label>
                  </div>
                </>
              ) : null}
              <div>
                <button type="submit">{t.common.save}</button>
              </div>
            </form>
            </details>
          ) : null}
          <details className="panel detail-disclosure" open={showEventsOpenByDefault}>
            <summary className="panel-title detail-summary">
              <span className="detail-summary-copy">
                <span className="detail-summary-main">{t.tickets.eventsTitle}</span>
                {eventsPreview ? <span className="detail-summary-preview">{eventsPreview}</span> : null}
              </span>
              <span
                className="detail-summary-toggle"
                data-closed-label={t.common.expand}
                data-open-label={t.common.collapse}
              />
            </summary>
            <div className="stack ticket-events-stack disclosure-body">
              {data.ticket.events.length ? (
                data.ticket.events.map((event) => (
                  <div key={event.id} className="event-card">
                    <div className="event-card-header">
                      <div className="event-card-heading">
                        <strong className="event-card-title">{event.title}</strong>
                        <div className="muted event-card-time">
                          {formatDateTime(event.scheduledFor, data.localeCode, data.timeZone)}
                        </div>
                      </div>
                      <div className="event-card-actions">
                        <details className="event-edit-disclosure">
                          <summary className="ghost-button event-edit-summary">
                            <span>{t.common.edit}</span>
                            <span
                              className="event-edit-summary-toggle"
                              data-closed-label={t.common.expand}
                              data-open-label={t.common.collapse}
                            />
                          </summary>
                          <div className="event-edit-body">
                            <TicketEventForm
                              action={updateTicketEventAction}
                              ticketId={data.ticket.id}
                              eventId={event.id}
                              labels={{
                                title: t.common.title,
                                notes: t.tickets.eventNotes,
                                scheduledFor: t.tickets.eventScheduledFor,
                                reminders: t.tickets.eventReminders,
                                submit: t.common.update,
                                optional: t.common.optional,
                                reminderMonths: t.tickets.reminderMonths,
                                reminderWeeks: t.tickets.reminderWeeks,
                                reminderDays: t.tickets.reminderDays,
                                reminderHours: t.tickets.reminderHours,
                                reminderMinutes: t.tickets.reminderMinutes,
                                reminderAtTime: t.tickets.reminderAtTime,
                              }}
                              reminderOptions={defaultTicketEventReminderOffsets.map((offset) => ({
                                value: offset,
                                label: formatReminderOffsetLabel(offset, data.locale),
                              }))}
                              initialValues={{
                                title: event.title,
                                notes: event.notes ?? "",
                                scheduledFor: event.scheduledFor.toISOString(),
                                selectedReminderOffsets: event.reminders.map((reminder) => reminder.offsetMinutes),
                              }}
                            />
                          </div>
                        </details>
                        <form action={deleteTicketEventAction}>
                          <input type="hidden" name="ticketId" value={data.ticket.id} />
                          <input type="hidden" name="eventId" value={event.id} />
                          <button type="submit" className="ghost-button event-delete-button">
                            {t.tickets.deleteEvent}
                          </button>
                        </form>
                      </div>
                    </div>
                    {event.notes ? <p>{event.notes}</p> : null}
                    <div className="event-reminder-badges">
                      {event.reminders.length ? (
                        event.reminders.map((reminder) => (
                          <Badge
                            key={reminder.id}
                            label={formatReminderOffsetLabel(reminder.offsetMinutes, data.locale)}
                            tone="neutral"
                          />
                        ))
                      ) : (
                        <span className="muted">{t.tickets.noEventReminders}</span>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title={t.tickets.eventsTitle} body={t.tickets.eventsEmpty} />
              )}

              {!isClosed ? (
                <div className="ticket-subsection">
                  {ticketContext}
                  <TicketEventForm
                    action={createTicketEventAction}
                    ticketId={data.ticket.id}
                    labels={{
                      title: t.common.title,
                      notes: t.tickets.eventNotes,
                      scheduledFor: t.tickets.eventScheduledFor,
                      reminders: t.tickets.eventReminders,
                      submit: t.tickets.createEvent,
                      optional: t.common.optional,
                      reminderMonths: t.tickets.reminderMonths,
                      reminderWeeks: t.tickets.reminderWeeks,
                      reminderDays: t.tickets.reminderDays,
                      reminderHours: t.tickets.reminderHours,
                      reminderMinutes: t.tickets.reminderMinutes,
                      reminderAtTime: t.tickets.reminderAtTime,
                    }}
                    reminderOptions={defaultTicketEventReminderOffsets.map((offset) => ({
                      value: offset,
                      label: formatReminderOffsetLabel(offset, data.locale),
                    }))}
                  />
                </div>
              ) : null}
            </div>
          </details>

          <details className="panel detail-disclosure" open={showChildrenOpenByDefault}>
            <summary className="panel-title detail-summary">
              <span className="detail-summary-copy">
                <span className="detail-summary-main">{t.common.childTickets}</span>
                {childrenPreview ? <span className="detail-summary-preview">{childrenPreview}</span> : null}
              </span>
              <span
                className="detail-summary-toggle"
                data-closed-label={t.common.expand}
                data-open-label={t.common.collapse}
              />
            </summary>
            <div className="disclosure-body">
              {data.ticket.parentTicket ? (
                <div className="ticket-subsection">
                  <div className="relationship-section-label">{t.common.parentTicket}</div>
                  <div className="meta-pair">
                    <Link href={`/tickets/${data.ticket.parentTicket.id}`} className="ticket-parent-link">
                      <span className="ticket-number">{data.ticket.parentTicket.ticketNumber}</span>
                      <strong>{data.ticket.parentTicket.title}</strong>
                    </Link>
                  </div>
                </div>
              ) : null}
              {data.ticket.childTickets.length ? (
                <div className="ticket-subsection">
                  <div className="relationship-section-header">
                    <div className="relationship-section-label">{t.common.childTickets}</div>
                    {canCreateChildTicket ? (
                      <Link
                        href={`/tickets/new?workspaceId=${data.ticket.workspaceId}&parentTicketId=${data.ticket.id}`}
                        className="ghost-button relationship-action-link"
                      >
                        <span className="button-content">
                          <ChildTicketIcon className="button-icon" />
                          <span>{t.tickets.createChildTicket}</span>
                        </span>
                      </Link>
                    ) : null}
                  </div>
                  <div className="list">
                    {data.ticket.childTickets.map((child) => (
                      <Link key={child.id} href={`/tickets/${child.id}`} className="list-row">
                        <div>
                          <div className="ticket-number">{child.ticketNumber}</div>
                          <strong>{child.title}</strong>
                        </div>
                        <Badge label={localizeDefinition(child.status, data.locale)} tone="accent" />
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="ticket-subsection">
                  {canCreateChildTicket ? (
                    <div className="relationship-section-header">
                      <div className="relationship-section-label">{t.common.childTickets}</div>
                      <Link
                        href={`/tickets/new?workspaceId=${data.ticket.workspaceId}&parentTicketId=${data.ticket.id}`}
                        className="ghost-button relationship-action-link"
                      >
                        <span className="button-content">
                          <ChildTicketIcon className="button-icon" />
                          <span>{t.tickets.createChildTicket}</span>
                        </span>
                      </Link>
                    </div>
                  ) : null}
                  <EmptyState title={t.common.childTickets} body={t.tickets.childrenEmpty} />
                </div>
              )}
              {!isClosed ? (
                <form action={updateTicketAction} className="stack ticket-subsection">
                  <input type="hidden" name="ticketId" value={data.ticket.id} />
                  {ticketContext}
                  <div className="relationship-section-label">{t.common.parentTicket}</div>
                  <div className="field">
                    <label htmlFor="parentTicketId-inline">
                      {t.common.parentTicket} <span className="muted">({t.common.optional})</span>
                    </label>
                    <select id="parentTicketId-inline" name="parentTicketId" defaultValue={data.ticket.parentTicketId ?? ""}>
                      <option value="">{t.common.none}</option>
                      {data.parentTicketCandidates.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.ticketNumber} · {candidate.title}
                        </option>
                      ))}
                    </select>
                    <p className="muted">{t.common.topLevelOnlyHint}</p>
                  </div>
                  <div>
                    <button type="submit">{t.common.save}</button>
                  </div>
                </form>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </>
  );
}
