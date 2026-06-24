// frontend/src/components/FloatingActions.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  ExternalLink,
  Loader2,
  X
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api, { apiErrorMessage, extractRows } from '../services/api';

const ALERT_TYPES = [
  { value: 'all', label: 'Tüm bildirimler' },
  { value: 'critical_stock', label: 'Stok eksiği' },
  { value: 'near_expiry', label: 'SKT yaklaşıyor' },
  { value: 'expired', label: 'SKT geçmiş' },
  { value: 'staff_request', label: 'Personel talepleri' },
  { value: 'staff_report', label: 'Personel bildirimi' },
  { value: 'transfer_request', label: 'Transfer talebi' }
];

const ALERT_TYPE_LABELS = Object.fromEntries(ALERT_TYPES.map((item) => [item.value, item.label]));

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

function isAdminUser(user) {
  return ['admin', 'yonetici', 'yönetici'].includes(roleOf(user));
}


function alertTipi(type) {
  return ALERT_TYPE_LABELS[type] || 'Bildirim';
}

function severityLabel(severity) {
  if (severity === 'critical') return 'Kritik';
  if (severity === 'high') return 'Yüksek';
  if (severity === 'medium') return 'Orta';
  if (severity === 'low') return 'Düşük';
  return 'Normal';
}

function severityClass(severity) {
  if (severity === 'critical') return 'bg-red-50 text-red-700 border-red-100';
  if (severity === 'high') return 'bg-orange-50 text-orange-700 border-orange-100';
  if (severity === 'medium') return 'bg-amber-50 text-amber-700 border-amber-100';
  return 'bg-slate-100 text-slate-600 border-slate-200';
}

