import test from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBannerDimensions,
  parseColorList,
  validateDesignForm,
  buildServerPromptPayload,
  extractCleanJson,
  buildPromptAudit,
  DEMO_PRESET_KOMUNITAS,
  DEMO_PRESET_KULINER,
} from './promptBuilder';
import { INITIAL_FORM_DATA, type DesignFormData, type GeneratedDesignPrompt } from '../types/design';

function makeForm(overrides: Partial<DesignFormData> = {}): DesignFormData {
  return {
    ...INITIAL_FORM_DATA,
    ...overrides,
  };
}

test('parseBannerDimensions parses A3 Portrait matching the video reference', () => {
  const result = parseBannerDimensions('A3', 'Portrait');
  assert.equal(result.lebar, '29.7');
  assert.equal(result.tinggi, '42');
  assert.equal(result.satuan, 'cm (A3)');
  assert.equal(result.rasio, '1:1.41');
  assert.equal(result.orientasi, 'Portrait');
});

test('parseBannerDimensions swaps A3 for Landscape orientation', () => {
  const result = parseBannerDimensions('a3', 'Landscape');
  assert.equal(result.lebar, '42');
  assert.equal(result.tinggi, '29.7');
  assert.equal(result.orientasi, 'Landscape');
});

test('parseBannerDimensions parses 3x1m banner correctly', () => {
  const result = parseBannerDimensions('3x1m', 'Landscape');
  assert.equal(result.lebar, '3');
  assert.equal(result.tinggi, '1');
  assert.equal(result.satuan, 'm');
  assert.equal(result.rasio, '3:1');
});

test('parseBannerDimensions enforces Portrait orientation when given 1920x1080px', () => {
  const result = parseBannerDimensions('1920x1080px', 'Portrait');
  assert.equal(result.lebar, '1080');
  assert.equal(result.tinggi, '1920');
  assert.equal(result.satuan, 'px');
  assert.equal(result.rasio, '9:16');
});

test('parseColorList normalizes comma and conjunction separated colors without duplicates', () => {
  const colors = parseColorList('hitam, biru, pink, kuning, putih, abu, Hitam');
  assert.deepEqual(colors, ['Hitam', 'Biru', 'Pink', 'Kuning', 'Putih', 'Abu']);

  const paired = parseColorList('Biru Navy & Kuning Emas dan Putih');
  assert.deepEqual(paired, ['Biru Navy', 'Kuning Emas', 'Putih']);
});

test('validateDesignForm rejects completely empty form and missing custom theme', () => {
  const emptyRes = validateDesignForm(makeForm());
  assert.equal(emptyRes.valid, false);
  assert.ok(emptyRes.errors.length > 0);

  const customMissing = validateDesignForm(
    makeForm({ judulUtama: 'KOMUNITAS BEAT KONOHA', temaDesain: 'custom', temaDesainCustom: '   ' })
  );
  assert.equal(customMissing.valid, false);
  assert.ok(customMissing.fieldErrors.temaDesainCustom);

  const validForm = validateDesignForm(
    makeForm({
      ...DEMO_PRESET_KOMUNITAS,
    })
  );
  assert.equal(validForm.valid, true);
});

test('buildServerPromptPayload enforces anti-hallucination for empty contacts and preserves filled fields', () => {
  const payload = buildServerPromptPayload(makeForm(DEMO_PRESET_KOMUNITAS));
  assert.equal(payload.activeContacts.length, 0);
  assert.equal(payload.effectiveTheme, 'vector');
  assert.equal(payload.parsedDimensions.lebar, '29.7');
  assert.match(payload.instructionText, /KOMUNITAS BEAT KONOHA/);
  assert.match(payload.instructionText, /SATU ASPAL BERJUTA PAJAK/);
  assert.match(payload.instructionText, /SEMUA KOLOM KONTAK KOSONG/);
  assert.match(payload.instructionText, /artwork kaos jadikan background hitam/i);

  const kulinerPayload = buildServerPromptPayload(makeForm(DEMO_PRESET_KULINER));
  assert.equal(kulinerPayload.activeContacts.length, 5);
  assert.match(kulinerPayload.instructionText, /0812-3456-7890/);
  assert.match(kulinerPayload.instructionText, /Sate Ayam Madura/);
});

test('extractCleanJson parses raw and markdown-fenced JSON reliably', () => {
  const raw = '{"jenis_desain":"Artwork Kaos"}';
  assert.deepEqual(extractCleanJson(raw), { jenis_desain: 'Artwork Kaos' });

  const fenced = '```json\n{\n  "jenis_desain": "Banner Promo"\n}\n```';
  assert.deepEqual(extractCleanJson(fenced), { jenis_desain: 'Banner Promo' });
});

test('buildPromptAudit verifies 100% field alignment and catches missing/hallucinated fields', () => {
  const form = makeForm(DEMO_PRESET_KOMUNITAS);
  const output: GeneratedDesignPrompt = {
    jenis_desain: 'Artwork Kaos Komunitas Motor',
    ukuran: {
      lebar: '29.7',
      tinggi: '42',
      satuan: 'cm (A3)',
      rasio: '1:1.41',
      orientasi: 'Portrait',
    },
    tujuan_penggunaan: 'Artwork sablon kaos komunitas motor',
    tema_desain: 'Vector Street Automotive',
    gaya_visual: 'High-contrast vector art untuk sablon pecah warna',
    warna_utama: ['Hitam', 'Biru', 'Pink', 'Kuning', 'Putih', 'Abu-abu'],
    palet_warna_detail: {
      latar_belakang: 'Hitam pekat solid (#000000)',
      warna_dominan: 'Biru elektrik dan hitam',
      warna_aksen: 'Kuning, pink magenta, putih, abu-abu metalik',
      aturan_warna: 'Gunakan blok warna solid tanpa gradasi halus',
    },
    teks_desain: {
      judul_utama: 'KOMUNITAS BEAT KONOHA',
      sub_judul: null,
      informasi_detail: null,
      slogan: 'SATU ASPAL BERJUTA PAJAK',
    },
    kontak_dan_alamat: {
      tampilkan_panel_kontak: false,
      daftar_kontak: [],
      catatan_kontak: 'Jangan menampilkan kontak apapun',
    },
    bahan_visual: {
      logo_dan_subjek_utama: [],
      foto_produk: [],
      deskripsi_visual_produk_dari_teks: [],
      elemen_pendukung: ['Piston mesin', 'Percikan cat dinamis', 'Garis petir racing'],
    },
    komposisi_layout: {
      struktur_atas: 'Judul utama KOMUNITAS BEAT KONOHA melengkung tegas',
      fokus_tengah: 'Ilustrasi vektor motor dengan piston di belakangnya',
      struktur_bawah: 'Ribbon slogan SATU ASPAL BERJUTA PAJAK',
      keseimbangan_visual: 'Simetris sentral cocok untuk area cetak dada/punggung kaos',
    },
    tipografi: {
      gaya_judul: 'Display racing bold miring dengan outline tebal',
      gaya_teks_pendukung: 'Sans-serif condensed tegas dalam pita',
      efek_teks: 'Hard shadow solid tanpa blur',
    },
    referensi_gaya_visual: null,
    instruksi_khusus: 'Artwork kaos dengan background hitam solid untuk sablon pecah warna',
    instruksi_audio: null,
    aturan_ketat: ['Tulis seluruh teks sesuai ejaan persis'],
  };

  const checks = buildPromptAudit(form, output);
  assert.ok(checks.length >= 6);
  for (const check of checks) {
    assert.equal(check.passed, true, `Expected check "${check.label}" to pass, got: ${check.detail}`);
  }
});
