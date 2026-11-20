export type Orientation = 'Landscape' | 'Portrait' | 'Square';

export interface UploadedImageItem {
  id: string;
  name: string;
  mimeType: string;
  /** Base64 payload without data URL prefix */
  base64: string;
  /** Data URL for local thumbnail rendering */
  previewUrl: string;
  sizeBytes: number;
}

export interface UploadedAudioItem {
  name: string;
  mimeType: string;
  /** Base64 payload without data URL prefix */
  base64: string;
  /** Object or Data URL for local <audio> playback */
  previewUrl: string;
  source: 'recording' | 'file';
  durationSec?: number;
}

export interface DesignFormData {
  // 1. Data Informasi (Teks)
  judulUtama: string;
  subJudul: string;
  informasiDetail: string;
  slogan: string;

  // 2. Panel Kontak & Alamat
  whatsapp: string;
  instagram: string;
  youtube: string;
  tiktok: string;
  facebook: string;
  alamat: string;
  kontakLain: string;

  // 3. Bahan Visual
  logos: UploadedImageItem[];
  productPhotos: UploadedImageItem[];
  daftarNamaProduk: string;
  elemenPendukung: string;

  // 4. Spesifikasi & Referensi
  orientasi: Orientation;
  ukuranBanner: string;
  warnaDominan: string;
  temaDesain: string;
  temaDesainCustom: string;
  referensiDesain: UploadedImageItem[];

  // 5. Prompt Pendukung & Perintah Khusus
  instruksiTambahan: string;

  // 6. Instruksi & Data via Audio
  audio: UploadedAudioItem | null;
}

export interface ParsedDimensions {
  lebar: string;
  tinggi: string;
  satuan: string;
  rasio: string;
  orientasi: Orientation;
  rawInput: string;
}

export interface ContactEntry {
  platform: string;
  nilai: string;
  penempatan: string;
}

export interface GeneratedDesignPrompt {
  jenis_desain: string;
  ukuran: {
    lebar: string;
    tinggi: string;
    satuan: string;
    rasio: string;
    orientasi: string;
  };
  tujuan_penggunaan: string;
  tema_desain: string;
  gaya_visual: string;
  warna_utama: string[];
  palet_warna_detail: {
    latar_belakang: string;
    warna_dominan: string;
    warna_aksen: string;
    aturan_warna: string;
  };
  teks_desain: {
    judul_utama: string | null;
    sub_judul: string | null;
    informasi_detail: string | null;
    slogan: string | null;
  };
  kontak_dan_alamat: {
    tampilkan_panel_kontak: boolean;
    daftar_kontak: ContactEntry[];
    catatan_kontak: string;
  };
  bahan_visual: {
    logo_dan_subjek_utama: string[];
    foto_produk: string[];
    deskripsi_visual_produk_dari_teks: string[];
    elemen_pendukung: string[];
  };
  komposisi_layout: {
    struktur_atas: string;
    fokus_tengah: string;
    struktur_bawah: string;
    keseimbangan_visual: string;
  };
  tipografi: {
    gaya_judul: string;
    gaya_teks_pendukung: string;
    efek_teks: string;
  };
  referensi_gaya_visual: string | null;
  instruksi_khusus: string | null;
  instruksi_audio: string | null;
  aturan_ketat: string[];
}

export interface AuditCheckItem {
  id: string;
  section: string;
  label: string;
  passed: boolean;
  detail: string;
}

export interface PromptHistoryEntry {
  id: string;
  createdAt: string;
  title: string;
  summary: string;
  formSnapshot: Omit<DesignFormData, 'logos' | 'productPhotos' | 'referensiDesain' | 'audio'> & {
    logoCount: number;
    productPhotoCount: number;
    referenceCount: number;
    hasAudio: boolean;
  };
  output: GeneratedDesignPrompt;
}

export const THEME_OPTIONS = [
  { value: '', label: 'Pilih Tema (Opsional)' },
  { value: 'Modern & Minimalis', label: 'Modern & Minimalis' },
  { value: 'Bold & Streetwear', label: 'Bold & Streetwear' },
  { value: 'Vector & Ilustrasi Sablon', label: 'Vector & Ilustrasi Sablon' },
  { value: 'Elegan & Mewah', label: 'Elegan & Mewah' },
  { value: 'Ceria & Kuliner', label: 'Ceria & Kuliner' },
  { value: 'Corporate & Profesional', label: 'Corporate & Profesional' },
  { value: 'Retro & Vintage 90-an', label: 'Retro & Vintage 90-an' },
  { value: 'Futuristik & Otomotif', label: 'Futuristik & Otomotif' },
  { value: 'Islami & Religi', label: 'Islami & Religi' },
  { value: 'custom', label: 'Custom (Tulis Sendiri)' },
] as const;

export const INITIAL_FORM_DATA: DesignFormData = {
  judulUtama: '',
  subJudul: '',
  informasiDetail: '',
  slogan: '',
  whatsapp: '',
  instagram: '',
  youtube: '',
  tiktok: '',
  facebook: '',
  alamat: '',
  kontakLain: '',
  logos: [],
  productPhotos: [],
  daftarNamaProduk: '',
  elemenPendukung: '',
  orientasi: 'Landscape',
  ukuranBanner: '',
  warnaDominan: '',
  temaDesain: '',
  temaDesainCustom: '',
  referensiDesain: [],
  instruksiTambahan: '',
  audio: null,
};
