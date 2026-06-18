const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { LayoutDashboard, Package, TrendingUp, LogOut, ShieldCheck, DollarSign, Activity, Zap, AlertCircle, ArrowRightLeft } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

function Login({ onLogin }) {
  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-10 text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200">
            <ShieldCheck className="w-10 h-10 text-white" />
          </div>
        </div>
        <h2 className="text-3xl font-extrabold text-slate-800 mb-2">KARVENTER</h2>
        <p className="text-slate-500 mb-8 font-medium">Stok & Kâr Optimizasyon Sistemi</p>
        <button onClick={onLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-4 rounded-xl shadow-lg transition-all text-lg">
          Sisteme Giriş Yap
        </button>
      </div>
    </div>
  );
}

function Sidebar({ onLogout }) {
  const location = useLocation();
  const menuItems = [
    { path: "/", icon: <LayoutDashboard size={22} />, label: "Dashboard" },
    { path: "/inventory", icon: <Package size={22} />, label: "Stok Yönetimi" },
    { path: "/forecasts", icon: <TrendingUp size={22} />, label: "Talep Tahminleri" },
    { path: "/transfers", icon: <ArrowRightLeft size={22} />, label: "Transfer Önerileri" },
  ];
  return (
    <div className="w-64 bg-slate-900 text-slate-300 min-h-screen flex flex-col fixed left-0 top-0 shadow-2xl z-10">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3 mt-2">
        <div className="bg-blue-600 p-2 rounded-lg">
          <ShieldCheck className="text-white w-6 h-6"/>
        </div>
        <h1 className="text-2xl font-black text-white tracking-wider">KARVENTER</h1>
      </div>
      <nav className="flex-1 p-4 space-y-2 mt-4">
        {menuItems.map((item) => (
          <Link key={item.path} to={item.path} className={`flex items-center gap-4 px-4 py-4 rounded-xl font-medium transition-all ${location.pathname === item.path ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}>
            {item.icon}<span className="text-sm uppercase tracking-wider">{item.label}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-slate-800">
        <button onClick={onLogout} className="flex items-center gap-3 px-4 py-4 w-full rounded-xl hover:bg-red-500/10 text-slate-400 hover:text-red-400 transition-colors font-bold uppercase tracking-wider text-sm">
          <LogOut size={20} />Çıkış Yap
        </button>
      </div>
    </div>
  );
}

function Dashboard() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/reports/z-report`)
      .then(res => setData(res.data))
      .catch(() => setError(true));
  }, []);

  if (error) return (
    <div className="p-8 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-4 text-red-600">
      <AlertCircle size={32} />
      <div>
        <h3 className="font-bold text-lg">Sunucu Bağlantı Hatası</h3>
        <p>Backend API'sine ulaşılamıyor.</p>
      </div>
    </div>
  );

  if (!data) return <div className="p-8 text-slate-500 font-bold text-xl animate-pulse">Gerçek Veriler Hesaplanıyor...</div>;

  const chartData = {
    labels: ['Organik Kâr', 'AI İle Optimize Kâr'],
    datasets: [{
      label: 'Kârlılık Analizi (₺)',
      data: [data.financials.organik_kar || 0, data.financials.optimize_kar || 0],
      backgroundColor: ['#94a3b8', '#2563eb'],
      borderRadius: 8,
    }]
  };

  return (
    <div className="w-full">
      <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">Sistem Performans Özeti</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Organik Kâr</h3>
            <p className="text-3xl font-black text-slate-700">{(data.financials.organik_kar || 0).toLocaleString()} ₺</p>
          </div>
          <div className="bg-slate-100 p-4 rounded-full"><DollarSign className="text-slate-500 w-8 h-8"/></div>
        </div>
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 flex items-center justify-between border-l-4 border-l-blue-500">
          <div>
            <h3 className="text-sm font-bold text-blue-500 uppercase tracking-wider mb-2">Optimize Kâr (AI)</h3>
            <p className="text-3xl font-black text-slate-800">{(data.financials.optimize_kar || 0).toLocaleString()} ₺</p>
          </div>
          <div className="bg-blue-50 p-4 rounded-full"><Activity className="text-blue-500 w-8 h-8"/></div>
        </div>
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-2xl shadow-lg shadow-blue-200 flex items-center justify-between text-white">
          <div>
            <h3 className="text-sm font-bold text-blue-200 uppercase tracking-wider mb-2">Net AI Kazancı</h3>
            <p className="text-4xl font-black">+{(data.financials.net_ai_kazanci || 0).toLocaleString()} ₺</p>
          </div>
          <div className="bg-white/20 p-4 rounded-full"><Zap className="text-white w-8 h-8"/></div>
        </div>
      </div>
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 w-full" style={{ height: '400px' }}>
        <h3 className="text-lg font-bold text-slate-800 mb-6">Yapay Zeka Kârlılık Artış Grafiği</h3>
        <Bar data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
      </div>
    </div>
  );
}

function Inventory() {
  const [stocks, setStocks] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/stocks`)
      .then(res => setStocks(res.data.data || []))
      .catch(() => setError(true));
  }, []);

  if (error) return <div className="p-8 text-red-500 font-bold">Stok verileri çekilemedi.</div>;

  return (
    <div className="w-full">
      <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">Gerçek Zamanlı Stok Durumu</h2>
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              <th className="p-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Ürün Adı</th>
              <th className="p-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Şube / Lokasyon</th>
              <th className="p-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Miktar</th>
              <th className="p-5 text-sm font-bold text-slate-500 uppercase tracking-wider">Sistem Analizi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stocks.map((s, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                <td className="p-5 font-bold text-slate-800">{s.product_name}</td>
                <td className="p-5 text-slate-600 font-medium">{s.market_name}</td>
                <td className="p-5 text-slate-800 font-black text-lg">{s.quantity}</td>
                <td className="p-5">
                  <span className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider ${
                    s.status === 'Kritik' ? 'bg-red-100 text-red-700 border border-red-200' :
                    s.status === 'Fazla Stok' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                    'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>{s.status}</span>
                </td>
              </tr>
            ))}
            {stocks.length === 0 && (
              <tr><td colSpan="4" className="p-8 text-center text-slate-400">Henüz stok kaydı bulunmuyor.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Forecasts() {
  const [products, setProducts] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('');
  const [tahmin, setTahmin] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios.get(`${API_URL}/api/products`).then(res => setProducts(res.data));
    axios.get(`${API_URL}/api/markets`).then(res => setMarkets(res.data));
  }, []);

  const tahminAl = () => {
    if (!selectedProduct || !selectedMarket) return;
    setLoading(true);
    setTahmin(null);
    axios.get(`${API_URL}/api/ai/tahmin/${selectedProduct}/${selectedMarket}`)
      .then(res => { setTahmin(res.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  const chartData = tahmin ? {
    labels: ['Gün 1', 'Gün 2', 'Gün 3', 'Gün 4', 'Gün 5', 'Gün 6', 'Gün 7'],
    datasets: [{
      label: '7 Günlük Talep Tahmini',
      data: tahmin.tahmin || [],
      borderColor: '#2563eb',
      backgroundColor: 'rgba(37,99,235,0.1)',
      tension: 0.4,
      fill: true,
    }]
  } : null;

  return (
    <div className="w-full">
      <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">Yapay Zeka Talep Tahmin Motoru</h2>
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div>
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 block">Ürün Seç</label>
            <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 font-medium text-slate-700">
              <option value="">-- Ürün --</option>
              {products.map(p => <option key={p.product_id} value={p.product_id}>{p.product_name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 block">Şube Seç</label>
            <select value={selectedMarket} onChange={e => setSelectedMarket(e.target.value)}
              className="w-full border border-slate-200 rounded-xl p-3 font-medium text-slate-700">
              <option value="">-- Şube --</option>
              {markets.map(m => <option key={m.market_id} value={m.market_id}>{m.name}</option>)}
            </select>
          </div>
          <button onClick={tahminAl} disabled={loading}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all disabled:opacity-50">
            {loading ? 'AI Hesaplıyor...' : 'Tahmin Al'}
          </button>
        </div>
      </div>

      {tahmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="md:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-slate-200" style={{ height: '300px' }}>
            <Line data={chartData} options={{ responsive: true, maintainAspectRatio: false }} />
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <h3 className="font-bold text-slate-500 uppercase text-sm mb-4">AI Analizi</h3>
            <div className={`inline-block px-4 py-2 rounded-full text-sm font-bold mb-4 ${
              tahmin.guven === 'yuksek' ? 'bg-green-100 text-green-700' :
              tahmin.guven === 'orta' ? 'bg-yellow-100 text-yellow-700' :
              'bg-red-100 text-red-700'
            }`}>Güven: {tahmin.guven}</div>
            <p className="text-slate-600 text-sm">{tahmin.aciklama}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Transfers() {
  const [oneriler, setOneriler] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toplamKar, setToplamKar] = useState(0);

  useEffect(() => {
    axios.get(`${API_URL}/api/transfers/suggestions`)
      .then(res => {
        setOneriler(res.data.ai_oneriler || []);
        setToplamKar(res.data.toplam_kurtarilan_kar || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="p-8 text-slate-500 font-bold animate-pulse">AI Transfer Analizi Yapılıyor...</div>;

  return (
    <div className="w-full">
      <h2 className="text-3xl font-black text-slate-800 mb-4 tracking-tight">AI Transfer Önerileri</h2>
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-6 rounded-2xl text-white mb-8 flex items-center justify-between">
        <div>
          <p className="text-blue-200 text-sm font-bold uppercase tracking-wider mb-1">Tahmini Kurtarılan Kâr</p>
          <p className="text-4xl font-black">+{toplamKar.toLocaleString()} ₺</p>
        </div>
        <Zap className="w-12 h-12 text-white/50" />
      </div>
      <div className="space-y-4">
        {oneriler.map((o, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-black text-slate-800 text-lg">{o.urun || o.product}</h3>
              <span className="bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm font-bold">
                {o.miktar} adet
              </span>
            </div>
            <div className="flex items-center gap-3 text-slate-600 mb-3">
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg text-sm font-bold">{o.kaynak_sube}</span>
              <ArrowRightLeft size={16} />
              <span className="bg-green-100 text-green-700 px-3 py-1 rounded-lg text-sm font-bold">{o.hedef_sube}</span>
            </div>
            <p className="text-slate-500 text-sm">{o.aciklama}</p>
            {o.kurtarilan_kar_tahmini > 0 && (
              <p className="text-green-600 font-bold text-sm mt-2">+{o.kurtarilan_kar_tahmini} ₺ kurtarılacak</p>
            )}
          </div>
        ))}
        {oneriler.length === 0 && (
          <div className="bg-slate-100 p-10 rounded-2xl text-center text-slate-500">
            Şu an transfer önerisi bulunmuyor. Stok verileri yeterli olmayabilir.
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [isAuth, setIsAuth] = useState(false);
  if (!isAuth) return <Login onLogin={() => setIsAuth(true)} />;
  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50 font-sans">
        <Sidebar onLogout={() => setIsAuth(false)} />
        <main className="flex-1 ml-64 p-10 overflow-x-hidden">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/forecasts" element={<Forecasts />} />
            <Route path="/transfers" element={<Transfers />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}