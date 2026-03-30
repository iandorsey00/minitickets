"use client";

import { useId, useRef, useState } from "react";

type FilePickerProps = {
  name: string;
  label: string;
  emptyLabel: string;
  dropLabel?: string;
  required?: boolean;
};

export function FilePicker({ name, label, emptyLabel, dropLabel, required = false }: FilePickerProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState("");
  const [isDragActive, setIsDragActive] = useState(false);

  function handleFiles(fileList: FileList | null) {
    const file = fileList?.[0] ?? null;
    setFileName(file?.name ?? "");

    if (!file || !inputRef.current) {
      return;
    }

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    inputRef.current.files = dataTransfer.files;
  }

  return (
    <div
      className={`file-picker ${isDragActive ? "is-drag-active" : ""}`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        setIsDragActive(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) {
          return;
        }

        setIsDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragActive(false);
        handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        id={id}
        ref={inputRef}
        className="sr-only"
        name={name}
        type="file"
        required={required}
        onChange={(event) => handleFiles(event.target.files)}
      />
      <label htmlFor={id} className="ghost-button file-picker-button">
        {label}
      </label>
      <div className="file-picker-copy">
        <span className={`file-picker-name ${fileName ? "" : "is-empty"}`}>{fileName || emptyLabel}</span>
        {dropLabel ? <span className="file-picker-hint">{dropLabel}</span> : null}
      </div>
    </div>
  );
}
