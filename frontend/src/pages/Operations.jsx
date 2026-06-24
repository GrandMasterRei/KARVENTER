// frontend/src/pages/Operations.jsx

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  ArrowRightLeft,
  Bell,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock3,
  Loader2,
  RotateCcw,
  Search,
  ShoppingCart
} from 'lucide-react';
import api from '../services/api';
import PageHero from '../components/PageHero';

const EVENT_LABELS = {
  live_sale: 'Satış',
  sale_created: 'Satış',
  sales_import_completed: 'Veri aktarımı',
  sales_import_failed: 'Veri aktarımı',
  alert_created: 'Bildirim',
  alert_read: 'Bildirim okundu',
  alert_closed: 'Bildirim kapandı',
  alert_status_update: 'Bildirim',
  alerts_bulk_update: 'Toplu bildirim',
  transfer_suggested: 'Transfer önerisi',
  transfer_manual_created: 'Manuel transfer',
  transfer_approved: 'Transfer onaylandı',
  transfer_rejected: 'Transfer reddedildi',
  transfer_cancelled: 'Transfer iptal',
  transfer_completed: 'Transfer tamamlandı',
  transfer_reverted: 'Transfer geri alındı',
  ai_transfer_executed: 'AI transfer',
  ai_transfer_task_created: 'AI görev',
  assistant_action_pending: 'AI taslak',
  assistant_action_rejected: 'AI red',
  assistant_action_failed: 'AI hata',
  stock_manual_update: 'Stok güncelleme'
};

const TYPE_OPTIONS = [
  { value: 'all', label: 'Tüm işlemler' },
  { value: 'sale_created', label: 'Satış' },
  { value: 'transfer_suggested', label: 'Transfer önerisi' },
  { value: 'transfer_approved', label: 'Onaylanan transfer' },
  { value: 'transfer_completed', label: 'Tamamlanan transfer' },
  { value: 'transfer_rejected', label: 'Reddedilen transfer' },
  { value: 'transfer_reverted', label: 'Geri alınan transfer' },
  { value: 'ai_transfer_task_created', label: 'AI görevleri' },
  { value: 'alert_read', label: 'Okunan bildirim' },
  { value: 'sales_import_completed', label: 'Veri aktarımı' }
];

function eventIcon(type) {
  if (type?.includes('transfer')) return ArrowRightLeft;
  if (type?.includes('alert')) return Bell;
  if (type?.includes('ai') || type?.includes('assistant')) return Bot;
  if (type?.includes('sale')) return ShoppingCart;
  return Activity;
}

