import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
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
import { createNotice, deleteNotice, editNotice, getNotices } from '../services/noticeService';
import { formatDate } from '../utils/date';
import { getErrorMessage } from '../utils/error';
import { showError, showSuccess } from '../utils/toast';
import { isNumber, required } from '../utils/validators';

const PRIORITY_OPTIONS = ['normal', 'medium', 'high'];
const STATUS_FILTERS = ['all', 'active', 'expired'];
const SORT_OPTIONS = [{ key: 'newest', label: 'Newest' }, { key: 'oldest', label: 'Oldest' }];

const isActive = (n) => !n?.expiresAt || new Date(n.expiresAt).getTime() > Date.now();
const isExpiringSoon = (n) => {
  if (!n?.expiresAt) return false;
  const diff = new Date(n.expiresAt).getTime() - Date.now();
  return diff > 0 && diff <= 172800000;
};

const priorityTone = {
  high: { bg: 'rgba(239,68,68,0.14)', color: '#EF4444', icon: 'alert-circle-outline' },
  medium: { bg: 'rgba(245,158,11,0.14)', color: COLORS.warning, icon: 'warning-outline' },
  normal: { bg: 'rgba(37,99,235,0.14)', color: COLORS.accent, icon: 'information-circle-outline' },
};

const NoticesScreen = () => {
  const { user } = useAuth();
  const { isMobile, isDesktop } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notices, setNotices] = useState([]);
  const [form, setForm] = useState({ title: '', content: '', expiryDays: '7', priority: 'normal' });
  const [errors, setErrors] = useState({});
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState('');
  const [editingNotice, setEditingNotice] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', content: '', expiryDays: '' });
  const [showEditModal, setShowEditModal] = useState(false);
  const [deletingId, setDeletingId] = useState('');

  const canManage = [ROLES.ADMIN, ROLES.CHAIRMAN].includes(user?.role);

  const loadNotices = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setNotices(await getNotices() || []);
    } catch (e) { showError('Unable to load notices', getErrorMessage(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, []);

  useFocusEffect(useCallback(() => { loadNotices(); }, [loadNotices]));

  const enriched = useMemo(() =>
    notices.map(n => ({ ...n, active: isActive(n), expiringSoon: isExpiringSoon(n) })),
    [notices]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = enriched.filter(n => {
      if (statusFilter === 'active' && !n.active) return false;
      if (statusFilter === 'expired' && n.active) return false;
      if (priorityFilter !== 'all' && (n.priority || 'normal') !== priorityFilter) return false;
      if (!q) return true;
      return `${n.title} ${n.content}`.toLowerCase().includes(q);
    });
    return [...list].sort((a, b) => {
      const ta = new Date(a.createdAt||0).getTime(), tb = new Date(b.createdAt||0).getTime();
      return sortBy === 'newest' ? tb - ta : ta - tb;
    });
  }, [enriched, query, statusFilter, priorityFilter, sortBy]);

  const stats = useMemo(() => ({
    total: enriched.length,
    active: enriched.filter(n => n.active).length,
    expiringSoon: enriched.filter(n => n.expiringSoon).length,
  }), [enriched]);

  const validate = () => {
    const e = {};
    if (!required(form.title)) e.title = 'Title is required';
    if (!required(form.content)) e.content = 'Content is required';
    if (!isNumber(form.expiryDays) || Number(form.expiryDays) < 1 || Number(form.expiryDays) > 365)
      e.expiryDays = 'Expiry days must be 1–365';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const submitNotice = async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      await createNotice({ title: form.title.trim(), content: form.content.trim(), expiryDays: Number(form.expiryDays) });
      setForm({ title: '', content: '', expiryDays: '7', priority: 'normal' });
      showSuccess('Notice published', 'Residents can now see this notice');
      if (isMobile) setShowCreateModal(false);
      loadNotices(true);
    } catch (e) { showError('Create failed', getErrorMessage(e)); }
    finally { setSubmitting(false); }
  };

  const openEdit = (notice) => {
    setEditingNotice(notice);
    setEditForm({ title: notice.title || '', content: notice.content || '', expiryDays: String(notice.expiryDays || 7) });
    setShowEditModal(true);
  };

  const submitEdit = async () => {
    if (!editingNotice) return;
    try {
      setSubmitting(true);
      await editNotice(editingNotice._id, { title: editForm.title.trim(), content: editForm.content.trim(), expiryDays: Number(editForm.expiryDays) });
      showSuccess('Notice updated');
      setShowEditModal(false);
      loadNotices(true);
    } catch (e) { showError('Update failed', getErrorMessage(e)); }
    finally { setSubmitting(false); }
  };

  const handleDelete = (id) => {
    Alert.alert('Delete Notice', 'Are you sure you want to delete this notice?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setDeletingId(id);
          await deleteNotice(id); // FIX: real API call, not state-only
          showSuccess('Notice deleted');
          loadNotices(true);
        } catch (e) { showError('Delete failed', getErrorMessage(e)); }
        finally { setDeletingId(''); }
      }},
    ]);
  };

  if (loading) return <LoadingOverlay />;

  const createForm = (
    <AppCard style={styles.createCard}>
      <Text style={styles.sectionTitle}>Create Notice</Text>
      <Text style={styles.sectionSub}>Publish updates with clear priority and timing.</Text>
      <AppInput label="Title" value={form.title} onChangeText={v => { setForm(p => ({ ...p, title: v })); setErrors(p => ({ ...p, title: '' })); }} placeholder="Water shutdown update" error={errors.title} leftIcon="reader-outline" />
      <Text style={styles.counter}>{form.title.length}/200 chars</Text>
      <AppInput label="Content" value={form.content} onChangeText={v => { setForm(p => ({ ...p, content: v })); setErrors(p => ({ ...p, content: '' })); }} placeholder="Share details for residents..." multiline numberOfLines={5} error={errors.content} />
      <Text style={styles.counter}>{form.content.length}/10000 chars</Text>
      <Text style={styles.fieldTitle}>Priority</Text>
      <View style={styles.priorityRow}>
        {PRIORITY_OPTIONS.map(p => {
          const active = form.priority === p, tone = priorityTone[p];
          return (
            <Pressable key={p} style={[styles.priorityChip, active && { backgroundColor: tone.bg, borderColor: tone.color }]} onPress={() => setForm(prev => ({ ...prev, priority: p }))}>
              <Ionicons name={tone.icon} size={13} color={active ? tone.color : COLORS.textMuted} />
              <Text style={[styles.priorityChipText, active && { color: tone.color }]}>{p}</Text>
            </Pressable>
          );
        })}
      </View>
      <AppInput label="Expiry (days)" value={form.expiryDays} onChangeText={v => { setForm(p => ({ ...p, expiryDays: v })); setErrors(p => ({ ...p, expiryDays: '' })); }} placeholder="7" keyboardType="numeric" error={errors.expiryDays} leftIcon="calendar-outline" />
      <AppButton title="Publish Notice" onPress={submitNotice} loading={submitting} />
    </AppCard>
  );

  return (
    <ScreenContainer scroll={false}>
      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadNotices(true)} tintColor={COLORS.accent} />} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <PageHeader title="Communication Center" subtitle="Create, monitor, and manage society announcements." icon="megaphone-outline" />

          {/* Stats */}
          <View style={[styles.statsRow, isMobile && styles.statsRowMobile]}>
            {[
              { label: 'Total', value: stats.total, color: COLORS.accent },
              { label: 'Active', value: stats.active, color: COLORS.success },
              { label: 'Expiring Soon', value: stats.expiringSoon, color: COLORS.warning },
            ].map(s => (
              <AppCard key={s.label} style={[styles.statCard, isMobile && styles.statCardMobile]}>
                <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                <Text style={styles.statLbl}>{s.label}</Text>
              </AppCard>
            ))}
          </View>

          <View style={[styles.mainGrid, isDesktop && styles.mainGridDesktop]}>
            {canManage && !isMobile && <View style={styles.leftCol}>{createForm}</View>}
            <View style={styles.rightCol}>
              {/* Filters */}
              <AppCard style={styles.filterCard}>
                <AppInput value={query} onChangeText={setQuery} placeholder="Search notices..." leftIcon="search-outline" noMargin />
                <View style={styles.filterRow}>
                  {STATUS_FILTERS.map(s => {
                    const active = statusFilter === s;
                    return <Pressable key={s} style={[styles.chip, active && styles.chipActive]} onPress={() => setStatusFilter(s)}><Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text></Pressable>;
                  })}
                  {SORT_OPTIONS.map(o => {
                    const active = sortBy === o.key;
                    return <Pressable key={o.key} style={[styles.chip, active && styles.chipActive]} onPress={() => setSortBy(o.key)}><Text style={[styles.chipText, active && styles.chipTextActive]}>{o.label}</Text></Pressable>;
                  })}
                </View>
              </AppCard>

              {/* Notice list */}
              {filtered.length === 0
                ? <EmptyState icon="megaphone-outline" title="No notices found" subtitle="Create a new notice to start communicating." />
                : filtered.map((n, idx) => (
                  <Animated.View key={n._id} entering={FadeInDown.delay(idx * 20)}>
                    <AppCard style={[styles.noticeCard, !n.active && styles.noticeExpired]}>
                      <View style={styles.noticeTop}>
                        <View style={styles.tagsRow}>
                          <View style={[styles.badge, n.active ? styles.activeBadge : styles.expiredBadge]}>
                            <Text style={[styles.badgeText, n.active ? { color: COLORS.success } : { color: '#EF4444' }]}>{n.active ? 'Active' : 'Expired'}</Text>
                          </View>
                          {n.expiringSoon && n.active && (
                            <View style={[styles.badge, { backgroundColor: 'rgba(245,158,11,0.14)', borderColor: 'rgba(245,158,11,0.24)' }]}>
                              <Text style={[styles.badgeText, { color: COLORS.warning }]}>Expiring Soon</Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <Text style={styles.noticeTitle}>{n.title}</Text>
                      <Text style={styles.noticeContent} numberOfLines={expandedId === n._id ? 20 : 3}>{n.content}</Text>
                      <View style={styles.noticeMeta}>
                        <Text style={styles.metaText}>Published {formatDate(n.createdAt)}</Text>
                        <Text style={styles.metaText}>Expires {formatDate(n.expiresAt)}</Text>
                      </View>
                      <View style={styles.noticeActions}>
                        <Pressable style={styles.actionBtn} onPress={() => setExpandedId(prev => prev === n._id ? '' : n._id)}>
                          <Ionicons name="eye-outline" size={13} color={COLORS.textSecondary} />
                          <Text style={styles.actionBtnText}>{expandedId === n._id ? 'Collapse' : 'View'}</Text>
                        </Pressable>
                        {canManage && (
                          <>
                            <Pressable style={styles.actionBtn} onPress={() => openEdit(n)}>
                              <Ionicons name="create-outline" size={13} color={COLORS.accent} />
                              <Text style={[styles.actionBtnText, { color: COLORS.accent }]}>Edit</Text>
                            </Pressable>
                            <Pressable style={[styles.actionBtn, styles.actionBtnDanger]} onPress={() => handleDelete(n._id)} disabled={deletingId === n._id}>
                              <Ionicons name="trash-outline" size={13} color="#EF4444" />
                              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>{deletingId === n._id ? '...' : 'Delete'}</Text>
                            </Pressable>
                          </>
                        )}
                      </View>
                    </AppCard>
                  </Animated.View>
                ))}
            </View>
          </View>
        </View>
      </ScrollView>

      {canManage && isMobile && (
        <Pressable style={styles.fab} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add" size={26} color={COLORS.white} />
        </Pressable>
      )}

      {/* Create Modal (mobile) */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Create Notice</Text>
              <Pressable onPress={() => setShowCreateModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={COLORS.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>{createForm}</ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Notice</Text>
              <Pressable onPress={() => setShowEditModal(false)} style={styles.modalClose}>
                <Ionicons name="close" size={20} color={COLORS.textPrimary} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <AppCard>
                <AppInput label="Title" value={editForm.title} onChangeText={v => setEditForm(p => ({ ...p, title: v }))} leftIcon="reader-outline" />
                <AppInput label="Content" value={editForm.content} onChangeText={v => setEditForm(p => ({ ...p, content: v }))} multiline numberOfLines={5} />
                <AppInput label="Expiry (days)" value={editForm.expiryDays} onChangeText={v => setEditForm(p => ({ ...p, expiryDays: v }))} keyboardType="numeric" leftIcon="calendar-outline" />
                <AppButton title="Save Changes" onPress={submitEdit} loading={submitting} />
              </AppCard>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  page: { maxWidth: 1320, alignSelf: 'center', width: '100%' },
  statsRow: { flexDirection: 'row', gap: SPACING.sm, marginBottom: SPACING.md },
  statsRowMobile: { gap: SPACING.xs },
  statCard: { flex: 1, alignItems: 'center', paddingVertical: SPACING.sm },
  statCardMobile: { paddingVertical: SPACING.xs },
  statVal: { fontSize: 22, fontWeight: '800' },
  statLbl: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  mainGrid: { gap: SPACING.md },
  mainGridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  leftCol: { width: '42%', minWidth: 340 },
  rightCol: { flex: 1 },
  createCard: { borderRadius: RADIUS.lg },
  sectionTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  sectionSub: { color: COLORS.textMuted, fontSize: 13, marginBottom: SPACING.md, marginTop: 3 },
  counter: { color: COLORS.textHint, fontSize: 11, textAlign: 'right', marginTop: -SPACING.sm, marginBottom: SPACING.sm },
  fieldTitle: { ...TYPOGRAPHY.label, color: COLORS.textSecondary, marginBottom: SPACING.xs },
  priorityRow: { flexDirection: 'row', gap: SPACING.xs, marginBottom: SPACING.md },
  priorityChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingVertical: 8, backgroundColor: COLORS.surface },
  priorityChipText: { fontSize: 12, fontWeight: '700', color: COLORS.textMuted, textTransform: 'capitalize' },
  filterCard: { marginBottom: SPACING.md },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 7, backgroundColor: COLORS.surface },
  chipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  chipTextActive: { color: COLORS.accent },
  noticeCard: { borderRadius: RADIUS.lg, marginBottom: SPACING.sm },
  noticeExpired: { opacity: 0.75 },
  noticeTop: { marginBottom: SPACING.xs },
  tagsRow: { flexDirection: 'row', gap: SPACING.xs, flexWrap: 'wrap' },
  badge: { borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 5, borderWidth: 1 },
  activeBadge: { backgroundColor: 'rgba(16,185,129,0.14)', borderColor: 'rgba(16,185,129,0.24)' },
  expiredBadge: { backgroundColor: 'rgba(239,68,68,0.14)', borderColor: 'rgba(239,68,68,0.24)' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  noticeTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginBottom: SPACING.xs },
  noticeContent: { color: COLORS.textMuted, lineHeight: 21, marginBottom: SPACING.sm },
  noticeMeta: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap', marginBottom: SPACING.sm },
  metaText: { fontSize: 11, color: COLORS.textHint, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 5 },
  noticeActions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, paddingHorizontal: SPACING.sm, paddingVertical: 7, backgroundColor: COLORS.surface },
  actionBtnDanger: { borderColor: 'rgba(239,68,68,0.24)', backgroundColor: 'rgba(239,68,68,0.08)' },
  actionBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  fab: { position: 'absolute', right: SPACING.md, bottom: 72, width: 56, height: 56, borderRadius: 999, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', ...SHADOW.lg },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.45)' },
  modalSheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  modalTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  modalClose: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
});

export default NoticesScreen;
