import React from 'react';
import { Inbox, Loader2, RefreshCcw } from 'lucide-react';

export function LoadingState({ label = 'Yükleniyor' }) {
  return (
    <div className="kv-card rounded-[28px] p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
        <Loader2 className="animate-spin" size={28} />
      </div>
      <div className="text-sm font-black text-slate-700">{label}</div>
    </div>
  );
}

export function ErrorState({ title = 'İşlem tamamlanamadı', message, onRetry }) {
  return (
    <div className="rounded-[28px] border border-amber-100 bg-white p-7 shadow-sm shadow-amber-100/40">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700 ring-1 ring-amber-100">
          !
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-black text-slate-950">{title}</h3>
          {message && <p className="mt-2 text-sm font-semibold leading-relaxed text-slate-500">{message}</p>}
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl border border-blue-100 bg-white px-4 text-sm font-black text-slate-700 transition hover:bg-blue-50 hover:text-blue-700"
            >
              <RefreshCcw size={17} /> Tekrar dene
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title = 'Kayıt yok', message, action }) {
  return (
    <div className="rounded-[28px] border border-dashed border-blue-200 bg-blue-50/40 p-8 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-blue-500 shadow-sm ring-1 ring-blue-100">
        <Inbox size={30} />
      </div>
      <h3 className="text-base font-black text-slate-800">{title}</h3>
      {message && <p className="mx-auto mt-2 max-w-md text-sm font-semibold leading-relaxed text-slate-500">{message}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
