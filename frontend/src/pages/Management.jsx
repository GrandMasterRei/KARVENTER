// frontend/src/pages/Management.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Package,
  Power,
  PowerOff,
  Search,
  Store,
  UserPlus,
  Users
} from 'lucide-react';
import api from '../services/api';
import PageHero from '../components/PageHero';

const TABS = [
  { key: 'users', label: 'Personel', icon: Users },
  { key: 'markets', label: 'Lokasyonlar', icon: Store },
  { key: 'products', label: 'Ürünler', icon: Package }
];
const initialUserForm = { kullanici_adi: '', sifre: '', rol: 'staff', market_id: '' };

function durumClass(active) { return active ? 'bg-green-50 text-green-700 border-green-100' : 'bg-slate-100 text-slate-600 border-slate-200'; }
function para(value) { const n = Number(value); return Number.isFinite(n) ? n.toLocaleString('tr-TR') : '0'; }

export default function Management() {
  const [tab, setTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [markets, setMarkets] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [showUserForm, setShowUserForm] = useState(false);
  const [userForm, setUserForm] = useState(initialUserForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async () => {
    try {
      setLoading(true); setError('');
      const [usersRes, marketsRes, productsRes] = await Promise.all([
        api.get('/api/users?include_inactive=true'),
        api.get('/api/markets?include_inactive=true'),
        api.get('/api/products?include_inactive=true')
      ]);
      setUsers(Array.isArray(usersRes.data?.data) ? usersRes.data.data : []);
      setMarkets(Array.isArray(marketsRes.data) ? marketsRes.data : []);
      setProducts(Array.isArray(productsRes.data) ? productsRes.data : []);
    } catch { setError('Yönetim verileri alınamadı. Backend yönetim endpointlerini kontrol et.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadData(); }, []);
  useEffect(() => { const handler = () => loadData(); window.addEventListener('karventer:refresh', handler); return () => window.removeEventListener('karventer:refresh', handler); }, []);

  const marketNameById = useMemo(() => new Map(markets.map((m) => [Number(m.market_id), m.name])), [markets]);
  const filteredUsers = useMemo(() => users.filter((u) => `${u.kullanici_adi || ''} ${u.rol || ''} ${u.market_name || ''}`.toLowerCase().includes(search.toLowerCase())), [users, search]);
  const filteredMarkets = useMemo(() => markets.filter((m) => `${m.name || ''} ${m.city || ''}`.toLowerCase().includes(search.toLowerCase())), [markets, search]);
  const filteredProducts = useMemo(() => products.filter((p) => `${p.product_name || ''} ${p.category || ''}`.toLowerCase().includes(search.toLowerCase())), [products, search]);

  const showSuccess = (message) => { setSuccess(message); setTimeout(() => setSuccess(''), 2500); };

  const createUser = async (event) => {
    event.preventDefault();
    try {
      setSaving(true); setError('');
      await api.post('/api/users', {
        kullanici_adi: userForm.kullanici_adi.trim(),
        sifre: userForm.sifre,
        rol: userForm.rol,
        market_id: userForm.market_id ? Number(userForm.market_id) : null
      });
      setUserForm(initialUserForm); setShowUserForm(false); showSuccess('Personel oluşturuldu.'); await loadData();
    } catch (err) { setError(err.response?.data?.detail || 'Personel oluşturulamadı.'); }
    finally { setSaving(false); }
  };

  const toggle = async (type, item) => {
    const id = type === 'user' ? item.kullanici_id : type === 'market' ? item.market_id : item.product_id;
    const url = type === 'user' ? `/api/users/${id}/status` : type === 'market' ? `/api/markets/${id}/status` : `/api/products/${id}/status`;
    try {
      setSavingId(`${type}-${id}`); setError('');
      await api.patch(url, { is_active: !item.is_active });
      showSuccess('Durum güncellendi.'); await loadData();
    } catch (err) { setError(err.response?.data?.detail || 'Durum güncellenemedi.'); }
    finally { setSavingId(null); }
  };

  return (
    <div className="space-y-7">
      <PageHero
        title="Yönetim"
        right={tab === 'users' ? <button onClick={() => setShowUserForm((v) => !v)} className="h-11 px-5 rounded-2xl bg-white hover:bg-blue-50 text-slate-900 font-black text-sm flex items-center gap-2"><UserPlus size={18} />Yeni Personel</button> : null}
      />
      {error && <Notice error text={error} />}{success && <Notice text={success} />}
      {showUserForm && <section className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm"><h3 className="font-black text-lg text-slate-900 mb-4">Yeni personel</h3><form onSubmit={createUser} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end"><Field label="Kullanıcı adı"><input required value={userForm.kullanici_adi} onChange={(e) => setUserForm({ ...userForm, kullanici_adi: e.target.value })} className="h-11 w-full px-4 rounded-xl border border-slate-200 font-semibold" /></Field><Field label="Şifre"><input required type="password" value={userForm.sifre} onChange={(e) => setUserForm({ ...userForm, sifre: e.target.value })} className="h-11 w-full px-4 rounded-xl border border-slate-200 font-semibold" /></Field><Field label="Rol"><select value={userForm.rol} onChange={(e) => setUserForm({ ...userForm, rol: e.target.value })} className="h-11 w-full px-4 rounded-xl border border-slate-200 font-semibold"><option value="staff">Personel</option><option value="admin">Yönetici</option></select></Field><Field label="Şube"><select value={userForm.market_id} onChange={(e) => setUserForm({ ...userForm, market_id: e.target.value })} className="h-11 w-full px-4 rounded-xl border border-slate-200 font-semibold"><option value="">Şube yok</option>{markets.map((m) => <option key={m.market_id} value={m.market_id}>{m.name}</option>)}</select></Field><button disabled={saving} className="h-11 px-5 rounded-xl bg-blue-600 text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-60">{saving ? <Loader2 className="animate-spin" size={17} /> : <UserPlus size={17} />}Kaydet</button></form></section>}
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden"><div className="p-5 border-b border-slate-100 space-y-4"><div className="flex flex-wrap gap-2">{TABS.map((item) => { const Icon = item.icon; return <button key={item.key} onClick={() => setTab(item.key)} className={`h-10 px-4 rounded-xl text-sm font-black flex items-center gap-2 ${tab === item.key ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}><Icon size={17} />{item.label}</button>; })}</div><div className="relative max-w-lg"><Search className="absolute left-3 top-3 text-slate-400" size={18} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Kayıt ara" className="h-11 w-full pl-10 pr-4 rounded-xl border border-slate-200 text-sm font-semibold" /></div></div>{loading ? <div className="p-8 space-y-3">{[1,2,3,4].map((i) => <div key={i} className="h-16 rounded-2xl bg-slate-100 animate-pulse" />)}</div> : <>{tab === 'users' && <UsersTable rows={filteredUsers} marketNameById={marketNameById} savingId={savingId} onToggle={(u) => toggle('user', u)} />}{tab === 'markets' && <MarketsTable rows={filteredMarkets} savingId={savingId} onToggle={(m) => toggle('market', m)} />}{tab === 'products' && <ProductsTable rows={filteredProducts} savingId={savingId} onToggle={(p) => toggle('product', p)} />}</>}</section>
    </div>
  );
}

function Notice({ error, text }) { return <div className={`p-5 rounded-2xl border flex items-start gap-4 ${error ? 'bg-red-50 border-red-200 text-red-700' : 'bg-green-50 border-green-200 text-green-700'}`}>{error ? <AlertCircle size={24} /> : <CheckCircle2 size={24} />}<div><h3 className="font-black">{error ? 'İşlem tamamlanamadı' : 'İşlem tamamlandı'}</h3><p className="text-sm mt-1">{text}</p></div></div>; }
function Field({ label, children }) { return <div className="space-y-1.5"><label className="text-xs font-black text-slate-500">{label}</label>{children}</div>; }
function Status({ active }) { return <span className={`px-3 py-1 rounded-full text-xs font-black border ${durumClass(active)}`}>{active ? 'Aktif' : 'Pasif'}</span>; }
function StatusButton({ active, loading, onClick }) { return <button onClick={onClick} disabled={loading} className={`h-10 px-4 rounded-xl border text-sm font-black flex items-center gap-2 disabled:opacity-60 ${active ? 'bg-white text-red-600 border-red-200 hover:bg-red-50' : 'bg-white text-green-700 border-green-200 hover:bg-green-50'}`}>{loading ? <Loader2 className="animate-spin" size={16} /> : active ? <PowerOff size={16} /> : <Power size={16} />}{active ? 'Pasife Al' : 'Aktifleştir'}</button>; }
function UsersTable({ rows, marketNameById, savingId, onToggle }) { return <Table headers={['Kullanıcı','Rol','Şube','Durum','İşlem']}>{rows.map((u) => <tr key={u.kullanici_id} className="hover:bg-slate-50"><td className="p-5 font-black text-slate-900">{u.kullanici_adi}</td><td className="p-5 font-semibold text-slate-600">{u.rol === 'admin' ? 'Yönetici' : 'Personel'}</td><td className="p-5 font-semibold text-slate-600">{u.market_name || marketNameById.get(Number(u.market_id)) || '-'}</td><td className="p-5"><Status active={u.is_active} /></td><td className="p-5"><div className="flex justify-end"><StatusButton active={u.is_active} loading={savingId === `user-${u.kullanici_id}`} onClick={() => onToggle(u)} /></div></td></tr>)}</Table>; }
function MarketsTable({ rows, savingId, onToggle }) { return <Table headers={['Şube','Şehir','Durum','İşlem']}>{rows.map((m) => <tr key={m.market_id} className="hover:bg-slate-50"><td className="p-5 font-black text-slate-900">{m.name}</td><td className="p-5 font-semibold text-slate-600">{m.city}</td><td className="p-5"><Status active={m.is_active} /></td><td className="p-5"><div className="flex justify-end"><StatusButton active={m.is_active} loading={savingId === `market-${m.market_id}`} onClick={() => onToggle(m)} /></div></td></tr>)}</Table>; }
function ProductsTable({ rows, savingId, onToggle }) { return <Table headers={['Ürün','Kategori','Fiyat','Marj','Durum','İşlem']}>{rows.map((p) => <tr key={p.product_id} className="hover:bg-slate-50"><td className="p-5 font-black text-slate-900">{p.product_name}</td><td className="p-5 font-semibold text-slate-600">{p.category}</td><td className="p-5 font-black text-slate-900">{para(p.unit_price)} ₺</td><td className="p-5 font-semibold text-slate-600">%{Math.round(Number(p.profit_margin || 0) * 100)}</td><td className="p-5"><Status active={p.is_active} /></td><td className="p-5"><div className="flex justify-end"><StatusButton active={p.is_active} loading={savingId === `product-${p.product_id}`} onClick={() => onToggle(p)} /></div></td></tr>)}</Table>; }
function Table({ headers, children }) { return <div className="overflow-x-auto"><table className="w-full text-left border-collapse"><thead className="bg-slate-50 border-b border-slate-100"><tr>{headers.map((h, i) => <th key={h} className={`p-5 text-xs font-black text-slate-400 uppercase ${i === headers.length - 1 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{children}</tbody></table></div>; }
