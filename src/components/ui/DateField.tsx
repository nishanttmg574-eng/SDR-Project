"use client";

import { useId, useRef } from "react";
import { isDateOnly } from "@/lib/dates";

export function DateField({
  label,
  value,
  onChange,
  invalid,
  required,
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  required?: boolean;
  min?: string;
}) {
  const id = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const pickerValue = isDateOnly(value) ? value : "";

  function openPicker() {
    const picker = pickerRef.current;
    if (!picker) return;
    if (typeof picker.showPicker === "function") {
      try {
        picker.showPicker();
        return;
      } catch {
        // Fall back for browsers that expose showPicker but reject hidden inputs.
      }
    }
    picker.click();
  }

  return (
    <label className="block text-sm" htmlFor={id}>
      <span className="text-neutral-700">{label}</span>
      <div className="mt-1 flex gap-2">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          placeholder="2026-04-28"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          className="input"
          aria-invalid={invalid || undefined}
        />
        <button
          type="button"
          onClick={openPicker}
          className="btn-secondary shrink-0 px-3"
        >
          Pick
        </button>
        <input
          ref={pickerRef}
          type="date"
          value={pickerValue}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none absolute h-px w-px opacity-0"
        />
      </div>
    </label>
  );
}
