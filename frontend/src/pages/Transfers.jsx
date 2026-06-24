// frontend/src/pages/Transfers.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  Loader2,
  PackageCheck,
  Search,
  RotateCcw,
  ShieldAlert,
  Store,
  XCircle
} from 'lucide-react';
import api, { apiErrorMessage, extractRows } from '../services/api';
import PageHero from '../components/PageHero';

const TABS = [
  { key: 'all', label: 'Tümü' },
  { key: 'suggested', label: 'Bekleyen' },
  { key: 'approved', label: 'Onaylanan' },
  { key: 'completed', label: 'Tamamlanan' },
  { key: 'rejected', label: 'Reddedilen' }
];
const STATUS_LABELS = { suggested: 'Bekliyor', approved: 'Onaylandı', completed: 'Tamamlandı', rejected: 'Reddedildi', cancelled: 'İptal' };
function statusClass(status) { if (status === 'suggested') return 'bg-amber-50 text-amber-700 border-amber-100'; if (status === 'approved') return 'bg-blue-50 text-blue-700 border-blue-100'; if (status === 'completed') return 'bg-green-50 text-green-700 border-green-100'; if (status === 'rejected') return 'bg-red-50 text-red-700 border-red-100'; return 'bg-slate-100 text-slate-600 border-slate-200'; }
function sayiFormatla(v) { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('tr-TR') : '0'; }
function paraFormatla(v) { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('tr-TR') : '0'; }
function getCurrentUserId() {
  try {
    const raw = localStorage.getItem('karventer_user');
    const user = raw ? JSON.parse(raw) : null;
    return user?.kullanici_id || user?.user_id || user?.id || null;
  } catch { return null; }
}

