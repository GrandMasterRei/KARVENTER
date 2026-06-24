// frontend/src/pages/Assistant.jsx

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRightLeft,
  Clock3,
  Loader2,
  Send,
  Zap
} from 'lucide-react';
import api from '../services/api';
import PageHero from '../components/PageHero';

const QUICK_COMMANDS = [
  'Tüm operasyonları iyileştir',
  'Stok sorunlarını çöz',
  'SKT risklerini azalt',
  'Depo transferlerini planla'
];

function getUserId() {
  try {
    const raw = localStorage.getItem('karventer_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return user?.kullanici_id || user?.user_id || user?.id || null;
  } catch {
    return null;
  }
}

function assistantStorageKey() {
  return `karventer_web_assistant_messages_${getUserId() || 'guest'}`;
}

function loadStoredMessages() {
  try {
    const raw = localStorage.getItem(assistantStorageKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.slice(-100) : [];
  } catch {
    return [];
  }
}

function clearStoredAssistantMessages() {
  try {
    localStorage.removeItem(assistantStorageKey());
  } catch {
    // Storage temizliği başarısız olsa bile sayfa çalışmaya devam eder.
  }
}

function paraFormatla(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('tr-TR') : '0';
}

function adetFormatla(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toLocaleString('tr-TR') : '0';
}

function riskLabel(value) {
  if (value === 'high') return 'Yüksek';
  if (value === 'medium') return 'Orta';
  if (value === 'low') return 'Düşük';
  return 'Orta';
}

function statusLabel(value) {
  if (value === 'pending') return 'Bekliyor';
  if (value === 'approved') return 'Onaylandı';
  if (value === 'executed') return 'Uygulandı';
  if (value === 'rejected') return 'Reddedildi';
  if (value === 'failed') return 'İşlenemedi';
  return value || 'Bekliyor';
}

function tarihFormatla(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function cleanAssistantText(value) {
  return String(value || '')
    .replaceAll('Ollama gateway bağlandığında serbest sohbet ve doğal dil cevapları aktif olur.', 'Canlı asistan bağlantısı etkin olduğunda doğal dil yanıtları aktif olur.')
    .replaceAll('Ollama', 'Canlı asistan')
    .replaceAll('açık uyarı', 'açık bildirim')
    .replaceAll('Açık uyarı', 'Açık bildirim');
}

function groupByGroupId(actions) {
  const grouped = new Map();
  actions.forEach((action) => {
    const key = action.group_id || `action-${action.action_id}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(action);
  });
  return Array.from(grouped.entries()).map(([groupId, rows]) => ({ groupId, rows }));
}

export default function Assistant() {
  const [messages, setMessages] = useState(() => loadStoredMessages());
  const [input, setInput] = useState('');
  const [actions, setActions] = useState([]);
  const [events, setEvents] = useState([]);
  const [status, setStatus] = useState(null);
  const [activeGroupId, setActiveGroupId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');
  const bottomRef = useRef(null);

  const pendingActions = useMemo(() => actions.filter((item) => item.status === 'pending'), [actions]);
  const groupedActions = useMemo(() => groupByGroupId(pendingActions), [pendingActions]);
  const activeGroup = useMemo(() => {
    if (!activeGroupId) return groupedActions[0] || null;
    return groupedActions.find((group) => group.groupId === activeGroupId) || groupedActions[0] || null;
  }, [groupedActions, activeGroupId]);

  const loadStatus = async () => {
    try {
      const response = await api.get('/api/assistant/status');
      setStatus(response.data || null);
    } catch {
      setStatus(null);
    }
  };

  const loadMessages = async () => {
    // Sohbet geçmişi sekme değiştirince korunur; çıkış/manuel temizleme dışında silinmez.
  };

  const loadActions = async () => {
    try {
      const response = await api.get('/api/assistant/actions?status=pending&limit=120');
      const rows = Array.isArray(response.data?.data) ? response.data.data : [];
      setActions(rows);
      if (!activeGroupId && rows.length > 0) setActiveGroupId(rows[0].group_id || null);
    } catch {
      setActions([]);
    }
  };

  const loadEvents = async () => {
    try {
      const response = await api.get('/api/events?limit=12');
      setEvents(Array.isArray(response.data?.data) ? response.data.data : []);
    } catch {
      setEvents([]);
    }
  };

  const refreshAll = async () => {
    await Promise.all([loadStatus(), loadMessages(), loadActions(), loadEvents()]);
  };

  useEffect(() => {
    refreshAll();
    const refresh = () => refreshAll();
    window.addEventListener('karventer:refresh', refresh);
    return () => window.removeEventListener('karventer:refresh', refresh);
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(assistantStorageKey(), JSON.stringify(messages.slice(-100)));
    } catch {
      // Storage doluysa sohbet ekranı çalışmaya devam eder.
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, activeGroupId]);

  const sendMessage = async (customText) => {
    const text = (customText || input).trim();
    if (!text) return;

    setMessages((rows) => [...rows, { role: 'user', content: text }]);
    setInput('');
    setError('');

    try {
      setLoading(true);
      const response = await api.post('/api/assistant/chat', {
        message: text,
        user_id: getUserId(),
        mode: 'approval'
      });

      const answer = response.data?.answer || 'İstek işlendi.';
      const groupId = response.data?.group_id || null;
      if (groupId) setActiveGroupId(groupId);
      setMessages((rows) => [...rows, { role: 'assistant', content: answer, group_id: groupId, llm_used: response.data?.llm_used }]);
      await Promise.all([loadStatus(), loadActions(), loadEvents()]);
    } catch (err) {
      const detail = err.response?.data?.detail || 'Asistan isteği tamamlanamadı.';
      setError(detail);
      setMessages((rows) => [...rows, { role: 'assistant', content: detail }]);
    } finally {
      setLoading(false);
    }
  };

  const approveAction = async (actionId) => {
    try {
      setActionLoading(`approve-${actionId}`);
      const response = await api.post(`/api/assistant/actions/${actionId}/approve`, { user_id: getUserId() });
      setMessages((rows) => [...rows, { role: 'assistant', content: response.data?.message || 'İşlem uygulandı.' }]);
      await Promise.all([loadStatus(), loadActions(), loadEvents()]);
      window.dispatchEvent(new CustomEvent('karventer:refresh'));
    } catch (err) {
      setError(err.response?.data?.detail || 'İşlem onaylanamadı.');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectAction = async (actionId) => {
    try {
      setActionLoading(`reject-${actionId}`);
      await api.post(`/api/assistant/actions/${actionId}/reject`, { user_id: getUserId() });
      await Promise.all([loadStatus(), loadActions(), loadEvents()]);
    } catch (err) {
      setError(err.response?.data?.detail || 'İşlem reddedilemedi.');
    } finally {
      setActionLoading(null);
    }
  };

  const approveGroup = async (groupId) => {
    if (!groupId) return;
    try {
      setActionLoading(`approve-group-${groupId}`);
      const response = await api.post(`/api/assistant/actions/group/${groupId}/approve`, { user_id: getUserId() });
      setMessages((rows) => [...rows, {
        role: 'assistant',
        content: `${response.data?.executed_count || 0} işlem uygulandı. ${response.data?.failed_count || 0} işlem uygulanamadı.`
      }]);
      await Promise.all([loadStatus(), loadActions(), loadEvents()]);
      window.dispatchEvent(new CustomEvent('karventer:refresh'));
    } catch (err) {
      setError(err.response?.data?.detail || 'Toplu onay tamamlanamadı.');
    } finally {
      setActionLoading(null);
    }
  };

  const rejectGroup = async (groupId) => {
    if (!groupId) return;
    try {
      setActionLoading(`reject-group-${groupId}`);
      await api.post(`/api/assistant/actions/group/${groupId}/reject`, { user_id: getUserId() });
      await Promise.all([loadStatus(), loadActions(), loadEvents()]);
    } catch (err) {
      setError(err.response?.data?.detail || 'Toplu reddetme tamamlanamadı.');
    } finally {
      setActionLoading(null);
    }
  };

  const renderAction = (action) => {
    const payload = action.payload || {};
    return (
      <div key={action.action_id} className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="font-black text-slate-900">{action.title}</h4>
            <p className="mt-1 text-xs font-black text-slate-400">{statusLabel(action.status)} · Risk: {riskLabel(action.risk_level)}</p>
          </div>
          <span className="rounded-full border border-blue-100 bg-blue-50 px-2.5 py-1 text-[11px] font-black text-blue-700">
            %{Math.round(Number(action.confidence || 0) * 100)}
          </span>
        </div>

        {action.description && <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">{action.description}</p>}

        {action.action_type === 'create_transfer' && (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[11px] font-black uppercase text-slate-400">Ürün</div>
              <div className="mt-1 text-sm font-black text-slate-800">{payload.product_name || '-'}</div>
            </div>
            <div className="rounded-xl bg-slate-50 p-3">
              <div className="text-[11px] font-black uppercase text-slate-400">Miktar</div>
              <div className="mt-1 text-sm font-black text-slate-800">{adetFormatla(payload.quantity)} adet</div>
            </div>
            <div className="col-span-2 rounded-xl bg-slate-50 p-3">
              <div className="text-[11px] font-black uppercase text-slate-400">Transfer</div>
              <div className="mt-1 text-sm font-black text-slate-800">{payload.source_market_name || '-'} → {payload.target_market_name || '-'}</div>
            </div>
            <div className="col-span-2 rounded-xl bg-emerald-50 p-3">
              <div className="text-[11px] font-black uppercase text-emerald-500">Tahmini Kazanç</div>
              <div className="mt-1 text-sm font-black text-emerald-700">+{paraFormatla(payload.estimated_profit_gain)} ₺</div>
            </div>
          </div>
        )}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => approveAction(action.action_id)}
            disabled={actionLoading === `approve-${action.action_id}`}
            className="h-10 flex-1 rounded-xl bg-blue-600 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
          >
            {actionLoading === `approve-${action.action_id}` ? 'İşleniyor' : 'Onayla'}
          </button>
          <button
            type="button"
            onClick={() => rejectAction(action.action_id)}
            disabled={actionLoading === `reject-${action.action_id}`}
            className="h-10 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
          >
            Reddet
          </button>
        </div>
      </div>
    );
  };

  const assistantOnline = Boolean(status?.gateway?.online || status?.ollama_online || status?.llm_online || status?.online);
  const statusDot = status === null ? 'bg-slate-500' : assistantOnline ? 'bg-emerald-400 shadow-[0_0_0_5px_rgba(16,185,129,0.18)]' : 'bg-red-500 shadow-[0_0_0_5px_rgba(239,68,68,0.16)]';

  return (
    <div className="space-y-5">
      <PageHero
        title="KARVAI"
        right={<div title={assistantOnline ? 'Canlı asistan bağlantısı aktif' : 'Canlı asistan bağlantısı pasif'} className={`h-3.5 w-3.5 rounded-full ${statusDot}`} />}
      />

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.85fr)]">
        <section className="flex h-[calc(100vh-226px)] min-h-[500px] flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-4">
            {QUICK_COMMANDS.map((command) => (
              <button key={command} onClick={() => sendMessage(command)} disabled={loading} className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-700 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60">
                {command}
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/70 p-5 space-y-3">
            {messages.map((item, index) => (
              <div key={`${item.role}-${index}`} className={`flex ${item.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[78%] rounded-3xl px-5 py-4 text-sm font-semibold leading-relaxed shadow-sm ${item.role === 'user' ? 'bg-slate-950 text-white rounded-br-lg' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-lg'}`}>
                  {cleanAssistantText(item.content)}
                  {item.created_at && <div className={`mt-2 text-[11px] font-bold ${item.role === 'user' ? 'text-white/45' : 'text-slate-400'}`}>{tarihFormatla(item.created_at)}</div>}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="rounded-3xl rounded-bl-lg border border-slate-200 bg-white px-5 py-4 text-sm font-black text-slate-500 shadow-sm flex items-center gap-2">
                  <Loader2 size={17} className="animate-spin" /> Yazıyor
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {error && <div className="mx-5 mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm font-bold text-amber-700">{error}</div>}

          <form onSubmit={(event) => { event.preventDefault(); sendMessage(); }} className="shrink-0 border-t border-slate-100 p-3 flex gap-3">
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Mesaj yaz"
              className="h-12 flex-1 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-semibold outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
            />
            <button type="submit" disabled={loading || !input.trim()} className="h-12 w-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 disabled:opacity-60">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
            </button>
          </form>
        </section>

        <aside className="space-y-5 self-start">
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-950">İşlem Taslakları</h3>
                <p className="text-xs font-bold text-slate-400">Bekleyen: {pendingActions.length}</p>
              </div>
              <ArrowRightLeft className="text-blue-600" size={22} />
            </div>

            {groupedActions.length > 1 && (
              <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
                {groupedActions.map((group) => (
                  <button key={group.groupId} onClick={() => setActiveGroupId(group.groupId)} className={`h-9 shrink-0 rounded-xl px-3 text-xs font-black ${activeGroup?.groupId === group.groupId ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {group.rows.length} işlem
                  </button>
                ))}
              </div>
            )}

            {activeGroup && (
              <div className="space-y-3">
                {activeGroup.rows.length > 1 && (
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => approveGroup(activeGroup.groupId)} disabled={actionLoading === `approve-group-${activeGroup.groupId}`} className="h-10 rounded-xl bg-blue-600 text-sm font-black text-white hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                      <Zap size={16} /> Hepsini Onayla
                    </button>
                    <button onClick={() => rejectGroup(activeGroup.groupId)} disabled={actionLoading === `reject-group-${activeGroup.groupId}`} className="h-10 rounded-xl border border-slate-200 bg-white text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                      Hepsini Reddet
                    </button>
                  </div>
                )}
                {activeGroup.rows.map(renderAction)}
              </div>
            )}
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-black text-slate-950">Son İşlemler</h3>
                <p className="text-xs font-bold text-slate-400">Sistem olayları</p>
              </div>
              <Clock3 className="text-slate-500" size={21} />
            </div>

            <div className="space-y-3">
              {events.slice(0, 6).map((event) => (
                <div key={event.event_id} className="rounded-2xl border border-slate-200 bg-white p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-slate-800">{event.title}</div>
                      {event.description && <div className="mt-1 text-xs font-semibold text-slate-500 leading-relaxed">{event.description}</div>}
                    </div>
                    <div className="text-[11px] font-bold text-slate-400 whitespace-nowrap">{tarihFormatla(event.created_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
