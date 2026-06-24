import React from 'react';

export default function PageHero({ title, metrics = [], actions = null, right = null }) {
  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-900/10 bg-slate-950 text-white shadow-[0_18px_48px_rgba(15,23,42,0.18)]">
      <div className="flex min-h-[92px] flex-col gap-4 px-6 py-5 xl:flex-row xl:items-center xl:justify-between">
        <h1 className="truncate text-2xl font-black tracking-[-0.04em] text-white md:text-3xl">{title}</h1>
        {(metrics.length > 0 || actions || right) && (
          <div className="flex flex-wrap items-center gap-3 xl:justify-end">
            {metrics.map((metric) => (
              <div key={`${metric.label}-${metric.value}`} className="min-w-[128px] rounded-2xl border border-white/10 bg-white/10 px-4 py-3 shadow-inner shadow-white/5 backdrop-blur">
                <div className="text-[11px] font-black uppercase tracking-[0.16em] text-blue-200">{metric.label}</div>
                <div className="mt-1 text-2xl font-black text-white">{metric.value}</div>
              </div>
            ))}
            {actions}
            {right}
          </div>
        )}
      </div>
    </section>
  );
}
