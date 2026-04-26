"use client";

import { useMemo, useState } from "react";

type ReminderOption = {
  value: number;
  label: string;
};

type TicketEventFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  ticketId: string;
  eventId?: string;
  labels: {
    title: string;
    notes: string;
    scheduledFor: string;
    allDay: string;
    reminders: string;
    submit: string;
    optional: string;
    reminderMonths: string;
    reminderWeeks: string;
    reminderDays: string;
    reminderHours: string;
    reminderMinutes: string;
    reminderAtTime: string;
  };
  reminderOptions: ReminderOption[];
  initialValues?: {
    title?: string;
    notes?: string;
    scheduledFor?: string;
    allDay?: boolean;
    selectedReminderOffsets?: number[];
  };
};

function getDefaultEventSchedule(initialScheduledFor?: string, initialAllDay?: boolean) {
  if (initialScheduledFor) {
    const initialDate = new Date(initialScheduledFor);
    if (!Number.isNaN(initialDate.getTime())) {
      if (initialAllDay) {
        return {
          date: initialDate.toISOString().slice(0, 10),
          hour: "09",
          minute: "00",
        };
      }

      return {
        date: `${String(initialDate.getFullYear()).padStart(4, "0")}-${String(initialDate.getMonth() + 1).padStart(2, "0")}-${String(initialDate.getDate()).padStart(2, "0")}`,
        hour: String(initialDate.getHours()).padStart(2, "0"),
        minute: String(initialDate.getMinutes()).padStart(2, "0"),
      };
    }
  }

  const now = new Date();
  const rounded = new Date(now);
  rounded.setHours(rounded.getHours() + 1, 0, 0, 0);

  return {
    date: `${String(rounded.getFullYear()).padStart(4, "0")}-${String(rounded.getMonth() + 1).padStart(2, "0")}-${String(rounded.getDate()).padStart(2, "0")}`,
    hour: String(rounded.getHours()).padStart(2, "0"),
    minute: "00",
  };
}

function getReminderGroup(offsetMinutes: number) {
  const monthMinutes = 30 * 24 * 60;
  const weekMinutes = 7 * 24 * 60;
  const dayMinutes = 24 * 60;

  if (offsetMinutes === 0) {
    return "atTime";
  }
  if (offsetMinutes === monthMinutes || offsetMinutes === monthMinutes * 2) {
    return "months";
  }
  if (offsetMinutes >= weekMinutes && Number.isInteger(offsetMinutes / weekMinutes)) {
    return "weeks";
  }
  if (offsetMinutes >= dayMinutes && Number.isInteger(offsetMinutes / dayMinutes)) {
    return "days";
  }
  if (offsetMinutes >= 60 && Number.isInteger(offsetMinutes / 60)) {
    return "hours";
  }
  return "minutes";
}

export function TicketEventForm({ action, ticketId, eventId, labels, reminderOptions, initialValues }: TicketEventFormProps) {
  const [defaultSchedule] = useState(() => getDefaultEventSchedule(initialValues?.scheduledFor, initialValues?.allDay));
  const [allDay, setAllDay] = useState(initialValues?.allDay ?? false);
  const [scheduledDate, setScheduledDate] = useState(defaultSchedule.date);
  const [scheduledHour, setScheduledHour] = useState(defaultSchedule.hour);
  const [scheduledMinute, setScheduledMinute] = useState(defaultSchedule.minute);
  const selectedReminderOffsets = new Set(initialValues?.selectedReminderOffsets ?? []);

  const scheduledForValue = useMemo(
    () => {
      if (!scheduledDate) {
        return "";
      }

      if (allDay) {
        return `${scheduledDate}T12:00:00.000Z`;
      }

      const localValue = `${scheduledDate}T${scheduledHour}:${scheduledMinute}`;
      const parsed = new Date(localValue);
      return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
    },
    [allDay, scheduledDate, scheduledHour, scheduledMinute],
  );

  const reminderGroups = useMemo(
    () => [
      { key: "months", label: labels.reminderMonths },
      { key: "weeks", label: labels.reminderWeeks },
      { key: "days", label: labels.reminderDays },
      { key: "hours", label: labels.reminderHours },
      { key: "minutes", label: labels.reminderMinutes },
      { key: "atTime", label: labels.reminderAtTime },
    ].map((group) => ({
      ...group,
      options: reminderOptions.filter((option) => getReminderGroup(option.value) === group.key),
    })).filter((group) => {
      if (!group.options.length) {
        return false;
      }

      if (!allDay) {
        return true;
      }

      return !["hours", "minutes"].includes(group.key);
    }),
    [allDay, labels.reminderAtTime, labels.reminderDays, labels.reminderHours, labels.reminderMinutes, labels.reminderMonths, labels.reminderWeeks, reminderOptions],
  );

  return (
    <form action={action} className="stack">
      <input type="hidden" name="ticketId" value={ticketId} />
      {eventId ? <input type="hidden" name="eventId" value={eventId} /> : null}
      <input type="hidden" name="scheduledFor" value={scheduledForValue} />
      <input type="hidden" name="allDay" value={allDay ? "true" : "false"} />
      <div className="field">
        <label htmlFor="event-title">{labels.title}</label>
        <input id="event-title" name="title" required minLength={2} maxLength={120} defaultValue={initialValues?.title ?? ""} />
      </div>
      <div className="field">
        <label htmlFor="event-scheduled-local">{labels.scheduledFor}</label>
        <label className="checkbox-row event-all-day-toggle">
          <input
            type="checkbox"
            checked={allDay}
            onChange={(event) => {
              setAllDay(event.target.checked);
            }}
          />
          <span>{labels.allDay}</span>
        </label>
        <div className="split-inputs">
          <div className="split-date-inputs" id="event-scheduled-local">
            <input
              type="date"
              aria-label={labels.scheduledFor}
              value={scheduledDate}
              onChange={(event) => {
                setScheduledDate(event.target.value);
              }}
            />
          </div>
          {allDay ? null : (
            <div className="split-time-inputs">
              <input
                type="time"
                aria-label={`${labels.scheduledFor} time`}
                value={`${scheduledHour}:${scheduledMinute}`}
                step={60}
                onChange={(event) => {
                  const [nextHour = "00", nextMinute = "00"] = event.target.value.split(":");
                  setScheduledHour(nextHour);
                  setScheduledMinute(nextMinute);
                }}
              />
            </div>
          )}
        </div>
      </div>
      <div className="field">
        <label htmlFor="event-notes">
          {labels.notes} <span className="muted">({labels.optional})</span>
        </label>
        <textarea id="event-notes" name="notes" maxLength={2000} defaultValue={initialValues?.notes ?? ""} />
      </div>
      <div className="field">
        <span>{labels.reminders}</span>
        <div className="event-reminder-groups">
          {reminderGroups.map((group) => (
            <div key={group.key} className="event-reminder-group">
              <div className="event-reminder-group-label">{group.label}</div>
              <div className="event-reminder-options">
                {group.options.map((option) => (
                  <label key={option.value} className="checkbox-row">
                    <input
                      type="checkbox"
                      name="reminderOffsets"
                      value={String(option.value)}
                      defaultChecked={selectedReminderOffsets.has(option.value)}
                    />
                    <span>{option.label}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
      <div>
        <button type="submit">{labels.submit}</button>
      </div>
    </form>
  );
}
