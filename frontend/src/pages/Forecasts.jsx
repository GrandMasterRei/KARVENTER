// frontend/src/pages/Forecasts.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { Line } from 'react-chartjs-2';
import {
  BrainCircuit,
  AlertCircle,
  Loader2,
  TrendingUp,
  PackageSearch,
  Store,
  CheckCircle2,
  RefreshCcw,
  BarChart3,
  Database
} from 'lucide-react';
import api, { cachedGet } from '../services/api';
import PageHero from '../components/PageHero';

function guvenRengi(guven) {
  const normalized = String(guven || '').toLowerCase();

  if (normalized.includes('yuksek') || normalized.includes('yüksek')) {
    return 'bg-green-100 text-green-700 border-green-200';
  }

  if (normalized.includes('orta')) {
    return 'bg-yellow-100 text-yellow-700 border-yellow-200';
  }

  return 'bg-red-100 text-red-700 border-red-200';
}

function tahminDizisiniTemizle(tahmin) {
  if (!Array.isArray(tahmin)) return [0, 0, 0, 0, 0, 0, 0];

  const temiz = tahmin.slice(0, 7).map((deger) => {
    const sayi = Number(deger);
    return Number.isFinite(sayi) ? sayi : 0;
  });

  while (temiz.length < 7) {
    temiz.push(0);
  }

  return temiz;
}

function sayiFormatla(deger) {
  const sayi = Number(deger);
  return Number.isFinite(sayi) ? sayi.toLocaleString('tr-TR') : '0';
}

