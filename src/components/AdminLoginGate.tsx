import React, { useState } from 'react';
import { signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';
import { ADMIN_EMAIL, auth, db, googleProvider } from '../lib/firebase';

interface AdminLoginGateProps {
  brandName: string;
  onSuccess: (token: string) => void;
  onGoogleSuccess?: () => void;
  onCancel: () => void;
}

export const AdminLoginGate: React.FC<AdminLoginGateProps> = ({
  brandName,
  onSuccess,
  onGoogleSuccess,
  onCancel,
}) => {
  const [pinOrPassword, setPinOrPassword] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!pinOrPassword.trim()) {
      setError('Masukkan PIN atau kata sandi pengelola terlebih dahulu.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pinOrPassword }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
      };
      if (!res.ok || !data.token) {
        throw new Error(data.error || 'PIN atau kata sandi tidak valid.');
      }
      onSuccess(data.token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memverifikasi akses.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;
      let allowed = Boolean(user.emailVerified && user.email === ADMIN_EMAIL);

      if (!allowed) {
        try {
          const adminSnap = await getDoc(doc(db, 'admins', user.uid));
          allowed = adminSnap.exists();
        } catch {
          allowed = false;
        }
      }

      if (!allowed) {
        await signOut(auth).catch(() => {});
        throw new Error(
          `Akun Google (${user.email || 'tidak diketahui'}) belum terdaftar sebagai pengelola. Gunakan akun pengelola (${ADMIN_EMAIL}) atau masuk dengan kata sandi.`
        );
      }

      onGoogleSuccess?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal masuk dengan Google.';
      if (!msg.includes('popup-closed-by-user')) {
        setError(msg);
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#132A1E] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E2DFD5] shadow-2xl p-8">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#526058] hover:text-[#17231D] mb-6 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          <span>Kembali ke {brandName}</span>
        </button>

        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#1B3B2B] text-white flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#17231D] font-display">
              Akses Panel Pengelola
            </h1>
            <p className="text-xs text-[#526058]">
              Masukkan PIN/kata sandi atau login akun Google Admin untuk mengelola konten & Firebase {brandName}.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label
              htmlFor="admin-pin-input"
              className="block text-xs font-semibold text-[#526058] mb-1.5"
            >
              PIN / Kata Sandi Pengelola
            </label>
            <div className="relative">
              <KeyRound
                className="w-4 h-4 text-[#526058] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="admin-pin-input"
                type={showPin ? 'text' : 'password'}
                autoFocus
                required
                value={pinOrPassword}
                onChange={(e) => setPinOrPassword(e.target.value)}
                placeholder="Masukkan PIN atau kata sandi"
                className="w-full pl-9 pr-10 py-2.5 text-sm bg-[#F6F5F0] border border-[#E2DFD5] rounded-lg focus:outline-none focus:border-[#1B3B2B]"
              />
              <button
                type="button"
                onClick={() => setShowPin((s) => !s)}
                aria-label={showPin ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#526058] hover:text-[#17231D] cursor-pointer"
              >
                {showPin ? (
                  <EyeOff className="w-4 h-4" aria-hidden="true" />
                ) : (
                  <Eye className="w-4 h-4" aria-hidden="true" />
                )}
              </button>
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-3"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || googleLoading}
            className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            {loading ? 'Memverifikasi...' : 'Masuk ke Panel Manajemen'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-[#E2DFD5] space-y-3">
          <p className="text-[11px] font-semibold text-[#526058] text-center">
            Atau masuk langsung dengan Akun Google Admin (Sinkronisasi Cloud Firestore)
          </p>
          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading || googleLoading}
            className="w-full py-2.5 px-4 text-sm font-semibold text-[#17231D] bg-[#F6F5F0] hover:bg-[#EDEBE4] border border-[#E2DFD5] rounded-lg transition-colors flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
          >
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span>
              {googleLoading ? 'Menghubungkan Google...' : 'Masuk dengan Google Admin'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
