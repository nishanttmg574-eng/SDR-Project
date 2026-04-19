"use client";

import { useState, useTransition } from "react";
import {
  createProspectAction,
  deleteProspectAction,
  updateProspectAction,
} from "@/lib/actions";
import { parseLinkedInPaste } from "@/lib/linkedin";
import type { NewProspectInput, Prospect } from "@/lib/types";

type Fields = NewProspectInput;

const EMPTY: Fields = {
  name: "",
  title: "",
  email: "",
  phone: "",
  linkedin: "",
  notes: "",
};

export function ProspectsPanel({
  accountId,
  prospects,
}: {
  accountId: string;
  prospects: Prospect[];
}) {
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-sm font-medium text-neutral-800">
          Prospects
          <span className="ml-2 text-neutral-400">({prospects.length})</span>
        </h2>
        <p className="mt-0.5 text-xs text-neutral-500">
          People you contact at this account. Listed in the Interactions logger.
        </p>
      </div>

      <AddProspect accountId={accountId} />

      {prospects.length === 0 ? (
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-8 text-center text-sm text-neutral-500">
          No prospects yet.
        </div>
      ) : (
        <ul className="space-y-3">
          {prospects.map((p) => (
            <ProspectCard key={p.id} accountId={accountId} prospect={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AddProspect({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [pasteLine, setPasteLine] = useState("");
  const [parseNote, setParseNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof Fields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function onParse() {
    const parsed = parseLinkedInPaste(pasteLine);
    if (!parsed) {
      setParseNote("Couldn't parse anything from that line.");
      return;
    }
    setFields((f) => ({
      ...f,
      name: parsed.name,
      title: parsed.title ?? f.title,
    }));
    setParseNote(
      parsed.location
        ? `Parsed. Location: ${parsed.location} (not stored — add to notes if useful)`
        : "Parsed into name + title."
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const name = fields.name.trim();
    if (!name) {
      setError("Name is required");
      return;
    }
    startTransition(async () => {
      try {
        await createProspectAction(accountId, fields);
        setFields(EMPTY);
        setPasteLine("");
        setParseNote(null);
        setOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn-primary"
      >
        + Add prospect
      </button>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
    >
      <div>
        <label className="block text-sm">
          <span className="text-neutral-700">Paste from LinkedIn</span>
          <div className="mt-1 flex gap-2">
            <input
              type="text"
              value={pasteLine}
              onChange={(e) => setPasteLine(e.target.value)}
              placeholder="Priya Sharma - VP People at Acme - Mumbai · 2nd"
              className="input"
            />
            <button
              type="button"
              onClick={onParse}
              className="btn-secondary whitespace-nowrap"
            >
              Parse
            </button>
          </div>
        </label>
        {parseNote ? (
          <p className="mt-1 text-xs text-neutral-500">{parseNote}</p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Name *" value={fields.name} onChange={(v) => set("name", v)} required />
        <Field label="Title" value={fields.title ?? ""} onChange={(v) => set("title", v)} />
        <Field label="Email" value={fields.email ?? ""} onChange={(v) => set("email", v)} type="email" />
        <Field label="Phone" value={fields.phone ?? ""} onChange={(v) => set("phone", v)} />
        <Field
          label="LinkedIn URL"
          value={fields.linkedin ?? ""}
          onChange={(v) => set("linkedin", v)}
          className="col-span-2"
        />
      </div>
      <label className="block text-sm">
        <span className="text-neutral-700">Notes</span>
        <textarea
          value={fields.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          className="input mt-1"
        />
      </label>

      {error ? (
        <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setFields(EMPTY);
            setPasteLine("");
            setParseNote(null);
            setError(null);
          }}
          className="btn-secondary"
        >
          Cancel
        </button>
        <button type="submit" disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save prospect"}
        </button>
      </div>
    </form>
  );
}

function ProspectCard({
  accountId,
  prospect,
}: {
  accountId: string;
  prospect: Prospect;
}) {
  const [editing, setEditing] = useState(false);
  const [fields, setFields] = useState<Fields>({
    name: prospect.name,
    title: prospect.title ?? "",
    email: prospect.email ?? "",
    phone: prospect.phone ?? "",
    linkedin: prospect.linkedin ?? "",
    notes: prospect.notes,
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function set<K extends keyof Fields>(key: K, value: string) {
    setFields((f) => ({ ...f, [key]: value }));
  }

  function onSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fields.name.trim()) {
      setError("Name is required");
      return;
    }
    startTransition(async () => {
      try {
        await updateProspectAction(accountId, prospect.id, fields);
        setEditing(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function onDelete() {
    if (!confirm(`Delete prospect ${prospect.name}?`)) return;
    startTransition(async () => {
      await deleteProspectAction(accountId, prospect.id);
    });
  }

  if (editing) {
    return (
      <li>
        <form
          onSubmit={onSave}
          className="space-y-3 rounded-lg border border-blue-300 bg-white p-4"
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *" value={fields.name} onChange={(v) => set("name", v)} required />
            <Field label="Title" value={fields.title ?? ""} onChange={(v) => set("title", v)} />
            <Field label="Email" value={fields.email ?? ""} onChange={(v) => set("email", v)} type="email" />
            <Field label="Phone" value={fields.phone ?? ""} onChange={(v) => set("phone", v)} />
            <Field
              label="LinkedIn URL"
              value={fields.linkedin ?? ""}
              onChange={(v) => set("linkedin", v)}
              className="col-span-2"
            />
          </div>
          <label className="block text-sm">
            <span className="text-neutral-700">Notes</span>
            <textarea
              value={fields.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              rows={2}
              className="input mt-1"
            />
          </label>
          {error ? (
            <p className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" disabled={pending} className="btn-primary">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="font-medium text-neutral-900">{prospect.name}</div>
          {prospect.title ? (
            <div className="text-sm text-neutral-600">{prospect.title}</div>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-neutral-500">
            {prospect.email ? (
              <a href={`mailto:${prospect.email}`} className="text-blue-600 hover:underline">
                {prospect.email}
              </a>
            ) : null}
            {prospect.phone ? <span>{prospect.phone}</span> : null}
            {prospect.linkedin ? (
              <a
                href={prospect.linkedin}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline"
              >
                LinkedIn
              </a>
            ) : null}
          </div>
          {prospect.notes ? (
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-700">
              {prospect.notes}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2 text-xs">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-blue-600 hover:underline"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            className="text-red-600 hover:underline disabled:opacity-50"
          >
            {pending ? "…" : "Delete"}
          </button>
        </div>
      </div>
    </li>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type = "text",
  className = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  className?: string;
}) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="text-neutral-700">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="input mt-1"
      />
    </label>
  );
}
