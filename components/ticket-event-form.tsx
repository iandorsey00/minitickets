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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export function TicketEventForm({ action, ticketId, labels, reminderOptions }: TicketEventFormProps) {
  const [defaultSchedule] = useState(getDefaultEventSchedule);
  const [scheduledYear, setScheduledYear] = useState(Number(defaultSchedule.date.slice(0, 4)));
  const [scheduledMonth, setScheduledMonth] = useState(Number(defaultSchedule.date.slice(5, 7)));
  const [scheduledDay, setScheduledDay] = useState(Number(defaultSchedule.date.slice(8, 10)));
  const [scheduledHour, setScheduledHour] = useState(defaultSchedule.hour);
  const [scheduledMinute, setScheduledMinute] = useState(defaultSchedule.minute);

  const yearOptions = useMemo(() => {
    const baseYear = Number(defaultSchedule.date.slice(0, 4));
    return Array.from({ length: 6 }, (_, index) => baseYear - 1 + index);
  }, [defaultSchedule.date]);

  const dayOptions = useMemo(() => {
    const totalDays = getDaysInMonth(scheduledYear, scheduledMonth);
    return Array.from({ length: totalDays }, (_, index) => index + 1);
  }, [scheduledYear, scheduledMonth]);

  const safeScheduledDay = Math.min(scheduledDay, getDaysInMonth(scheduledYear, scheduledMonth));

  const scheduledDate = useMemo(
    () =>
      `${String(scheduledYear).padStart(4, "0")}-${String(scheduledMonth).padStart(2, "0")}-${String(
        safeScheduledDay,
      ).padStart(2, "0")}`,
    [safeScheduledDay, scheduledMonth, scheduledYear],
  );

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
          <div className="split-date-inputs" id="event-scheduled-local">
            <select
              aria-label={`${labels.scheduledFor} year`}
              value={String(scheduledYear)}
              onChange={(event) => {
                setScheduledYear(Number(event.target.value));
              }}
            >
              {yearOptions.map((year) => (
                <option key={year} value={String(year)}>
                  {year}
                </option>
              ))}
            </select>
            <select
              aria-label={`${labels.scheduledFor} month`}
              value={String(scheduledMonth)}
              onChange={(event) => {
                setScheduledMonth(Number(event.target.value));
              }}
            >
              {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                <option key={month} value={String(month)}>
                  {String(month).padStart(2, "0")}
                </option>
              ))}
            </select>
            <select
              aria-label={`${labels.scheduledFor} day`}
              value={String(safeScheduledDay)}
              onChange={(event) => {
                setScheduledDay(Number(event.target.value));
              }}
            >
              {dayOptions.map((day) => (
                <option key={day} value={String(day)}>
                  {String(day).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
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
