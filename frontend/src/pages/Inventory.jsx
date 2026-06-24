// frontend/src/pages/Inventory.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  AlertCircle,
  Box,
  CheckCircle2,
  ChevronDown,
  Filter,
  Loader2,
  PackageCheck,
  PackagePlus,
  Plus,
  Search,
  ShieldAlert,
  Store,
  TrendingUp,
  X
} from 'lucide-react';
import api, { cachedGet } from '../services/api';
import PageHero from '../components/PageHero';

const initialMarketForm = { name: '', city: '' };
const initialProductForm = {
  product_name: '',
  category: '',
  unit_price: '',
  profit_margin: '',
  min_stock_level: '',
  shelf_life_days: '',
  is_perishable: 'true'
};
const initialBatchForm = { market_id: '', product_id: '', quantity: '', received_date: '', expiry_date: '' };

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

function sayiFormatla(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('tr-TR') : '0';
}

function tarihFormatla(value) {
  if (!value) return '-';
  try { return new Date(value).toLocaleDateString('tr-TR'); } catch { return value; }
}

function stokDurumClass(status) {
  if (status === 'Kritik') return 'bg-red-50 text-red-700 ring-red-100';
  if (status === 'Fazla Stok') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
}

function stokDurumLabel(status) {
  if (status === 'Kritik') return 'Stok Eksiği';
  return status || 'Normal';
}

function batchLabel(status) {
  return {
    active: 'Aktif',
    near_expiry: 'SKT Yaklaşıyor',
    expired: 'SKT Geçmiş',
    depleted: 'Tükendi',
    returned: 'İade',
    transferred: 'Transfer Edildi'
  }[status] || status || 'Aktif';
}

function batchClass(status) {
  if (status === 'expired') return 'bg-red-50 text-red-700 ring-red-100';
  if (status === 'near_expiry') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
}

function Input(props) {
  return <input {...props} className={`h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70 ${props.className || ''}`} />;
}

function Select(props) {
  return <select {...props} className={`h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100/70 ${props.className || ''}`} />;
}

