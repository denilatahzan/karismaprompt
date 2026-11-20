import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type, type Part } from '@google/genai';
import type { DesignFormData, GeneratedDesignPrompt } from './src/types/design';
import {
  buildServerPromptPayload,
  extractCleanJson,
  validateDesignForm,
} from './src/utils/promptBuilder';
import {
  extractBearerToken,
  parseConfiguredUsers,
  resolveSigningSecret,
  signSessionToken,
  verifySessionToken,
  verifyUserCredentials,
} from './src/utils/auth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '35mb' }));

const SYSTEM_INSTRUCTION = `Kamu adalah Senior Art Director & Prompt Engineer profesional khusus desain grafis cetak & digital (spanduk/banner, poster, flyer, artwork kaos sablon pecah warna, kemasan, dan promosi UMKM).

Tugas utamamu: mengubah konfigurasi formulir user + lampiran gambar (logo/subjek, foto produk, referensi desain) + lampiran audio (jika ada) menjadi SATU objek JSON prompt desain terstruktur yang siap langsung disalin-tempel ke AI Image Generator (seperti ChatGPT Image, Gemini Image, Midjourney, atau Ideogram) untuk menghasilkan desain final berkualitas studio.

ATURAN MUTLAK KETEPATAN KOLOM (TIDAK BOLEH DILANGGAR):
1. VERBATIM TEXT: Setiap teks yang diisi user pada Judul Utama, Sub-Judul, Informasi Detail, dan Slogan WAJIB muncul persis sesuai ejaan aslinya di field teks_desain. JANGAN typo, JANGAN mengubah kata, JANGAN menerjemahkan teks yang ditulis user.
2. ANTI-HALUSINASI KOLOM KOSONG: Jika Sub-Judul, Informasi Detail, Slogan, Referensi Desain, Instruksi Tambahan, atau Audio dikosongkan oleh user, WAJIB isi nilainya dengan null (atau array kosong [] untuk daftar bahan visual yang kosong). JANGAN PERNAH mengarang nomor HP, akun Instagram, TikTok, alamat, atau promo fiktif!
3. PANEL KONTAK: Hanya jika user mengisi minimal satu kolom kontak, set tampilkan_panel_kontak = true dan masukkan HANYA kontak yang diisi secara verbatim. Jika semua kontak kosong, set tampilkan_panel_kontak = false dan daftar_kontak = [].
4. UKURAN & ORIENTASI: Gunakan persis nilai lebar, tinggi, satuan, rasio, dan orientasi yang sudah terkalibrasi dari formulir.
5. WARNA DOMINAN: Jika user menuliskan daftar warna (misal: hitam, biru, pink, kuning, putih, abu), WAJIB masukkan seluruh warna tersebut ke warna_utama dan jelaskan peran tiap warna pada palet_warna_detail (sangat krusial untuk sablon pecah warna / vektor).
6. BAHAN VISUAL MULTIMODAL:
   - Jika ada gambar pada Upload Logo / Subjek Utama: amati detail visualnya (bentuk objek, warna, posisi, karakter/kendaraan/logo) dan tuliskan instruksi integrasi yang presisi pada bahan_visual.logo_dan_subjek_utama.
   - Jika ada gambar pada Foto Produk: amati setiap produk dan jelaskan penempatan & pencahayaannya pada bahan_visual.foto_produk.
   - Jika ada Daftar Nama Produk (teks): ubah setiap nama produk menjadi deskripsi visual yang kaya & menggugah pada bahan_visual.deskripsi_visual_produk_dari_teks.
   - Jika ada Elemen Pendukung Lain: masukkan semua ke bahan_visual.elemen_pendukung dan komposisi_layout.
7. REFERENSI DESAIN: Jika user mengunggah gambar referensi desain, analisis tata letak, gaya tipografi, ketebalan garis vektor, teknik shading, framing, dan komposisinya lalu tuangkan ke referensi_gaya_visual & komposisi_layout. DILARANG KERAS menyalin teks, judul, atau nama brand yang ada pada gambar referensi!
8. PERINTAH KHUSUS (PRIORITAS TERTINGGI): Instruksi Tambahan dari user (seperti "artwork kaos jadikan background hitam") bersifat mengikat dan mengoverride asumsi default (misal jenis_desain menjadi Artwork Kaos, latar_belakang menjadi Hitam pekat solid #000000, gaya garis/warna disesuaikan untuk sablon).
9. INSTRUKSI AUDIO: Jika ada file/rekaman audio terlampir, dengarkan isinya dengan teliti, rangkum di instruksi_audio, dan terapkan semua permintaan dari audio ke field desain terkait.
10. OUTPUT: Kembalikan HANYA JSON valid yang mematuhi skema, berbahasa Indonesia profesional yang jelas dengan istilah teknis desain visual yang presisi agar langsung dipahami AI generator gambar.`;

