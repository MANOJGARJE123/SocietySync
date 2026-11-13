import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
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
import { getSociety, getWingsBySociety } from '../services/societyService';
import { deleteUser, getUsers, updateUserRole } from '../services/userService';
import { getErrorMessage } from '../utils/error';
import { showError, showSuccess } from '../utils/toast';

// FIX: super_admin removed — admins cannot assign that role
const ROLE_OPTIONS = [ROLES.ADMIN, ROLES.CHAIRMAN, ROLES.RESIDENT];

const roleTone = {
  super_admin: { bg: 'rgba(239,68,68,0.14)', color: '#EF4444' },
  admin:       { bg: COLORS.accentSoft, color: COLORS.accent },
  chairman:    { bg: 'rgba(0,212,170,0.16)', color: '#00D4AA' },
  resident:    { bg: 'rgba(255,255,255,0.06)', color: COLORS.textMuted },
};

const wingStatusTone = {
  approved: { bg: 'rgba(16,185,129,0.14)', color: COLORS.success },
  pending:  { bg: 'rgba(245,158,11,0.14)',  color: COLORS.warning },
  rejected: { bg: 'rgba(239,68,68,0.14)',   color: '#EF4444' },
  none:     { bg: COLORS.surfaceAlt,         color: COLORS.textMuted },
};

const getInitials = (name) =>
  String(name || 'U').split(' ').filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');

