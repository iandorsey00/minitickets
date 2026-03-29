"use client";

import { useState } from "react";

import { createWorkspaceAction } from "@/lib/actions";

function slugifyWorkspaceName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function WorkspaceCreateForm({
  titleLabel,
  slugLabel,
  prefixLabel,
  descriptionLabel,
  paymentInfoEnabledLabel,
  paymentInfoHelp,
  createLabel,
  slugHelp,
}: {
  titleLabel: string;
  slugLabel: string;
  prefixLabel: string;
  descriptionLabel: string;
  paymentInfoEnabledLabel: string;
  paymentInfoHelp: string;
  createLabel: string;
  slugHelp: string;
}) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);

  return (
    <form action={createWorkspaceAction} className="stack">
      <div className="field">
        <label htmlFor="name">{titleLabel}</label>
        <input
          id="name"
          name="name"
          required
          value={name}
          onChange={(event) => {
            const nextName = event.target.value;
            setName(nextName);
            if (!slugEdited) {
              setSlug(slugifyWorkspaceName(nextName));
            }
          }}
        />
      </div>
      <div className="field">
        <label htmlFor="slug">{slugLabel}</label>
        <input
          id="slug"
          name="slug"
          required
          value={slug}
          onChange={(event) => {
            setSlug(event.target.value);
            setSlugEdited(true);
          }}
        />
        <p className="muted">{slugHelp}</p>
      </div>
      <div className="field">
        <label htmlFor="ticketPrefix">{prefixLabel}</label>
        <input id="ticketPrefix" name="ticketPrefix" required maxLength={4} placeholder="SR" />
      </div>
      <div className="field">
        <label htmlFor="description">{descriptionLabel}</label>
        <textarea id="description" name="description" />
      </div>
      <label className="checkbox-row" htmlFor="paymentInfoEnabled">
        <input id="paymentInfoEnabled" name="paymentInfoEnabled" type="checkbox" value="yes" />
        <span>{paymentInfoEnabledLabel}</span>
      </label>
      <p className="muted">{paymentInfoHelp}</p>
      <button type="submit">{createLabel}</button>
    </form>
  );
}
