"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppHeader({ workspace }: { workspace: string }) {
  const pathname = usePathname();

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Link
          href="/"
          className="min-w-0 truncate text-lg font-semibold tracking-tight"
          aria-current={pathname === "/" ? "page" : undefined}
          title={workspace}
        >
          {workspace}
        </Link>
        <nav
          aria-label="Primary navigation"
          className="flex flex-wrap items-center gap-2"
        >
          <NavLink href="/accounts/new" active={isCurrent(pathname, "/accounts/new")}>
            + New account
          </NavLink>
          <NavLink href="/import" active={isCurrent(pathname, "/import")}>
            Import
          </NavLink>
          <NavLink href="/settings" active={isCurrent(pathname, "/settings")}>
            Settings
          </NavLink>
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={active ? "btn-primary" : "btn-secondary"}
    >
      {children}
    </Link>
  );
}
