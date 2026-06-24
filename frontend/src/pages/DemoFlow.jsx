import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Bot,
  CheckCircle2,
  Database,
  Loader2,
  RefreshCcw,
  ShoppingCart,
  UploadCloud
} from 'lucide-react';
import api, { apiErrorMessage } from '../services/api';

const CHECKS = [
  { key: 'health', title: 'Backend', icon: Database },
  { key: 'alerts', title: 'Açık Uyarı', icon: AlertTriangle },
  { key: 'transfers', title: 'Transfer', icon: ArrowRightLeft },
  { key: 'assistant', title: 'AI Asistan', icon: Bot },
  { key: 'events', title: 'İşlem Kaydı', icon: Activity }
];

const DEMO_STEPS = [
  { title: 'Dashboard', path: '/', detail: 'Zincir genel göstergeleri.' },
  { title: 'Canlı Takip', path: '/live', detail: 'Satış işleme ve stok değişimi.' },
  { title: 'Uyarılar', path: '/live', detail: 'Stok/SKT risk akışı.' },
  { title: 'AI Asistan', path: '/assistant', detail: 'Onaylı işlem taslakları.' },
  { title: 'Transferler', path: '/transfers', detail: 'Görev onay ve tamamlama.' },
  { title: 'İşlem Geçmişi', path: '/operations', detail: 'Audit log ve stok hareketleri.' },
  { title: 'Veri Aktarımı', path: '/data-import', detail: 'CSV ön izleme ve aktarım.' },
  { title: 'PostgreSQL', path: '/operations', detail: 'Adminer üzerinden tablo gösterimi.' }
];

function numberText(value) {
  return Number(value || 0).toLocaleString('tr-TR');
}

export default function DemoFlow() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [health, setHealth] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [eventsSummary, setEventsSummary] = useState(null);
  const [assistantStatus, setAssistantStatus] = useState(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [healthResponse, metricsResponse, eventsResponse, assistantResponse] = await Promise.allSettled([
        api.get('/api/system/health'),
        api.get('/api/system/metrics'),
        api.get('/api/events/summary'),
        api.get('/api/assistant/status')
      ]);

      if (healthResponse.status === 'fulfilled') setHealth(healthResponse.value.data || null);
      if (metricsResponse.status === 'fulfilled') setMetrics(metricsResponse.value.data || null);
      if (eventsResponse.status === 'fulfilled') setEventsSummary(eventsResponse.value.data || null);
      if (assistantResponse.status === 'fulfilled') setAssistantStatus(assistantResponse.value.data || null);

      const failed = [healthResponse, metricsResponse, eventsResponse, assistantResponse].filter((item) => item.status === 'rejected');
      if (failed.length === 4) throw failed[0].reason;
    } catch (err) {
      setError(apiErrorMessage(err, 'Final kontrol verileri alınamadı.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const checkValues = useMemo(() => ({
    health: health?.status || health?.database || 'Bekliyor',
    alerts: numberText(metrics?.open_alerts ?? eventsSummary?.open_alerts),
    transfers: `${numberText(metrics?.pending_transfers)} bekleyen`,
    assistant: assistantStatus?.gateway?.online ? 'Ollama bağlı' : 'Gateway bekliyor',
    events: numberText(eventsSummary?.total)
  }), [health, metrics, eventsSummary, assistantStatus]);

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-[28px] border border-blue-100 bg-white shadow-sm">
        <div className="relative bg-gradient-to-br from-blue-700 via-blue-600 to-blue-500 px-6 py-6 text-white md:px-7">
          <div className="absolute inset-0 opacity-20 [background:radial-gradient(circle_at_14%_22%,white,transparent_26%),radial-gradient(circle_at_86%_6%,white,transparent_24%)]" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.22em] text-blue-100">Final Kontrol</p>
              <h1 className="mt-2 text-2xl font-black tracking-tight">Demo Akışı</h1>
            </div>
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex h-11 w-fit items-center gap-2 rounded-2xl bg-white px-4 text-sm font-black text-blue-700 shadow-sm transition hover:bg-blue-50 disabled:opacity-60"
            >
              {loading ? <Loader2 size={17} className="animate-spin" /> : <RefreshCcw size={17} />}
              Yenile
            </button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm font-black text-amber-700">
          {error}
        </div>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {CHECKS.map((item) => {
          const Icon = item.icon;
          return (
            <div key={item.key} className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl border border-blue-100 bg-blue-50 text-blue-700">
                <Icon size={21} />
              </div>
              <div className="text-xs font-black uppercase tracking-wider text-slate-400">{item.title}</div>
              <div className="mt-2 text-xl font-black text-slate-950">{checkValues[item.key]}</div>
            </div>
          );
        })}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-5">
            <h3 className="font-black text-slate-950">Gösterim Sırası</h3>
          </div>
          <div className="divide-y divide-slate-100">
            {DEMO_STEPS.map((step, index) => (
              <div key={step.title} className="flex items-center justify-between gap-4 p-5 transition hover:bg-blue-50/30">
                <div className="flex items-start gap-4">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-sm font-black text-blue-700">
                    {index + 1}
                  </div>
                  <div>
                    <div className="font-black text-slate-950">{step.title}</div>
                    <div className="mt-1 text-sm font-semibold leading-relaxed text-slate-500">{step.detail}</div>
                  </div>
                </div>
                <Link to={step.path} className="shrink-0 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
                  Aç
                </Link>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-black text-slate-950">Kontrol Noktaları</h3>
            <div className="mt-4 space-y-3 text-sm font-semibold text-slate-600">
              <CheckItem text="Satış stoğu düşürür." />
              <CheckItem text="Transfer stok hareketi oluşturur." />
              <CheckItem text="AI önerisi admin onayı bekler." />
              <CheckItem text="CSV aktarımı satış akışına bağlanır." />
              <CheckItem text="PostgreSQL tabloları gösterilebilir." />
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-black text-slate-950">Kısa Yollar</h3>
            <div className="mt-4 grid grid-cols-1 gap-2">
              <Shortcut to="/live" icon={ShoppingCart} label="Canlı Takip" />
              <Shortcut to="/assistant" icon={Bot} label="AI Asistan" />
              <Shortcut to="/data-import" icon={UploadCloud} label="Veri Aktarımı" />
              <Shortcut to="/operations" icon={Activity} label="İşlem Geçmişi" />
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}

function CheckItem({ text }) {
  return (
    <div className="flex gap-3">
      <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-600" size={17} />
      <span>{text}</span>
    </div>
  );
}

function Shortcut({ to, label }) {
  return (
    <Link to={to} className="flex h-11 items-center gap-2 rounded-2xl border border-slate-200 px-4 text-sm font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700">
      {label}
    </Link>
  );
}
