import React, { useCallback, useMemo, useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppInput from '../components/AppInput';
import EmptyState from '../components/EmptyState';
import LoadingOverlay from '../components/LoadingOverlay';
import PageHeader from '../components/PageHeader';
import ScreenContainer from '../components/ScreenContainer';
import { ROLES } from '../constants/app';
import { COLORS, RADIUS, SHADOW, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import {
  createMaintenance,
  getMaintenance,
  notifyMaintenance,
  payMaintenance,
} from '../services/maintenanceService';
import { getUsers } from '../services/userService';
import { formatDate } from '../utils/date';
import { getErrorMessage } from '../utils/error';
import { showError, showSuccess } from '../utils/toast';

const MONTH_CHOICES = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
const STATUS_FILTERS = ['all', 'paid', 'pending', 'overdue'];
const SORT_FILTERS = [
  { key: 'newest', label: 'Newest' },
  { key: 'oldest', label: 'Oldest' },
  { key: 'amount_high', label: 'Amount High' },
  { key: 'amount_low', label: 'Amount Low' },
];

const currency = (value) => `Rs. ${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const getRemainingAmount = (item) =>
  Math.max(Number(item?.amountDue || 0) - Number(item?.paidAmount || 0), 0);

const getDueStatus = (item) => {
  const remaining = getRemainingAmount(item);
  if (remaining <= 0 || item.status === 'paid') return 'paid';

  const dueDateTime = new Date(item.dueDate).getTime();
  if (Number.isFinite(dueDateTime) && dueDateTime < Date.now()) return 'overdue';
  return 'pending';
};

const getStatusTone = (status) => {
  if (status === 'paid') {
    return {
      icon: 'checkmark-circle',
      text: 'PAID',
      bg: 'rgba(16,185,129,0.16)',
      color: COLORS.success,
      border: 'rgba(16,185,129,0.25)',
    };
  }
  if (status === 'overdue') {
    return {
      icon: 'alert-circle',
      text: 'OVERDUE',
      bg: 'rgba(239,68,68,0.14)',
      color: '#EF4444',
      border: 'rgba(239,68,68,0.24)',
    };
  }
  return {
    icon: 'time',
    text: 'PENDING',
    bg: 'rgba(245,158,11,0.16)',
    color: COLORS.warning,
    border: 'rgba(245,158,11,0.25)',
  };
};

const getCollectionRate = (collected, generated) => {
  if (!generated) return 0;
  return Math.max(0, Math.min(100, Math.round((collected / generated) * 100)));
};

const MaintenanceScreen = () => {
  const { user } = useAuth();
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [dues, setDues] = useState([]);
  const [users, setUsers] = useState([]);

  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [monthFilter, setMonthFilter] = useState('all');

  const [residentQuery, setResidentQuery] = useState('');
  const [showResidentList, setShowResidentList] = useState(false);
  const [form, setForm] = useState({ userId: '', month: '', amountDue: '', dueDate: '' });
  const [errors, setErrors] = useState({});
  const [showMobileForm, setShowMobileForm] = useState(false);
  const [payingId, setPayingId] = useState('');
  const [notifyingId, setNotifyingId] = useState('');

  const isAdmin = user?.role === ROLES.ADMIN;

  const loadDues = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        if (!isRefresh) setLoading(true);

        const data = await getMaintenance(user?.role);
        setDues(data);

        if (isAdmin) {
          const usersData = await getUsers();
          setUsers(usersData.filter((item) => item.role === ROLES.RESIDENT));
        }
      } catch (error) {
        showError('Unable to load dues', getErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAdmin, user?.role]
  );

  useFocusEffect(
    useCallback(() => {
      loadDues();
    }, [loadDues])
  );

  const selectedUser = useMemo(() => users.find((item) => item._id === form.userId), [users, form.userId]);

  const residentMatches = useMemo(() => {
    const value = residentQuery.trim().toLowerCase();
    if (!value) return [];

    return users
      .filter((item) => {
        const name = String(item.name || '').toLowerCase();
        const email = String(item.email || '').toLowerCase();
        const flat = String(item.flatNumber || '').toLowerCase();
        return name.includes(value) || email.includes(value) || flat.includes(value);
      })
      .slice(0, 8);
  }, [residentQuery, users]);

  const selectedUserDues = useMemo(() => {
    if (!selectedUser) return [];
    return dues.filter((due) => due?.userId?._id === selectedUser._id);
  }, [dues, selectedUser]);

  const outstandingForSelected = useMemo(
    () => selectedUserDues.reduce((sum, item) => sum + getRemainingAmount(item), 0),
    [selectedUserDues]
  );

  const paidDuesCount = useMemo(
    () => selectedUserDues.filter((item) => getDueStatus(item) === 'paid').length,
    [selectedUserDues]
  );

  const stats = useMemo(() => {
    const totalResidents = users.length;
    const totalGenerated = dues.reduce((sum, item) => sum + Number(item.amountDue || 0), 0);
    const totalCollected = dues.reduce((sum, item) => sum + Number(item.paidAmount || 0), 0);
    const pendingAmount = dues.reduce((sum, item) => sum + getRemainingAmount(item), 0);
    const collectionRate = getCollectionRate(totalCollected, totalGenerated);

    return {
      totalResidents,
      totalGenerated,
      totalCollected,
      pendingAmount,
      collectionRate,
    };
  }, [dues, users]);

  const uniqueMonths = useMemo(() => {
    const seen = new Set();
    dues.forEach((item) => {
      if (item.month) seen.add(item.month);
    });
    return ['all', ...Array.from(seen)];
  }, [dues]);

  const records = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    let list = dues.filter((item) => {
      const status = getDueStatus(item);
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (monthFilter !== 'all' && item.month !== monthFilter) return false;

      if (!normalizedQuery) return true;
      const resident = item.userId?.name || '';
      const flat = item.userId?.flatNumber || '';
      const blob = `${resident} ${flat} ${item.month || ''} ${item._id || ''}`.toLowerCase();
      return blob.includes(normalizedQuery);
    });

    list.sort((a, b) => {
      if (sortBy === 'amount_high') return Number(b.amountDue || 0) - Number(a.amountDue || 0);
      if (sortBy === 'amount_low') return Number(a.amountDue || 0) - Number(b.amountDue || 0);

      const aTime = new Date(a.createdAt).getTime();
      const bTime = new Date(b.createdAt).getTime();
      return sortBy === 'newest' ? bTime - aTime : aTime - bTime;
    });

    return list;
  }, [dues, monthFilter, query, sortBy, statusFilter]);

  const monthlyInsights = useMemo(() => {
    const map = new Map();

    dues.forEach((item) => {
      const month = item.month || 'Unknown';
      const previous = map.get(month) || { due: 0, paid: 0 };
      previous.due += Number(item.amountDue || 0);
      previous.paid += Number(item.paidAmount || 0);
      map.set(month, previous);
    });

    return Array.from(map.entries())
      .map(([month, totals]) => ({
        month,
        due: totals.due,
        paid: totals.paid,
        rate: getCollectionRate(totals.paid, totals.due),
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);
  }, [dues]);

  const validateCreate = () => {
    const nextErrors = {};

    if (!form.userId) nextErrors.userId = 'Please select a resident';
    if (!form.month.trim()) {
      nextErrors.month = 'Month is required';
    } else if (!/^[0-9]{4}-(0[1-9]|1[0-2])$/.test(form.month.trim())) {
      nextErrors.month = 'Month must be in YYYY-MM format (e.g. 2026-03)';
    }

    const amount = Number(form.amountDue);
    if (!Number.isFinite(amount) || amount <= 0) nextErrors.amountDue = 'Enter a valid amount';

    if (!form.dueDate.trim()) {
      nextErrors.dueDate = 'Due date is required';
    } else {
      const date = new Date(form.dueDate);
      if (Number.isNaN(date.getTime())) nextErrors.dueDate = 'Use format YYYY-MM-DD';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const resetForm = () => {
    setForm({ userId: '', month: '', amountDue: '', dueDate: '' });
    setResidentQuery('');
    setShowResidentList(false);
    setErrors({});
  };

  const submitDue = async () => {
    if (!validateCreate()) return;

    try {
      setSubmitting(true);
      await createMaintenance({
        userId: form.userId,
        month: form.month.trim(),
        amountDue: Number(form.amountDue),
        dueDate: new Date(form.dueDate).toISOString(),
      });

      showSuccess('Due created', 'Maintenance due created successfully');
      resetForm();
      if (isMobile) setShowMobileForm(false);
      loadDues(true);
    } catch (error) {
      showError('Create failed', getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const payDue = async (item) => {
    const pendingAmount = getRemainingAmount(item);
    if (pendingAmount <= 0) {
      showSuccess('No action needed', 'This due is already paid');
      return;
    }

    try {
      setPayingId(item._id);
      await payMaintenance(item._id, {
        amount: pendingAmount,
        method: 'online',
        reference: `APP-${Date.now()}`,
      });
      showSuccess('Payment recorded', 'Maintenance marked as paid');
      loadDues(true);
    } catch (error) {
      showError('Payment failed', getErrorMessage(error));
    } finally {
      setPayingId('');
    }
  };

  const notifyDue = async (item) => {
    try {
      setNotifyingId(item._id);
      await notifyMaintenance(item._id);
      showSuccess('Reminder sent', `${item.userId?.name || 'Resident'} has been notified`);
      loadDues(true);
    } catch (error) {
      showError('Notify failed', getErrorMessage(error));
    } finally {
      setNotifyingId('');
    }
  };

  if (loading) return <LoadingOverlay />;

  return (
    <ScreenContainer scroll={false}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDues(true)}
            tintColor={COLORS.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageWrap}>
          <PageHeader
            title="Maintenance Dashboard"
            subtitle="Track society dues, monitor collection performance, and keep financial operations transparent."
            icon="wallet-outline"
          />

          <View style={[styles.statsGrid, isMobile && styles.statsGridMobile, isTablet && styles.statsGridTablet]}>
            <StatCard
              icon="people-outline"
              label="Total Residents"
              value={String(stats.totalResidents)}
              trend="Active billing base"
              accent={COLORS.accent}
              tint="rgba(37,99,235,0.12)"
              isMobile={isMobile}
              isTablet={isTablet}
            />
            <StatCard
              icon="document-text-outline"
              label="Dues Generated"
              value={currency(stats.totalGenerated)}
              trend="Total billed value"
              accent={COLORS.accent}
              tint="rgba(37,99,235,0.08)"
              isMobile={isMobile}
              isTablet={isTablet}
            />
            <StatCard
              icon="checkmark-done-outline"
              label="Amount Collected"
              value={currency(stats.totalCollected)}
              trend="Collected so far"
              accent={COLORS.success}
              tint="rgba(16,185,129,0.14)"
              isMobile={isMobile}
              isTablet={isTablet}
            />
            <StatCard
              icon="time-outline"
              label="Pending Payments"
              value={currency(stats.pendingAmount)}
              trend="Outstanding amount"
              accent={COLORS.warning}
              tint="rgba(245,158,11,0.14)"
              isMobile={isMobile}
              isTablet={isTablet}
            />
            <StatCard
              icon="stats-chart-outline"
              label="Collection Rate"
              value={`${stats.collectionRate}%`}
              trend="Payment efficiency"
              accent={stats.collectionRate >= 75 ? COLORS.success : COLORS.warning}
              tint="rgba(15,23,42,0.06)"
              isMobile={isMobile}
              isTablet={isTablet}
            />
          </View>

          <View style={[styles.mainLayout, isDesktop && styles.mainLayoutDesktop]}>
            {isAdmin && !isMobile ? (
              <View style={styles.formColumn}>
                <CreateDueCard
                  residentQuery={residentQuery}
                  setResidentQuery={setResidentQuery}
                  showResidentList={showResidentList}
                  setShowResidentList={setShowResidentList}
                  residentMatches={residentMatches}
                  form={form}
                  setForm={setForm}
                  selectedUser={selectedUser}
                  selectedUserDues={selectedUserDues}
                  outstandingForSelected={outstandingForSelected}
                  paidDuesCount={paidDuesCount}
                  errors={errors}
                  setErrors={setErrors}
                  submitting={submitting}
                  submitDue={submitDue}
                />
              </View>
            ) : null}

            <View style={styles.recordsColumn}>
              <AppCard style={styles.filterCard}>
                <View style={styles.searchShell}>
                  <Ionicons name="search-outline" size={18} color={COLORS.textMuted} />
                  <AppInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder="Search resident, flat, month, ID"
                    noMargin
                  />
                </View>

                <View style={[styles.filterRows, isMobile && styles.filterRowsMobile]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowChips}>
                    {STATUS_FILTERS.map((item) => {
                      const active = item === statusFilter;
                      return (
                        <Pressable
                          key={item}
                          onPress={() => setStatusFilter(item)}
                          style={[styles.filterChip, active && styles.filterChipActive]}
                        >
                          <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                            {item.charAt(0).toUpperCase() + item.slice(1)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rowChips}>
                    {uniqueMonths.map((month) => {
                      const active = monthFilter === month;
                      return (
                        <Pressable
                          key={month}
                          onPress={() => setMonthFilter(month)}
                          style={[styles.filterChip, active && styles.filterChipActive]}
                        >
                          <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>
                            {month === 'all' ? 'All Months' : month}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>

                  <View style={styles.sortRow}>
                    {SORT_FILTERS.map((item) => {
                      const active = sortBy === item.key;
                      return (
                        <Pressable
                          key={item.key}
                          onPress={() => setSortBy(item.key)}
                          style={[styles.sortChip, active && styles.sortChipActive]}
                        >
                          <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>{item.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              </AppCard>

              <InsightsCard monthlyInsights={monthlyInsights} pendingAmount={stats.pendingAmount} />

              {records.length === 0 ? (
                <AppCard style={styles.emptyStateCard}>
                  <View style={styles.emptyIconWrap}>
                    <Ionicons name="wallet-outline" size={32} color={COLORS.accent} />
                  </View>
                  <Text style={styles.emptyTitle}>No maintenance records yet</Text>
                  <Text style={styles.emptySub}>Create the first due to start tracking collection performance.</Text>
                  {isAdmin ? <AppButton title="Create First Due" onPress={() => setShowMobileForm(true)} /> : null}
                </AppCard>
              ) : (
                records.map((item, index) => (
                  <Animated.View
                    key={item._id}
                    entering={FadeInDown.duration(230).delay(index * 25)}
                    style={styles.recordEnterWrap}
                  >
                    <RecordCard
                      item={item}
                      isAdmin={isAdmin}
                      paying={payingId === item._id}
                      notifying={notifyingId === item._id}
                      onPay={payDue}
                      onNotify={notifyDue}
                    />
                  </Animated.View>
                ))
              )}
            </View>
          </View>

          <View style={styles.bottomSafeSpace} />
        </View>
      </ScrollView>

      {isAdmin && isMobile ? (
        <Pressable style={styles.fab} onPress={() => setShowMobileForm(true)}>
          <Ionicons name="add" size={26} color={COLORS.white} />
        </Pressable>
      ) : null}

      <Modal visible={showMobileForm} transparent animationType="slide" onRequestClose={() => setShowMobileForm(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Maintenance Due</Text>
              <Pressable style={styles.modalClose} onPress={() => setShowMobileForm(false)}>
                <Ionicons name="close" size={20} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <CreateDueCard
                residentQuery={residentQuery}
                setResidentQuery={setResidentQuery}
                showResidentList={showResidentList}
                setShowResidentList={setShowResidentList}
                residentMatches={residentMatches}
                form={form}
                setForm={setForm}
                selectedUser={selectedUser}
                selectedUserDues={selectedUserDues}
                outstandingForSelected={outstandingForSelected}
                paidDuesCount={paidDuesCount}
                errors={errors}
                setErrors={setErrors}
                submitting={submitting}
                submitDue={submitDue}
                compact
              />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const StatCard = ({ icon, label, value, trend, accent, tint, isMobile, isTablet }) => (
  <AppCard
    style={[
      styles.statCard,
      isTablet && styles.statCardTablet,
      isMobile && styles.statCardMobile,
      { backgroundColor: tint },
    ]}
  >
    <View
      style={[
        styles.statIcon,
        isTablet && styles.statIconTablet,
        isMobile && styles.statIconMobile,
        { backgroundColor: `${accent}22` },
      ]}
    >
      <Ionicons name={icon} size={isMobile ? 14 : isTablet ? 16 : 18} color={accent} />
    </View>
    <Text style={[styles.statValue, isTablet && styles.statValueTablet, isMobile && styles.statValueMobile]} numberOfLines={1}>
      {value}
    </Text>
    <Text style={[styles.statLabel, isTablet && styles.statLabelTablet, isMobile && styles.statLabelMobile]} numberOfLines={1}>
      {label}
    </Text>
    {!isMobile ? (
      <View style={[styles.statTrendRow, isTablet && styles.statTrendRowTablet]}>
        <Ionicons name="trending-up" size={isTablet ? 12 : 13} color={accent} />
        <Text style={[styles.statTrend, isTablet && styles.statTrendTablet, { color: accent }]} numberOfLines={1}>
          {trend}
        </Text>
      </View>
    ) : null}
  </AppCard>
);

const CreateDueCard = ({
  residentQuery,
  setResidentQuery,
  showResidentList,
  setShowResidentList,
  residentMatches,
  form,
  setForm,
  selectedUser,
  selectedUserDues,
  outstandingForSelected,
  paidDuesCount,
  errors,
  setErrors,
  submitting,
  submitDue,
  compact = false,
}) => (
  <AppCard style={[styles.createCard, compact && styles.createCardCompact]}>
    <Text style={styles.sectionTitle}>Create Maintenance Due</Text>
    <Text style={styles.sectionSubTitle}>Generate monthly dues with resident-aware context and payment visibility.</Text>

    <AppInput
      label="Resident"
      value={residentQuery}
      onFocus={() => setShowResidentList(true)}
      onChangeText={(value) => {
        setResidentQuery(value);
        setForm((prev) => ({ ...prev, userId: '' }));
        setErrors((prev) => ({ ...prev, userId: '' }));
      }}
      placeholder="Search resident by name, flat, or email"
      error={errors.userId}
      leftIcon="search-outline"
    />

    {showResidentList && residentMatches.length > 0 ? (
      <View style={styles.searchResults}>
        {residentMatches.map((item, index) => (
          <Pressable
            key={item._id}
            onPress={() => {
              setForm((prev) => ({ ...prev, userId: item._id }));
              setResidentQuery(item.name || '');
              setShowResidentList(false);
              setErrors((prev) => ({ ...prev, userId: '' }));
            }}
            style={[styles.searchResultItem, index === residentMatches.length - 1 && styles.searchResultItemLast]}
          >
            <View style={styles.avatarMini}>
              <Text style={styles.avatarMiniText}>{String(item.name || 'R').charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.searchResultName}>{item.name}</Text>
              <Text style={styles.searchResultMeta}>{item.flatNumber || '-'}  •  {item.email}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    ) : null}

    {selectedUser ? (
      <View style={styles.residentPreviewCard}>
        <View style={styles.residentTop}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>{String(selectedUser.name || 'R').charAt(0).toUpperCase()}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.residentName}>{selectedUser.name}</Text>
            <Text style={styles.residentMeta}>Flat {selectedUser.flatNumber || '-'}  •  {selectedUser.phone || selectedUser.email}</Text>
          </View>
        </View>

        <View style={styles.previewStats}>
          <View style={styles.previewStatChip}>
            <Text style={styles.previewStatLabel}>Outstanding</Text>
            <Text style={styles.previewStatValue}>{currency(outstandingForSelected)}</Text>
          </View>
          <View style={styles.previewStatChip}>
            <Text style={styles.previewStatLabel}>Paid Cycles</Text>
            <Text style={styles.previewStatValue}>{paidDuesCount}</Text>
          </View>
          <View style={styles.previewStatChip}>
            <Text style={styles.previewStatLabel}>Total Cycles</Text>
            <Text style={styles.previewStatValue}>{selectedUserDues.length}</Text>
          </View>
        </View>
      </View>
    ) : (
      <Text style={styles.selectedHint}>Select a resident to preview payment context.</Text>
    )}

    <Text style={styles.label}>Billing Month</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.monthChipRow}>
      {MONTH_CHOICES.map((month) => {
        const active = form.month === month;
        return (
          <Pressable
            key={month}
            onPress={() => {
              setForm((prev) => ({ ...prev, month }));
              setErrors((prev) => ({ ...prev, month: '' }));
            }}
            style={[styles.monthChip, active && styles.monthChipActive]}
          >
            <Text style={[styles.monthChipText, active && styles.monthChipTextActive]}>{month}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
    {errors.month ? <Text style={styles.errorText}>{errors.month}</Text> : null}

    <AppInput
      label="Amount Due"
      value={form.amountDue}
      onChangeText={(value) => {
        const clean = value.replace(/[^\d.]/g, '');
        setForm((prev) => ({ ...prev, amountDue: clean }));
        setErrors((prev) => ({ ...prev, amountDue: '' }));
      }}
      placeholder="Enter amount in INR"
      keyboardType="numeric"
      error={errors.amountDue}
      leftIcon="cash-outline"
      helperText={form.amountDue ? `Formatted: ${currency(form.amountDue)}` : 'Enter amount in INR'}
    />

    <AppInput
      label="Due Date"
      value={form.dueDate}
      onChangeText={(value) => {
        setForm((prev) => ({ ...prev, dueDate: value }));
        setErrors((prev) => ({ ...prev, dueDate: '' }));
      }}
      placeholder="Select due date"
      error={errors.dueDate}
      leftIcon="calendar-outline"
      helperText="Use format YYYY-MM-DD"
    />

    <AppButton title="Create Due" onPress={submitDue} loading={submitting} />
  </AppCard>
);

const InsightsCard = ({ monthlyInsights, pendingAmount }) => {
  const maxDue = Math.max(...monthlyInsights.map((m) => m.due), 1);

  return (
    <AppCard style={styles.insightCard}>
      <Text style={styles.sectionTitle}>Financial Insights</Text>
      <Text style={styles.sectionSubTitle}>Monthly collection trend and performance overview.</Text>

      <View style={styles.revenueRow}>
        <View style={styles.revenueChip}>
          <Text style={styles.revenueLabel}>Pending Amount</Text>
          <Text style={styles.revenueValue}>{currency(pendingAmount)}</Text>
        </View>
      </View>

      <View style={styles.chartWrap}>
        {monthlyInsights.length === 0 ? (
          <Text style={styles.chartEmpty}>No monthly data available yet.</Text>
        ) : (
          monthlyInsights.map((item) => (
            <View key={item.month} style={styles.chartRow}>
              <Text style={styles.chartMonth}>{item.month}</Text>
              <View style={styles.chartTrack}>
                <View
                  style={[
                    styles.chartFill,
                    {
                      width: `${Math.max(6, Math.round((item.due / maxDue) * 100))}%`,
                      backgroundColor: item.rate >= 80 ? COLORS.success : item.rate >= 50 ? COLORS.warning : '#EF4444',
                    },
                  ]}
                />
              </View>
              <Text style={styles.chartRate}>{item.rate}%</Text>
            </View>
          ))
        )}
      </View>
    </AppCard>
  );
};

const RecordCard = ({ item, isAdmin, paying, notifying, onPay, onNotify }) => {
  const status = getDueStatus(item);
  const tone = getStatusTone(status);
  const remaining = getRemainingAmount(item);

  return (
    <AppCard style={[styles.recordCard, { borderLeftColor: tone.color }]}> 
      <View style={styles.recordTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.recordResident}>{item.userId?.name || 'Resident'}</Text>
          <Text style={styles.recordFlat}>Flat {item.userId?.flatNumber || '-'}  •  {item.month}</Text>
        </View>

        <View style={[styles.statusBadge, { backgroundColor: tone.bg, borderColor: tone.border }]}> 
          <Ionicons name={tone.icon} size={14} color={tone.color} />
          <Text style={[styles.statusText, { color: tone.color }]}>{tone.text}</Text>
        </View>
      </View>

      <View style={styles.amountRow}>
        <AmountPill label="Amount" value={currency(item.amountDue)} />
        <AmountPill label="Paid" value={currency(item.paidAmount)} />
        <AmountPill label="Pending" value={currency(remaining)} />
      </View>

      <View style={styles.metaRow}>
        <Meta icon="calendar-outline" text={`Due: ${formatDate(item.dueDate)}`} />
        <Meta icon="time-outline" text={`Created: ${formatDate(item.createdAt)}`} />
        {item.lastPaymentDate ? <Meta icon="checkmark-done-outline" text={`Paid: ${formatDate(item.lastPaymentDate)}`} /> : null}
      </View>

      {isAdmin && status !== 'paid' ? (
        <View style={styles.actionRow}>
          <AppButton
            title="Notify Resident"
            variant="outline"
            onPress={() => onNotify(item)}
            loading={notifying}
            style={styles.actionBtn}
            size="small"
          />
        </View>
      ) : null}

      {!isAdmin && status !== 'paid' ? (
        <View style={styles.actionRow}>
          <AppButton
            title="Pay Now"
            onPress={() => onPay(item)}
            loading={paying}
            style={styles.actionBtn}
            size="small"
          />
        </View>
      ) : null}
    </AppCard>
  );
};

const AmountPill = ({ label, value }) => (
  <View style={styles.amountPill}>
    <Text style={styles.amountPillLabel}>{label}</Text>
    <Text style={styles.amountPillValue}>{value}</Text>
  </View>
);

const Meta = ({ icon, text }) => (
  <View style={styles.metaChip}>
    <Ionicons name={icon} size={13} color={COLORS.textMuted} />
    <Text style={styles.metaText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  pageWrap: {
    width: '100%',
    maxWidth: 1340,
    alignSelf: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statsGridMobile: {
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  statsGridTablet: {
    gap: SPACING.sm,
  },
  statCard: {
    minHeight: 130,
    flexGrow: 1,
    flexBasis: 210,
    borderRadius: RADIUS.lg,
    borderColor: 'rgba(15,23,42,0.08)',
  },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  statCardTablet: {
    flexBasis: '48%',
    minHeight: 112,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  statCardMobile: {
    width: '48.5%',
    flexGrow: 0,
    flexBasis: '48.5%',
    minHeight: 82,
    padding: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  statIconTablet: {
    width: 30,
    height: 30,
    borderRadius: 9,
    marginBottom: 6,
  },
  statIconMobile: {
    width: 24,
    height: 24,
    borderRadius: 8,
    marginBottom: 4,
  },
  statValue: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  statValueTablet: {
    fontSize: 19,
    lineHeight: 23,
  },
  statValueMobile: {
    fontSize: 16,
    lineHeight: 19,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  statLabelTablet: {
    fontSize: 11,
    marginTop: 0,
  },
  statLabelMobile: {
    fontSize: 10,
    marginTop: 0,
  },
  statTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: SPACING.sm,
  },
  statTrend: {
    fontSize: 12,
    fontWeight: '700',
  },
  statTrendRowTablet: {
    marginTop: 4,
  },
  statTrendTablet: {
    fontSize: 10,
  },
  mainLayout: {
    width: '100%',
    gap: SPACING.md,
  },
  mainLayoutDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  formColumn: {
    width: 430,
    minWidth: 390,
  },
  recordsColumn: {
    flex: 1,
    minWidth: 0,
  },
  createCard: {
    borderRadius: RADIUS.lg,
  },
  createCardCompact: {
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  sectionSubTitle: {
    color: COLORS.textMuted,
    marginTop: 3,
    marginBottom: SPACING.md,
    fontSize: 13,
  },
  label: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  searchResults: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm,
    overflow: 'hidden',
  },
  searchResultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchResultItemLast: {
    borderBottomWidth: 0,
  },
  avatarMini: {
    width: 30,
    height: 30,
    borderRadius: 999,
    backgroundColor: COLORS.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarMiniText: {
    color: COLORS.accent,
    fontWeight: '700',
  },
  searchResultName: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  searchResultMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  residentPreviewCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  residentTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatarLarge: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLargeText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  residentName: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  residentMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  previewStats: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  previewStatChip: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.sm,
    padding: SPACING.xs,
  },
  previewStatLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  previewStatValue: {
    color: COLORS.textPrimary,
    marginTop: 4,
    fontWeight: '700',
    fontSize: 12,
  },
  selectedHint: {
    color: COLORS.textHint,
    marginBottom: SPACING.sm,
    fontSize: 12,
  },
  monthChipRow: {
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
    paddingBottom: 4,
  },
  monthChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  monthChipActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
  },
  monthChipText: {
    color: COLORS.textMuted,
    fontWeight: '700',
    fontSize: 12,
  },
  monthChipTextActive: {
    color: COLORS.accent,
  },
  errorText: {
    color: '#EF4444',
    marginBottom: SPACING.xs,
    fontSize: 12,
  },
  filterCard: {
    borderRadius: RADIUS.lg,
  },
  searchShell: {
    minHeight: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  filterRows: {
    gap: SPACING.xs,
  },
  filterRowsMobile: {
    gap: SPACING.sm,
  },
  rowChips: {
    gap: SPACING.xs,
    paddingRight: SPACING.sm,
  },
  filterChip: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
    backgroundColor: COLORS.surface,
  },
  filterChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  filterChipText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: COLORS.accent,
  },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  sortChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  sortChipActive: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  sortChipText: {
    color: COLORS.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  sortChipTextActive: {
    color: COLORS.accent,
  },
  insightCard: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  revenueRow: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  revenueChip: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  revenueLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  revenueValue: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
    marginTop: 4,
  },
  chartWrap: {
    gap: SPACING.xs,
  },
  chartEmpty: {
    color: COLORS.textHint,
    fontSize: 12,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  chartMonth: {
    width: 62,
    color: COLORS.textMuted,
    fontSize: 11,
  },
  chartTrack: {
    flex: 1,
    height: 10,
    borderRadius: 999,
    backgroundColor: COLORS.surfaceAlt,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chartFill: {
    height: '100%',
    borderRadius: 999,
  },
  chartRate: {
    width: 42,
    textAlign: 'right',
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  emptyStateCard: {
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    paddingVertical: SPACING.xl,
  },
  emptyIconWrap: {
    width: 68,
    height: 68,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
    marginBottom: SPACING.sm,
  },
  emptyTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs,
  },
  emptySub: {
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: SPACING.md,
    maxWidth: 360,
  },
  recordEnterWrap: {
    width: '100%',
  },
  recordCard: {
    borderRadius: RADIUS.lg,
    borderLeftWidth: 4,
  },
  recordTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  recordResident: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 16,
  },
  recordFlat: {
    color: COLORS.textMuted,
    marginTop: 2,
    fontSize: 12,
  },
  statusBadge: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  amountRow: {
    flexDirection: 'row',
    gap: SPACING.xs,
    marginBottom: SPACING.sm,
  },
  amountPill: {
    flex: 1,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.xs,
  },
  amountPillLabel: {
    color: COLORS.textHint,
    fontSize: 11,
    marginBottom: 4,
  },
  amountPillValue: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.xs,
  },
  metaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    backgroundColor: COLORS.surface,
  },
  metaText: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  actionRow: {
    marginTop: SPACING.sm,
  },
  actionBtn: {
    width: '100%',
  },
  fab: {
    position: 'absolute',
    right: SPACING.md,
    bottom: SPACING.xl,
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.accentDark,
    ...SHADOW.lg,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(2,6,23,0.45)',
  },
  modalSheet: {
    maxHeight: '92%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: COLORS.bg,
    paddingHorizontal: SPACING.sm,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  modalClose: {
    width: 36,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  bottomSafeSpace: {
    height: Platform.OS === 'web' ? SPACING.md : 82,
  },
});

export default MaintenanceScreen;
