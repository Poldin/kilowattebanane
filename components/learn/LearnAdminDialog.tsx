"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

export function LearnAdminDialog({
  open,
  title,
  onClose,
  children,
  wide = false,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      if (!dialog.open) dialog.showModal();
      return;
    }
    if (dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        dialogRef.current?.close();
      }}
      className={`m-auto max-h-[min(92vh,56rem)] overflow-y-auto rounded-lg border border-neutral-200 bg-background p-4 text-foreground shadow-xl backdrop:bg-black/40 dark:border-neutral-800 ${
        wide ? "w-[min(calc(100%-1.5rem),48rem)]" : "w-[min(calc(100%-1.5rem),40rem)]"
      }`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <h2 id={titleId} className="text-sm font-medium">
          {title}
        </h2>
        <button
          type="button"
          className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm text-neutral-700 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
          onClick={() => dialogRef.current?.close()}
        >
          Chiudi
        </button>
      </div>
      {children}
    </dialog>
  );
}
