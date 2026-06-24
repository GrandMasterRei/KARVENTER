import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRightLeft,
  Banknote,
  Sparkles,
  TrendingUp
} from 'lucide-react';
import { Bar } from 'react-chartjs-2';
import api, { extractRows } from '../services/api';
import PageHero from '../components/PageHero';

const PERIODS = [
  { label: '7 Gün', value: 7 },
  { label: '30 Gün', value: 30 },
  { label: '90 Gün', value: 90 },
  { label: '180 Gün', value: 180 }
];

const dashboardCache = {
  operational: null,
  financial: new Map()
};
const CACHE_MS = 30_000;

function isFresh(entry) {
  return entry && Date.now() - entry.time < CACHE_MS;
}

function para(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '0';
}

function sayi(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('tr-TR') : '0';
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function durumEtiketi(status) {
  const map = {
    suggested: 'Bekliyor',
    pending: 'Bekliyor',
    approved: 'Onaylandı',
    completed: 'Tamamlandı',
    executed: 'Uygulandı',
    rejected: 'Reddedildi',
    failed: 'İşlenemedi',
    suggestion: 'Öneri'
  };
  return map[status] || status || '-';
}

function riskEtiketi(value) {
  const map = {
    critical: 'Kritik',
    high: 'Yüksek',
    medium: 'Orta',
    low: 'Düşük',
    open: 'Açık'
  };
  return map[String(value || '').toLowerCase()] || 'Açık';
}

function alertTitle(alert) {
  return alert?.title || alert?.product_name || alert?.urun_adi || 'Stok bildirimi';
}

function alertSubtitle(alert) {
  const parts = [alert?.market_name || alert?.sube_adi || alert?.branch_name, alert?.product_name || alert?.urun_adi].filter(Boolean);
  return parts.length ? parts.join(' · ') : (alert?.message || alert?.description || '');
}

function transferKaynak(transfer) {
  return transfer.source_market_name || transfer.kaynak_market_name || transfer.source_name || transfer.kaynak_sube || transfer.kaynak_depo || '-';
}

function transferHedef(transfer) {
  return transfer.target_market_name || transfer.hedef_market_name || transfer.target_name || transfer.hedef_sube || transfer.hedef_depo || '-';
}


function withTimeout(promise, timeoutMs = 12000) {
  return Promise.race([
    promise,
    new Promise((resolve) => window.setTimeout(() => resolve({ data: null, timedOut: true }), timeoutMs))
  ]);
}

async function loadFinancial(days) {
  const cached = dashboardCache.financial.get(days);
  if (isFresh(cached)) return cached.data;

  const summaryPromise = api.get(`/api/sales/summary?days=${days}`).catch(() => ({ data: null }));
  const reportPromise = withTimeout(api.get(`/api/reports/z-report?days=${days}`).catch(() => ({ data: null })), days > 30 ? 30000 : 15000);
  const [summaryResponse, reportResponse] = await Promise.all([summaryPromise, reportPromise]);
  const data = { summary: summaryResponse.data || null, report: reportResponse.data || null };
  dashboardCache.financial.set(days, { time: Date.now(), data });
  return data;
}

async function loadOperational() {
  if (isFresh(dashboardCache.operational)) return dashboardCache.operational.data;

  const [stockResponse, transferResponse, alertCountResponse, alertResponse] = await Promise.all([
    api.get('/api/stocks?status=critical&limit=8').catch(() => ({ data: { data: [] } })),
    api.get('/api/transfers?limit=8').catch(() => ({ data: { data: [] } })),
    api.get('/api/alerts/count').catch(() => ({ data: { open_count: 0 } })),
    api.get('/api/alerts?status=open&limit=5').catch(() => ({ data: { data: [] } }))
  ]);

  const alerts = extractRows(alertResponse);
  const data = {
    stocks: extractRows(stockResponse),
    transfers: extractRows(transferResponse),
    alerts,
    alertsCount: Number(alertCountResponse.data?.open_count ?? alerts.length ?? 0)
  };
  dashboardCache.operational = { time: Date.now(), data };
  return data;
}

export default function Dashboard() {
  const [periodDays, setPeriodDays] = useState(30);
  const [summary, setSummary] = useState(null);
  const [report, setReport] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [alertsCount, setAlertsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [financialLoading, setFinancialLoading] = useState(false);
  const [error, setError] = useState('');
  const initialLoadDone = useRef(false);

  const refreshFinancials = async (days = periodDays, force = false) => {
    if (force) dashboardCache.financial.delete(days);
    setFinancialLoading(true);
    const data = await loadFinancial(days);
    setSummary(data.summary);
    setReport(data.report);
    setFinancialLoading(false);
  };

  const refreshOperational = async (force = false) => {
    if (force) dashboardCache.operational = null;
    const data = await loadOperational();
    setStocks(data.stocks);
    setTransfers(data.transfers);
    setAlerts(data.alerts);
    setAlertsCount(data.alertsCount);
  };

  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        if (!initialLoadDone.current) setLoading(true);
        setError('');
        if (!initialLoadDone.current) {
          await Promise.all([refreshFinancials(periodDays), refreshOperational(false)]);
          if (active) initialLoadDone.current = true;
        } else {
          await refreshFinancials(periodDays);
        }
      } catch {
        if (active) setError('Dashboard verileri alınamadı.');
      } finally {
        if (active) setLoading(false);
      }
    };
    run();
    return () => { active = false; };
  }, [periodDays]);

  useEffect(() => {
    const handler = async () => {
      dashboardCache.operational = null;
      await Promise.all([refreshFinancials(periodDays, true), refreshOperational(true)]);
    };
    window.addEventListener('karventer:refresh', handler);
    window.addEventListener('karventer:refresh-alert-count', handler);
    return () => {
      window.removeEventListener('karventer:refresh', handler);
      window.removeEventListener('karventer:refresh-alert-count', handler);
    };
  }, [periodDays]);

  const transferSummary = useMemo(() => {
    const rows = transfers || [];
    const suggested = rows.filter((item) => ['suggested', 'pending'].includes(item.status)).length;
    const approved = rows.filter((item) => item.status === 'approved').length;
    const completed = rows.filter((item) => ['completed', 'executed'].includes(item.status)).length;
    const gain = rows.reduce((sum, item) => sum + numeric(item.estimated_profit_gain || item.kar_etkisi || item.kurtarilan_kar_tahmini), 0);
    return { suggested, approved, completed, active: suggested + approved, gain };
  }, [transfers]);

  const financials = useMemo(() => {
    const data = report?.financials || report?.finansal_ozet || {};
    const revenue = numeric(data.ciro || data.revenue || summary?.total_revenue || summary?.revenue || summary?.ciro);
    const organic = numeric(data.organik_kar || data.organic_profit || summary?.gross_profit || summary?.net_profit || summary?.brut_kar || summary?.profit);
    const gain = numeric(data.net_ai_kazanci || data.ai_katki || 0);
    const optimized = numeric(data.optimize_kar || data.ai_optimize_kar || data.optimized_profit) || (organic + gain);
    return { revenue, organic, gain, optimized };
  }, [report, summary, transferSummary.gain]);

  const riskRows = useMemo(() => {
    const rows = alerts.length ? alerts : stocks;
    return rows.slice(0, 5);
  }, [alerts, stocks]);

  const transferRows = useMemo(() => transfers.slice(0, 5), [transfers]);

  const chartData = useMemo(() => ({
    labels: ['Organik Kâr', 'AI Optimize Kâr'],
    datasets: [
      {
        data: [financials.organic, financials.optimized],
        backgroundColor: ['#334155', '#2563eb'],
        borderColor: ['#0f172a', '#1d4ed8'],
        borderWidth: 1,
        borderRadius: 14,
        maxBarThickness: 116
      }
    ]
  }), [financials.organic, financials.optimized]);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 280 },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: { label: (context) => `${context.label}: ${para(context.parsed.y)} ₺` }
      }
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: '#334155', font: { weight: 800 } } },
      y: {
        beginAtZero: true,
        grid: { color: 'rgba(148,163,184,0.18)' },
        ticks: { color: '#64748b', callback: (value) => `${para(value)} ₺` }
      }
    }
  }), []);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-[92px] animate-pulse rounded-[28px] bg-slate-950/90" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-32 animate-pulse rounded-[24px] border border-blue-100 bg-white" />)}
        </div>
        <div className="h-[320px] animate-pulse rounded-[26px] border border-blue-100 bg-white" />
      </div>
    );
  }

  if (error) return <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">{error}</div>;

  return (
    <div className="space-y-6">
      <PageHero
        title="Operasyon Özeti"
        actions={(
          <div className="flex rounded-2xl border border-white/10 bg-white/10 p-1">
            {PERIODS.map((period) => (
              <button
                key={period.value}
                onClick={() => setPeriodDays(period.value)}
                className={`h-10 rounded-xl px-4 text-sm font-black transition-all ${periodDays === period.value ? 'bg-white text-blue-700 shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}
              >
                {period.label}
              </button>
            ))}
          </div>
        )}
      />

      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-6">
        <Metric icon={<Banknote size={22} />} label="Dönem Cirosu" value={`${para(financials.revenue)} ₺`} tone="blue" />
        <Metric icon={<TrendingUp size={22} />} label="Organik Kâr" value={`${para(financials.organic)} ₺`} tone="slate" />
        <Metric icon={<Sparkles size={22} />} label="AI Katkısı" value={`${financials.gain >= 0 ? '+' : ''}${para(financials.gain)} ₺`} tone="blue" />
        <Metric icon={<TrendingUp size={22} />} label="AI Optimize Kâr" value={`${para(financials.optimized)} ₺`} tone="blue" />
        <Metric icon={<AlertCircle size={22} />} label="Anlık Stok Riski" value={sayi(riskRows.length)} tone="red" />
        <Metric icon={<ArrowRightLeft size={22} />} label="Canlı Transfer Görevi" value={sayi(transferSummary.active)} tone="slate" />
      </section>

      <section className="rounded-[26px] border border-blue-100 bg-white p-6 shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-black text-slate-950">Kâr Karşılaştırması</h2>
          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{financialLoading ? 'Güncelleniyor' : `${periodDays} Gün`}</span>
        </div>
        <div className="h-[300px] rounded-[22px] border border-slate-100 bg-slate-50/70 p-4">
          <Bar data={chartData} options={chartOptions} />
        </div>
      </section>

      <section className="overflow-hidden rounded-[26px] border border-blue-100 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.05)]">
        <div className="bg-slate-950 px-6 py-5 text-white">
          <h2 className="text-lg font-black">Operasyon Takibi</h2>
        </div>

        <div className="grid grid-cols-1 gap-0 xl:grid-cols-2">
          <div className="border-b border-slate-100 bg-white p-6 xl:border-b-0 xl:border-r">
            <h3 className="mb-4 text-base font-black text-slate-950">Anlık Stok Riskleri</h3>
            <div className="divide-y divide-slate-100">
              {riskRows.length > 0 ? riskRows.map((item, index) => (
                <div key={item.alert_id || `${item.product_id}-${item.market_id}-${index}`} className="flex items-center justify-between gap-4 bg-white px-1 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-black text-slate-900">{item.alert_id ? alertTitle(item) : item.product_name}</div>
                    <div className="truncate text-sm font-semibold text-slate-500">{item.alert_id ? alertSubtitle(item) : item.market_name}</div>
                  </div>
                  <span className="shrink-0 rounded-xl bg-red-50 px-3 py-2 text-sm font-black text-red-700">
                    {item.alert_id ? riskEtiketi(item.severity || item.status) : `${sayi(item.quantity)} adet`}
                  </span>
                </div>
              )) : <EmptyLine text="Canlı aksiyonla oluşmuş kayıt yok" />}
            </div>
          </div>

          <div className="bg-white p-6">
            <h3 className="mb-4 text-base font-black text-slate-950">Canlı Transfer Görevleri</h3>
            <div className="divide-y divide-slate-100">
              {transferRows.length > 0 ? transferRows.map((transfer) => (
                <div key={transfer.transfer_id} className="flex items-center justify-between gap-4 bg-white px-1 py-3">
                  <div className="min-w-0">
                    <div className="truncate font-black text-slate-900">{transfer.product_name || '-'}</div>
                    <div className="truncate text-sm font-semibold text-slate-500">{transferKaynak(transfer)} → {transferHedef(transfer)}</div>
                  </div>
                  <span className="shrink-0 rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{durumEtiketi(transfer.status)}</span>
                </div>
              )) : <EmptyLine text="Henüz transfer görevi yok" />}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-0 border-t border-slate-100 bg-white md:grid-cols-4">
          <Mini label="Anlık Risk" value={riskRows.length} />
          <Mini label="Bekleyen" value={transferSummary.suggested} />
          <Mini label="Onaylanan" value={transferSummary.approved} />
          <Mini label="Tamamlanan" value={transferSummary.completed} />
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, tone }) {
  const tones = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    red: 'bg-red-50 text-red-700 border-red-100',
    slate: 'bg-slate-50 text-slate-700 border-slate-100'
  };
  return (
    <div className="rounded-[24px] border border-blue-100 bg-white p-5 shadow-[0_16px_42px_rgba(15,23,42,0.045)] transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_52px_rgba(15,23,42,0.075)]">
      <div className={`mb-4 inline-flex rounded-2xl border p-3 ${tones[tone] || tones.slate}`}>{icon}</div>
      <p className="mb-2 text-xs font-black uppercase tracking-[0.14em] text-slate-400">{label}</p>
      <p className="text-[23px] font-black tracking-[-0.04em] text-slate-950">{value}</p>
    </div>
  );
}

function Mini({ label, value }) {
  return (
    <div className="border-r border-slate-100 bg-white p-5 last:border-r-0">
      <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-black text-slate-950">{sayi(value)}</div>
    </div>
  );
}

function EmptyLine({ text }) {
  return <div className="py-7 text-center text-sm font-bold text-slate-400">{text}</div>;
}
