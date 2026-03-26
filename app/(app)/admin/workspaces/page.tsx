import { toggleWorkspaceArchiveAction } from "@/lib/actions";
import { WorkspaceCreateForm } from "@/components/workspace-create-form";
import { getAdminData } from "@/lib/data";
import { PageHeader, Panel } from "@/components/ui";

export default async function AdminWorkspacesPage() {
  const data = await getAdminData();
  if (!data) {
    return <div />;
  }
  const t = data.dictionary;

  return (
    <>
      <PageHeader title={t.admin.workspaces} subtitle={t.common.workspace} />
      <div className="grid-2">
        <Panel title={t.admin.createWorkspace}>
          <WorkspaceCreateForm
            titleLabel={t.common.title}
            slugLabel={t.common.slug}
            prefixLabel={t.common.ticketPrefix}
            descriptionLabel={t.common.description}
            createLabel={t.common.create}
            slugHelp={t.common.slugHelp}
          />
        </Panel>

        <Panel title={t.admin.workspaces}>
          <table className="table">
            <thead>
              <tr>
                <th>{t.common.title}</th>
                <th>{t.common.ticketPrefix}</th>
                <th>{t.common.members}</th>
                <th>{t.tickets.title}</th>
                <th>{t.common.actions}</th>
              </tr>
            </thead>
            <tbody>
              {data.workspaces.map((workspace) => (
                <tr key={workspace.id}>
                  <td>{workspace.name}</td>
                  <td>{workspace.ticketPrefix}</td>
                  <td>{workspace.memberships.length}</td>
                  <td>{workspace.tickets.length}</td>
                  <td>
                    <form action={toggleWorkspaceArchiveAction}>
                      <input type="hidden" name="workspaceId" value={workspace.id} />
                      <button type="submit" className="ghost-button">
                        {workspace.isArchived ? t.common.active : t.common.archived}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}
