// frontend/src/pages/DataImport.jsx

import React, { useEffect, useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Download, Loader2, Database } from 'lucide-react';
import api from '../services/api';
import PageHero from '../components/PageHero';

function sayi(v) { const n = Number(v || 0); return Number.isFinite(n) ? n.toLocaleString('tr-TR') : '0'; }
function tarih(v) { if (!v) return '-'; try { return new Date(v).toLocaleString('tr-TR'); } catch { return '-'; } }
function durum(v) { if (v === 'completed') return 'Tamamlandı'; if (v === 'processing') return 'İşleniyor'; if (v === 'failed') return 'Başarısız'; return v || '-'; }
function kaynakAdi(item) {
  if (item?.source === 'realistic_retail_dataset' || item?.source === 'karventer_sales_stock_dataset' || String(item?.file_name || '').includes('karventer_real_data')) return 'KARVENTER Satış-Stok Veri Seti';
  if (item?.source === 'pos_csv') return 'POS Satış CSV';
  return item?.file_name || `Aktarım #${item?.import_id}`;
}

export default function DataImport() {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [imports, setImports] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  const loadImports = async () => {
    try {
      const res = await api.get('/api/sales/imports');
      setImports(Array.isArray(res.data) ? res.data : []);
    } catch { setImports([]); }
  };

  useEffect(() => { loadImports(); }, []);

  const buildFormData = () => {
    const form = new FormData();
    form.append('file', file);
    return form;
  };

  const handlePreview = async () => {
    if (!file) return setError('CSV dosyası seçmelisin.');
    try {
      setLoading(true); setError(''); setResult(null);
      const res = await api.post('/api/sales/import-csv/preview', buildFormData(), { headers: { 'Content-Type': 'multipart/form-data' } });
      setPreview(res.data);
    } catch (err) {
      setPreview(null);
      setError(err?.response?.data?.detail || 'CSV ön izleme alınamadı.');
    } finally { setLoading(false); }
  };

  const handleApply = async () => {
    if (!file) return setError('CSV dosyası seçmelisin.');
    try {
      setApplying(true); setError('');
      const res = await api.post('/api/sales/import-csv/apply?source=pos_csv', buildFormData(), { headers: { 'Content-Type': 'multipart/form-data' } });
      setResult(res.data);
      setPreview(null);
      setFile(null);
      await loadImports();
    } catch (err) {
      setError(err?.response?.data?.detail || 'CSV aktarımı tamamlanamadı.');
    } finally { setApplying(false); }
  };

  const downloadTemplate = () => {
    window.open(`${api.defaults.baseURL}/api/sales/import-template`, '_blank');
  };

  return (
    <div className="space-y-7">
      <PageHero
        title="Veri Aktarımı"
        right={<button onClick={downloadTemplate} className="h-11 px-5 rounded-2xl bg-white text-slate-900 hover:bg-blue-50 font-black text-sm flex items-center gap-2 w-fit"><Download size={18} /> CSV Şablonu</button>}
      />

      {error && <Notice error text={error} />}
      {result && <Notice text={`${sayi(result.imported_rows)} satış kaydı aktarıldı, ${sayi(result.rejected_rows)} satır reddedildi.`} />}

      <section className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm p-6 space-y-6">
          <div className="border-2 border-dashed border-slate-200 rounded-3xl p-8 bg-slate-50">
            <div className="flex flex-col md:flex-row md:items-center gap-5 justify-between">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center"><Upload size={24} /></div>
                <div>
                  <h3 className="font-black text-slate-900">Satış CSV dosyası</h3>
                  
                </div>
              </div>
              <input type="file" accept=".csv" onChange={(e) => { setFile(e.target.files?.[0] || null); setPreview(null); setResult(null); }} className="text-sm font-semibold text-slate-600" />
            </div>
            {file && <div className="mt-5 bg-white border border-slate-200 rounded-2xl p-4 flex items-center gap-3"><FileText size={20} className="text-slate-500" /><span className="font-bold text-slate-800">{file.name}</span></div>}
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={handlePreview} disabled={!file || loading} className="h-11 px-5 rounded-xl bg-slate-900 text-white font-black text-sm flex items-center gap-2 disabled:opacity-50">
              {loading ? <Loader2 className="animate-spin" size={17} /> : <Database size={17} />} Ön İzle
            </button>
            <button onClick={handleApply} disabled={!file || applying} className="h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-sm flex items-center gap-2 disabled:opacity-50">
              {applying ? <Loader2 className="animate-spin" size={17} /> : <CheckCircle2 size={17} />} Aktarımı Uygula
            </button>
          </div>

          {preview && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Metric label="Toplam Satır" value={sayi(preview.total_rows)} />
                <Metric label="Geçerli" value={sayi(preview.valid_rows)} green />
                <Metric label="Reddedilecek" value={sayi(preview.rejected_rows)} red />
              </div>
              <PreviewTable rows={preview.preview || []} />
              {!!preview.errors?.length && <ErrorList rows={preview.errors} />}
            </div>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden">
          <div className="p-5 border-b border-slate-100">
            <h3 className="font-black text-slate-900">Son Aktarımlar</h3>
          </div>
          <div className="divide-y divide-slate-100 max-h-[620px] overflow-auto">
            {imports.map((item) => <div key={item.import_id} className="p-5"><div className="flex items-start justify-between gap-4"><div><p className="font-black text-slate-900">{kaynakAdi(item)}</p><p className="text-xs text-slate-400 font-semibold mt-1">{tarih(item.created_at)}</p></div><span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-black">{durum(item.status)}</span></div><div className="mt-4 grid grid-cols-3 gap-2 text-center"><Mini label="Satır" value={item.total_rows} /><Mini label="İşlenen" value={item.imported_rows} /><Mini label="Red" value={item.rejected_rows} /></div></div>)}
            {imports.length === 0 && <div className="p-8 text-center text-slate-500 text-sm font-semibold">Aktarım kaydı yok.</div>}
          </div>
        </div>
      </section>
    </div>
  );
}

function Notice({ error, text }) { return <div className={`p-5 rounded-2xl border flex items-start gap-4 ${error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>{error ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}<p className="text-sm font-bold">{text}</p></div>; }
function Metric({ label, value, green, red }) { const cls = green ? 'text-green-600 bg-green-50' : red ? 'text-red-600 bg-red-50' : 'text-slate-700 bg-slate-50'; return <div className={`rounded-2xl p-5 ${cls}`}><p className="text-xs font-black uppercase tracking-wider opacity-70">{label}</p><p className="text-3xl font-black mt-1">{value}</p></div>; }
function Mini({ label, value }) { return <div className="bg-slate-50 rounded-xl p-3"><p className="text-xs font-black text-slate-400 uppercase">{label}</p><p className="font-black text-slate-800">{sayi(value)}</p></div>; }
function PreviewTable({ rows }) { return <div className="border border-slate-200 rounded-2xl overflow-hidden"><table className="w-full text-left"><thead className="bg-slate-50"><tr><th className="p-4 text-xs font-black text-slate-400 uppercase">Ürün</th><th className="p-4 text-xs font-black text-slate-400 uppercase">Şube</th><th className="p-4 text-xs font-black text-slate-400 uppercase">Miktar</th><th className="p-4 text-xs font-black text-slate-400 uppercase">Tarih</th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((r) => <tr key={r.row}><td className="p-4 font-bold text-slate-800">{r.product_name}</td><td className="p-4 font-bold text-slate-700">{r.market_name}</td><td className="p-4 font-black text-slate-900">{sayi(r.quantity)}</td><td className="p-4 text-sm text-slate-500 font-semibold">{r.sale_date_text}</td></tr>)}{rows.length === 0 && <tr><td colSpan="4" className="p-8 text-center text-slate-500 font-semibold">Geçerli satır bulunamadı.</td></tr>}</tbody></table></div>; }
function ErrorList({ rows }) { return <div className="bg-red-50 border border-red-200 rounded-2xl p-5"><h4 className="font-black text-red-700 mb-3">Reddedilen Satırlar</h4><div className="space-y-2 max-h-52 overflow-auto">{rows.map((e, i) => <div key={i} className="text-sm text-red-700"><b>Satır {e.row}:</b> {e.error}</div>)}</div></div>; }
