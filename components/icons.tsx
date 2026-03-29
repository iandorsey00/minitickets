type IconProps = {
  className?: string;
};

function IconBase({
  className,
  children,
  viewBox = "0 0 24 24",
}: IconProps & { children: React.ReactNode; viewBox?: string }) {
  return (
    <span className={className} aria-hidden="true">
      <svg viewBox={viewBox} focusable="false" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

export function TicketIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M5 8.25a2.25 2.25 0 0 1 2.25-2.25h9.5A2.25 2.25 0 0 1 19 8.25V10a1.75 1.75 0 1 0 0 3.5v1.75A2.25 2.25 0 0 1 16.75 17.5h-9.5A2.25 2.25 0 0 1 5 15.25V13.5a1.75 1.75 0 1 0 0-3.5V8.25Z" />
      <path d="M9 9.5h5" />
      <path d="M9 13h6" />
    </IconBase>
  );
}

export function DashboardIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M4.5 16a7.5 7.5 0 1 1 15 0" />
      <path d="m12 12 4-4" />
      <circle cx="12" cy="12" r="1.25" />
    </IconBase>
  );
}

export function WorkspaceIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <rect x="4.5" y="4.5" width="6.5" height="6.5" rx="1.25" />
      <rect x="13" y="4.5" width="6.5" height="6.5" rx="1.25" />
      <rect x="4.5" y="13" width="6.5" height="6.5" rx="1.25" />
      <rect x="13" y="13" width="6.5" height="6.5" rx="1.25" />
    </IconBase>
  );
}

export function AdminIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 4.5v2.25" />
      <path d="M12 17.25v2.25" />
      <path d="m6.7 6.7 1.6 1.6" />
      <path d="m15.7 15.7 1.6 1.6" />
      <path d="M4.5 12h2.25" />
      <path d="M17.25 12h2.25" />
      <path d="m6.7 17.3 1.6-1.6" />
      <path d="m15.7 8.3 1.6-1.6" />
    </IconBase>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <circle cx="12" cy="12" r="2.5" />
      <path d="M12 4.5v2" />
      <path d="M12 17.5v2" />
      <path d="m6.7 6.7 1.4 1.4" />
      <path d="m15.9 15.9 1.4 1.4" />
      <path d="M4.5 12h2" />
      <path d="M17.5 12h2" />
      <path d="m6.7 17.3 1.4-1.4" />
      <path d="m15.9 8.1 1.4-1.4" />
      <circle cx="12" cy="12" r="6" />
    </IconBase>
  );
}

export function CommentIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M6.75 6.5h10.5A2.75 2.75 0 0 1 20 9.25v5.5a2.75 2.75 0 0 1-2.75 2.75H11l-3.75 2.75v-2.75H6.75A2.75 2.75 0 0 1 4 14.75v-5.5A2.75 2.75 0 0 1 6.75 6.5Z" />
    </IconBase>
  );
}

export function UploadIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M12 15V5.75" />
      <path d="m8.75 9 3.25-3.25L15.25 9" />
      <path d="M5.5 18.25h13" />
    </IconBase>
  );
}

export function DocumentIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M8.5 3.75h6l4 4v12a1.75 1.75 0 0 1-1.75 1.75h-8.5A1.75 1.75 0 0 1 6.5 19.75v-14A2 2 0 0 1 8.5 3.75Z" />
      <path d="M14.5 3.75v4h4" />
      <path d="M9.5 12h5" />
      <path d="M9.5 15h5" />
    </IconBase>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="m4.75 16.75 8.9-8.9 3.5 3.5-8.9 8.9-3.75.25.25-3.75Z" />
      <path d="m12.9 8.6 2.5-2.5a1.75 1.75 0 0 1 2.47 0l.03.03a1.75 1.75 0 0 1 0 2.47l-2.5 2.5" />
    </IconBase>
  );
}

export function SaveIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M5.75 4.5h10.5l2.25 2.25v11A1.75 1.75 0 0 1 16.75 19.5h-9.5A1.75 1.75 0 0 1 5.5 17.75V5.25A.75.75 0 0 1 6.25 4.5Z" />
      <path d="M8 4.5v4h7v-4" />
      <path d="M8.5 14.25h7" />
    </IconBase>
  );
}

export function ArchiveIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M4.5 7.25h15" />
      <path d="M6.25 5.25h11.5A1.25 1.25 0 0 1 19 6.5v1.25H5V6.5a1.25 1.25 0 0 1 1.25-1.25Z" />
      <path d="M6.5 8.5v9a1.5 1.5 0 0 0 1.5 1.5h8a1.5 1.5 0 0 0 1.5-1.5v-9" />
      <path d="M10 12h4" />
    </IconBase>
  );
}

export function TrashIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path d="M5.5 7.25h13" />
      <path d="M9 7.25V5.5h6v1.75" />
      <path d="M7.5 7.25 8.25 18A1.5 1.5 0 0 0 9.75 19.5h4.5A1.5 1.5 0 0 0 15.75 18l.75-10.75" />
      <path d="M10 10.5v5.5" />
      <path d="M14 10.5v5.5" />
    </IconBase>
  );
}
