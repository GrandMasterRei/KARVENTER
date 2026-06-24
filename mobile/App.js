import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { CameraView, useCameraPermissions } from 'expo-camera';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Feather, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.111:8000';

const colors = {
  blue: '#2563EB',
  blueDark: '#1D4ED8',
  navy: '#07111F',
  slate: '#334155',
  muted: '#64748B',
  softText: '#94A3B8',
  line: '#DCE6F2',
  bg: '#F4F7FC',
  card: '#FFFFFF',
  softBlue: '#EFF6FF',
  green: '#16A34A',
  greenSoft: '#DCFCE7',
  red: '#DC2626',
  redSoft: '#FEE2E2',
  amber: '#D97706',
  amberSoft: '#FEF3C7',
  white: '#FFFFFF'
};

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

function normalize(value = '') {
  return String(value)
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .replaceAll('İ', 'i')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function rows(response) {
  const data = response?.data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data)) return data;
  return [];
}

function unwrap(response) {
  return response?.data?.data || response?.data || null;
}

function normalizeUserPayload(user) {
  if (!user) return null;
  return {
    ...user,
    user_id: user.user_id ?? user.id ?? user.kullanici_id ?? null,
    username: user.username || user.kullanici_adi || '',
    full_name: user.full_name || user.ad_soyad || user.name || '',
    role: user.role || user.rol || '',
    market_id: user.market_id ?? user.sube_id ?? user.market?.market_id ?? null,
    market_name: user.market_name || user.sube_adi || user.market?.name || user.market?.market_name || ''
  };
}

function apiErrorMessage(error, fallback = 'İşlem tamamlanamadı.') {
  const detail = error?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length > 0) return detail.map((item) => item.msg || item.message || String(item)).join(' ');
  if (!error?.response) return `Backend bağlantısı kurulamadı. API adresi: ${API_URL}`;
  return fallback;
}

function productName(item) {
  return item?.product_name || item?.name || item?.product?.product_name || item?.product?.name || 'Ürün';
}

function productSearchText(item) {
  return `${productName(item)} ${item?.category || item?.product_category || ''} ${item?.product_id || ''} ${item?.product?.product_id || ''} ${item?.sku || ''} ${item?.product?.sku || ''} ${item?.product_code || ''} ${item?.product?.product_code || ''} ${item?.barcode || ''} ${item?.product?.barcode || ''}`;
}

function productExactCodes(item) {
  return [
    item?.barcode,
    item?.product?.barcode,
    item?.product_barcode,
    item?.sku,
    item?.product?.sku,
    item?.product_code,
    item?.product?.product_code
  ].filter((value) => value !== null && value !== undefined && String(value).trim());
}

function codeVariants(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return [];
  const digits = raw.replace(/\D/g, '');
  const variants = new Set([normalize(raw)]);
  if (digits) {
    variants.add(normalize(digits));
    // EAN-13 barkodlar okutulunca 13 hane döner; seed/ürün kaydı bazı durumlarda
    // ilk 12 haneyi tutabilir. Bu eşleştirme gerçek barkod alanı varsa onu,
    // yoksa aynı barkodun checksum'sız halini yakalar.
    if (digits.length === 13) variants.add(normalize(digits.slice(0, 12)));
    if (digits.length === 12) variants.add(normalize(`0${digits}`));
  }
  return Array.from(variants).filter(Boolean);
}

function findStockByCode(stocks, code) {
  const scanned = new Set(codeVariants(code));
  if (scanned.size === 0) return null;
  return stocks.find((item) => productExactCodes(item).some((value) => codeVariants(value).some((variant) => scanned.has(variant)))) || null;
}

function statusLabel(status) {
  const map = {
    suggested: 'Öneri',
    pending: 'Bekliyor',
    approved: 'Onaylandı',
    rejected: 'Reddedildi',
    completed: 'Tamamlandı',
    cancelled: 'İptal',
    open: 'Açık',
    reviewed: 'Okundu',
    resolved: 'Kapalı',
    dismissed: 'Yok Sayıldı',
    active: 'Aktif',
    in_progress: 'Sürüyor',
    near_expiry: 'SKT Yakın',
    expired: 'SKT Geçmiş',
    depleted: 'Tükendi',
    critical: 'Kritik',
    high: 'Yüksek',
    medium: 'Orta',
    low: 'Düşük',
    staff_request: 'Personel Talebi',
    missing_stock_request: 'Eksik Stok Talebi',
    create_transfer: 'Transfer',
    update_stock: 'Stok Güncelleme'
  };
  return map[status] || status || '-';
}

function statusTone(status) {
  if (status === 'completed' || status === 'active' || status === 'reviewed' || status === 'low') return 'green';
  if (status === 'approved') return 'blue';
  if (status === 'rejected' || status === 'expired' || status === 'depleted' || status === 'critical' || status === 'high') return 'red';
  if (status === 'near_expiry' || status === 'suggested' || status === 'open' || status === 'pending' || status === 'medium') return 'amber';
  return 'gray';
}

function requestStatusLabel(status) {
  const key = String(status || '').toLowerCase();
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
  return map[key] || statusLabel(status);
}

function requestStatusTone(status) {
  const key = String(status || '').toLowerCase();
  if (['dismissed', 'rejected', 'cancelled'].includes(key)) return 'red';
  if (['reviewed', 'approved'].includes(key)) return 'blue';
  if (['resolved', 'completed'].includes(key)) return 'green';
  return 'amber';
}

function requestDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function marketIdOf(item, direction = 'target') {
  if (direction === 'source') {
    return item?.source_market_id ?? item?.from_market_id ?? item?.source_id ?? item?.from_market?.market_id ?? item?.source_market?.market_id ?? null;
  }
  return item?.target_market_id ?? item?.to_market_id ?? item?.destination_market_id ?? item?.target_id ?? item?.to_market?.market_id ?? item?.target_market?.market_id ?? null;
}

function marketNameOf(item, direction = 'target') {
  if (direction === 'source') return item?.source_market_name || item?.from_market_name || item?.source_market?.name || item?.source_market?.market_name || 'Kaynak';
  return item?.target_market_name || item?.to_market_name || item?.destination_market_name || item?.target_market?.name || item?.target_market?.market_name || 'Hedef';
}

function isStaffRequestAlert(item) {
  const haystack = normalize(`${item?.alert_type || ''} ${item?.type || ''} ${item?.category || ''} ${item?.source || ''} ${item?.title || ''} ${item?.message || ''}`);
  return (
    haystack.includes('staff_request') ||
    haystack.includes('missing_stock_request') ||
    haystack.includes('request') ||
    haystack.includes('personel') ||
    haystack.includes('talep')
  );
}

function isMobileVisibleAlert(item, user) {
  if (!item) return false;
  if (isStaffRequestAlert(item)) return false;
  const createdBy = item.created_by_user_id ?? item.user_id ?? item.created_by ?? null;
  if (createdBy !== null && createdBy !== undefined && user?.user_id && Number(createdBy) === Number(user.user_id)) return false;
  const alertMarketId = item.market_id ?? item.sube_id ?? item.branch_id ?? item.target_market_id ?? item.market?.market_id ?? null;
  if (alertMarketId !== null && alertMarketId !== undefined && user?.market_id && Number(alertMarketId) !== Number(user.market_id)) return false;
  return true;
}


function isAdminUser(user) {
  return ['admin', 'yonetici', 'yönetici'].includes(normalize(user?.role || ''));
}

function displayNameOf(user) {
  return user?.full_name || user?.username || 'Kullanıcı';
}

function profileScopeLabel(user) {
  if (isAdminUser(user)) return 'KARVENTER Yönetici';
  return user?.market_name || 'Lokasyon';
}

function profileRoleLabel(user) {
  if (isAdminUser(user)) return 'Yönetici';
  return 'Personel';
}

function assistantActionsFromPayload(payload) {
  const value = payload?.actions;
  if (!value) return [];
  if (Array.isArray(value)) return value.filter(Boolean);
  if (Array.isArray(value?.data)) return value.data.filter(Boolean);
  if (Array.isArray(value?.items)) return value.items.filter(Boolean);
  if (Array.isArray(value?.results)) return value.results.filter(Boolean);
  if (typeof value === 'object') return Object.values(value).filter((item) => item && typeof item === 'object' && (item.action_id || item.id));
  return [];
}

function isOperationalAlertForAdmin(item) {
  if (!item) return false;
  return !isStaffRequestAlert(item);
}

function activeTransferStatus(status) {
  return ['pending', 'suggested', 'open', 'approved', 'in_progress'].includes(String(status || '').toLowerCase());
}

function canAdminDecideTransfer(item) {
  return ['pending', 'suggested', 'open'].includes(String(item?.status || '').toLowerCase());
}

function AiMark({ active = false, size = 22 }) {
  return (
    <View style={[styles.aiMark, active && styles.aiMarkActive, { width: size + 6, height: size + 6, borderRadius: Math.round((size + 6) / 2) }]}>
      <MaterialIcons name="auto-awesome" size={size} color={active ? colors.blue : colors.softText} />
    </View>
  );
}

function KLogo({ size = 38 }) {
  return (
    <View style={[styles.kLogo, { width: size, height: size, borderRadius: Math.round(size * 0.28) }]}>
      <Text style={[styles.kLogoText, { fontSize: Math.round(size * 0.54) }]}>K</Text>
    </View>
  );
}

function isIncomingTransfer(item, user) {
  const targetId = marketIdOf(item, 'target');
  if (targetId !== null && targetId !== undefined && Number(targetId) === Number(user?.market_id)) return true;
  const targetName = normalize(marketNameOf(item, 'target'));
  const ownName = normalize(user?.market_name || '');
  return Boolean(ownName && targetName.includes(ownName));
}

function isBranchTransfer(item, user) {
  if (isIncomingTransfer(item, user)) return true;
  const sourceId = marketIdOf(item, 'source');
  if (sourceId !== null && sourceId !== undefined && Number(sourceId) === Number(user?.market_id)) return true;
  const sourceName = normalize(marketNameOf(item, 'source'));
  const ownName = normalize(user?.market_name || '');
  return Boolean(ownName && sourceName.includes(ownName));
}