const RESPONSE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    jenis_desain: {
      type: Type.STRING,
      description: 'Jenis media desain final sesuai konfigurasi & instruksi khusus (misal: Banner Promo Kuliner, Artwork Kaos Komunitas Motor).',
    },
    ukuran: {
      type: Type.OBJECT,
      properties: {
        lebar: { type: Type.STRING },
        tinggi: { type: Type.STRING },
        satuan: { type: Type.STRING },
        rasio: { type: Type.STRING },
        orientasi: { type: Type.STRING },
      },
      required: ['lebar', 'tinggi', 'satuan', 'rasio', 'orientasi'],
    },
    tujuan_penggunaan: { type: Type.STRING },
    tema_desain: { type: Type.STRING },
    gaya_visual: { type: Type.STRING },
    warna_utama: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
    palet_warna_detail: {
      type: Type.OBJECT,
      properties: {
        latar_belakang: { type: Type.STRING },
        warna_dominan: { type: Type.STRING },
        warna_aksen: { type: Type.STRING },
        aturan_warna: { type: Type.STRING },
      },
      required: ['latar_belakang', 'warna_dominan', 'warna_aksen', 'aturan_warna'],
    },
    teks_desain: {
      type: Type.OBJECT,
      properties: {
        judul_utama: { type: Type.STRING },
        sub_judul: { type: Type.STRING },
        informasi_detail: { type: Type.STRING },
        slogan: { type: Type.STRING },
      },
      required: ['judul_utama', 'sub_judul', 'informasi_detail', 'slogan'],
    },
    kontak_dan_alamat: {
      type: Type.OBJECT,
      properties: {
        tampilkan_panel_kontak: { type: Type.BOOLEAN },
        daftar_kontak: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              platform: { type: Type.STRING },
              nilai: { type: Type.STRING },
              penempatan: { type: Type.STRING },
            },
            required: ['platform', 'nilai', 'penempatan'],
          },
        },
        catatan_kontak: { type: Type.STRING },
      },
      required: ['tampilkan_panel_kontak', 'daftar_kontak', 'catatan_kontak'],
    },
    bahan_visual: {
      type: Type.OBJECT,
      properties: {
        logo_dan_subjek_utama: { type: Type.ARRAY, items: { type: Type.STRING } },
        foto_produk: { type: Type.ARRAY, items: { type: Type.STRING } },
        deskripsi_visual_produk_dari_teks: { type: Type.ARRAY, items: { type: Type.STRING } },
        elemen_pendukung: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: [
        'logo_dan_subjek_utama',
        'foto_produk',
        'deskripsi_visual_produk_dari_teks',
        'elemen_pendukung',
      ],
    },
    komposisi_layout: {
      type: Type.OBJECT,
      properties: {
        struktur_atas: { type: Type.STRING },
        fokus_tengah: { type: Type.STRING },
        struktur_bawah: { type: Type.STRING },
        keseimbangan_visual: { type: Type.STRING },
      },
      required: ['struktur_atas', 'fokus_tengah', 'struktur_bawah', 'keseimbangan_visual'],
    },
    tipografi: {
      type: Type.OBJECT,
      properties: {
        gaya_judul: { type: Type.STRING },
        gaya_teks_pendukung: { type: Type.STRING },
        efek_teks: { type: Type.STRING },
      },
      required: ['gaya_judul', 'gaya_teks_pendukung', 'efek_teks'],
    },
    referensi_gaya_visual: { type: Type.STRING },
    instruksi_khusus: { type: Type.STRING },
    instruksi_audio: { type: Type.STRING },
    aturan_ketat: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
    },
  },
  required: [
    'jenis_desain',
    'ukuran',
    'tujuan_penggunaan',
    'tema_desain',
    'gaya_visual',
    'warna_utama',
    'palet_warna_detail',
    'teks_desain',
    'kontak_dan_alamat',
    'bahan_visual',
    'komposisi_layout',
    'tipografi',
    'referensi_gaya_visual',
    'instruksi_khusus',
    'instruksi_audio',
    'aturan_ketat',
  ],
};

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    throw new Error(
      'GEMINI_API_KEY belum dikonfigurasi. Silakan periksa API key di panel Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function formatReadableGeminiError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  try {
    const parsed = JSON.parse(raw) as {
      error?: { code?: number; message?: string; status?: string };
    };
    const code = parsed?.error?.code;
    const status = parsed?.error?.status;
    if (code === 503 || status === 'UNAVAILABLE') {
      return 'Server AI sedang mengalami lonjakan trafik sementara (503). Silakan klik "Coba Generate Ulang" beberapa detik lagi.';
    }
    if (code === 429 || status === 'RESOURCE_EXHAUSTED') {
      return 'Kuota permintaan AI sedang penuh (429). Tunggu sebentar lalu coba lagi, atau periksa API key di Settings > Secrets.';
    }
    if (code === 403 || code === 400) {
      return (
        parsed?.error?.message ||
        'Permintaan ditolak oleh API. Periksa konfigurasi API key di Settings > Secrets.'
      );
    }
    if (parsed?.error?.message) {
      return parsed.error.message;
    }
  } catch {
    // Raw message is already plain text
  }
  if (raw.includes('503') || raw.includes('UNAVAILABLE') || raw.includes('TIMEOUT')) {
    return 'Server AI sedang sibuk sementara. Silakan klik "Coba Generate Ulang" beberapa detik lagi.';
  }
  return raw || 'Terjadi kesalahan saat membangun prompt desain.';
}

