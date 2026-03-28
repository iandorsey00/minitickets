"use client";

import { useMemo, useState } from "react";

type ReminderOption = {
  value: number;
  label: string;
};

type TicketEventFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  ticketId: string;
  labels: {
    title: string;
    notes: string;
    scheduledFor: string;
    reminders: string;
    create: string;
    optional: string;
  };
  reminderOptions: ReminderOption[];
};

export function TicketEventForm({ action, ticketId, labels, reminderOptions }: TicketEventFormProps) {
  const [scheduledLocal, setScheduledLocal] = useState("");
  const scheduledForValue = useMemo(
    () => (scheduledLocal ? new Date(scheduledLocal).toISOString() : ""),
    [scheduledLocal],
  );

  return (
    <form action={action} className="stack">
      <input type="hidden" name="ticketId" value={ticketId} />
      <input type="hidden" name="scheduledFor" value={scheduledForValue} />
      <div className="field">
        <label htmlFor="event-title">{labels.title}</label>
        <input id="event-title" name="title" required minLength={2} maxLength={120} />
      </div>
      <div className="field">
        <label htmlFor="event-scheduled-local">{labels.scheduledFor}</label>
        <input
          id="event-scheduled-local"
          type="datetime-local"
          value={scheduledLocal}
          onChange={(event) => {
            setScheduledLocal(event.target.value);
          }}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="event-notes">
          {labels.notes} <span className="muted">({labels.optional})</span>
        </label>
        <textarea id="event-notes" name="notes" maxLength={2000} />
      </div>
      <div className="field">
        <span>{labels.reminders}</span>
        <div className="event-reminder-options">
          {reminderOptions.map((option) => (
            <label key={option.value} className="checkbox-row">
              <input type="checkbox" name="reminderOffsets" value={String(option.value)} defaultChecked />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </div>
      <div>
        <button type="submit">{labels.create}</button>
      </div>
    </form>
  );
}
