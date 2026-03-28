"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { BrowserNotificationCenter } from "@/components/browser-notification-center";
import { AdminIcon, DashboardIcon, PencilIcon, SaveIcon, SettingsIcon, TicketIcon } from "@/components/icons";
import { logoutAction, switchWorkspaceAction } from "@/lib/actions";

type ShellProps = {
  appName: string;
  appSubtitle: string;
  dictionary: {
    nav: {
      dashboard: string;
      tickets: string;
      createTicket: string;
      workspaces: string;
      switchWorkspace: string;
      admin: string;
      settings: string;
      logout: string;
    };
    common: {
      search: string;
      save: string;
    };
    settings: {
      title: string;
      saveAction: string;
    };
  };
  user: {
    displayName: string;
    role: "ADMIN" | "USER";
  };
  memberships: Array<{
    workspaceId: string;
    role: "ADMIN" | "MEMBER";
    workspace: {
      id: string;
      name: string;
    };
  }>;
  currentWorkspaceId?: string | null;
  children: React.ReactNode;
};

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") {
    return pathname === "/" || pathname.startsWith("/dashboard");
  }
  return pathname.startsWith(href);
}

export function AppShell({
  appName,
  appSubtitle,
  dictionary,
  user,
  memberships,
  currentWorkspaceId,
  children,
}: ShellProps) {
  const pathname = usePathname();
  const ticketDetailMatch = pathname.match(/^\/tickets\/([^/]+)$/);
  const isTicketDetailPage = Boolean(ticketDetailMatch);
  const isSettingsPage = pathname.startsWith("/settings");
  const hasMultipleWorkspaces = memberships.length > 1;
  const currentWorkspaceName =
    memberships.find((membership) => membership.workspaceId === currentWorkspaceId)?.workspace.name ??
    memberships[0]?.workspace.name ??
    "";
  const navItems = [
    { href: "/tickets", label: dictionary.nav.tickets, icon: TicketIcon },
    { href: "/dashboard", label: dictionary.nav.dashboard, icon: DashboardIcon },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: dictionary.nav.admin, icon: AdminIcon }] : []),
    { href: "/settings", label: dictionary.nav.settings, icon: SettingsIcon },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand-block">
          <Link href="/dashboard" className="brand-link">
            <span className="brand-title">{appName}</span>
            {appSubtitle ? <span className="brand-subtitle">{appSubtitle}</span> : null}
          </Link>
        </div>
        <nav className="nav-list" aria-label={appName}>
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link ${isActive(pathname, item.href) ? "is-active" : ""}`}
            >
              <item.icon className="nav-link-icon" />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="main-column">
        <BrowserNotificationCenter supported />
        <header className="topbar">
          <form action="/tickets" className="header-search">
            <label htmlFor="header-search" className="sr-only">
              {dictionary.common.search}
            </label>
            <input id="header-search" name="q" placeholder={dictionary.common.search} />
            {currentWorkspaceId ? <input type="hidden" name="workspaceId" value={currentWorkspaceId} /> : null}
          </form>

          {hasMultipleWorkspaces ? (
            <div className="workspace-switcher-cluster">
              <form action={switchWorkspaceAction} className="workspace-switcher" id="workspace-switcher-form">
                <label htmlFor="workspaceId" className="sr-only">
                  Workspace
                </label>
                <select id="workspaceId" name="workspaceId" defaultValue={currentWorkspaceId ?? ""}>
                  {memberships.map((membership) => (
                    <option key={membership.workspace.id} value={membership.workspace.id}>
                      {membership.workspace.name}
                    </option>
                  ))}
                </select>
              </form>
              <button type="submit" className="ghost-button workspace-switch-button" form="workspace-switcher-form">
                {dictionary.nav.switchWorkspace}
              </button>
            </div>
          ) : (
            <div className="workspace-label" aria-label={dictionary.nav.workspaces}>
              {currentWorkspaceName}
            </div>
          )}

          <div className="topbar-actions">
            <div className="user-chip">
              <span>{user.displayName}</span>
            </div>
            <form action={logoutAction}>
              <button type="submit" className="ghost-button">
                {dictionary.nav.logout}
              </button>
            </form>
          </div>
        </header>

        <main className="content">{children}</main>

        {isSettingsPage ? (
          <button type="submit" className="floating-action" form="settings-form">
            <span className="button-content">
              <SaveIcon className="floating-action-icon" />
              <span>{dictionary.settings.saveAction}</span>
            </span>
          </button>
        ) : pathname !== "/tickets/new" && !isTicketDetailPage ? (
          <Link href="/tickets/new" className="floating-action">
            <PencilIcon className="floating-action-icon" />
            <span>{dictionary.nav.createTicket}</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
