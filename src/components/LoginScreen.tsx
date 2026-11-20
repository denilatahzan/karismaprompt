import { useState } from 'react';
import { Eye, EyeOff, Layers, Loader2, Lock, User } from 'lucide-react';

interface LoginScreenProps {
  usingDefaultCredentials: boolean;
  onLoginSuccess: (payload: {
    token: string;
    username: string;
    role: 'admin' | 'member';
    remember: boolean;
  }) => void;
}

export function LoginScreen({ usingDefaultCredentials, onLoginSuccess }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedUser = username.trim();
    if (!trimmedUser || !password) {
      setErrorMessage('Masukkan username dan password Anda.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: trimmedUser,
          password,
        }),
      });

      const data = (await response.json()) as {
        token?: string;
        user?: { username: string; role: 'admin' | 'member' };
        error?: string;
      };

      if (!response.ok || !data.token || !data.user) {
        throw new Error(data.error || 'Username atau password salah.');
      }

      onLoginSuccess({
        token: data.token,
        username: data.user.username,
        role: data.user.role,
        remember,
      });
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Gagal masuk ke server. Silakan coba lagi.'
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F8FAFC] px-4 py-10 text-slate-900">
      <main className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center">
          <span className="mb-3.5 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Layers className="h-6 w-6 text-rose-400" aria-hidden="true" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Prompt Studio Banner
          </h1>
          <p className="mt-1.5 text-sm text-slate-600">
            Masuk dengan akun Anda untuk membuka konfigurator desain dari PC maupun HP.
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-7">
          <form onSubmit={(e) => void handleSubmit(e)} noValidate className="space-y-4">
            {errorMessage && (
              <div
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800"
              >
                {errorMessage}
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="login-username" className="block text-xs font-semibold text-slate-700">
                Username
              </label>
              <div className="relative">
                <User
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="login-username"
                  type="text"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Masukkan username"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Masukkan password"
                  className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-11 text-sm text-slate-900 placeholder:text-slate-400 transition-colors focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan password' : 'Tampilkan password'}
                  className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:text-slate-700"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                  ) : (
                    <Eye className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-0.5">
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 accent-slate-900"
                />
                <span>Tetap masuk di perangkat ini</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  <span>Memeriksa akun...</span>
                </>
              ) : (
                <span>Masuk</span>
              )}
            </button>
          </form>

          {usingDefaultCredentials && (
            <div className="mt-5 border-t border-slate-100 pt-4 text-xs leading-relaxed text-slate-500">
              <p className="font-semibold text-slate-700">Akun bawaan aktif</p>
              <p className="mt-1">
                Username: <span className="font-mono font-medium text-slate-900">admin</span>
                {' · '}
                Password: <span className="font-mono font-medium text-slate-900">studio123</span>
              </p>
              <p className="mt-1.5 text-[11px] text-slate-500">
                Untuk mengganti akun pribadi, atur <span className="font-mono">APP_USERNAME</span> &amp;{' '}
                <span className="font-mono">APP_PASSWORD</span> (atau{' '}
                <span className="font-mono">APP_USERS</span> untuk banyak akun) di panel{' '}
                <span className="font-medium text-slate-700">Settings &gt; Secrets</span>.
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
