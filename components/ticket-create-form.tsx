"use client";

import { useMemo, useState } from "react";

type WorkspaceOption = {
  id: string;
  name: string;
};

type PersonOption = {
  id: string;
  displayName: string;
  workspaceIds: string[];
};

type DefinitionOption = {
  id: string;
  label: string;
};

type TicketCreateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  dictionary: {
    common: {
      workspace: string;
      category: string;
      priority: string;
      status: string;
      assignee: string;
      optional: string;
      none: string;
      dueDate: string;
      title: string;
      description: string;
      paymentLabel: string;
      paymentLast4: string;
      submitRequest: string;
    };
  };
  workspaces: WorkspaceOption[];
  people: PersonOption[];
  categories: DefinitionOption[];
  priorities: DefinitionOption[];
  statuses: DefinitionOption[];
  defaults: {
    workspaceId: string;
    categoryId?: string | null;
    priorityId?: string | null;
    statusId?: string | null;
    inProgressStatusId?: string | null;
  };
};

export function TicketCreateForm({
  action,
  dictionary,
  workspaces,
  people,
  categories,
  priorities,
  statuses,
  defaults,
}: TicketCreateFormProps) {
  const [workspaceId, setWorkspaceId] = useState(defaults.workspaceId);
  const [assigneeId, setAssigneeId] = useState("");
  const [statusId, setStatusId] = useState(defaults.statusId ?? statuses[0]?.id ?? "");
  const [statusTouched, setStatusTouched] = useState(false);

  const workspacePeople = useMemo(
    () => people.filter((person) => person.workspaceIds.includes(workspaceId)),
    [people, workspaceId],
  );

  return (
    <form action={action} className="stack">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="workspaceId">{dictionary.common.workspace}</label>
          <select
            id="workspaceId"
            name="workspaceId"
            value={workspaceId}
            onChange={(event) => {
              const nextWorkspaceId = event.target.value;
              const nextWorkspacePeople = people.filter((person) => person.workspaceIds.includes(nextWorkspaceId));
              const assigneeStillAllowed = nextWorkspacePeople.some((person) => person.id === assigneeId);

              setWorkspaceId(nextWorkspaceId);

              if (!assigneeStillAllowed) {
                setAssigneeId("");
                if (!statusTouched) {
                  setStatusId(defaults.statusId ?? statuses[0]?.id ?? "");
                }
              }
            }}
          >
            {workspaces.map((workspace) => (
              <option key={workspace.id} value={workspace.id}>
                {workspace.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="categoryId">{dictionary.common.category}</label>
          <select id="categoryId" name="categoryId" defaultValue={defaults.categoryId ?? categories[0]?.id ?? ""}>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="priorityId">{dictionary.common.priority}</label>
          <select id="priorityId" name="priorityId" defaultValue={defaults.priorityId ?? priorities[0]?.id ?? ""}>
            {priorities.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="statusId">{dictionary.common.status}</label>
          <select
            id="statusId"
            name="statusId"
            value={statusId}
            onChange={(event) => {
              setStatusTouched(true);
              setStatusId(event.target.value);
            }}
          >
            {statuses.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="assigneeId">
            {dictionary.common.assignee} <span className="muted">({dictionary.common.optional})</span>
          </label>
          <select
            id="assigneeId"
            name="assigneeId"
            value={assigneeId}
            onChange={(event) => {
              const nextAssigneeId = event.target.value;
              setAssigneeId(nextAssigneeId);

              if (!statusTouched) {
                setStatusId(
                  nextAssigneeId && defaults.inProgressStatusId
                    ? defaults.inProgressStatusId
                    : defaults.statusId ?? statuses[0]?.id ?? "",
                );
              }
            }}
          >
            <option value="">{dictionary.common.none}</option>
            {workspacePeople.map((person) => (
              <option key={person.id} value={person.id}>
                {person.displayName}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="dueDate">
            {dictionary.common.dueDate} <span className="muted">({dictionary.common.optional})</span>
          </label>
          <input id="dueDate" name="dueDate" type="date" />
        </div>
      </div>
      <div className="field">
        <label htmlFor="title">{dictionary.common.title}</label>
        <input id="title" name="title" required minLength={3} maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor="description">{dictionary.common.description}</label>
        <textarea id="description" name="description" maxLength={5000} />
      </div>
      <div className="form-grid">
        <div className="field">
          <label htmlFor="paymentLabel">
            {dictionary.common.paymentLabel} <span className="muted">({dictionary.common.optional})</span>
          </label>
          <input id="paymentLabel" name="paymentLabel" maxLength={60} placeholder="Visa / Checking" />
        </div>
        <div className="field">
          <label htmlFor="paymentLast4">
            {dictionary.common.paymentLast4} <span className="muted">({dictionary.common.optional})</span>
          </label>
          <input id="paymentLast4" name="paymentLast4" inputMode="numeric" pattern="\d{4}" maxLength={4} />
        </div>
      </div>
      <div>
        <button type="submit">{dictionary.common.submitRequest}</button>
      </div>
    </form>
  );
}
