import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { LayoutDashboard, Package, TrendingUp, LogOut, ShieldCheck, Search, Filter, AlertCircle } from 'lucide-react';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// --- 1. GİRİŞ (LOGIN) EKRANI ---
function Login({ onLogin }) {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 border border-slate-100">
        <div className="flex justify-center mb-6">
          <div className="bg-blue-600 p-3 rounded-xl shadow-lg shadow-blue-200">
            <ShieldCheck className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-2">KARVENTER'a Giriş Yap</h2>
        <p className="text-center text-slate-500 mb-8 text-sm">Yapay Zeka Destekli Optimizasyon Merkezi</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">E-posta</label>
            <input type="email" defaultValue="admin@karventer.com" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Şifre</label>
            <input type="password" defaultValue="password" className="w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all" />
          </div>
          <button onClick={onLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors mt-2 shadow-lg shadow-blue-200">
            Sisteme Giriş
          </button>
        </div>
      </div>
    </div>
  );
}

// --- 2. SOL MENÜ (SIDEBAR) BİLEŞENİ ---
function Sidebar({ onLogout }) {
  const location = useLocation();
  
  const menuItems = [
    { path: "/", icon: <LayoutDashboard size={20} />, label: "Dashboard" },
    { path: "/inventory", icon: <Package size={20} />, label: "Stok Yönetimi" },
    { path: "/forecasts", icon: <TrendingUp size={20} />, label: "Talep Tahminleri" },
  ];

  return (
    <div className="w-64 bg-slate-900 text-slate-300 min-h-screen flex flex-col shadow-2xl fixed left-0 top-0">
      <div className="p-6 border-b border-slate-800 flex items-center gap-3">
        <div className="bg-blue-600 p-2 rounded-lg">
          <ShieldCheck className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-xl font-bold text-white tracking-wide">KARVENTER</h1>
      </div>
      
      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <Link key={item.path} to={item.path} 
              className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${isActive ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'hover:bg-slate-800 hover:text-white'}`}>
              {item.icon}
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <button onClick={onLogout} className="flex items-center gap-3 px-4 py-3 w-full rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-colors">
          <LogOut size={20} />
          <span className="font-medium">Çıkış Yap</span>
        </button>
      </div>
    </div>
  );
}

// --- 3. ANA EKRAN (DASHBOARD) ---
function Dashboard() {
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const response = await axios.get('http://localhost:8000/api/reports/z-report');
      setReportData(response.data);
    } catch (error) {
      console.error("Veri çekme hatası:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, []);

  if (loading || !reportData) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Veritabanındaki 'string' isimli kirliliği filtreliyoruz
  const cleanRecommendations = reportData.ai_transfer_recommendations.filter(
    (rec) => rec.product_name !== "string" && rec.product_name !== "string"
  );

  const chartData = {
    labels: ['Organik Kâr', 'Optimize Kâr'],
    datasets: [{
      label: 'Haftalık Kâr (TL)',
      data: [reportData.financials.total_organic_profit, reportData.financials.total_optimized_profit],
      backgroundColor: ['#94a3b8', '#3b82f6'],
      borderRadius: 8,
    }],
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Sistem Özeti</h2>
          <p className="text-slate-500">Gerçek Zamanlı AI Optimizasyon Verileri</p>
        </div>
        <button onClick={fetchReport} className="bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 px-5 py-2.5 rounded-xl font-semibold transition-all shadow-sm">
          Verileri Yenile
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Organik Kâr</h3>
          <p className="text-3xl font-bold text-slate-700">{reportData.financials.total_organic_profit.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><TrendingUp size={64} /></div>
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-2">Optimize Kâr</h3>
          <p className="text-3xl font-bold text-blue-600">{reportData.financials.total_optimized_profit.toLocaleString('tr-TR')} ₺</p>
        </div>
        <div className="bg-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-200 text-white relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-white opacity-10 rounded-full -mr-10 -mt-10"></div>
          <h3 className="text-sm font-bold text-blue-200 uppercase tracking-wider mb-2">Net AI Kazancı</h3>
          <p className="text-4xl font-extrabold">+{reportData.financials.net_ai_gain.toLocaleString('tr-TR')} ₺</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-6">Finansal Karşılaştırma</h2>
          <Bar data={chartData} options={{ responsive: true, plugins: { legend: { display: false } } }} />
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 flex flex-col h-[400px]">
          <div className="p-6 border-b border-slate-100">
            <h2 className="text-lg font-bold text-slate-800">Bekleyen Transfer Emirleri</h2>
          </div>
          <div className="p-6 overflow-y-auto flex-1 space-y-4">
            {cleanRecommendations.slice(0, 10).map((rec, index) => (
              <div key={index} className="flex justify-between items-center p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-colors group">
                <div>
                  <p className="font-bold text-slate-800">{rec.product_name} <span className="text-blue-600 font-semibold bg-blue-100 px-2 py-0.5 rounded-md text-xs ml-2">{rec.transfer_quantity} Adet</span></p>
                  <p className="text-xs text-slate-500 mt-1">{rec.from_market} ➔ {rec.to_market}</p>
                </div>
                <div className="text-right flex flex-col items-end gap-2">
                  <span className="text-green-600 font-bold text-sm">+{rec.expected_profit_gain.toLocaleString('tr-TR')} ₺</span>
                  <button className="bg-white border border-slate-200 text-slate-600 text-xs px-4 py-1.5 rounded-lg font-semibold group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all">
                    Onayla
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- BOŞ SAYFALAR (Yer Tutucular) ---
// --- 4. STOK YÖNETİMİ EKRANI ---
function Inventory() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('Tümü');

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/stocks');
        // String isimli test verilerini yine filtreliyoruz
        const cleanData = response.data.data.filter(s => s.product_name !== "string");
        setStocks(cleanData);
      } catch (error) {
        console.error("Stok verisi çekilemedi:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchStocks();
  }, []);

  // Arama ve Filtreleme Mantığı (Wireframe gereksinimi)
// --- 5. TALEP TAHMİNLERİ EKRANI (AI FORECAST) ---
function Forecasts() {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchForecasts = async () => {
      try {
        const response = await axios.get('http://localhost:8000/api/forecast');
        setForecasts(response.data.data);
      } catch (error) {
        console.error("Tahmin verisi çekilemedi:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchForecasts();
  }, []);

  if (loading) return <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">Yapay Zeka Talep Tahminleri</h2>
          <p className="text-slate-500">Gelecek 7 günlük satış öngörüleri ve doğruluk analizleri[cite: 358].</p>
        </div>
        <div className="bg-blue-50 border border-blue-100 p-3 rounded-xl flex items-center gap-2">
          <ShieldCheck className="text-blue-600 w-5 h-5" />
          <span className="text-blue-800 font-bold text-sm">AI Model Durumu: Aktif</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tahmin Listesi (Table) */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h3 className="font-bold text-slate-800">Ürün Bazlı Öngörüler [cite: 361]</h3>
          </div>
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-xs uppercase tracking-widest font-bold">
              <tr>
                <th className="py-4 px-6">Ürün / Şube</th>
                <th className="py-4 px-6 text-center">Tahmini Satış</th>
                <th className="py-4 px-6 text-right">Güven Aralığı</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {forecasts.map((f, i) => (
                <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                  <td className="py-4 px-6 text-slate-700">
                    <p className="font-bold">{f.product_name}</p>
                    <p className="text-xs text-slate-400">{f.market_name}</p>
                  </td>
                  <td className="py-4 px-6 text-center font-extrabold text-blue-600 text-lg">{f.predicted_sales}</td>
                  <td className="py-4 px-6 text-right font-mono text-emerald-600 font-bold">{f.confidence_score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Bilgi Kartları / AI Notları */}
        <div className="space-y-6">
          <div className="bg-gradient-to-br from-indigo-600 to-blue-700 p-6 rounded-2xl text-white shadow-lg">
            <h4 className="font-bold mb-2 flex items-center gap-2"><TrendingUp size={18}/> Akıllı Analiz</h4>
            <p className="text-sm text-indigo-100 leading-relaxed">
              Modelimiz, şubeler arası talep farkının bu hafta %12 artacağını öngörüyor. Özellikle <b>Ekmek</b> kategorisinde Batı Mini şubesine sevkiyat artırılmalıdır[cite: 28].
            </p>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h4 className="font-bold text-slate-800 mb-4">Analiz Parametreleri</h4>
            <ul className="text-sm space-y-3 text-slate-500 font-medium">
              <li className="flex justify-between"><span>Veri Penceresi:</span> <span className="text-slate-800">30 Gün</span></li>
              <li className="flex justify-between"><span>Algoritma:</span> <span className="text-slate-800">Random Forest</span></li>
              <li className="flex justify-between"><span>Son Eğitim:</span> <span className="text-slate-800">Bugün 04:00</span></li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
    const matchesSearch = stock.product_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          stock.market_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'Tümü' || stock.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return <div className="flex h-full items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">Stok Yönetimi</h2>
        <p className="text-slate-500">Tüm şubelerdeki güncel stok durumları ve kritik uyarılar.</p>
      </div>

      {/* Filtreleme Alanı */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col md:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 text-slate-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="Ürün veya Şube ara..." 
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="text-slate-400 w-5 h-5" />
          <select 
            className="py-2.5 px-4 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium text-slate-700"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="Tümü">Tüm Durumlar</option>
            <option value="Kritik">Kritik Stok</option>
            <option value="Fazla Stok">Fazla Stok</option>
            <option value="Normal">Normal</option>
          </select>
        </div>
      </div>

      {/* Stok Detay Tablosu */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="py-4 px-6 font-semibold text-slate-500 text-sm uppercase tracking-wider">Ürün Adı</th>
                <th className="py-4 px-6 font-semibold text-slate-500 text-sm uppercase tracking-wider">Kategori</th>
                <th className="py-4 px-6 font-semibold text-slate-500 text-sm uppercase tracking-wider">Lokasyon</th>
                <th className="py-4 px-6 font-semibold text-slate-500 text-sm uppercase tracking-wider">Mevcut Stok</th>
                <th className="py-4 px-6 font-semibold text-slate-500 text-sm uppercase tracking-wider">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredStocks.map((stock) => (
                <tr key={stock.stock_id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-4 px-6 font-bold text-slate-700">{stock.product_name}</td>
                  <td className="py-4 px-6 text-slate-500">
                    <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-semibold">{stock.category}</span>
                  </td>
                  <td className="py-4 px-6">
                    <p className="font-semibold text-slate-700">{stock.market_name}</p>
                    <p className="text-xs text-slate-500">{stock.city}</p>
                  </td>
                  <td className="py-4 px-6 font-bold text-slate-700">
                    {stock.quantity} <span className="text-xs font-normal text-slate-400">/ Min: {stock.min_stock_level}</span>
                  </td>
                  <td className="py-4 px-6">
                    {stock.status === 'Kritik' && <span className="flex items-center gap-1 text-red-600 bg-red-50 px-3 py-1 rounded-lg font-bold text-sm w-max"><AlertCircle w={14} h={14}/> Kritik</span>}
                    {stock.status === 'Fazla Stok' && <span className="text-amber-600 bg-amber-50 px-3 py-1 rounded-lg font-bold text-sm w-max">Fazla Stok</span>}
                    {stock.status === 'Normal' && <span className="text-emerald-600 bg-emerald-50 px-3 py-1 rounded-lg font-bold text-sm w-max">Normal</span>}
                  </td>
                </tr>
              ))}
              {filteredStocks.length === 0 && (
                <tr>
                  <td colSpan="5" className="py-8 text-center text-slate-500 font-medium">Arama kriterlerine uygun stok bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
const Forecasts = () => <div className="p-8 text-slate-500 font-medium">Talep Tahmin grafikleri buraya gelecek...</div>;

// --- ANA UYGULAMA (ROUTER) ---
export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  if (!isAuthenticated) {
    return <Login onLogin={() => setIsAuthenticated(true)} />;
  }

  return (
    <Router>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar onLogout={() => setIsAuthenticated(false)} />
        <main className="flex-1 ml-64 p-8">
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