function tarihFormatla(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function bildirimMetni(value) {
  return String(value || '').replaceAll('Uyarı', 'Bildirim').replaceAll('uyarı', 'bildirim');
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

export default function FloatingActions() {
  const navigate = useNavigate();
  const [panel, setPanel] = useState(null);
  const [alertType, setAlertType] = useState('all');
  const [alerts, setAlerts] = useState([]);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const openAlerts = () => setPanel((current) => (current === 'alerts' ? null : 'alerts'));
    window.addEventListener('karventer:open-alerts', openAlerts);
    return () => window.removeEventListener('karventer:open-alerts', openAlerts);
  }, []);

  useEffect(() => {
    if (panel === 'alerts') loadAlerts();
  }, [panel, alertType]);

  const filteredAlerts = useMemo(() => alerts, [alerts]);

  const loadAlerts = async () => {
    try {
      setLoading(true);
      setMessage('');
      const params = new URLSearchParams({ status: 'open', limit: '200' });
      const user = currentUser();
      const userId = user?.kullanici_id || user?.user_id || user?.id;
      if (alertType !== 'all') params.set('alert_type', alertType);
      if (alertType === 'staff_request' && userId) params.set('user_id', String(userId));
      if (alertType === 'staff_request' && userId && !isAdminUser(user)) params.set('created_by_user_id', String(userId));
      if (alertType === 'all' && userId && !isAdminUser(user)) params.set('user_id', String(userId));
      const response = await api.get(`/api/alerts?${params.toString()}`);
      const data = extractRows(response);
      setAlerts(data);
      if (data.length === 0) {
        setSelectedAlert(null);
      } else if (selectedAlert && !data.some((item) => item.alert_id === selectedAlert.alert_id)) {
        setSelectedAlert(null);
      }
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Bildirimler alınamadı.'));
    } finally {
      setLoading(false);
    }
  };

  const updateAlert = async (alertId, status) => {
    try {
      setActionLoading(`alert-${status}-${alertId}`);
      await api.patch(`/api/alerts/${alertId}/status`, { status });
      await loadAlerts();
      window.dispatchEvent(new CustomEvent('karventer:refresh-alert-count'));
      window.dispatchEvent(new CustomEvent('karventer:refresh'));
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Bildirim güncellenemedi.'));
    } finally {
      setActionLoading(null);
    }
  };

  const inspectAlert = (alert) => {
    const isRequest = alert?.alert_type === 'staff_request' || normalize(`${alert?.title || ''} ${alert?.message || ''}`).includes('talep');
    if (isRequest) {
      setPanel(null);
      navigate(`/requests?alert_id=${alert.alert_id}`);
      return;
    }
    setSelectedAlert(alert);
  };

  const bulkReadAlerts = async () => {
    try {
      setActionLoading('bulk-reviewed');
      await api.patch('/api/alerts-bulk/status', {
        status: 'reviewed',
        alert_type: alertType
      });
      await loadAlerts();
      window.dispatchEvent(new CustomEvent('karventer:refresh-alert-count'));
      window.dispatchEvent(new CustomEvent('karventer:refresh'));
    } catch (err) {
      setMessage(apiErrorMessage(err, 'Toplu işlem tamamlanamadı.'));
    } finally {
      setActionLoading(null);
    }
  };

  if (panel !== 'alerts') return null;

  return (
    <div className="fixed right-6 top-[88px] z-50 w-[440px] max-w-[calc(100vw-32px)] rounded-3xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/70 overflow-hidden animate-[fadeIn_.16s_ease-out]">
      <div className="flex items-center justify-between border-b border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50">
            <AlertTriangle className="text-blue-600" size={22} />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-950">Bildirimler</h3>
            <p className="text-xs font-bold text-slate-400">{alerts.length} açık kayıt</p>
          </div>
        </div>
        <button onClick={() => setPanel(null)} className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100">
          <X size={19} />
        </button>
      </div>

      <div className="space-y-3 border-b border-slate-100 p-4">
        <select
          value={alertType}
          onChange={(event) => { setAlertType(event.target.value); setSelectedAlert(null); }}
          className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
        >
          {ALERT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
        {filteredAlerts.length > 0 && (
          <button onClick={bulkReadAlerts} disabled={actionLoading === 'bulk-reviewed'} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 text-xs font-black text-white hover:bg-slate-800 disabled:opacity-60">
            {actionLoading === 'bulk-reviewed' ? <Loader2 className="animate-spin" size={16} /> : <CheckCircle2 size={16} />}
            Tümünü okundu yap
          </button>
        )}
      </div>

      {message && <div className="mx-4 mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-700">{message}</div>}

      <div className="max-h-[68vh] space-y-3 overflow-y-auto p-4">
        {loading && <div className="flex justify-center p-8"><Loader2 className="animate-spin text-blue-600" size={28} /></div>}

        {!loading && selectedAlert && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
            <div className="mb-2 flex items-start justify-between gap-3">
              <div>
                <h4 className="font-black text-slate-900">{bildirimMetni(selectedAlert.title)}</h4>
                <p className="mt-1 text-xs font-black text-blue-600">{alertTipi(selectedAlert.alert_type)} · {severityLabel(selectedAlert.severity)}</p>
              </div>
              <button onClick={() => setSelectedAlert(null)} className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 hover:bg-white/70"><X size={16} /></button>
            </div>
            {selectedAlert.message && <p className="mb-3 text-sm leading-relaxed text-slate-700">{bildirimMetni(selectedAlert.message)}</p>}
            <div className="mb-3 text-xs font-bold text-slate-500">{tarihFormatla(selectedAlert.created_at)}</div>
            <div className="flex flex-wrap gap-2">
              {selectedAlert.market_id && (
                <button onClick={() => { setPanel(null); navigate(`/market/${selectedAlert.market_id}`); }} className="flex h-10 items-center gap-2 rounded-xl border border-blue-100 bg-white px-4 text-sm font-black text-blue-700"><ExternalLink size={16} />Şubeyi aç</button>
              )}
              <button onClick={() => updateAlert(selectedAlert.alert_id, 'reviewed')} disabled={actionLoading === `alert-reviewed-${selectedAlert.alert_id}`} className="h-10 rounded-xl bg-slate-950 px-4 text-sm font-black text-white disabled:opacity-60">Okundu yap</button>
            </div>
          </div>
        )}

        {!loading && !selectedAlert && (
          filteredAlerts.length > 0 ? filteredAlerts.map((alert) => (
            <div key={alert.alert_id} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="mb-2 flex items-start justify-between gap-3">
                <div>
                  <h4 className="font-black text-slate-900">{bildirimMetni(alert.title)}</h4>
                  <p className="mt-1 text-xs font-black text-slate-400">{alertTipi(alert.alert_type)}</p>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs font-black ${severityClass(alert.severity)}`}>{severityLabel(alert.severity)}</span>
              </div>
              {alert.message && <p className="mb-3 text-sm leading-relaxed text-slate-600">{bildirimMetni(alert.message)}</p>}
              <div className="flex gap-2">
                <button onClick={() => inspectAlert(alert)} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 hover:bg-slate-50"><Eye size={16} />İncele</button>
                <button onClick={() => updateAlert(alert.alert_id, 'reviewed')} disabled={actionLoading === `alert-reviewed-${alert.alert_id}`} className="flex h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-950 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-60"><CheckCircle2 size={16} />Okundu</button>
              </div>
            </div>
          )) : <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-black text-slate-400">Kayıt yok</div>
        )}
      </div>
    </div>
  );
}
