// frontend/src/services/api.js

import axios from 'axios';

const api = axios.create({
  baseURL: 'https://mph-receiver-columbus-throughout.trycloudflare.com',
  timeout: 15000
});

export function apiErrorMessage(error, fallback = 'İşlem tamamlanamadı.') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) return detail.map((item) => item.msg || item.message || String(item)).join(' ');
  if (error?.code === 'ECONNABORTED') return 'Sunucudan yanıt alınamadı. Bağlantı veya backend durumunu kontrol et.';
  if (!error?.response) return 'Backend bağlantısı kurulamadı.';
  return fallback;
}

export function extractRows(response) {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.rows)) return data.rows;
  if (Array.isArray(data?.alerts)) return data.alerts;
  if (Array.isArray(data?.transfers)) return data.transfers;
  if (Array.isArray(data?.stocks)) return data.stocks;
  if (Array.isArray(data?.markets)) return data.markets;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.ai_oneriler)) return data.ai_oneriler;
  return [];
}

const apiCache = new Map();

export function clearApiCache() {
  apiCache.clear();
}

export async function cachedGet(url, options = {}) {
  const maxAgeMs = options.maxAgeMs ?? 30000;
  const force = options.force ?? false;
  const now = Date.now();
  const cached = apiCache.get(url);
  if (!force && cached && now - cached.time < maxAgeMs) {
    return cached.response;
  }
  const response = await api.get(url);
  apiCache.set(url, { time: now, response });
  return response;
}

if (typeof window !== 'undefined') {
  window.addEventListener('karventer:refresh-cache-clear', clearApiCache);
}

api.interceptors.request.use((config) => {
  const t = localStorage.getItem('karventer_token');
  if (t) {
    config.headers.Authorization = `Bearer ${t}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('karventer_token');
      localStorage.removeItem('karventer_user');
      window.dispatchEvent(new CustomEvent('karventer:auth-expired'));
    }
    return Promise.reject(error);
  }
);

export default api;
