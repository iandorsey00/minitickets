import { PageHeader, Panel, StatCard, TicketLink, EmptyState } from "@/components/ui";
import { formatDateTime, localizeDefinition } from "@/lib/format";
import { getDashboardData } from "@/lib/data";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string }>;
}) {
  const params = await searchParams;
  const data = await getDashboardData(params.workspaceId);
  const t = data.dictionary;

  return (
    <>
      <PageHeader title={t.dashboard.title} subtitle={data.currentWorkspace?.name} />

      <section className="grid-4">
        <StatCard label={t.dashboard.assignedToMe} value={data.assignedToMe.length} />
        <StatCard label={t.dashboard.createdByMe} value={data.createdByMe.length} />
        <StatCard label={t.dashboard.recentUpdates} value={data.recentUpdates.length} />
        <StatCard
          label={t.workspaces.title}
          value={data.currentWorkspace ? data.currentWorkspace.name : data.memberships.length}
        />
      </section>

      <div className="grid-3">
        <Panel title={t.dashboard.assignedToMe}>
          <div className="list">
            {data.assignedToMe.length ? (
              data.assignedToMe.map((ticket) => (
                <TicketLink
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  number={ticket.ticketNumber}
                  title={ticket.title}
                  meta={`${localizeDefinition(ticket.status, data.locale)} · ${formatDateTime(ticket.updatedAt, data.localeCode)}`}
                />
              ))
            ) : (
              <EmptyState title={t.dashboard.emptyAssigned} />
            )}
          </div>
        </Panel>

        <Panel title={t.dashboard.createdByMe}>
          <div className="list">
            {data.createdByMe.length ? (
              data.createdByMe.map((ticket) => (
                <TicketLink
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  number={ticket.ticketNumber}
                  title={ticket.title}
                  meta={`${localizeDefinition(ticket.priority, data.locale)} · ${formatDateTime(ticket.updatedAt, data.localeCode)}`}
                />
              ))
            ) : (
              <EmptyState title={t.dashboard.emptyCreated} />
            )}
          </div>
        </Panel>

        <Panel title={t.dashboard.statusCounts}>
          <div className="list">
            {data.statusCounts.map((item) =>
              item.definition ? (
                <div key={item.definition.id} className="list-row">
                  <strong>{localizeDefinition(item.definition, data.locale)}</strong>
                  <span>{item.count}</span>
                </div>
              ) : null,
            )}
          </div>
        </Panel>
      </div>

      <Panel title={t.dashboard.recentUpdates}>
        <div className="timeline">
          {data.recentUpdates.length ? (
            data.recentUpdates.map((activity) => (
              <div key={activity.id} className="timeline-item">
                <strong>{activity.ticket.ticketNumber}</strong>
                <div>{data.locale === "ZH_CN" ? activity.messageZh : activity.messageEn}</div>
                <div className="muted">
                  {activity.actor?.displayName ?? "System"} · {formatDateTime(activity.createdAt, data.localeCode)}
                </div>
              </div>
            ))
          ) : (
            <EmptyState title={t.dashboard.emptyUpdates} />
          )}
        </div>
      </Panel>
    </>
  );
}
