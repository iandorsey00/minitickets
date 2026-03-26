import { assignMembershipAction, createUserAction, resendUserInviteAction, toggleUserActiveAction } from "@/lib/actions";
import { accentLabelMap, accentValues, localeValues } from "@/lib/constants";
import { getAdminData } from "@/lib/data";
import { Badge, PageHeader, Panel } from "@/components/ui";

export default async function AdminUsersPage() {
  const data = await getAdminData();
  if (!data) {
    return <div />;
  }
  const t = data.dictionary;

  return (
    <>
      <PageHeader title={t.admin.users} subtitle={t.admin.membershipNote} />
      <div className="grid-2">
        <Panel title={t.admin.createUser}>
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
            <button type="submit">{t.common.create}</button>
          </form>
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
                      {t.admin.inviteUser}
                    </button>
                  </form>
                  <form action={toggleUserActiveAction}>
                    <input type="hidden" name="userId" value={user.id} />
                    <button type="submit" className="ghost-button">
                      {user.isActive ? t.common.inactive : t.common.active}
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
            <form key={user.id} action={assignMembershipAction} className="panel">
              <input type="hidden" name="userId" value={user.id} />
              <div className="stack">
                <strong>{user.displayName}</strong>
                <div className="field">
                  <label htmlFor={`workspace-${user.id}`}>{t.common.workspace}</label>
                  <select id={`workspace-${user.id}`} name="workspaceId">
                    {data.workspaces.map((workspace) => (
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
                <button type="submit">{t.common.save}</button>
              </div>
            </form>
          ))}
        </div>
      </Panel>
    </>
  );
}
