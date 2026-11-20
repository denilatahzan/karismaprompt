import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Facebook,
  FileText,
  History,
  Image as ImageIcon,
  Instagram,
  Loader2,
  MapPin,
  MessageCircle,
  Mic,
  Music2,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Wand2,
  Youtube,
} from 'lucide-react';
import {
  INITIAL_FORM_DATA,
  THEME_OPTIONS,
  type DesignFormData,
  type GeneratedDesignPrompt,
  type Orientation,
  type PromptHistoryEntry,
} from './types/design';
import {
  buildPromptAudit,
  DEMO_PRESET_KOMUNITAS,
  DEMO_PRESET_KULINER,
  parseBannerDimensions,
  parseColorList,
  validateDesignForm,
} from './utils/promptBuilder';
import { Header } from './components/Header';
import { ImageUploadZone } from './components/ImageUploadZone';
import { AudioInputSection } from './components/AudioInputSection';
import { PromptOutputPanel } from './components/PromptOutputPanel';
import { HistoryDrawer } from './components/HistoryDrawer';
import { ActiveSpecSidebar } from './components/ActiveSpecSidebar';
import { LoginScreen } from './components/LoginScreen';

const HISTORY_STORAGE_KEY = 'prompt-studio-banner-history-v1';
const AUTH_TOKEN_STORAGE_KEY = 'prompt-studio-banner-token-v1';

interface AuthUser {
  username: string;
  role: 'admin' | 'member';
}

function getStoredAuthToken(): string | null {
  try {
    return (
      localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ||
      sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
    );
  } catch {
    return null;
  }
}

function saveAuthToken(token: string, remember: boolean): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    if (remember) {
      localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    } else {
      sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
    }
  } catch {
    // Ignore storage errors
  }
}

