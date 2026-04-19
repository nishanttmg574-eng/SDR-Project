"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { STAGES, STAGE_LABELS, TIERS } from "@/lib/config";

function buildHref(
  pathname: string,
  current: URLSearchParams,
  patch: Record<string, string | null>
): string {
  const next = new URLSearchParams(current.toString());
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) next.delete(key);
    else next.set(key, value);
  }
  const qs = next.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

export function AccountsFilters() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();

  const currentTier = params.get("tier");
  const currentStage = params.get("stage");
  const needsReview = params.get("needs_review") === "1";
  const hasFollowup = params.get("has_followup") === "1";
  const currentQ = params.get("q") ?? "";

  const [q, setQ] = useState(currentQ);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (q.trim()) next.set("q", q.trim());
      else next.delete("q");
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, 250);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    setQ(currentQ);
  }, [currentQ]);

  return (
    <div className="space-y-3">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by name, industry, location, or website…"
        className="input"
      />

      <ChipRow label="Tier">
        <Chip href={buildHref(pathname, params, { tier: null })} active={!currentTier}>
          All
        </Chip>
        {TIERS.map((t) => (
          <Chip
            key={t}
            href={buildHref(pathname, params, { tier: t })}
            active={currentTier === t}
          >
            Tier {t}
          </Chip>
        ))}
        <Chip
          href={buildHref(pathname, params, { tier: "unscored" })}
          active={currentTier === "unscored"}
        >
          Unscored
        </Chip>
      </ChipRow>

      <ChipRow label="Stage">
        <Chip href={buildHref(pathname, params, { stage: null })} active={!currentStage}>
          All
        </Chip>
        {STAGES.map((s) => (
          <Chip
            key={s}
            href={buildHref(pathname, params, { stage: s })}
            active={currentStage === s}
          >
            {STAGE_LABELS[s]}
          </Chip>
        ))}
      </ChipRow>

      <ChipRow label="Flags">
        <Chip
          href={buildHref(pathname, params, {
            needs_review: needsReview ? null : "1",
          })}
          active={needsReview}
        >
          Needs review
        </Chip>
        <Chip
          href={buildHref(pathname, params, {
            has_followup: hasFollowup ? null : "1",
          })}
          active={hasFollowup}
        >
          Has follow-up
        </Chip>
      </ChipRow>
    </div>
  );
}

function ChipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-16 shrink-0 text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </div>
  );
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={false}
      className={`chip ${active ? "chip-active" : ""}`}
    >
      {children}
    </Link>
  );
}
