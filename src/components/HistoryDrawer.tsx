import { Check, Copy, RotateCcw, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import type { PromptHistoryEntry } from '../types/design';

interface HistoryDrawerProps {
  open: boolean;
  entries: PromptHistoryEntry[];
  onClose: () => void;
  onRestore: (entry: PromptHistoryEntry) => void;
  onDelete: (id: string) => void;
  onClearAll: () => void;
}

export function HistoryDrawer({
  open,
  entries,
  onClose,
  onRestore,
  onDelete,
  onClearAll,
}: HistoryDrawerProps) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  if (!open) return null;

  async function copyEntry(entry: PromptHistoryEntry) {
    const json = JSON.stringify(entry.output, null, 2);
    try {
      await navigator.clipboard.writeText(json);
      setCopiedId(entry.id);
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore clipboard denial in headless contexts
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-drawer-title"
    >
      <div className="flex h-full w-full max-w-md flex-col bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="history-drawer-title" className="text-base font-bold text-slate-900">
              Riwayat Prompt
            </h2>
            <p className="text-xs text-slate-500">
              Tersimpan lokal di browser Anda ({entries.length} entri)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup panel riwayat"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {entries.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-center">
              <p className="text-sm font-medium text-slate-700">Belum ada riwayat prompt</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">
                Setiap prompt desain yang berhasil dibuat akan tersimpan otomatis di sini agar mudah dipakai ulang.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {entries.map((entry) => {
                const dateStr = new Date(entry.createdAt).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                });
                return (
                  <li
                    key={entry.id}
                    className="rounded-xl border border-slate-200 bg-slate-50/50 p-3.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {entry.title}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {dateStr} · {entry.output.ukuran?.orientasi} {entry.output.ukuran?.lebar}×
                          {entry.output.ukuran?.tinggi} {entry.output.ukuran?.satuan}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onDelete(entry.id)}
                        aria-label={`Hapus riwayat ${entry.title}`}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </div>

                    <p className="mt-2 line-clamp-2 text-xs text-slate-600">{entry.summary}</p>

                    <div className="mt-3 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onRestore(entry);
                          onClose();
                        }}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-slate-900 px-3 text-xs font-medium text-white transition-colors hover:bg-slate-800"
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Muat ke Form</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyEntry(entry)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50"
                      >
                        {copiedId === entry.id ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                            <span>Tersalin</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            <span>Salin JSON</span>
                          </>
                        )}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {entries.length > 0 && (
          <div className="border-t border-slate-200 px-5 py-3">
            <button
              type="button"
              onClick={onClearAll}
              className="w-full rounded-lg border border-slate-200 py-2 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
            >
              Hapus Semua Riwayat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
