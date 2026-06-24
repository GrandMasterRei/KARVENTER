import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  LogOut,
  RefreshCcw,
  Search,
  Settings,
  UserCircle2,
  Sparkles
} from 'lucide-react';
import api, { cachedGet, extractRows } from '../services/api';


function KLogo() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-blue-700 text-white shadow-[0_10px_22px_rgba(37,99,235,0.22)]">
      <span className="text-xl font-black tracking-[-0.08em]">K</span>
    </div>
  );
}

function roleLabel(role) {
  if (role === 'admin') return 'Yönetici';
  if (role === 'staff') return 'Personel';
  return role || 'Kullanıcı';
}

function normalize(value) {
  return String(value || '')
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('ğ', 'g')
    .replaceAll('ü', 'u')
    .replaceAll('ş', 's')
    .replaceAll('ö', 'o')
    .replaceAll('ç', 'c')
    .trim();
}

function contains(row, query, fields) {
  const text = fields.map((field) => row?.[field] || '').join(' ');
  return normalize(text).includes(query);
}

function uniqueResults(results) {
  const seen = new Set();
  return results.filter((item) => {
    const key = `${item.type}-${item.path}-${item.title}-${item.subtitle}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function fallbackPath(query) {
  const q = normalize(query);
  if (q.includes('talep') || q.includes('istek') || q.includes('personel bildirimi')) return `/requests?search=${encodeURIComponent(query)}`;
  if (q.includes('transfer') || q.includes('sevkiyat') || q.includes('nakil')) return `/transfers?search=${encodeURIComponent(query)}`;
  if (q.includes('şube') || q.includes('sube') || q.includes('depo') || q.includes('market') || q.includes('şehir') || q.includes('sehir')) return `/markets?search=${encodeURIComponent(query)}`;
  if (q.includes('satış') || q.includes('satis') || q.includes('ciro') || q.includes('kar') || q.includes('kâr')) return `/sales?search=${encodeURIComponent(query)}`;
  if (q.includes('bildirim') || q.includes('uyarı') || q.includes('uyari')) return '/operations';
  return `/inventory?search=${encodeURIComponent(query)}`;
}

const PAGE_RESULTS = [
  { type: 'Sayfa', title: 'Stok Yönetimi', subtitle: 'Ürün, barkod, kategori ve şube stokları', path: '/inventory', keywords: 'stok ürün urun barkod kategori kritik fazla depo' },
  { type: 'Sayfa', title: 'Satış Yönetimi', subtitle: 'Satış, ciro ve kâr kayıtları', path: '/sales', keywords: 'satış satis ciro kar kâr gelir fatura' },
  { type: 'Sayfa', title: 'Transfer Yönetimi', subtitle: 'Şube ve depo transfer akışı', path: '/transfers', keywords: 'transfer sevkiyat nakil depo onay bekleyen' },
  { type: 'Sayfa', title: 'Talepler', subtitle: 'Personel talepleri ve durum takibi', path: '/requests', keywords: 'talep taleplerim personel isteği stok talebi durum takip' },
  { type: 'Sayfa', title: 'Lokasyon Yönetimi', subtitle: 'Şube ve depo kayıtları', path: '/markets', keywords: 'şube sube şehir sehir market depo lokasyon' },
  { type: 'Sayfa', title: 'Operasyon ve Bildirimler', subtitle: 'Canlı uyarılar ve işlem geçmişi', path: '/operations', keywords: 'bildirim uyarı uyari işlem islem geçmiş gecmis personel' },
  { type: 'Sayfa', title: 'KARVAI', subtitle: 'KARVENTER AI asistan', path: '/assistant', keywords: 'ai asistan karvai yapay zeka optimizasyon' }
];

export default function Topbar({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isAdmin = user?.rol === 'admin';
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [alertCount, setAlertCount] = useState(0);
  const searchRef = useRef(null);

  const loadAlertCount = async () => {
    try {
      const response = await api.get('/api/alerts/count');
      setAlertCount(Number(response.data?.open_count || 0));
    } catch {
      setAlertCount(0);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => loadAlertCount(), 0);
    const handler = () => loadAlertCount();
    window.addEventListener('karventer:refresh', handler);
    window.addEventListener('karventer:refresh-alert-count', handler);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('karventer:refresh', handler);
      window.removeEventListener('karventer:refresh-alert-count', handler);
    };
  }, []);

  useEffect(() => {
    const handler = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    const query = normalize(search);
    if (query.length < 2) {
      setSearchResults([]);
      setSearching(false);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      try {
        setSearching(true);
        const [stocksRes, marketsRes, transfersRes, alertsRes, salesRes] = await Promise.all([
          cachedGet('/api/stocks?include_depots=true&limit=300', { maxAgeMs: 30000 }).catch(() => ({ data: { data: [] } })),
          cachedGet('/api/markets?include_depots=true&limit=120', { maxAgeMs: 60000 }).catch(() => ({ data: { data: [] } })),
          cachedGet('/api/transfers?limit=120', { maxAgeMs: 20000 }).catch(() => ({ data: { data: [] } })),
          cachedGet('/api/alerts?status=open&limit=120', { maxAgeMs: 20000 }).catch(() => ({ data: { data: [] } })),
          cachedGet('/api/sales?limit=120', { maxAgeMs: 30000 }).catch(() => ({ data: { data: [] } }))
        ]);

        const results = PAGE_RESULTS
          .filter((item) => normalize(`${item.title} ${item.subtitle} ${item.keywords}`).includes(query))
          .map((item) => ({ ...item, path: item.path.includes('?') ? item.path : `${item.path}?search=${encodeURIComponent(search)}` }));
        extractRows(stocksRes).forEach((row) => {
          if (contains(row, query, ['product_name', 'urun_adi', 'market_name', 'sube_adi', 'category', 'barcode'])) {
            results.push({
              type: 'Stok',
              title: row.product_name || row.urun_adi || 'Stok kaydı',
              subtitle: row.market_name || row.sube_adi || row.category || '',
              path: `/inventory?search=${encodeURIComponent(search)}`
            });
          }
        });

        extractRows(marketsRes).forEach((row) => {
          if (contains(row, query, ['name', 'market_name', 'city', 'district', 'type'])) {
            const id = row.market_id || row.id;
            results.push({
              type: row.is_depot || row.type === 'warehouse' || normalize(row.name).includes('depo') ? 'Depo' : 'Şube',
              title: row.name || row.market_name || 'Şube',
              subtitle: [row.city, row.district].filter(Boolean).join(' / '),
              path: id ? `/market/${id}` : `/markets?search=${encodeURIComponent(search)}`
            });
          }
        });

        extractRows(transfersRes).forEach((row) => {
          if (contains(row, query, ['product_name', 'source_market_name', 'target_market_name', 'status'])) {
            results.push({
              type: 'Transfer',
              title: row.product_name || 'Transfer',
              subtitle: `${row.source_market_name || '-'} → ${row.target_market_name || '-'}`,
              path: `/transfers?search=${encodeURIComponent(search)}`
            });
          }
        });

        extractRows(alertsRes).forEach((row) => {
          if (contains(row, query, ['title', 'message', 'product_name', 'market_name', 'alert_type'])) {
            const isRequest = row.alert_type === 'staff_request' || normalize(`${row.title || ''} ${row.message || ''}`).includes('talep');
            results.push({
              type: isRequest ? 'Talep' : 'Bildirim',
              title: row.title || row.product_name || 'Bildirim',
              subtitle: row.market_name || row.message || '',
              path: isRequest ? `/requests?alert_id=${row.alert_id}` : '/operations'
            });
          }
        });

        extractRows(salesRes).forEach((row) => {
          if (contains(row, query, ['product_name', 'market_name', 'category', 'sale_date'])) {
            results.push({
              type: 'Satış',
              title: row.product_name || 'Satış kaydı',
              subtitle: row.market_name || row.category || '',
              path: `/sales?search=${encodeURIComponent(search)}`
            });
          }
        });

        setSearchResults(uniqueResults(results));
        setSearchOpen(true);
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => window.clearTimeout(timer);
  }, [search]);

  const hasQuery = search.trim().length >= 2;
  const shownResults = useMemo(() => searchResults, [searchResults]);

  const goToResult = (path) => {
    navigate(path);
    setSearchOpen(false);
    setSearch('');
  };

  const handleRefresh = () => {
    window.dispatchEvent(new CustomEvent('karventer:refresh-cache-clear'));
    window.dispatchEvent(new CustomEvent('karventer:refresh'));
    window.dispatchEvent(new CustomEvent('karventer:refresh-alert-count'));
  };

  const submitSearch = (event) => {
    event.preventDefault();
    const q = search.trim();
    if (!q) return;
    const first = shownResults[0];
    goToResult(first?.path || fallbackPath(q));
  };

  const openNotifications = () => {
    window.dispatchEvent(new CustomEvent('karventer:open-alerts'));
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-40 h-[72px] border-b border-slate-200 bg-white/92 shadow-[0_10px_30px_rgba(15,23,42,0.04)] backdrop-blur-xl">
      <div className="flex h-full items-center">
        <div className="flex h-full w-auto items-center gap-3 border-r border-slate-200 px-4 sm:px-6 lg:w-[240px]">
          <KLogo />
          <div className="text-xl font-black tracking-[-0.04em] text-blue-700">KARVENTER</div>
        </div>

        <div className="flex h-full flex-1 items-center justify-end gap-5 px-3 sm:px-5 lg:justify-between">
          <form ref={searchRef} onSubmit={submitSearch} className="relative hidden h-11 w-[420px] max-w-[38vw] items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-slate-400 transition-all focus-within:border-blue-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-50 lg:flex">
            <Search size={18} />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Ürün, şube, depo, satış veya transfer ara"
              className="h-full w-full bg-transparent text-sm font-semibold text-slate-700 outline-none placeholder:text-slate-400"
            />

            {searchOpen && hasQuery && (
              <div className="absolute left-0 right-0 top-[52px] z-50 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/80">
                {searching && <div className="p-4 text-sm font-black text-slate-400">Aranıyor...</div>}
                {!searching && shownResults.length > 0 && shownResults.map((item) => (
                  <button
                    key={`${item.type}-${item.path}-${item.title}-${item.subtitle}`}
                    type="button"
                    onClick={() => goToResult(item.path)}
                    className="flex w-full items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 text-left last:border-b-0 hover:bg-blue-50"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-black text-slate-900">{item.title}</div>
                      <div className="truncate text-xs font-bold text-slate-500">{item.subtitle}</div>
                    </div>
                    <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">{item.type}</span>
                  </button>
                ))}
                {!searching && shownResults.length === 0 && (
                  <button type="button" onClick={() => goToResult(fallbackPath(search))} className="w-full px-4 py-4 text-left text-sm font-black text-slate-700 hover:bg-blue-50">
                    İlgili sayfada ara
                  </button>
                )}
              </div>
            )}
          </form>

          <div className="flex shrink-0 items-center gap-2.5">
            <button type="button" onClick={handleRefresh} title="Yenile" className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"><RefreshCcw size={18} /></button>
            <button type="button" className="relative flex h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700" onClick={openNotifications} title="Bildirimleri aç">
              <Bell size={18} /><span className="hidden lg:inline">Bildirimler</span>
              {alertCount > 0 && <span className="absolute -right-1.5 -top-1.5 min-w-[22px] rounded-full bg-red-600 px-1.5 py-0.5 text-center text-[10px] font-black leading-none text-white ring-2 ring-white">{alertCount > 99 ? '99+' : alertCount}</span>}
            </button>
            <Link to="/assistant" className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-black transition-all hover:-translate-y-0.5 ${location.pathname.startsWith('/assistant') ? 'border-blue-700 bg-blue-700 text-white shadow-[0_12px_24px_rgba(37,99,235,0.22)]' : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'}`}><Sparkles size={17} /><span className="hidden lg:inline">Asistan</span></Link>
            {isAdmin && <Link to="/management" className={`flex h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-black transition-all hover:-translate-y-0.5 ${location.pathname.startsWith('/management') ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700'}`}><Settings size={17} /><span className="hidden lg:inline">Yönetim</span></Link>}
            <div className="flex h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4"><UserCircle2 size={22} className="text-slate-500" /><div className="hidden leading-tight lg:block"><div className="text-sm font-black text-slate-800">{user?.kullanici_adi || 'Kullanıcı'}</div><div className="text-[11px] font-bold text-slate-400">{roleLabel(user?.rol)}</div></div></div>
            <button type="button" onClick={onLogout} className="flex h-11 items-center gap-2 rounded-2xl bg-slate-950 px-4 text-sm font-black text-white transition-all hover:-translate-y-0.5 hover:bg-slate-800"><LogOut size={17} /><span className="hidden lg:inline">Çıkış</span></button>
          </div>
        </div>
      </div>
    </header>
  );
}
