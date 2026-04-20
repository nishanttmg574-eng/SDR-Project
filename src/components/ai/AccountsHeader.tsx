"use client";

import { useState } from "react";
import { BulkScoringModal } from "./BulkScoringModal";

export function AccountsHeader({
  count,
  apiKeyConfigured,
}: {
  count: number;
  apiKeyConfigured: boolean;
}) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="flex items-baseline justify-between">
      <div>
        <h1 className="text-xl font-semibold">Accounts</h1>
        <p className="mt-1 text-sm text-neutral-500">
          {count} {count === 1 ? "account" : "accounts"}
        </p>
      </div>
      <button
        type="button"
        className="btn-primary"
        onClick={() => setModalOpen(true)}
      >
        Score with AI
      </button>
      <BulkScoringModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        apiKeyConfigured={apiKeyConfigured}
      />
    </div>
  );
}
