// frontend/src/pages/Login.jsx

import React, { useMemo, useState } from 'react';
import { AlertCircle, Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import api from '../services/api';

function KLogo({ size = 'h-14 w-14' }) {
  return (
    <div className={`${size} mx-auto flex items-center justify-center rounded-2xl bg-blue-700 text-white shadow-[0_16px_34px_rgba(37,99,235,0.34)]`}>
      <span className="text-3xl font-black tracking-[-0.08em]">K</span>
    </div>
  );
}

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const showDemoBadge = useMemo(() => {
    const value = String(import.meta.env.VITE_APP_ENV || import.meta.env.VITE_DEMO_MODE || '').toLowerCase();
    return value === 'demo' || value === 'true' || value === 'local';
  }, []);

  const handleLogin = async (event) => {
    event.preventDefault();

    try {
      setLoading(true);
      setError('');

      const params = new URLSearchParams();
      params.append('username', username.trim());
      params.append('password', password);

      const response = await api.post('/api/auth/giris', params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });

      localStorage.setItem('karventer_token', response.data.access_token);
      localStorage.setItem('karventer_user', JSON.stringify(response.data.user));
      onLogin(response.data.user);
    } catch {
      setError('Kullanıcı adı veya şifre hatalı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#1d4ed8] text-slate-950">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(96,165,250,0.55)_0,rgba(37,99,235,0.98)_41%,rgba(29,78,216,1)_68%,rgba(30,64,175,1)_100%)]" />
      <div className="pointer-events-none absolute -left-40 top-[-220px] h-[660px] w-[660px] rounded-full bg-white/18 blur-3xl" />
      <div className="pointer-events-none absolute right-[-260px] bottom-[-260px] h-[760px] w-[760px] rounded-full bg-[#1e3a8a]/34 blur-3xl" />
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/13 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(135deg,rgba(255,255,255,0.10)_0%,rgba(255,255,255,0)_34%,rgba(15,23,42,0.14)_100%)]" />

      {showDemoBadge && (
        <div className="absolute right-8 top-7 z-10 inline-flex h-9 items-center rounded-full border border-white/30 bg-white/16 px-4 text-xs font-black tracking-wide text-white shadow-sm backdrop-blur">
          Demo Ortamı
        </div>
      )}

      <section className="relative z-10 flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-[455px] rounded-[30px] border border-white/85 bg-white p-9 shadow-[0_36px_110px_rgba(15,23,42,0.34)] md:p-10">
          <div className="mb-9 text-center">
            <KLogo />
            <h1 className="mt-4 text-[34px] font-black tracking-[-0.05em] text-[#1e40af] md:text-[38px]">
              KARVENTER
            </h1>
          </div>

          {error && (
            <div className="mb-5 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              <AlertCircle size={19} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">Kullanıcı adı</label>
              <div className="relative">
                <User className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  required
                  autoComplete="username"
                  className="h-[55px] w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-[15px] font-semibold text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Kullanıcı adınızı girin"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-slate-700">Şifre</label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  className="h-[55px] w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-12 text-[15px] font-semibold text-slate-900 shadow-[0_1px_0_rgba(15,23,42,0.03)] outline-none transition-all placeholder:text-slate-400 focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                  placeholder="Şifrenizi girin"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition-colors hover:text-slate-700"
                  aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex h-[55px] w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#2563eb] to-[#1d4ed8] px-5 py-3.5 text-[15px] font-black text-white shadow-[0_16px_32px_rgba(37,99,235,0.30)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(37,99,235,0.38)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && <Loader2 className="animate-spin" size={20} />}
              {loading ? 'Bağlanıyor' : 'Giriş Yap'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
