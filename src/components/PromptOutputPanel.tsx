import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Terminal,
  XCircle,
} from 'lucide-react';
import type { AuditCheckItem, GeneratedDesignPrompt } from '../types/design';

interface PromptOutputPanelProps {
  output: GeneratedDesignPrompt | null;
  auditChecks: AuditCheckItem[];
  isLoading: boolean;
  errorMessage: string | null;
  onRetry: () => void;
}

export function PromptOutputPanel({
  output,
  auditChecks,
  isLoading,
  errorMessage,
  onRetry,
}: PromptOutputPanelProps) {
  const [copied, setCopied] = useState(false);
  const [compactMode, setCompactMode] = useState(false);

  const formattedJson = useMemo(() => {
    if (!output) return '';
    return compactMode ? JSON.stringify(output) : JSON.stringify(output, null, 2);
  }, [output, compactMode]);

  const passedCount = auditChecks.filter((c) => c.passed).length;

  async function handleCopy() {
    if (!formattedJson) return;
    try {
      await navigator.clipboard.writeText(formattedJson);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = formattedJson;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    }
  }

  function handleDownload() {
    if (!formattedJson || !output) return;
    const slug = (output.teks_desain?.judul_utama || output.jenis_desain || 'design-prompt')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40);
    const blob = new Blob([formattedJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug || 'design-prompt'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section
      id="section-output"
      aria-labelledby="heading-prompt-output"
      className="scroll-mt-24 space-y-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="heading-prompt-output"
          className="text-sm font-bold tracking-wide text-slate-900"
        >
          7. Prompt Output
        </h2>
        {output && !isLoading && !errorMessage && (
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="font-mono tabular-nums">
              {formattedJson.length.toLocaleString('id-ID')} karakter
            </span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setCompactMode((prev) => !prev)}
              className="font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              {compactMode ? 'Format Rapi' : 'Format Ringkas'}
            </button>
          </div>
        )}
      </div>

      {/* Main Dark Terminal Container matching reference */}
      <div
        data-testid="prompt-output-box"
        className="overflow-hidden rounded-xl border border-slate-800 bg-[#0B1120] text-slate-100"
      >
        {/* Top Action Bar when populated */}
        {output && !isLoading && !errorMessage && (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3">
            <button
              type="button"
              onClick={() => void handleCopy()}
              className={`inline-flex h-10 items-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-semibold text-white transition-colors ${
                copied
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" aria-hidden="true" />
                  <span>Tersalin!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  <span>Salin Hasil Prompt (Copy)</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-800/80 px-3 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Unduh JSON</span>
              </button>
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-700 bg-slate-800/80 px-3 text-xs font-medium text-slate-200 transition-colors hover:border-slate-500 hover:bg-slate-800"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Buat Ulang</span>
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div
            role="status"
            aria-live="polite"
            className="flex min-h-[260px] flex-col items-center justify-center gap-3 px-6 py-12 text-center"
          >
            <Loader2 className="h-8 w-8 animate-spin text-rose-400" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-white">AI Sedang Merumuskan...</p>
              <p className="text-sm text-slate-400">
                Menerjemahkan detail teks, bahan visual, dan spesifikasi Anda ke format JSON terstruktur.
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!isLoading && errorMessage && (
          <div
            role="alert"
            className="flex min-h-[240px] flex-col items-center justify-center gap-4 px-6 py-10 text-center"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/15 text-rose-400">
              <AlertTriangle className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="max-w-md space-y-1">
              <p className="text-base font-semibold text-white">Gagal Membangun Prompt</p>
              <p className="text-sm text-slate-400">{errorMessage}</p>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex h-10 items-center gap-2 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>Coba Generate Ulang</span>
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !errorMessage && !output && (
          <div className="flex min-h-[220px] flex-col items-center justify-center gap-2.5 px-6 py-12 text-center">
            <Terminal className="h-7 w-7 text-slate-600" aria-hidden="true" />
            <p className="text-sm font-medium text-slate-300">
              Belum ada prompt yang dihasilkan
            </p>
            <p className="max-w-md text-xs leading-relaxed text-slate-500">
              Lengkapi kolom konfigurasi di atas sesuai kebutuhan desain Anda, lalu klik{' '}
              <span className="font-medium text-slate-300">Generate Design Prompt</span> untuk
              membuat JSON prompt siap pakai.
            </p>
          </div>
        )}

        {/* Populated JSON Code View */}
        {!isLoading && !errorMessage && output && (
          <div className="json-scroll max-h-[540px] overflow-auto p-5">
            <pre
              data-testid="prompt-json-pre"
              className="font-mono text-[13px] leading-relaxed tracking-[0.01em] text-slate-200 whitespace-pre-wrap break-words"
            >
              {formattedJson}
            </pre>
          </div>
        )}
      </div>

      {/* Field Fidelity Audit Verification Panel */}
      {!isLoading && !errorMessage && output && auditChecks.length > 0 && (
        <div
          data-testid="prompt-audit-panel"
          className="rounded-xl border border-slate-200 bg-white p-4"
        >
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <h3 className="text-xs font-semibold text-slate-900">
              Verifikasi Kesesuaian Kolom Formulir
            </h3>
            <span className="font-mono text-xs text-slate-600 tabular-nums">
              {passedCount}/{auditChecks.length} kolom sesuai instruksi
            </span>
          </div>

          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {auditChecks.map((check) => (
              <li
                key={check.id}
                className="flex items-start gap-2 text-xs text-slate-700"
              >
                {check.passed ? (
                  <CheckCircle2
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                    aria-hidden="true"
                  />
                ) : (
                  <XCircle
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600"
                    aria-hidden="true"
                  />
                )}
                <div className="min-w-0">
                  <span className="font-semibold text-slate-900">{check.label}</span>
                  <span className="mx-1 text-slate-300" aria-hidden="true">
                    ·
                  </span>
                  <span className="text-slate-600">{check.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
