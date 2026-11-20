import { Layers, LogOut } from 'lucide-react';

interface HeaderProps {
  username: string;
  historyCount: number;
  onOpenHistory: () => void;
  onLogout: () => void;
}

export function Header({
  username,
  historyCount,
  onOpenHistory,
  onLogout,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-[1160px] items-center justify-between gap-8 px-4 sm:px-6">
        {/* Zone 1: Brand mark */}
        <a
          href="#top"
          className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-slate-900"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Layers className="h-4 w-4 text-rose-400" aria-hidden="true" />
          </span>
          <span className="text-base font-bold tracking-tight">
            Prompt Studio Banner
          </span>
        </a>

        {/* Zone 2: 5 clean single-line navigation controls */}
        <nav
          aria-label="Navigasi bagian formulir"
          className="hidden items-center gap-6 text-sm font-medium text-slate-600 md:flex"
        >
          <a
            href="#section-teks"
            className="shrink-0 whitespace-nowrap transition-colors hover:text-slate-900 hover:underline hover:underline-offset-4"
          >
            Teks &amp; Kontak
          </a>
          <a
            href="#section-visual"
            className="shrink-0 whitespace-nowrap transition-colors hover:text-slate-900 hover:underline hover:underline-offset-4"
          >
            Bahan Visual
          </a>
          <a
            href="#section-spesifikasi"
            className="shrink-0 whitespace-nowrap transition-colors hover:text-slate-900 hover:underline hover:underline-offset-4"
          >
            Spesifikasi
          </a>
          <a
            href="#section-output"
            className="shrink-0 whitespace-nowrap transition-colors hover:text-slate-900 hover:underline hover:underline-offset-4"
          >
            Hasil Prompt
          </a>
          <button
            type="button"
            onClick={onOpenHistory}
            className="shrink-0 whitespace-nowrap text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 hover:underline hover:underline-offset-4"
          >
            Riwayat
            {historyCount > 0 && (
              <span className="ml-1 font-mono text-xs text-slate-500 tabular-nums">
                ({historyCount})
              </span>
            )}
          </button>
        </nav>

        {/* Zone 3: Single primary header action (Logout) */}
        <div className="flex shrink-0 items-center">
          <button
            type="button"
            onClick={onLogout}
            aria-label={`Keluar dari akun ${username}`}
            className="inline-flex h-10 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3.5 text-sm font-medium text-slate-800 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-4 w-4 text-slate-500" aria-hidden="true" />
            <span className="hidden sm:inline max-w-[110px] truncate">{username}</span>
            <span className="hidden text-slate-300 sm:inline" aria-hidden="true">
              ·
            </span>
            <span>Keluar</span>
          </button>
        </div>
      </div>
    </header>
  );
}
