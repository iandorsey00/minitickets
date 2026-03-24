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
  const navItems = [
    { href: "/dashboard", label: dictionary.nav.dashboard },
    { href: "/tickets", label: dictionary.nav.tickets },
    { href: "/tickets/new", label: dictionary.nav.createTicket },
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
            <span className="brand-subtitle">{appSubtitle}</span>
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
          <form action={switchWorkspaceAction} className="workspace-switcher">
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
            <button type="submit" className="ghost-button">
              {dictionary.nav.workspaces}
            </button>
          </form>

          <form action="/tickets" className="header-search">
            <label htmlFor="header-search" className="sr-only">
              {dictionary.common.search}
            </label>
            <input id="header-search" name="q" placeholder={dictionary.common.search} />
            {currentWorkspaceId ? <input type="hidden" name="workspaceId" value={currentWorkspaceId} /> : null}
          </form>

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
      </div>
    </div>
  );
}
