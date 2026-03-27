import { addAttachmentAction, addCommentAction, updateTicketAction } from "@/lib/actions";
import { getTicketDetail } from "@/lib/data";
import { formatDate, formatDateTime, formatFileSize, localizeDefinition } from "@/lib/format";
import { Badge, EmptyState, PageHeader, Panel } from "@/components/ui";

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
      filePath: attachment.filePath,
      fileSizeBytes: attachment.fileSizeBytes,
      mimeType: attachment.mimeType,
    })),
  ].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  return (
    <>
      <PageHeader
        title={data.ticket.title}
        subtitle={`${data.ticket.ticketNumber} · ${data.ticket.workspace.name}`}
      />

      <div className="detail-layout">
        <div className="stack">
          <details className="panel detail-disclosure">
            <summary className="panel-title">{t.common.description}</summary>
            <div className="disclosure-body">
              {data.ticket.description ? <p>{data.ticket.description}</p> : <p className="muted">{t.common.optional}</p>}
            </div>
          </details>

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
                        {item.mimeType?.startsWith("image/") ? (
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

            <form action={addCommentAction} className="stack">
              <input type="hidden" name="ticketId" value={data.ticket.id} />
              <div className="field">
                <label htmlFor="body">{t.tickets.addComment}</label>
                <textarea id="body" name="body" placeholder={t.tickets.commentPlaceholder} required />
              </div>
              <div>
                <button type="submit">{t.tickets.addComment}</button>
              </div>
            </form>
            <form action={addAttachmentAction} className="stack" encType="multipart/form-data">
              <input type="hidden" name="ticketId" value={data.ticket.id} />
              <div className="field">
                <label htmlFor="file">{t.common.uploadFile}</label>
                <input id="file" name="file" type="file" required />
              </div>
              <div>
                <button type="submit">{t.common.uploadFile}</button>
              </div>
            </form>
          </Panel>
        </div>

        <div className="stack">
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
                <span>{t.common.paymentLabel}</span>
                <span>{data.ticket.paymentLabel ?? t.common.none}</span>
              </div>
              <div className="meta-item">
                <span>{t.common.paymentLast4}</span>
                <span>{data.ticket.paymentLast4 ?? t.common.none}</span>
              </div>
            </div>
          </Panel>

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
              <div>
                <button type="submit">{t.common.save}</button>
              </div>
            </form>
          </Panel>
        </div>
      </div>
    </>
  );
}
