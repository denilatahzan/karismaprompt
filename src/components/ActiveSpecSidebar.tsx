import { Check, CircleDashed, Sparkles } from 'lucide-react';
import type { DesignFormData } from '../types/design';
import {
  getActiveContacts,
  parseBannerDimensions,
  parseColorList,
  resolveEffectiveTheme,
} from '../utils/promptBuilder';

interface ActiveSpecSidebarProps {
  form: DesignFormData;
  onLoadPreset: (preset: 'komunitas' | 'kuliner') => void;
}

export function ActiveSpecSidebar({ form, onLoadPreset }: ActiveSpecSidebarProps) {
  const dims = parseBannerDimensions(form.ukuranBanner, form.orientasi);
  const contacts = getActiveContacts(form);
  const colors = parseColorList(form.warnaDominan);
  const theme = resolveEffectiveTheme(form);

  const sections = [
    {
      href: '#section-teks',
      label: '1. Data Informasi (Teks)',
      filled: Boolean(
        form.judulUtama.trim() ||
          form.subJudul.trim() ||
          form.informasiDetail.trim() ||
          form.slogan.trim()
      ),
      summary: form.judulUtama.trim() || 'Belum diisi',
    },
    {
      href: '#section-kontak',
      label: '2. Kontak & Alamat',
      filled: contacts.length > 0,
      summary:
        contacts.length > 0 ? `${contacts.length} kanal aktif` : 'Kosong (tidak dicetak)',
    },
    {
      href: '#section-visual',
      label: '3. Bahan Visual',
      filled: Boolean(
        form.logos.length > 0 ||
          form.productPhotos.length > 0 ||
          form.daftarNamaProduk.trim() ||
          form.elemenPendukung.trim()
      ),
      summary:
        [
          form.logos.length > 0 ? `${form.logos.length} logo` : null,
          form.productPhotos.length > 0 ? `${form.productPhotos.length} foto` : null,
          form.daftarNamaProduk.trim() ? 'daftar produk' : null,
          form.elemenPendukung.trim() ? 'elemen' : null,
        ]
          .filter(Boolean)
          .join(', ') || 'Opsional',
    },
    {
      href: '#section-spesifikasi',
      label: '4. Spesifikasi & Referensi',
      filled: Boolean(
        form.ukuranBanner.trim() ||
          colors.length > 0 ||
          theme ||
          form.referensiDesain.length > 0
      ),
      summary: `${dims.orientasi} · ${dims.lebar}×${dims.tinggi} ${dims.satuan}`,
    },
    {
      href: '#section-khusus',
      label: '5. Perintah Khusus',
      filled: Boolean(form.instruksiTambahan.trim()),
      summary: form.instruksiTambahan.trim() ? 'Prioritas tinggi aktif' : 'Opsional',
    },
    {
      href: '#section-audio',
      label: '6. Instruksi Audio',
      filled: form.audio !== null,
      summary: form.audio ? form.audio.name : 'Tidak ada audio',
    },
  ];

  const previewRatioClass =
    dims.orientasi === 'Portrait'
      ? 'h-16 w-12'
      : dims.orientasi === 'Square'
        ? 'h-14 w-14'
        : 'h-11 w-20';

  return (
    <aside aria-label="Ringkasan konfigurasi desain" className="hidden w-72 shrink-0 xl:block">
      <div className="sticky top-24 space-y-5">
        {/* Calibrated Canvas Preview */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">Kalibrasi Kanvas</p>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-20 w-24 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50">
              <div
                className={`${previewRatioClass} flex items-center justify-center rounded border-2 border-slate-800 bg-white font-mono text-[10px] font-semibold text-slate-700`}
              >
                {dims.rasio}
              </div>
            </div>
            <div className="min-w-0 space-y-0.5">
              <p className="text-sm font-bold text-slate-900">{dims.orientasi}</p>
              <p className="font-mono text-xs text-slate-700 tabular-nums">
                {dims.lebar} × {dims.tinggi} {dims.satuan}
              </p>
              <p className="text-xs text-slate-500">
                {colors.length > 0 ? `${colors.length} warna diminta` : 'Palet adaptif'}
              </p>
            </div>
          </div>
        </div>

        {/* Active Section Checklist */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-semibold text-slate-500">Peta Kolom Aktif</p>
          <p className="mt-1 text-xs leading-relaxed text-slate-500">
            Hanya kolom yang diisi yang akan dimasukkan ke JSON prompt. Kolom kosong dikunci agar tidak dikarang AI.
          </p>
          <ul className="mt-3 divide-y divide-slate-100">
            {sections.map((sec) => (
              <li key={sec.href} className="py-2 first:pt-0 last:pb-0">
                <a
                  href={sec.href}
                  className="group flex items-start gap-2.5 text-left transition-colors"
                >
                  {sec.filled ? (
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600"
                      aria-hidden="true"
                    />
                  ) : (
                    <CircleDashed
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300"
                      aria-hidden="true"
                    />
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-slate-800 group-hover:text-slate-950">
                      {sec.label}
                    </p>
                    <p className="truncate text-[11px] text-slate-500">{sec.summary}</p>
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </div>

        {/* Quick Demo Presets */}
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Sparkles className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
            <span>Template Uji Cepat</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Isi contoh konfigurasi nyata untuk langsung melihat hasil prompt JSON.
          </p>
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={() => onLoadPreset('komunitas')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-100"
            >
              Artwork Kaos Komunitas (A3 Vector)
            </button>
            <button
              type="button"
              onClick={() => onLoadPreset('kuliner')}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs font-medium text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-100"
            >
              Spanduk Kuliner Lengkap (3×1m)
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