function tarih(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function eventLabel(type) {
  return EVENT_LABELS[type] || type || 'İşlem';
}

function displayTitle(value) {
  return String(value || 'İşlem').replaceAll('Uyarı', 'Bildirim').replaceAll('uyarı', 'bildirim');
}

function displayText(value) {
  return String(value || '').replaceAll('Uyarı', 'Bildirim').replaceAll('uyarı', 'bildirim');
}

export default function Operations() {
  const [events, setEvents] = useState([]);
  const [summary, setSummary] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [notice, setNotice] = useState('');

  const loadData = async () => {
    try {
      setLoading(true);
      const [eventsResponse, summaryResponse] = await Promise.all([
        api.get(`/api/events?limit=160&event_type=${encodeURIComponent(typeFilter)}`),
        api.get('/api/events/summary')
      ]);
      setEvents(Array.isArray(eventsResponse.data?.data) ? eventsResponse.data.data : []);
      setSummary(summaryResponse.data || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [typeFilter]);
  useEffect(() => {
    const refresh = () => loadData();
    window.addEventListener('karventer:refresh', refresh);
    return () => window.removeEventListener('karventer:refresh', refresh);
  }, [typeFilter]);

  const filteredEvents = useMemo(() => {
    const text = query.trim().toLocaleLowerCase('tr-TR');
    if (!text) return events;
    return events.filter((event) => `${event.title || ''} ${event.description || ''} ${event.event_type || ''}`.toLocaleLowerCase('tr-TR').includes(text));
  }, [events, query]);

  const undoTransfer = async (event) => {
    if (!event?.entity_id) return;
    try {
      setActionLoading(`undo-${event.entity_id}`);
      setNotice('');
      await api.patch(`/api/transfers/${event.entity_id}/undo`);
      setNotice('Transfer geri alındı.');
      await loadData();
      window.dispatchEvent(new CustomEvent('karventer:refresh'));
    } catch (err) {
      setNotice(err.response?.data?.detail || 'Geri alma işlemi tamamlanamadı.');
    } finally {
      setActionLoading(null);
    }
  };

  const cards = [
    { label: 'Toplam işlem', value: summary?.total ?? events.length, icon: Activity },
    { label: 'Son 24 saat', value: summary?.last_24h ?? 0, icon: Clock3 },
    { label: 'Açık bildirim', value: summary?.open_alerts ?? 0, icon: AlertTriangle },
    { label: 'Bekleyen AI işlemi', value: summary?.pending_actions ?? 0, icon: CheckCircle2 }
  ];

  return (
    <div className="space-y-6">
      <PageHero title="İşlem Geçmişi" />

      {notice && <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm font-black text-blue-700">{notice}</div>}

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <Icon size={21} />
              </div>
              <div className="min-w-0">
                <div className="text-3xl font-black leading-none text-slate-950">{Number(card.value || 0).toLocaleString('tr-TR')}</div>
                <div className="mt-2 text-sm font-black text-slate-400">{card.label}</div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-5">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[260px_minmax(0,1fr)]">
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value)}
              className="h-12 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            >
              {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <div className="relative">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="İşlem ara"
                className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>

        <div className="divide-y divide-slate-100">
          {loading && <div className="flex justify-center p-10"><Loader2 className="animate-spin text-blue-600" size={28} /></div>}
          {!loading && filteredEvents.length > 0 ? filteredEvents.map((event) => {
            const Icon = eventIcon(event.event_type);
            const rowId = `${event.event_id || event.event_type}-${event.entity_type || ''}-${event.entity_id || ''}`;
            const open = expandedId === rowId;
            const canUndo = event.event_type === 'transfer_completed' && event.entity_type === 'transfer' && event.entity_id;
            return (
              <div key={rowId} className="p-5 transition-colors hover:bg-slate-50/70">
                <div className="flex items-start gap-4">
                  <div className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                    <Icon size={20} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-black text-slate-950">{displayTitle(event.title)}</h3>
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-black text-slate-500">{eventLabel(event.event_type)}</span>
                        </div>
                        {event.description && <p className="mt-1 text-sm font-semibold leading-relaxed text-slate-500">{displayText(event.description)}</p>}
                        <div className="mt-2 text-xs font-black text-slate-400">{tarih(event.created_at)}</div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedId(open ? null : rowId)}
                          className="flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-slate-700 hover:bg-slate-50"
                        >
                          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          Detay
                        </button>
                        {canUndo && (
                          <button
                            type="button"
                            onClick={() => undoTransfer(event)}
                            disabled={actionLoading === `undo-${event.entity_id}`}
                            className="flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-black text-amber-700 hover:bg-amber-100 disabled:opacity-60"
                          >
                            {actionLoading === `undo-${event.entity_id}` ? <Loader2 className="animate-spin" size={16} /> : <RotateCcw size={16} />}
                            Geri Al
                          </button>
                        )}
                      </div>
                    </div>
                    {open && (
                      <div className="mt-4 grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-4">
                        <Detail label="İşlem türü" value={eventLabel(event.event_type)} />
                        <Detail label="Kayıt tipi" value={event.entity_type || '-'} />
                        <Detail label="Kayıt no" value={event.entity_id || '-'} />
                        <Detail label="Tarih" value={tarih(event.created_at)} />
                        {event.description && <div className="md:col-span-2 xl:col-span-4"><Detail label="Açıklama" value={displayText(event.description)} /></div>}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }) : (!loading &&
            <div className="p-12 text-center">
              <Activity className="mx-auto mb-3 text-slate-300" size={42} />
              <div className="text-sm font-black text-slate-500">Kayıt yok</div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-black uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-black text-slate-700">{String(value ?? '-')}</div>
    </div>
  );
}
