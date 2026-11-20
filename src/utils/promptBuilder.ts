import type {
  AuditCheckItem,
  DesignFormData,
  GeneratedDesignPrompt,
  Orientation,
  ParsedDimensions,
} from '../types/design';

const ISO_PAPER_CM: Record<string, [number, number]> = {
  A0: [84.1, 118.9],
  A1: [59.4, 84.1],
  A2: [42, 59.4],
  A3: [29.7, 42],
  A4: [21, 29.7],
  A5: [14.8, 21],
  F4: [21.5, 33],
};

function formatDimNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Number(n.toFixed(1)));
}

function computeAspectRatio(width: number, height: number): string {
  if (width <= 0 || height <= 0) return '1:1';
  if (Math.abs(width - height) < 0.001) return '1:1';

  // Use clean integer ratio if both are whole numbers and have a nice GCD
  if (Number.isInteger(width) && Number.isInteger(height)) {
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const divisor = gcd(Math.round(width), Math.round(height));
    const rw = Math.round(width / divisor);
    const rh = Math.round(height / divisor);
    if (rw <= 25 && rh <= 25) {
      return `${rw}:${rh}`;
    }
  }

  if (width < height) {
    return `1:${(height / width).toFixed(2)}`;
  }
  return `${(width / height).toFixed(2)}:1`;
}

/**
 * Deterministically parses banner/print dimensions like "A3", "3x1m", "60x160cm",
 * "1080x1350px", or "2 x 1 meter" while enforcing the chosen orientation.
 */
export function parseBannerDimensions(
  sizeInput: string,
  orientation: Orientation
): ParsedDimensions {
  const raw = sizeInput.trim();
  const upper = raw.toUpperCase();

  // 1. ISO paper sizes (A0-A5, F4)
  for (const [code, [shortSide, longSide]] of Object.entries(ISO_PAPER_CM)) {
    const isoRegex = new RegExp(`\\b${code}\\b`, 'i');
    if (isoRegex.test(upper)) {
      let w = longSide;
      let h = shortSide;
      if (orientation === 'Portrait') {
        w = shortSide;
        h = longSide;
      } else if (orientation === 'Square') {
        w = shortSide;
        h = shortSide;
      }
      return {
        lebar: formatDimNumber(w),
        tinggi: formatDimNumber(h),
        satuan: `cm (${code})`,
        rasio: computeAspectRatio(w, h),
        orientasi: orientation,
        rawInput: raw,
      };
    }
  }

  // 2. Explicit WxH numeric dimensions with optional unit (m, cm, mm, px)
  const dimMatch = raw.match(
    /(\d+(?:[.,]\d+)?)\s*(?:m|cm|mm|px)?\s*[x×*]\s*(\d+(?:[.,]\d+)?)\s*(meter|m|cm|mm|px)?/i
  );
  if (dimMatch) {
    let first = parseFloat(dimMatch[1].replace(',', '.'));
    let second = parseFloat(dimMatch[2].replace(',', '.'));
    const unitRaw = (dimMatch[3] || '').toLowerCase();

    let satuan = 'cm';
    if (unitRaw === 'm' || unitRaw === 'meter') {
      satuan = 'm';
    } else if (unitRaw === 'px') {
      satuan = 'px';
    } else if (unitRaw === 'mm') {
      satuan = 'mm';
    } else if (unitRaw === 'cm') {
      satuan = 'cm';
    } else if (first >= 300 || second >= 300) {
      satuan = 'px';
    } else if (first <= 15 && second <= 15) {
      satuan = 'm';
    }

    // Enforce requested orientation when dimensions contradict it
    if (orientation === 'Portrait' && first > second) {
      [first, second] = [second, first];
    } else if (orientation === 'Landscape' && second > first) {
      [first, second] = [second, first];
    }

    return {
      lebar: formatDimNumber(first),
      tinggi: formatDimNumber(second),
      satuan,
      rasio: computeAspectRatio(first, second),
      orientasi: orientation,
      rawInput: raw,
    };
  }

  // 3. Fallback defaults by orientation if size was left blank or freeform
  if (orientation === 'Portrait') {
    return {
      lebar: '29.7',
      tinggi: '42',
      satuan: raw ? raw : 'cm (Portrait)',
      rasio: '1:1.41',
      orientasi: orientation,
      rawInput: raw,
    };
  }
  if (orientation === 'Square') {
    return {
      lebar: '1080',
      tinggi: '1080',
      satuan: raw ? raw : 'px (Square)',
      rasio: '1:1',
      orientasi: orientation,
      rawInput: raw,
    };
  }
  return {
    lebar: '3',
    tinggi: '1',
    satuan: raw ? raw : 'm (Spanduk)',
    rasio: '3:1',
    orientasi: orientation,
    rawInput: raw,
  };
}