function money(value) {
  const number = Number(value || 0);
  try {
    return new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 0 }).format(number) + ' TL';
  } catch (_error) {
    return `${Math.round(number)} TL`;
  }
}

function pct(value) {
  const n = Number(value || 0);
  if (n <= 1) return Math.round(n * 100);
  return Math.round(n);
}

async function getToken() {
  return AsyncStorage.getItem('karventer_mobile_token');
}

api.interceptors.request.use(async (config) => {
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

function AppSafeArea({ children, style, statusStyle = 'dark' }) {
  return (
    <SafeAreaView style={[styles.safe, style]}>
      <StatusBar style={statusStyle} />
      <View style={styles.androidStatusGap}>{children}</View>
    </SafeAreaView>
  );
}

function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

function Button({ title, onPress, loading, variant = 'primary', disabled, style }) {
  const secondary = variant === 'secondary';
  const danger = variant === 'danger';
  const ghost = variant === 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        danger && styles.buttonDanger,
        ghost && styles.buttonGhost,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !(disabled || loading) && styles.buttonPressed,
        style
      ]}
    >
      {loading ? <ActivityIndicator color={secondary || ghost ? colors.blue : colors.white} /> : <Text style={[styles.buttonText, (secondary || ghost) && styles.buttonSecondaryText]}>{title}</Text>}
    </Pressable>
  );
}

function Badge({ label, tone = 'blue', style }) {
  const palette = {
    blue: { bg: colors.softBlue, fg: colors.blue },
    red: { bg: colors.redSoft, fg: colors.red },
    green: { bg: colors.greenSoft, fg: colors.green },
    amber: { bg: colors.amberSoft, fg: colors.amber },
    gray: { bg: '#F1F5F9', fg: colors.slate },
    dark: { bg: colors.navy, fg: colors.white }
  }[tone] || { bg: colors.softBlue, fg: colors.blue };
  return <View style={[styles.badge, { backgroundColor: palette.bg }, style]}><Text style={[styles.badgeText, { color: palette.fg }]}>{label}</Text></View>;
}

function Empty({ title = 'Kayıt yok', text }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyMark}>—</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
    </View>
  );
}

function Screen({ children, scroll = true, refreshControl, contentStyle }) {
  const content = <View style={[styles.screenContent, contentStyle]}>{children}</View>;
  if (!scroll) return content;
  return <ScrollView keyboardShouldPersistTaps="handled" refreshControl={refreshControl} contentContainerStyle={styles.scrollGrow}>{content}</ScrollView>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    // Demo ve sınav akışı için uygulama her açılışta giriş ekranından başlar.
    Promise.all([
      AsyncStorage.removeItem('karventer_mobile_token'),
      AsyncStorage.removeItem('karventer_mobile_user')
    ]).finally(() => setBooting(false));
  }, []);

  if (booting) {
    return (
      <AppSafeArea>
        <View style={styles.center}><ActivityIndicator color={colors.blue} size="large" /></View>
      </AppSafeArea>
    );
  }

  if (!user) return <LoginScreen onLogin={setUser} />;
  return <MainApp user={user} onLogout={() => setUser(null)} />;
}

function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!username.trim() || !password.trim()) {
      Alert.alert('Eksik bilgi', 'Kullanıcı adı ve şifre gir.');
      return;
    }
    setLoading(true);
    try {
      const body = new URLSearchParams();
      body.append('username', username.trim());
      body.append('password', password);
      const response = await api.post('/api/auth/giris', body.toString(), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });
      const { access_token, user } = response.data;
      const normalizedUser = normalizeUserPayload(user);
      await AsyncStorage.setItem('karventer_mobile_token', access_token);
      await AsyncStorage.setItem('karventer_mobile_user', JSON.stringify(normalizedUser));
      onLogin(normalizedUser);
    } catch (error) {
      Alert.alert('Giriş başarısız', apiErrorMessage(error, 'Kullanıcı adı veya şifre hatalı.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppSafeArea style={styles.loginBg} statusStyle="light">
      <View style={styles.loginStage}>
        <View style={styles.loginCardWeb}>
          <View style={styles.loginBrandWrap}>
            <KLogo size={50} />
            <Text style={styles.loginBrandWeb}>KARVENTER</Text>
          </View>
          <View style={styles.loginForm}>
            <Text style={styles.label}>Kullanıcı adı</Text>
            <View style={styles.loginInputWrap}>
              <Feather name="user" size={19} color={colors.softText} />
              <TextInput
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.loginInput}
                placeholder="Kullanıcı adınızı girin"
                placeholderTextColor={colors.softText}
              />
            </View>
            <Text style={styles.label}>Şifre</Text>
            <View style={styles.loginInputWrap}>
              <Feather name="lock" size={19} color={colors.softText} />
              <TextInput
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                style={styles.loginInput}
                placeholder="Şifrenizi girin"
                placeholderTextColor={colors.softText}
              />
            </View>
            <Button title="Giriş Yap" onPress={submit} loading={loading} style={styles.loginButton} />
          </View>
        </View>
      </View>
    </AppSafeArea>
  );
}


function MainApp({ user, onLogout }) {
  const admin = isAdminUser(user);
  const [tab, setTab] = useState('home');
  const [alertsCount, setAlertsCount] = useState(0);

  const loadTopStatus = useCallback(async () => {
    try {
      const params = admin ? { status: 'open', limit: 200 } : { market_id: user.market_id, status: 'open', limit: 100 };
      const response = await api.get('/api/alerts', { params });
      const visibleAlerts = rows(response).filter((item) => admin ? isOperationalAlertForAdmin(item) : isMobileVisibleAlert(item, user));
      setAlertsCount(visibleAlerts.length);
    } catch (_error) {
      setAlertsCount(0);
    }
  }, [admin, user?.market_id, user?.user_id]);

  useEffect(() => { loadTopStatus(); }, [loadTopStatus]);

  const title = admin ? {
    home: 'Yönetim Özeti',
    requests: 'Personel Talepleri',
    approvals: 'Onaylar',
    transfer: 'Transferler',
    assistant: 'KARVAI',
    alerts: 'Bildirimler',
    profile: 'Hesap'
  }[tab] : {
    home: 'Saha Kontrol',
    stock: 'Stok Sayımı',
    request: 'Talep',
    transfer: 'Transferler',
    assistant: 'KARVAI',
    alerts: 'Bildirimler',
    profile: 'Hesap'
  }[tab];

  return (
    <AppSafeArea>
      <View style={styles.shellHeader}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text numberOfLines={1} style={styles.shellTitle}>{title}</Text>
        </View>
        <Pressable onPress={() => setTab('profile')} style={({ pressed }) => [styles.profilePill, pressed && styles.buttonPressed]}>
          <View style={styles.profileDot}><Feather name="user" size={16} color={colors.white} /></View>
          <View style={styles.profilePillTextWrap}>
            <Text numberOfLines={1} style={styles.profilePillName}>{displayNameOf(user)}</Text>
            <Text numberOfLines={1} style={styles.profilePillMarket}>{profileScopeLabel(user)}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setTab('alerts')} style={({ pressed }) => [styles.bellButton, pressed && styles.buttonPressed]}>
          <Feather name="bell" size={22} color={colors.blue} />
          {alertsCount > 0 ? <View style={styles.bellDot}><Text style={styles.bellDotText}>{alertsCount > 99 ? '99+' : alertsCount}</Text></View> : null}
        </Pressable>
      </View>

      <View style={styles.mainArea}>
        {tab === 'home' && (admin ? <AdminHomeScreen user={user} setTab={setTab} refreshTop={loadTopStatus} /> : <StaffHomeScreen user={user} setTab={setTab} refreshTop={loadTopStatus} />)}
        {!admin && tab === 'stock' && <StockScreen user={user} />}
        {!admin && tab === 'request' && <RequestScreen user={user} />}
        {admin && tab === 'requests' && <AdminRequestsScreen user={user} refreshTop={loadTopStatus} />}
        {admin && tab === 'approvals' && <AdminApprovalsScreen user={user} />}
        {tab === 'transfer' && <TransferScreen user={user} admin={admin} refreshTop={loadTopStatus} />}
        {tab === 'assistant' && <AssistantScreen user={user} />}
        {tab === 'alerts' && <AlertsScreen user={user} admin={admin} refreshTop={loadTopStatus} />}
        {tab === 'profile' && <ProfileScreen user={user} onLogout={onLogout} />}
      </View>

      <BottomNav tab={tab} setTab={setTab} admin={admin} />
    </AppSafeArea>
  );
}