export default function Inventory() {
  const location = useLocation();
  const params = new URLSearchParams(location.search);

  const [stocks, setStocks] = useState([]);
  const [expiryRisks, setExpiryRisks] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [products, setProducts] = useState([]);

  const [search, setSearch] = useState(params.get('search') || '');
  const [marketFilter, setMarketFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const [showAddPanel, setShowAddPanel] = useState(false);
  const [addType, setAddType] = useState(null);

  const [marketForm, setMarketForm] = useState(initialMarketForm);
  const [productForm, setProductForm] = useState(initialProductForm);
  const [batchForm, setBatchForm] = useState(initialBatchForm);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async (force = false) => {
    try {
      setLoading(true);
      setError('');
      const [stocksRes, marketsRes, productsRes, risksRes] = await Promise.all([
        cachedGet('/api/stocks?include_depots=true', { maxAgeMs: 30000, force }),
        cachedGet('/api/markets?include_depots=true', { maxAgeMs: 60000, force }),
        cachedGet('/api/products', { maxAgeMs: 60000, force }),
        cachedGet('/api/stock-batches/expiry-risks?days=30', { maxAgeMs: 45000, force }).catch(() => ({ data: { data: [] } }))
      ]);
      setStocks(Array.isArray(stocksRes.data?.data) ? stocksRes.data.data : []);
      setMarkets(Array.isArray(marketsRes.data) ? marketsRes.data : []);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
      setExpiryRisks(Array.isArray(risksRes.data?.data) ? risksRes.data.data : []);
    } catch {
      setError('Stok verileri alınamadı.');
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

  const categories = useMemo(() => {
    return [...new Set(products.map((p) => p.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [products]);

  const summary = useMemo(() => {
    const total = stocks.reduce((sum, stock) => sum + Number(stock.quantity || 0), 0);
    const missing = stocks.filter((stock) => stock.status === 'Kritik').length;
    const over = stocks.filter((stock) => stock.status === 'Fazla Stok').length;
    const riskQty = expiryRisks.reduce((sum, item) => sum + Number(item.remaining_quantity || 0), 0);
    return { total, missing, over, riskQty, records: stocks.length };
  }, [stocks, expiryRisks]);

  const showExpiryTable = statusFilter === 'near_expiry' || statusFilter === 'expired';

  const filteredStocks = useMemo(() => {
    const needle = normalizeText(search);
    return stocks.filter((stock) => {
      const haystack = normalizeText(`${stock.product_name} ${stock.category} ${stock.market_name} ${stock.city}`);
      if (needle && !haystack.includes(needle)) return false;
      if (marketFilter && String(stock.market_id) !== String(marketFilter)) return false;
      if (categoryFilter && stock.category !== categoryFilter) return false;
      if (statusFilter === 'missing' && stock.status !== 'Kritik') return false;
      if (statusFilter === 'normal' && stock.status !== 'Normal') return false;
      if (statusFilter === 'overstock' && stock.status !== 'Fazla Stok') return false;
      if (statusFilter === 'near_expiry' || statusFilter === 'expired') return false;
      return true;
    });
  }, [stocks, search, marketFilter, categoryFilter, statusFilter]);

  const filteredBatches = useMemo(() => {
    const needle = normalizeText(search);
    return expiryRisks.filter((batch) => {
      const haystack = normalizeText(`${batch.product_name} ${batch.market_name} ${batch.lot_code}`);
      if (needle && !haystack.includes(needle)) return false;
      if (marketFilter && String(batch.market_id) !== String(marketFilter)) return false;
      const product = products.find((p) => Number(p.product_id) === Number(batch.product_id));
      if (categoryFilter && product?.category !== categoryFilter) return false;
      if (statusFilter === 'near_expiry' && batch.status !== 'near_expiry') return false;
      if (statusFilter === 'expired' && batch.status !== 'expired') return false;
      return true;
    });
  }, [expiryRisks, search, marketFilter, categoryFilter, statusFilter, products]);

  const flash = (message) => {
    setSuccess(message);
    setTimeout(() => setSuccess(''), 2200);
  };

  const handleMarketSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true); setError('');
      await api.post('/api/markets', null, { params: { name: marketForm.name.trim(), city: marketForm.city.trim() } });
      setMarketForm(initialMarketForm); setAddType(null); setShowAddPanel(false);
      flash('Şube kaydedildi.'); await loadData();
    } catch { setError('Şube kaydedilemedi.'); } finally { setSaving(false); }
  };

  const handleProductSubmit = async (e) => {
    e.preventDefault();
    const unitPrice = Number(productForm.unit_price);
    const margin = Number(productForm.profit_margin);
    const min = Number(productForm.min_stock_level);
    if (!Number.isFinite(unitPrice) || unitPrice <= 0 || !Number.isFinite(margin) || margin < 0 || !Number.isInteger(min) || min < 0) {
      setError('Ürün bilgilerini kontrol et.');
      return;
    }
    try {
      setSaving(true); setError('');
      await api.post('/api/products', {
        product_name: productForm.product_name.trim(),
        category: productForm.category.trim(),
        unit_price: unitPrice,
        profit_margin: margin / 100,
        min_stock_level: min,
        shelf_life_days: Number(productForm.shelf_life_days || 180),
        is_perishable: productForm.is_perishable === 'true'
      });
      setProductForm(initialProductForm); setAddType(null); setShowAddPanel(false);
      flash('Ürün kaydedildi.'); await loadData();
    } catch { setError('Ürün kaydedilemedi.'); } finally { setSaving(false); }
  };

  const handleBatchSubmit = async (e) => {
    e.preventDefault();
    const marketId = Number(batchForm.market_id);
    const productId = Number(batchForm.product_id);
    const quantity = Number(batchForm.quantity);
    const product = products.find((item) => Number(item.product_id) === productId);
    if (!marketId || !productId || !Number.isInteger(quantity) || quantity <= 0) {
      setError('Şube, ürün ve miktar zorunludur.');
      return;
    }
    const receivedDate = batchForm.received_date ? new Date(batchForm.received_date) : new Date();
    const expiryDate = batchForm.expiry_date ? new Date(batchForm.expiry_date) : new Date(receivedDate);
    if (!batchForm.expiry_date) expiryDate.setDate(expiryDate.getDate() + Number(product?.shelf_life_days || 180));
    try {
      setSaving(true); setError('');
      await api.post('/api/stock-batches', {
        product_id: productId,
        market_id: marketId,
        lot_code: `LOT-${productId}-${marketId}-${Date.now()}`,
        initial_quantity: quantity,
        remaining_quantity: quantity,
        received_date: receivedDate.toISOString(),
        expiry_date: expiryDate.toISOString(),
        unit_cost: Number(product?.unit_price || 0) * 0.7,
        status: 'active'
      });
      setBatchForm(initialBatchForm); setAddType(null); setShowAddPanel(false);
      flash('Stok partisi kaydedildi.'); await loadData();
    } catch (err) { setError(err.response?.data?.detail || 'Stok partisi kaydedilemedi.'); } finally { setSaving(false); }
  };

  const activeRows = showExpiryTable ? filteredBatches.length : filteredStocks.length;

  return (
    <div className="space-y-6 animate-[fadeIn_.18s_ease-out]">
      <PageHero
        title="Stok Yönetimi"
        right={<div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm font-black text-white"><Filter size={18} />{sayiFormatla(activeRows)} kayıt</div>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Metric icon={<PackageCheck size={22} />} label="Stok Kaydı" value={sayiFormatla(summary.records)} />
        <Metric icon={<AlertCircle size={22} />} label="Stok Eksiği" value={sayiFormatla(summary.missing)} danger />
        <Metric icon={<ShieldAlert size={22} />} label="SKT Riski" value={sayiFormatla(summary.riskQty)} amber />
        <Metric icon={<TrendingUp size={22} />} label="Fazla Stok" value={sayiFormatla(summary.over)} blue />
      </div>

      {error && <Message type="error" text={error} />}
      {success && <Message type="success" text={success} />}

      <section className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60">
        <div className="space-y-4 border-b border-slate-100 bg-white p-5">
          <div className="grid grid-cols-1 items-center gap-3 xl:grid-cols-[1.4fr_0.65fr_0.65fr_0.65fr_auto]">
            <div className="relative">
              <Search className="absolute left-4 top-3.5 text-slate-400" size={18} />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Ürün, şube veya lot ara" className="pl-11" />
            </div>
            <Select value={marketFilter} onChange={(e) => setMarketFilter(e.target.value)}>
              <option value="">Tüm Şubeler</option>
              {markets.map((market) => <option key={market.market_id} value={market.market_id}>{market.name}</option>)}
            </Select>
            <Select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
              <option value="">Tüm Kategoriler</option>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </Select>
            <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">Tüm Durumlar</option>
              <option value="missing">Stok Eksiği</option>
              <option value="normal">Normal</option>
              <option value="overstock">Fazla Stok</option>
              <option value="near_expiry">SKT Yaklaşıyor</option>
              <option value="expired">SKT Geçmiş</option>
            </Select>
            <button
              onClick={() => setShowAddPanel((value) => !value)}
              className="h-11 rounded-2xl bg-blue-600 px-5 text-sm font-black text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {showAddPanel ? <X size={18} /> : <Plus size={18} />}
              Ekle
            </button>
          </div>

          {showAddPanel && (
            <div className="space-y-4 rounded-[1.5rem] border border-blue-100 bg-blue-50/50 p-4 animate-[fadeIn_.18s_ease-out]">
              <div className="flex flex-wrap gap-2">
                <Choice active={addType === 'market'} icon={<Store size={18} />} label="Şube" onClick={() => setAddType('market')} />
                <Choice active={addType === 'product'} icon={<Box size={18} />} label="Ürün" onClick={() => setAddType('product')} />
                <Choice active={addType === 'batch'} icon={<PackagePlus size={18} />} label="Stok Partisi" onClick={() => setAddType('batch')} />
              </div>
              {!addType && <div className="rounded-2xl border border-slate-100 bg-white p-5 font-semibold text-slate-500">Kayıt türü seç.</div>}
              {addType === 'market' && <MarketForm form={marketForm} setForm={setMarketForm} onSubmit={handleMarketSubmit} saving={saving} />}
              {addType === 'product' && <ProductForm form={productForm} setForm={setProductForm} onSubmit={handleProductSubmit} saving={saving} />}
              {addType === 'batch' && <BatchForm form={batchForm} setForm={setBatchForm} markets={markets} products={products} onSubmit={handleBatchSubmit} saving={saving} />}
            </div>
          )}
        </div>

        {loading ? (
          <div className="p-8 space-y-3">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100" />)}</div>
        ) : showExpiryTable ? (
          <BatchTable rows={filteredBatches} />
        ) : (
          <StockTable rows={filteredStocks} />
        )}
      </section>
    </div>
  );
}

function Metric({ icon, label, value, danger, amber, blue }) {
  const color = danger ? 'text-red-700 bg-red-50 ring-red-100' : amber ? 'text-amber-700 bg-amber-50 ring-amber-100' : blue ? 'text-blue-700 bg-blue-50 ring-blue-100' : 'text-blue-700 bg-blue-50 ring-blue-100';
  return <div className="rounded-[1.5rem] border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ring-1 ${color}`}>{icon}</div><p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">{label}</p><p className="mt-1 text-3xl font-black text-slate-950">{value}</p></div>;
}

function Message({ type, text }) {
  const cls = type === 'error' ? 'bg-red-50 border-red-200 text-red-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700';
  return <div className={`rounded-2xl border p-4 font-bold ${cls}`}>{text}</div>;
}

function Choice({ active, icon, label, onClick }) {
  return <button onClick={onClick} type="button" className={`flex h-11 items-center gap-2 rounded-2xl border px-4 font-black transition ${active ? 'border-blue-600 bg-blue-600 text-white shadow-lg shadow-blue-100' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50/50'}`}>{icon}{label}<ChevronDown size={16} className={active ? 'rotate-180 transition-transform' : 'transition-transform'} /></button>;
}

function SaveButton({ saving }) {
  return <button disabled={saving} className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 font-black text-white transition hover:bg-slate-800 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={17} /> : <CheckCircle2 size={17} />}Kaydet</button>;
}

function MarketForm({ form, setForm, onSubmit, saving }) {
  return <form onSubmit={onSubmit} className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_1fr_auto]"><Field label="Şube adı"><Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field><Field label="Şehir"><Input required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></Field><SaveButton saving={saving} /></form>;
}

function ProductForm({ form, setForm, onSubmit, saving }) {
  return <form onSubmit={onSubmit} className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-4"><Field label="Ürün adı"><Input required value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></Field><Field label="Kategori"><Input required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} /></Field><Field label="Birim fiyat"><Input required type="number" step="0.01" min="0" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} /></Field><Field label="Net marj %"><Input required type="number" step="0.01" min="0" value={form.profit_margin} onChange={(e) => setForm({ ...form, profit_margin: e.target.value })} /></Field><Field label="Minimum stok"><Input required type="number" min="0" value={form.min_stock_level} onChange={(e) => setForm({ ...form, min_stock_level: e.target.value })} /></Field><Field label="Raf ömrü"><Input type="number" min="0" value={form.shelf_life_days} onChange={(e) => setForm({ ...form, shelf_life_days: e.target.value })} /></Field><Field label="SKT"><Select value={form.is_perishable} onChange={(e) => setForm({ ...form, is_perishable: e.target.value })}><option value="true">Takip edilsin</option><option value="false">Takip edilmesin</option></Select></Field><SaveButton saving={saving} /></form>;
}

function BatchForm({ form, setForm, markets, products, onSubmit, saving }) {
  return <form onSubmit={onSubmit} className="grid grid-cols-1 items-end gap-4 md:grid-cols-2 xl:grid-cols-6"><Field label="Şube"><Select required value={form.market_id} onChange={(e) => setForm({ ...form, market_id: e.target.value })}><option value="">Seç</option>{markets.map((m) => <option key={m.market_id} value={m.market_id}>{m.name}</option>)}</Select></Field><Field label="Ürün"><Select required value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}><option value="">Seç</option>{products.map((p) => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}</Select></Field><Field label="Miktar"><Input required type="number" min="1" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} /></Field><Field label="Geliş tarihi"><Input type="date" value={form.received_date} onChange={(e) => setForm({ ...form, received_date: e.target.value })} /></Field><Field label="SKT"><Input type="date" value={form.expiry_date} onChange={(e) => setForm({ ...form, expiry_date: e.target.value })} /></Field><SaveButton saving={saving} /></form>;
}

function Field({ label, children }) {
  return <label className="space-y-2"><span className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</span>{children}</label>;
}

function StockTable({ rows }) {
  return <div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead className="border-b border-slate-100 bg-slate-50/80"><tr><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Ürün</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Kategori</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Şube</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Miktar</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Minimum</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Durum</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((stock, index) => <tr key={`${stock.stock_id || index}`} className="transition hover:bg-blue-50/35"><td className="p-5 font-black text-slate-950">{stock.product_name}</td><td className="p-5 font-semibold text-slate-600">{stock.category || '-'}</td><td className="p-5"><div className="font-black text-slate-800">{stock.market_name}</div><div className="text-xs font-semibold text-slate-400">{stock.city || '-'}</div></td><td className="p-5 text-lg font-black text-slate-950">{sayiFormatla(stock.quantity)}</td><td className="p-5 font-bold text-slate-600">{sayiFormatla(stock.min_stock_level)}</td><td className="p-5"><span className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${stokDurumClass(stock.status)}`}>{stokDurumLabel(stock.status)}</span></td></tr>)}{rows.length === 0 && <tr><td colSpan="6" className="p-10 text-center font-semibold text-slate-500">Kayıt bulunamadı.</td></tr>}</tbody></table></div>;
}

function BatchTable({ rows }) {
  return <div className="overflow-x-auto"><table className="w-full border-collapse text-left"><thead className="border-b border-slate-100 bg-slate-50/80"><tr><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Ürün</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Şube</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Lot</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Kalan</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">SKT</th><th className="p-5 text-xs font-black uppercase tracking-wider text-slate-400">Durum</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((batch) => <tr key={batch.batch_id} className="transition hover:bg-blue-50/35"><td className="p-5 font-black text-slate-950">{batch.product_name}</td><td className="p-5 font-bold text-slate-700">{batch.market_name}</td><td className="p-5 text-sm font-semibold text-slate-500">{batch.lot_code}</td><td className="p-5 font-black text-slate-950">{sayiFormatla(batch.remaining_quantity)}</td><td className="p-5"><div className="font-black text-slate-800">{tarihFormatla(batch.expiry_date)}</div><div className="text-xs font-semibold text-slate-400">{batch.days_to_expiry} gün</div></td><td className="p-5"><span className={`rounded-full px-3 py-1.5 text-xs font-black ring-1 ${batchClass(batch.status)}`}>{batchLabel(batch.status)}</span></td></tr>)}{rows.length === 0 && <tr><td colSpan="6" className="p-10 text-center font-semibold text-slate-500">Kayıt bulunamadı.</td></tr>}</tbody></table></div>;
}