/**
 * Parses comma / ampersand / "dan" separated color descriptions into clean Title Case tokens.
 */
export function parseColorList(input: string): string[] {
  if (!input.trim()) return [];
  const rawParts = input
    .split(/,|&|\bdan\b|\band\b|\/|;/gi)
    .map((part) => part.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const part of rawParts) {
    const cleaned = part.replace(/\s+/g, ' ');
    const key = cleaned.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      // Capitalize first letter of each word (keep Indonesian color readability)
      const titled = cleaned
        .split(' ')
        .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ');
      normalized.push(titled);
    }
  }
  return normalized;
}

export function resolveEffectiveTheme(form: DesignFormData): string {
  if (form.temaDesain === 'custom') {
    return form.temaDesainCustom.trim();
  }
  return form.temaDesain.trim();
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  fieldErrors: Record<string, string>;
}

/**
 * Validates that the user has provided meaningful instructions before generating
 * and enforces constraints like max 3 design references and non-empty custom theme.
 */
export function validateDesignForm(form: DesignFormData): ValidationResult {
  const errors: string[] = [];
  const fieldErrors: Record<string, string> = {};

  const hasAnyContent =
    form.judulUtama.trim().length > 0 ||
    form.subJudul.trim().length > 0 ||
    form.informasiDetail.trim().length > 0 ||
    form.slogan.trim().length > 0 ||
    form.daftarNamaProduk.trim().length > 0 ||
    form.elemenPendukung.trim().length > 0 ||
    form.instruksiTambahan.trim().length > 0 ||
    form.logos.length > 0 ||
    form.productPhotos.length > 0 ||
    form.referensiDesain.length > 0 ||
    form.audio !== null;

  if (!hasAnyContent) {
    const msg =
      'Isi minimal satu data utama (Judul Utama, Deskripsi, Produk, Instruksi Tambahan, Bahan Visual, atau Audio) sebelum membangun prompt.';
    errors.push(msg);
    fieldErrors.judulUtama = 'Masukkan minimal Judul Utama atau instruksi desain Anda.';
  }

  if (form.temaDesain === 'custom' && !form.temaDesainCustom.trim()) {
    const msg = 'Anda memilih "Custom (Tulis Sendiri)" — harap tuliskan tema desain custom.';
    errors.push(msg);
    fieldErrors.temaDesainCustom = 'Tulis nama tema desain custom Anda.';
  }

  if (form.referensiDesain.length > 3) {
    const msg = 'Maksimal 3 file Referensi Desain yang diperbolehkan.';
    errors.push(msg);
    fieldErrors.referensiDesain = msg;
  }

  return {
    valid: errors.length === 0,
    errors,
    fieldErrors,
  };
}

/**
 * Extracts active (non-empty) contact channels in a deterministic order.
 */
