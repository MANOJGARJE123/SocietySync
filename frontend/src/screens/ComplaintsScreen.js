import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useMemo, useState } from 'react';
import {
  Alert, Image, Modal, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppInput from '../components/AppInput';
import EmptyState from '../components/EmptyState';
import LoadingOverlay from '../components/LoadingOverlay';
import PageHeader from '../components/PageHeader';
import ScreenContainer from '../components/ScreenContainer';
import { COMPLAINT_STATUS, ROLES } from '../constants/app';
import { COLORS, RADIUS, SHADOW, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import {
  createComplaint, deleteComplaint, editComplaint,
  getComplaints, getComplaintImageUrl, updateComplaintStatus,
} from '../services/complaintService';
import { formatDate } from '../utils/date';
import { getErrorMessage } from '../utils/error';
import { showError, showSuccess } from '../utils/toast';

const STATUS_COLORS = {
  [COMPLAINT_STATUS.PENDING]:     { bg: 'rgba(245,158,11,0.14)',  color: '#D97706',  label: 'Pending' },
  [COMPLAINT_STATUS.IN_PROGRESS]: { bg: 'rgba(37,99,235,0.14)',   color: COLORS.accent, label: 'In Progress' },
  [COMPLAINT_STATUS.RESOLVED]:    { bg: 'rgba(16,185,129,0.14)',  color: COLORS.success, label: 'Resolved' },
  [COMPLAINT_STATUS.REJECTED]:    { bg: 'rgba(239,68,68,0.14)',   color: '#EF4444',  label: 'Rejected' },
};

const StatusBadge = ({ status }) => {
  const tone = STATUS_COLORS[status] || STATUS_COLORS[COMPLAINT_STATUS.PENDING];
  return (
    <View style={[styles.badge, { backgroundColor: tone.bg, borderColor: `${tone.color}40` }]}>
      <Text style={[styles.badgeText, { color: tone.color }]}>{tone.label}</Text>
    </View>
  );
};

const ComplaintsScreen = () => {
  const { user } = useAuth();
  const { isMobile, isDesktop } = useResponsive();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [complaints, setComplaints] = useState([]);
  const [form, setForm] = useState({ title: '', description: '' });
  const [formErrors, setFormErrors] = useState({});
  const [photo, setPhoto] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedId, setExpandedId] = useState('');
  const [actioningId, setActioningId] = useState('');
  const [editingComplaint, setEditingComplaint] = useState(null);
  const [editForm, setEditForm] = useState({ title: '', description: '' });
  const [showEditModal, setShowEditModal] = useState(false);

  const isAdmin  = user?.role === ROLES.ADMIN;
  const isChairman = user?.role === ROLES.CHAIRMAN;
  const isResident = user?.role === ROLES.RESIDENT;
  const canCreate  = isResident || isChairman || isAdmin;
  const canManage  = isAdmin || isChairman;

  const loadComplaints = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) setRefreshing(true); else setLoading(true);
      setComplaints(await getComplaints(user?.role) || []);
    } catch (e) { showError('Load failed', getErrorMessage(e)); }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.role]);

  useFocusEffect(useCallback(() => { loadComplaints(); }, [loadComplaints]));

  const stats = useMemo(() => ({
    total:      complaints.length,
    pending:    complaints.filter(c => c.status === COMPLAINT_STATUS.PENDING).length,
    inProgress: complaints.filter(c => c.status === COMPLAINT_STATUS.IN_PROGRESS).length,
    resolved:   complaints.filter(c => c.status === COMPLAINT_STATUS.RESOLVED).length,
    rejected:   complaints.filter(c => c.status === COMPLAINT_STATUS.REJECTED).length,
  }), [complaints]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return complaints
      .filter(c => {
        if (statusFilter !== 'all' && c.status !== statusFilter) return false;
        if (!q) return true;
        return `${c.title} ${c.description}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const ta = new Date(a.createdAt || 0).getTime();
        const tb = new Date(b.createdAt || 0).getTime();
        return sortBy === 'newest' ? tb - ta : ta - tb;
      });
  }, [complaints, query, statusFilter, sortBy]);

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { showError('Permission denied', 'Allow photo access to attach images.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) setPhoto(result.assets[0]);
  };

  const validate = () => {
    const e = {};
    if (!form.title.trim()) e.title = 'Title is required';
    else if (form.title.trim().length < 3) e.title = 'Title must be at least 3 characters';
    if (!form.description.trim()) e.description = 'Description is required';
    else if (form.description.trim().length < 10) e.description = 'Description must be at least 10 characters';
    setFormErrors(e);
    return !Object.keys(e).length;
  };

  const submitComplaint = async () => {
    if (!validate()) return;
    try {
      setSubmitting(true);
      await createComplaint({ title: form.title.trim(), description: form.description.trim(), photo });
      setForm({ title: '', description: '' });
      setPhoto(null);
      if (isMobile) setShowCreateModal(false);
      showSuccess('Complaint filed', 'Your complaint has been logged.');
      loadComplaints(true);
    } catch (e) { showError('Submit failed', getErrorMessage(e)); }
    finally { setSubmitting(false); }
  };

  const handleStatusChange = async (complaintId, newStatus) => {
    try {
      setActioningId(complaintId);
      await updateComplaintStatus(complaintId, newStatus);
      showSuccess('Updated', `Complaint marked as ${STATUS_COLORS[newStatus]?.label || newStatus}`);
      loadComplaints(true);
    } catch (e) { showError('Update failed', getErrorMessage(e)); }
    finally { setActioningId(''); }
  };

  const openEdit = (c) => {
    setEditingComplaint(c);
    setEditForm({ title: c.title || '', description: c.description || '' });
    setShowEditModal(true);
  };

  const submitEdit = async () => {
    if (!editingComplaint) return;
    try {
      setSubmitting(true);
      await editComplaint(editingComplaint._id, { title: editForm.title.trim(), description: editForm.description.trim() });
      showSuccess('Updated', 'Complaint updated successfully');
      setShowEditModal(false);
      loadComplaints(true);
    } catch (e) { showError('Update failed', getErrorMessage(e)); }
    finally { setSubmitting(false); }
  };

  const handleDelete = (c) => {
    Alert.alert('Delete Complaint', `Delete "${c.title}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        try {
          setActioningId(c._id);
          await deleteComplaint(c._id);
          showSuccess('Deleted', 'Complaint removed');
          loadComplaints(true);
        } catch (e) { showError('Delete failed', getErrorMessage(e)); }
        finally { setActioningId(''); }
      }},
    ]);
  };

  if (loading) return <LoadingOverlay />;

  const createForm = (
    <AppCard style={styles.createCard}>
      <Text style={styles.cardTitle}>File a Complaint</Text>
      <Text style={styles.cardSub}>Describe the issue clearly so it can be resolved quickly.</Text>
      <AppInput label="Title" value={form.title} onChangeText={v => { setForm(p => ({ ...p, title: v })); setFormErrors(p => ({ ...p, title: '' })); }} placeholder="Water leakage in corridor" leftIcon="reader-outline" error={formErrors.title} />
      <AppInput label="Description" value={form.description} onChangeText={v => { setForm(p => ({ ...p, description: v })); setFormErrors(p => ({ ...p, description: '' })); }} placeholder="Provide details, location, duration..." multiline numberOfLines={5} error={formErrors.description} />
      <Pressable style={styles.photoBtn} onPress={pickPhoto}>
        <Ionicons name={photo ? 'checkmark-circle' : 'camera-outline'} size={16} color={photo ? COLORS.success : COLORS.textSecondary} />
        <Text style={[styles.photoBtnText, photo && { color: COLORS.success }]}>{photo ? 'Photo attached ✓' : 'Attach photo (optional)'}</Text>
      </Pressable>
      <AppButton title="Submit Complaint" onPress={submitComplaint} loading={submitting} />
    </AppCard>
  );

  return (
    <ScreenContainer scroll={false}>
      <ScrollView style={{ flex: 1 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadComplaints(true)} tintColor={COLORS.accent} />} showsVerticalScrollIndicator={false}>
        <View style={styles.page}>
          <PageHeader title="Complaint Management" subtitle="Track and manage all resident complaints." icon="alert-circle-outline" />

          {/* Stats */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: SPACING.md }}>
            <View style={styles.statsRow}>
              {[
                { label: 'Total', value: stats.total, color: COLORS.textSecondary },
                { label: 'Pending', value: stats.pending, color: '#D97706' },
                { label: 'In Progress', value: stats.inProgress, color: COLORS.accent },
                { label: 'Resolved', value: stats.resolved, color: COLORS.success },
                { label: 'Rejected', value: stats.rejected, color: '#EF4444' },
              ].map(s => (
                <AppCard key={s.label} style={styles.statPill}>
                  <Text style={[styles.statVal, { color: s.color }]}>{s.value}</Text>
                  <Text style={styles.statLbl}>{s.label}</Text>
                </AppCard>
              ))}
            </View>
          </ScrollView>

          <View style={[styles.mainGrid, isDesktop && styles.mainGridDesktop]}>
            {canCreate && !isMobile && <View style={styles.leftCol}>{createForm}</View>}
            <View style={styles.rightCol}>
              {/* Filters */}
              <AppCard style={styles.filterCard}>
                <AppInput value={query} onChangeText={setQuery} placeholder="Search complaints..." leftIcon="search-outline" noMargin />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: SPACING.sm }}>
                  <View style={styles.filterRow}>
                    {['all','pending','in_progress','resolved','rejected'].map(s => {
                      const active = statusFilter === s;
                      return (
                        <Pressable key={s} style={[styles.chip, active && styles.chipActive]} onPress={() => setStatusFilter(s)}>
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{s.replace('_', ' ')}</Text>
                        </Pressable>
                      );
                    })}
                    {['newest','oldest'].map(o => {
                      const active = sortBy === o;
                      return (
                        <Pressable key={o} style={[styles.chip, active && styles.chipActive]} onPress={() => setSortBy(o)}>
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>{o}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </ScrollView>
              </AppCard>

              {filtered.length === 0
                ? <EmptyState icon="alert-circle-outline" title="No complaints found" subtitle="File a complaint using the form." />
                : filtered.map((c, idx) => {
                  const imageUrl = getComplaintImageUrl(c.imageUrl);
                  const isOwner = String(c.createdBy?.id || c.createdBy?._id) === String(user?._id);
                  const expanded = expandedId === c._id;
                  return (
                    <Animated.View key={c._id} entering={FadeInDown.delay(idx * 20)}>
                      <AppCard style={styles.complaintCard}>
                        <View style={styles.cardTop}>
                          <View style={{ flex: 1 }}>
                            <StatusBadge status={c.status} />
                            <Text style={styles.complaintTitle}>{c.title}</Text>
                            <Text style={styles.complaintBy}>By {c.createdBy?.name || 'Unknown'} · {formatDate(c.createdAt)}</Text>
                          </View>
                        </View>

                        <Text style={styles.complaintDesc} numberOfLines={expanded ? 20 : 3}>{c.description}</Text>

                        {imageUrl ? (
                          <Image source={{ uri: imageUrl }} style={styles.photo} resizeMode="cover" />
                        ) : null}

                        {c.status === COMPLAINT_STATUS.RESOLVED && c.resolvedAt && (
                          <Text style={styles.resolvedAt}>✓ Resolved {formatDate(c.resolvedAt)}</Text>
                        )}

                        <View style={styles.actions}>
                          <Pressable style={styles.actionBtn} onPress={() => setExpandedId(prev => prev === c._id ? '' : c._id)}>
                            <Ionicons name={expanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={12} color={COLORS.textSecondary} />
                            <Text style={styles.actionBtnText}>{expanded ? 'Less' : 'More'}</Text>
                          </Pressable>

                          {canManage && c.status !== COMPLAINT_STATUS.RESOLVED && (
                            <>
                              {c.status === COMPLAINT_STATUS.PENDING && (
                                <Pressable style={[styles.actionBtn, styles.actionBtnBlue]} disabled={actioningId === c._id} onPress={() => handleStatusChange(c._id, COMPLAINT_STATUS.IN_PROGRESS)}>
                                  <Ionicons name="arrow-forward-outline" size={12} color={COLORS.accent} />
                                  <Text style={[styles.actionBtnText, { color: COLORS.accent }]}>Start</Text>
                                </Pressable>
                              )}
                              <Pressable style={[styles.actionBtn, styles.actionBtnGreen]} disabled={actioningId === c._id} onPress={() => handleStatusChange(c._id, COMPLAINT_STATUS.RESOLVED)}>
                                <Ionicons name="checkmark-outline" size={12} color={COLORS.success} />
                                <Text style={[styles.actionBtnText, { color: COLORS.success }]}>Resolve</Text>
                              </Pressable>
                              <Pressable style={[styles.actionBtn, styles.actionBtnRed]} disabled={actioningId === c._id} onPress={() => handleStatusChange(c._id, COMPLAINT_STATUS.REJECTED)}>
                                <Ionicons name="close-outline" size={12} color="#EF4444" />
                                <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Reject</Text>
                              </Pressable>
                            </>
                          )}

                          {isOwner && c.status === COMPLAINT_STATUS.PENDING && (
                            <Pressable style={styles.actionBtn} onPress={() => openEdit(c)}>
                              <Ionicons name="create-outline" size={12} color={COLORS.accent} />
                              <Text style={[styles.actionBtnText, { color: COLORS.accent }]}>Edit</Text>
                            </Pressable>
                          )}

                          {(isOwner || isAdmin) && c.status !== COMPLAINT_STATUS.RESOLVED && (
                            <Pressable style={[styles.actionBtn, styles.actionBtnRed]} disabled={actioningId === c._id} onPress={() => handleDelete(c)}>
                              <Ionicons name="trash-outline" size={12} color="#EF4444" />
                              <Text style={[styles.actionBtnText, { color: '#EF4444' }]}>Delete</Text>
                            </Pressable>
                          )}
                        </View>
                      </AppCard>
                    </Animated.View>
                  );
                })}
            </View>
          </View>
        </View>
      </ScrollView>

      {canCreate && isMobile && (
        <Pressable style={styles.fab} onPress={() => setShowCreateModal(true)}>
          <Ionicons name="add" size={26} color={COLORS.white} />
        </Pressable>
      )}

      {/* Create modal */}
      <Modal visible={showCreateModal} transparent animationType="slide" onRequestClose={() => setShowCreateModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHdr}>
              <Text style={styles.modalTitle}>File Complaint</Text>
              <Pressable onPress={() => setShowCreateModal(false)} style={styles.modalClose}><Ionicons name="close" size={20} color={COLORS.textPrimary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>{createForm}</ScrollView>
          </View>
        </View>
      </Modal>

      {/* Edit modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHdr}>
              <Text style={styles.modalTitle}>Edit Complaint</Text>
              <Pressable onPress={() => setShowEditModal(false)} style={styles.modalClose}><Ionicons name="close" size={20} color={COLORS.textPrimary} /></Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <AppCard>
                <AppInput label="Title" value={editForm.title} onChangeText={v => setEditForm(p => ({ ...p, title: v }))} leftIcon="reader-outline" />
                <AppInput label="Description" value={editForm.description} onChangeText={v => setEditForm(p => ({ ...p, description: v }))} multiline numberOfLines={5} />
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
  statsRow: { flexDirection: 'row', gap: SPACING.sm, paddingRight: SPACING.md },
  statPill: { minWidth: 80, alignItems: 'center', paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md },
  statVal: { fontSize: 20, fontWeight: '800' },
  statLbl: { fontSize: 11, color: COLORS.textMuted, marginTop: 2 },
  mainGrid: { gap: SPACING.md },
  mainGridDesktop: { flexDirection: 'row', alignItems: 'flex-start' },
  leftCol: { width: '40%', minWidth: 320 },
  rightCol: { flex: 1 },
  createCard: {},
  cardTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  cardSub: { fontSize: 13, color: COLORS.textMuted, marginBottom: SPACING.md, marginTop: 3 },
  photoBtn: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, padding: SPACING.sm, borderRadius: RADIUS.md, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.border, marginBottom: SPACING.md },
  photoBtnText: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
  filterCard: { marginBottom: SPACING.md },
  filterRow: { flexDirection: 'row', gap: SPACING.xs },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.pill, paddingHorizontal: SPACING.sm, paddingVertical: 7, backgroundColor: COLORS.surface },
  chipActive: { borderColor: COLORS.accent, backgroundColor: COLORS.accentSoft },
  chipText: { color: COLORS.textMuted, fontSize: 12, fontWeight: '700', textTransform: 'capitalize' },
  chipTextActive: { color: COLORS.accent },
  complaintCard: { marginBottom: SPACING.sm },
  cardTop: { flexDirection: 'row', marginBottom: SPACING.xs },
  badge: { alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, marginBottom: SPACING.xs },
  badgeText: { fontSize: 11, fontWeight: '700' },
  complaintTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary },
  complaintBy: { fontSize: 12, color: COLORS.textMuted, marginTop: 3 },
  complaintDesc: { color: COLORS.textSecondary, lineHeight: 21, marginTop: SPACING.xs },
  photo: { width: '100%', height: 180, borderRadius: RADIUS.md, marginTop: SPACING.sm },
  resolvedAt: { fontSize: 12, color: COLORS.success, marginTop: SPACING.xs, fontWeight: '600' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: SPACING.xs, marginTop: SPACING.sm },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: COLORS.border, borderRadius: 9, paddingHorizontal: SPACING.sm, paddingVertical: 7 },
  actionBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },
  actionBtnBlue: { borderColor: `${COLORS.accent}40`, backgroundColor: `${COLORS.accent}10` },
  actionBtnGreen: { borderColor: `${COLORS.success}40`, backgroundColor: `${COLORS.success}10` },
  actionBtnRed: { borderColor: 'rgba(239,68,68,0.24)', backgroundColor: 'rgba(239,68,68,0.08)' },
  fab: { position: 'absolute', right: SPACING.md, bottom: 72, width: 56, height: 56, borderRadius: 999, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center', ...SHADOW.lg },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(2,6,23,0.45)' },
  modalSheet: { maxHeight: '92%', borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: COLORS.bg, paddingHorizontal: SPACING.sm, paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  modalHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.xs },
  modalTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  modalClose: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface },
});

export default ComplaintsScreen;
