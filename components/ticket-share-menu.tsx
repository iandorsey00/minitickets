"use client";

import { useState } from "react";

import { ShareIcon } from "@/components/icons";

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
        <ShareIcon className="share-menu-icon" />
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