export function getActiveContacts(form: DesignFormData): Array<{ platform: string; value: string }> {
  const entries: Array<{ platform: string; value: string }> = [
    { platform: 'WhatsApp', value: form.whatsapp.trim() },
    { platform: 'Instagram', value: form.instagram.trim() },
    { platform: 'YouTube', value: form.youtube.trim() },
    { platform: 'TikTok', value: form.tiktok.trim() },
    { platform: 'Facebook', value: form.facebook.trim() },
    { platform: 'Alamat', value: form.alamat.trim() },
    { platform: 'Kontak Lain', value: form.kontakLain.trim() },
  ];
  return entries.filter((entry) => entry.value.length > 0);
}

/**
 * Builds the detailed, unambiguous specification text sent to Gemini along with any
 * multimodal image/audio parts so every single field's function is strictly obeyed.
 */
export function buildServerPromptPayload(form: DesignFormData): {
  parsedDimensions: ParsedDimensions;
  parsedColors: string[];
  activeContacts: Array<{ platform: string; value: string }>;
  effectiveTheme: string;
  instructionText: string;
} {
  const parsedDimensions = parseBannerDimensions(form.ukuranBanner, form.orientasi);
  const parsedColors = parseColorList(form.warnaDominan);
  const activeContacts = getActiveContacts(form);
  const effectiveTheme = resolveEffectiveTheme(form);

  const lines: string[] = [
    '=== KONFIGURASI FORMULIR DESAIN (WAJIB DIIKUTI 100% PRESISI) ===',
    '',
    '--- 1. DATA INFORMASI (TEKS) ---',
    `- Judul Utama: ${form.judulUtama.trim() || '[KOSONG — JANGAN MENGARANG JUDUL BARU, SET null]'}`,
    `- Sub-Judul: ${form.subJudul.trim() || '[KOSONG — SET null, JANGAN MENGARANG]'}`,
    `- Informasi Detail / Deskripsi: ${form.informasiDetail.trim() || '[KOSONG — SET null, JANGAN MENGARANG]'}`,
    `- Slogan: ${form.slogan.trim() || '[KOSONG — SET null, JANGAN MENGARANG]'}`,
    '',
    '--- 2. PANEL KONTAK & ALAMAT ---',
  ];

  if (activeContacts.length === 0) {
    lines.push(
      '- STATUS: SEMUA KOLOM KONTAK KOSONG. Wajib set tampilkan_panel_kontak = false, daftar_kontak = [], dan larang generator gambar menambahkan nomor HP/media sosial/alamat fiktif.'
    );
  } else {
    lines.push(
      '- STATUS: TAMPILKAN HANYA KONTAK BERIKUT SECARA VERBATIM (tampilkan_panel_kontak = true):'
    );
    for (const c of activeContacts) {
      lines.push(`  * ${c.platform}: "${c.value}"`);
    }
  }

  lines.push(
    '',
    '--- 3. BAHAN VISUAL ---',
    `- Upload Logo / Subjek Utama: ${
      form.logos.length > 0
        ? `${form.logos.length} gambar dilampirkan (${form.logos.map((l, i) => `LOGO #${i + 1}: ${l.name}`).join(', ')}). ANALISIS visual setiap gambar lampiran tersebut secara akurat dan jelaskan cara mengintegrasikannya sebagai logo/subjek utama desain.`
        : '[TIDAK ADA FILE LOGO DIUPLOAD — set array kosong []]'
    }`,
    `- Foto Produk: ${
      form.productPhotos.length > 0
        ? `${form.productPhotos.length} foto produk dilampirkan (${form.productPhotos.map((p, i) => `PRODUK #${i + 1}: ${p.name}`).join(', ')}). ANALISIS setiap foto produk dan arahkan penempatan, pencahayaan, dan integrasinya.`
        : '[TIDAK ADA FOTO PRODUK DIUPLOAD — set array kosong []]'
    }`,
    `- Daftar Nama Produk (Jika foto tidak ada/kurang): ${
      form.daftarNamaProduk.trim()
        ? `"${form.daftarNamaProduk.trim()}" -> WAJIB jabarkan deskripsi visual detail untuk setiap produk yang tertulis di sini pada deskripsi_visual_produk_dari_teks.`
        : '[KOSONG — set array kosong []]'
    }`,
    `- Elemen Pendukung Lain: ${
      form.elemenPendukung.trim()
        ? `"${form.elemenPendukung.trim()}" -> WAJIB masukkan semua elemen ini ke elemen_pendukung dan integrasikan ke komposisi_layout.`
        : '[KOSONG — boleh tambahkan elemen minimal yang relevan dengan tema/referensi atau kosongkan jika instruksi meminta minimalis]'
    }`,
    '',
    '--- 4. SPESIFIKASI & REFERENSI ---',
    `- Orientasi: ${parsedDimensions.orientasi}`,
    `- Ukuran Input User: ${form.ukuranBanner.trim() || '[Default sesuai orientasi]'}`,
    `- Ukuran Terkalibrasi (WAJIB DIGUNAKAN PERSIS DI FIELD ukuran): lebar="${parsedDimensions.lebar}", tinggi="${parsedDimensions.tinggi}", satuan="${parsedDimensions.satuan}", rasio="${parsedDimensions.rasio}", orientasi="${parsedDimensions.orientasi}"`,
    `- Warna Dominan: ${
      parsedColors.length > 0
        ? `[${parsedColors.map((c) => `"${c}"`).join(', ')}] -> WAJIB tampilkan semua warna ini persis pada warna_utama dan terapkan pembagian perannya pada palet_warna_detail.`
        : '[TIDAK DITENTUKAN USER — rekomendasikan palet harmonis sesuai tema/referensi]'
    }`,
    `- Tema Desain: ${effectiveTheme || '[TIDAK DITENTUKAN USER — sesuaikan dengan judul, referensi visual, dan instruksi tambahan]'}`,
    `- Referensi Desain: ${
      form.referensiDesain.length > 0
        ? `${form.referensiDesain.length} gambar referensi dilampirkan (${form.referensiDesain.map((r, i) => `REFERENSI #${i + 1}: ${r.name}`).join(', ')}). ANALISIS gaya komposisi, tipografi, ketebalan garis, warna, dan mood dari referensi tersebut, lalu tuangkan ke referensi_gaya_visual dan komposisi_layout. PENTING: JANGAN menyalin teks/nama brand yang ada di dalam gambar referensi!`
        : '[TIDAK ADA REFERENSI DESAIN DIUPLOAD — set referensi_gaya_visual = null]'
    }`,
    '',
    '--- 5. PROMPT PENDUKUNG & PERINTAH KHUSUS (PRIORITAS TERTINGGI) ---',
    `- Instruksi Tambahan: ${
      form.instruksiTambahan.trim()
        ? `"${form.instruksiTambahan.trim()}" -> PRIORITAS TERTINGGI! Jika perintah ini mengubah jenis media (misal: artwork kaos, stiker, poster, spanduk) atau warna latar belakang (misal: background hitam solid), WAJIB terapkan pada jenis_desain, palet_warna_detail.latar_belakang, gaya_visual, komposisi_layout, dan instruksi_khusus.`
        : '[KOSONG — set instruksi_khusus = null]'
    }`,
    '',
    '--- 6. INSTRUKSI & DATA VIA AUDIO ---',
    `- Audio Terlampir: ${
      form.audio
        ? `YA (${form.audio.source === 'recording' ? 'Rekaman Suara Live' : `File Audio: ${form.audio.name}`}). DENGARKAN audio yang dilampirkan secara seksama, rangkum semua arahan lisan ke instruksi_audio, dan TERAPKAN seluruh arahan lisan tersebut ke teks, warna, gaya, dan komposisi desain.`
        : '[TIDAK ADA AUDIO — set instruksi_audio = null]'
    }`
  );

  return {
    parsedDimensions,
    parsedColors,
    activeContacts,
    effectiveTheme,
    instructionText: lines.join('\n'),
  };
}

