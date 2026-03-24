import { createTicketAction } from "@/lib/actions";
import { getDefinitions, getViewerContext } from "@/lib/data";
import { PageHeader, Panel } from "@/components/ui";
import { localizeDefinition } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function NewTicketPage() {
  const [context, definitions] = await Promise.all([getViewerContext(), getDefinitions()]);
  const t = context.dictionary;
  const people = await prisma.user.findMany({
    where: {
      memberships: {
        some: {
          workspaceId: { in: context.accessibleWorkspaceIds },
        },
      },
    },
    orderBy: { displayName: "asc" },
  });

  return (
    <>
      <PageHeader title={t.tickets.newTitle} subtitle={t.tickets.createIntro} />
      <Panel>
        <form action={createTicketAction} className="stack">
          <div className="form-grid">
            <div className="field">
              <label htmlFor="workspaceId">{t.common.workspace}</label>
              <select id="workspaceId" name="workspaceId" defaultValue={context.currentWorkspace?.id ?? ""}>
                {context.memberships.map((membership) => (
                <option key={membership.workspace.id} value={membership.workspace.id}>
                  {membership.workspace.name}
                </option>
              ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="categoryId">{t.common.category}</label>
              <select id="categoryId" name="categoryId">
                {definitions.categories.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>
                    {localizeDefinition(item, context.locale)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="priorityId">{t.common.priority}</label>
              <select id="priorityId" name="priorityId">
                {definitions.priorities.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>
                    {localizeDefinition(item, context.locale)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="statusId">{t.common.status}</label>
              <select id="statusId" name="statusId">
                {definitions.statuses.filter((item) => item.isActive).map((item) => (
                  <option key={item.id} value={item.id}>
                    {localizeDefinition(item, context.locale)}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="assigneeId">
                {t.common.assignee} <span className="muted">({t.common.optional})</span>
              </label>
              <select id="assigneeId" name="assigneeId">
                <option value="">{t.common.none}</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.displayName}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="dueDate">
                {t.common.dueDate} <span className="muted">({t.common.optional})</span>
              </label>
              <input id="dueDate" name="dueDate" type="date" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="title">{t.common.title}</label>
            <input id="title" name="title" required minLength={3} maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="description">{t.common.description}</label>
            <textarea id="description" name="description" required minLength={10} maxLength={5000} />
          </div>
          <div>
            <button type="submit">{t.common.submitRequest}</button>
          </div>
        </form>
      </Panel>
    </>
  );
}
