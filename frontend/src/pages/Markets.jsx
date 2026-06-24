// frontend/src/pages/Markets.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  ArrowRightLeft,
  Loader2,
  MapPin,
  Package,
  Search,
  ShieldAlert,
  Store
} from 'lucide-react';
import api, { cachedGet, extractRows } from '../services/api';
import PageHero from '../components/PageHero';

function sayiFormatla(v) { const n = Number(v); return Number.isFinite(n) ? n.toLocaleString('tr-TR') : '0'; }
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

export default function Markets() {
  const location = useLocation();
  const [markets, setMarkets] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [risks, setRisks] = useState([]);
  const [search, setSearch] = useState(new URLSearchParams(location.search).get('search') || '');
  const [selectedCity, setSelectedCity] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const loadMarkets = async (force = false) => {
    try {
      if (markets.length === 0) setLoading(true); setError('');
      const [marketsResponse, stocksResponse, transfersResponse, risksResponse] = await Promise.all([
        cachedGet('/api/markets?include_depots=true', { maxAgeMs: 60000, force }),
        cachedGet('/api/stocks?include_depots=true', { maxAgeMs: 45000, force }).catch(() => ({ data: { data: [] } })),
        cachedGet('/api/transfers?limit=120', { maxAgeMs: 20000, force }).catch(() => ({ data: { data: [] } })),
        cachedGet('/api/stock-batches/expiry-risks?days=14', { maxAgeMs: 45000, force }).catch(() => ({ data: { data: [] } }))
      ]);
      setMarkets(extractRows(marketsResponse));
      setStocks(extractRows(stocksResponse));
      setTransfers(extractRows(transfersResponse));
      setRisks(extractRows(risksResponse));
    } catch { setError('Şube listesi alınamadı.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadMarkets(); }, []);
  useEffect(() => { setSearch(new URLSearchParams(location.search).get('search') || ''); }, [location.search]);
  useEffect(() => { const handler = () => loadMarkets(true); window.addEventListener('karventer:refresh', handler); return () => window.removeEventListener('karventer:refresh', handler); }, []);

  const cities = useMemo(() => {
    return [...new Set(markets.map((m) => m.city).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
  }, [markets]);

  const citySummary = cities.length;
  const depoCount = markets.filter((m) => m.is_depot || String(m.type || m.market_type || m.name || '').toLocaleLowerCase('tr-TR').includes('depo') || String(m.type || m.market_type || '').toLocaleLowerCase('tr-TR').includes('warehouse')).length;

  const filteredMarkets = useMemo(() => {
    const needle = normalizeText(search);
    return markets.filter((market) => {
      const text = normalizeText(`${market.name || ''} ${market.city || ''}`);
      if (selectedCity && market.city !== selectedCity) return false;
      if (needle && !text.includes(needle)) return false;
      return true;
    });
  }, [markets, search, selectedCity]);

  const metrics = useMemo(() => {
    const map = new Map();
    markets.forEach((market) => {
      const marketStocks = stocks.filter((s) => Number(s.market_id) === Number(market.market_id));
      const totalStock = marketStocks.reduce((sum, s) => sum + Number(s.quantity || 0), 0);
      const criticalCount = marketStocks.filter((s) => s.status === 'Kritik').length;
      const relatedTransfers = transfers.filter((t) => Number(t.source_market_id) === Number(market.market_id) || Number(t.target_market_id) === Number(market.market_id));
      const riskQty = risks.filter((r) => Number(r.market_id) === Number(market.market_id)).reduce((sum, r) => sum + Number(r.remaining_quantity || 0), 0);
      map.set(market.market_id, { totalStock, criticalCount, transferCount: relatedTransfers.length, riskQty, stockRecord: marketStocks.length });
    });
    return map;
  }, [markets, stocks, transfers, risks]);

  return (
    <div className="space-y-7">
      {error && <div className="p-5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4 text-red-700"><AlertCircle size={24} /><div><h3 className="font-black">Şube verisi alınamadı</h3><p className="text-sm mt-1">{error}</p></div></div>}

      <PageHero
        title="Lokasyon Yönetimi"
        metrics={[{ label: 'Şube', value: markets.length - depoCount }, { label: 'Depo', value: depoCount }, { label: 'Şehir', value: citySummary }]}
      />

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
        <div className="flex flex-col xl:flex-row gap-3 xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-[460px]"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Şube, depo veya şehir ara" className="h-11 w-full pl-10 pr-4 rounded-2xl border border-slate-200 bg-white text-sm font-semibold" /></div>
          <select value={selectedCity} onChange={(e) => setSelectedCity(e.target.value)} className="h-11 px-4 rounded-2xl border border-slate-200 bg-white text-sm font-black text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100">
            <option value="">Tüm Şehirler</option>
            {cities.map((city) => <option key={city} value={city}>{city}</option>)}
          </select>
        </div>
      </section>

      {loading ? <div className="grid grid-cols-1 md:grid-cols-3 gap-5">{[1,2,3,4,5,6].map((i) => <div key={i} className="h-64 rounded-3xl bg-white border border-slate-200 animate-pulse" />)}</div> : (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredMarkets.map((market) => {
            const metric = metrics.get(market.market_id) || {};
            const isWarehouse = String(market.is_depot ? 'depo' : (market.type || market.market_type || market.name || '')).toLocaleLowerCase('tr-TR').includes('depo') || String(market.type || market.market_type || '').toLocaleLowerCase('tr-TR').includes('warehouse');
            return <button key={market.market_id} type="button" onClick={() => navigate(`/market/${market.market_id}`)} className="text-left bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:shadow-xl hover:border-blue-200 transition-all group"><div className="flex justify-between items-start mb-5"><div className="bg-blue-50 p-3 rounded-2xl text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors"><Store size={28} /></div><div className="flex items-center gap-2"><span className={`rounded-full px-3 py-1 text-xs font-black ${isWarehouse ? 'bg-slate-100 text-slate-700' : 'bg-blue-50 text-blue-700'}`}>{isWarehouse ? 'Depo' : 'Şube'}</span><ArrowRight className="text-slate-300 group-hover:text-blue-600 transition-colors" /></div></div><h3 className="text-xl font-black text-slate-900 mb-2">{market.name}</h3><p className="text-slate-500 font-semibold flex items-center gap-2 mb-5"><MapPin size={16} />{market.city || 'Lokasyon belirtilmemiş'}</p><div className="grid grid-cols-2 gap-2"><SmallStat icon={<Package size={18} />} label="Stok" value={sayiFormatla(metric.totalStock || 0)} /><SmallStat danger icon={<AlertCircle size={18} />} label="Stok Eksiği" value={sayiFormatla(metric.criticalCount || 0)} /><SmallStat amber icon={<ShieldAlert size={18} />} label="SKT Riski" value={sayiFormatla(metric.riskQty || 0)} /><SmallStat blue icon={<ArrowRightLeft size={18} />} label="Transfer" value={sayiFormatla(metric.transferCount || 0)} /></div></button>;
          })}
          {filteredMarkets.length === 0 && <div className="md:col-span-3 p-12 text-center text-slate-500 bg-white rounded-3xl border border-slate-200"><Store className="mx-auto text-slate-400 w-10 h-10 mb-4" /><h3 className="font-black text-xl text-slate-900 mb-2">Şube bulunamadı</h3></div>}
        </section>
      )}
    </div>
  );
}

function Metric({ icon, label, value, blue }) { return <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm"><div className={`h-11 w-11 rounded-xl flex items-center justify-center mb-4 ${blue ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-600'}`}>{icon}</div><p className="text-xs font-black uppercase tracking-wider text-slate-400">{label}</p><p className="text-3xl font-black text-slate-900 mt-1">{value}</p></div>; }
function SmallStat({ icon, label, value, danger, amber, blue }) { const cls = danger ? 'bg-red-50 border-red-100 text-red-700' : amber ? 'bg-amber-50 border-amber-100 text-amber-700' : blue ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-slate-50 border-slate-100 text-slate-700'; return <div className={`rounded-2xl p-3 border ${cls}`}>{React.cloneElement(icon, { className: 'mb-2' })}<p className="text-xs font-bold opacity-80">{label}</p><p className="font-black">{value}</p></div>; }
