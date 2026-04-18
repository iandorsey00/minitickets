export function getTicketAssigneeUsers<T extends { id: string; displayName: string }>(ticket: {
  assignees?: Array<{ user: T }>;
  assignee?: T | null;
}): T[] {
  const users: T[] = ticket.assignees?.length
    ? ticket.assignees.map((assignment) => assignment.user)
    : ticket.assignee
      ? [ticket.assignee]
      : [];

  return Array.from(new Map(users.map((user) => [user.id, user])).values()).sort((left, right) =>
    left.displayName.localeCompare(right.displayName, "en"),
  );
}

export function getTicketAssigneeIds<T extends { id: string; displayName: string }>(ticket: {
  assignees?: Array<{ user: T }>;
  assignee?: T | null;
}): string[] {
  return getTicketAssigneeUsers(ticket).map((user) => user.id);
}

export function getTicketRecipientUsers<T extends { id: string; displayName: string }>(ticket: {
  requester: T;
  assignees?: Array<{ user: T }>;
  assignee?: T | null;
}): T[] {
  return Array.from(new Map([ticket.requester, ...getTicketAssigneeUsers(ticket)].map((user) => [user.id, user])).values());
}
