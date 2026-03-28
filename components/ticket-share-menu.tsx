"use client";

import { useState } from "react";

type TicketShareMenuProps = {
  label: string;
  copiedLabel: string;
  copyTitleLabel: string;
  copySummaryLabel: string;
  copyThreadLabel: string;
  titleText: string;
  summaryText: string;
  threadText: string;
};

export function TicketShareMenu({
  label,
  copiedLabel,
  copyTitleLabel,
  copySummaryLabel,
  copyThreadLabel,
  titleText,
  summaryText,
  threadText,
}: TicketShareMenuProps) {
  const [status, setStatus] = useState<string | null>(null);

  async function copyText(value: string) {
    await navigator.clipboard.writeText(value);
    setStatus(copiedLabel);
    window.setTimeout(() => setStatus(null), 1800);
  }

  return (
    <details className="share-menu">
      <summary className="ghost-button share-menu-trigger">
        <span className="share-menu-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" focusable="false">
            <path
              d="M15 8a3 3 0 1 0-2.82-4H12a3 3 0 0 0 .18 1.02l-5.4 3.15a3 3 0 0 0-1.96-.72 3 3 0 1 0 1.97 5.26l5.4 3.14A3 3 0 0 0 12 16a3 3 0 1 0 .18 1.02l-5.4-3.15c.14-.27.24-.56.29-.87h.01a3 3 0 0 0-.3-.87l5.4-3.15A3 3 0 0 0 15 8Z"
              fill="currentColor"
            />
          </svg>
        </span>
        <span>{label}</span>
      </summary>
      <div className="share-menu-popover">
        <button type="button" className="share-menu-item" onClick={() => copyText(titleText)}>
          {copyTitleLabel}
        </button>
        <button type="button" className="share-menu-item" onClick={() => copyText(summaryText)}>
          {copySummaryLabel}
        </button>
        <button type="button" className="share-menu-item" onClick={() => copyText(threadText)}>
          {copyThreadLabel}
        </button>
        {status ? <p className="share-menu-status">{status}</p> : null}
      </div>
    </details>
  );
}