async function generateWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error('REQUEST_TIMEOUT')), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function generateWithRetryAndFallback(ai: GoogleGenAI, parts: Part[]) {
  const attempts: Array<{ model: string; thinkingLevel: ThinkingLevel; timeoutMs: number }> = [
    { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW, timeoutMs: 12000 },
    { model: 'gemini-3.1-flash-lite', thinkingLevel: ThinkingLevel.MINIMAL, timeoutMs: 20000 },
  ];

  let lastError: unknown;
  for (const attempt of attempts) {
    try {
      return await generateWithTimeout(
        ai.models.generateContent({
          model: attempt.model,
          contents: { parts },
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: RESPONSE_SCHEMA,
            thinkingConfig: { thinkingLevel: attempt.thinkingLevel },
          },
        }),
        attempt.timeoutMs
      );
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      const isTransient =
        msg.includes('503') ||
        msg.includes('UNAVAILABLE') ||
        msg.includes('429') ||
        msg.includes('RESOURCE_EXHAUSTED') ||
        msg.includes('high demand') ||
        msg.includes('REQUEST_TIMEOUT');
      if (!isTransient) {
        throw err;
      }
    }
  }
  throw lastError;
}

const loginFailuresByIp = new Map<string, { count: number; resetAt: number }>();
const MAX_LOGIN_FAILURES = 15;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginFailuresByIp.get(ip);
  if (!entry || entry.resetAt <= now) {
    return true;
  }
  return entry.count < MAX_LOGIN_FAILURES;
}

function recordLoginFailure(ip: string): void {
  const now = Date.now();
  const entry = loginFailuresByIp.get(ip);
  if (!entry || entry.resetAt <= now) {
    loginFailuresByIp.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
  } else {
    entry.count += 1;
  }
}

function clearLoginFailures(ip: string): void {
  loginFailuresByIp.delete(ip);
}

function getAuthenticatedSession(req: express.Request) {
  const token = extractBearerToken(req.headers.authorization);
  const secret = resolveSigningSecret(process.env);
  return verifySessionToken(token, secret);
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/auth/status', (req, res) => {
  const { usingDefaultCredentials } = parseConfiguredUsers(process.env);
  const session = getAuthenticatedSession(req);
  if (!session) {
    res.json({
      authenticated: false,
      user: null,
      usingDefaultCredentials,
    });
    return;
  }
  res.json({
    authenticated: true,
    user: { username: session.username, role: session.role },
    usingDefaultCredentials,
  });
});

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  if (!checkLoginRateLimit(ip)) {
    res.status(429).json({
      error: 'Terlalu banyak percobaan login gagal. Silakan tunggu 15 menit lalu coba lagi.',
    });
    return;
  }

  const body = (req.body || {}) as { username?: unknown; password?: unknown };
  const username = typeof body.username === 'string' ? body.username : '';
  const password = typeof body.password === 'string' ? body.password : '';

  const { users } = parseConfiguredUsers(process.env);
  const matched = verifyUserCredentials(username, password, users);
  if (!matched) {
    recordLoginFailure(ip);
    res.status(401).json({ error: 'Username atau password salah.' });
    return;
  }

  clearLoginFailures(ip);
  const secret = resolveSigningSecret(process.env);
  const token = signSessionToken(matched, secret);
  res.json({
    token,
    user: { username: matched.username, role: matched.role },
  });
});