/**
 * Safely parses JSON returned by the model, stripping optional markdown fences
 * and throwing a clear error if invalid.
 */
export function extractCleanJson<T = GeneratedDesignPrompt>(rawText: string): T {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('Respons AI kosong. Silakan coba generate ulang.');
  }

  let candidate = trimmed;
  const fenceMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) {
    candidate = fenceMatch[1].trim();
  }

  try {
    return JSON.parse(candidate) as T;
  } catch {
    // Attempt to isolate outermost JSON object if stray characters exist
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start !== -1 && end > start) {
      const sliced = candidate.slice(start, end + 1);
      return JSON.parse(sliced) as T;
    }
    throw new Error('Format JSON dari AI tidak valid. Silakan klik Coba Lagi.');
  }
}

/**
 * Audits the generated JSON prompt against every filled field of the user's form
 * so the user can visually verify that every instruction was strictly obeyed.
 */
export function buildPromptAudit(
  form: DesignFormData,
  output: GeneratedDesignPrompt
): AuditCheckItem[] {
  const checks: AuditCheckItem[] = [];
  const fullJsonLower = JSON.stringify(output).toLowerCase();

  // 1. Teks Utama
  if (form.judulUtama.trim()) {
    const expected = form.judulUtama.trim();
    const ok = (output.teks_desain?.judul_utama || '').toLowerCase().includes(expected.toLowerCase());
    checks.push({
      id: 'judulUtama',
      section: '1. Teks',
      label: 'Judul Utama',
      passed: ok,
      detail: ok ? `"${expected}" tersimpan presisi` : `Judul "${expected}" tidak cocok`,
    });
  }

  if (form.subJudul.trim()) {
    const expected = form.subJudul.trim();
    const ok = (output.teks_desain?.sub_judul || '').toLowerCase().includes(expected.toLowerCase());
    checks.push({
      id: 'subJudul',
      section: '1. Teks',
      label: 'Sub-Judul',
      passed: ok,
      detail: ok ? `"${expected}" tersimpan presisi` : `Sub-judul "${expected}" tidak ditemukan`,
    });
  }

  if (form.informasiDetail.trim()) {
    const expected = form.informasiDetail.trim();
    const ok = Boolean(output.teks_desain?.informasi_detail?.trim());
    checks.push({
      id: 'informasiDetail',
      section: '1. Teks',
      label: 'Deskripsi Detail',
      passed: ok,
      detail: ok
        ? `Informasi detail dimuat (${expected.slice(0, 32)}${expected.length > 32 ? '…' : ''})`
        : 'Informasi detail belum tercantum',
    });
  }

  if (form.slogan.trim()) {
    const expected = form.slogan.trim();
    const ok = (output.teks_desain?.slogan || '').toLowerCase().includes(expected.toLowerCase());
    checks.push({
      id: 'slogan',
      section: '1. Teks',
      label: 'Slogan',
      passed: ok,
      detail: ok ? `"${expected}" tersimpan presisi` : `Slogan "${expected}" tidak cocok`,
    });
  }

  // 2. Kontak & Alamat
  const activeContacts = getActiveContacts(form);
  if (activeContacts.length > 0) {
    const allMatched = activeContacts.every((c) => fullJsonLower.includes(c.value.toLowerCase()));
    checks.push({
      id: 'kontak',
      section: '2. Kontak',
      label: `${activeContacts.length} Kontak Aktif`,
      passed: allMatched && output.kontak_dan_alamat?.tampilkan_panel_kontak === true,
      detail: allMatched
        ? `${activeContacts.map((c) => c.platform).join(', ')} tercantum verbatim`
        : 'Sebagian data kontak belum sesuai',
    });
  } else {
    const noHallucinatedContact =
      output.kontak_dan_alamat?.tampilkan_panel_kontak === false &&
      (output.kontak_dan_alamat?.daftar_kontak?.length ?? 0) === 0;
    checks.push({
      id: 'kontakEmpty',
      section: '2. Kontak',
      label: 'Kontak Kosong (Anti-Halusinasi)',
      passed: noHallucinatedContact,
      detail: noHallucinatedContact
        ? 'Tidak ada kontak fiktif ditambahkan'
        : 'Terdeteksi kontak yang tidak diminta',
    });
  }

  // 3. Bahan Visual
  if (form.logos.length > 0) {
    const ok = (output.bahan_visual?.logo_dan_subjek_utama?.length ?? 0) > 0;
    checks.push({
      id: 'logos',
      section: '3. Visual',
      label: `Upload Logo (${form.logos.length})`,
      passed: ok,
      detail: ok
        ? `${form.logos.length} gambar dianalisis & diarahkan`
        : 'Arahan logo belum masuk',
    });
  }

  if (form.productPhotos.length > 0) {
    const ok = (output.bahan_visual?.foto_produk?.length ?? 0) > 0;
    checks.push({
      id: 'productPhotos',
      section: '3. Visual',
      label: `Foto Produk (${form.productPhotos.length})`,
      passed: ok,
      detail: ok ? `${form.productPhotos.length} foto produk diarahkan` : 'Arahan foto produk belum masuk',
    });
  }

  if (form.daftarNamaProduk.trim()) {
    const ok = (output.bahan_visual?.deskripsi_visual_produk_dari_teks?.length ?? 0) > 0;
    checks.push({
      id: 'daftarNamaProduk',
      section: '3. Visual',
      label: 'Daftar Nama Produk',
      passed: ok,
      detail: ok ? 'Produk diterjemahkan ke deskripsi visual' : 'Daftar produk belum diterjemahkan',
    });
  }

  if (form.elemenPendukung.trim()) {
    const ok = (output.bahan_visual?.elemen_pendukung?.length ?? 0) > 0;
    checks.push({
      id: 'elemenPendukung',
      section: '3. Visual',
      label: 'Elemen Pendukung',
      passed: ok,
      detail: ok ? 'Elemen pendukung terintegrasi' : 'Elemen pendukung belum masuk',
    });
  }

  // 4. Spesifikasi & Referensi
  const dims = parseBannerDimensions(form.ukuranBanner, form.orientasi);
  const dimOk =
    (output.ukuran?.orientasi || '').toLowerCase() === dims.orientasi.toLowerCase() &&
    output.ukuran?.lebar === dims.lebar &&
    output.ukuran?.tinggi === dims.tinggi;
  checks.push({
    id: 'spesifikasiUkuran',
    section: '4. Spesifikasi',
    label: 'Orientasi & Ukuran',
    passed: dimOk,
    detail: `${output.ukuran?.orientasi || dims.orientasi} · ${output.ukuran?.lebar}×${output.ukuran?.tinggi} ${output.ukuran?.satuan}`,
  });

  const colors = parseColorList(form.warnaDominan);
  if (colors.length > 0) {
    const outColors = (output.warna_utama || []).map((c) => c.toLowerCase());
    const matchedCount = colors.filter((c) =>
      outColors.some((oc) => oc.includes(c.toLowerCase()) || c.toLowerCase().includes(oc))
    ).length;
    checks.push({
      id: 'warnaDominan',
      section: '4. Spesifikasi',
      label: `Warna Dominan (${colors.length})`,
      passed: matchedCount === colors.length,
      detail: `${matchedCount}/${colors.length} warna sesuai perintah`,
    });
  }

  const effectiveTheme = resolveEffectiveTheme(form);
  if (effectiveTheme) {
    const themeOk =
      (output.tema_desain || '').toLowerCase().includes(effectiveTheme.toLowerCase()) ||
      (output.gaya_visual || '').toLowerCase().includes(effectiveTheme.toLowerCase());
    checks.push({
      id: 'temaDesain',
      section: '4. Spesifikasi',
      label: 'Tema Desain',
      passed: themeOk,
      detail: themeOk ? `Tema "${effectiveTheme}" diterapkan` : `Tema "${effectiveTheme}" kurang eksplisit`,
    });
  }

  if (form.referensiDesain.length > 0) {
    const ok = Boolean(output.referensi_gaya_visual?.trim());
    checks.push({
      id: 'referensiDesain',
      section: '4. Spesifikasi',
      label: `Referensi Desain (${form.referensiDesain.length})`,
      passed: ok,
      detail: ok ? 'Gaya & komposisi referensi dianalisis' : 'Analisis referensi belum masuk',
    });
  }

  // 5. Instruksi Tambahan
  if (form.instruksiTambahan.trim()) {
    const ok = Boolean(output.instruksi_khusus?.trim());
    checks.push({
      id: 'instruksiTambahan',
      section: '5. Perintah Khusus',
      label: 'Instruksi Tambahan',
      passed: ok,
      detail: ok ? 'Perintah khusus menjadi prioritas' : 'Instruksi tambahan belum tercatat',
    });
  }

  // 6. Audio
  if (form.audio) {
    const ok = Boolean(output.instruksi_audio?.trim());
    checks.push({
      id: 'audio',
      section: '6. Audio',
      label: 'Instruksi Audio',
      passed: ok,
      detail: ok ? 'Arahan audio diekstrak & diterapkan' : 'Arahan audio belum terdeteksi',
    });
  }

  return checks;
}

