"use client";

import { useCallback, useEffect, useState } from "react";
import { adminJson } from "@/components/learn/admin-client";
import type { LearnImage } from "@/lib/learn/types";

export function LearnImagePicker({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
}) {
  const [images, setImages] = useState<LearnImage[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await adminJson<{ images: LearnImage[] }>("/api/admin/learn/images");
      setImages(payload.images);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Immagini non disponibili.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const prepared = await adminJson<{
        upload: { path: string; signedUrl: string; publicUrl: string };
      }>("/api/admin/learn/images/prepare", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });
      const put = await fetch(prepared.upload.signedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!put.ok) throw new Error("Upload fallito.");
      onChange(prepared.upload.publicUrl);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload fallito.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-2 space-y-2">
      {value ? (
        <div className="flex items-start gap-3">
          <img src={value} alt="" className="h-20 w-28 rounded-md object-cover" />
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-sm text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-400"
          >
            Rimuovi
          </button>
        </div>
      ) : (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">Nessuna immagine</p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="rounded-md border border-neutral-200 px-3 py-1.5 text-sm dark:border-neutral-800"
        >
          {open ? "Chiudi libreria" : "Scegli o carica"}
        </button>
      </div>

      {open ? (
        <div className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <label className="block text-sm">
            Carica nuova
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml"
              disabled={uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
                event.currentTarget.value = "";
              }}
              className="mt-2 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-neutral-100 file:px-3 file:py-1.5 file:text-sm dark:file:bg-neutral-900"
            />
          </label>
          {uploading ? (
            <p className="mt-2 text-sm text-neutral-500">Carico…</p>
          ) : null}
          {error ? <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p> : null}
          {loading ? (
            <p className="mt-3 text-sm text-neutral-500">Apro la libreria…</p>
          ) : (
            <ul className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((image) => {
                const selected = value === image.publicUrl;
                return (
                  <li key={image.path}>
                    <button
                      type="button"
                      onClick={() => onChange(image.publicUrl)}
                      className={`block overflow-hidden rounded-md border ${
                        selected
                          ? "border-[#F5D547] ring-2 ring-[#F5D547]"
                          : "border-neutral-200 dark:border-neutral-800"
                      }`}
                    >
                      <img src={image.publicUrl} alt={image.name} className="h-16 w-full object-cover" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
