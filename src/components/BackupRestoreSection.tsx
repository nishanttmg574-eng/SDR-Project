"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Status =
  | { kind: "idle" }
  | { kind: "restoring" }
  | { kind: "success"; counts: { accounts: number; interactions: number; prospects: number } }
  | { kind: "error"; message: string };

export function BackupRestoreSection() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const onPickFile = () => inputRef.current?.click();

  const onFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    let text: string;
    try {
      text = await file.text();
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Could not read file",
      });
      return;
    }

    try {
      JSON.parse(text);
    } catch {
      setStatus({
        kind: "error",
        message: "File is not valid JSON. Pick a backup file created by this app.",
      });
      return;
    }

    const ok = window.confirm(
      "Replace ALL current data with this backup? This cannot be undone."
    );
    if (!ok) return;

    setStatus({ kind: "restoring" });
    try {
      const res = await fetch("/api/restore", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: text,
      });
      const data = (await res.json()) as
        | { ok: true; counts: { accounts: number; interactions: number; prospects: number } }
        | { ok: false; error: string };
      if (!res.ok || !data.ok) {
        setStatus({
          kind: "error",
          message: "error" in data ? data.error : `Restore failed (HTTP ${res.status})`,
        });
        return;
      }
      setStatus({ kind: "success", counts: data.counts });
      router.refresh();
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Restore request failed",
      });
    }
  };

  return (
    <section className="mt-12 border-t border-neutral-200 pt-8">
      <h2 className="text-lg font-semibold">Data</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Export a full JSON snapshot of your workspace, or restore from one.
      </p>

      <div
        className="mt-4 flex flex-wrap gap-3"
        aria-live="polite"
        aria-busy={status.kind === "restoring"}
      >
        <a href="/api/backup" className="btn-secondary" download>
          Export backup
        </a>
        <button
          type="button"
          className="btn-secondary"
          onClick={onPickFile}
          disabled={status.kind === "restoring"}
        >
          {status.kind === "restoring" ? "Restoring…" : "Restore backup"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={onFileChosen}
        />
      </div>

      {status.kind === "success" && (
        <div
          aria-live="polite"
          className="mt-4 rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-900"
        >
          Restored: {status.counts.accounts} accounts, {status.counts.interactions} interactions,{" "}
          {status.counts.prospects} prospects.
        </div>
      )}

      {status.kind === "error" && (
        <div
          role="alert"
          className="mt-4 whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900"
        >
          {status.message}
        </div>
      )}
    </section>
  );
}
