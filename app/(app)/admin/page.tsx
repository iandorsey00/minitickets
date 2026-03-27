import Link from "next/link";

import { EmptyState, PageHeader, Panel, StatCard, TicketLink } from "@/components/ui";
import { getAdminData } from "@/lib/data";
import { formatDateTime } from "@/lib/format";

export default async function AdminPage() {
  const data = await getAdminData();
  if (!data) {
    return <div />;
  }
  const t = data.dictionary;

  return (
    <>
      <PageHeader
        title={t.admin.title}
        subtitle={t.admin.globalTickets}
        action={
          <div className="helper-links">
            <Link href="/admin/users" className="ghost-button">
              {t.admin.users}
            </Link>
            <Link href="/admin/workspaces" className="ghost-button">
              {t.admin.workspaces}
            </Link>
            <Link href="/admin/catalog" className="ghost-button">
              {t.admin.catalog}
            </Link>
          </div>
        }
      />

      <section className="grid-4">
        <StatCard label={t.admin.users} value={data.users.length} />
        <StatCard label={t.admin.workspaces} value={data.workspaces.length} />
        <StatCard label={t.tickets.title} value={data.tickets.length} />
        <StatCard label={t.common.members} value={data.workspaces.reduce((sum, item) => sum + item.memberships.length, 0)} />
      </section>

      <Panel title={t.admin.globalTickets}>
        <div className="list">
          {data.tickets.length ? (
            data.tickets.map((ticket) => (
              <TicketLink
                key={ticket.id}
                href={`/tickets/${ticket.id}`}
                number={ticket.ticketNumber}
                title={ticket.title}
                meta={`${ticket.workspace.name} · ${formatDateTime(ticket.updatedAt, data.localeCode, data.timeZone)}`}
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