function clearAuthToken(): void {
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function loadSavedHistory(): PromptHistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  const [authChecking, setAuthChecking] = useState(true);
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredAuthToken());
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [usingDefaultCredentials, setUsingDefaultCredentials] = useState(false);

  const [form, setForm] = useState<DesignFormData>(INITIAL_FORM_DATA);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formBannerError, setFormBannerError] = useState<string | null>(null);

  const [output, setOutput] = useState<GeneratedDesignPrompt | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  const [history, setHistory] = useState<PromptHistoryEntry[]>(() => loadSavedHistory());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function verifySession() {
      const token = getStoredAuthToken();
      try {
        const res = await fetch('/api/auth/status', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        const data = (await res.json()) as {
          authenticated?: boolean;
          user?: AuthUser | null;
          usingDefaultCredentials?: boolean;
        };
        if (!active) return;
        setUsingDefaultCredentials(Boolean(data.usingDefaultCredentials));
        if (data.authenticated && data.user && token) {
          setAuthUser(data.user);
          setAuthToken(token);
        } else {
          clearAuthToken();
          setAuthUser(null);
          setAuthToken(null);
        }
      } catch {
        if (!active) return;
        setAuthUser(null);
        setAuthToken(null);
      } finally {
        if (active) setAuthChecking(false);
      }
    }
    void verifySession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 20)));
    } catch {
      // Ignore storage quota errors
    }
  }, [history]);

  function handleLoginSuccess(payload: {
    token: string;
    username: string;
    role: 'admin' | 'member';
    remember: boolean;
  }) {
    saveAuthToken(payload.token, payload.remember);
    setAuthToken(payload.token);
    setAuthUser({ username: payload.username, role: payload.role });
  }

  function handleLogout() {
    clearAuthToken();
    setAuthToken(null);
    setAuthUser(null);
    setHistoryOpen(false);
  }

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => {
      setToast((current) => (current === message ? null : current));
    }, 3200);
  }

  function updateField<K extends keyof DesignFormData>(key: K, value: DesignFormData[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
    if (formBannerError) setFormBannerError(null);
  }

  const parsedDims = useMemo(
    () => parseBannerDimensions(form.ukuranBanner, form.orientasi),
    [form.ukuranBanner, form.orientasi]
  );

  const parsedColors = useMemo(
    () => parseColorList(form.warnaDominan),
    [form.warnaDominan]
  );

  const auditChecks = useMemo(() => {
    if (!output) return [];
    return buildPromptAudit(form, output);
  }, [form, output]);

  function handleLoadPreset(preset: 'komunitas' | 'kuliner') {
    const source = preset === 'komunitas' ? DEMO_PRESET_KOMUNITAS : DEMO_PRESET_KULINER;
    setForm({
      ...INITIAL_FORM_DATA,
      ...source,
    });
    setFieldErrors({});
    setFormBannerError(null);
    setApiError(null);
    showToast(
      preset === 'komunitas'
        ? 'Contoh "Komunitas Beat Konoha (A3 Vector)" dimuat.'
        : 'Contoh "Spanduk Kuliner Lengkap (3×1m)" dimuat.'
    );
  }

  function handleResetForm() {
    setForm(INITIAL_FORM_DATA);
    setFieldErrors({});
    setFormBannerError(null);
    setOutput(null);
    setApiError(null);
    showToast('Semua data formulir telah dikosongkan.');
  }

  async function handleGenerate(e?: React.FormEvent) {
    if (e) e.preventDefault();

    const validation = validateDesignForm(form);
    if (!validation.valid) {
      setFieldErrors(validation.fieldErrors);
      setFormBannerError(validation.errors[0]);
      if (validation.fieldErrors.temaDesainCustom) {
        document.getElementById('tema-desain-custom')?.focus();
      } else if (validation.fieldErrors.judulUtama) {
        document.getElementById('judul-utama')?.focus();
      }
      return;
    }

    setFieldErrors({});
    setFormBannerError(null);
    setApiError(null);
    setIsLoading(true);

    // Scroll gently to output panel so user sees live progress
    window.setTimeout(() => {
      document.getElementById('section-output')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 80);

    try {
      const response = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(form),
      });

      const payload = (await response.json()) as {
        prompt?: GeneratedDesignPrompt;
        error?: string;
        fieldErrors?: Record<string, string>;
      };

      if (response.status === 401) {
        clearAuthToken();
        setAuthToken(null);
        setAuthUser(null);
        return;
      }

      if (!response.ok || !payload.prompt) {
        if (payload.fieldErrors) setFieldErrors(payload.fieldErrors);
        throw new Error(payload.error || 'Server gagal membangun struktur prompt.');
      }

      const generated = payload.prompt;
      setOutput(generated);

      const newEntry: PromptHistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: new Date().toISOString(),
        title: form.judulUtama.trim() || generated.jenis_desain || 'Prompt Desain',
        summary: generated.gaya_visual || generated.tujuan_penggunaan,
        formSnapshot: {
          judulUtama: form.judulUtama,
          subJudul: form.subJudul,
          informasiDetail: form.informasiDetail,
          slogan: form.slogan,
          whatsapp: form.whatsapp,
          instagram: form.instagram,
          youtube: form.youtube,
          tiktok: form.tiktok,
          facebook: form.facebook,
          alamat: form.alamat,
          kontakLain: form.kontakLain,
          daftarNamaProduk: form.daftarNamaProduk,
          elemenPendukung: form.elemenPendukung,
          orientasi: form.orientasi,
          ukuranBanner: form.ukuranBanner,
          warnaDominan: form.warnaDominan,
          temaDesain: form.temaDesain,
          temaDesainCustom: form.temaDesainCustom,
          instruksiTambahan: form.instruksiTambahan,
          logoCount: form.logos.length,
          productPhotoCount: form.productPhotos.length,
          referenceCount: form.referensiDesain.length,
          hasAudio: form.audio !== null,
        },
        output: generated,
      };
      setHistory((prev) => [newEntry, ...prev].slice(0, 20));
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Koneksi ke layanan AI terputus. Silakan coba lagi.';
      setApiError(msg);
    } finally {
      setIsLoading(false);
    }
  }

  function handleRestoreHistory(entry: PromptHistoryEntry) {
    const snap = entry.formSnapshot;
    setForm({
      ...INITIAL_FORM_DATA,
      judulUtama: snap.judulUtama,
      subJudul: snap.subJudul,
      informasiDetail: snap.informasiDetail,
      slogan: snap.slogan,
      whatsapp: snap.whatsapp,
      instagram: snap.instagram,
      youtube: snap.youtube,
      tiktok: snap.tiktok,
      facebook: snap.facebook,
      alamat: snap.alamat,
      kontakLain: snap.kontakLain,
      daftarNamaProduk: snap.daftarNamaProduk,
      elemenPendukung: snap.elemenPendukung,
      orientasi: snap.orientasi,
      ukuranBanner: snap.ukuranBanner,
      warnaDominan: snap.warnaDominan,
      temaDesain: snap.temaDesain,
      temaDesainCustom: snap.temaDesainCustom,
      instruksiTambahan: snap.instruksiTambahan,
    });
    setOutput(entry.output);
    setApiError(null);
    setFieldErrors({});
    setFormBannerError(null);
    showToast(`Riwayat "${entry.title}" dimuat kembali.`);
  }

  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F8FAFC] text-slate-600">
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-slate-900" aria-hidden="true" />
          <span>Memeriksa sesi login...</span>
        </div>
      </div>
    );
  }

  if (!authUser) {
    return (
      <LoginScreen
        usingDefaultCredentials={usingDefaultCredentials}
        onLoginSuccess={handleLoginSuccess}
      />
    );
  }

  return (
    <div id="top" className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <Header
        username={authUser.username}
        historyCount={history.length}
        onOpenHistory={() => setHistoryOpen(true)}
        onLogout={handleLogout}
      />

      <main className="mx-auto max-w-[1160px] px-4 py-8 sm:px-6 lg:py-10">
        {/* Page Heading + Mobile Quick Preset Toolbar */}
        <div className="mb-8 flex flex-col gap-4 border-b border-slate-200/80 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Konfigurasi Desain
            </h1>
            <p className="max-w-2xl text-sm text-slate-600">
              Lengkapi data di bawah untuk membangun struktur PROMPT JSON yang solid dan presisi sesuai setiap kolom yang Anda perintahkan.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:hidden">
            <button
              type="button"
              onClick={() => handleLoadPreset('komunitas')}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <Sparkles className="h-3.5 w-3.5 text-rose-500" aria-hidden="true" />
              <span>Contoh Kaos A3</span>
            </button>
            <button
              type="button"
              onClick={() => handleLoadPreset('kuliner')}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              <span>Contoh Banner 3×1m</span>
            </button>
            <button
              type="button"
              onClick={() => setHistoryOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 md:hidden"
            >
              <History className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
              <span>Riwayat</span>
              {history.length > 0 && (
                <span className="font-mono text-[11px] text-slate-500 tabular-nums">
                  ({history.length})
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Workspace Grid: Main Configurator + Sticky Active Spec Rail */}
        <div className="flex items-start gap-8">
          <div className="min-w-0 flex-1 space-y-6">
            <form onSubmit={(e) => void handleGenerate(e)} noValidate className="space-y-6">
              {formBannerError && (
                <div
                  role="alert"
                  className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800"
                >
                  {formBannerError}
                </div>
              )}

              {/* 1. DATA INFORMASI (TEKS) */}
              <section
                id="section-teks"
                aria-labelledby="heading-section-1"
                className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="mb-5 flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                  <FileText className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  <h2
                    id="heading-section-1"
                    className="text-sm font-bold tracking-wide text-slate-900"
                  >
                    1. Data Informasi (Teks)
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="judul-utama"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Judul Utama
                    </label>
                    <input
                      id="judul-utama"
                      type="text"
                      value={form.judulUtama}
                      onChange={(e) => updateField('judulUtama', e.target.value)}
                      placeholder="E.g. Promo Merdeka"
                      aria-invalid={Boolean(fieldErrors.judulUtama)}
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                    {fieldErrors.judulUtama && (
                      <p className="text-xs font-medium text-rose-600">
                        {fieldErrors.judulUtama}
                      </p>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="sub-judul"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Sub-Judul
                    </label>
                    <input
                      id="sub-judul"
                      type="text"
                      value={form.subJudul}
                      onChange={(e) => updateField('subJudul', e.target.value)}
                      placeholder="E.g. Diskon Hingga 50%"
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label
                      htmlFor="informasi-detail"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Informasi Detail / Deskripsi
                    </label>
                    <textarea
                      id="informasi-detail"
                      rows={3}
                      value={form.informasiDetail}
                      onChange={(e) => updateField('informasiDetail', e.target.value)}
                      placeholder="Detail penawaran, syarat, dsb..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label
                      htmlFor="slogan"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Slogan
                    </label>
                    <input
                      id="slogan"
                      type="text"
                      value={form.slogan}
                      onChange={(e) => updateField('slogan', e.target.value)}
                      placeholder="E.g. Cepat, Murah, Enak"
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                  </div>
                </div>
              </section>

              {/* 2. PANEL KONTAK & ALAMAT */}
              <section
                id="section-kontak"
                aria-labelledby="heading-section-2"
                className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="mb-5 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <MapPin className="h-4 w-4 text-rose-600" aria-hidden="true" />
                    <h2
                      id="heading-section-2"
                      className="text-sm font-bold tracking-wide text-slate-900"
                    >
                      2. Panel Kontak &amp; Alamat
                    </h2>
                  </div>
                  <span className="text-xs text-slate-500">
                    Opsional · Hanya kolom terisi yang dicetak
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="kontak-whatsapp"
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                    >
                      <MessageCircle className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      <span>WhatsApp</span>
                    </label>
                    <input
                      id="kontak-whatsapp"
                      type="text"
                      value={form.whatsapp}
                      onChange={(e) => updateField('whatsapp', e.target.value)}
                      placeholder="0812..."
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="kontak-instagram"
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                    >
                      <Instagram className="h-3.5 w-3.5 text-pink-600" aria-hidden="true" />
                      <span>Instagram</span>
                    </label>
                    <input
                      id="kontak-instagram"
                      type="text"
                      value={form.instagram}
                      onChange={(e) => updateField('instagram', e.target.value)}
                      placeholder="@brand_anda"
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="kontak-youtube"
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                    >
                      <Youtube className="h-3.5 w-3.5 text-red-600" aria-hidden="true" />
                      <span>YouTube</span>
                    </label>
                    <input
                      id="kontak-youtube"
                      type="text"
                      value={form.youtube}
                      onChange={(e) => updateField('youtube', e.target.value)}
                      placeholder="Nama Channel"
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="kontak-tiktok"
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                    >
                      <Music2 className="h-3.5 w-3.5 text-slate-800" aria-hidden="true" />
                      <span>TikTok</span>
                    </label>
                    <input
                      id="kontak-tiktok"
                      type="text"
                      value={form.tiktok}
                      onChange={(e) => updateField('tiktok', e.target.value)}
                      placeholder="@username_tiktok"
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="kontak-facebook"
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                    >
                      <Facebook className="h-3.5 w-3.5 text-blue-600" aria-hidden="true" />
                      <span>Facebook</span>
                    </label>
                    <input
                      id="kontak-facebook"
                      type="text"
                      value={form.facebook}
                      onChange={(e) => updateField('facebook', e.target.value)}
                      placeholder="Username FB"
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="kontak-alamat"
                      className="flex items-center gap-1.5 text-xs font-semibold text-slate-700"
                    >
                      <MapPin className="h-3.5 w-3.5 text-slate-600" aria-hidden="true" />
                      <span>Alamat</span>
                    </label>
                    <input
                      id="kontak-alamat"
                      type="text"
                      value={form.alamat}
                      onChange={(e) => updateField('alamat', e.target.value)}
                      placeholder="Jl. Anggrek No. 12"
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <label
                      htmlFor="kontak-lain"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Kontak Lain / Tambahan
                    </label>
                    <input
                      id="kontak-lain"
                      type="text"
                      value={form.kontakLain}
                      onChange={(e) => updateField('kontakLain', e.target.value)}
                      placeholder="Website atau info lain..."
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                  </div>
                </div>
              </section>

              {/* 3. BAHAN VISUAL */}
              <section
                id="section-visual"
                aria-labelledby="heading-section-3"
                className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="mb-5 flex items-center justify-between gap-2 border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2.5">
                    <ImageIcon className="h-4 w-4 text-rose-600" aria-hidden="true" />
                    <h2
                      id="heading-section-3"
                      className="text-sm font-bold tracking-wide text-slate-900"
                    >
                      3. Bahan Visual
                    </h2>
                  </div>
                  <span className="font-mono text-xs text-slate-500">PNG / JPG / WEBP</span>
                </div>

                <div className="space-y-5">
                  <ImageUploadZone
                    id="upload-logo"
                    label="Upload Logo (Bisa lebih dari satu)"
                    helperText="Dapat digunakan untuk logo brand maupun foto objek/subjek utama desain. Mendukung pilih file, seret gambar, atau Ctrl+V."
                    items={form.logos}
                    onChange={(next) => updateField('logos', next)}
                    onNotify={showToast}
                  />

                  <ImageUploadZone
                    id="upload-produk"
                    label="Foto Produk (Bisa lebih dari satu)"
                    helperText="AI akan menganalisis detail tiap foto produk yang diunggah untuk diarahkan komposisi dan pencahayaannya."
                    items={form.productPhotos}
                    onChange={(next) => updateField('productPhotos', next)}
                    onNotify={showToast}
                  />

                  <div className="space-y-1.5">
                    <label
                      htmlFor="daftar-nama-produk"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Daftar Nama Produk (Jika foto tidak ada/kurang)
                    </label>
                    <textarea
                      id="daftar-nama-produk"
                      rows={3}
                      value={form.daftarNamaProduk}
                      onChange={(e) => updateField('daftarNamaProduk', e.target.value)}
                      placeholder="E.g. Sate Ayam, Gule Kambing, Es Teh..."
                      className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                    <p className="text-xs text-slate-500">
                      AI akan menyusun deskripsi visual berdasarkan nama produk jika foto tidak tersedia.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label
                      htmlFor="elemen-pendukung"
                      className="block text-xs font-semibold text-slate-700"
                    >
                      Elemen Pendukung Lain
                    </label>
                    <input
                      id="elemen-pendukung"
                      type="text"
                      value={form.elemenPendukung}
                      onChange={(e) => updateField('elemenPendukung', e.target.value)}
                      placeholder="E.g. Ornamen batik, ikon diskon..."
                      className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                    />
                  </div>
                </div>
              </section>

              {/* 4. SPESIFIKASI & REFERENSI */}
              <section
                id="section-spesifikasi"
                aria-labelledby="heading-section-4"
                className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="mb-5 flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                  <SlidersHorizontal className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  <h2
                    id="heading-section-4"
                    className="text-sm font-bold tracking-wide text-slate-900"
                  >
                    4. Spesifikasi &amp; Referensi
                  </h2>
                </div>

                <div className="space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label
                        htmlFor="orientasi"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Orientasi
                      </label>
                      <select
                        id="orientasi"
                        value={form.orientasi}
                        onChange={(e) =>
                          updateField('orientasi', e.target.value as Orientation)
                        }
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 transition-colors focus:border-slate-900"
                      >
                        <option value="Landscape">Landscape</option>
                        <option value="Portrait">Portrait</option>
                        <option value="Square">Square</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="ukuran-banner"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Ukuran Banner
                      </label>
                      <input
                        id="ukuran-banner"
                        type="text"
                        value={form.ukuranBanner}
                        onChange={(e) => updateField('ukuranBanner', e.target.value)}
                        placeholder="E.g. 3x1m atau A3"
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                      />
                      <p className="font-mono text-[11px] text-slate-500 tabular-nums">
                        Kalibrasi: {parsedDims.lebar} × {parsedDims.tinggi} {parsedDims.satuan} · Rasio{' '}
                        {parsedDims.rasio}
                      </p>
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="warna-dominan"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Warna Dominan
                      </label>
                      <input
                        id="warna-dominan"
                        type="text"
                        value={form.warnaDominan}
                        onChange={(e) => updateField('warnaDominan', e.target.value)}
                        placeholder="E.g. Biru Navy & Kuning"
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                      />
                      {parsedColors.length > 0 && (
                        <p className="text-[11px] text-slate-500">
                          Terdeteksi {parsedColors.length} warna: {parsedColors.join(' · ')}
                        </p>
                      )}
                    </div>

                    <div className="space-y-1.5">
                      <label
                        htmlFor="tema-desain"
                        className="block text-xs font-semibold text-slate-700"
                      >
                        Tema Desain
                      </label>
                      <select
                        id="tema-desain"
                        value={form.temaDesain}
                        onChange={(e) => updateField('temaDesain', e.target.value)}
                        className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 transition-colors focus:border-slate-900"
                      >
                        {THEME_OPTIONS.map((opt) => (
                          <option key={opt.value || 'empty'} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {form.temaDesain === 'custom' && (
                      <div className="space-y-1.5 sm:col-span-2">
                        <label
                          htmlFor="tema-desain-custom"
                          className="block text-xs font-semibold text-slate-700"
                        >
                          Tulis Tema Desain Custom
                        </label>
                        <input
                          id="tema-desain-custom"
                          type="text"
                          value={form.temaDesainCustom}
                          onChange={(e) => updateField('temaDesainCustom', e.target.value)}
                          placeholder="E.g. Cyberpunk, Vector Sablon, Pastel Dream..."
                          aria-invalid={Boolean(fieldErrors.temaDesainCustom)}
                          className="h-11 w-full rounded-lg border border-slate-200 bg-white px-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                        />
                        {fieldErrors.temaDesainCustom && (
                          <p className="text-xs font-medium text-rose-600">
                            {fieldErrors.temaDesainCustom}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <ImageUploadZone
                    id="upload-referensi"
                    label="Upload Referensi Desain (Opsional)"
                    helperText="AI akan meniru struktur komposisi, tipografi, dan gaya visual referensi tanpa menyalin teks asli dari gambar referensi."
                    items={form.referensiDesain}
                    maxFiles={3}
                    errorText={fieldErrors.referensiDesain}
                    onChange={(next) => updateField('referensiDesain', next)}
                    onNotify={showToast}
                  />
                </div>
              </section>

              {/* 5. PROMPT PENDUKUNG & PERINTAH KHUSUS */}
              <section
                id="section-khusus"
                aria-labelledby="heading-section-5"
                className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="mb-5 flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                  <Wand2 className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  <h2
                    id="heading-section-5"
                    className="text-sm font-bold tracking-wide text-slate-900"
                  >
                    5. Prompt Pendukung &amp; Perintah Khusus
                  </h2>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="instruksi-tambahan"
                    className="block text-xs font-semibold text-slate-700"
                  >
                    Instruksi Tambahan (Opsional)
                  </label>
                  <textarea
                    id="instruksi-tambahan"
                    rows={3}
                    value={form.instruksiTambahan}
                    onChange={(e) => updateField('instruksiTambahan', e.target.value)}
                    placeholder="E.g. Gunakan style ala poster film 90-an, atau artwork kaos jadikan background hitam..."
                    className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                  />
                  <p className="text-xs text-slate-500">
                    Gunakan kolom ini untuk memberikan arahan gaya, komposisi, jenis media (misal artwork kaos), atau nuansa spesifik prioritas utama.
                  </p>
                </div>
              </section>

              {/* 6. INSTRUKSI & DATA VIA AUDIO */}
              <section
                id="section-audio"
                aria-labelledby="heading-section-6"
                className="scroll-mt-24 rounded-xl border border-slate-200 bg-white p-5 sm:p-6"
              >
                <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3.5">
                  <Mic className="h-4 w-4 text-rose-600" aria-hidden="true" />
                  <h2
                    id="heading-section-6"
                    className="text-sm font-bold tracking-wide text-slate-900"
                  >
                    6. Instruksi &amp; Data via Audio
                  </h2>
                </div>
                <p className="mb-4 text-xs text-slate-500">
                  Rekam instruksi lisan Anda secara live atau masukkan file audio dari perangkat Anda. AI akan mendengarkan dan menerapkannya ke prompt.
                </p>

                <AudioInputSection
                  audio={form.audio}
                  onChange={(audio) => updateField('audio', audio)}
                  onNotify={showToast}
                />
              </section>

              {/* PRIMARY SUBMIT & RESET CONTROLS */}
              <div className="space-y-3 pt-1">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Membangun Prompt...</span>
                    </>
                  ) : (
                    <>
                      <span>Generate Design Prompt</span>
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleResetForm}
                  disabled={isLoading}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-xs font-semibold text-rose-600 transition-colors hover:border-rose-200 hover:bg-rose-50 disabled:opacity-50"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Kosongkan Semua Data Form</span>
                </button>
              </div>
            </form>

            {/* 7. PROMPT OUTPUT */}
            <PromptOutputPanel
              output={output}
              auditChecks={auditChecks}
              isLoading={isLoading}
              errorMessage={apiError}
              onRetry={() => void handleGenerate()}
            />
          </div>

          {/* Right Rail on Desktop */}
          <ActiveSpecSidebar form={form} onLoadPreset={handleLoadPreset} />
        </div>
      </main>

      <HistoryDrawer
        open={historyOpen}
        entries={history}
        onClose={() => setHistoryOpen(false)}
        onRestore={handleRestoreHistory}
        onDelete={(id) => setHistory((prev) => prev.filter((item) => item.id !== id))}
        onClearAll={() => {
          setHistory([]);
          showToast('Seluruh riwayat prompt telah dihapus.');
        }}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-40 max-w-sm rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-medium text-white shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