const UsersScreen = () => {
  const { user, refreshProfile } = useAuth();
  const { isMobile } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [users, setUsers] = useState([]);
  const [wings, setWings] = useState([]);
  const [expandedUserId, setExpandedUserId] = useState(null);
  const [societyName, setSocietyName] = useState('');
  const [selectedRoles, setSelectedRoles] = useState({});
  const [savingUserId, setSavingUserId] = useState('');
  const [deletingUserId, setDeletingUserId] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  const wingNameById = useMemo(() => {
    const map = {};
    wings.forEach(w => { map[String(w._id || w.id)] = w.name; });
    return map;
  }, [wings]);

  const loadUsers = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      const [fetchedUsers, society, fetchedWings] = await Promise.all([
        getUsers(),
        user?.societyId ? getSociety(user.societyId).catch(() => null) : Promise.resolve(null),
        user?.societyId ? getWingsBySociety(user.societyId).catch(() => []) : Promise.resolve([]),
      ]);
      setUsers(Array.isArray(fetchedUsers) ? fetchedUsers : []);
      setSocietyName(society?.name || '');
      setWings(Array.isArray(fetchedWings) ? fetchedWings : []);
    } catch (e) {
      showError('Load failed', getErrorMessage(e));
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, [user?.societyId]);

  useFocusEffect(useCallback(() => { loadUsers(); }, [loadUsers]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter(u => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (!q) return true;
      return `${u.name} ${u.email} ${u.flatNumber || ''} ${u.phone || ''}`.toLowerCase().includes(q);
    });
  }, [users, query, roleFilter]);

  const stats = useMemo(() => ({
    total:    users.length,
    admins:   users.filter(u => u.role === ROLES.ADMIN).length,
    chairmen: users.filter(u => u.role === ROLES.CHAIRMAN).length,
    residents: users.filter(u => u.role === ROLES.RESIDENT).length,
    pending:  users.filter(u => u.wingStatus === 'pending').length,
  }), [users]);

  const handleRoleChange = async (targetUser) => {
    const newRole = selectedRoles[targetUser._id];
    if (!newRole || newRole === targetUser.role) return;
    try {
      setSavingUserId(targetUser._id);
      await updateUserRole(targetUser._id, newRole);
      if (String(targetUser._id) === String(user?._id)) await refreshProfile();
      showSuccess('Role updated', `${targetUser.name} is now ${newRole}`);
      loadUsers(true);
    } catch (e) {
      showError('Role update failed', getErrorMessage(e));
    } finally {
      setSavingUserId('');
    }
  };

  const handleDelete = (targetUser) => {
    if (String(targetUser._id) === String(user?._id)) {
      showError('Cannot delete yourself', 'You cannot delete your own account.');
      return;
    }
    Alert.alert(
      'Delete User',
      `Delete ${targetUser.name}? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            try {
              setDeletingUserId(targetUser._id);
              await deleteUser(targetUser._id);
              showSuccess('User deleted', `${targetUser.name} has been removed.`);
              loadUsers(true);
            } catch (e) {
              showError('Delete failed', getErrorMessage(e));
            } finally {
              setDeletingUserId('');
            }
          },
        },
      ]
    );
  };

  if (loading) return <LoadingOverlay />;

  return (
    <ScreenContainer scroll={false}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadUsers(true)} tintColor={COLORS.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.page}>
          <PageHeader
            title="User Management"
            subtitle={societyName ? `Managing ${societyName}` : 'Society residents and staff'}
            icon="people-outline"
          />

          {/* Stats row */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
            <View style={styles.statsRow}>
              {[
                { label: 'Total', value: stats.total, color: COLORS.textSecondary },
                { label: 'Admins', value: stats.admins, color: COLORS.accent },
                { label: 'Chairmen', value: stats.chairmen, color: '#00D4AA' },
                { label: 'Residents', value: stats.residents, color: COLORS.textMuted },
                { label: 'Pending', value: stats.pending, color: COLORS.warning },
              ].map(s => (
                <AppCard key={s.label} style={styles.statPill}>
                  <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLbl}>{s.label}</Text>
                </AppCard>
              ))}
            </View>
          </ScrollView>

          {/* Search + Filter */}
          <AppCard style={styles.filterCard}>
            <AppInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search by name, email, flat..."
              leftIcon="search-outline"
              noMargin
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SPACING.sm }}>
              <View style={styles.filterRow}>
                {['all', 'admin', 'chairman', 'resident'].map(r => {
                  const active = roleFilter === r;
                  return (
                    <Pressable key={r} style={[styles.chip, active && styles.chipActive]} onPress={() => setRoleFilter(r)}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{r}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>
          </AppCard>

          {/* User list */}
          {filtered.length === 0
            ? <EmptyState icon="people-outline" title="No users found" subtitle="Try adjusting your search or filters." />
            : filtered.map((item, idx) => {
              const isExpanded = expandedUserId === item._id;
              const isSaving = savingUserId === item._id;
              const isDeleting = deletingUserId === item._id;
              const isSelf = String(item._id) === String(user?._id);
              const rTone = roleTone[item.role] || roleTone.resident;
              const wTone = wingStatusTone[item.wingStatus] || wingStatusTone.none;
              const wingName = item.wingId ? wingNameById[String(item.wingId)] : null;
              return (
                <Animated.View key={item._id} entering={FadeInDown.delay(idx * 20)}>
                  <AppCard style={[styles.userCard, isDeleting && { opacity: 0.5 }]}>
                    <Pressable onPress={() => setExpandedUserId(prev => prev === item._id ? null : item._id)}>
                      <View style={styles.userRow}>
                        {/* Avatar */}
                        <View style={[styles.avatar, { backgroundColor: `${rTone.color}22` }]}>
                          <Text style={[styles.avatarText, { color: rTone.color }]}>{getInitials(item.name)}</Text>
                        </View>
                        {/* Info */}
                        <View style={{ flex: 1 }}>
                          <View style={styles.nameRow}>
                            <Text style={styles.userName} numberOfLines={1}>{item.name}</Text>
                            {isSelf && <View style={styles.selfBadge}><Text style={styles.selfBadgeText}>You</Text></View>}
                          </View>
                          <Text style={styles.userEmail} numberOfLines={1}>{item.email}</Text>
                          <View style={styles.badgeRow}>
                            <View style={[styles.badge, { backgroundColor: rTone.bg }]}>
                              <Text style={[styles.badgeText, { color: rTone.color }]}>{item.role}</Text>
                            </View>
                            <View style={[styles.badge, { backgroundColor: wTone.bg }]}>
                              <Text style={[styles.badgeText, { color: wTone.color }]}>{item.wingStatus || 'none'}</Text>
                            </View>
                          </View>
                        </View>
                        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textMuted} />
                      </View>
                    </Pressable>

                    {isExpanded && (
                      <Animated.View entering={FadeInDown.duration(200)} style={styles.expanded}>
                        <View style={styles.detailGrid}>
                          {[
                            { icon: 'home-outline', label: 'Flat', value: item.flatNumber || '—' },
                            { icon: 'call-outline', label: 'Phone', value: item.phone || '—' },
                            { icon: 'layers-outline', label: 'Wing', value: wingName || (item.wingId ? 'Assigned' : '—') },
                          ].map(d => (
                            <View key={d.label} style={styles.detailItem}>
                              <Ionicons name={d.icon} size={13} color={COLORS.textMuted} />
                              <View>
                                <Text style={styles.detailLabel}>{d.label}</Text>
                                <Text style={styles.detailValue}>{d.value}</Text>
                              </View>
                            </View>
                          ))}
                        </View>

                        {/* Role change */}
                        {!isSelf && (
                          <View style={styles.roleRow}>
                            <Text style={styles.roleLabel}>Change Role</Text>
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                              <View style={styles.rolePills}>
                                {ROLE_OPTIONS.map(r => {
                                  const active = (selectedRoles[item._id] ?? item.role) === r;
                                  const t = roleTone[r] || roleTone.resident;
                                  return (
                                    <Pressable
                                      key={r}
                                      style={[styles.rolePill, active && { backgroundColor: t.bg, borderColor: t.color }]}
                                      onPress={() => setSelectedRoles(prev => ({ ...prev, [item._id]: r }))}
                                    >
                                      <Text style={[styles.rolePillText, active && { color: t.color }]}>{r}</Text>
                                    </Pressable>
                                  );
                                })}
                              </View>
                            </ScrollView>
                            <AppButton
                              title={isSaving ? 'Saving…' : 'Apply Role'}
                              onPress={() => handleRoleChange(item)}
                              loading={isSaving}
                              disabled={!selectedRoles[item._id] || selectedRoles[item._id] === item.role}
                              size="small"
                              style={{ marginTop: SPACING.xs }}
                            />
                          </View>
                        )}

                        {/* Delete */}
                        {!isSelf && (
                          <Pressable style={styles.deleteBtn} onPress={() => handleDelete(item)} disabled={isDeleting}>
                            <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            <Text style={styles.deleteBtnText}>{isDeleting ? 'Deleting…' : 'Delete User'}</Text>
                          </Pressable>
                        )}
                      </Animated.View>
                    )}
                  </AppCard>
                </Animated.View>
              );
            })}
          <View style={{ height: 20 }} />
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  page: { maxWidth: 1100, alignSelf: 'center', width: '100%' },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, paddingRight: SPACING.md },
  statPill: { minWidth: 80, alignItems: 'center', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  statVal: { fontSize: 20, fontWeight: '800' },
  statLbl: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  filterCard: { marginBottom: SPACING.md },
  filterRow: { flexDirection: 'row', gap: SPACING.xs },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 7, backgroundColor: COLORS.surface },
  chipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  chipTextActive: { color: COLORS.accent },
  userCard: { marginBottom: SPACING.sm },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  avatar: { width: 42, height: 42, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarText: { fontSize: 15, fontWeight: '800' },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  userName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, flex: 1 },
  selfBadge: { backgroundColor: COLORS.accentSoft, borderRadius: RADIUS.pill, paddingHorizontal: 7, paddingVertical: 3 },
  selfBadgeText: { color: COLORS.accent, fontSize: 10, fontWeight: '800' },
  userEmail: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  badgeRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.xs, flexWrap: 'wrap' },
  badge: { borderRadius: RADIUS.pill, paddingHorizontal: 9, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  expanded: { marginTop: SPACING.md, paddingTop: SPACING.md, borderTopWidth: 1, borderTopColor: COLORS.border },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.sm, marginBottom: SPACING.md },
  detailItem: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs, minWidth: 120 },
  detailLabel: { fontSize: 10, color: COLORS.textHint, fontWeight: '600', textTransform: 'uppercase' },
  detailValue: { fontSize: 13, color: COLORS.textPrimary, fontWeight: '600', marginTop: 2 },
  roleRow: { marginBottom: SPACING.sm },
  roleLabel: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary, marginBottom: SPACING.xs },
  rolePills: { flexDirection: 'row', gap: SPACING.xs },
  rolePill: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 8, backgroundColor: COLORS.surface },
  rolePillText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'capitalize' },
  deleteBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, alignSelf: 'flex-start', borderWidth: 1, borderColor: 'rgba(239,68,68,0.28)', backgroundColor: 'rgba(239,68,68,0.08)', borderRadius: RADIUS.md, paddingHorizontal: SPACING.sm, paddingVertical: 9, marginTop: SPACING.xs },
  deleteBtnText: { color: '#EF4444', fontWeight: '700', fontSize: 13 },
});

export default UsersScreen;
