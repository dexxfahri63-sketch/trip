import React, { useState } from 'react';
import { ArrowLeft, Eye, EyeOff, KeyRound, Lock } from 'lucide-react';

interface AdminLoginGateProps {
  brandName: string;
  onSuccess: (token: string) => void;
  onCancel: () => void;
}

export const AdminLoginGate: React.FC<AdminLoginGateProps> = ({
  brandName,
  onSuccess,
  onCancel,
}) => {
  const [pinOrPassword, setPinOrPassword] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [loading, setLoading] = useState(false);
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
              Masukkan PIN atau kata sandi untuk mengelola konten {brandName}.
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
            disabled={loading}
            className="w-full py-3 px-4 text-sm font-semibold text-white bg-[#C85A32] hover:bg-[#B44B25] disabled:opacity-60 rounded-lg transition-colors cursor-pointer"
          >
            {loading ? 'Memverifikasi...' : 'Masuk ke Panel Manajemen'}
          </button>
        </form>
      </div>
    </div>
  );
};
