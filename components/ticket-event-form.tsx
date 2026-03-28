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

function getDefaultEventSchedule() {
  const now = new Date();
  const rounded = new Date(now);
  rounded.setSeconds(0, 0);
  rounded.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);

  if (rounded.getMinutes() === 60) {
    rounded.setHours(rounded.getHours() + 1, 0, 0, 0);
  }

  return {
    date: rounded.toISOString().slice(0, 10),
    hour: String(rounded.getHours()).padStart(2, "0"),
    minute: String(rounded.getMinutes()).padStart(2, "0"),
  };
}

export function TicketEventForm({ action, ticketId, labels, reminderOptions }: TicketEventFormProps) {
  const [defaultSchedule] = useState(getDefaultEventSchedule);
  const [scheduledDate, setScheduledDate] = useState(defaultSchedule.date);
  const [scheduledHour, setScheduledHour] = useState(defaultSchedule.hour);
  const [scheduledMinute, setScheduledMinute] = useState(defaultSchedule.minute);

  const scheduledForValue = useMemo(
    () => {
      if (!scheduledDate) {
        return "";
      }

      const localValue = `${scheduledDate}T${scheduledHour}:${scheduledMinute}`;
      const parsed = new Date(localValue);
      return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
    },
    [scheduledDate, scheduledHour, scheduledMinute],
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
        <div className="split-inputs">
          <input
            id="event-scheduled-local"
            type="date"
            value={scheduledDate}
            onChange={(event) => {
              setScheduledDate(event.target.value);
            }}
            required
          />
          <div className="split-time-inputs">
            <select
              aria-label={`${labels.scheduledFor} hour`}
              value={scheduledHour}
              onChange={(event) => {
                setScheduledHour(event.target.value);
              }}
            >
              {Array.from({ length: 24 }, (_, index) => {
                const value = String(index).padStart(2, "0");
                return (
                  <option key={value} value={value}>
                    {value}
                  </option>
                );
              })}
            </select>
            <span className="muted time-separator" aria-hidden="true">
              :
            </span>
            <select
              aria-label={`${labels.scheduledFor} minute`}
              value={scheduledMinute}
              onChange={(event) => {
                setScheduledMinute(event.target.value);
              }}
            >
              {Array.from({ length: 60 }, (_, index) => {
                const value = String(index).padStart(2, "0");
                return (
                  <option key={value} value={value}>
                    {value}
                  </option>
                );
              })}
            </select>
          </div>
        </div>
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
              <input type="checkbox" name="reminderOffsets" value={String(option.value)} />
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