export default function Forecasts() {
  const [products, setProducts] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [recentSales, setRecentSales] = useState([]);

  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedMarket, setSelectedMarket] = useState('');

  const [tahmin, setTahmin] = useState(null);
  const [listeYukleniyor, setListeYukleniyor] = useState(true);
  const [tahminYukleniyor, setTahminYukleniyor] = useState(false);
  const [error, setError] = useState('');

  const secenekleriGetir = async () => {
    try {
      setListeYukleniyor(true);
      setError('');

      const [productsResponse, marketsResponse] = await Promise.all([
        cachedGet('/api/products', { maxAgeMs: 60000 }),
        cachedGet('/api/markets?include_depots=true', { maxAgeMs: 60000 })
      ]);

      setProducts(Array.isArray(productsResponse.data) ? productsResponse.data : []);
      setMarkets(Array.isArray(marketsResponse.data) ? marketsResponse.data : []);
    } catch {
      setError('Ürün ve şube listesi alınamadı.');
    } finally {
      setListeYukleniyor(false);
    }
  };

  useEffect(() => {
    secenekleriGetir();
  }, []);

  const seciliUrun = useMemo(() => {
    return products.find((product) => String(product.product_id) === String(selectedProduct));
  }, [products, selectedProduct]);

  const seciliSube = useMemo(() => {
    return markets.find((market) => String(market.market_id) === String(selectedMarket));
  }, [markets, selectedMarket]);

  const tahminAl = async () => {
    if (!selectedProduct || !selectedMarket) {
      setError('Talep tahmini almak için ürün ve şube seç.');
      return;
    }

    try {
      setTahminYukleniyor(true);
      setTahmin(null);
      setRecentSales([]);
      setError('');

      const [forecastResponse, salesResponse] = await Promise.all([
        api.get(`/api/ai/tahmin/${selectedProduct}/${selectedMarket}`),
        api.get(`/api/sales?days=30&product_id=${selectedProduct}&market_id=${selectedMarket}&limit=1000`)
          .catch(() => ({ data: [] }))
      ]);

      setTahmin(forecastResponse.data);
      setRecentSales(Array.isArray(salesResponse.data) ? salesResponse.data : []);
    } catch {
      setError('Talep tahmini alınamadı. Backend veya AI servisini kontrol et.');
    } finally {
      setTahminYukleniyor(false);
    }
  };

  const temizTahmin = tahminDizisiniTemizle(tahmin?.tahmin);
  const toplamTahmin = temizTahmin.reduce((toplam, gunluk) => toplam + gunluk, 0);
  const ortalamaTahmin = temizTahmin.length ? toplamTahmin / temizTahmin.length : 0;

  const son30GunSatis = useMemo(() => {
    return recentSales.reduce((toplam, sale) => toplam + Number(sale.quantity || 0), 0);
  }, [recentSales]);

  const chartData = {
    labels: ['Gün 1', 'Gün 2', 'Gün 3', 'Gün 4', 'Gün 5', 'Gün 6', 'Gün 7'],
    datasets: [
      {
        label: 'Tahmin',
        data: temizTahmin,
        borderColor: '#2563eb',
        backgroundColor: '#2563eb',
        tension: 0.35,
        pointRadius: 5,
        pointHoverRadius: 7
      }
    ]
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        callbacks: {
          label: (context) => `${context.parsed.y} adet`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          precision: 0
        }
      }
    }
  };

  return (
    <div className="w-full space-y-8">
      <PageHero
        title="Talep Tahmini"
        right={<button onClick={secenekleriGetir} className="bg-white hover:bg-blue-50 text-slate-900 font-black py-3 px-5 rounded-xl transition-all flex items-center justify-center gap-2 shadow-sm"><RefreshCcw size={18} />Yenile</button>}
      />

      {error && (
        <div className="p-5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-4 text-red-700">
          <AlertCircle size={24} className="mt-1 shrink-0" />
          <div>
            <h3 className="font-black">İşlem tamamlanamadı</h3>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      <div className="bg-white p-7 rounded-2xl shadow-sm border border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-end">
          <div>
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <PackageSearch size={18} />
              Ürün
            </label>

            <select
              value={selectedProduct}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setTahmin(null);
                setRecentSales([]);
              }}
              disabled={listeYukleniyor}
              className="w-full border border-slate-200 rounded-xl p-4 font-medium text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
            >
              <option value="">Ürün seç</option>
              {products.map((product) => (
                <option key={product.product_id} value={product.product_id}>
                  {product.product_name} {product.category ? `(${product.category})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Store size={18} />
              Şube
            </label>

            <select
              value={selectedMarket}
              onChange={(e) => {
                setSelectedMarket(e.target.value);
                setTahmin(null);
                setRecentSales([]);
              }}
              disabled={listeYukleniyor}
              className="w-full border border-slate-200 rounded-xl p-4 font-medium text-slate-700 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60"
            >
              <option value="">Şube seç</option>
              {markets.map((market) => (
                <option key={market.market_id} value={market.market_id}>
                  {market.name} {market.city ? `- ${market.city}` : ''}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={tahminAl}
            disabled={listeYukleniyor || tahminYukleniyor || !selectedProduct || !selectedMarket}
            className="bg-blue-600 hover:bg-blue-700 text-white font-black py-4 px-6 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-3 shadow-lg shadow-blue-100"
          >
            {tahminYukleniyor ? (
              <>
                <Loader2 className="animate-spin" size={22} />
                Hesaplanıyor
              </>
            ) : (
              <>
                <BrainCircuit size={22} />
                Tahmin Al
              </>
            )}
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">
              Ürün
            </p>
            <p className="font-black text-slate-800">
              {seciliUrun ? seciliUrun.product_name : '-'}
            </p>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
            <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-1">
              Şube
            </p>
            <p className="font-black text-slate-800">
              {seciliSube ? seciliSube.name : '-'}
            </p>
          </div>
        </div>
      </div>

      {tahmin && (
        <div className="space-y-6">
          {tahmin.hata && (
            <div className="p-5 bg-yellow-50 border border-yellow-200 rounded-2xl flex items-start gap-4 text-yellow-800">
              <AlertCircle size={24} className="mt-1 shrink-0" />
              <div>
                <h3 className="font-black">Tahmin uyarısı</h3>
                <p className="text-sm mt-1">{tahmin.hata}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 xl:grid-cols-4 md:grid-cols-2 gap-6">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <Database className="text-blue-600 w-8 h-8 mb-4" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Son 30 Gün Kayıt
              </p>
              <p className="text-3xl font-black text-slate-800 mt-1">
                {sayiFormatla(recentSales.length)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <BarChart3 className="text-emerald-600 w-8 h-8 mb-4" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Son 30 Gün Satış
              </p>
              <p className="text-3xl font-black text-slate-800 mt-1">
                {sayiFormatla(son30GunSatis)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <TrendingUp className="text-indigo-600 w-8 h-8 mb-4" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                7 Gün Tahmin
              </p>
              <p className="text-3xl font-black text-slate-800 mt-1">
                {sayiFormatla(toplamTahmin)}
              </p>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <CheckCircle2 className="text-amber-600 w-8 h-8 mb-4" />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Güven
              </p>
              <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black border mt-2 ${guvenRengi(tahmin.guven)}`}>
                {tahmin.guven || 'belirsiz'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            <div className="xl:col-span-2 bg-white p-7 rounded-2xl shadow-sm border border-slate-200 h-[400px]">
              <div className="mb-5">
                <h3 className="text-lg font-black text-slate-800">
                  7 Günlük Tahmin
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Günlük beklenen satış adedi
                </p>
              </div>

              <div className="h-[295px]">
                <Line data={chartData} options={chartOptions} />
              </div>
            </div>

            <div className="bg-white p-7 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-50 p-3 rounded-xl">
                  <BrainCircuit className="text-blue-600" size={26} />
                </div>

                <div>
                  <h3 className="font-black text-slate-800">
                    Tahmin Özeti
                  </h3>
                  <p className="text-sm text-slate-500">
                    Seçilen ürün / şube
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                    Toplam
                  </p>
                  <p className="text-2xl font-black text-slate-800 mt-1">
                    {sayiFormatla(toplamTahmin)}
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200">
                  <p className="text-xs uppercase tracking-wider font-bold text-slate-400">
                    Ortalama
                  </p>
                  <p className="text-2xl font-black text-slate-800 mt-1">
                    {ortalamaTahmin.toFixed(1)}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
                <p className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-2">
                  Açıklama
                </p>
                <p className="text-slate-700 text-sm leading-relaxed">
                  {tahmin.aciklama || 'Açıklama bulunamadı.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {!tahmin && !tahminYukleniyor && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <BrainCircuit className="mx-auto text-slate-300 w-12 h-12 mb-4" />
          <h3 className="font-black text-xl text-slate-800 mb-2">
            Tahmin bekleniyor
          </h3>
          <p className="text-sm text-slate-500">
            Ürün ve şube seçerek 7 günlük talep tahmini oluştur.
          </p>
        </div>
      )}
    </div>
  );
}