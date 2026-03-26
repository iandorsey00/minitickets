import Link from "next/link";

import { EmptyState, PageHeader, Panel, Badge } from "@/components/ui";
import { formatDateTime, localizeDefinition } from "@/lib/format";
import { getTicketsData } from "@/lib/data";

function hasActiveFilters(params: {
  workspaceId?: string;
  statusId?: string;
  priorityId?: string;
  categoryId?: string;
  assigneeId?: string;
  requesterId?: string;
  q?: string;
}) {
  return Boolean(
    params.q ||
      params.statusId ||
      params.priorityId ||
      params.categoryId ||
      params.assigneeId ||
      params.requesterId,
  );
}

export default async function TicketsPage({
  searchParams,
}: {
  searchParams: Promise<{
    workspaceId?: string;
    statusId?: string;
    priorityId?: string;
    categoryId?: string;
    assigneeId?: string;
    requesterId?: string;
    q?: string;
  }>;
}) {
  const params = await searchParams;
  const data = await getTicketsData(params);
  const t = data.dictionary;
  const showFilters = hasActiveFilters(params);

  return (
    <>
      <PageHeader
        title={t.tickets.title}
        subtitle={data.currentWorkspace?.name ?? t.common.workspace}
        action={
          <Link href="/tickets/new" className="button">
            {t.nav.createTicket}
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
              <label htmlFor="categoryId">{t.common.category}</label>
              <select id="categoryId" name="categoryId" defaultValue={params.categoryId ?? ""}>
                <option value="">{t.common.all}</option>
                {data.definitions.categories.map((item) => (
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
          <table className="table">
            <thead>
              <tr>
                <th>{t.common.title}</th>
                <th>{t.common.workspace}</th>
                <th>{t.common.status}</th>
                <th>{t.common.priority}</th>
                <th>{t.common.assignee}</th>
                <th>{t.common.updatedAt}</th>
              </tr>
            </thead>
            <tbody>
              {data.tickets.map((ticket) => (
                <tr key={ticket.id}>
                  <td>
                    <Link href={`/tickets/${ticket.id}`}>
                      <div className="ticket-number">{ticket.ticketNumber}</div>
                      <strong>{ticket.title}</strong>
                    </Link>
                  </td>
                  <td>{ticket.workspace.name}</td>
                  <td>
                    <Badge label={localizeDefinition(ticket.status, data.locale)} tone="accent" />
                  </td>
                  <td>{localizeDefinition(ticket.priority, data.locale)}</td>
                  <td>{ticket.assignee?.displayName ?? t.common.none}</td>
                  <td>{formatDateTime(ticket.updatedAt, data.localeCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title={t.tickets.listEmpty} body={t.states.emptySearch} />
        )}
      </Panel>
    </>
  );
}
