"use client";

import { useMemo, useState } from "react";

import { PencilIcon } from "@/components/icons";

type WorkspaceOption = {
  id: string;
  name: string;
  paymentInfoEnabled: boolean;
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

type PaymentMethodOption = {
  id: string;
  label: string;
  last4: string;
  workspaceId: string;
};

type ParentTicketOption = {
  id: string;
  ticketNumber: string;
  title: string;
  workspaceId: string;
};

type TicketCreateFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  dictionary: {
    common: {
      workspace: string;
      parentTicket: string;
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
      paymentMethods: string;
      savePaymentMethod: string;
      noSavedPaymentMethods: string;
      chooseFile: string;
      noFileSelected: string;
      submitRequest: string;
      topLevelOnlyHint: string;
    };
    tickets: {
      confidentialityNotice: string;
    };
  };
  workspaces: WorkspaceOption[];
  people: PersonOption[];
  priorities: DefinitionOption[];
  statuses: DefinitionOption[];
  paymentMethods: PaymentMethodOption[];
  parentTickets: ParentTicketOption[];
  defaults: {
    workspaceId: string;
    parentTicketId?: string | null;
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
  priorities,
  statuses,
  paymentMethods,
  parentTickets,
  defaults,
}: TicketCreateFormProps) {
  const [workspaceId, setWorkspaceId] = useState(defaults.workspaceId);
  const [assigneeId, setAssigneeId] = useState("");
  const [parentTicketId, setParentTicketId] = useState(defaults.parentTicketId ?? "");
  const [statusId, setStatusId] = useState(defaults.statusId ?? statuses[0]?.id ?? "");
  const [statusTouched, setStatusTouched] = useState(false);

  const workspacePeople = useMemo(
    () => people.filter((person) => person.workspaceIds.includes(workspaceId)),
    [people, workspaceId],
  );
  const workspacePaymentMethods = useMemo(
    () => paymentMethods.filter((method) => method.workspaceId === workspaceId),
    [paymentMethods, workspaceId],
  );
  const paymentInfoEnabled = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId)?.paymentInfoEnabled ?? false,
    [workspaces, workspaceId],
  );
  const workspaceParentTickets = useMemo(
    () => parentTickets.filter((ticket) => ticket.workspaceId === workspaceId),
    [parentTickets, workspaceId],
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
              setParentTicketId("");

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
          <label htmlFor="parentTicketId">
            {dictionary.common.parentTicket} <span className="muted">({dictionary.common.optional})</span>
          </label>
          <select
            id="parentTicketId"
            name="parentTicketId"
            value={parentTicketId}
            onChange={(event) => setParentTicketId(event.target.value)}
          >
            <option value="">{dictionary.common.none}</option>
            {workspaceParentTickets.map((ticket) => (
              <option key={ticket.id} value={ticket.id}>
                {ticket.ticketNumber} · {ticket.title}
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
          <input
            id="dueDate"
            name="dueDate"
            type="date"
          />
        </div>
      </div>
      <p className="muted form-grid-note">{dictionary.common.topLevelOnlyHint}</p>
      <div className="field">
        <label htmlFor="title">{dictionary.common.title}</label>
        <input id="title" name="title" required minLength={3} maxLength={120} />
      </div>
      <details className="create-ticket-disclosure" open={false}>
        <summary>
          <span>{dictionary.common.description}</span>
          <span className="muted">({dictionary.common.optional})</span>
        </summary>
        <div className="field">
          <label htmlFor="description" className="sr-only">
            {dictionary.common.description}
          </label>
          <textarea id="description" name="description" maxLength={5000} />
          <p className="caution-text">{dictionary.tickets.confidentialityNotice}</p>
        </div>
      </details>
      {paymentInfoEnabled ? (
        <>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="savedPaymentMethodIds">
                {dictionary.common.paymentMethods} <span className="muted">({dictionary.common.optional})</span>
              </label>
              <select id="savedPaymentMethodIds" name="savedPaymentMethodIds" multiple size={Math.min(4, Math.max(2, workspacePaymentMethods.length || 2))}>
                {workspacePaymentMethods.map((method) => (
                  <option key={method.id} value={method.id}>
                    {method.label} · {method.last4}
                  </option>
                ))}
              </select>
              {!workspacePaymentMethods.length ? <p className="muted">{dictionary.common.noSavedPaymentMethods}</p> : null}
            </div>
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
          <div className="field">
            <label>
              <input type="checkbox" name="savePaymentMethod" value="yes" style={{ width: "auto", marginRight: "0.55rem" }} />
              {dictionary.common.savePaymentMethod}
            </label>
          </div>
        </>
      ) : null}
      <div>
        <button type="submit">
          <span className="button-content">
            <PencilIcon className="button-icon" />
            <span>{dictionary.common.submitRequest}</span>
          </span>
        </button>
      </div>
    </form>
  );
}
