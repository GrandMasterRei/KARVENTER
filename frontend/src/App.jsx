import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { LayoutDashboard, Package, TrendingUp, LogOut, ShieldCheck, DollarSign, Activity, Zap, AlertCircle } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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
    axios.get('http://localhost:8000/api/reports/z-report')
      .then(res => setData(res.data))
      .catch(err => {
        console.error(err);
        setError(true);
      });
  }, []);

  if (error) {
    return (
      <div className="p-8 bg-red-50 border border-red-200 rounded-2xl flex items-center gap-4 text-red-600">
        <AlertCircle size={32} />
        <div>
          <h3 className="font-bold text-lg">Sunucu Bağlantı Hatası</h3>
          <p>Backend API'sine ulaşılamıyor. Lütfen Docker konteynerlerini kontrol edin.</p>
        </div>
      </div>
    );
  }

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

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'top' }, title: { display: false } }
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
        <Bar data={chartData} options={chartOptions} />
      </div>
    </div>
  );
}

function Inventory() {
  const [stocks, setStocks] = useState([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    axios.get('http://localhost:8000/api/stocks')
      .then(res => setStocks(res.data.data || []))
      .catch(err => {
        console.error(err);
        setError(true);
      });
  }, []);
  
  if (error) {
    return <div className="p-8 text-red-500 font-bold">Stok verileri çekilemedi. API bağlantısını kontrol edin.</div>;
  }

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
                  }`}>
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
            {stocks.length === 0 && (
              <tr><td colSpan="4" className="p-8 text-center text-slate-400 font-medium">Sistemde henüz stok kaydı bulunmuyor. Veritabanına kayıt ekleyin.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Forecasts() {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('http://localhost:8000/api/forecast')
      .then(res => {
        setForecasts(res.data.data || []);
        setLoading(false);
      })
      .catch(err => {
        setLoading(false);
      });
  }, []);
  
  if (loading) return <div className="p-8 text-slate-500 font-bold text-xl animate-pulse">Yapay Zeka Modeli Verileri İşliyor...</div>;

  return (
    <div className="w-full">
      <h2 className="text-3xl font-black text-slate-800 mb-8 tracking-tight">Yapay Zeka Talep Tahmin Motoru</h2>
      
      {forecasts.length === 0 ? (
        <div className="bg-slate-100 border border-slate-200 p-10 rounded-2xl text-center">
          <TrendingUp className="w-16 h-16 text-slate-300 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-slate-600 mb-2">AI Modeli Eğitim Aşamasında</h3>
          <p className="text-slate-500">
            Vize sürümü kısıtlamaları gereği makine öğrenmesi modeli henüz aktif edilmemiştir. 
            Tahmin motoru final sürümünde devreye alınacaktır.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {forecasts.map((f, i) => (
            <div key={i} className="bg-white border border-slate-200 p-8 rounded-2xl shadow-sm hover:shadow-lg transition-shadow relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500"></div>
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-black text-xl text-slate-800">{f.product_name}</h3>
                  <p className="text-sm font-bold text-slate-400 mt-1">{f.market_name}</p>
                </div>
                <div className="bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-100">
                  <p className="text-xs font-bold text-indigo-600 tracking-wider">AI GÜVENİ: {f.confidence_score}</p>
                </div>
              </div>
              <div>
                <p className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-1">Gelecek Hafta Tahmini</p>
                <p className="text-5xl font-black text-indigo-600">{f.predicted_sales} <span className="text-xl text-slate-400 font-medium">Adet</span></p>
              </div>
            </div>
          ))}
        </div>
      )}
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
          </Routes>
        </main>
      </div>
    </Router>
  );
}