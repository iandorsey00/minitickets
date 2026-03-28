"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

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
  const hasMultipleWorkspaces = memberships.length > 1;
  const currentWorkspaceName =
    memberships.find((membership) => membership.workspaceId === currentWorkspaceId)?.workspace.name ??
    memberships[0]?.workspace.name ??
    "";
  const navItems = [
    { href: "/tickets", label: dictionary.nav.tickets },
    { href: "/dashboard", label: dictionary.nav.dashboard },
    { href: "/workspaces", label: dictionary.nav.workspaces },
    ...(user.role === "ADMIN" ? [{ href: "/admin", label: dictionary.nav.admin }] : []),
    { href: "/settings", label: dictionary.nav.settings },
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
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="main-column">
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
                <input type="hidden" name="nextPath" value={pathname || "/dashboard"} />
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

        {pathname !== "/tickets/new" && !isTicketDetailPage ? (
          <Link href="/tickets/new" className="floating-action">
            <span className="floating-action-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path
                  d="m3 17.25 9.9-9.9 3.75 3.75-9.9 9.9H3v-3.75Zm14.71-10.04a1.003 1.003 0 0 0 0-1.42l-1.5-1.5a1.003 1.003 0 0 0-1.42 0l-1.17 1.17 3.75 3.75 1.34-1.34Z"
                  fill="currentColor"
                />
              </svg>
            </span>
            <span>{dictionary.nav.createTicket}</span>
          </Link>
        ) : null}
      </div>
    </div>
  );
}
