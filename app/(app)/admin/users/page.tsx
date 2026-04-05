import {
  assignMembershipAction,
  createUserAction,
  removeMembershipAction,
  resendUserInviteAction,
  toggleUserActiveAction,
} from "@/lib/actions";
import { MINI_AUTH_WORKSPACE_SYNC_ENABLED } from "@/lib/auth-config";
import { MailIcon, PlusIcon, PowerIcon, SaveIcon, TrashIcon } from "@/components/icons";
import { accentLabelMap, accentValues, localeValues } from "@/lib/constants";
import { getAdminData } from "@/lib/data";
import { Badge, PageHeader, Panel } from "@/components/ui";

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ shared?: string }>;
}) {
  const data = await getAdminData();
  await searchParams;
  if (!data) {
    return <div />;
  }
  const t = data.dictionary;
  const miniAuthAdminUrl = process.env.MINIAUTH_BASE_URL?.trim()
    ? `${process.env.MINIAUTH_BASE_URL!.replace(/\/$/, "")}/`
    : null;

  return (
    <>
      <PageHeader title={t.admin.users} subtitle={t.admin.membershipNote} />
      {MINI_AUTH_WORKSPACE_SYNC_ENABLED ? (
        <Panel title="MiniAuth">
          <p className="muted">{t.common.membershipManagedInMiniAuth}</p>
          {miniAuthAdminUrl ? (
            <a className="ghost-button" href={miniAuthAdminUrl}>
              Open MiniAuth
            </a>
          ) : null}
        </Panel>
      ) : null}
      <div className="grid-2">
        <Panel title={t.admin.createUser}>
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
            <form action={createUserAction} className="stack">
              <div className="field">
                <label htmlFor="displayName">{t.common.displayName}</label>
                <input id="displayName" name="displayName" required />
              </div>
              <div className="field">
                <label htmlFor="email">{t.auth.email}</label>
                <input id="email" name="email" type="email" required />
              </div>
              <div className="field">
                <label htmlFor="locale">{t.common.language}</label>
                <select id="locale" name="locale" defaultValue="ZH_CN">
                  {localeValues.map((locale) => (
                    <option key={locale} value={locale}>
                      {locale === "ZH_CN" ? "简体中文" : "English"}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="accentColor">{t.common.accentColor}</label>
                <select id="accentColor" name="accentColor" defaultValue="BLUE">
                  {accentValues.map((accent) => (
                    <option key={accent} value={accent}>
                      {data.locale === "ZH_CN" ? accentLabelMap[accent].zh : accentLabelMap[accent].en}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="role">{t.common.role}</label>
                <select id="role" name="role" defaultValue="USER">
                  <option value="USER">{t.common.member}</option>
                  <option value="ADMIN">{t.common.adminRole}</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="workspaceId">{t.common.workspace}</label>
                <select id="workspaceId" name="workspaceId" required>
                  <option value="" disabled defaultValue="">
                    {t.common.workspace}
                  </option>
                  {data.workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="workspaceRole">{t.common.workspaceRole}</label>
                <select id="workspaceRole" name="workspaceRole" defaultValue="MEMBER">
                  <option value="MEMBER">{t.common.member}</option>
                  <option value="ADMIN">{t.common.adminRole}</option>
                </select>
              </div>
              <p className="muted">{t.admin.inviteHelp}</p>
              <button type="submit">
                <span className="button-content">
                  <PlusIcon className="button-icon" />
                  <span>{t.common.create}</span>
                </span>
              </button>
            </form>
          )}
        </Panel>

        <Panel title={t.admin.users}>
          <div className="list">
            {data.users.map((user) => (
              <div key={user.id} className="list-row admin-user-row">
                <div className="stack">
                  <strong>{user.displayName}</strong>
                  <div className="row-meta">{user.email}</div>
                  <div>
                    <Badge label={user.locale === "ZH_CN" ? "简体中文" : "English"} tone="neutral" />
                  </div>
                </div>
                <div className="helper-links admin-user-actions">
                  <form action={resendUserInviteAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button type="submit" className="ghost-button">
                      <span className="button-content">
                        <MailIcon className="button-icon" />
                        <span>{t.admin.inviteUser}</span>
                      </span>
                    </button>
                  </form>
                  <form action={toggleUserActiveAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button type="submit" className="ghost-button">
                      <span className="button-content">
                        <PowerIcon className="button-icon" />
                        <span>{user.isActive ? t.common.inactive : t.common.active}</span>
                      </span>
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title={t.common.members}>
        <div className="grid-2">
          {data.users.map((user) => (
            <div key={user.id} className="panel">
              <div className="stack">
                <strong>{user.displayName}</strong>
                <div className="stack" style={{ gap: "0.6rem" }}>
                  <span className="muted">{t.admin.currentMemberships}</span>
                  {user.memberships.length ? (
                    <div className="helper-links" style={{ flexWrap: "wrap", gap: "0.5rem" }}>
                      {user.memberships.map((membership) => (
                        MINI_AUTH_WORKSPACE_SYNC_ENABLED ? (
                          <Badge
                            key={`${user.id}-${membership.workspaceId}`}
                            label={`${membership.workspace.name} · ${
                              membership.role === "ADMIN" ? t.common.adminRole : t.common.member
                            }`}
                            tone="neutral"
                          />
                        ) : (
                          <form
                            key={`${user.id}-${membership.workspaceId}`}
                            action={removeMembershipAction}
                            style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                          >
                            <input type="hidden" name="userId" value={user.id} />
                            <input type="hidden" name="workspaceId" value={membership.workspaceId} />
                            <Badge
                              label={`${membership.workspace.name} · ${
                                membership.role === "ADMIN" ? t.common.adminRole : t.common.member
                              }`}
                              tone="neutral"
                            />
                            <button type="submit" className="ghost-button">
                              <span className="button-content">
                                <TrashIcon className="button-icon" />
                                <span>{t.admin.removeMembership}</span>
                              </span>
                            </button>
                          </form>
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="muted">{t.states.emptySearch}</div>
                  )}
                </div>
                {MINI_AUTH_WORKSPACE_SYNC_ENABLED ? (
                  <p className="muted">{t.common.membershipManagedInMiniAuth}</p>
                ) : (
                  <form action={assignMembershipAction} className="stack">
                    <input type="hidden" name="userId" value={user.id} />
                    <div className="field">
                      <label htmlFor={`workspace-${user.id}`}>{t.admin.addMembership}</label>
                      <select id={`workspace-${user.id}`} name="workspaceId">
                        {data.workspaces
                          .filter(
                            (workspace) =>
                              !user.memberships.some((membership) => membership.workspaceId === workspace.id),
                          )
                          .map((workspace) => (
                            <option key={workspace.id} value={workspace.id}>
                              {workspace.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`workspace-role-${user.id}`}>{t.common.role}</label>
                      <select id={`workspace-role-${user.id}`} name="role">
                        <option value="MEMBER">{t.common.member}</option>
                        <option value="ADMIN">{t.common.adminRole}</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      disabled={data.workspaces.every((workspace) =>
                        user.memberships.some((membership) => membership.workspaceId === workspace.id),
                      )}
                    >
                      <span className="button-content">
                        <SaveIcon className="button-icon" />
                        <span>{t.common.save}</span>
                      </span>
                    </button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}
