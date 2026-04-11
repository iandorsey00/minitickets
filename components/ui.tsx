import Link from "next/link";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div>
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function Panel({
  title,
  children,
  footer,
}: {
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <section className="panel">
      {title ? <h2 className="panel-title">{title}</h2> : null}
      {children}
      {footer ? <div className="panel-footer">{footer}</div> : null}
    </section>
  );
}

export function StatCard({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="empty-state">
      <strong>{title}</strong>
      {body ? <p>{body}</p> : null}
      {action ? <div>{action}</div> : null}
    </div>
  );
}

export function Badge({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  return <span className={`badge badge-${tone}`}>{label}</span>;
}

export function StatusNotice({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  return (
    <div className="status-notice">
      <Badge label={label} tone={tone} />
    </div>
  );
}

export function TicketLink({
  href,
  number,
  title,
  meta,
}: {
  href: string;
  number: string;
  title: string;
  meta: string;
}) {
  return (
    <Link href={href} className="list-row">
      <div>
        <div className="ticket-number">{number}</div>
        <strong>{title}</strong>
      </div>
      <span className="row-meta">{meta}</span>
    </Link>
  );
}
