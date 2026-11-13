import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming, FadeInDown } from 'react-native-reanimated';
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import LoadingOverlay from '../components/LoadingOverlay';
import ScreenContainer from '../components/ScreenContainer';
import { ROLES } from '../constants/app';
import { COLORS, GRADIENTS, RADIUS, SPACING, TYPOGRAPHY, SHADOW } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { getComplaints } from '../services/complaintService';
import { getMaintenance } from '../services/maintenanceService';
import { getNotices } from '../services/noticeService';
import { getUsers } from '../services/userService';
import { getSocietyDetails } from '../services/societyService';
import { formatDate } from '../utils/date';
import { getErrorMessage } from '../utils/error';
import { showError } from '../utils/toast';

const HomeScreen = ({ navigation }) => {
  const { user } = useAuth();
  const { isMobile, isDesktop } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [stats, setStats] = useState({
    totalResidents: 0, totalWings: 0, activeNotices: 0,
    pendingComplaints: 0, resolvedComplaints: 0,
    totalDues: 0, collectedAmount: 0, collectionRate: 0,
  });
  const [data, setData] = useState({ notices: [], complaints: [], maintenance: [] });

  const pulse = useSharedValue(0.8);
  useEffect(() => { pulse.value = withRepeat(withTiming(1.15, { duration: 900 }), -1, true); }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }], opacity: pulse.value }));

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [notices, complaints, maintenance, users] = await Promise.all([
        getNotices(),
        getComplaints(user?.role),
        getMaintenance(user?.role),
        getUsers(),
      ]);

      // FIX: get real wing count from society data
      let totalWings = 0;
      if (user?.societyId) {
        try {
          const society = await getSocietyDetails(user.societyId);
          totalWings = Array.isArray(society?.wings) ? society.wings.length : 0;
        } catch { totalWings = 0; }
      }

      const activeNotices = notices.filter(n => !n.expiresAt || new Date(n.expiresAt) > Date.now());
      const pendingComplaints = complaints.filter(c => c.status === 'pending');
      const resolvedComplaints = complaints.filter(c => c.status === 'resolved');
      const unpaidMaint = maintenance.filter(m => m.status !== 'paid');
      const totalDues = unpaidMaint.reduce((s, m) => s + Number(m.amountDue || 0), 0);
      const totalAmountDue = maintenance.reduce((s, m) => s + Number(m.amountDue || 0), 0);
      const collected = maintenance.reduce((s, m) => s + Number(m.paidAmount || 0), 0);
      // FIX: correct collection rate formula
      const collectionRate = totalAmountDue > 0 ? Math.min(100, Math.round((collected / totalAmountDue) * 100)) : 0;
      const residentCount = users.filter(u => u.role === ROLES.RESIDENT).length;

      setStats({
        totalResidents: residentCount,
        totalWings, // FIX: real data from API
        activeNotices: activeNotices.length,
        pendingComplaints: pendingComplaints.length,
        resolvedComplaints: resolvedComplaints.length,
        totalDues,
        collectedAmount: collected,
        collectionRate,
        totalFlats: residentCount, // occupied flats = residents
      });
      setData({
        notices: activeNotices.slice(0, 5),
        complaints: pendingComplaints.slice(0, 5),
        maintenance: unpaidMaint.slice(0, 5),
      });
    } catch (error) {
      showError('Failed to load dashboard', getErrorMessage(error));
    } finally { setLoading(false); setRefreshing(false); }
  }, [user?.role, user?.societyId]);

  useFocusEffect(useCallback(() => { loadDashboard(); }, [loadDashboard]));

  const greetingText = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good Morning'; if (h < 18) return 'Good Afternoon'; return 'Good Evening';
  }, []);

  // FIX: system health based on real data, not cosmetic formula
  const systemHealth = useMemo(() => {
    if (stats.totalResidents === 0) return 100;
    let score = 100;
    if (stats.pendingComplaints > 20) score -= 15;
    else if (stats.pendingComplaints > 10) score -= 8;
    else if (stats.pendingComplaints > 5) score -= 3;
    if (stats.collectionRate < 50) score -= 15;
    else if (stats.collectionRate < 75) score -= 8;
    return Math.max(0, Math.min(100, score));
  }, [stats]);

  const recentActivity = useMemo(() => {
    const items = [];
    data.notices.slice(0, 2).forEach(n => items.push({ id: `n-${n._id}`, icon: 'megaphone-outline', color: COLORS.accent, text: `Notice: ${n.title}`, time: formatDate(n.createdAt) }));
    data.complaints.slice(0, 2).forEach(c => items.push({ id: `c-${c._id}`, icon: 'alert-circle-outline', color: COLORS.warning, text: `Complaint: ${c.title}`, time: formatDate(c.createdAt) }));
    data.maintenance.slice(0, 1).forEach(m => items.push({ id: `m-${m._id}`, icon: 'wallet-outline', color: COLORS.success, text: `Due pending: ${m.month}`, time: formatDate(m.createdAt) }));
    return items.slice(0, 6);
  }, [data]);

  if (loading) return <LoadingOverlay />;

  const canManage = [ROLES.ADMIN, ROLES.CHAIRMAN].includes(user?.role);

  return (
    <ScreenContainer scroll={false}>
      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadDashboard(true)} tintColor={COLORS.accent} />} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          {/* Hero */}
          <LinearGradient colors={GRADIENTS.hero} style={styles.hero}>
            <Text style={styles.heroGreeting}>{greetingText}, {user?.name?.split(' ')[0] || 'User'} 👋</Text>
            <Text style={styles.heroSub}>{stats.pendingComplaints} complaints pending • {stats.activeNotices} notices active</Text>
            <View style={styles.heroFooter}>
              <View style={styles.healthRow}>
                <Animated.View style={[styles.healthDot, pulseStyle]} />
                <View>
                  <Text style={styles.healthLbl}>System Health</Text>
                  <Text style={styles.healthVal}>{systemHealth}%</Text>
                </View>
              </View>
              <Text style={styles.heroDate}>{formatDate(new Date())}</Text>
            </View>
            <View style={styles.heroStats}>
              {[
                { label: 'Wings', value: stats.totalWings },
                { label: 'Collection', value: `${stats.collectionRate}%` },
                { label: 'Complaints', value: stats.pendingComplaints },
                { label: 'Notices', value: stats.activeNotices },
              ].map(s => (
                <View key={s.label} style={styles.heroStatPill}>
                  <Text style={styles.heroStatLbl}>{s.label}</Text>
                  <Text style={styles.heroStatVal}>{s.value}</Text>
                </View>
              ))}
            </View>
          </LinearGradient>

          {/* KPI Grid */}
          <View style={[styles.kpiGrid, isMobile && styles.kpiGridMobile]}>
            {[
              { icon: 'people-outline', label: 'Residents', value: stats.totalResidents, color: COLORS.accent, screen: 'Users', show: true },
              { icon: 'alert-circle-outline', label: 'Complaints', value: stats.pendingComplaints, color: COLORS.warning, screen: 'Complaints', show: true },
              { icon: 'megaphone-outline', label: 'Notices', value: stats.activeNotices, color: COLORS.success, screen: 'Notices', show: true },
              { icon: 'wallet-outline', label: 'Dues Pending', value: `₹${(stats.totalDues/1000).toFixed(1)}k`, color: COLORS.accent, screen: 'Maintenance', show: true },
            ].map(k => (
              <Animated.View key={k.label} entering={FadeInDown.duration(300)} style={[styles.kpiCard, isMobile && styles.kpiCardMobile]}>
                <Pressable onPress={() => navigation?.navigate(k.screen)} style={{ flex: 1 }}>
                  <View style={[styles.kpiIcon, { backgroundColor: `${k.color}1C` }]}>
                    <Ionicons name={k.icon} size={18} color={k.color} />
                  </View>
                  <Text style={styles.kpiVal}>{k.value}</Text>
                  <Text style={styles.kpiLbl}>{k.label}</Text>
                </Pressable>
              </Animated.View>
            ))}
          </View>

          {/* Quick Actions */}
          {canManage && (
            <View style={styles.quickRow}>
              {[
                { icon: 'megaphone-outline', label: 'Create Notice', screen: 'Notices', show: canManage },
                { icon: 'person-add-outline', label: 'Manage Residents', screen: 'Users', show: user?.role === ROLES.ADMIN },
                { icon: 'receipt-outline', label: 'Generate Due', screen: 'Maintenance', show: canManage },
                { icon: 'alert-circle-outline', label: 'Complaints', screen: 'Complaints', show: true },
              ].filter(a => a.show).map(a => (
                <Pressable key={a.label} onPress={() => navigation?.navigate(a.screen)} style={styles.quickPill}>
                  <Ionicons name={a.icon} size={16} color={COLORS.accent} />
                  <Text style={styles.quickLbl}>{a.label}</Text>
                </Pressable>
              ))}
            </View>
          )}

          {/* Activity & Complaints */}
          <View style={[styles.widgetRow, isDesktop && styles.widgetRowDesktop]}>
            <AppCard style={styles.widget}>
              <Text style={styles.widgetTitle}>Recent Activity</Text>
              {recentActivity.length === 0
                ? <Text style={styles.empty}>No recent activity</Text>
                : recentActivity.map(item => (
                  <View key={item.id} style={styles.actRow}>
                    <View style={[styles.actIcon, { backgroundColor: `${item.color}1C` }]}>
                      <Ionicons name={item.icon} size={13} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.actText} numberOfLines={1}>{item.text}</Text>
                      <Text style={styles.actTime}>{item.time}</Text>
                    </View>
                  </View>
                ))}
            </AppCard>

            <AppCard style={styles.widget}>
              <View style={styles.widgetHdr}>
                <Text style={styles.widgetTitle}>Pending Complaints</Text>
                <Pressable onPress={() => navigation?.navigate('Complaints')}>
                  <Ionicons name="arrow-forward-outline" size={16} color={COLORS.accent} />
                </Pressable>
              </View>
              {data.complaints.length === 0
                ? <Text style={styles.empty}>No pending complaints 🎉</Text>
                : data.complaints.slice(0, 4).map((c, idx) => (
                  <Animated.View key={c._id} entering={FadeInDown.delay(idx * 30)}>
                    <View style={styles.listItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listTitle} numberOfLines={1}>{c.title}</Text>
                        <Text style={styles.listMeta}>{formatDate(c.createdAt)}</Text>
                      </View>
                      <View style={styles.pendingBadge}><Text style={styles.pendingText}>pending</Text></View>
                    </View>
                  </Animated.View>
                ))}
            </AppCard>
          </View>

          {/* Notices & Alerts */}
          <View style={[styles.widgetRow, isDesktop && styles.widgetRowDesktop]}>
            <AppCard style={styles.widget}>
              <View style={styles.widgetHdr}>
                <Text style={styles.widgetTitle}>Latest Notices</Text>
                <Pressable onPress={() => navigation?.navigate('Notices')}>
                  <Ionicons name="arrow-forward-outline" size={16} color={COLORS.accent} />
                </Pressable>
              </View>
              {data.notices.length === 0
                ? <Text style={styles.empty}>No active notices</Text>
                : data.notices.slice(0, 4).map((n, idx) => (
                  <Animated.View key={n._id} entering={FadeInDown.delay(idx * 30)}>
                    <View style={styles.listItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listTitle} numberOfLines={1}>{n.title}</Text>
                        <Text style={styles.listMeta}>{formatDate(n.createdAt)}</Text>
                      </View>
                    </View>
                  </Animated.View>
                ))}
            </AppCard>

            <AppCard style={styles.widget}>
              <Text style={styles.widgetTitle}>Upcoming Alerts</Text>
              {data.complaints.length === 0 && data.maintenance.length === 0
                ? <Text style={styles.empty}>No upcoming alerts</Text>
                : <>
                  {data.complaints.slice(0, 2).map(c => (
                    <View key={c._id} style={styles.alertRow}>
                      <View style={[styles.alertIcon, { backgroundColor: `${COLORS.warning}1C` }]}>
                        <Ionicons name="alert-circle-outline" size={13} color={COLORS.warning} />
                      </View>
                      <Text style={styles.alertText} numberOfLines={1}>Complaint: {c.title}</Text>
                    </View>
                  ))}
                  {data.maintenance.length > 0 && (
                    <View style={styles.alertRow}>
                      <View style={[styles.alertIcon, { backgroundColor: `${COLORS.warning}1C` }]}>
                        <Ionicons name="wallet-outline" size={13} color={COLORS.warning} />
                      </View>
                      <Text style={styles.alertText}>{data.maintenance.length} maintenance dues pending</Text>
                    </View>
                  )}
                </>}
            </AppCard>
          </View>
          <View style={{ height: 20 }} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  page: { paddingHorizontal: SPACING.md, paddingTop: SPACING.md, gap: SPACING.md, maxWidth: '100%' },
  hero: { borderRadius: RADIUS.lg, padding: SPACING.md, gap: SPACING.sm },
  heroGreeting: { fontSize: 22, fontWeight: '700', color: '#fff' },
  heroSub: { fontSize: 13, color: 'rgba(255,255,255,0.88)', lineHeight: 19 },
  heroFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: SPACING.xs, paddingTop: SPACING.xs, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.12)' },
  heroStats: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.xs },
  heroStatPill: { backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)' },
  heroStatLbl: { fontSize: 10, color: 'rgba(255,255,255,0.85)', fontWeight: '600', textTransform: 'uppercase' },
  heroStatVal: { fontSize: 12, color: '#fff', fontWeight: '700', marginTop: 1 },
  healthRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  healthDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#10B981' },
  healthLbl: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  healthVal: { fontSize: 15, fontWeight: '700', color: '#fff' },
  heroDate: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  kpiGridMobile: { gap: SPACING.xs },
  kpiCard: { flex: 1, minWidth: 140, minHeight: 120, backgroundColor: COLORS.surface, borderRadius: RADIUS.lg, padding: SPACING.md, borderWidth: 1, borderColor: COLORS.border, ...SHADOW.sm },
  kpiCardMobile: { width: '48%', flexBasis: '48%', minHeight: 108, padding: SPACING.sm },
  kpiIcon: { width: 32, height: 32, borderRadius: RADIUS.md, justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.xs },
  kpiVal: { fontSize: 20, fontWeight: '700', color: COLORS.textPrimary },
  kpiLbl: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm },
  quickPill: { flex: 1, minWidth: 160, flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.lg, backgroundColor: COLORS.surface, borderWidth: 1, borderColor: COLORS.border },
  quickLbl: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  widgetRow: { gap: SPACING.md },
  widgetRowDesktop: { flexDirection: 'row' },
  widget: { flex: 1, minHeight: 160 },
  widgetHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.sm },
  widgetTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  empty: { fontSize: 13, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.md },
  actRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  actIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  actText: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  actTime: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  listItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  listTitle: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  listMeta: { fontSize: 11, color: COLORS.textMuted, marginTop: 1 },
  pendingBadge: { backgroundColor: 'rgba(245,158,11,0.14)', borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 4 },
  pendingText: { fontSize: 10, fontWeight: '700', color: COLORS.warning },
  alertRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  alertIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  alertText: { flex: 1, fontSize: 13, color: COLORS.textSecondary },
});

export default HomeScreen;