export default function Transfers() {
  const location = useLocation();
  const [tab, setTab] = useState('all');
  const [transfers, setTransfers] = useState([]);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get('search') || '');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [products, setProducts] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ product_id: '', source_market_id: '', target_market_id: '', quantity: '', ai_explanation: 'Web admin manuel transfer' });

  const loadTransfers = async () => {
    try {
      setLoading(true);
      setError('');
      const userId = getCurrentUserId();
      const params = new URLSearchParams();
      if (tab !== 'all') params.set('status', tab);
      if (userId) params.set('user_id', userId);
      const query = params.toString() ? `?${params.toString()}` : '';
      const response = await api.get(`/api/transfers${query}`);
      setTransfers(extractRows(response));
    } catch {
      setError('Transfer kayıtları alınamadı.');
    } finally { setLoading(false); }
  };

  useEffect(() => { loadTransfers(); }, [tab]);
  useEffect(() => {
    async function loadMeta() {
      try {
        const [productsResp, marketsResp] = await Promise.all([
          api.get('/api/products'),
          api.get('/api/markets?include_depots=true')
        ]);
        setProducts(extractRows(productsResp));
        setMarkets(extractRows(marketsResp));
      } catch (_) {
        // Transfer listesi ana işlev; metadata hatasını sessiz geçiyoruz.
      }
    }
    loadMeta();
  }, []);
  useEffect(() => { setSearch(new URLSearchParams(location.search).get('search') || ''); }, [location.search]);
  useEffect(() => { const handler = () => loadTransfers(); window.addEventListener('karventer:refresh', handler); return () => window.removeEventListener('karventer:refresh', handler); }, [tab]);

  const filteredTransfers = useMemo(() => transfers.filter((transfer) => {
    const text = `${transfer.product_name || ''} ${transfer.source_market_name || ''} ${transfer.target_market_name || ''}`.toLocaleLowerCase('tr-TR');
    return !search || text.includes(search.toLocaleLowerCase('tr-TR'));
  }), [transfers, search]);

  const summary = useMemo(() => {
    const all = transfers;
    return {
      waiting: all.filter((t) => t.status === 'suggested').length,
      approved: all.filter((t) => t.status === 'approved').length,
      completed: all.filter((t) => t.status === 'completed').length,
      qty: all.reduce((sum, t) => sum + Number(t.quantity || 0), 0),
      gain: all.reduce((sum, t) => sum + Number(t.estimated_profit_gain || 0), 0)
    };
  }, [transfers]);

  const showSuccess = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 2500); };

  const decide = async (transferId, status) => {
    try {
      setActionLoading(`${status}-${transferId}`); setError(''); setSuccess('');
      await api.patch(`/api/transfers/${transferId}/decision`, { status, user_id: getCurrentUserId(), reason: status === 'rejected' ? 'Yönetici tarafından reddedildi' : null });
      showSuccess(status === 'approved' ? 'Transfer onaylandı.' : 'Transfer reddedildi.');
      await loadTransfers();
    } catch (err) { setError(apiErrorMessage(err, 'Transfer kararı güncellenemedi.')); }
    finally { setActionLoading(null); }
  };

  const complete = async (transferId) => {
    try {
      setActionLoading(`complete-${transferId}`); setError(''); setSuccess('');
      await api.post(`/api/transfers/${transferId}/complete`, null, { params: { user_id: getCurrentUserId() } });
      showSuccess('Transfer tamamlandı ve stok hareketi işlendi.');
      await loadTransfers();
    } catch (err) { setError(apiErrorMessage(err, 'Transfer tamamlanamadı.')); }
    finally { setActionLoading(null); }
  };


  const undo = async (transferId) => {
    try {
      setActionLoading(`undo-${transferId}`); setError(''); setSuccess('');
      await api.post(`/api/transfers/${transferId}/undo`, null, { params: { user_id: getCurrentUserId() } });
      showSuccess('Transfer geri alındı.');
      await loadTransfers();
    } catch (err) { setError(apiErrorMessage(err, 'Transfer geri alınamadı.')); }
    finally { setActionLoading(null); }
  };

  const createManual = async (event) => {
    event.preventDefault();
    const payload = {
      product_id: Number(form.product_id),
      source_market_id: Number(form.source_market_id),
      target_market_id: Number(form.target_market_id),
      quantity: Number(form.quantity),
      estimated_profit_gain: 0,
      estimated_waste_prevented: 0,
      ai_explanation: form.ai_explanation || 'Web admin manuel transfer'
    };
    if (!payload.product_id || !payload.source_market_id || !payload.target_market_id || !payload.quantity) {
      setError('Manuel transfer için ürün, kaynak, hedef ve adet seçilmelidir.');
      return;
    }
    try {
      setCreating(true); setError(''); setSuccess('');
      await api.post('/api/transfers/manual', payload);
      showSuccess('Manuel transfer onay bekleyen görevlere eklendi.');
      setForm({ product_id: '', source_market_id: '', target_market_id: '', quantity: '', ai_explanation: 'Web admin manuel transfer' });
      setTab('suggested');
      await loadTransfers();
    } catch (err) { setError(apiErrorMessage(err, 'Manuel transfer oluşturulamadı.')); }
    finally { setCreating(false); }
  };

  return (
    <div className="space-y-7">
      <PageHero title="Transfer Yönetimi" />
      {error && <Notice error text={error} />}
      {success && <Notice text={success} />}

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Manuel Transfer Oluştur</h2>
            <p className="text-sm text-slate-500 font-semibold">Web admin kaynak, hedef, ürün ve adet seçerek onay bekleyen transfer oluşturabilir.</p>
          </div>
        </div>
        <form onSubmit={createManual} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <select value={form.product_id} onChange={(e) => setForm((f) => ({ ...f, product_id: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="">Ürün seç</option>
            {products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name} {p.barcode ? `• ${p.barcode}` : ''}</option>)}
          </select>
          <select value={form.source_market_id} onChange={(e) => setForm((f) => ({ ...f, source_market_id: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="">Kaynak seç</option>
            {markets.map((m) => <option key={m.market_id} value={m.market_id}>{m.name}{m.is_depot ? ' • Depo' : ''}</option>)}
          </select>
          <select value={form.target_market_id} onChange={(e) => setForm((f) => ({ ...f, target_market_id: e.target.value }))} className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold">
            <option value="">Hedef seç</option>
            {markets.filter((m) => !m.is_depot).map((m) => <option key={m.market_id} value={m.market_id}>{m.name}</option>)}
          </select>
          <input value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value.replace(/\D/g, '') }))} placeholder="Adet" className="h-11 rounded-xl border border-slate-200 px-3 text-sm font-bold" />
          <button disabled={creating} className="h-11 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-black disabled:opacity-60">{creating ? 'Oluşturuluyor...' : 'Transfer Oluştur'}</button>
        </form>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-5">
        <Metric label="Bekleyen" value={sayiFormatla(summary.waiting)} amber />
        <Metric label="Onaylanan" value={sayiFormatla(summary.approved)} blue />
        <Metric label="Tamamlanan" value={sayiFormatla(summary.completed)} green />
        <Metric label="Toplam Adet" value={sayiFormatla(summary.qty)} />
        <Metric label="Tahmini Kazanç" value={`+${paraFormatla(summary.gain)} ₺`} blue />
      </section>

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 space-y-4">
          <div className="flex flex-wrap gap-2">
            {TABS.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`h-10 px-4 rounded-xl text-sm font-black ${tab === item.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{item.label}</button>)}
          </div>
          <div className="relative max-w-lg"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ürün veya şube ara" className="h-11 w-full pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-semibold" /></div>
        </div>

        {loading ? <div className="p-8 space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 rounded-2xl bg-slate-100 animate-pulse" />)}</div> : filteredTransfers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {filteredTransfers.map((transfer) => <TransferCard key={transfer.transfer_id} transfer={transfer} actionLoading={actionLoading} onApprove={() => decide(transfer.transfer_id, 'approved')} onReject={() => decide(transfer.transfer_id, 'rejected')} onComplete={() => complete(transfer.transfer_id)} onUndo={() => undo(transfer.transfer_id)} />)}
          </div>
        ) : <EmptyState />}
      </section>
    </div>
  );
}

function Notice({ error, text }) { return <div className={`p-5 rounded-2xl border flex items-start gap-4 ${error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>{error ? <AlertCircle size={24} className="mt-1" /> : <CheckCircle2 size={24} className="mt-1" />}<div><h3 className="font-black">{error ? 'İşlem başarısız' : 'İşlem tamamlandı'}</h3><p className="text-sm mt-1">{text}</p></div></div>; }
function Metric({ label, value, green, blue, amber }) { const cls = green ? 'text-green-700 bg-green-50' : blue ? 'text-blue-700 bg-blue-50' : amber ? 'text-amber-700 bg-amber-50' : 'text-slate-700 bg-slate-100'; return <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><p className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">{label}</p><p className={`text-3xl font-black ${cls.split(' ')[0]}`}>{value}</p></div>; }
function TransferCard({ transfer, actionLoading, onApprove, onReject, onComplete, onUndo }) { return <div className="p-6"><div className="flex flex-col 2xl:flex-row 2xl:items-start 2xl:justify-between gap-5"><div className="space-y-4 flex-1"><div className="flex items-start gap-4"><div className="bg-blue-50 p-3 rounded-xl"><ArrowRightLeft className="text-blue-600" size={24} /></div><div><div className="flex flex-wrap items-center gap-3 mb-1"><h3 className="font-black text-slate-900 text-lg">{transfer.product_name}</h3><span className={`px-3 py-1 rounded-full text-xs font-black border ${statusClass(transfer.status)}`}>{STATUS_LABELS[transfer.status] || transfer.status}</span></div><p className="text-sm font-semibold text-slate-500">{transfer.source_market_name} → {transfer.target_market_name}</p></div></div><div className="grid grid-cols-1 md:grid-cols-4 gap-3"><Info icon={<Store size={15} />} label="Kaynak" value={transfer.source_market_name} /><Info icon={<Store size={15} />} label="Hedef" value={transfer.target_market_name} /><Info label="Miktar" value={`${sayiFormatla(transfer.quantity)} adet`} /><Info label="Kazanç" value={`+${paraFormatla(transfer.estimated_profit_gain)} ₺`} green /></div>{transfer.ai_explanation && <p className="text-sm text-slate-600 leading-relaxed max-w-5xl">{transfer.ai_explanation}</p>}{Number(transfer.estimated_waste_prevented || 0) > 0 && <div className="inline-flex items-center gap-2 bg-amber-50 text-amber-700 border border-amber-100 px-3 py-2 rounded-xl text-sm font-black"><ShieldAlert size={17} />{sayiFormatla(transfer.estimated_waste_prevented)} adet fire riski azaltıldı</div>}</div><div className="flex flex-wrap 2xl:flex-col gap-2 min-w-[150px]">{transfer.status === 'suggested' && <><ActionButton loading={actionLoading === `approved-${transfer.transfer_id}`} onClick={onApprove} color="blue" icon={<CheckCircle2 size={17} />} label="Onayla" /><ActionButton loading={actionLoading === `rejected-${transfer.transfer_id}`} onClick={onReject} color="red" icon={<XCircle size={17} />} label="Reddet" /></>}{transfer.status === 'approved' && <ActionButton loading={actionLoading === `complete-${transfer.transfer_id}`} onClick={onComplete} color="green" icon={<PackageCheck size={17} />} label="Tamamla" />}{transfer.status === 'completed' && <><ReadonlyBadge icon={<CheckCircle2 size={17} />} label="Tamamlandı" green /><ActionButton loading={actionLoading === `undo-${transfer.transfer_id}`} onClick={onUndo} color="slate" icon={<RotateCcw size={17} />} label="Geri Al" /></>}{transfer.status === 'rejected' && <ReadonlyBadge icon={<XCircle size={17} />} label="Reddedildi" red />}{transfer.status === 'cancelled' && <ReadonlyBadge icon={<Clock size={17} />} label="İptal" />}</div></div></div>; }
function Info({ icon, label, value, green }) { return <div className="bg-slate-50 border border-slate-100 rounded-xl p-4"><div className="flex items-center gap-2 text-slate-500 text-xs font-black uppercase mb-1">{icon}{label}</div><p className={`font-black ${green ? 'text-green-700' : 'text-slate-800'}`}>{value}</p></div>; }
function ActionButton({ loading, onClick, color, icon, label }) { const cls = color === 'green' ? 'bg-green-600 hover:bg-green-700 text-white' : color === 'red' ? 'bg-white border border-red-200 hover:bg-red-50 text-red-600' : color === 'slate' ? 'bg-white border border-slate-200 hover:bg-slate-50 text-slate-700' : 'bg-blue-600 hover:bg-blue-700 text-white'; return <button onClick={onClick} disabled={loading} className={`h-10 px-4 rounded-xl text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60 ${cls}`}>{loading ? <Loader2 className="animate-spin" size={17} /> : icon}{label}</button>; }
function ReadonlyBadge({ icon, label, green, red }) { const cls = green ? 'bg-green-50 border-green-100 text-green-700' : red ? 'bg-red-50 border-red-100 text-red-700' : 'bg-slate-100 border-slate-200 text-slate-600'; return <div className={`h-10 px-4 rounded-xl text-sm font-black flex items-center justify-center gap-2 border ${cls}`}>{icon}{label}</div>; }
function EmptyState() { return <div className="p-12 text-center text-slate-500"><div className="flex justify-center mb-4"><div className="bg-slate-100 p-4 rounded-full"><ArrowRightLeft className="text-slate-400" size={40} /></div></div><h3 className="font-black text-xl text-slate-900 mb-2">Transfer kaydı bulunmuyor</h3></div>; }
