import { toggleWorkspaceArchiveAction, updateWorkspaceAction } from "@/lib/actions";
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

      <Panel title={t.common.edit}>
        <div className="grid-2">
          {data.workspaces.map((workspace) => (
            <div key={workspace.id} className="panel">
              <form action={updateWorkspaceAction} className="stack">
                <input type="hidden" name="workspaceId" value={workspace.id} />
                <strong>{workspace.name}</strong>
                <div className="field">
                  <label htmlFor={`workspace-name-${workspace.id}`}>{t.common.title}</label>
                  <input
                    id={`workspace-name-${workspace.id}`}
                    name="name"
                    defaultValue={workspace.name}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor={`workspace-slug-${workspace.id}`}>{t.common.slug}</label>
                  <input
                    id={`workspace-slug-${workspace.id}`}
                    name="slug"
                    defaultValue={workspace.slug}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor={`workspace-prefix-${workspace.id}`}>{t.common.ticketPrefix}</label>
                  <input
                    id={`workspace-prefix-${workspace.id}`}
                    name="ticketPrefix"
                    defaultValue={workspace.ticketPrefix ?? ""}
                    maxLength={4}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor={`workspace-description-${workspace.id}`}>{t.common.description}</label>
                  <textarea
                    id={`workspace-description-${workspace.id}`}
                    name="description"
                    defaultValue={workspace.description ?? ""}
                  />
                </div>
                <div>
                  <button type="submit">{t.common.save}</button>
                </div>
              </form>
              <div className="helper-links">
                <form action={toggleWorkspaceArchiveAction}>
                  <input type="hidden" name="workspaceId" value={workspace.id} />
                  <button type="submit" className="ghost-button">
                    {workspace.isArchived ? t.common.active : t.common.archived}
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
