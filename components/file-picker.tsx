"use client";

import { useId, useState } from "react";

type FilePickerProps = {
  name: string;
  label: string;
  emptyLabel: string;
  required?: boolean;
};

export function FilePicker({ name, label, emptyLabel, required = false }: FilePickerProps) {
  const id = useId();
  const [fileName, setFileName] = useState("");

  return (
    <div className="file-picker">
      <input
        id={id}
        className="sr-only"
        name={name}
        type="file"
        required={required}
        onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")}
      />
      <label htmlFor={id} className="ghost-button file-picker-button">
        {label}
      </label>
      <span className={`file-picker-name ${fileName ? "" : "is-empty"}`}>{fileName || emptyLabel}</span>
    </div>
  );
}
