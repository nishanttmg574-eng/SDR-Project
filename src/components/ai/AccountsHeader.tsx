"use client";

import { useState } from "react";
import type { AiReadiness } from "@/lib/ai-providers";
import { BulkScoringModal } from "./BulkScoringModal";

export function AccountsHeader({
  filteredCount,
  totalCount,
  aiReadiness,
}: {
  filteredCount: number;
  totalCount: number;
  aiReadiness: AiReadiness;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-baseline sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">Accounts</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {filteredCount === totalCount
            ? `${totalCount} ${totalCount === 1 ? "account" : "accounts"}`
            : `${filteredCount} filtered from ${totalCount} accounts`}
        </p>
      </div>
      <button
        type="button"
        className="btn-primary self-start sm:self-auto"
        onClick={() => setModalOpen(true)}
      >
        Score with AI
      </button>
      <BulkScoringModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        aiReadiness={aiReadiness}
      />
    </div>
  );
}
