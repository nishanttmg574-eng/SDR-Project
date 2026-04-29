"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { AccountListPage } from "@/lib/types";

function pageHref(
  pathname: string,
  current: URLSearchParams,
  page: number
): string {
  const next = new URLSearchParams(current.toString());
  if (page <= 1) next.delete("page");
  else next.set("page", String(page));
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function AccountsPagination({
  page,
}: {
  page: Omit<AccountListPage, "accounts">;
}) {
  const pathname = usePathname();
  const params = useSearchParams();
  const firstItem = page.filteredCount === 0 ? 0 : (page.page - 1) * page.pageSize + 1;
  const lastItem = Math.min(page.filteredCount, page.page * page.pageSize);

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-600 sm:flex-row sm:items-center sm:justify-between">
      <div>
        Showing <span className="font-medium text-neutral-900">{firstItem}</span>-
        <span className="font-medium text-neutral-900">{lastItem}</span> of{" "}
        <span className="font-medium text-neutral-900">{page.filteredCount}</span>
        {page.filteredCount !== page.totalCount ? (
          <>
            {" "}
            filtered from{" "}
            <span className="font-medium text-neutral-900">{page.totalCount}</span>
          </>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <PaginationLink
          href={pageHref(pathname, params, page.page - 1)}
          disabled={!page.hasPreviousPage}
        >
          Previous
        </PaginationLink>
        <span className="px-2 text-xs text-neutral-500">
          Page {page.page} of {page.totalPages}
        </span>
        <PaginationLink
          href={pageHref(pathname, params, page.page + 1)}
          disabled={!page.hasNextPage}
        >
          Next
        </PaginationLink>
      </div>
    </div>
  );
}

function PaginationLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return (
      <span className="rounded-md border border-neutral-200 px-3 py-1.5 text-neutral-300">
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      scroll={false}
      className="rounded-md border border-neutral-300 px-3 py-1.5 text-neutral-800 hover:bg-neutral-50"
    >
      {children}
    </Link>
  );
}
