import { deletePaymentMethodAction, toggleWorkspaceArchiveAction, updatePaymentMethodAction, updateWorkspaceAction } from "@/lib/actions";
import { MINI_AUTH_WORKSPACE_SYNC_ENABLED } from "@/lib/auth-config";
import { ArchiveIcon, SaveIcon, TrashIcon } from "@/components/icons";
import { WorkspaceCreateForm } from "@/components/workspace-create-form";
import { getAdminData } from "@/lib/data";
import { PageHeader, Panel, StatusNotice } from "@/components/ui";

export default async function AdminWorkspacesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; payment?: string }>;
}) {
  const data = await getAdminData();
  const query = await searchParams;
  if (!data) {
    return <div />;
  }
  const t = data.dictionary;
  const savedMessage = query.saved === "1" ? t.common.savedChanges : null;
  const paymentMessage =
    query.payment === "invalid"
      ? { label: t.admin.paymentMethodInvalid, tone: "danger" as const }
      : query.payment === "duplicate"
        ? { label: t.admin.paymentMethodDuplicate, tone: "warning" as const }
        : null;
  const miniAuthAdminUrl = process.env.MINIAUTH_BASE_URL?.trim()
    ? `${process.env.MINIAUTH_BASE_URL!.replace(/\/$/, "")}/`
    : null;

  return (
    <>
      <PageHeader title={t.admin.workspaces} subtitle={t.common.workspace} />
      {savedMessage ? <StatusNotice label={savedMessage} tone="success" /> : null}
      {paymentMessage ? <StatusNotice label={paymentMessage.label} tone={paymentMessage.tone} /> : null}
      <div className="grid-2">
        <Panel title={t.admin.createWorkspace}>
          {MINI_AUTH_WORKSPACE_SYNC_ENABLED ? (
            <div className="stack">
              <p className="muted">{t.common.membershipManagedInMiniAuth}</p>
              {miniAuthAdminUrl ? (
                <a className="ghost-button" href={miniAuthAdminUrl}>
                  Open MiniAuth
                </a>
              ) : null}
            </div>
          ) : (
            <WorkspaceCreateForm
              titleLabel={t.common.title}
              slugLabel={t.common.slug}
              prefixLabel={t.common.ticketPrefix}
              descriptionLabel={t.common.description}
              paymentInfoEnabledLabel={t.common.paymentInfoEnabled}
              paymentInfoHelp={t.common.paymentInfoHelp}
              createLabel={t.common.create}
              slugHelp={t.common.slugHelp}
            />
          )}
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
                    {MINI_AUTH_WORKSPACE_SYNC_ENABLED ? (
                      <span className="muted">{workspace.isArchived ? t.common.archived : t.common.active}</span>
                    ) : (
                      <form action={toggleWorkspaceArchiveAction}>
                        <input type="hidden" name="workspaceId" value={workspace.id} />
                        <button type="submit" className="ghost-button">
                          <span className="button-content">
                            <ArchiveIcon className="button-icon" />
                            <span>{workspace.isArchived ? t.common.active : t.common.archived}</span>
                          </span>
                        </button>
                      </form>
                    )}
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
                    readOnly={MINI_AUTH_WORKSPACE_SYNC_ENABLED}
                  />
                </div>
                <div className="field">
                  <label htmlFor={`workspace-slug-${workspace.id}`}>{t.common.slug}</label>
                  <input
                    id={`workspace-slug-${workspace.id}`}
                    name="slug"
                    defaultValue={workspace.slug}
                    required
                    readOnly={MINI_AUTH_WORKSPACE_SYNC_ENABLED}
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
                    readOnly={MINI_AUTH_WORKSPACE_SYNC_ENABLED}
                  />
                </div>
                <label className="checkbox-row" htmlFor={`workspace-payment-info-${workspace.id}`}>
                  <input
                    id={`workspace-payment-info-${workspace.id}`}
                    name="paymentInfoEnabled"
                    type="checkbox"
                    value="yes"
                    defaultChecked={workspace.paymentInfoEnabled}
                  />
                  <span>{t.common.paymentInfoEnabled}</span>
                </label>
                <p className="muted">{t.common.paymentInfoHelp}</p>
                {MINI_AUTH_WORKSPACE_SYNC_ENABLED ? (
                  <p className="muted">{t.common.membershipManagedInMiniAuth}</p>
                ) : null}
                <div>
                  <button type="submit">
                    <span className="button-content">
                      <SaveIcon className="button-icon" />
                      <span>{t.common.save}</span>
                    </span>
                  </button>
                </div>
              </form>
              <div className="helper-links">
                {workspace.paymentMethods.length ? (
                  <div className="stack admin-payment-methods">
                    <strong>{t.admin.savedPaymentMethods}</strong>
                    {workspace.paymentMethods.map((method) => (
                      <div key={method.id} className="admin-payment-method-card">
                        <form action={updatePaymentMethodAction} className="stack">
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="paymentMethodId" value={method.id} />
                          <div className="admin-payment-method-fields">
                            <div className="field">
                              <label htmlFor={`payment-method-label-${method.id}`}>{t.common.paymentLabel}</label>
                              <input
                                id={`payment-method-label-${method.id}`}
                                name="label"
                                defaultValue={method.label}
                                maxLength={60}
                                required
                              />
                            </div>
                            <div className="field">
                              <label htmlFor={`payment-method-last4-${method.id}`}>{t.common.paymentLast4}</label>
                              <input
                                id={`payment-method-last4-${method.id}`}
                                name="last4"
                                defaultValue={method.last4}
                                inputMode="numeric"
                                pattern="\d{4}"
                                maxLength={4}
                                required
                              />
                            </div>
                          </div>
                          <div className="helper-links admin-payment-method-actions">
                            <button type="submit">
                              <span className="button-content">
                                <SaveIcon className="button-icon" />
                                <span>{t.common.save}</span>
                              </span>
                            </button>
                          </div>
                        </form>
                        <form action={deletePaymentMethodAction} className="admin-payment-method-delete">
                          <input type="hidden" name="workspaceId" value={workspace.id} />
                          <input type="hidden" name="paymentMethodId" value={method.id} />
                          <button type="submit" className="ghost-button">
                            <span className="button-content">
                              <TrashIcon className="button-icon" />
                              <span>{t.admin.deletePaymentMethod}</span>
                            </span>
                          </button>
                        </form>
                      </div>
                    ))}
                  </div>
                ) : null}
                {!MINI_AUTH_WORKSPACE_SYNC_ENABLED ? (
                  <form action={toggleWorkspaceArchiveAction}>
                    <input type="hidden" name="workspaceId" value={workspace.id} />
                    <button type="submit" className="ghost-button">
                      <span className="button-content">
                        <ArchiveIcon className="button-icon" />
                        <span>{workspace.isArchived ? t.common.active : t.common.archived}</span>
                      </span>
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
