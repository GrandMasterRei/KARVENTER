// frontend/src/pages/Sales.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Database,
  Loader2,
  PackageSearch,
  Plus,
  Search,
  Save,
  ShoppingCart,
  X
} from 'lucide-react';
import api, { cachedGet, extractRows, apiErrorMessage } from '../services/api';
import PageHero from '../components/PageHero';

const PERIODS = [
  { label: '7 Gün', value: 7 },
  { label: '30 Gün', value: 30 },
  { label: '90 Gün', value: 90 },
  { label: '180 Gün', value: 180 }
];
const initialSaleForm = { product_id: '', market_id: '', quantity: '' };

function sayiFormatla(value) { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString('tr-TR') : '0'; }
function paraFormatla(value) { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString('tr-TR') : '0'; }
function tarihFormatla(value) { if (!value) return '-'; try { return new Date(value).toLocaleString('tr-TR'); } catch { return value; } }
function normalizeText(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c');
}

export default function Sales() {
  const [periodDays, setPeriodDays] = useState(30);
  const [sales, setSales] = useState([]);
  const [summaryData, setSummaryData] = useState(null);
  const [products, setProducts] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [saleForm, setSaleForm] = useState(initialSaleForm);
  const [showManual, setShowManual] = useState(false);
  const [search, setSearch] = useState(new URLSearchParams(window.location.search).get('search') || '');
  const [marketFilter, setMarketFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async (days = periodDays, force = false) => {
    setLoading(true);
    setError('');
    try {
      const [productsResult, marketsResult, summaryResult, salesResult] = await Promise.allSettled([
        cachedGet('/api/products', { maxAgeMs: 60000, force }),
        cachedGet('/api/markets?include_depots=true', { maxAgeMs: 60000, force }),
        api.get(`/api/sales/summary?days=${days}`),
        api.get(`/api/sales?days=${days}&limit=500`)
      ]);

      if (productsResult.status === 'fulfilled') {
        setProducts(extractRows(productsResult.value));
      }
      if (marketsResult.status === 'fulfilled') {
        setMarkets(extractRows(marketsResult.value).filter((market) => !market.is_depot));
      }
      if (summaryResult.status === 'fulfilled') {
        setSummaryData(summaryResult.value.data || null);
      }
      if (salesResult.status === 'fulfilled') {
        setSales(extractRows(salesResult.value));
      } else {
        const fallback = await api.get('/api/sales?limit=500').catch(() => null);
        if (fallback) {
          setSales(extractRows(fallback));
        } else {
          setSales([]);
        }
      }

      const failed = [productsResult, marketsResult, summaryResult, salesResult].find((result) => result.status === 'rejected');
      if (failed && !summaryResult.value?.data && salesResult.status === 'rejected') {
        setError(apiErrorMessage(failed.reason, 'Satış verileri alınamadı.'));
      }
    } catch (err) {
      setError(apiErrorMessage(err, 'Satış verileri alınamadı.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(periodDays, false); }, [periodDays]);
  useEffect(() => {
    const handler = () => loadData(periodDays, true);
    window.addEventListener('karventer:refresh', handler);
    return () => window.removeEventListener('karventer:refresh', handler);
  }, [periodDays]);

  const productMap = useMemo(() => new Map(products.map((p) => [Number(p.product_id), p])), [products]);
  const marketMap = useMemo(() => new Map(markets.map((m) => [Number(m.market_id), m])), [markets]);
  const categories = useMemo(() => [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr')), [products]);

  const salesWithNames = useMemo(() => sales.map((sale) => {
    const product = productMap.get(Number(sale.product_id));
    const market = marketMap.get(Number(sale.market_id));
    return {
      ...sale,
      product_name: product?.product_name || `Ürün #${sale.product_id}`,
      category: product?.category || '-',
      unit_price: Number(product?.unit_price || 0),
      profit_margin: Number(product?.profit_margin || 0),
      market_name: market?.name || `Şube #${sale.market_id}`,
      city: market?.city || '-'
    };
  }).sort((a, b) => new Date(b.sale_date || 0).getTime() - new Date(a.sale_date || 0).getTime()), [sales, productMap, marketMap]);

  const filteredSales = useMemo(() => salesWithNames.filter((sale) => {
    const text = normalizeText(`${sale.product_name} ${sale.category} ${sale.market_name}`);
    if (search && !text.includes(normalizeText(search))) return false;
    if (marketFilter && String(sale.market_id) !== String(marketFilter)) return false;
    if (categoryFilter && sale.category !== categoryFilter) return false;
    return true;
  }), [salesWithNames, search, marketFilter, categoryFilter]);

  const summary = useMemo(() => {
    const totalQty = filteredSales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
    const revenue = filteredSales.reduce((sum, sale) => sum + Number(sale.quantity || 0) * Number(sale.unit_price || 0), 0);
    const grossProfit = filteredSales.reduce((sum, sale) => sum + Number(sale.quantity || 0) * Number(sale.unit_price || 0) * Number(sale.profit_margin || 0), 0);
    const categoryTotals = new Map();
    filteredSales.forEach((sale) => categoryTotals.set(sale.category, (categoryTotals.get(sale.category) || 0) + Number(sale.quantity || 0)));
    const topCategory = [...categoryTotals.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || '-';
    const periodRevenue = Number(summaryData?.revenue ?? summaryData?.total_revenue ?? revenue);
    const periodProfit = Number(summaryData?.gross_profit ?? summaryData?.profit ?? grossProfit);
    const periodQty = Number(summaryData?.total_quantity ?? summaryData?.quantity ?? totalQty);
    const periodCount = Number(summaryData?.record_count ?? summaryData?.sales_count ?? filteredSales.length);
    return { totalQty: periodQty, revenue: periodRevenue, grossProfit: periodProfit, topCategory, productVariety: categoryTotals.size, recordCount: periodCount };
  }, [filteredSales, summaryData]);

  const showMessage = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 2500); };

  const handleSaleSubmit = async (event) => {
    event.preventDefault();
    const productId = Number(saleForm.product_id);
    const marketId = Number(saleForm.market_id);
    const quantity = Number(saleForm.quantity);
    if (!productId || !marketId || !Number.isInteger(quantity) || quantity <= 0) return setError('Ürün, şube ve miktar zorunludur.');
    try {
      setSaving(true);
      setError('');
      await api.post('/api/sales', { product_id: productId, market_id: marketId, quantity });
      setSaleForm(initialSaleForm);
      setShowManual(false);
      showMessage('Manuel satış kaydı eklendi.');
      await loadData(periodDays, true);
    } catch (err) {
      setError(err.response?.data?.detail || 'Satış kaydı eklenemedi.');
    } finally { setSaving(false); }
  };

  return (
    <div className="space-y-6 animate-[fadeIn_.18s_ease-out]">
      <PageHero
        title="Satış Yönetimi"
        right={(
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex gap-1 rounded-2xl border border-white/10 bg-white/10 p-1">
              {PERIODS.map((period) => <button key={period.value} onClick={() => setPeriodDays(period.value)} className={`h-10 rounded-xl px-4 text-sm font-black transition ${periodDays === period.value ? 'bg-white text-blue-700 shadow-sm' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>{period.label}</button>)}
            </div>
            <button onClick={() => setShowManual((v) => !v)} className="flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white px-5 text-sm font-black text-slate-900 shadow-sm transition hover:bg-blue-50">
              {showManual ? <X size={18} /> : <Plus size={18} />}
              Manuel Kayıt
            </button>
          </div>
        )}
      />

      {error && <Notice error text={error} />}
      {success && <Notice text={success} />}

      {showManual && (
        <section className="rounded-[2rem] border border-blue-100 bg-white p-6 shadow-sm animate-[fadeIn_.18s_ease-out]">
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-black text-slate-950">Manuel satış kaydı</h3>
            <button onClick={() => setShowManual(false)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={18} /></button>
          </div>
          <form onSubmit={handleSaleSubmit} className="grid grid-cols-1 items-end gap-4 md:grid-cols-4">
            <Select label="Ürün" required value={saleForm.product_id} onChange={(e) => setSaleForm({ ...saleForm, product_id: e.target.value })}>
              <option value="">Seç</option>{products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
            </Select>
            <Select label="Şube" required value={saleForm.market_id} onChange={(e) => setSaleForm({ ...saleForm, market_id: e.target.value })}>
              <option value="">Seç</option>{markets.map((m) => <option key={m.market_id} value={m.market_id}>{m.name}</option>)}
            </Select>
            <Field label="Miktar"><input required type="number" min="1" value={saleForm.quantity} onChange={(e) => setSaleForm({ ...saleForm, quantity: e.target.value })} className="h-11 w-full rounded-2xl border border-slate-200 px-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70" /></Field>
            <button disabled={saving} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-100 transition hover:bg-blue-700 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={17} /> : <Save size={17} />}Kaydet</button>
          </form>
        </section>
      )}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<Database size={23} />} label="Satış Kaydı" value={sayiFormatla(summary.recordCount)} />
        <Metric icon={<ShoppingCart size={23} />} label="Satış Adedi" value={sayiFormatla(summary.totalQty)} green />
        <Metric icon={<BarChart3 size={23} />} label="Ciro" value={`${paraFormatla(summary.revenue)} ₺`} blue />
        <Metric icon={<PackageSearch size={23} />} label="Brüt Kâr" value={`${paraFormatla(summary.grossProfit)} ₺`} amber />
      </section>

      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60">
        <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-white p-5 md:grid-cols-2 xl:grid-cols-4">
          <div className="relative xl:col-span-2"><Search className="absolute left-4 top-3.5 text-slate-400" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ürün, kategori veya şube ara" className="h-11 w-full rounded-2xl border border-slate-200 pl-11 pr-4 text-sm font-semibold outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70" /></div>
          <select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70"><option value="">Tüm Şubeler</option>{markets.map((m) => <option key={m.market_id} value={m.market_id}>{m.name}</option>)}</select>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70"><option value="">Tüm Kategoriler</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        </div>
        {loading ? <div className="space-y-3 p-8">{[1,2,3,4,5].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}</div> : <SalesTable rows={filteredSales} />}
      </section>
    </div>
  );
}

function Notice({ error, text }) { return <div className={`flex items-start gap-4 rounded-2xl border p-5 ${error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{error ? <AlertCircle size={24} className="mt-1 shrink-0" /> : <CheckCircle2 size={24} className="mt-1 shrink-0" />}<div><h3 className="font-black">{error ? 'İşlem tamamlanamadı' : 'İşlem tamamlandı'}</h3><p className="mt-1 text-sm">{text}</p></div></div>; }
function Metric({ icon, label, value, green, blue, amber }) { const cls = green ? 'bg-emerald-50 text-emerald-600 ring-emerald-100' : blue ? 'bg-blue-50 text-blue-600 ring-blue-100' : amber ? 'bg-amber-50 text-amber-600 ring-amber-100' : 'bg-slate-50 text-slate-600 ring-slate-100'; return <div className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${cls}`}>{icon}</div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-1 truncate text-3xl font-black text-slate-950">{value}</p></div>; }
function Field({ label, children }) { return <div className="space-y-2"><label className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</label>{children}</div>; }
function Select({ label, children, ...props }) { return <Field label={label}><select {...props} className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70">{children}</select></Field>; }
function SalesTable({ rows }) { return <div className="max-h-[620px] overflow-x-auto"><table className="w-full border-collapse text-left"><thead className="sticky top-0 border-b border-slate-100 bg-slate-50/90"><tr><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Ürün</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Şube</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Miktar</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Ciro</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Tarih</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((sale, index) => <tr key={`${sale.sale_id || index}`} className="transition hover:bg-blue-50/35"><td className="p-5"><div className="font-black text-slate-950">{sale.product_name}</div><div className="text-xs font-semibold text-slate-400">{sale.category}</div></td><td className="p-5"><div className="font-bold text-slate-700">{sale.market_name}</div><div className="text-xs font-semibold text-slate-400">{sale.city}</div></td><td className="p-5 text-lg font-black text-slate-950">{sayiFormatla(sale.quantity)}</td><td className="p-5 font-black text-slate-950">{paraFormatla(Number(sale.quantity || 0) * Number(sale.unit_price || 0))} ₺</td><td className="p-5 text-sm font-semibold text-slate-500">{tarihFormatla(sale.sale_date)}</td></tr>)}{rows.length === 0 && <tr><td colSpan="5" className="p-10 text-center font-semibold text-slate-500">Satış kaydı bulunmuyor.</td></tr>}</tbody></table></div>; }
