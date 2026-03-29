import type { LucideProps } from "lucide-react";
import {
  Archive,
  ArrowRightLeft,
  Building2,
  FileText,
  LayoutDashboard,
  LogOut,
  Mail,
  MessageSquare,
  Plus,
  Save,
  Settings,
  Shield,
  SquarePen,
  Ticket,
  Trash2,
  Upload,
  Power,
} from "lucide-react";

type IconProps = {
  className?: string;
};

type IconComponent = (props: LucideProps) => React.ReactNode;

function IconBase({ className, icon: Icon }: IconProps & { icon: IconComponent }) {
  return (
    <span className={className} aria-hidden="true">
      <Icon strokeWidth={1.85} />
    </span>
  );
}

export function TicketIcon({ className }: IconProps) {
  return <IconBase className={className} icon={Ticket} />;
}

export function DashboardIcon({ className }: IconProps) {
  return <IconBase className={className} icon={LayoutDashboard} />;
}

export function WorkspaceIcon({ className }: IconProps) {
  return <IconBase className={className} icon={Building2} />;
}

export function AdminIcon({ className }: IconProps) {
  return <IconBase className={className} icon={Shield} />;
}

export function SettingsIcon({ className }: IconProps) {
  return <IconBase className={className} icon={Settings} />;
}

export function CommentIcon({ className }: IconProps) {
  return <IconBase className={className} icon={MessageSquare} />;
}

export function UploadIcon({ className }: IconProps) {
  return <IconBase className={className} icon={Upload} />;
}

export function DocumentIcon({ className }: IconProps) {
  return <IconBase className={className} icon={FileText} />;
}

export function PencilIcon({ className }: IconProps) {
  return <IconBase className={className} icon={SquarePen} />;
}

export function SaveIcon({ className }: IconProps) {
  return <IconBase className={className} icon={Save} />;
}

export function ArchiveIcon({ className }: IconProps) {
  return <IconBase className={className} icon={Archive} />;
}

export function TrashIcon({ className }: IconProps) {
  return <IconBase className={className} icon={Trash2} />;
}

export function MailIcon({ className }: IconProps) {
  return <IconBase className={className} icon={Mail} />;
}

export function PowerIcon({ className }: IconProps) {
  return <IconBase className={className} icon={Power} />;
}

export function PlusIcon({ className }: IconProps) {
  return <IconBase className={className} icon={Plus} />;
}

export function SwitchIcon({ className }: IconProps) {
  return <IconBase className={className} icon={ArrowRightLeft} />;
}

export function LogoutIcon({ className }: IconProps) {
  return <IconBase className={className} icon={LogOut} />;
}
