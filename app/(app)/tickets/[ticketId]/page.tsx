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

  return (
    <>
      <PageHeader
        title={data.ticket.title}
        subtitle={`${data.ticket.ticketNumber} · ${data.ticket.workspace.name}`}
      />

      <div className="detail-layout">
        <div className="stack">
          <Panel title={t.common.description}>
            <p>{data.ticket.description}</p>
          </Panel>

          <Panel title={t.common.activity}>
            <div className="timeline">
              {data.ticket.activities.map((activity) => (
                <div key={activity.id} className="timeline-item">
                  <strong>{data.locale === "ZH_CN" ? activity.messageZh : activity.messageEn}</strong>
                  <div className="muted">
                    {activity.actor?.displayName ?? "System"} · {formatDateTime(activity.createdAt, data.localeCode)}
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title={t.common.comments}>
            <div className="timeline">
              {data.ticket.comments.length ? (
                data.ticket.comments.map((comment) => (
                  <div key={comment.id} className="timeline-item">
                    <strong>{comment.author.displayName}</strong>
                    <div>{comment.body}</div>
                    <div className="muted">{formatDateTime(comment.createdAt, data.localeCode)}</div>
                  </div>
                ))
              ) : (
                <EmptyState title={t.tickets.noComments} />
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
          </Panel>

          <Panel title={t.common.attachments}>
            <div className="timeline">
              {data.ticket.attachments.length ? (
                data.ticket.attachments.map((attachment) => (
                  <div key={attachment.id} className="timeline-item">
                    <strong>
                      <a href={attachment.filePath} target="_blank" rel="noreferrer">
                        {attachment.originalName}
                      </a>
                    </strong>
                    <div className="muted">
                      {attachment.uploadedBy.displayName} · {formatDateTime(attachment.createdAt, data.localeCode)} ·{" "}
                      {formatFileSize(attachment.fileSizeBytes)}
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState title={t.common.attachments} body={t.states.emptySearch} />
              )}
            </div>

            <form action={addAttachmentAction} className="stack">
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
                <span>{formatDate(data.ticket.dueDate, data.localeCode)}</span>
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
                <textarea id="description" name="description" defaultValue={data.ticket.description} required />
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
