// frontend/src/App.jsx

import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import FloatingActions from './components/FloatingActions';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import LiveOps from './pages/LiveOps';
import Assistant from './pages/Assistant';
import Inventory from './pages/Inventory';
import Forecasts from './pages/Forecasts';
import Transfers from './pages/Transfers';
import Markets from './pages/Markets';
import MarketDetail from './pages/MarketDetail';
import Sales from './pages/Sales';
import Management from './pages/Management';
import Operations from './pages/Operations';
import StaffRequests from './pages/StaffRequests';
import DataImport from './pages/DataImport';
import DemoFlow from './pages/DemoFlow';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
);

function AuthenticatedLayout({ user, onLogout }) {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (sessionStorage.getItem('karventer_force_dashboard') === '1') {
      sessionStorage.removeItem('karventer_force_dashboard');
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      <Topbar user={user} onLogout={onLogout} />
      <Sidebar user={user} />

      <main className="min-h-screen pt-[72px] pb-[86px] lg:ml-[240px] lg:pb-0">
        <div className="mx-auto max-w-[1680px] p-4 sm:p-6 xl:p-8">
          <ErrorBoundary locationKey={location.key}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/live" element={<LiveOps />} />
              <Route path="/assistant" element={<Assistant />} />
              <Route path="/inventory" element={<Inventory />} />
              <Route path="/sales" element={<Sales />} />
              <Route path="/forecasts" element={<Forecasts />} />
              <Route path="/transfers" element={<Transfers />} />
              <Route path="/markets" element={<Markets />} />
              <Route path="/market/:id" element={<MarketDetail />} />
              <Route path="/management" element={<Management />} />
              <Route path="/operations" element={<Operations />} />
              <Route path="/requests" element={<StaffRequests />} />
              <Route path="/talepler" element={<StaffRequests />} />
              <Route path="/my-requests" element={<StaffRequests />} />
              <Route path="/data-import" element={<DataImport />} />
              <Route path="/demo-flow" element={<DemoFlow />} />
            </Routes>
          </ErrorBoundary>
        </div>
      </main>

      <FloatingActions />
    </div>
  );
}

function initialUser() {
  try {
    const storedUser = localStorage.getItem('karventer_user');
    return storedUser ? JSON.parse(storedUser) : null;
  } catch {
    return null;
  }
}

function clearAssistantStorage() {
  try {
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('karventer_web_assistant_messages_')) {
        localStorage.removeItem(key);
      }
    });
  } catch {
    // no-op
  }
}

export default function App() {
  const [isAuth, setIsAuth] = useState(() => Boolean(localStorage.getItem('karventer_token')));
  const [user, setUser] = useState(() => initialUser());

  useEffect(() => {
    const handleExpired = () => {
      setIsAuth(false);
      setUser(null);
    };
    window.addEventListener('karventer:auth-expired', handleExpired);
    return () => window.removeEventListener('karventer:auth-expired', handleExpired);
  }, []);

  const handleLogin = (loginUser) => {
    localStorage.removeItem('karventer_last_path');
    sessionStorage.setItem('karventer_force_dashboard', '1');
    try { window.history.pushState(null, '', '/'); } catch (_) {}
    setUser(loginUser || null);
    setIsAuth(true);
  };

  const handleLogout = () => {
    clearAssistantStorage();
    localStorage.removeItem('karventer_token');
    localStorage.removeItem('karventer_user');
    localStorage.removeItem('karventer_last_path');
    try { window.history.pushState(null, '', '/'); } catch (_) {}
    setUser(null);
    setIsAuth(false);
  };

  if (!isAuth) return <Login onLogin={handleLogin} />;

  return (
    <Router key={`auth-${user?.kullanici_id || user?.user_id || 'user'}`}>
      <AuthenticatedLayout user={user} onLogout={handleLogout} />
    </Router>
  );
}