export const DEMO_PRESET_KOMUNITAS: Omit<
  DesignFormData,
  'logos' | 'productPhotos' | 'referensiDesain' | 'audio'
> = {
  judulUtama: 'KOMUNITAS BEAT KONOHA',
  subJudul: '',
  informasiDetail: '',
  slogan: 'SATU ASPAL BERJUTA PAJAK',
  whatsapp: '',
  instagram: '',
  youtube: '',
  tiktok: '',
  facebook: '',
  alamat: '',
  kontakLain: '',
  daftarNamaProduk: '',
  elemenPendukung: 'Piston mesin, percikan cat dinamis, garis petir racing',
  orientasi: 'Portrait',
  ukuranBanner: 'A3',
  warnaDominan: 'hitam, biru, pink, kuning, putih, abu',
  temaDesain: 'custom',
  temaDesainCustom: 'vector',
  instruksiTambahan:
    'artwork kaos jadikan background hitam solid untuk kebutuhan sablon pecah warna',
};

export const DEMO_PRESET_KULINER: Omit<
  DesignFormData,
  'logos' | 'productPhotos' | 'referensiDesain' | 'audio'
> = {
  judulUtama: 'WARUNG SATE MADURA CAK AGUN',
  subJudul: 'Bumbu Kacang Legendaris — Buka Setiap Hari',
  informasiDetail: 'Tersedia paket hemat keluarga, menerima pesanan katering & nasi kotak mulai Rp25.000',
  slogan: 'Sekali Coba Pasti Kembali Lagi',
  whatsapp: '0812-3456-7890',
  instagram: '@satemadura.cakagun',
  youtube: '',
  tiktok: '@cakagun.kuliner',
  facebook: '',
  alamat: 'Jl. Anggrek No. 12, Surabaya',
  kontakLain: 'Tersedia di GoFood & GrabFood',
  daftarNamaProduk: 'Sate Ayam Madura, Sate Kambing Muda, Gule Kambing Hangat, Es Teh Manis Jumbo',
  elemenPendukung: 'Ornamen batik parang halus, efek bara api panggangan, pita harga promo',
  orientasi: 'Landscape',
  ukuranBanner: '3x1m',
  warnaDominan: 'merah marun, kuning emas, hitam, putih',
  temaDesain: 'Ceria & Kuliner',
  temaDesainCustom: '',
  instruksiTambahan:
    'Buat tampilan menggugah selera dengan pencahayaan warm food photography dan teks sangat mudah dibaca dari jarak jauh di pinggir jalan',
};
