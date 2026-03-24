import Link from "next/link";

import { EmptyState, PageHeader, Panel, TicketLink } from "@/components/ui";
import { getWorkspaceDetail } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export default async function WorkspaceDetailPage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const data = await getWorkspaceDetail(workspaceId);

  if (!data) {
    return <div />;
  }

  const t = data.dictionary;

  return (
    <>
      <PageHeader title={data.workspace.name} subtitle={data.workspace.description ?? ""} />
      <div className="grid-2">
        <Panel title={t.common.members}>
          <div className="list">
            {data.workspace.memberships.map((membership) => (
              <div key={membership.id} className="list-row">
                <strong>{membership.user.displayName}</strong>
                <span className="row-meta">{membership.user.email}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={t.workspaces.recentWorkspaceActivity}>
          <div className="timeline">
            {data.recentActivity.length ? (
              data.recentActivity.map((activity) => (
                <div key={activity.id} className="timeline-item">
                  <strong>
                    <Link href={`/tickets/${activity.ticket.id}`}>{activity.ticket.ticketNumber}</Link>
                  </strong>
                  <div>{data.locale === "ZH_CN" ? activity.messageZh : activity.messageEn}</div>
                  <div className="muted">{formatDateTime(activity.createdAt, data.localeCode)}</div>
                </div>
              ))
            ) : (
              <EmptyState title={t.dashboard.emptyUpdates} />
            )}
          </div>
        </Panel>
      </div>

      <Panel title={t.workspaces.workspaceTickets}>
        <div className="list">
          {data.workspace.tickets.length ? (
            data.workspace.tickets.map((ticket) => (
              <TicketLink
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                number={ticket.ticketNumber}
                title={ticket.title}
                meta={`${ticket.assignee?.displayName ?? t.common.none} · ${formatDateTime(ticket.updatedAt, data.localeCode)}`}
              />
            ))
          ) : (
            <EmptyState title={t.tickets.listEmpty} />
          )}
        </div>
      </Panel>
    </>
  );
}
