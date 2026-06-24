// frontend/src/pages/LiveOps.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ClipboardCheck,
  PackageCheck,
  Radio,
  Search,
  Store,
  Truck
} from 'lucide-react';
import api, { cachedGet, extractRows } from '../services/api';
import PageHero from '../components/PageHero';

function sayiFormatla(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('tr-TR') : '0';
}

function paraFormatla(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('tr-TR', { maximumFractionDigits: 2 }) : '0';
}

const initialForm = {
  market_id: '',
  product_id: '',
  quantity: '5'
};

function suggestionKey(suggestion) {
  return `${suggestion.product_id || suggestion.urun || ''}-${suggestion.kaynak_market_id || suggestion.kaynak_sube || ''}-${suggestion.hedef_market_id || suggestion.hedef_sube || ''}-${suggestion.miktar || ''}`;
}

function normalizeExistingTransferKey(item) {
  return `${item.product_id || item.product_name || ''}-${item.source_market_id || item.source_market_name || ''}-${item.target_market_id || item.target_market_name || ''}-${item.quantity || ''}`;
}

export default function LiveOps() {
  const [status, setStatus] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [lastEvent, setLastEvent] = useState(null);
  const [lastSuggestions, setLastSuggestions] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [processedSuggestions, setProcessedSuggestions] = useState(new Set());
  const [existingTransferKeys, setExistingTransferKeys] = useState(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async (force = false) => {
    try {
      setLoading(true);
      setError('');
      const [statusRes, transfersRes, marketsRes, productsRes] = await Promise.all([
        api.get('/api/live/status?limit=12'),
        cachedGet('/api/transfers?limit=80', { maxAgeMs: 15000, force }).catch(() => ({ data: { data: [] } })),
        cachedGet('/api/markets?include_depots=true', { maxAgeMs: 60000, force }).catch(() => ({ data: [] })),
        cachedGet('/api/products', { maxAgeMs: 60000, force }).catch(() => ({ data: [] }))
      ]);

      setStatus(statusRes.data || null);
      const transferRows = extractRows(transfersRes);
      setExistingTransferKeys(new Set(
        transferRows
          .filter((item) => ['suggested', 'approved'].includes(item.status))
          .map(normalizeExistingTransferKey)
      ));
      setMarkets(extractRows(marketsRes).filter((market) => !market.is_depot));
      setProducts(extractRows(productsRes));
    } catch {
      setError('Canlı takip verileri alınamadı.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => {
    const handler = () => loadData(true);
    window.addEventListener('karventer:refresh', handler);
    return () => window.removeEventListener('karventer:refresh', handler);
  }, []);

  const filteredRows = useMemo(() => {
    const q = search.toLocaleLowerCase('tr-TR');
    const rows = Array.isArray(status?.data) ? status.data : [];
    if (!q) return rows;
    return rows.filter((row) => `${row.product_name || ''} ${row.market_name || ''} ${row.city || ''}`.toLocaleLowerCase('tr-TR').includes(q));
  }, [status, search]);

  const isSuggestionProcessed = (suggestion) => {
    const key = suggestionKey(suggestion);
    const altKey = `${suggestion.product_id || suggestion.urun || ''}-${suggestion.kaynak_sube || ''}-${suggestion.hedef_sube || ''}-${suggestion.miktar || ''}`;
    return processedSuggestions.has(key) || existingTransferKeys.has(key) || existingTransferKeys.has(altKey);
  };

  const handleLiveSale = async (e) => {
    e.preventDefault();
    const marketId = Number(form.market_id);
    const productId = Number(form.product_id);
    const quantity = Number(form.quantity);

    if (!marketId || !productId || !Number.isInteger(quantity) || quantity <= 0) {
      setError('Şube, ürün ve geçerli satış adedi seçilmelidir.');
      return;
    }

    try {
      setProcessing(true);
      setError('');
      setSuccess('');
      const response = await api.post('/api/live/sale', {
        market_id: marketId,
        product_id: productId,
        quantity,
        create_transfer_task: false
      });

      setLastEvent(response.data?.event || null);
      setLastSuggestions(Array.isArray(response.data?.suggestions) ? response.data.suggestions : []);
      setProcessedSuggestions(new Set());
      setSuccess('Satış işlendi.');
      await loadData(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Canlı satış işlemi uygulanamadı.');
    } finally {
      setProcessing(false);
    }
  };

  const createTransferTask = async (suggestion, index) => {
    const key = suggestionKey(suggestion);
    if (isSuggestionProcessed(suggestion)) return;
    try {
      setActionLoading(key);
      setError('');
      setSuccess('');
      await api.post('/api/transfers', {
        kaynak_sube: suggestion.kaynak_sube,
        hedef_sube: suggestion.hedef_sube,
        urun: suggestion.urun,
        miktar: Number(suggestion.miktar || 0),
        kurtarilan_kar_tahmini: Number(suggestion.kurtarilan_kar_tahmini || 0),
        onlenen_fire_adedi: Number(suggestion.onlenen_fire_adedi || 0),
        aciklama: suggestion.aciklama || ''
      });
      setSuccess('Transfer görevi oluşturuldu.');
      setProcessedSuggestions((prev) => new Set(prev).add(key));
      setLastSuggestions((items) => items.filter((_, i) => i !== index));
      await loadData(true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Transfer görevi oluşturulamadı.');
    } finally {
      setActionLoading(null);
    }
  };

  const renderSuggestionCard = (suggestion, index) => {
    const processed = isSuggestionProcessed(suggestion);
    return (
      <div key={`${suggestion.kaynak_market_id || suggestion.kaynak_sube}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-950">{suggestion.kaynak_sube} → {suggestion.hedef_sube}</p>
            <p className="text-xs text-slate-500 font-bold mt-1">Kaynak: {suggestion.kaynak_tipi === 'depo' ? 'Ana depo' : 'Aynı ildeki şube'}</p>
          </div>
          <span className="rounded-full bg-blue-50 text-blue-700 px-3 py-1 text-xs font-black">{sayiFormatla(suggestion.miktar)} adet</span>
        </div>
        <p className="text-xs text-slate-600 mt-3 leading-relaxed">{suggestion.aciklama}</p>
        <div className="flex items-center justify-between mt-4">
          <span className="text-xs font-black text-green-700">+{paraFormatla(suggestion.kurtarilan_kar_tahmini)} ₺</span>
          <button onClick={() => createTransferTask(suggestion, index)} disabled={actionLoading === suggestionKey(suggestion) || processed} className="h-10 px-4 rounded-xl bg-slate-950 hover:bg-slate-800 text-white text-xs font-black flex items-center gap-2 disabled:opacity-60">
            {actionLoading === suggestionKey(suggestion) ? <Loader2 className="animate-spin" size={15} /> : <PackageCheck size={15} />}
            {processed ? 'Görevde' : 'Göreve Al'}
          </button>
        </div>
      </div>
    );
  };



  const renderRiskCard = (row) => {
    const stockDays = Number(row.stock_days);
    const stockDayText = Number.isFinite(stockDays) && stockDays !== 999 ? `${sayiFormatla(stockDays)} gün` : 'Veri yok';
    return (
      <div className="h-full rounded-2xl border border-red-100 bg-red-50/60 p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${row.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
            <p className="text-sm font-black text-slate-950">Anlık Stok Riski</p>
          </div>
          <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-red-700">{row.severity === 'critical' ? 'Kritik' : 'Yaklaşan Risk'}</span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <MiniPill label="Stok" value={sayiFormatla(row.quantity)} tone="slate" />
          <MiniPill label="Min" value={sayiFormatla(row.min_stock_level)} tone="red" />
          <MiniPill label="Günlük" value={sayiFormatla(row.daily_sales_speed)} tone="blue" />
        </div>
        <p className="mt-3 text-xs font-semibold leading-relaxed text-slate-600">
          {row.market_name} lokasyonunda {row.product_name} için stok seviyesi satış hızına göre izleniyor. Tahmini stok dayanımı: <b>{stockDayText}</b>.
        </p>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700 flex items-start gap-3">
          <AlertCircle size={22} className="shrink-0 mt-0.5" />
          <div className="font-bold text-sm">{error}</div>
        </div>
      )}

      {success && (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 text-green-700 flex items-start gap-3">
          <CheckCircle2 size={22} className="shrink-0 mt-0.5" />
          <div className="font-bold text-sm">{success}</div>
        </div>
      )}

      <PageHero title="Canlı Takip" />

      <div className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        <MetricCard icon={<Radio className="text-blue-600 mb-4" size={28} />} label="Anlık Stok Eksiği" value={status?.critical_count || 0} />
        <MetricCard icon={<Activity className="text-amber-600 mb-4" size={28} />} label="Yaklaşan Risk" value={status?.warning_count || 0} />
        <MetricCard icon={<Truck className="text-indigo-600 mb-4" size={28} />} label="Ana Depo" value={status?.depot_count || 0} />
        <MetricCard icon={<AlertCircle className="text-red-600 mb-4" size={28} />} label="Açık Bildirim" value={status?.open_alert_count || 0} />
      </div>

      <div className="grid grid-cols-1 2xl:grid-cols-3 gap-6">
        <section className="2xl:col-span-1 rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-11 w-11 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <ClipboardCheck size={23} />
            </div>
            <div><h2 className="text-lg font-black text-slate-950">Satış Kaydet</h2></div>
          </div>

          <form onSubmit={handleLiveSale} className="space-y-4">
            <select value={form.market_id} onChange={(e) => setForm({ ...form, market_id: e.target.value })} className="w-full h-12 rounded-xl border border-slate-200 px-4 font-bold text-slate-700 bg-white">
              <option value="">Şube seç</option>
              {markets.map((market) => <option key={market.market_id} value={market.market_id}>{market.name}</option>)}
            </select>
            <select value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })} className="w-full h-12 rounded-xl border border-slate-200 px-4 font-bold text-slate-700 bg-white">
              <option value="">Ürün seç</option>
              {products.map((product) => <option key={product.product_id} value={product.product_id}>{product.product_name}</option>)}
            </select>
            <input type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} className="w-full h-12 rounded-xl border border-slate-200 px-4 font-bold text-slate-700 bg-white" placeholder="Satış adedi" />
            <button type="submit" disabled={processing} className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black flex items-center justify-center gap-2 disabled:opacity-60">
              {processing ? <Loader2 className="animate-spin" size={18} /> : <ClipboardCheck size={18} />}
              Satışı İşle
            </button>
          </form>

          {lastEvent && (
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-950">Son İşlem</p>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                {lastEvent.market_name} şubesinde {lastEvent.product_name} için {sayiFormatla(lastEvent.sold_quantity)} adet satış işlendi. Stok {sayiFormatla(lastEvent.stock_before)} adetten {sayiFormatla(lastEvent.stock_after)} adede düştü.
              </p>
            </div>
          )}
        </section>

        <section className="2xl:col-span-2 rounded-2xl bg-white border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
            <div><h2 className="text-lg font-black text-slate-950">Anlık Stok Riskleri</h2></div>
            <div className="relative w-full xl:w-[360px]">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ürün veya şube ara" className="w-full h-12 rounded-xl border border-slate-200 pl-11 pr-4 font-bold text-sm" />
            </div>
          </div>

          {loading ? (
            <div className="p-8 flex items-center gap-3 text-slate-600">
              <Loader2 className="animate-spin text-blue-600" size={28} />
              <span className="font-bold">Veriler yükleniyor</span>
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-10 text-center text-slate-500 font-bold">Anlık stok eksiği bulunmuyor.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredRows.map((row) => (
                <div key={`${row.market_id}-${row.product_id}`} className="p-5">
                  <div className="flex flex-col xl:flex-row xl:items-start xl:justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`h-2.5 w-2.5 rounded-full ${row.severity === 'critical' ? 'bg-red-500' : 'bg-amber-500'}`} />
                        <h3 className="font-black text-slate-950">{row.product_name}</h3>
                      </div>
                      <p className="text-sm text-slate-500 font-medium flex items-center gap-2"><Store size={15} /> {row.market_name} · {row.city}</p>
                    </div>

                  </div>

                  <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-3">
                    {renderRiskCard(row)}
                    <div className="h-full rounded-2xl border border-blue-100 bg-blue-50/50 p-4">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-slate-950">AI Sevkiyat / Tedarik Önerisi</p>
                        <Truck size={18} className="text-blue-700" />
                      </div>
                      {row.suggestions?.length > 0 ? (
                        <div className="space-y-3">
                          {row.suggestions.slice(0, 2).map(renderSuggestionCard)}
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-amber-100 bg-white p-4 text-sm font-bold text-amber-800">
                          Uygun transfer kaynağı bulunamadı. Bu ürün için satın alma/tedarik planı önerilir.
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {lastSuggestions.length > 0 && (
        <section className="rounded-2xl bg-white border border-slate-200 shadow-sm p-6">
          <h2 className="text-lg font-black text-slate-950 mb-4">Son İşlem Önerileri</h2>
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {lastSuggestions.map(renderSuggestionCard)}
          </div>
        </section>
      )}
    </div>
  );
}


function MiniPill({ label, value, tone }) {
  const styles = {
    slate: 'bg-white text-slate-700 border-slate-100',
    red: 'bg-white text-red-700 border-red-100',
    blue: 'bg-white text-blue-700 border-blue-100'
  };
  return (
    <div className={`rounded-xl border px-3 py-2 ${styles[tone] || styles.slate}`}>
      <div className="text-[10px] font-black uppercase tracking-wide opacity-60">{label}</div>
      <div className="mt-0.5 text-sm font-black">{value}</div>
    </div>
  );
}

function MetricCard({ icon, label, value }) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
      {icon}
      <p className="text-xs uppercase tracking-wider text-slate-400 font-black">{label}</p>
      <p className="text-3xl font-black mt-1 text-slate-950">{sayiFormatla(value)}</p>
    </div>
  );
}
