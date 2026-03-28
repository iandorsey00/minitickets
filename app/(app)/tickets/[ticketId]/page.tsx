import Link from "next/link";

import { addAttachmentAction, addCommentAction, createTicketEventAction, deleteTicketEventAction, updateTicketAction } from "@/lib/actions";
import { getTicketDetail } from "@/lib/data";
import { formatDate, formatDateTime, formatFileSize, localizeDefinition } from "@/lib/format";
import { formatReminderOffsetLabel } from "@/lib/reminder-labels";
import { defaultTicketEventReminderOffsets } from "@/lib/ticket-events";
import { canRenderInline, getTicketAttachmentUrl } from "@/lib/uploads";
import { CommentIcon, UploadIcon } from "@/components/icons";
import { FilePicker } from "@/components/file-picker";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui";
import { TicketEventForm } from "@/components/ticket-event-form";
import { TicketShareMenu } from "@/components/ticket-share-menu";

export default async function TicketDetailPage({
  params,
}: {
  params: Promise<{ ticketId: string }>;
}) {
  const { ticketId } = await params;
  const data = await getTicketDetail(ticketId);

  if (!data) {
    return <div />;
  }

  const t = data.dictionary;
  const resolvedStatusId = data.definitions.statuses.find((status) => status.key === "RESOLVED")?.id ?? null;
  const showResolveAction = resolvedStatusId && !["RESOLVED", "CLOSED", "CANCELLED"].includes(data.ticket.status.key);
  const selectedPaymentMethodIds = new Set(data.ticket.paymentMethods.map((item) => item.paymentMethodId));
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
          {data.ticket.description ? (
            <details className="panel detail-disclosure">
              <summary className="panel-title">{t.common.description}</summary>
              <div className="disclosure-body">
                <p>{data.ticket.description}</p>
              </div>
            </details>
          ) : null}

          <Panel title={t.common.activity}>
            <div className="timeline">
              {historyItems.length ? (
                historyItems.map((item) => (
                  <div key={item.id} className="timeline-item">
                    {item.kind === "activity" ? <strong>{item.title}</strong> : null}
                    {item.kind === "comment" ? (
                      <>
                        <strong>{item.actorName}</strong>
                        <div>{item.body}</div>
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
                        ) : null}
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

            <form action={addCommentAction} className="stack ticket-subsection">
              <input type="hidden" name="ticketId" value={data.ticket.id} />
              <div className="field">
                <label htmlFor="body" className="label-with-icon">
                  <CommentIcon className="inline-icon" />
                  <span>{t.tickets.addComment}</span>
                </label>
                <textarea id="body" name="body" placeholder={t.tickets.commentPlaceholder} required />
                <p className="caution-text">{t.tickets.confidentialityNotice}</p>
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
              <div className="field">
                <label className="label-with-icon">
                  <UploadIcon className="inline-icon" />
                  <span>{t.common.uploadFile}</span>
                </label>
                <FilePicker
                  name="file"
                  label={t.common.chooseFile}
                  emptyLabel={t.common.noFileSelected}
                  required
                />
                <p className="warning-text">{t.common.uploadWarning}</p>
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
          </Panel>
        </div>

        <div className="stack ticket-page-section-stack">
          <Panel title={t.common.status}>
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
            </div>
          </Panel>
        </div>
      </div>

      <div className="detail-secondary-layout">
        <div className="stack ticket-page-section-stack">
          <Panel title={t.tickets.eventsTitle}>
            <div className="stack ticket-events-stack">
              {data.ticket.events.length ? (
                data.ticket.events.map((event) => (
                  <div key={event.id} className="event-card">
                    <div className="event-card-header">
                      <strong>{event.title}</strong>
                      <form action={deleteTicketEventAction}>
                        <input type="hidden" name="ticketId" value={data.ticket.id} />
                        <input type="hidden" name="eventId" value={event.id} />
                        <button type="submit" className="ghost-button event-delete-button">
                          {t.tickets.deleteEvent}
                        </button>
                      </form>
                    </div>
                    <div className="muted">{formatDateTime(event.scheduledFor, data.localeCode, data.timeZone)}</div>
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

              <div className="ticket-subsection">
                <TicketEventForm
                  action={createTicketEventAction}
                  ticketId={data.ticket.id}
                  labels={{
                    title: t.common.title,
                    notes: t.tickets.eventNotes,
                    scheduledFor: t.tickets.eventScheduledFor,
                    reminders: t.tickets.eventReminders,
                    create: t.tickets.createEvent,
                    optional: t.common.optional,
                  }}
                  reminderOptions={defaultTicketEventReminderOffsets.map((offset) => ({
                    value: offset,
                    label: formatReminderOffsetLabel(offset, data.locale),
                  }))}
                />
              </div>
            </div>
          </Panel>
        </div>

        <div className="stack ticket-page-section-stack">
          <Panel title={t.common.edit}>
            <form action={updateTicketAction} className="stack">
              <input type="hidden" name="ticketId" value={data.ticket.id} />
              <div className="field">
                <label htmlFor="title">{t.common.title}</label>
                <input id="title" name="title" defaultValue={data.ticket.title} required />
              </div>
              <div className="field">
                <label htmlFor="description">{t.common.description}</label>
                <textarea id="description" name="description" defaultValue={data.ticket.description} />
              </div>
              <div className="field">
                <label htmlFor="parentTicketId">
                  {t.common.parentTicket} <span className="muted">({t.common.optional})</span>
                </label>
                <select id="parentTicketId" name="parentTicketId" defaultValue={data.ticket.parentTicketId ?? ""}>
                  <option value="">{t.common.none}</option>
                  {data.parentTicketCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.ticketNumber} · {candidate.title}
                    </option>
                  ))}
                </select>
                <p className="muted">{t.common.topLevelOnlyHint}</p>
              </div>
              <div className="field">
                <label htmlFor="statusId">{t.common.status}</label>
                <select id="statusId" name="statusId" defaultValue={data.ticket.statusId}>
                  {data.definitions.statuses.map((item) => (
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
              <div>
                <button type="submit">{t.common.save}</button>
              </div>
            </form>
          </Panel>
        </div>
      </div>

      <Panel title={t.common.childTickets}>
        {data.ticket.childTickets.length ? (
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
        ) : (
          <EmptyState title={t.common.childTickets} body={t.tickets.childrenEmpty} />
        )}
      </Panel>

      {showResolveAction ? (
        <form action={updateTicketAction} className="floating-action-form">
          <input type="hidden" name="ticketId" value={data.ticket.id} />
          <input type="hidden" name="statusId" value={resolvedStatusId} />
          <button type="submit" className="floating-action">
            {t.common.resolveTicket}
          </button>
        </form>
      ) : null}
    </>
  );
}
