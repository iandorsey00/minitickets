import Link from "next/link";

import { PencilIcon } from "@/components/icons";
import { EmptyState, PageHeader, Panel, Badge, UserBadgeList } from "@/components/ui";
import { formatDate, formatDateTime, localizeDefinition } from "@/lib/format";
import { getTicketsData } from "@/lib/data";
import { getTicketAssigneeUsers } from "@/lib/ticket-assignees";

function getDueDateTone(dueDate: Date | null, statusKey: string) {
  if (!dueDate || ["RESOLVED", "CLOSED"].includes(statusKey)) {
    return "neutral";
  }

  const today = new Date();
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dueUtc = Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  const daysRemaining = Math.floor((dueUtc - todayUtc) / 86_400_000);

  if (daysRemaining <= 0) {
    return "critical";
  }

  if (daysRemaining <= 3) {
    return "warning";
  }

  return "neutral";
}

function hasActiveFilters(params: {
  workspaceId?: string;
  statusId?: string;
  priorityId?: string;
  assigneeId?: string;
  requesterId?: string;
  q?: string;
  openOnly?: string;
}) {
  return Boolean(
    params.q ||
      params.statusId ||
      params.priorityId ||
      params.assigneeId ||
      params.requesterId ||
      params.openOnly === "0",
  );
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    workspaceId?: string;
    statusId?: string;
    priorityId?: string;
    assigneeId?: string;
    requesterId?: string;
    q?: string;
    openOnly?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await getTicketsData(params);
  const t = data.dictionary;
  const showFilters = hasActiveFilters(params);
  const showWorkspaceMeta = !data.currentWorkspace;

  return (
    <>
      <PageHeader
        title={t.tickets.title}
        subtitle={data.currentWorkspace?.name ?? t.common.workspace}
        action={
          <Link href="/tickets/new" className="floating-action inline-floating-action">
            <PencilIcon className="floating-action-icon" />
            <span>{t.nav.createTicket}</span>
          </Link>
        }
      />

      <details className="panel filter-panel" open={showFilters}>
        <summary className="panel-title filter-summary">{t.common.filters}</summary>
        <form className="stack filter-form" action="/tickets">
          <div className="filters">
            <div className="field">
              <label htmlFor="q">{t.common.keyword}</label>
              <input id="q" name="q" defaultValue={params.q ?? ""} />
            </div>
            <div className="field">
              <label htmlFor="openOnly">{t.tickets.openOnlyFilter}</label>
              <select id="openOnly" name="openOnly" defaultValue={params.openOnly ?? "1"}>
                <option value="1">{t.tickets.openOnlyFilter}</option>
                <option value="0">{t.tickets.allTicketsFilter}</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="statusId">{t.common.status}</label>
              <select id="statusId" name="statusId" defaultValue={params.statusId ?? ""}>
                <option value="">{t.common.all}</option>
                {data.definitions.statuses.map((item) => (
                  <option key={item.id} value={item.id}>
                    {localizeDefinition(item, data.locale)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="priorityId">{t.common.priority}</label>
              <select id="priorityId" name="priorityId" defaultValue={params.priorityId ?? ""}>
                <option value="">{t.common.all}</option>
                {data.definitions.priorities.map((item) => (
                  <option key={item.id} value={item.id}>
                    {localizeDefinition(item, data.locale)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="assigneeId">{t.common.assignee}</label>
              <select id="assigneeId" name="assigneeId" defaultValue={params.assigneeId ?? ""}>
                <option value="">{t.common.all}</option>
                {data.people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="requesterId">{t.common.requester}</label>
              <select id="requesterId" name="requesterId" defaultValue={params.requesterId ?? ""}>
                <option value="">{t.common.all}</option>
                {data.people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="workspaceId">{t.common.workspace}</label>
              <select id="workspaceId" name="workspaceId" defaultValue={data.currentWorkspace?.id ?? ""}>
                {data.memberships.map((membership) => (
                  <option key={membership.workspace.id} value={membership.workspace.id}>
                    {membership.workspace.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="helper-links">
            <button type="submit">{t.common.search}</button>
            <Link href="/tickets" className="ghost-button">
              {t.common.clear}
            </Link>
          </div>
        </form>
      </details>

      <Panel>
        {data.tickets.length ? (
          <div className="list ticket-list">
            {data.tickets.map((ticket) => (
              <Link key={ticket.id} href={`/tickets/${ticket.id}`} className="list-row ticket-list-row">
                <div className="stack ticket-list-main">
                  <div className="ticket-number">{ticket.ticketNumber}</div>
                  <strong>{ticket.title}</strong>
                </div>
                <div className="ticket-list-meta">
                  {showWorkspaceMeta ? (
                    <div className="meta-pair">
                      <span>{t.common.workspace}</span>
                      <strong>{ticket.workspace.name}</strong>
                    </div>
                  ) : null}
                  <div className="meta-pair">
                    <span>{t.common.status}</span>
                    <Badge label={localizeDefinition(ticket.status, data.locale)} tone="accent" />
                  </div>
                  <div className="meta-pair">
                    <span>{t.common.priority}</span>
                    <strong>{localizeDefinition(ticket.priority, data.locale)}</strong>
                  </div>
                  <div className="meta-pair">
                    <span>{t.common.assignees}</span>
                    <UserBadgeList
                      users={getTicketAssigneeUsers(ticket)}
                      emptyLabel={t.common.none}
                    />
                  </div>
                  <div className="meta-pair">
                    <span>{t.common.dueDate}</span>
                    <strong className={`due-date-value due-date-${getDueDateTone(ticket.dueDate, ticket.status.key)}`}>
                      {ticket.dueDate ? formatDate(ticket.dueDate, data.localeCode, data.timeZone) : t.common.none}
                    </strong>
                  </div>
                  <div className="meta-pair">
                    <span>{t.common.createdAt}</span>
                    <strong>{formatDateTime(ticket.createdAt, data.localeCode, data.timeZone)}</strong>
                  </div>
                  <div className="meta-pair">
                    <span>{t.common.updatedAt}</span>
                    <strong>{formatDateTime(ticket.updatedAt, data.localeCode, data.timeZone)}</strong>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title={t.tickets.listEmpty} body={t.states.emptySearch} />
        )}
      </Panel>
    </>
  );
}
