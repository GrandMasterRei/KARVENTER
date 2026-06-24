// frontend/src/pages/StaffRequests.jsx

import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, FileText, Loader2, Search, XCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api, { apiErrorMessage } from '../services/api';
import PageHero from '../components/PageHero';

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('karventer_user') || 'null') || {};
  } catch {
    return {};
  }
}

function roleOf(user) {
  return String(user?.role || user?.rol || user?.role_name || user?.rol_ad || '').toLocaleLowerCase('tr-TR');
}

function rows(response) {
  const data = response?.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

function isStaffRequest(item) {
  const text = `${item?.alert_type || ''} ${item?.type || ''} ${item?.title || ''} ${item?.message || ''}`.toLocaleLowerCase('tr-TR');
  return text.includes('staff_request') || text.includes('personel talebi') || text.includes('personel') || text.includes('talep:') || text.includes('talep edilen adet');
}

function dedupe(list) {
  const seen = new Set();
  return list.filter((item) => {
    const key = item.alert_id || item.id || `${item.created_at}-${item.title}-${item.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function statusLabel(status) {
  const map = {
    open: 'Bekliyor',
    pending: 'Bekliyor',
    reviewed: 'İncelendi',
    approved: 'Onaylandı',
    resolved: 'Tamamlandı',
    completed: 'Tamamlandı',
    dismissed: 'Reddedildi',
    rejected: 'Reddedildi',
    cancelled: 'İptal'
  };
  return map[String(status || '').toLowerCase()] || status || '-';
}

function statusClass(status) {
  const key = String(status || '').toLowerCase();
  if (['dismissed', 'rejected', 'cancelled'].includes(key)) return 'bg-red-50 text-red-700 border-red-100';
  if (['reviewed', 'approved'].includes(key)) return 'bg-blue-50 text-blue-700 border-blue-100';
  if (['resolved', 'completed'].includes(key)) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  return 'bg-amber-50 text-amber-700 border-amber-100';
}

function dateText(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function quantityFrom(item) {
  const text = `${item?.quantity || ''} ${item?.requested_quantity || ''} ${item?.message || ''}`;
  const match = text.match(/(?:Talep edilen adet|Adet|adet)\s*[:=]?\s*(\d+)/i);
  return item?.quantity || item?.requested_quantity || match?.[1] || '-';
}

function productName(item) {
  if (item?.product_name || item?.urun_adi) return item.product_name || item.urun_adi;
  const m = String(item?.message || item?.title || '').match(/Ürün:\s*([^|]+)/i);
  return m?.[1]?.trim() || item?.title || 'Personel talebi';
}

function barcodeText(item) {
  if (item?.barcode || item?.product_barcode) return item.barcode || item.product_barcode;
  const m = String(item?.message || item?.title || '').match(/Barkod:\s*([^|)]+)/i);
  return m?.[1]?.trim() || '-';
}

function marketName(item, user) {
  if (item?.market_name || item?.sube_adi) return item.market_name || item.sube_adi;
  const m = String(item?.message || '').match(/Lokasyon:\s*([^|]+)/i);
  return m?.[1]?.trim() || user?.market_name || user?.sube_adi || 'Lokasyon';
}

export default function StaffRequests() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [message, setMessage] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [searchParams] = useSearchParams();
  const user = currentUser();
  const userId = user?.kullanici_id || user?.user_id || user?.id;
  const role = roleOf(user);
  const isAdmin = ['admin', 'yonetici', 'yönetici'].includes(role);
  const pageTitle = isAdmin ? 'Talepler' : 'Geçmiş Taleplerim';
  const highlightedId = Number(searchParams.get('alert_id') || searchParams.get('id') || 0);

  async function load() {
    try {
      setLoading(true);
      setMessage('');
      const params = { status: 'all', limit: 500 };
      if (userId) params.user_id = userId;
      if (!isAdmin && userId) params.created_by_user_id = userId;

      const attempts = [
        () => api.get('/api/staff-requests', { params }),
        () => api.get('/api/alerts', { params: { ...params, alert_type: 'staff_request' } }),
        () => api.get('/api/alerts', { params: { ...params, status: 'all' } }),
        () => api.get('/api/alerts', { params: { ...params, status: 'open' } })
      ];

      let collected = [];
      for (const attempt of attempts) {
        try {
          const response = await attempt();
          collected = collected.concat(rows(response));
        } catch {
          // Eski backend/rota varsa diğer denemeyle devam et.
        }
      }
      setItems(dedupe(collected).filter(isStaffRequest));
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Talepler alınamadı.'));
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  async function updateAlert(alertId, status) {
    try {
      setActionLoading(`${status}-${alertId}`);
      await api.patch(`/api/alerts/${alertId}/status`, { status });
      await load();
      window.dispatchEvent(new CustomEvent('karventer:refresh-alert-count'));
      window.dispatchEvent(new CustomEvent('karventer:refresh'));
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Talep durumu güncellenemedi.'));
    } finally {
      setActionLoading(null);
    }
  }

  useEffect(() => { load(); }, [userId, isAdmin]);
  useEffect(() => {
    const refresh = () => load();
    window.addEventListener('karventer:refresh', refresh);
    return () => window.removeEventListener('karventer:refresh', refresh);
  }, [userId, isAdmin]);

  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    if (!q) return items;
    return items.filter((item) => `${item.title || ''} ${item.message || ''} ${productName(item)} ${barcodeText(item)} ${marketName(item, user)} ${item.created_by_user_id || ''} ${statusLabel(item.status)}`.toLocaleLowerCase('tr-TR').includes(q));
  }, [items, query, user]);

  const waitingCount = items.filter((item) => ['open', 'pending'].includes(String(item.status || '').toLowerCase())).length;
  const completedCount = items.filter((item) => ['reviewed', 'resolved', 'dismissed', 'approved', 'completed', 'rejected'].includes(String(item.status || '').toLowerCase())).length;

  return (
    <div className="space-y-6">
      <PageHero
        title={pageTitle}
        metrics={[
          { label: 'Toplam', value: items.length },
          { label: 'Bekleyen', value: waitingCount },
          { label: 'Sonuçlanan', value: completedCount }
        ]}
      />

      {isAdmin && (
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">Tüm Personel Talepleri</h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Mobil personelden gelen tüm talepler burada geçmiş ve durum bilgisiyle listelenir. AI işlem taslakları bu listeye karışmaz.
              </p>
            </div>
            <span className="rounded-full border border-blue-100 bg-blue-50 px-4 py-2 text-xs font-black text-blue-700">
              Yönetici görünümü
            </span>
          </div>
        </section>
      )}

      {message && <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-sm font-bold text-amber-700">{message}</div>}

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isAdmin ? 'Personel, ürün, barkod, lokasyon veya durum ara' : 'Talep ara'}
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading && <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" size={28} /></div>}
          {!loading && filtered.length > 0 ? filtered.map((item) => {
            const id = item.alert_id || item.id;
            const isHighlighted = highlightedId && Number(id) === highlightedId;
            return (
              <div key={id || `${item.created_at}-${item.title}`} className={`p-5 transition-colors hover:bg-slate-50/70 ${isHighlighted ? 'bg-blue-50/70 ring-2 ring-blue-100' : ''}`}>
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <FileText size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <h3 className="font-black text-slate-950">{productName(item)}</h3>
                        <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-500">{item.message || item.title || 'Talep detayı yok'}</p>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-black text-slate-400">
                          {isAdmin && <><span>Personel ID: {item.created_by_user_id || '-'}</span><span>•</span></>}
                          <span>{marketName(item, user)}</span>
                          <span>•</span>
                          <span>Barkod: {barcodeText(item)}</span>
                          <span>•</span>
                          <span>Adet: {quantityFrom(item)}</span>
                          <span>•</span>
                          <span>{dateText(item.created_at)}</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col gap-2 lg:items-end">
                        <span className={`rounded-full border px-3 py-1.5 text-xs font-black ${statusClass(item.status)}`}>{statusLabel(item.status)}</span>
                        {isAdmin && ['open', 'pending', 'reviewed'].includes(String(item.status || '').toLowerCase()) && (
                          <div className="flex gap-2">
                            <button
                              onClick={() => updateAlert(id, 'resolved')}
                              disabled={actionLoading === `resolved-${id}`}
                              className="flex h-9 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-xs font-black text-white disabled:opacity-60"
                            >
                              {actionLoading === `resolved-${id}` ? <Loader2 className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                              Tamamla
                            </button>
                            <button
                              onClick={() => updateAlert(id, 'dismissed')}
                              disabled={actionLoading === `dismissed-${id}`}
                              className="flex h-9 items-center gap-1 rounded-xl bg-red-600 px-3 text-xs font-black text-white disabled:opacity-60"
                            >
                              {actionLoading === `dismissed-${id}` ? <Loader2 className="animate-spin" size={14} /> : <XCircle size={14} />}
                              Reddet
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          }) : (!loading &&
            <div className="p-12 text-center">
              <Clock3 className="mx-auto mb-3 text-slate-300" size={42} />
              <div className="text-sm font-black text-slate-500">{isAdmin ? 'Henüz personel talebi yok' : 'Henüz talebiniz yok'}</div>
              {isAdmin && (
                <p className="mt-2 text-sm font-semibold text-slate-400">
                  Mobil personelden talep geldiğinde burada görünür.
                </p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
