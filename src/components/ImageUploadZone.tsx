import { useRef, useState } from 'react';
import { ClipboardPaste, Plus, X } from 'lucide-react';
import type { UploadedImageItem } from '../types/design';
import { processImageFile } from '../utils/mediaHelpers';

interface ImageUploadZoneProps {
  id: string;
  label: string;
  helperText?: string;
  items: UploadedImageItem[];
  maxFiles?: number;
  errorText?: string;
  onChange: (nextItems: UploadedImageItem[]) => void;
  onNotify?: (message: string) => void;
}

export function ImageUploadZone({
  id,
  label,
  helperText,
  items,
  maxFiles,
  errorText,
  onChange,
  onNotify,
}: ImageUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const canAddMore = maxFiles === undefined || items.length < maxFiles;

  async function addFiles(fileList: FileList | File[]) {
    const incoming = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (incoming.length === 0) {
      onNotify?.('Pilih file gambar berformat PNG, JPG, atau WEBP.');
      return;
    }

    const availableSlots =
      maxFiles === undefined ? incoming.length : Math.max(0, maxFiles - items.length);

    if (availableSlots === 0) {
      onNotify?.(`Maksimal ${maxFiles} file untuk bagian ${label}.`);
      return;
    }

    const slice = incoming.slice(0, availableSlots);
    setIsBusy(true);
    try {
      const processed = await Promise.all(slice.map((f) => processImageFile(f)));
      onChange([...items, ...processed]);
      if (incoming.length > availableSlots) {
        onNotify?.(`Hanya ${availableSlots} gambar ditambahkan (maksimal ${maxFiles} file).`);
      }
    } catch {
      onNotify?.('Gagal memproses gambar. Coba file lain.');
    } finally {
      setIsBusy(false);
    }
  }

  async function handlePasteFromClipboard() {
    if (!canAddMore) {
      onNotify?.(`Maksimal ${maxFiles} file sudah tercapai.`);
      return;
    }
    if (!navigator.clipboard || !navigator.clipboard.read) {
      onNotify?.('Gunakan Ctrl+V saat fokus di kotak ini atau pilih file dari perangkat.');
      return;
    }
    try {
      const clipboardItems = await navigator.clipboard.read();
      const files: File[] = [];
      for (const clipItem of clipboardItems) {
        const imageType = clipItem.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await clipItem.getType(imageType);
          const ext = imageType.split('/')[1] || 'png';
          files.push(new File([blob], `clipboard-${Date.now()}.${ext}`, { type: imageType }));
        }
      }
      if (files.length === 0) {
        onNotify?.('Tidak ada gambar di clipboard. Salin gambar terlebih dahulu lalu tempel.');
        return;
      }
      await addFiles(files);
    } catch {
      onNotify?.('Izin clipboard tidak tersedia. Silakan tempel dengan Ctrl+V atau klik tombol Add.');
    }
  }

  function handleZonePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const pastedFiles: File[] = [];
    for (const item of Array.from(e.clipboardData.items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) pastedFiles.push(file);
      }
    }
    if (pastedFiles.length > 0) {
      e.preventDefault();
      void addFiles(pastedFiles);
    }
  }

  function handleRemove(targetId: string) {
    onChange(items.filter((item) => item.id !== targetId));
  }

  return (
    <div
      onPaste={handleZonePaste}
      onDragOver={(e) => {
        e.preventDefault();
        if (canAddMore) setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragging(false);
        if (canAddMore && e.dataTransfer.files.length > 0) {
          void addFiles(e.dataTransfer.files);
        }
      }}
      className="space-y-2"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-slate-800">
          {label}
        </label>
        <div className="flex items-center gap-3 text-xs text-slate-500">
          {maxFiles !== undefined && (
            <span className="font-mono tabular-nums">
              {items.length}/{maxFiles} File
            </span>
          )}
          {canAddMore && (
            <button
              type="button"
              onClick={() => void handlePasteFromClipboard()}
              className="inline-flex items-center gap-1 font-medium text-slate-600 transition-colors hover:text-slate-900"
              aria-label={`Tempel gambar dari clipboard ke ${label}`}
            >
              <ClipboardPaste className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Tempel Clipboard</span>
            </button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        id={id}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple={maxFiles !== 1}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            void addFiles(e.target.files);
            e.target.value = '';
          }
        }}
      />

      <div
        className={`grid grid-cols-2 gap-3 sm:grid-cols-3 ${
          isDragging ? 'rounded-xl bg-slate-100/80 p-1.5 ring-1 ring-slate-400' : ''
        }`}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="group relative aspect-[16/10] overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
          >
            <img
              src={item.previewUrl}
              alt={item.name}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 via-slate-950/35 to-transparent px-2.5 pb-1.5 pt-5">
              <p className="truncate text-xs font-medium text-white">{item.name}</p>
            </div>
            <button
              type="button"
              onClick={() => handleRemove(item.id)}
              aria-label={`Hapus ${item.name} dari ${label}`}
              className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-slate-950/75 text-white transition-colors hover:bg-rose-600"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}

        {canAddMore && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => inputRef.current?.click()}
            aria-label={`Tambah gambar untuk ${label}`}
            className="flex aspect-[16/10] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-slate-50/70 text-slate-600 transition-colors hover:border-slate-500 hover:bg-slate-100/80 hover:text-slate-900 disabled:opacity-60"
          >
            <Plus className="h-5 w-5" aria-hidden="true" />
            <span className="text-xs font-medium">{isBusy ? 'Memproses...' : 'Add'}</span>
          </button>
        )}
      </div>

      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
      {errorText && (
        <p role="alert" className="text-xs font-medium text-rose-600">
          {errorText}
        </p>
      )}
    </div>
  );
}
