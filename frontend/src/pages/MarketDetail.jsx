// frontend/src/pages/MarketDetail.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRightLeft,
  CheckCircle2,
  Loader2,
  Package,
  PackageCheck,
  Search,
  ShieldAlert,
  ShieldCheck,
  Store,
  XCircle
} from 'lucide-react';
import api, { cachedGet, extractRows } from '../services/api';

function sayi(v) { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('tr-TR') : '0'; }
function para(v) { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('tr-TR') : '0'; }
function tarih(v) { if (!v) return '-'; try { return new Date(v).toLocaleDateString('tr-TR'); } catch { return v; } }
function stockClass(s) { if (s === 'Kritik') return 'bg-red-50 text-red-700 border-red-100'; if (s === 'Fazla Stok') return 'bg-amber-50 text-amber-700 border-amber-100'; return 'bg-green-50 text-green-700 border-green-100'; }
function stockLabel(s) { return s === 'Kritik' ? 'Stok Eksiği' : s || 'Bilinmiyor'; }
function transferLabel(s) { return { suggested: 'Bekliyor', approved: 'Onaylandı', completed: 'Tamamlandı', rejected: 'Reddedildi', cancelled: 'İptal' }[s] || s; }
function transferClass(s) { if (s === 'suggested') return 'bg-amber-50 text-amber-700 border-amber-100'; if (s === 'approved') return 'bg-blue-50 text-blue-700 border-blue-100'; if (s === 'completed') return 'bg-green-50 text-green-700 border-green-100'; if (s === 'rejected') return 'bg-red-50 text-red-700 border-red-100'; return 'bg-slate-100 text-slate-600 border-slate-200'; }
function batchLabel(s) { return { active: 'Aktif', near_expiry: 'SKT Yaklaşıyor', expired: 'SKT Geçmiş', depleted: 'Tükendi' }[s] || s; }

