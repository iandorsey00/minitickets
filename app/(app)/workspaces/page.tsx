import Link from "next/link";

import { EmptyState, PageHeader, Panel, StatCard } from "@/components/ui";
import { getWorkspacesOverview } from "@/lib/data";

export default async function WorkspacesPage() {
  const data = await getWorkspacesOverview();
  const t = data.dictionary;

  return (
    <>
      <PageHeader title={t.workspaces.title} subtitle={t.common.workspace} />
      {data.workspaces.length ? (
        <div className="grid-3">
          {data.workspaces.map((workspace) => (
            <Panel
              key={workspace.id}
              title={workspace.name}
              footer={
                <Link href={`/workspaces/${workspace.id}`} className="ghost-button">
                  {t.common.manage}
                </Link>
              }
            >
              <p className="muted">{workspace.description}</p>
              <div className="grid-2">
                <StatCard label={t.common.members} value={workspace.memberships.length} />
                <StatCard label={t.tickets.title} value={workspace.tickets.length} />
              </div>
            </Panel>
          ))}
        </div>
      ) : (
        <EmptyState title={t.workspaces.empty} />
      )}
    </>
  );
}
