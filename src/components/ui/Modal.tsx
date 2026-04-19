"use client";

import { useEffect, useRef } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  widthClass = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  widthClass?: string;
}) {
  const ref = useRef<HTMLDialogElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const handleClose = () => onClose();
    el.addEventListener("close", handleClose);
    return () => el.removeEventListener("close", handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      className={`w-full ${widthClass} rounded-lg border border-neutral-200 bg-white p-0 shadow-xl backdrop:bg-black/40`}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-3">
        <h2 className="text-sm font-medium text-neutral-900">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-neutral-400 hover:text-neutral-700"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