function BottomNav({ tab, setTab, admin = false }) {
  const staffItems = [
    { key: 'home', label: 'Saha', icon: 'grid' },
    { key: 'stock', label: 'Stok', icon: 'package' },
    { key: 'request', label: 'Talep', icon: 'file-text' },
    { key: 'transfer', label: 'Transfer', icon: 'repeat' },
    { key: 'assistant', label: 'KARVAI', icon: 'ai' }
  ];
  const adminItems = [
    { key: 'home', label: 'Özet', icon: 'grid' },
    { key: 'requests', label: 'Talepler', icon: 'inbox' },
    { key: 'approvals', label: 'Onaylar', icon: 'check-square' },
    { key: 'transfer', label: 'Transfer', icon: 'repeat' },
    { key: 'assistant', label: 'KARVAI', icon: 'ai' }
  ];
  const items = admin ? adminItems : staffItems;
  return (
    <View style={styles.tabbar}>
      {items.map((item) => {
        const active = tab === item.key;
        return (
          <Pressable key={item.key} onPress={() => setTab(item.key)} style={({ pressed }) => [styles.tabItem, active && styles.tabItemActive, pressed && styles.buttonPressed]}>
            {item.icon === 'ai' ? <AiMark active={active} size={18} /> : <Feather name={item.icon} size={21} color={active ? colors.blue : colors.softText} />}
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}


function StaffHomeScreen({ user, setTab, refreshTop }) {
  const [summary, setSummary] = useState({ stock_record_count: 0, critical_stock_count: 0, active_transfer_count: 0, open_alert_count: 0 });
  const [priorityRows, setPriorityRows] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!user?.market_id) return;
    setLoading(true);
    try {
      const [summaryResult, stocksResult, transfersResult, alertsResult] = await Promise.allSettled([
        api.get('/api/mobile/branch-summary', { params: { market_id: user.market_id } }),
        api.get('/api/stocks', { params: { market_id: user.market_id, limit: 500 } }),
        api.get('/api/transfers', { params: { market_id: user.market_id, limit: 200, user_id: user?.user_id } }),
        api.get('/api/alerts', { params: { market_id: user.market_id, status: 'open', limit: 100 } })
      ]);

      const base = summaryResult.status === 'fulfilled' ? unwrap(summaryResult.value) || {} : {};
      const stockList = stocksResult.status === 'fulfilled' ? rows(stocksResult.value) : [];
      const transferList = transfersResult.status === 'fulfilled' ? rows(transfersResult.value) : [];
      const alertList = alertsResult.status === 'fulfilled' ? rows(alertsResult.value).filter((item) => isMobileVisibleAlert(item, user)) : [];
      const critical = stockList.filter((item) => {
        const qty = Number(item.quantity || 0);
        const min = Number(item.min_stock ?? item.min_stock_level ?? item.product?.min_stock_level ?? 0);
        return item.status === 'critical' || (min > 0 && qty <= min);
      }).length;
      const activeTransferRows = transferList.filter((item) => isIncomingTransfer(item, user) && ['approved', 'in_progress'].includes(String(item.status || '').toLowerCase()));
      const activeTransfers = activeTransferRows.length;
      const criticalRows = stockList.filter((item) => {
        const qty = Number(item.quantity || 0);
        const min = Number(item.min_stock ?? item.min_stock_level ?? item.product?.min_stock_level ?? 0);
        return item.status === 'critical' || (min > 0 && qty <= min);
      });

      setSummary({
        market_name: base.market_name || user?.market_name,
        stock_record_count: stockList.length || base.stock_record_count || 0,
        critical_stock_count: critical || base.critical_stock_count || 0,
        active_transfer_count: activeTransfers || base.active_transfer_count || 0,
        open_alert_count: alertList.length || base.open_alert_count || 0
      });
      setPriorityRows([
        ...criticalRows.slice(0, 2).map((item) => ({
          key: `stock-${item.stock_id || item.product_id}`,
          tab: 'stock',
          title: productName(item),
          text: `${Math.round(Number(item.quantity || 0))} adet • min ${item.min_stock ?? item.min_stock_level ?? item.product?.min_stock_level ?? '-'}`
        })),
        ...activeTransferRows.slice(0, 1).map((item) => ({
          key: `transfer-${item.transfer_id}`,
          tab: 'transfer',
          title: item.product_name || item.product?.product_name || 'Transfer görevi',
          text: `${marketNameOf(item, 'source')} → ${marketNameOf(item, 'target')}`
        })),
        ...alertList.slice(0, 1).map((item) => ({
          key: `alert-${item.alert_id}`,
          tab: 'alerts',
          title: item.title || 'Bildirim',
          text: item.message || item.market_name || 'Açık bildirim'
        }))
      ].slice(0, 4));
      refreshTop?.();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [user?.market_id]);

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <View style={styles.heroCardCompact}>
        <Text style={styles.heroTitleCompact}>{summary?.market_name || user?.market_name || 'KARVENTER'}</Text>
      </View>
      <View style={styles.grid2Compact}>
        <Metric label="Stok" value={summary.stock_record_count} onPress={() => setTab('stock')} />
        <Metric label="Kritik" value={summary.critical_stock_count} tone="red" onPress={() => setTab('alerts')} />
        <Metric label="Transfer" value={summary.active_transfer_count} tone="amber" onPress={() => setTab('transfer')} />
        <Metric label="Bildirim" value={summary.open_alert_count} tone="blue" onPress={() => setTab('alerts')} />
      </View>
      <Card style={styles.actionCardCompact}>
        <Text style={styles.cardTitle}>Öncelikli İşler</Text>
        <Text style={styles.cardText}>Kartlardan ilgili ekrana geçebilir, acil kayıtları buradan takip edebilirsin.</Text>
        <View style={styles.miniList}>
          {priorityRows.map((item) => (
            <Pressable key={item.key} onPress={() => setTab(item.tab)} style={({ pressed }) => [styles.miniListItem, pressed && styles.buttonPressed]}>
              <Text numberOfLines={1} style={styles.miniListTitle}>{item.title}</Text>
              <Text numberOfLines={1} style={styles.miniListText}>{item.text}</Text>
            </Pressable>
          ))}
          {priorityRows.length === 0 ? <Text style={styles.cardText}>Şu anda acil saha işi görünmüyor. Stok sayımı, talep ve transfer işlemleri üst kartlardan yönetilebilir.</Text> : null}
        </View>
      </Card>
    </Screen>
  );
}

function AdminHomeScreen({ user, setTab, refreshTop }) {
  const [summary, setSummary] = useState({ requests: 0, actions: 0, transfers: 0, karvai: '-' });
  const [recent, setRecent] = useState({ requests: [], actions: [], transfers: [] });
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [alertsResult, actionsResult, transfersResult, statusResult] = await Promise.allSettled([
        api.get('/api/alerts', { params: { status: 'open', limit: 300 } }),
        api.get('/api/assistant/actions', { params: { status: 'pending', limit: 100, user_id: user?.user_id } }),
        api.get('/api/transfers', { params: { limit: 300, user_id: user?.user_id } }),
        api.get('/api/assistant/status')
      ]);
      const alerts = alertsResult.status === 'fulfilled' ? rows(alertsResult.value) : [];
      const actions = actionsResult.status === 'fulfilled' ? rows(actionsResult.value) : [];
      const transfers = transfersResult.status === 'fulfilled' ? rows(transfersResult.value) : [];
      const karvaiReady = statusResult.status === 'fulfilled' && Boolean(statusResult.value?.data?.ready);
      const requestRows = alerts.filter(isStaffRequestAlert);
      const activeTransfers = transfers.filter((item) => activeTransferStatus(item.status));
      setSummary({
        requests: requestRows.length,
        actions: actions.length,
        transfers: activeTransfers.length,
        karvai: karvaiReady ? 'Aktif' : 'Kontrol'
      });
      setRecent({
        requests: requestRows.slice(0, 2),
        actions: actions.slice(0, 2),
        transfers: activeTransfers.slice(0, 2)
      });
      refreshTop?.();
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}>
      <View style={styles.heroCardCompact}>
        <Text style={styles.heroTitleCompact}>Yönetim</Text>
      </View>
      <View style={styles.grid2Compact}>
        <Metric label="Talepler" value={summary.requests} tone="amber" onPress={() => setTab('requests')} />
        <Metric label="Onaylar" value={summary.actions} tone="blue" onPress={() => setTab('approvals')} />
        <Metric label="Transferler" value={summary.transfers} tone="green" onPress={() => setTab('transfer')} />
        <Metric label="KARVAI" value={summary.karvai} tone="blue" onPress={() => setTab('assistant')} />
      </View>
      <Card style={styles.actionCardCompact}>
        <View style={styles.rowCardNoMargin}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Öncelikli Yönetim</Text>
            <Text style={styles.cardText}>Bekleyen talepler, onaylar ve transferler</Text>
          </View>
          <Badge label={summary.actions + summary.requests + summary.transfers > 0 ? 'İş var' : 'Sakin'} tone={summary.actions + summary.requests + summary.transfers > 0 ? 'amber' : 'blue'} />
        </View>
        <View style={styles.miniList}>
          {[...recent.actions, ...recent.requests, ...recent.transfers].slice(0, 5).map((item, index) => (
            <Pressable key={`${item.action_id || item.alert_id || item.transfer_id || index}`} onPress={() => setTab(item.action_id ? 'approvals' : item.alert_id ? 'requests' : 'transfer')} style={({ pressed }) => [styles.miniListItem, pressed && styles.buttonPressed]}>
              <Text numberOfLines={1} style={styles.miniListTitle}>{item.title || item.product_name || 'Bekleyen işlem'}</Text>
              <Text numberOfLines={1} style={styles.miniListText}>{item.description || item.message || `${marketNameOf(item, 'source')} → ${marketNameOf(item, 'target')}`}</Text>
            </Pressable>
          ))}
          {recent.actions.length + recent.requests.length + recent.transfers.length === 0 ? <Text style={styles.cardText}>Şu anda bekleyen yönetim işi yok. Talepler, onaylar ve transferler üst kartlardan açılır.</Text> : null}
        </View>
      </Card>
    </Screen>
  );
}

function Metric({ label, value, tone = 'blue', onPress }) {
  const color = tone === 'red' ? colors.red : tone === 'amber' ? colors.amber : tone === 'green' ? colors.green : colors.blue;
  const content = (
    <>
      <Text style={[styles.metricValue, { color }]}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [styles.card, styles.metric, pressed && styles.buttonPressed]}>
        {content}
      </Pressable>
    );
  }
  return <Card style={styles.metric}>{content}</Card>;
}

function QuickAction({ title, icon, onPress }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.quickActionCompact, pressed && styles.buttonPressed]}>
      <View style={styles.quickIcon}>
        <Feather name={icon} size={22} color={colors.blue} />
      </View>
      <Text style={styles.quickTitleCompact}>{title}</Text>
    </Pressable>
  );
}

