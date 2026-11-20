import { useEffect, useRef, useState } from 'react';
import { Mic, Square, Trash2, Upload, Volume2 } from 'lucide-react';
import type { UploadedAudioItem } from '../types/design';
import { formatDuration, processAudioFile } from '../utils/mediaHelpers';

interface AudioInputSectionProps {
  audio: UploadedAudioItem | null;
  onChange: (audio: UploadedAudioItem | null) => void;
  onNotify?: (message: string) => void;
}

export function AudioInputSection({ audio, onChange, onNotify }: AudioInputSectionProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isRecording, setIsRecording] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  async function toggleRecording() {
    setRecordError(null);

    if (isRecording) {
      mediaRecorderRef.current?.stop();
      setIsRecording(false);
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecordError('Browser Anda tidak mendukung rekaman mikrofon. Silakan unggah File Audio.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const preferredMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : '';

      const recorder = preferredMime
        ? new MediaRecorder(stream, { mimeType: preferredMime })
        : new MediaRecorder(stream);

      chunksRef.current = [];
      setElapsedSec(0);
      const startTime = Date.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        const duration = Math.max(1, Math.round((Date.now() - startTime) / 1000));
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (blob.size === 0) return;

        try {
          const item = await processAudioFile(
            blob,
            `rekaman-instruksi-${duration}d.webm`,
            'recording',
            duration
          );
          onChange(item);
          onNotify?.('Rekaman audio berhasil disimpan dan siap diproses AI.');
        } catch {
          setRecordError('Gagal memproses hasil rekaman audio.');
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      timerRef.current = window.setInterval(() => {
        setElapsedSec((prev) => prev + 1);
      }, 1000);
    } catch {
      setRecordError(
        'Akses mikrofon ditolak atau perangkat tidak ditemukan. Anda tetap dapat mengunggah File Audio.'
      );
    }
  }

  async function handleAudioUpload(file: File) {
    setRecordError(null);
    const maxBytes = 15 * 1024 * 1024;
    if (file.size > maxBytes) {
      setRecordError('Ukuran file audio maksimal 15 MB.');
      return;
    }
    try {
      const item = await processAudioFile(file, file.name, 'file');
      onChange(item);
      onNotify?.(`File audio "${file.name}" siap dianalisis AI.`);
    } catch {
      setRecordError('Gagal membaca file audio. Gunakan MP3, WAV, M4A, OGG, atau WEBM.');
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        {/* Live Recording Card */}
        <button
          type="button"
          onClick={() => void toggleRecording()}
          aria-pressed={isRecording}
          className={`flex flex-col items-center justify-center gap-2 rounded-xl border px-4 py-6 text-center transition-colors ${
            isRecording
              ? 'border-rose-500 bg-rose-50/70 text-rose-900'
              : 'border-slate-200 bg-slate-50/60 text-slate-800 hover:border-slate-400 hover:bg-slate-50'
          }`}
        >
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full ${
              isRecording ? 'bg-rose-600 text-white' : 'bg-white text-slate-700 ring-1 ring-slate-200'
            }`}
          >
            {isRecording ? (
              <Square className="h-4 w-4 fill-current" aria-hidden="true" />
            ) : (
              <Mic className="h-5 w-5" aria-hidden="true" />
            )}
          </span>
          <span className="text-sm font-semibold">
            {isRecording ? 'Hentikan Rekaman' : 'Live Recording'}
          </span>
          <span className="text-xs text-slate-500">
            {isRecording ? (
              <span className="inline-flex items-center gap-1.5 font-mono font-medium text-rose-700 tabular-nums">
                <span className="h-2 w-2 rounded-full bg-rose-600 animate-pulse" aria-hidden="true" />
                Merekam · {formatDuration(elapsedSec)}
              </span>
            ) : (
              'Klik tombol mikrofon untuk merekam'
            )}
          </span>
        </button>

        {/* File Audio Upload Card */}
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-6 text-center text-slate-800 transition-colors hover:border-slate-400 hover:bg-slate-50"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-700 ring-1 ring-slate-200">
            <Upload className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="text-sm font-semibold">File Audio</span>
          <span className="text-xs text-slate-500">
            Pilih file audio (MP3, WAV, M4A, OGG, WEBM)
          </span>
        </button>
      </div>

      <input
        ref={fileInputRef}
        id="audio-file-input"
        type="file"
        accept="audio/*"
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) {
            void handleAudioUpload(file);
            e.target.value = '';
          }
        }}
      />

      {recordError && (
        <p role="alert" className="text-xs font-medium text-rose-600">
          {recordError}
        </p>
      )}

      {audio && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white">
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-slate-900">{audio.name}</p>
              <p className="text-xs text-slate-500">
                {audio.source === 'recording' ? 'Rekaman Mikrofon' : 'File Unggahan'}
                {audio.durationSec ? ` · ${formatDuration(audio.durationSec)}` : ''} · Akan dianalisis AI
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <audio controls src={audio.previewUrl} className="h-9 max-w-[220px]" />
            <button
              type="button"
              onClick={() => onChange(null)}
              aria-label={`Hapus audio ${audio.name}`}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition-colors hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
