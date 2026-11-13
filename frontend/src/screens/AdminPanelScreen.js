import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import EmptyState from '../components/EmptyState';
import LoadingOverlay from '../components/LoadingOverlay';
import PageHeader from '../components/PageHeader';
import ScreenContainer from '../components/ScreenContainer';
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';
import { getComplaints } from '../services/complaintService';
import { getMaintenance } from '../services/maintenanceService';
import { deleteSociety, getSocieties } from '../services/societyService';
import { getUsers } from '../services/userService';
import { getErrorMessage } from '../utils/error';
import { showError, showSuccess } from '../utils/toast';

const STATUS_FILTERS = ['all', 'healthy', 'attention'];
const SORT_OPTIONS = [
  { key: 'newest', label: 'Newest' },
  { key: 'name', label: 'Name A-Z' },
  { key: 'residents', label: 'Most Residents' },
];

const safeDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString();
};

const money = (value) =>
  `Rs. ${Number(value || 0).toLocaleString('en-IN', {
    maximumFractionDigits: 0,
  })}`;

const asId = (s) => s?.id || s?._id || '';

const AdminPanelScreen = ({ navigation }) => {
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [societies, setSocieties] = useState([]);
  const [users, setUsers] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [maintenance, setMaintenance] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [deletingId, setDeletingId] = useState('');

  const loadDashboard = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true);
      if (!isRefresh) setLoading(true);

      const [societiesData, usersData, complaintsData, maintenanceData] = await Promise.all([
        getSocieties(),
        getUsers(),
        getComplaints('admin'),
        getMaintenance('admin'),
      ]);

      setSocieties(societiesData || []);
      setUsers(usersData || []);
      setComplaints(complaintsData || []);
      setMaintenance(maintenanceData || []);
    } catch (error) {
      showError('Failed to load admin dashboard', getErrorMessage(error));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [loadDashboard])
  );

  const societyRows = useMemo(() => {
    return societies.map((society) => {
      const id = asId(society);
      const residents = users.filter((u) => u.societyId === id && u.role === 'resident').length;
      const admins = users.filter(
        (u) => u.societyId === id && (u.role === 'admin' || u.role === 'chairman')
      ).length;

      const societyComplaints = complaints.filter((c) => c.societyId === id || c.userId?.societyId === id);
      const pendingComplaints = societyComplaints.filter((c) => c.status === 'pending').length;

      const societyMaintenance = maintenance.filter((m) => m.userId?.societyId === id);
      const totalDue = societyMaintenance.reduce((sum, item) => sum + Number(item.amountDue || 0), 0);
      const totalPaid = societyMaintenance.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
      const collectionRate = totalDue > 0 ? Math.round((totalPaid / totalDue) * 100) : 0;

      return {
        ...society,
        id,
        residents,
        admins,
        pendingComplaints,
        totalDue,
        totalPaid,
        collectionRate,
        health: pendingComplaints > 8 || collectionRate < 40 ? 'attention' : 'healthy',
      };
    });
  }, [societies, users, complaints, maintenance]);

  const filteredSocieties = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    let list = societyRows.filter((s) => {
      if (statusFilter !== 'all' && s.health !== statusFilter) return false;
      if (!query) return true;
      return String(s.name || '').toLowerCase().includes(query);
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sortBy === 'residents') return b.residents - a.residents;
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });

    return list;
  }, [searchText, societyRows, sortBy, statusFilter]);

  const stats = useMemo(() => {
    const totalSocieties = societies.length;
    const totalUsers = users.length;
    const totalAdmins = users.filter((u) => u.role === 'admin' || u.role === 'chairman').length;
    const activeResidents = users.filter((u) => u.role === 'resident').length;
    const pendingComplaints = complaints.filter((c) => c.status === 'pending').length;

    const now = new Date();
    const month = now.getMonth();
    const year = now.getFullYear();
    const monthlyCollections = maintenance
      .filter((m) => {
        const d = new Date(m.lastPaymentDate || m.updatedAt || m.createdAt || 0);
        return !Number.isNaN(d.getTime()) && d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, m) => sum + Number(m.paidAmount || 0), 0);

    return {
      totalSocieties,
      totalUsers,
      totalAdmins,
      activeResidents,
      pendingComplaints,
      monthlyCollections,
    };
  }, [societies, users, complaints, maintenance]);

  const activity = useMemo(() => {
    const usersActivity = users
      .slice()
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 4)
      .map((u) => ({
        icon: 'person-add-outline',
        color: COLORS.accent,
        title: `${u.name || 'User'} joined`,
        meta: `Role: ${u.role || 'resident'} • ${safeDate(u.createdAt)}`,
      }));

    const complaintActivity = complaints
      .filter((c) => c.status === 'pending')
      .slice(0, 3)
      .map((c) => ({
        icon: 'alert-circle-outline',
        color: COLORS.warning,
        title: `Complaint raised: ${c.title || 'Untitled'}`,
        meta: safeDate(c.createdAt),
      }));

    const maintenanceActivity = maintenance
      .slice(0, 3)
      .map((m) => ({
        icon: 'wallet-outline',
        color: COLORS.success,
        title: `Maintenance due ${m.month || 'N/A'}`,
        meta: `${money(m.amountDue)} • ${safeDate(m.createdAt)}`,
      }));

    return [...usersActivity, ...complaintActivity, ...maintenanceActivity].slice(0, 8);
  }, [users, complaints, maintenance]);

  const handleDeleteSociety = (societyId, societyName) => {
    Alert.alert(
      'Delete Society',
      `Delete "${societyName}"? This will remove all wings and data. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              setDeletingId(societyId);
              await deleteSociety(societyId);
              showSuccess('Society deleted successfully');
              loadDashboard();
            } catch (error) {
              showError('Failed to delete society', getErrorMessage(error));
            } finally {
              setDeletingId('');
            }
          }
        }
      ]
    );
  };

  const goToUsers = () => {
    navigation.getParent?.()?.navigate('Users');
  };

  if (loading) return <LoadingOverlay />;

  return (
    <ScreenContainer scroll={false}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard(true)}
            tintColor={COLORS.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageWrap}>
          <PageHeader
            title="Multi-Society Admin"
            subtitle="Enterprise control center for societies, users, complaints, and collections."
            icon="shield-checkmark-outline"
          />

          <View style={[styles.statGrid, isMobile && styles.statGridMobile]}>
            <StatCard icon="business-outline" label="Total Societies" value={String(stats.totalSocieties)} accent={COLORS.accent} trend="Portfolio size" compact={isMobile} />
            <StatCard icon="people-outline" label="Total Users" value={String(stats.totalUsers)} accent={COLORS.accent} trend="Registered users" compact={isMobile} />
            <StatCard icon="shield-outline" label="Total Admins" value={String(stats.totalAdmins)} accent={COLORS.success} trend="Admins + chairmen" compact={isMobile} />
            <StatCard icon="home-outline" label="Active Residents" value={String(stats.activeResidents)} accent={COLORS.success} trend="Resident base" compact={isMobile} />
            <StatCard icon="warning-outline" label="Pending Complaints" value={String(stats.pendingComplaints)} accent={COLORS.warning} trend="Open issues" compact={isMobile} />
            <StatCard icon="cash-outline" label="Monthly Collections" value={money(stats.monthlyCollections)} accent={COLORS.success} trend="Current month" compact={isMobile} />
          </View>

          <AppCard style={styles.toolbarCard}>
            <View style={[styles.toolbarRow, isMobile && styles.toolbarRowMobile]}>
              <View style={styles.searchWrap}>
                <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
                <TextInput
                  style={styles.searchInput}
                  value={searchText}
                  onChangeText={setSearchText}
                  placeholder="Search societies"
                  placeholderTextColor={COLORS.textMuted}
                />
              </View>

              <AppButton
                title="Create Society"
                size="small"
                style={styles.createBtn}
                onPress={() => navigation.getParent?.()?.navigate('Society')}
              />
            </View>

            <View style={[styles.toolbarRow, isMobile && styles.toolbarRowMobile]}> 
              <View style={styles.filterGroup}>
                {STATUS_FILTERS.map((f) => {
                  const active = statusFilter === f;
                  return (
                    <Pressable key={f} onPress={() => setStatusFilter(f)} style={[styles.chip, active && styles.chipActive]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{f}</Text>
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.filterGroup}>
                {SORT_OPTIONS.map((opt) => {
                  const active = sortBy === opt.key;
                  return (
                    <Pressable key={opt.key} onPress={() => setSortBy(opt.key)} style={[styles.chip, active && styles.chipActive]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </AppCard>

          {filteredSocieties.length === 0 ? (
            <EmptyState
              icon="business-outline"
              title="No societies found"
              subtitle={searchText ? 'Try a different search or filter.' : 'Create your first society to get started.'}
            />
          ) : (
            <View style={[styles.societyGrid, isTablet && styles.societyGridTablet, isDesktop && styles.societyGridDesktop]}>
              {filteredSocieties.map((society, index) => (
                <Animated.View
                  key={society.id}
                  entering={FadeInDown.duration(220).delay(index * 20)}
                  style={[styles.cardWrap, isTablet && styles.cardWrapTablet, isDesktop && styles.cardWrapDesktop]}
                >
                  <SocietyCard
                    society={society}
                    onViewDetails={() => navigation.navigate('SocietyDetails', { societyId: society.id })}
                    onManageUsers={goToUsers}
                    onSettings={() => navigation.getParent?.()?.navigate('Society')}
                    onDelete={() => handleDeleteSociety(society.id, society.name)}
                    isDeleting={deletingId === society.id}
                  />
                </Animated.View>
              ))}
            </View>
          )}

          <View style={[styles.lowerGrid, !isDesktop && styles.lowerGridStack]}>
            <AppCard style={styles.lowerCard}>
              <Text style={styles.lowerTitle}>Recent Activity</Text>
              {activity.length === 0 ? (
                <Text style={styles.muted}>No recent activity.</Text>
              ) : (
                activity.map((item, idx) => (
                  <View key={`${item.title}-${idx}`} style={styles.activityItem}>
                    <View style={[styles.activityIcon, { backgroundColor: `${item.color}22` }]}> 
                      <Ionicons name={item.icon} size={14} color={item.color} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.activityMeta} numberOfLines={1}>{item.meta}</Text>
                    </View>
                  </View>
                ))
              )}
            </AppCard>

            <AppCard style={styles.lowerCard}>
              <Text style={styles.lowerTitle}>System Overview</Text>
              <MiniChart
                label="Residents per Society"
                rows={societyRows
                  .map((s) => ({ label: s.name || 'Society', value: s.residents }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 5)}
                color={COLORS.accent}
              />
              <MiniChart
                label="Complaint Distribution"
                rows={societyRows
                  .map((s) => ({ label: s.name || 'Society', value: s.pendingComplaints }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 5)}
                color={COLORS.warning}
              />
              <MiniChart
                label="Collection Trends"
                rows={societyRows
                  .map((s) => ({ label: s.name || 'Society', value: s.collectionRate }))
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 5)}
                color={COLORS.success}
                suffix="%"
              />
            </AppCard>
          </View>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const StatCard = ({ icon, value, label, trend, accent, compact }) => (
  <AppCard style={[styles.statCard, compact && styles.statCardCompact]}>
    <View style={[styles.statIcon, { backgroundColor: `${accent}20` }]}> 
      <Ionicons name={icon} size={compact ? 14 : 18} color={accent} />
    </View>
    <Text style={[styles.statValue, compact && styles.statValueCompact]} numberOfLines={1}>{value}</Text>
    <Text style={[styles.statLabel, compact && styles.statLabelCompact]} numberOfLines={1}>{label}</Text>
    {!compact ? <Text style={[styles.statTrend, { color: accent }]} numberOfLines={1}>{trend}</Text> : null}
  </AppCard>
);

const SocietyCard = ({ society, onViewDetails, onManageUsers, onSettings, onDelete, isDeleting }) => {
  const healthTone =
    society.health === 'attention'
      ? { bg: 'rgba(245,158,11,0.16)', color: COLORS.warning, label: 'Needs Attention' }
      : { bg: 'rgba(16,185,129,0.16)', color: COLORS.success, label: 'Healthy' };

  return (
    <AppCard style={styles.societyCard}>
      <View style={styles.societyTop}>
        <View style={styles.societyAvatar}>
          <Text style={styles.societyAvatarText}>{String(society.name || 'S').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.societyName} numberOfLines={1}>{society.name || 'Unnamed Society'}</Text>
          <Text style={styles.societyDate}>Created {safeDate(society.created_at)}</Text>
        </View>
        <View style={[styles.healthChip, { backgroundColor: healthTone.bg }]}> 
          <Text style={[styles.healthText, { color: healthTone.color }]}>{healthTone.label}</Text>
        </View>
      </View>

      <View style={styles.quickGrid}>
        <QuickStat label="Residents" value={society.residents} />
        <QuickStat label="Admins" value={society.admins} />
        <QuickStat label="Complaints" value={society.pendingComplaints} />
        <QuickStat label="Collection" value={`${society.collectionRate}%`} />
      </View>

      <View style={styles.moneyRow}>
        <Text style={styles.moneyText}>Collected {money(society.totalPaid)}</Text>
        <Text style={styles.moneySub}>Due {money(society.totalDue)}</Text>
      </View>

      <View style={styles.actionGrid}>
        <ActionBtn icon="eye-outline" label="View" onPress={onViewDetails} tone="primary" />
        <ActionBtn icon="people-outline" label="Users" onPress={onManageUsers} tone="neutral" />
        <ActionBtn icon="settings-outline" label="Settings" onPress={onSettings} tone="neutral" />
        <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={onDelete} disabled={isDeleting}>
          {isDeleting ? <ActivityIndicator size="small" color={COLORS.white} /> : <Ionicons name="trash-outline" size={16} color={COLORS.white} />}
          <Text style={styles.actionBtnDangerText}>Delete</Text>
        </Pressable>
      </View>
    </AppCard>
  );
};

const QuickStat = ({ label, value }) => (
  <View style={styles.quickItem}>
    <Text style={styles.quickLabel}>{label}</Text>
    <Text style={styles.quickValue}>{value ?? '-'}</Text>
  </View>
);

const ActionBtn = ({ icon, label, onPress, tone }) => (
  <Pressable style={[styles.actionBtn, tone === 'primary' ? styles.actionBtnPrimary : styles.actionBtnNeutral]} onPress={onPress}>
    <Ionicons name={icon} size={16} color={tone === 'primary' ? COLORS.white : COLORS.textSecondary} />
    <Text style={[styles.actionBtnText, tone === 'primary' ? styles.actionBtnTextPrimary : styles.actionBtnTextNeutral]}>{label}</Text>
  </Pressable>
);

const MiniChart = ({ label, rows, color, suffix = '' }) => {
  const max = Math.max(...rows.map((r) => Number(r.value || 0)), 1);

  return (
    <View style={styles.chartBlock}>
      <Text style={styles.chartTitle}>{label}</Text>
      {rows.length === 0 ? (
        <Text style={styles.muted}>No data available.</Text>
      ) : (
        rows.map((row, index) => (
          <View key={`${row.label}-${index}`} style={styles.chartRow}>
            <Text style={styles.chartLabel} numberOfLines={1}>{row.label}</Text>
            <View style={styles.chartTrack}>
              <View style={[styles.chartFill, { width: `${Math.max(6, Math.round((Number(row.value || 0) / max) * 100))}%`, backgroundColor: color }]} />
            </View>
            <Text style={styles.chartValue}>{row.value}{suffix}</Text>
          </View>
        ))
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  pageWrap: { width: '100%', maxWidth: 1320, alignSelf: 'center' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  statGridMobile: { gap: SPACING.xs },
  statCard: { flexBasis: 190, flexGrow: 1, minHeight: 118, borderRadius: RADIUS.lg },
  statCardCompact: { minHeight: 88, padding: SPACING.xs, marginBottom: SPACING.xs },
  statIcon: { width: 30, height: 30, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  statValueCompact: { fontSize: 16, lineHeight: 19 },
  statLabel: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  statLabelCompact: { fontSize: 10, marginTop: 0 },
  statTrend: { marginTop: 6, fontSize: 11, fontWeight: '700' },
  toolbarCard: { borderRadius: RADIUS.lg, marginBottom: SPACING.md },
  toolbarRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  toolbarRowMobile: { flexDirection: 'column', alignItems: 'stretch' },
  searchWrap: {
    flex: 1,
    minHeight: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  searchInput: { flex: 1, color: COLORS.textPrimary, fontSize: 14 },
  createBtn: { width: 170 },
  filterGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  chip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  chipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  chipTextActive: { color: COLORS.accent },
  societyGrid: { flexDirection: 'column', gap: SPACING.sm },
  societyGridTablet: { flexDirection: 'row', flexWrap: 'wrap' },
  societyGridDesktop: { flexDirection: 'row', flexWrap: 'wrap' },
  cardWrap: { width: '100%' },
  cardWrapTablet: { width: '48.8%' },
  cardWrapDesktop: { width: '32.4%' },
  societyCard: { borderRadius: RADIUS.lg },
  societyTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  societyAvatar: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.accentSoft, alignItems: 'center', justifyContent: 'center' },
  societyAvatarText: { color: COLORS.accent, fontSize: 16, fontWeight: '800' },
  societyName: { color: COLORS.textPrimary, fontWeight: '700', fontSize: 16 },
  societyDate: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  healthChip: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 6 },
  healthText: { fontSize: 11, fontWeight: '800' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginBottom: SPACING.sm },
  quickItem: { width: '48%', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, padding: SPACING.xs, backgroundColor: COLORS.surfaceAlt },
  quickLabel: { color: COLORS.textHint, fontSize: 11 },
  quickValue: { color: COLORS.textPrimary, fontWeight: '700', marginTop: 4, fontSize: 13 },
  moneyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.sm },
  moneyText: { color: COLORS.success, fontWeight: '700', fontSize: 12 },
  moneySub: { color: COLORS.textMuted, fontSize: 12 },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  actionBtn: {
    minHeight: 36,
    borderRadius: 10,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1,
  },
  actionBtnPrimary: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  actionBtnNeutral: { backgroundColor: COLORS.surface, borderColor: COLORS.border },
  actionBtnDanger: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  actionBtnText: { fontSize: 12, fontWeight: '700' },
  actionBtnTextPrimary: { color: COLORS.white },
  actionBtnTextNeutral: { color: COLORS.textSecondary },
  actionBtnDangerText: { color: COLORS.white, fontSize: 12, fontWeight: '700' },
  lowerGrid: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, paddingBottom: SPACING.md },
  lowerGridStack: { flexDirection: 'column' },
  lowerCard: { flex: 1, borderRadius: RADIUS.lg },
  lowerTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: SPACING.sm },
  muted: { color: COLORS.textMuted, fontSize: 12 },
  activityItem: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginBottom: SPACING.sm },
  activityIcon: { width: 28, height: 28, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  activityTitle: { color: COLORS.textPrimary, fontWeight: '600', fontSize: 13 },
  activityMeta: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  chartBlock: { marginBottom: SPACING.sm },
  chartTitle: { color: COLORS.textSecondary, fontWeight: '700', fontSize: 12, marginBottom: SPACING.xs },
  chartRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: 6 },
  chartLabel: { width: 86, color: COLORS.textMuted, fontSize: 11 },
  chartTrack: { flex: 1, height: 9, borderRadius: 999, backgroundColor: COLORS.surfaceAlt, overflow: 'hidden', borderWidth: 1, borderColor: COLORS.border },
  chartFill: { height: '100%', borderRadius: 999 },
  chartValue: { width: 42, textAlign: 'right', color: COLORS.textSecondary, fontSize: 11, fontWeight: '700' },
});

export default AdminPanelScreen;
