// frontend/src/components/Sidebar.jsx

import React, { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Package,
  BarChart3,
  ArrowRightLeft,
  Store,
  Radio,
  Sparkles,
  History,
  UploadCloud,
  FileText
} from 'lucide-react';

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('karventer_user') || 'null') || {};
  } catch {
    return {};
  }
}

function roleOf(user) {
  return String(user?.role || user?.rol || '').toLocaleLowerCase('tr-TR');
}

const adminMenuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/live', icon: Radio, label: 'Canlı Takip' },
  { path: '/inventory', icon: Package, label: 'Stok' },
  { path: '/sales', icon: BarChart3, label: 'Satış' },
  { path: '/transfers', icon: ArrowRightLeft, label: 'Transferler' },
  { path: '/requests', icon: FileText, label: 'Talepler' },
  { path: '/markets', icon: Store, label: 'Lokasyonlar' },
  { path: '/assistant', icon: Sparkles, label: 'AI Asistan' },
  { path: '/operations', icon: History, label: 'İşlem Geçmişi' },
  { path: '/data-import', icon: UploadCloud, label: 'Veri Aktarımı' }
];

const staffMenuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/inventory', icon: Package, label: 'Stok' },
  { path: '/requests', icon: FileText, label: 'Taleplerim' },
  { path: '/assistant', icon: Sparkles, label: 'AI Asistan' }
];

export default function Sidebar({ user: propUser }) {
  const location = useLocation();
  const user = propUser || currentUser();
  const isAdmin = useMemo(() => ['admin', 'yonetici', 'yönetici'].includes(roleOf(user)), [user]);
  const menuItems = isAdmin ? adminMenuItems : staffMenuItems;

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    if (path === '/markets') return location.pathname === '/markets' || location.pathname.startsWith('/market/');
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  return (
    <aside className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-200 bg-white/92 backdrop-blur-xl lg:bottom-0 lg:right-auto lg:top-[72px] lg:w-[240px] lg:border-r lg:border-t-0">
      <nav className="flex gap-2 overflow-x-auto p-3 lg:block lg:space-y-1.5 lg:p-4">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`group relative flex h-12 shrink-0 items-center gap-3 rounded-2xl px-4 font-semibold transition-all ${
                active
                  ? 'bg-blue-700 text-white shadow-[0_14px_26px_rgba(37,99,235,0.20)]'
                  : 'text-slate-600 hover:bg-blue-50 hover:text-blue-700'
              }`}
            >
              <Icon size={19} className={active ? 'text-white' : 'text-slate-500 group-hover:text-blue-700'} />
              <span className="whitespace-nowrap text-sm font-black">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
