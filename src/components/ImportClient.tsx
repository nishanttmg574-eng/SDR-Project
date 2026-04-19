"use client";

import Link from "next/link";
import { useCallback, useRef, useState, useTransition } from "react";
import Papa, { type ParseError } from "papaparse";
import {
  CANONICAL_FIELDS,
  detectColumns,
  normalizeRows,
  type CanonicalField,
  type DetectResult,
  type ParsedRow,
} from "@/lib/import";
import { importAccountsAction } from "@/lib/actions";

type Stage =
  | { kind: "idle" }
  | { kind: "parsing"; filename: string }
  | {
      kind: "sheet-picker";
      filename: string;
      sheetNames: string[];
      workbookBytes: ArrayBuffer;
    }
  | {
      kind: "preview";
      filename: string;
      sheetName?: string;
      headers: string[];
      rawRows: Record<string, unknown>[];
      detect: DetectResult;
      normalized: ParsedRow[];
    }
  | { kind: "result"; added: number; updated: number };

function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

export function ImportClient() {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStage({ kind: "idle" });
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const showPreview = useCallback(
    (
      headers: string[],
      rawRows: Record<string, unknown>[],
      filename: string,
      sheetName?: string
    ) => {
      const detect = detectColumns(headers);
      const normalized = detect.missingRequired.includes("name")
        ? []
        : normalizeRows(rawRows, detect.mapping);
      setStage({ kind: "preview", filename, sheetName, headers, rawRows, detect, normalized });
    },
    []
  );

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const name = file.name.toLowerCase();
      setStage({ kind: "parsing", filename: file.name });

      try {
        if (name.endsWith(".csv")) {
          Papa.parse<Record<string, unknown>>(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
              const fatal = (results.errors || []).filter(
                (e: ParseError) => e.type !== "FieldMismatch"
              );
              if (fatal.length > 0) {
                setError(
                  "CSV parse errors:\n" +
                    fatal
                      .slice(0, 5)
                      .map((e) => `• Row ${e.row ?? "?"}: ${e.message}`)
                      .join("\n")
                );
                setStage({ kind: "idle" });
                return;
              }
              const headers = results.meta.fields ?? [];
              showPreview(headers, results.data, file.name);
            },
            error: (err: Error) => {
              setError(`CSV parse error: ${err.message}`);
              setStage({ kind: "idle" });
            },
          });
        } else if (name.endsWith(".xlsx") || name.endsWith(".xls")) {
          const buffer = await readFileAsArrayBuffer(file);
          const XLSX = await import("xlsx");
          const workbook = XLSX.read(buffer, { type: "array" });
          const sheetNames = workbook.SheetNames;
          if (sheetNames.length === 0) {
            setError("This workbook has no sheets.");
            setStage({ kind: "idle" });
            return;
          }
          if (sheetNames.length > 1) {
            setStage({
              kind: "sheet-picker",
              filename: file.name,
              sheetNames,
              workbookBytes: buffer,
            });
            return;
          }
          parseXlsxSheet(buffer, sheetNames[0], file.name);
        } else {
          setError("Unsupported file type. Use a .csv, .xlsx, or .xls file.");
          setStage({ kind: "idle" });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse file");
        setStage({ kind: "idle" });
      }
    },
    [showPreview]
  );

  const parseXlsxSheet = useCallback(
    async (buffer: ArrayBuffer, sheetName: string, filename: string) => {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[sheetName];
        if (!sheet) {
          setError(`Sheet "${sheetName}" not found in workbook.`);
          setStage({ kind: "idle" });
          return;
        }
        const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
          defval: "",
          raw: true,
        });
        const headerRows = XLSX.utils.sheet_to_json<string[]>(sheet, {
          header: 1,
          defval: "",
          raw: false,
        });
        const headers = (headerRows[0] ?? []).map((h) => String(h));
        showPreview(headers, rawRows, filename, sheetName);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to parse sheet");
        setStage({ kind: "idle" });
      }
    },
    [showPreview]
  );

  const onConfirm = useCallback(() => {
    if (stage.kind !== "preview") return;
    startTransition(async () => {
      try {
        const result = await importAccountsAction(stage.normalized);
        setStage({ kind: "result", added: result.added, updated: result.updated });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Import failed");
      }
    });
  }, [stage]);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  return (
    <div className="space-y-6">
      {stage.kind !== "result" && stage.kind !== "preview" && stage.kind !== "sheet-picker" && (
        <div
          className={`rounded-lg border-2 border-dashed p-10 text-center transition-colors ${
            dragOver ? "border-blue-500 bg-blue-50" : "border-neutral-300 bg-white"
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          <div className="text-sm text-neutral-600">
            {stage.kind === "parsing"
              ? `Parsing ${stage.filename}…`
              : "Drop a CSV or XLSX file here"}
          </div>
          <div className="mt-2 text-xs text-neutral-500">or</div>
          <button
            type="button"
            className="btn-secondary mt-3"
            onClick={() => inputRef.current?.click()}
            disabled={stage.kind === "parsing"}
          >
            Choose file
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
          <div className="mt-4 text-xs text-neutral-500">
            Recognized columns: name, website, industry, location/country, headcount.
            Headers are case-insensitive and tolerate spaces/punctuation.
          </div>
        </div>
      )}

      {error && (
        <div className="whitespace-pre-wrap rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          {error}
        </div>
      )}

      {stage.kind === "sheet-picker" && (
        <SheetPicker
          filename={stage.filename}
          sheetNames={stage.sheetNames}
          onPick={(sheetName) => parseXlsxSheet(stage.workbookBytes, sheetName, stage.filename)}
          onCancel={reset}
        />
      )}

      {stage.kind === "preview" && (
        <PreviewPanel
          filename={stage.filename}
          sheetName={stage.sheetName}
          detect={stage.detect}
          headers={stage.headers}
          normalized={stage.normalized}
          pending={pending}
          onConfirm={onConfirm}
          onCancel={reset}
        />
      )}

      {stage.kind === "result" && (
        <div className="rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          <div className="font-medium">
            Imported: {stage.added} new, {stage.updated} updated.
          </div>
          <div className="mt-2 flex gap-3">
            <Link href="/" className="btn-primary">
              View accounts
            </Link>
            <button type="button" className="btn-secondary" onClick={reset}>
              Import another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SheetPicker({
  filename,
  sheetNames,
  onPick,
  onCancel,
}: {
  filename: string;
  sheetNames: string[];
  onPick: (sheetName: string) => void;
  onCancel: () => void;
}) {
  const [selected, setSelected] = useState(sheetNames[0]);
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="text-sm font-medium text-neutral-800">
        {filename} has multiple sheets — pick one
      </div>
      <div className="mt-3 space-y-2">
        {sheetNames.map((s) => (
          <label key={s} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name="sheet"
              value={s}
              checked={selected === s}
              onChange={() => setSelected(s)}
            />
            <span>{s}</span>
          </label>
        ))}
      </div>
      <div className="mt-4 flex gap-3">
        <button type="button" className="btn-primary" onClick={() => onPick(selected)}>
          Use this sheet
        </button>
        <button type="button" className="btn-secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PreviewPanel({
  filename,
  sheetName,
  detect,
  headers,
  normalized,
  pending,
  onConfirm,
  onCancel,
}: {
  filename: string;
  sheetName?: string;
  detect: DetectResult;
  headers: string[];
  normalized: ParsedRow[];
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const nameMissing = detect.missingRequired.includes("name");
  const sample = normalized.slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-neutral-200 bg-white p-4">
        <div className="text-sm font-medium text-neutral-800">
          {filename}
          {sheetName ? ` → ${sheetName}` : ""}
        </div>
        <div className="mt-2 text-xs text-neutral-500">
          {headers.length} columns, {normalized.length} data row
          {normalized.length === 1 ? "" : "s"} with a name
        </div>
      </div>

      {nameMissing ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <div className="font-medium">No name column detected</div>
          <p className="mt-1">
            Rename a column in your file to one of:{" "}
            <code>name</code>, <code>company</code>, <code>account</code>, <code>organization</code>.
          </p>
          <div className="mt-3">
            <div className="font-medium">Columns found in your file:</div>
            <ul className="mt-1 list-disc pl-5">
              {headers.length === 0 ? (
                <li>(none — the file appears to have no header row)</li>
              ) : (
                headers.map((h) => <li key={h}>{h}</li>)
              )}
            </ul>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-neutral-200 bg-white p-4 text-sm">
          <div className="font-medium text-neutral-800">Detected columns</div>
          <ul className="mt-2 space-y-1">
            {CANONICAL_FIELDS.map((f) => (
              <li key={f} className="flex gap-2">
                <span className="w-20 text-neutral-500">{f}</span>
                <span className="text-neutral-800">
                  {detect.mapping[f as CanonicalField] ? (
                    <>
                      ← <span className="font-mono">{detect.mapping[f as CanonicalField]}</span>
                    </>
                  ) : (
                    <span className="text-neutral-400">(not found)</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {detect.unmatched.length > 0 && (
            <div className="mt-3 text-xs text-neutral-500">
              Ignored columns: {detect.unmatched.join(", ")}
            </div>
          )}
        </div>
      )}

      {!nameMissing && sample.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-neutral-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-2">name</th>
                <th className="px-3 py-2">website</th>
                <th className="px-3 py-2">industry</th>
                <th className="px-3 py-2">location</th>
                <th className="px-3 py-2">headcount</th>
              </tr>
            </thead>
            <tbody>
              {sample.map((r, i) => (
                <tr key={i} className="border-t border-neutral-100">
                  <td className="px-3 py-2">{r.name}</td>
                  <td className="px-3 py-2 text-neutral-600">{r.website ?? ""}</td>
                  <td className="px-3 py-2 text-neutral-600">{r.industry ?? ""}</td>
                  <td className="px-3 py-2 text-neutral-600">{r.location ?? ""}</td>
                  <td className="px-3 py-2 text-neutral-600">{r.headcount ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {normalized.length > sample.length && (
            <div className="border-t border-neutral-100 px-3 py-2 text-xs text-neutral-500">
              Showing first {sample.length} of {normalized.length} rows
            </div>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <button
          type="button"
          className="btn-primary"
          onClick={onConfirm}
          disabled={nameMissing || normalized.length === 0 || pending}
        >
          {pending ? "Importing…" : `Import ${normalized.length} rows`}
        </button>
        <button
          type="button"
          className="btn-secondary"
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