function StockScreen({ user }) {
  const [stocks, setStocks] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [quantity, setQuantity] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  async function load() {
    if (!user?.market_id) return;
    setLoading(true);
    try {
      setStocks(rows(await api.get('/api/stocks', { params: { market_id: user.market_id, limit: 500 } })));
    } catch (error) {
      Alert.alert('Stok alınamadı', apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [user?.market_id]);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return stocks;
    return stocks.filter((item) => normalize(productSearchText(item)).includes(q));
  }, [stocks, query]);

  function selectStockItem(item) {
    setSelected(item);
    setQuantity(String(Math.round(Number(item.quantity || 0))));
  }

  async function openScanner() {
    const currentPermission = cameraPermission?.granted ? cameraPermission : await requestCameraPermission();
    if (!currentPermission?.granted) {
      Alert.alert('Kamera izni gerekli', 'Barkod taramak için kamera izni verin. Manuel kod araması yine kullanılabilir.');
      return;
    }
    setManualBarcode('');
    setScanLocked(false);
    setScannerOpen(true);
  }

  async function handleScannedCode(rawValue) {
    const value = String(rawValue || '').trim();
    if (!value) return;
    setScannerOpen(false);
    setQuery('');
    setSaving(true);
    try {
      const response = await api.post('/api/stocks/barcode-scan', {
        barcode: value,
        market_id: user.market_id,
        user_id: user.user_id,
        created_by_user_id: user.user_id
      });
      const data = response?.data || {};
      const product = data.product || data.stock?.product || {};
      const stock = data.stock || null;
      const selectedItem = stock ? { ...stock, product, product_id: product.product_id || stock.product_id, product_name: product.product_name || stock.product_name, barcode: product.barcode || stock.barcode } : {
        product_id: product.product_id,
        product_name: product.product_name,
        barcode: product.barcode,
        category: product.category,
        quantity: data.before_quantity ?? 0,
        min_stock_level: product.min_stock_level,
        market_id: data.market?.market_id || user.market_id,
        market_name: data.market?.market_name || data.market?.name || user.market_name
      };
      setSelected(selectedItem);
      setQuantity(String(Math.round(Number(selectedItem.quantity || 0))));
      await load();
      const beforeQty = Number(data.before_quantity ?? 0);
      const afterQty = Number(data.after_quantity ?? selectedItem.quantity ?? 0);
      Alert.alert('Barkod sayımı işlendi', `${product.product_name || productName(selectedItem)} • ${product.barcode || value}
Stok ${beforeQty} → ${afterQty} olarak güncellendi.`);
    } catch (error) {
      setSelected(null);
      setQuantity('');
      Alert.alert('Barkod bulunamadı', apiErrorMessage(error, `Bu barkoda bağlı aktif ürün bulunamadı. Okunan kod: ${value || '-'}`));
    } finally {
      setSaving(false);
      setScanLocked(false);
    }
  }


  function onBarcodeScanned(result) {
    if (scanLocked || saving) return;
    const code = result?.data || result?.rawValue || result?.code || result?.text || result?.barcode;
    setScanLocked(true);
    handleScannedCode(code);
  }

  async function saveCount() {
    if (!selected) return;
    const nextQty = Number(quantity);
    if (!Number.isFinite(nextQty) || nextQty < 0) return Alert.alert('Geçersiz stok', 'Stok miktarı 0 veya daha büyük olmalı.');
    const productId = selected.product_id ?? selected.product?.product_id;
    if (!productId) return Alert.alert('Ürün seçilemedi', 'Stok sayımı için katalog ürünü seçilmelidir.');
    setSaving(true);
    try {
      await api.post('/api/stocks', {
        product_id: productId,
        market_id: user.market_id,
        quantity: nextQty,
        barcode: selected.barcode ?? selected.product?.barcode,
        user_id: user.user_id,
        created_by_user_id: user.user_id,
        source: 'mobile_stock_count',
        note: 'Mobil personel stok sayımı/güncelleme'
      });
      setSelected(null);
      setQuantity('');
      await load();
      Alert.alert('Stok güncellendi', `${productName(selected)} için stok ${nextQty} adet olarak işlendi.`);
    } catch (error) {
      Alert.alert('Stok güncellenemedi', apiErrorMessage(error));
    } finally {
      setSaving(false);
    }
  }


  return (
    <Screen scroll={false} contentStyle={{ paddingBottom: 0 }}>
      <View style={styles.searchRow}>
        <View style={styles.searchWrapInline}>
          <Feather name="search" size={20} color={colors.softText} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            style={styles.searchInput}
            placeholder="Ürün adı, kod veya barkod ara"
            placeholderTextColor={colors.softText}
          />
        </View>
        <Pressable
          onPress={openScanner}
          accessibilityRole="button"
          accessibilityLabel="Barkod tarama"
          style={({ pressed }) => [styles.scanIconButton, pressed && styles.buttonPressed]}
        >
          <MaterialCommunityIcons name="barcode-scan" size={26} color={colors.blue} />
        </Pressable>
      </View>
      <Modal visible={scannerOpen} animationType="slide" onRequestClose={() => setScannerOpen(false)}>
        <AppSafeArea style={styles.scannerScreen} statusStyle="light">
          <View style={styles.scannerHeader}>
            <Text style={styles.scannerTitle}>Barkod okut</Text>
            <Pressable onPress={() => setScannerOpen(false)} style={({ pressed }) => [styles.scannerClose, pressed && styles.buttonPressed]}>
              <Feather name="x" size={24} color={colors.white} />
            </Pressable>
          </View>
          <CameraView
            key={scannerOpen ? 'camera-open' : 'camera-closed'}
            style={styles.cameraView}
            facing="back"
            active={scannerOpen}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39'] }}
            onBarcodeScanned={scanLocked ? undefined : onBarcodeScanned}
          >
            <View style={styles.scanFrame}>
              <View style={styles.scanFrameBox} />
            </View>
          </CameraView>
          <View style={styles.scannerFooter}>
            <Text style={styles.scannerFooterText}>Kamera siyah görünürse barkodu manuel girerek de sayımı işleyebilirsiniz.</Text>
            <TextInput
              value={manualBarcode}
              onChangeText={setManualBarcode}
              keyboardType="numeric"
              style={styles.input}
              placeholder="Barkod numarası"
              placeholderTextColor={colors.softText}
            />
            <View style={styles.buttonRow}>
              <Button title="Manuel İşle" onPress={() => handleScannedCode(manualBarcode)} loading={saving} style={{ flex: 1 }} />
              <Button title="Kapat" onPress={() => setScannerOpen(false)} variant="secondary" style={{ flex: 1 }} />
            </View>
          </View>
        </AppSafeArea>
      </Modal>
      {selected ? (
        <Card style={styles.editPanel}>
          <View style={styles.rowCardNoMargin}>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{productName(selected)}</Text>
              <Text style={styles.muted}>Mevcut stok: {Math.round(Number(selected.quantity || 0))} adet</Text>
            </View>
            <Badge label="Sayım" tone="blue" />
          </View>
          <TextInput value={quantity} onChangeText={setQuantity} keyboardType="numeric" style={styles.input} placeholder="Yeni stok miktarı" placeholderTextColor={colors.softText} />
          <View style={styles.buttonRow}>
            <Button title="Stok Kaydet" onPress={saveCount} loading={saving} style={{ flex: 1 }} />
            <Button title="Vazgeç" onPress={() => setSelected(null)} variant="secondary" style={{ flex: 1 }} />
          </View>
        </Card>
      ) : null}
      <FlatList
        data={filtered}
        keyExtractor={(item, index) => `${item.market_id || user?.market_id}-${item.product_id || index}`}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={<Empty title="Stok kaydı yok" text="Bu şube için ürün kaydı bulunamadı." />}
        renderItem={({ item }) => <StockRow item={item} onPress={() => selectStockItem(item)} />}
        contentContainerStyle={{ paddingBottom: 26 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function StockRow({ item, onPress }) {
  const qty = Math.round(Number(item.quantity || 0));
  const min = Math.round(Number(item.min_stock ?? item.min_stock_level ?? item.product?.min_stock_level ?? 0));
  const max = Math.round(Number(item.max_stock ?? item.max_stock_level ?? item.product?.max_stock_level ?? 0));
  const tone = qty <= min ? 'red' : max > 0 && qty > max ? 'amber' : 'green';
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.buttonPressed}>
      <Card style={styles.rowCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{productName(item)}</Text>
          <Text style={styles.rowMeta}>{item.category || item.product_category || 'Kategori'} • Min: {min}{max ? ` • Max: ${max}` : ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Text style={styles.qty}>{qty}</Text>
          <Badge label={tone === 'red' ? 'Kritik' : tone === 'amber' ? 'Fazla' : 'Normal'} tone={tone} />
        </View>
      </Card>
    </Pressable>
  );
}


function TransferScreen({ user, admin = false, refreshTop }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = admin ? { limit: 300, user_id: user?.user_id } : { market_id: user.market_id, limit: 200, user_id: user?.user_id };
      const data = rows(await api.get('/api/transfers', { params }));
      const branchTransfers = data.filter((item) => {
        if (!activeTransferStatus(item.status)) return false;
        if (admin) return true;
        return isIncomingTransfer(item, user);
      });
      setItems(branchTransfers.sort((a, b) => String(a.status || '').localeCompare(String(b.status || ''), 'tr')));
      refreshTop?.();
    } catch (error) {
      Alert.alert('Transfer alınamadı', apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [user?.market_id, admin]);

  async function complete(item) {
    setBusyId(item.transfer_id);
    try {
      await api.post(`/api/transfers/${item.transfer_id}/complete`, null, { params: { user_id: user?.user_id } });
      await load();
      Alert.alert('Transfer tamamlandı', 'Teslim alma kaydı işlendi.');
    } catch (error) {
      Alert.alert('Transfer tamamlanamadı', apiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function decide(item, status) {
    setBusyId(`${item.transfer_id}-${status}`);
    try {
      await api.patch(`/api/transfers/${item.transfer_id}/decision`, { status, user_id: user?.user_id });
      await load();
    } catch (error) {
      Alert.alert('Transfer güncellenemedi', apiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen scroll={false} contentStyle={{ paddingBottom: 0 }}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.transfer_id || index)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={<Empty title="Transfer görevi yok" />}
        renderItem={({ item }) => <TransferRow item={item} ownMarketId={user?.market_id} admin={admin} onComplete={() => complete(item)} onApprove={() => decide(item, 'approved')} onReject={() => decide(item, 'rejected')} loading={String(busyId || '').startsWith(String(item.transfer_id))} />}
        contentContainerStyle={{ paddingBottom: 26, gap: 10 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function TransferRow({ item, ownMarketId, admin, onComplete, onApprove, onReject, loading }) {
  const incoming = Number(marketIdOf(item, 'target')) === Number(ownMarketId);
  const itemStatus = String(item.status || '').toLowerCase();
  const canComplete = ['approved', 'in_progress'].includes(itemStatus) && (admin || incoming);
  const canDecide = admin && canAdminDecideTransfer(item);
  const confidence = item.confidence ?? item.ai_confidence;
  return (
    <Card style={styles.transferCard}>
      <View style={styles.rowCardNoMargin}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{productName(item)}</Text>
          <Text style={styles.rowMeta}>{marketNameOf(item, 'source')} → {marketNameOf(item, 'target')}</Text>
        </View>
        <Badge label={admin ? statusLabel(item.status) : (incoming ? 'Gelen' : 'Giden')} tone={statusTone(item.status)} />
      </View>
      <View style={styles.transferStats}>
        <View><Text style={styles.statLabel}>Miktar</Text><Text style={styles.statValue}>{Math.round(Number(item.quantity || 0))} adet</Text></View>
        <View><Text style={styles.statLabel}>Durum</Text><Text style={styles.statValue}>{statusLabel(item.status)}</Text></View>
        {confidence !== undefined ? <View><Text style={styles.statLabel}>AI</Text><Text style={styles.statValue}>Güven %{pct(confidence)}</Text></View> : null}
      </View>
      {item.estimated_gain || item.estimated_profit_gain ? <Text style={styles.cardText}>Tahmini katkı: {money(item.estimated_gain || item.estimated_profit_gain)}</Text> : null}
      {canDecide ? <View style={styles.buttonRow}><Button title="Onayla" onPress={onApprove} loading={loading} style={{ flex: 1 }} /><Button title="Reddet" onPress={onReject} variant="secondary" style={{ flex: 1 }} /></View> : null}
      {canComplete ? <Button title="Teslim Al ve Tamamla" onPress={onComplete} loading={loading} /> : null}
    </Card>
  );
}

function AdminRequestsScreen({ user, refreshTop }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const response = await api.get('/api/alerts', { params: { status: 'open', limit: 300 } });
      setItems(rows(response).filter(isStaffRequestAlert));
      refreshTop?.();
    } catch (error) {
      Alert.alert('Talep alınamadı', apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function update(item, status) {
    setBusyId(`${item.alert_id}-${status}`);
    try {
      await api.patch(`/api/alerts/${item.alert_id}/status`, { status });
      await load();
    } catch (error) {
      Alert.alert('Talep güncellenemedi', apiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen scroll={false} contentStyle={{ paddingBottom: 0 }}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.alert_id || index)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={<Empty title="Personel talebi yok" />}
        renderItem={({ item }) => (
          <Card style={styles.alertCard}>
            <View style={styles.rowCardNoMargin}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title || 'Talep'}</Text>
                <Text style={styles.rowMeta}>{item.market_name || item.market?.name || 'Şube'} • {statusLabel(item.severity)}</Text>
              </View>
              <Badge label={statusLabel(item.severity)} tone={statusTone(item.severity)} />
            </View>
            {item.message ? <Text style={styles.cardText}>{item.message}</Text> : null}
            <View style={styles.buttonRow}>
              <Button title="Onayla" onPress={() => update(item, 'reviewed')} loading={String(busyId || '').startsWith(String(item.alert_id))} style={{ flex: 1 }} />
              <Button title="Reddet" onPress={() => update(item, 'dismissed')} variant="secondary" style={{ flex: 1 }} />
            </View>
          </Card>
        )}
        contentContainerStyle={{ paddingBottom: 26, gap: 10 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}

function AdminApprovalsScreen({ user }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [actionsResult, transfersResult] = await Promise.allSettled([
        api.get('/api/assistant/actions', { params: { status: 'pending', limit: 100, user_id: user?.user_id } }),
        api.get('/api/transfers', { params: { status: 'suggested', limit: 200, user_id: user?.user_id } })
      ]);
      const actions = actionsResult.status === 'fulfilled' ? rows(actionsResult.value).map((item) => ({ ...item, approval_kind: 'assistant_action' })) : [];
      const transfers = transfersResult.status === 'fulfilled' ? rows(transfersResult.value).map((item) => ({ ...item, approval_kind: 'transfer' })) : [];
      setItems([...actions, ...transfers].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)));
    } catch (error) {
      Alert.alert('Onaylar alınamadı', apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function decide(item, type) {
    const id = item.approval_kind === 'transfer' ? item.transfer_id : item.action_id;
    setBusyId(`${item.approval_kind}-${id}-${type}`);
    try {
      if (item.approval_kind === 'transfer') {
        const status = type === 'approve' ? 'approved' : 'rejected';
        await api.patch(`/api/transfers/${item.transfer_id}/decision`, { status, user_id: user?.user_id, reason: status === 'rejected' ? 'Mobil admin tarafından reddedildi' : null });
      } else {
        await api.post(`/api/assistant/actions/${item.action_id}/${type}`, { user_id: user?.user_id });
      }
      await load();
    } catch (error) {
      Alert.alert('İşlem tamamlanamadı', apiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  async function completeTransfer(item) {
    setBusyId(`transfer-${item.transfer_id}-complete`);
    try {
      await api.post(`/api/transfers/${item.transfer_id}/complete`, null, { params: { user_id: user?.user_id } });
      await load();
      Alert.alert('Transfer tamamlandı', 'Stok hareketi işlendi.');
    } catch (error) {
      Alert.alert('Transfer tamamlanamadı', apiErrorMessage(error));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Screen scroll={false} contentStyle={{ paddingBottom: 0 }}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => `${item.approval_kind}-${item.action_id || item.transfer_id || index}`}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={<Empty title="Bekleyen onay yok" />}
        renderItem={({ item }) => {
          const isTransfer = item.approval_kind === 'transfer';
          const busy = String(busyId || '').includes(String(item.action_id || item.transfer_id));
          return (
            <Card style={styles.alertCard}>
              <View style={styles.rowCardNoMargin}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{isTransfer ? `${productName(item)} transfer onayı` : (item.title || 'İşlem taslağı')}</Text>
                  <Text style={styles.rowMeta}>{isTransfer ? `${marketNameOf(item, 'source')} → ${marketNameOf(item, 'target')}` : `${statusLabel(item.action_type)} • Güven %${pct(item.confidence)}`}</Text>
                </View>
                <Badge label={isTransfer ? statusLabel(item.status) : statusLabel(item.risk_level || 'medium')} tone={isTransfer ? statusTone(item.status) : statusTone(item.risk_level || 'medium')} />
              </View>
              <Text style={styles.cardText}>{isTransfer ? `${Math.round(Number(item.quantity || 0))} adet • Tahmini katkı ${money(item.estimated_profit_gain || 0)}` : (item.description || '')}</Text>
              {isTransfer && item.status === 'approved' ? (
                <Button title="Tamamla" onPress={() => completeTransfer(item)} loading={busy} />
              ) : (
                <View style={styles.buttonRow}>
                  <Button title="Onayla" onPress={() => decide(item, 'approve')} loading={busy} style={{ flex: 1 }} />
                  <Button title="Reddet" onPress={() => decide(item, 'reject')} variant="secondary" style={{ flex: 1 }} />
                </View>
              )}
            </Card>
          );
        }}
        contentContainerStyle={{ paddingBottom: 26, gap: 10 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}


function AlertsScreen({ user, admin = false, refreshTop }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    if (!admin && !user?.market_id) return;
    setLoading(true);
    try {
      const params = admin ? { status: 'open', limit: 200 } : { market_id: user.market_id, status: 'open', limit: 100 };
      const response = await api.get('/api/alerts', { params });
      setItems(rows(response).filter((item) => admin ? isOperationalAlertForAdmin(item) : isMobileVisibleAlert(item, user)));  
      refreshTop?.();
    } catch (error) {
      Alert.alert('Bildirim alınamadı', apiErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [user?.market_id, admin]);

  async function read(item) {
    try {
      await api.patch(`/api/alerts/${item.alert_id}/status`, { status: 'reviewed' });
      await load();
    } catch (error) {
      Alert.alert('Bildirim güncellenemedi', apiErrorMessage(error));
    }
  }

  return (
    <Screen scroll={false} contentStyle={{ paddingBottom: 0 }}>
      <FlatList
        data={items}
        keyExtractor={(item, index) => String(item.alert_id || index)}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={<Empty title="Bildirim yok" />}
        renderItem={({ item }) => <AlertRow item={item} onRead={() => read(item)} />}
        contentContainerStyle={{ paddingBottom: 26, gap: 10 }}
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  );
}


function RequestScreen({ user }) {
  const [products, setProducts] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [query, setQuery] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [severity, setSeverity] = useState('low');
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadHistory() {
    if (!user?.user_id) return;
    setHistoryLoading(true);
    try {
      const response = await api.get('/api/alerts', {
        params: {
          alert_type: 'staff_request',
          status: 'all',
          created_by_user_id: user.user_id,
          limit: 80
        }
      });
      setHistory(rows(response).filter(isStaffRequestAlert));
    } catch (_error) {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => { loadHistory(); }, [user?.user_id]);

  useEffect(() => {
    let mounted = true;
    Promise.allSettled([
      api.get('/api/products'),
      api.get('/api/stocks', { params: { market_id: user?.market_id, limit: 500 } })
    ]).then(([productsResult, stocksResult]) => {
      if (!mounted) return;
      setProducts(productsResult.status === 'fulfilled' ? rows(productsResult.value) : []);
      setStocks(stocksResult.status === 'fulfilled' ? rows(stocksResult.value) : []);
    });
    return () => { mounted = false; };
  }, [user?.market_id]);

  const selectedProduct = useMemo(() => products.find((item) => String(item.product_id) === String(selectedProductId)), [products, selectedProductId]);
  const selectedStock = useMemo(() => stocks.find((item) => String(item.product_id) === String(selectedProductId)), [stocks, selectedProductId]);

  const filteredProducts = useMemo(() => {
    const q = normalize(query);
    const list = products || [];
    if (!q) return [];
    if (selectedProduct && normalize(selectedProduct.product_name || '') === q) return [];
    return list.filter((item) => normalize(productSearchText(item)).includes(q)).slice(0, 6);
  }, [products, query, selectedProductId, selectedProduct]);

  const quickQuantities = useMemo(() => [5, 10, 20, 50, 100], []);

  function selectProduct(item) {
    setSelectedProductId(String(item.product_id));
    setQuery(item.product_name || '');
    const current = Math.round(Number(stocks.find((row) => String(row.product_id) === String(item.product_id))?.quantity || 0));
    const min = Math.round(Number(item.min_stock_level || 0));
    if (!quantity) setQuantity(String(Math.max(1, min > current ? min - current : 10)));
  }

  async function createRequest() {
    if (!selectedProduct) return Alert.alert('Eksik bilgi', 'Katalogdan ürün seçmelisiniz. Serbest ürün adı kabul edilmez.');
    const qty = Number(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return Alert.alert('Geçersiz adet', 'Talep adedi 1 veya daha büyük olmalı.');
    if (qty > 999) return Alert.alert('Adet sınırı', 'Tek talepte en fazla 999 adet girilebilir. Daha büyük ihtiyaç için not ekleyin.');
    setSending(true);
    try {
      await api.post('/api/stock-requests', {
        product_id: selectedProduct.product_id,
        barcode: selectedProduct.barcode,
        market_id: user?.market_id,
        user_id: user?.user_id,
        created_by_user_id: user?.user_id,
        quantity: qty,
        source: 'mobile_staff_request',
        note: note.trim() || `${selectedProduct.product_name} için ${qty} adet personel talebi`,
        severity
      });
      setSelectedProductId('');
      setQuery('');
      setQuantity('');
      setNote('');
      setSeverity('low');
      await loadHistory();
      Alert.alert('Talep gönderildi', `${selectedProduct.product_name} (${selectedProduct.barcode || 'barkod yok'}) için ${qty} adet talep yönetici onayına iletildi.`);
    } catch (error) {
      Alert.alert('Talep gönderilemedi', apiErrorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <Screen>
      <Card style={{ gap: 12 }}>
        <Text style={styles.label}>Ürün seç</Text>
        <TextInput
          value={query}
          onChangeText={(value) => {
            setQuery(value);
            if (selectedProduct && normalize(value) !== normalize(selectedProduct.product_name || '')) setSelectedProductId('');
            if (!value.trim()) setSelectedProductId('');
          }}
          style={styles.input}
          placeholder="Ürün adı, kod veya barkod ara"
          placeholderTextColor={colors.softText}
        />
        {filteredProducts.length > 0 ? (
          <View style={styles.productDropdown}>
            {filteredProducts.map((item) => {
              const stock = stocks.find((row) => String(row.product_id) === String(item.product_id));
              return (
                <Pressable key={item.product_id} onPress={() => selectProduct(item)} style={({ pressed }) => [styles.productDropdownItem, pressed && styles.buttonPressed]}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.productDropdownTitle}>{item.product_name}</Text>
                    <Text style={styles.productDropdownMeta}>{item.barcode || 'barkod yok'} • Mevcut: {Math.round(Number(stock?.quantity || 0))} adet</Text>
                  </View>
                  <MaterialCommunityIcons name="chevron-right" size={22} color={colors.softText} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {query.trim().length > 0 && !selectedProduct && filteredProducts.length === 0 ? <Text style={styles.helperText}>Katalogda eşleşen ürün bulunamadı.</Text> : null}
        {selectedProduct ? (
          <View style={styles.selectedInfoBox}>
            <Text style={styles.cardTitle}>{selectedProduct.product_name}</Text>
            <Text style={styles.cardText}>Barkod: {selectedProduct.barcode || 'yok'} • Mevcut stok: {Math.round(Number(selectedStock?.quantity || 0))} adet</Text>
          </View>
        ) : null}
        <Text style={styles.label}>Adet</Text>
        <TextInput value={quantity} onChangeText={(value) => setQuantity(value.replace(/\D/g, ''))} keyboardType="numeric" style={styles.input} placeholder="Adet" placeholderTextColor={colors.softText} />
        {selectedProduct ? <View style={styles.quickQtyRow}>{quickQuantities.map((value) => <QuickQty key={value} title={`${value}`} active={quantity === String(value)} onPress={() => setQuantity(String(value))} />)}</View> : null}
        <Text style={styles.label}>Not</Text>
        <TextInput value={note} onChangeText={setNote} style={[styles.input, styles.textArea]} multiline placeholder="" placeholderTextColor={colors.softText} />
        <Text style={styles.label}>Öncelik</Text>
        <View style={styles.choiceGrid}>
          <Choice title="Düşük" active={severity === 'low'} onPress={() => setSeverity('low')} />
          <Choice title="Orta" active={severity === 'medium'} onPress={() => setSeverity('medium')} />
          <Choice title="Yüksek" active={severity === 'high'} onPress={() => setSeverity('high')} />
          <Choice title="Kritik" active={severity === 'critical'} onPress={() => setSeverity('critical')} />
        </View>
        <Button title="Gönder" onPress={createRequest} loading={sending} />
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={styles.rowCardNoMargin}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Geçmiş Taleplerim</Text>
            <Text style={styles.cardText}>Mobilde oluşturduğun taleplerin durumunu buradan takip edebilirsin.</Text>
          </View>
          <Button title="Yenile" onPress={loadHistory} loading={historyLoading} variant="ghost" />
        </View>
        {historyLoading && history.length === 0 ? <ActivityIndicator color={colors.blue} /> : null}
        {!historyLoading && history.length === 0 ? <Empty title="Henüz talep yok" text="Talep oluşturduğunda durumu burada görünür." /> : null}
        {history.slice(0, 10).map((item) => (
          <View key={String(item.alert_id)} style={styles.requestHistoryItem}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={styles.rowTitle}>{item.product_name || item.title || 'Talep'}</Text>
              <Text numberOfLines={2} style={styles.rowMeta}>
                {item.barcode || item.product_barcode || 'barkod yok'} • {requestDate(item.created_at)}
              </Text>
              {item.message ? <Text numberOfLines={2} style={styles.cardText}>{item.message}</Text> : null}
            </View>
            <Badge label={requestStatusLabel(item.status)} tone={requestStatusTone(item.status)} />
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function Choice({ active, title, onPress }) {
  return <Pressable onPress={onPress} style={[styles.choice, active && styles.choiceActive]}><Text style={[styles.choiceText, active && styles.choiceTextActive]}>{title}</Text></Pressable>;
}

function QuickQty({ active, title, onPress }) {
  return <Pressable onPress={onPress} style={[styles.quickQtyChip, active && styles.quickQtyChipActive]}><Text style={[styles.quickQtyText, active && styles.quickQtyTextActive]}>{title}</Text></Pressable>;
}

function AlertRow({ item, onRead }) {
  const tone = statusTone(item.severity || item.status);
  return (
    <Card style={styles.alertCard}>
      <View style={styles.rowCardNoMargin}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{item.title || item.message}</Text>
          <Text style={styles.rowMeta}>{item.product_name || item.market_name || statusLabel(item.alert_type)}</Text>
        </View>
        <Badge label={statusLabel(item.severity || item.status)} tone={tone} />
      </View>
      {item.message && item.title ? <Text style={styles.cardText}>{item.message}</Text> : null}
      <Button title="Okundu Yap" onPress={onRead} variant="secondary" />
    </Card>
  );
}

function AssistantScreen({ user }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionBusyId, setActionBusyId] = useState(null);
  const listRef = useRef(null);
  const userId = user?.user_id || 1;
  const admin = isAdminUser(user);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      try {
        listRef.current?.scrollToEnd?.({ animated: true });
      } catch (_error) {
        // Liste henüz ölçülmediyse sonraki layout tetiklemesi tekrar deneyecek.
      }
    }, 80);
  }, []);

  const storageKey = `karventer_mobile_assistant_messages_${userId}`;

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(storageKey)
      .then((raw) => {
        if (!mounted || !raw) return;
        const saved = JSON.parse(raw);
        if (Array.isArray(saved)) setMessages(saved.slice(-80));
      })
      .catch(() => {});
    return () => { mounted = false; };
  }, [storageKey]);

  useEffect(() => {
    AsyncStorage.setItem(storageKey, JSON.stringify(messages.slice(-80))).catch(() => {});
  }, [messages, storageKey]);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, loading, scrollToBottom]);

  async function loadInlineActions(payload) {
    const direct = assistantActionsFromPayload(payload);
    return direct.slice(0, 8);
  }

  async function decideInlineAction(action, type) {
    const actionId = action?.action_id || action?.id;
    if (!actionId) return;
    setActionBusyId(`${actionId}-${type}`);
    try {
      await api.post(`/api/assistant/actions/${actionId}/${type}`, { user_id: userId });
      setMessages((current) => current.map((message) => {
        if (!message.actions) return message;
        return {
          ...message,
          actions: message.actions.map((item) => {
            const itemId = item?.action_id || item?.id;
            return Number(itemId) === Number(actionId)
              ? { ...item, status: type === 'approve' ? 'approved' : 'rejected' }
              : item;
          })
        };
      }));
    } catch (error) {
      Alert.alert('İşlem tamamlanamadı', apiErrorMessage(error));
    } finally {
      setActionBusyId(null);
    }
  }

  async function decideInlineActions(actions, type) {
    const pendingActions = (actions || []).filter((action) => String(action?.status || 'pending').toLowerCase() === 'pending');
    if (pendingActions.length === 0) return;
    setActionBusyId(`bulk-${type}`);
    try {
      for (const action of pendingActions) {
        const actionId = action?.action_id || action?.id;
        if (actionId) {
          await api.post(`/api/assistant/actions/${actionId}/${type}`, { user_id: userId });
        }
      }
      const finalStatus = type === 'approve' ? 'approved' : 'rejected';
      const decidedIds = new Set(pendingActions.map((action) => Number(action?.action_id || action?.id)));
      setMessages((current) => current.map((message) => {
        if (!message.actions) return message;
        return {
          ...message,
          actions: message.actions.map((item) => decidedIds.has(Number(item?.action_id || item?.id)) ? { ...item, status: finalStatus } : item)
        };
      }));
    } catch (error) {
      Alert.alert('Toplu işlem tamamlanamadı', apiErrorMessage(error));
    } finally {
      setActionBusyId(null);
    }
  }

  async function send() {
    const message = input.trim();
    if (!message || loading) return;
    setInput('');
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setLoading(true);
    try {
      const response = await api.post('/api/assistant/chat', { message, user_id: userId, mode: 'approval' }, { timeout: 120000 });
      const answer = response.data?.answer || 'İşlem tamamlandı.';
      const inlineActions = admin ? await loadInlineActions(response.data) : assistantActionsFromPayload(response.data).slice(0, 4);
      setMessages((current) => [...current, { role: 'assistant', content: answer, actions: inlineActions }]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: apiErrorMessage(error, 'KARVAI isteği tamamlanamadı.') }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.assistantRoot} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(_item, index) => String(index)}
        renderItem={({ item }) => <ChatBubble item={item} admin={admin} actionBusyId={actionBusyId} onApprove={(action) => decideInlineAction(action, 'approve')} onReject={(action) => decideInlineAction(action, 'reject')} onApproveAll={(actions) => decideInlineActions(actions, 'approve')} onRejectAll={(actions) => decideInlineActions(actions, 'reject')} />}
        ListEmptyComponent={null}
        contentContainerStyle={styles.chatList}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={scrollToBottom}
        onLayout={scrollToBottom}
      />
      <View style={styles.composer}>
        <TextInput value={input} onChangeText={setInput} style={styles.composerInput} multiline placeholder="Mesaj yaz" placeholderTextColor={colors.softText} />
        <Pressable onPress={send} disabled={loading} style={styles.sendButton}>
          {loading ? <ActivityIndicator color={colors.white} /> : <Text style={styles.sendButtonText}>Gönder</Text>}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function ChatBubble({ item, admin, actionBusyId, onApprove, onReject, onApproveAll, onRejectAll }) {
  const mine = item.role === 'user';
  const visibleActions = (item.actions || []).filter((action) => String(action.status || 'pending').toLowerCase() === 'pending');
  const bulkBusy = String(actionBusyId || '').startsWith('bulk-');
  return (
    <View style={styles.chatMessageBlock}>
      <View style={[styles.chatBubble, mine ? styles.chatBubbleUser : styles.chatBubbleAssistant]}>
        <Text style={[styles.chatText, mine && styles.chatTextUser]}>{item.content}</Text>
      </View>
      {!mine && admin && visibleActions.length > 0 ? (
        <View style={styles.inlineActionStack}>
          {visibleActions.length > 1 ? (
            <View style={styles.bulkActionBar}>
              <Button title="Tümünü Onayla" onPress={() => onApproveAll?.(visibleActions)} loading={bulkBusy && String(actionBusyId || '').includes('approve')} style={{ flex: 1, minHeight: 40 }} />
              <Button title="Tümünü Reddet" onPress={() => onRejectAll?.(visibleActions)} loading={bulkBusy && String(actionBusyId || '').includes('reject')} variant="secondary" style={{ flex: 1, minHeight: 40 }} />
            </View>
          ) : null}
          {visibleActions.map((action, index) => (
            <ActionMiniCard
              key={String(action.action_id || action.id || index)}
              action={action}
              busy={String(actionBusyId || '').startsWith(String(action.action_id || action.id))}
              onApprove={() => onApprove?.(action)}
              onReject={() => onReject?.(action)}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ActionMiniCard({ action, onApprove, onReject, busy }) {
  return (
    <View style={styles.actionMiniCard}>
      <View style={styles.rowCardNoMargin}>
        <View style={{ flex: 1 }}>
          <Text style={styles.actionMiniTitle}>{action.title || 'İşlem taslağı'}</Text>
          <Text style={styles.actionMiniMeta}>{statusLabel(action.action_type)} • Güven %{pct(action.confidence)}</Text>
        </View>
        <Badge label={statusLabel(action.risk_level || 'medium')} tone={statusTone(action.risk_level || 'medium')} />
      </View>
      {action.description ? <Text style={styles.actionMiniText}>{action.description}</Text> : null}
      <View style={styles.buttonRow}>
        <Button title="Onayla" onPress={onApprove} loading={busy} style={{ flex: 1, minHeight: 40 }} />
        <Button title="Reddet" onPress={onReject} variant="secondary" style={{ flex: 1, minHeight: 40 }} />
      </View>
    </View>
  );
}

function ProfileScreen({ user, onLogout }) {
  async function logout() {
    await AsyncStorage.removeItem('karventer_mobile_token');
    await AsyncStorage.removeItem('karventer_mobile_user');
    onLogout();
  }
  return (
    <Screen>
      <Card style={styles.profileCard}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.full_name || user?.username || 'K').slice(0, 1).toUpperCase()}</Text></View>
        <Text style={styles.profileName}>{user?.full_name || user?.username || 'KARVENTER Kullanıcısı'}</Text>
        <Text style={styles.profileMeta}>{profileRoleLabel(user)} • {profileScopeLabel(user)}</Text>
      </Card>
      <Card style={{ gap: 10 }}>
        <Button title="Çıkış Yap" onPress={logout} variant="danger" />
      </Card>
    </Screen>
  );
}

const androidTop = Platform.OS === 'android' ? (RNStatusBar.currentHeight || 0) : 0;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  androidStatusGap: { flex: 1, paddingTop: androidTop },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scrollGrow: { paddingBottom: 20 },
  mainArea: { flex: 1 },
  screenContent: { flex: 1, padding: 16, paddingBottom: 96 },

  loginBg: { backgroundColor: colors.blue, flex: 1 },
  loginStage: { flex: 1, justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 34 },
  loginCardWeb: { backgroundColor: colors.white, borderRadius: 30, padding: 28, shadowColor: '#0F172A', shadowOpacity: 0.22, shadowRadius: 28, shadowOffset: { width: 0, height: 16 }, elevation: 9 },
  loginBrandWrap: { alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 28 },
  loginBrandWeb: { color: colors.blueDark, fontSize: 34, fontWeight: '900', letterSpacing: -1.5, textAlign: 'center' },
  loginForm: { gap: 2 },
  loginInputWrap: { minHeight: 55, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', gap: 10 },
  loginInput: { flex: 1, color: colors.navy, fontSize: 15, fontWeight: '800', paddingVertical: 12 },
  loginButton: { marginTop: 18, minHeight: 55, borderRadius: 18 },

  kLogo: { backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', shadowColor: colors.blueDark, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 3 },
  kLogoText: { color: colors.white, fontWeight: '900', letterSpacing: -1 },
  shellHeader: { minHeight: 76, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  shellKicker: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  shellTitle: { color: colors.navy, fontSize: 23, fontWeight: '900', letterSpacing: -0.4 },
  profilePill: { maxWidth: 142, minHeight: 46, borderRadius: 16, backgroundColor: colors.softBlue, borderWidth: 1, borderColor: '#C8DBFF', paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 7 },
  profileDot: { width: 30, height: 30, borderRadius: 12, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center' },
  profileDotText: { color: colors.white, fontSize: 13, fontWeight: '900' },
  profilePillTextWrap: { flex: 1, minWidth: 0 },
  profilePillName: { color: colors.navy, fontSize: 11, fontWeight: '900' },
  profilePillMarket: { color: colors.muted, fontSize: 10, fontWeight: '800', marginTop: 1 },
  bellButton: { width: 46, height: 46, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: '#C8DBFF', alignItems: 'center', justifyContent: 'center' },
  bellText: { color: colors.blue, fontSize: 20, fontWeight: '900' },
  bellDot: { position: 'absolute', top: -5, right: -5, minWidth: 22, height: 22, borderRadius: 999, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.white },
  bellDotText: { color: colors.white, fontSize: 9, fontWeight: '900' },

  heroCardCompact: { borderRadius: 24, backgroundColor: colors.blue, paddingVertical: 20, paddingHorizontal: 18, shadowColor: colors.blueDark, shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 8 }, elevation: 4 },
  heroTitleCompact: { color: colors.white, fontSize: 25, fontWeight: '900' },
  grid2Compact: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14, marginBottom: 14 },
  actionCardCompact: { gap: 12, padding: 15 },
  quickStackCompact: { gap: 10 },
  quickActionCompact: { minHeight: 68, borderRadius: 18, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  quickTitleCompact: { color: colors.navy, fontSize: 15, fontWeight: '900' },

  heroCard: { borderRadius: 28, backgroundColor: colors.blue, padding: 18, shadowColor: colors.blueDark, shadowOpacity: 0.22, shadowRadius: 20, shadowOffset: { width: 0, height: 12 }, elevation: 6 },
  heroKicker: { color: '#CFE0FF', fontSize: 12, fontWeight: '900' },
  heroTitle: { color: colors.white, fontSize: 24, fontWeight: '900', marginTop: 3 },
  heroText: { color: '#EAF2FF', fontSize: 13, fontWeight: '700', lineHeight: 19, marginTop: 6 },

  label: { color: colors.navy, fontSize: 13, fontWeight: '900', marginTop: 10, marginBottom: 6 },
  input: { minHeight: 50, borderRadius: 17, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 14, color: colors.navy, fontWeight: '800' },
  textArea: { minHeight: 92, textAlignVertical: 'top', paddingTop: 12 },
  search: { minHeight: 50, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 14, marginVertical: 12, color: colors.navy, fontWeight: '800' },
  searchWrap: { minHeight: 50, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 14, marginVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchRow: { marginVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchWrapInline: { flex: 1, minHeight: 50, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  searchInput: { flex: 1, minHeight: 48, color: colors.navy, fontWeight: '800', paddingVertical: 10 },
  scanButton: { minHeight: 50, borderRadius: 18, borderWidth: 1, borderColor: '#BFD7FF', backgroundColor: colors.softBlue, paddingHorizontal: 11, alignItems: 'center', justifyContent: 'center', minWidth: 70 },
  scanIconButton: { width: 54, height: 50, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  scanButtonText: { color: colors.blue, fontSize: 11, fontWeight: '900', marginTop: 1 },
  scannerScreen: { backgroundColor: colors.navy },
  scannerHeader: { minHeight: 82, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  scannerTitle: { color: colors.white, fontSize: 22, fontWeight: '900' },
  scannerText: { color: '#CBD5E1', fontSize: 13, fontWeight: '700', marginTop: 3 },
  scannerClose: { width: 44, height: 44, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', alignItems: 'center', justifyContent: 'center' },
  cameraView: { flex: 1 },
  scanFrame: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  scanFrameBox: { width: '86%', height: 210, borderRadius: 26, borderWidth: 3, borderColor: colors.white, backgroundColor: 'transparent' },
  scannerFooter: { backgroundColor: colors.white, padding: 16, gap: 10 },
  scannerFooterText: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 18, textAlign: 'center' },
  muted: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.line, borderRadius: 24, padding: 16, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.06, shadowRadius: 16, elevation: 3 },
  cardTitle: { color: colors.navy, fontSize: 18, fontWeight: '900' },
  cardText: { color: colors.muted, fontSize: 13, fontWeight: '700', lineHeight: 19 },

  button: { minHeight: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.blue, paddingHorizontal: 18 },
  buttonSecondary: { backgroundColor: colors.softBlue, borderWidth: 1, borderColor: '#BFD7FF' },
  buttonDanger: { backgroundColor: colors.red },
  buttonGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.line },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { opacity: 0.82 },
  buttonText: { color: colors.white, fontSize: 15, fontWeight: '900' },
  buttonSecondaryText: { color: colors.blue },
  buttonRow: { flexDirection: 'row', gap: 10 },

  badge: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 6, alignSelf: 'flex-start' },
  badgeText: { fontSize: 12, fontWeight: '900' },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 36, gap: 8 },
  emptyMark: { color: colors.softText, fontSize: 28, fontWeight: '900' },
  emptyTitle: { color: colors.navy, fontWeight: '900', fontSize: 16 },
  emptyText: { color: colors.muted, textAlign: 'center', lineHeight: 19, fontWeight: '700' },

  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 16 },
  metric: { width: '48%', minHeight: 86, justifyContent: 'center' },
  metricValue: { fontSize: 28, fontWeight: '900' },
  metricLabel: { color: colors.muted, fontWeight: '900', marginTop: 4 },
  actionCard: { gap: 12 },
  quickStack: { gap: 10 },
  quickAction: { minHeight: 86, borderRadius: 20, backgroundColor: '#F8FBFF', borderWidth: 1, borderColor: colors.line, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 12 },
  quickIcon: { width: 42, height: 42, borderRadius: 15, backgroundColor: colors.softBlue, alignItems: 'center', justifyContent: 'center' },
  quickIconText: { color: colors.blue, fontSize: 21, fontWeight: '900' },
  quickTitle: { color: colors.navy, fontSize: 15, fontWeight: '900' },
  quickText: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 17, marginTop: 3 },

  inlineInfo: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line, borderRadius: 22, padding: 14, marginBottom: 12 },
  inlineInfoTitle: { color: colors.navy, fontSize: 16, fontWeight: '900' },
  inlineInfoText: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 18, marginTop: 3 },
  editPanel: { marginBottom: 12, gap: 10 },
  rowCard: { marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowCardNoMargin: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  rowTitle: { color: colors.navy, fontSize: 16, fontWeight: '900' },
  rowMeta: { color: colors.muted, fontWeight: '700', marginTop: 4, lineHeight: 18 },
  qty: { color: colors.navy, fontWeight: '900', fontSize: 21 },
  productDot: { width: 42, height: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.softBlue },
  productDotText: { color: colors.blue, fontSize: 18, fontWeight: '900' },

  transferCard: { marginBottom: 12, gap: 13 },
  transferStats: { flexDirection: 'row', justifyContent: 'space-between', backgroundColor: '#F8FBFF', borderRadius: 18, padding: 12, gap: 10 },
  statLabel: { color: colors.muted, fontSize: 11, fontWeight: '900' },
  statValue: { color: colors.navy, fontSize: 14, fontWeight: '900', marginTop: 3 },
  alertCard: { gap: 12 },
  requestHistoryItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: '#F8FBFF', borderRadius: 16, padding: 12 },

  segment: { flexDirection: 'row', backgroundColor: '#EAF2FF', borderRadius: 18, padding: 4, marginBottom: 12 },
  segmentButton: { flex: 1, minHeight: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  segmentButtonActive: { backgroundColor: colors.white, shadowColor: '#0F172A', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  segmentText: { color: colors.muted, fontWeight: '900' },
  segmentTextActive: { color: colors.blue },
  productPickerBox: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: '#F8FAFC', padding: 8, gap: 8 },
  productDropdown: { borderWidth: 1, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.white, overflow: 'hidden', marginTop: -2 },
  productDropdownItem: { minHeight: 58, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#EEF2F7', flexDirection: 'row', alignItems: 'center', gap: 10 },
  productDropdownTitle: { color: colors.text, fontSize: 15, fontWeight: '900' },
  productDropdownMeta: { color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 2 },
  helperText: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  quickQtyRow: { flexDirection: 'row', flexWrap: 'nowrap', gap: 6, justifyContent: 'space-between', alignItems: 'center' },
  quickQtyChip: { flex: 1, minWidth: 0, height: 38, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  quickQtyChipActive: { backgroundColor: colors.softBlue, borderColor: '#BFDBFE' },
  quickQtyText: { color: colors.muted, fontSize: 14, fontWeight: '900' },
  quickQtyTextActive: { color: colors.blue },
  choiceMeta: { color: colors.muted, fontSize: 12, fontWeight: '700', marginTop: 2 },
  selectedInfoBox: { backgroundColor: colors.softBlue, borderWidth: 1, borderColor: '#BFDBFE', borderRadius: 18, padding: 12, gap: 4 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { width: '48%', minHeight: 42, borderRadius: 14, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  choiceActive: { backgroundColor: colors.softBlue, borderColor: '#BFD7FF' },
  choiceText: { color: colors.muted, fontWeight: '900' },
  choiceTextActive: { color: colors.blue },

  assistantRoot: { flex: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10 },
  assistantStatusCard: { marginTop: 14, marginBottom: 10, padding: 14, backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  quickPromptRow: { minHeight: 42, marginBottom: 8 },
  promptChip: { backgroundColor: colors.softBlue, borderWidth: 1, borderColor: '#C8DBFF', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 9 },
  promptChipText: { color: colors.blue, fontWeight: '900', fontSize: 12 },
  pendingTitle: { color: colors.amber, fontSize: 12, fontWeight: '900', marginBottom: 6 },
  chatList: { paddingVertical: 8, paddingBottom: 12 },
  chatMessageBlock: { gap: 8, marginBottom: 10 },
  chatBubble: { maxWidth: '88%', borderRadius: 20, padding: 13, marginBottom: 9 },
  chatBubbleAssistant: { alignSelf: 'flex-start', backgroundColor: colors.white, borderWidth: 1, borderColor: colors.line },
  chatBubbleUser: { alignSelf: 'flex-end', backgroundColor: colors.blue },
  chatText: { color: colors.navy, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  chatTextUser: { color: colors.white },
  actionRail: { gap: 10, paddingBottom: 8 },
  miniList: { gap: 8, marginTop: 10 },
  miniListItem: { borderWidth: 1, borderColor: colors.line, backgroundColor: '#F8FBFF', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  miniListTitle: { color: colors.navy, fontSize: 13, fontWeight: '900' },
  miniListText: { color: colors.muted, fontSize: 11, fontWeight: '700', marginTop: 3 },
  inlineActionStack: { gap: 8, marginTop: 2, marginBottom: 6 },
  bulkActionBar: { width: 280, flexDirection: 'row', gap: 8, marginBottom: 2 },
  actionMiniCard: { width: 280, backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 14, gap: 8 },
  actionMiniTitle: { color: colors.navy, fontSize: 15, fontWeight: '900' },
  actionMiniMeta: { color: colors.muted, fontSize: 12, fontWeight: '800', marginTop: 2 },
  actionMiniText: { color: colors.muted, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, backgroundColor: colors.white, borderRadius: 22, borderWidth: 1, borderColor: colors.line, padding: 8 },
  composerInput: { flex: 1, minHeight: 42, maxHeight: 100, paddingHorizontal: 10, paddingVertical: 10, color: colors.navy, fontWeight: '800' },
  sendButton: { minHeight: 42, borderRadius: 16, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14 },
  sendButtonText: { color: colors.white, fontWeight: '900' },

  profileCard: { alignItems: 'center', gap: 7, marginBottom: 14 },
  avatar: { width: 74, height: 74, borderRadius: 28, backgroundColor: colors.blue, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarText: { color: colors.white, fontSize: 32, fontWeight: '900' },
  profileName: { color: colors.navy, fontSize: 20, fontWeight: '900', textAlign: 'center' },
  profileMeta: { color: colors.muted, fontSize: 13, fontWeight: '700', textAlign: 'center' },

  tabbar: { minHeight: 70, backgroundColor: colors.white, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingHorizontal: 8, paddingBottom: 8, paddingTop: 8 },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 52, borderRadius: 16 },
  tabItemActive: { backgroundColor: colors.softBlue, borderWidth: 1, borderColor: '#D4E4FF' },
  tabIcon: { fontSize: 18, color: colors.softText, fontWeight: '900' },
  tabIconActive: { color: colors.blue },
  tabText: { fontSize: 10, fontWeight: '900', color: colors.softText, marginTop: 3 },
  tabTextActive: { color: colors.blue },
  aiMark: { alignItems: 'center', justifyContent: 'center' },
  aiMarkActive: { backgroundColor: '#E7F0FF' },
  navAiIcon: { width: 24, height: 24, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  navAiIconActive: { backgroundColor: '#E7F0FF' },
  navAiText: { color: colors.softText, fontSize: 9, fontWeight: '900' },
  navAiTextActive: { color: colors.blue }
});
