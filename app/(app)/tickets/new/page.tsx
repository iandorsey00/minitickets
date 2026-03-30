import { createTicketAction } from "@/lib/actions";
import { getDefaultDefinitionIds, getDefinitions, getViewerContext } from "@/lib/data";
import { TicketCreateForm } from "@/components/ticket-create-form";
import { PageHeader, Panel } from "@/components/ui";
import { localizeDefinition } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type NewTicketPageProps = {
  searchParams?: Promise<{
    workspaceId?: string;
    parentTicketId?: string;
  }>;
};

export default async function NewTicketPage({ searchParams }: NewTicketPageProps) {
  const query = (await searchParams) ?? {};
  const [context, definitions, defaults] = await Promise.all([
    getViewerContext(),
    getDefinitions(),
    getDefaultDefinitionIds(),
  ]);
  const t = context.dictionary;
  const people = await prisma.user.findMany({
    where: {
      OR: [
        {
          memberships: {
            some: {
              workspaceId: { in: context.accessibleWorkspaceIds },
            },
          },
        },
        {
          role: "ADMIN",
        },
      ],
    },
    include: {
      memberships: {
        where: {
          workspaceId: { in: context.accessibleWorkspaceIds },
        },
        select: {
          workspaceId: true,
        },
      },
    },
    orderBy: { displayName: "asc" },
  });
  const savedPaymentMethods = await prisma.paymentMethod.findMany({
    where: {
      workspaceId: { in: context.accessibleWorkspaceIds },
    },
    orderBy: [{ label: "asc" }, { last4: "asc" }],
  });
  const parentTickets = await prisma.ticket.findMany({
    where: {
      workspaceId: { in: context.accessibleWorkspaceIds },
      parentTicketId: null,
    },
    select: {
      id: true,
      ticketNumber: true,
      title: true,
      workspaceId: true,
    },
    orderBy: { updatedAt: "desc" },
  });
  const inProgressStatus = definitions.statuses.find((item) => item.key === "IN_PROGRESS");
  const requestedParentTicket = parentTickets.find((ticket) => ticket.id === query.parentTicketId) ?? null;
  const defaultWorkspaceId =
    (requestedParentTicket?.workspaceId &&
    context.memberships.some((membership) => membership.workspace.id === requestedParentTicket.workspaceId)
      ? requestedParentTicket.workspaceId
      : null) ??
    (query.workspaceId && context.memberships.some((membership) => membership.workspace.id === query.workspaceId)
      ? query.workspaceId
      : null) ??
    context.currentWorkspace?.id ??
    context.memberships[0]?.workspace.id ??
    "";

  return (
    <>
      <PageHeader title={t.tickets.newTitle} subtitle={t.tickets.createIntro} />
      <Panel>
        <TicketCreateForm
          action={createTicketAction}
          dictionary={t}
          workspaces={context.memberships.map((membership) => ({
            id: membership.workspace.id,
            name: membership.workspace.name,
            paymentInfoEnabled: membership.workspace.paymentInfoEnabled,
          }))}
          people={people.map((person) => ({
            id: person.id,
            displayName: person.displayName,
            workspaceIds: person.memberships.map((membership) => membership.workspaceId),
          }))}
          categories={definitions.categories.filter((item) => item.isActive).map((item) => ({
            id: item.id,
            label: localizeDefinition(item, context.locale),
          }))}
          priorities={definitions.priorities.filter((item) => item.isActive).map((item) => ({
            id: item.id,
            label: localizeDefinition(item, context.locale),
          }))}
          statuses={definitions.statuses.filter((item) => item.isActive).map((item) => ({
            id: item.id,
            label: localizeDefinition(item, context.locale),
          }))}
          paymentMethods={savedPaymentMethods.map((method) => ({
            id: method.id,
            label: method.label,
            last4: method.last4,
            workspaceId: method.workspaceId,
          }))}
          parentTickets={parentTickets}
          defaults={{
            workspaceId: defaultWorkspaceId,
            parentTicketId: requestedParentTicket?.id ?? null,
            categoryId: defaults.categoryId,
            priorityId: defaults.priorityId,
            statusId: defaults.statusId,
            inProgressStatusId: inProgressStatus?.id,
          }}
        />
      </Panel>
    </>
  );
}
