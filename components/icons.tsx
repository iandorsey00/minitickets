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
      <svg viewBox={viewBox} focusable="false">
        {children}
      </svg>
    </span>
  );
}

export function TicketIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path
        d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v3a1.5 1.5 0 1 0 0 3v3a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 15.5v-3a1.5 1.5 0 1 0 0-3v-3Zm4 1a.75.75 0 0 0 0 1.5h5a.75.75 0 0 0 0-1.5H8Zm0 4a.75.75 0 0 0 0 1.5h8a.75.75 0 0 0 0-1.5H8Z"
        fill="currentColor"
      />
    </IconBase>
  );
}

export function DashboardIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path
        d="M12 5a9 9 0 1 0 9 9h-2a7 7 0 1 1-2.05-4.95l-4.42 4.42a2.5 2.5 0 1 0 1.41 1.41l4.77-4.77A8.95 8.95 0 0 0 12 5Z"
        fill="currentColor"
      />
    </IconBase>
  );
}

export function WorkspaceIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path
        d="M4 5.5A1.5 1.5 0 0 1 5.5 4h5A1.5 1.5 0 0 1 12 5.5v5A1.5 1.5 0 0 1 10.5 12h-5A1.5 1.5 0 0 1 4 10.5v-5Zm8 0A1.5 1.5 0 0 1 13.5 4h5A1.5 1.5 0 0 1 20 5.5v5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 12 10.5v-5Zm-8 8A1.5 1.5 0 0 1 5.5 12h5A1.5 1.5 0 0 1 12 13.5v5a1.5 1.5 0 0 1-1.5 1.5h-5A1.5 1.5 0 0 1 4 18.5v-5Zm8 0A1.5 1.5 0 0 1 13.5 12h5a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-5a1.5 1.5 0 0 1-1.5-1.5v-5Z"
        fill="currentColor"
      />
    </IconBase>
  );
}

export function AdminIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path
        d="m13.93 3.5 1.14 2.3 2.54.37a1 1 0 0 1 .56 1.7l-1.84 1.79.43 2.53a1 1 0 0 1-1.45 1.05L13 12.05l-2.27 1.19a1 1 0 0 1-1.45-1.05l.43-2.53L7.87 7.87a1 1 0 0 1 .56-1.7l2.54-.37 1.14-2.3a1 1 0 0 1 1.82 0ZM6 14.5h12l1.4 4.2a1 1 0 0 1-.95 1.3H5.55a1 1 0 0 1-.95-1.3L6 14.5Z"
        fill="currentColor"
      />
    </IconBase>
  );
}

export function SettingsIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path
        d="m10.88 3.26.35 1.5a7.7 7.7 0 0 1 1.54 0l.35-1.5a1 1 0 0 1 1.2-.74l1.5.37a1 1 0 0 1 .72 1.23l-.43 1.46c.4.3.78.64 1.12 1.02l1.4-.54a1 1 0 0 1 1.3.56l.63 1.42a1 1 0 0 1-.5 1.31l-1.35.63c.06.5.06 1.01 0 1.52l1.35.63a1 1 0 0 1 .5 1.31l-.63 1.42a1 1 0 0 1-1.3.56l-1.4-.54c-.34.38-.72.72-1.12 1.02l.43 1.46a1 1 0 0 1-.72 1.23l-1.5.37a1 1 0 0 1-1.2-.74l-.35-1.5a7.7 7.7 0 0 1-1.54 0l-.35 1.5a1 1 0 0 1-1.2.74l-1.5-.37a1 1 0 0 1-.72-1.23l.43-1.46c-.4-.3-.78-.64-1.12-1.02l-1.4.54a1 1 0 0 1-1.3-.56l-.63-1.42a1 1 0 0 1 .5-1.31l1.35-.63a7.2 7.2 0 0 1 0-1.52L2.9 9.15a1 1 0 0 1-.5-1.31l.63-1.42a1 1 0 0 1 1.3-.56l1.4.54c.34-.38.72-.72 1.12-1.02l-.43-1.46a1 1 0 0 1 .72-1.23l1.5-.37a1 1 0 0 1 1.2.74ZM12 9.25A2.75 2.75 0 1 0 12 14.75 2.75 2.75 0 0 0 12 9.25Z"
        fill="currentColor"
      />
    </IconBase>
  );
}

export function CommentIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path
        d="M6.5 5A3.5 3.5 0 0 0 3 8.5v5A3.5 3.5 0 0 0 6.5 17H8l3.25 2.44a1 1 0 0 0 1.6-.8V17h4.65A3.5 3.5 0 0 0 21 13.5v-5A3.5 3.5 0 0 0 17.5 5h-11Z"
        fill="currentColor"
      />
    </IconBase>
  );
}

export function UploadIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path
        d="M12 3.5a1 1 0 0 1 1 1V12l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 3.96a1 1 0 0 1-1.4 0l-4-3.96A1 1 0 1 1 8.7 9.7L11 12V4.5a1 1 0 0 1 1-1ZM5 18a1 1 0 0 1 1-1h12a1 1 0 1 1 0 2H6a1 1 0 0 1-1-1Z"
        fill="currentColor"
      />
    </IconBase>
  );
}

export function PencilIcon({ className }: IconProps) {
  return (
    <IconBase className={className}>
      <path
        d="m3 17.25 9.9-9.9 3.75 3.75-9.9 9.9H3v-3.75Zm14.71-10.04a1.003 1.003 0 0 0 0-1.42l-1.5-1.5a1.003 1.003 0 0 0-1.42 0l-1.17 1.17 3.75 3.75 1.34-1.34Z"
        fill="currentColor"
      />
    </IconBase>
  );
}