export default function MarketDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [market, setMarket] = useState(null);
  const [stocks, setStocks] = useState([]);
  const [expiryRisks, setExpiryRisks] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeTab, setActiveTab] = useState('stocks');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [transferFilter, setTransferFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async (force = false) => {
    try {
      setLoading(true); setError('');
      const [marketResponse, stockResponse, riskResponse, transferResponse, alertResponse] = await Promise.all([
        cachedGet('/api/markets?include_depots=true', { maxAgeMs: 60000, force }),
        api.get(`/api/stocks?market_id=${id}&include_depots=true`),
        api.get(`/api/stock-batches/expiry-risks?days=14&market_id=${id}`).catch(() => ({ data: { data: [] } })),
        api.get(`/api/transfers?market_id=${id}`).catch(() => ({ data: { data: [] } })),
        api.get(`/api/alerts?market_id=${id}`).catch(() => ({ data: { data: [] } }))
      ]);
      const list = extractRows(marketResponse);
      const current = list.find((item) => String(item.market_id) === String(id));
      if (!current) { setError('İstenen şube bulunamadı.'); setMarket(null); return; }
      setMarket(current);
      setStocks(Array.isArray(stockResponse.data?.data) ? stockResponse.data.data : []);
      setExpiryRisks(Array.isArray(riskResponse.data?.data) ? riskResponse.data.data : []);
      setTransfers(Array.isArray(transferResponse.data?.data) ? transferResponse.data.data : []);
      setAlerts(Array.isArray(alertResponse.data?.data) ? alertResponse.data.data : []);
    } catch { setError('Şube detayları alınamadı.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, [id]);
  useEffect(() => { const handler = () => loadData(true); window.addEventListener('karventer:refresh', handler); return () => window.removeEventListener('karventer:refresh', handler); }, [id]);

  const categories = useMemo(() => [...new Set(stocks.map((s) => s.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [stocks]);
  const filteredStocks = useMemo(() => stocks.filter((s) => { const text = `${s.product_name || ''} ${s.category || ''}`.toLocaleLowerCase('tr-TR'); if (search && !text.includes(search.toLocaleLowerCase('tr-TR'))) return false; if (categoryFilter && s.category !== categoryFilter) return false; if (statusFilter && s.status !== statusFilter) return false; return true; }), [stocks, search, categoryFilter, statusFilter]);
  const filteredRisks = useMemo(() => expiryRisks.filter((r) => `${r.product_name || ''} ${r.lot_code || ''}`.toLocaleLowerCase('tr-TR').includes(search.toLocaleLowerCase('tr-TR'))), [expiryRisks, search]);
  const filteredTransfers = useMemo(() => transfers.filter((t) => { const text = `${t.product_name || ''} ${t.source_market_name || ''} ${t.target_market_name || ''}`.toLocaleLowerCase('tr-TR'); if (search && !text.includes(search.toLocaleLowerCase('tr-TR'))) return false; if (transferFilter && t.status !== transferFilter) return false; return true; }), [transfers, search, transferFilter]);

  const summary = useMemo(() => ({ critical: stocks.filter((s) => s.status === 'Kritik').length, overstock: stocks.filter((s) => s.status === 'Fazla Stok').length, total: stocks.reduce((sum, s) => sum + Number(s.quantity || 0), 0), risk: expiryRisks.reduce((sum, r) => sum + Number(r.remaining_quantity || 0), 0), records: stocks.length, gain: transfers.reduce((sum, t) => sum + Number(t.estimated_profit_gain || 0), 0) }), [stocks, expiryRisks, transfers]);
  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 2500); };

  const decide = async (transferId, status) => { try { setActionLoading(`${status}-${transferId}`); setError(''); await api.patch(`/api/transfers/${transferId}/decision`, { status, reason: status === 'rejected' ? 'Şube ekranından reddedildi' : null }); showSuccess(status === 'approved' ? 'Transfer onaylandı.' : 'Transfer reddedildi.'); await loadData(); } catch (err) { setError(err.response?.data?.detail || 'Transfer kararı güncellenemedi.'); } finally { setActionLoading(null); } };
  const complete = async (transferId) => { try { setActionLoading(`complete-${transferId}`); setError(''); await api.patch(`/api/transfers/${transferId}/complete`); showSuccess('Transfer tamamlandı.'); await loadData(); } catch (err) { setError(err.response?.data?.detail || 'Transfer tamamlanamadı.'); } finally { setActionLoading(null); } };

  if (loading) return <div className="rounded-[28px] border border-slate-200 bg-white p-8 flex items-center gap-4 text-slate-600 shadow-sm"><Loader2 className="animate-spin text-blue-600" size={32} /><div><h3 className="font-black">Şube verileri yükleniyor</h3><p className="text-sm text-slate-500">Stok, transfer ve uyarı kayıtları alınıyor.</p></div></div>;
  if (error || !market) return <div className="space-y-6"><button onClick={() => navigate('/markets')} className="h-11 px-4 rounded-xl bg-white border border-slate-200 flex items-center gap-2 text-slate-600 hover:text-blue-600 font-black"><ArrowLeft size={18} />Lokasyonlara Dön</button><div className="p-8 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4 text-red-700"><AlertCircle size={28} /><div><h3 className="font-black text-lg">Lokasyon detayı açılamadı</h3><p className="text-sm mt-1">{error || 'Lokasyon bulunamadı.'}</p></div></div></div>;

  const tabs = [{ key: 'stocks', label: 'Stok' }, { key: 'expiry', label: 'SKT' }, { key: 'transfers', label: 'Transfer' }, { key: 'alerts', label: 'Uyarılar' }];

  return (
    <div className="space-y-7">
      <section className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-gradient-to-br from-white via-blue-50/80 to-slate-100 p-6 shadow-[0_18px_50px_rgba(37,99,235,0.08)]">
        <div className="absolute -right-12 -top-16 h-52 w-52 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute -bottom-20 left-28 h-52 w-52 rounded-full bg-indigo-400/10 blur-3xl" />
        <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <button onClick={() => navigate('/markets')} className="h-11 w-fit rounded-xl border border-blue-100 bg-white/80 px-4 text-sm font-black text-slate-600 transition hover:bg-white hover:text-blue-700 flex items-center gap-2"><ArrowLeft size={18} />Lokasyonlara Dön</button>
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-blue-600 p-4 text-white shadow-lg shadow-blue-200"><Store size={28} /></div>
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Şube detayı</p>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">{market.name}</h1>
                <p className="mt-1 text-sm font-semibold text-slate-500">{market.city || 'Lokasyon belirtilmemiş'}</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 xl:min-w-[620px]">
            <HeroMetric label="Stok kaydı" value={sayi(summary.records)} />
            <HeroMetric label="Toplam stok" value={sayi(summary.total)} tone="blue" />
            <HeroMetric label="Stok eksiği" value={sayi(summary.critical)} tone="red" />
            <HeroMetric label="SKT riski" value={sayi(summary.risk)} tone="amber" />
          </div>
        </div>
      </section>

      {success && <Notice text={success} />}{error && <Notice error text={error} />}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric icon={<Package size={24} />} label="Stok Kaydı" value={summary.records} />
        <Metric icon={<ShieldCheck size={24} />} label="Toplam Stok" value={sayi(summary.total)} green />
        <Metric icon={<AlertCircle size={24} />} label="Stok Eksiği" value={summary.critical} danger />
        <Metric icon={<ShieldAlert size={24} />} label="SKT Riski" value={sayi(summary.risk)} amber />
        <Metric icon={<ArrowRightLeft size={24} />} label="Transfer Kazancı" value={`+${para(summary.gain)} ₺`} blue />
      </section>

      <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_16px_45px_rgba(15,23,42,0.05)]">
        <div className="border-b border-slate-100 bg-gradient-to-r from-white to-blue-50/50 p-5 space-y-4">
          <div className="flex flex-wrap gap-2">{tabs.map((tab) => <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`h-10 rounded-xl px-4 text-sm font-black transition-all ${activeTab === tab.key ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-blue-50 hover:text-blue-700 hover:ring-blue-100'}`}>{tab.label}</button>)}</div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4"><div className="relative xl:col-span-2"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ürün, kategori veya transfer ara" className="h-11 w-full rounded-xl border border-slate-200 pl-10 pr-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100" /></div>{activeTab === 'stocks' && <><select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"><option value="">Tüm Kategoriler</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"><option value="">Tüm Durumlar</option><option value="Kritik">Stok Eksiği</option><option value="Normal">Normal</option><option value="Fazla Stok">Fazla Stok</option></select></>}{activeTab === 'transfers' && <select value={transferFilter} onChange={(e) => setTransferFilter(e.target.value)} className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"><option value="">Tüm Transferler</option><option value="suggested">Bekleyen</option><option value="approved">Onaylanan</option><option value="completed">Tamamlanan</option><option value="rejected">Reddedilen</option></select>}</div>
        </div>
        {activeTab === 'stocks' && <StockTable rows={filteredStocks} />}
        {activeTab === 'expiry' && <ExpiryList rows={filteredRisks} />}
        {activeTab === 'transfers' && <TransferList rows={filteredTransfers} actionLoading={actionLoading} onApprove={decide} onComplete={complete} onReject={decide} />}
        {activeTab === 'alerts' && <AlertList rows={alerts} />}
      </section>
    </div>
  );
}

function Notice({ error, text }) { return <div className={`rounded-2xl border p-4 font-bold ${error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>{text}</div>; }
function HeroMetric({ label, value, tone }) { const cls = tone === 'blue' ? 'bg-blue-50 text-blue-700 border-blue-100' : tone === 'red' ? 'bg-red-50 text-red-700 border-red-100' : tone === 'amber' ? 'bg-amber-50 text-amber-700 border-amber-100' : 'bg-white/80 text-slate-800 border-slate-100'; return <div className={`rounded-2xl border p-4 ${cls}`}><p className="text-[11px] font-black uppercase tracking-wider opacity-70">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function Metric({ icon, label, value, danger, amber, green, blue }) { const cls = danger ? 'bg-red-50 text-red-600' : amber ? 'bg-amber-50 text-amber-600' : green ? 'bg-green-50 text-green-600' : blue ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'; return <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg"><div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${cls}`}>{icon}</div><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p></div>; }
function StockTable({ rows }) { return <div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead className="border-b border-slate-100 bg-slate-50"><tr><th className="p-5 text-xs font-black uppercase text-slate-400">Ürün</th><th className="p-5 text-xs font-black uppercase text-slate-400">Kategori</th><th className="p-5 text-xs font-black uppercase text-slate-400">Miktar</th><th className="p-5 text-xs font-black uppercase text-slate-400">Minimum</th><th className="p-5 text-xs font-black uppercase text-slate-400">Durum</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((s, i) => <tr key={`${s.stock_id || i}`} className="transition hover:bg-blue-50/40"><td className="p-5 font-black text-slate-900">{s.product_name}</td><td className="p-5 font-semibold text-slate-600">{s.category}</td><td className="p-5 text-lg font-black text-slate-900">{sayi(s.quantity)}</td><td className="p-5 font-bold text-slate-600">{sayi(s.min_stock_level)}</td><td className="p-5"><span className={`px-3 py-1.5 rounded-full text-xs font-black border ${stockClass(s.status)}`}>{stockLabel(s.status)}</span></td></tr>)}{rows.length === 0 && <tr><td colSpan="5" className="p-10 text-center font-semibold text-slate-500">Kayıt bulunamadı.</td></tr>}</tbody></table></div>; }
function ExpiryList({ rows }) { return <div className="divide-y divide-slate-100">{rows.map((b) => <div key={b.batch_id} className="p-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between hover:bg-amber-50/20 transition"><div><h3 className="font-black text-slate-900">{b.product_name}</h3><p className="text-sm font-semibold text-slate-500">{b.lot_code}</p></div><div className="flex flex-wrap gap-3"><span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{sayi(b.remaining_quantity)} adet</span><span className="rounded-xl bg-amber-50 px-3 py-2 text-sm font-black text-amber-700">{tarih(b.expiry_date)}</span><span className="rounded-xl bg-blue-50 px-3 py-2 text-sm font-black text-blue-700">{batchLabel(b.status)}</span></div></div>)}{rows.length === 0 && <div className="p-10 text-center font-semibold text-slate-500">SKT riski bulunmuyor.</div>}</div>; }
function TransferList({ rows, actionLoading, onApprove, onReject, onComplete }) { return <div className="divide-y divide-slate-100">{rows.map((t) => <div key={t.transfer_id} className="p-5 flex flex-col gap-4 transition hover:bg-blue-50/30 xl:flex-row xl:items-center xl:justify-between"><div><div className="mb-2 flex flex-wrap items-center gap-3"><h3 className="font-black text-slate-900">{t.product_name}</h3><span className={`px-3 py-1 rounded-full text-xs font-black border ${transferClass(t.status)}`}>{transferLabel(t.status)}</span></div><p className="text-sm font-semibold text-slate-500">{t.source_market_name} → {t.target_market_name}</p></div><div className="flex flex-wrap gap-2"><span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-700">{sayi(t.quantity)} adet</span><span className="rounded-xl bg-green-50 px-3 py-2 text-sm font-black text-green-700">+{para(t.estimated_profit_gain)} ₺</span>{t.status === 'suggested' && <><button onClick={() => onApprove(t.transfer_id, 'approved')} className="flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-black text-white transition hover:bg-blue-700">{actionLoading === `approved-${t.transfer_id}` ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}Onayla</button><button onClick={() => onReject(t.transfer_id, 'rejected')} className="flex h-10 items-center gap-2 rounded-xl border border-red-200 px-4 text-sm font-black text-red-600 transition hover:bg-red-50"><XCircle size={16} />Reddet</button></>}{t.status === 'approved' && <button onClick={() => onComplete(t.transfer_id)} className="flex h-10 items-center gap-2 rounded-xl bg-green-600 px-4 text-sm font-black text-white transition hover:bg-green-700"><PackageCheck size={16} />Tamamla</button>}</div></div>)}{rows.length === 0 && <div className="p-10 text-center font-semibold text-slate-500">Transfer kaydı bulunmuyor.</div>}</div>; }
function AlertList({ rows }) { return <div className="divide-y divide-slate-100">{rows.map((a) => <div key={a.alert_id} className="p-5 transition hover:bg-red-50/20"><h3 className="font-black text-slate-900">{a.title}</h3><p className="mt-1 text-sm font-semibold text-slate-500">{a.message}</p></div>)}{rows.length === 0 && <div className="p-10 text-center font-semibold text-slate-500">Açık uyarı bulunmuyor.</div>}</div>; }