app.post('/api/generate-prompt', async (req, res) => {
  const session = getAuthenticatedSession(req);
  if (!session) {
    res.status(401).json({
      error: 'Sesi login tidak valid atau telah berakhir. Silakan masuk kembali.',
    });
    return;
  }

  try {
    const form = req.body as DesignFormData;
    const validation = validateDesignForm(form);
    if (!validation.valid) {
      res.status(400).json({
        error: validation.errors[0],
        fieldErrors: validation.fieldErrors,
      });
      return;
    }

    const ai = getGeminiClient();
    const { parsedDimensions, activeContacts, instructionText } = buildServerPromptPayload(form);

    const parts: Part[] = [{ text: instructionText }];

    // Attach Logos / Main Subject images
    if (Array.isArray(form.logos)) {
      form.logos.forEach((img, idx) => {
        if (img?.base64 && img?.mimeType) {
          parts.push({
            text: `[LAMPIRAN LOGO / SUBJEK UTAMA #${idx + 1}: ${img.name}] — Gunakan objek/logo pada gambar ini sebagai subjek utama / identitas dalam desain.`,
          });
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        }
      });
    }

    // Attach Product Photos
    if (Array.isArray(form.productPhotos)) {
      form.productPhotos.forEach((img, idx) => {
        if (img?.base64 && img?.mimeType) {
          parts.push({
            text: `[LAMPIRAN FOTO PRODUK #${idx + 1}: ${img.name}] — Integrasikan produk dari foto ini ke dalam desain.`,
          });
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        }
      });
    }

    // Attach Reference Design images (max 3)
    if (Array.isArray(form.referensiDesain)) {
      form.referensiDesain.slice(0, 3).forEach((img, idx) => {
        if (img?.base64 && img?.mimeType) {
          parts.push({
            text: `[LAMPIRAN REFERENSI DESAIN #${idx + 1}: ${img.name}] — Tiru gaya visual, struktur komposisi, teknik garis/vektor, dan energi desain dari referensi ini TANPA menyalin teks atau nama brand yang tertulis pada referensi.`,
          });
          parts.push({
            inlineData: {
              mimeType: img.mimeType,
              data: img.base64,
            },
          });
        }
      });
    }

    // Attach Audio Instructions (Live Recording or File Audio)
    if (form.audio?.base64 && form.audio?.mimeType) {
      parts.push({
        text: `[LAMPIRAN AUDIO INSTRUKSI: ${form.audio.name}] — Dengarkan seluruh instruksi lisan pada audio ini, rangkum pada field instruksi_audio, dan terapkan seluruh arahan di dalamnya ke rancangan desain.`,
      });
      parts.push({
        inlineData: {
          mimeType: form.audio.mimeType,
          data: form.audio.base64,
        },
      });
    }

    const response = await generateWithRetryAndFallback(ai, parts);

    const parsed = extractCleanJson<GeneratedDesignPrompt>(response.text ?? '');

    // Post-process deterministic locks so calibrated dimensions & strict empty-field rules can NEVER drift
    parsed.ukuran = {
      lebar: parsedDimensions.lebar,
      tinggi: parsedDimensions.tinggi,
      satuan: parsedDimensions.satuan,
      rasio: parsedDimensions.rasio,
      orientasi: parsedDimensions.orientasi,
    };

    if (!form.judulUtama.trim()) parsed.teks_desain.judul_utama = null;
    if (!form.subJudul.trim()) parsed.teks_desain.sub_judul = null;
    if (!form.informasiDetail.trim()) parsed.teks_desain.informasi_detail = null;
    if (!form.slogan.trim()) parsed.teks_desain.slogan = null;

    if (activeContacts.length === 0) {
      parsed.kontak_dan_alamat = {
        tampilkan_panel_kontak: false,
        daftar_kontak: [],
        catatan_kontak:
          'Jangan menambahkan nomor WhatsApp, media sosial, alamat, website, atau informasi kontak fiktif apapun pada desain.',
      };
    }

    if (!form.instruksiTambahan.trim()) {
      parsed.instruksi_khusus = null;
    }
    if (!form.audio) {
      parsed.instruksi_audio = null;
    }
    if (form.referensiDesain.length === 0) {
      parsed.referensi_gaya_visual = null;
    }

    res.json({ prompt: parsed });
  } catch (err) {
    const message = formatReadableGeminiError(err);
    console.error('[generate-prompt error]', err);
    res.status(500).json({ error: message });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Prompt Studio Banner server listening on http://localhost:${PORT}`);
  });
}

startServer();
