import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
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
import AppCard from '../components/AppCard';
import AppButton from '../components/AppButton';
import EmptyState from '../components/EmptyState';
import ScreenContainer from '../components/ScreenContainer';
import StatusBadge from '../components/StatusBadge';
import { COLORS, RADIUS, SHADOW, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useResponsive } from '../hooks/useResponsive';
import { getErrorMessage } from '../utils/error';
import { showError, showSuccess } from '../utils/toast';
import {
  addWing,
  getSociety,
  getWingMembers,
  getWingsBySociety,
  removeWingMember,
} from '../services/societyService';

const TABS = ['overview', 'wings', 'members'];

const getId = (item) => item?.id || item?._id || '';

const safeDate = (value) => {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString();
};

const SocietyDetailsScreen = ({ route, navigation }) => {
  const { societyId } = route.params;
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [society, setSociety] = useState(null);
  const [wings, setWings] = useState([]);
  const [wingMembers, setWingMembers] = useState({});
  const [expandedWings, setExpandedWings] = useState({});
  const [removingMember, setRemovingMember] = useState('');
  const [showAddWing, setShowAddWing] = useState(false);
  const [newWingName, setNewWingName] = useState('');
  const [addingWing, setAddingWing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  const loadData = useCallback(
    async (isRefresh = false) => {
      try {
        if (isRefresh) setRefreshing(true);
        if (!isRefresh) setLoading(true);

        const [societyData, wingsList] = await Promise.all([
          getSociety(societyId),
          getWingsBySociety(societyId),
        ]);

        setSociety(societyData);
        setWings(wingsList || []);

        const membersMap = {};
        for (const wing of wingsList || []) {
          const wingId = getId(wing);
          try {
            membersMap[wingId] = await getWingMembers(wingId);
          } catch (error) {
            membersMap[wingId] = [];
          }
        }
        setWingMembers(membersMap);
      } catch (error) {
        showError('Failed to load society details', getErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [societyId]
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const stats = useMemo(() => {
    const allMembers = Object.values(wingMembers).flat();
    const totalMembers = allMembers.length;
    const admins = allMembers.filter((m) => m.role === 'admin').length;
    const secretaries = allMembers.filter((m) => m.role === 'chairman').length;
    const residents = allMembers.filter((m) => m.role === 'resident').length;
    const totalWings = wings.length;
    const avgMembersPerWing = totalWings ? (totalMembers / totalWings).toFixed(1) : '0.0';

    return { totalMembers, admins, secretaries, residents, totalWings, avgMembersPerWing };
  }, [wingMembers, wings]);

  const allMembers = useMemo(() => {
    const rows = [];
    wings.forEach((wing) => {
      const wingId = getId(wing);
      (wingMembers[wingId] || []).forEach((member) => {
        rows.push({ ...member, wingName: wing.name || 'Wing', wingId });
      });
    });
    return rows;
  }, [wings, wingMembers]);

  const handleToggleWing = (wingId) => {
    setExpandedWings((prev) => ({ ...prev, [wingId]: !prev[wingId] }));
  };

  const handleRemoveMember = (memberId, memberName, wingId) => {
    Alert.alert('Remove Member', `Are you sure you want to remove ${memberName} from this wing?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          try {
            setRemovingMember(memberId);
            await removeWingMember(wingId, memberId);
            showSuccess('Member removed successfully');
            loadData();
          } catch (error) {
            showError('Failed to remove member', getErrorMessage(error));
          } finally {
            setRemovingMember('');
          }
        },
      },
    ]);
  };

  const handleAddWing = async () => {
    if (!newWingName.trim()) {
      showError('Wing name is required');
      return;
    }

    try {
      setAddingWing(true);
      await addWing(societyId, { name: newWingName.trim() });
      showSuccess('Wing added successfully');
      setNewWingName('');
      setShowAddWing(false);
      loadData();
    } catch (error) {
      showError('Failed to add wing', getErrorMessage(error));
    } finally {
      setAddingWing(false);
    }
  };

  if (loading) {
    return (
      <ScreenContainer scroll={false}>
        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.pageWrap}>
            <View style={[styles.skeletonHeader, styles.skeletonPulse]} />
            <View style={styles.skeletonStatsRow}>
              {[1, 2, 3, 4].map((i) => (
                <View key={i} style={[styles.skeletonStat, styles.skeletonPulse]} />
              ))}
            </View>
            <View style={[styles.skeletonBlock, styles.skeletonPulse]} />
            <View style={[styles.skeletonBlock, styles.skeletonPulse]} />
          </View>
        </ScrollView>
      </ScreenContainer>
    );
  }

  if (!society) return <EmptyState icon="alert-circle-outline" title="Society Not Found" />;

  return (
    <ScreenContainer scroll={false}>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} tintColor={COLORS.accent} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.pageWrap}>
          <AppCard style={styles.heroCard}>
            <View style={styles.heroTopRow}>
              <Pressable onPress={() => navigation.goBack()} style={styles.backButton}>
                <Ionicons name="chevron-back" size={20} color={COLORS.accent} />
              </Pressable>

              <View style={styles.heroActions}>
                <Pressable style={styles.heroActionBtn} onPress={() => setShowAddWing(true)}>
                  <Ionicons name="add" size={16} color={COLORS.accent} />
                  <Text style={styles.heroActionText}>Add Wing</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.heroMainRow}>
              <View style={styles.societyIcon}>
                <Ionicons name="business" size={isMobile ? 24 : 28} color={COLORS.white} />
              </View>
              <View style={styles.heroContent}>
                <Text style={styles.societyName}>{society.name || 'Unnamed Society'}</Text>
                <Text style={styles.createdDate}>Created on {safeDate(society.created_at)}</Text>
              </View>
              <View style={styles.heroBadge}>
                <Text style={styles.heroBadgeText}>{stats.totalWings} Wings</Text>
              </View>
            </View>
          </AppCard>

          <View style={[styles.tabContainer, isMobile && styles.tabContainerMobile]}>
            <ScrollView
              horizontal={isMobile}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={[styles.tabScrollWrap, !isMobile && styles.tabScrollWrapDesktop]}
            >
              {TABS.map((tab) => {
                const active = selectedTab === tab;
                return (
                  <Pressable
                    key={tab}
                    style={[styles.tab, active && styles.activeTab]}
                    onPress={() => setSelectedTab(tab)}
                  >
                    <Text style={[styles.tabText, active && styles.activeTabText]}>
                      {tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {selectedTab === 'overview' ? (
            <View style={styles.contentWrap}>
              <View style={[styles.statsGrid, isMobile && styles.statsGridMobile]}>
                <StatCard label="Total Members" value={stats.totalMembers} icon="people-outline" color={COLORS.accent} compact={isMobile} />
                <StatCard label="Admins" value={stats.admins} icon="shield-outline" color={COLORS.teal} compact={isMobile} />
                <StatCard label="Secretaries" value={stats.secretaries} icon="person-outline" color={COLORS.warning} compact={isMobile} />
                <StatCard label="Residents" value={stats.residents} icon="home-outline" color={COLORS.coral} compact={isMobile} />
              </View>

              <AppCard style={styles.analyticsCard}>
                <Text style={styles.sectionTitle}>Wing Analytics</Text>
                <View style={[styles.analyticsRow, isMobile && styles.analyticsRowMobile]}>
                  <MetricPill label="Total Wings" value={stats.totalWings} />
                  <MetricPill label="Avg Members / Wing" value={stats.avgMembersPerWing} />
                  <MetricPill
                    label="Occupancy"
                    value={stats.totalMembers > 0 ? 'Active' : 'Low'}
                    tone={stats.totalMembers > 0 ? 'success' : 'warning'}
                  />
                </View>
              </AppCard>
            </View>
          ) : null}

          {selectedTab === 'wings' ? (
            <View style={styles.contentWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>Wings Management</Text>
                <Pressable style={styles.addWingButton} onPress={() => setShowAddWing(true)}>
                  <Ionicons name="add" size={16} color={COLORS.white} />
                  <Text style={styles.addWingButtonText}>Add Wing</Text>
                </Pressable>
              </View>

              {wings.length === 0 ? (
                <EmptyState
                  icon="layers-outline"
                  title="No Wings Yet"
                  subtitle="Create your first wing to begin organizing residents."
                />
              ) : (
                wings.map((wing) => {
                  const wingId = getId(wing);
                  return (
                    <WingCard
                      key={wingId}
                      wing={wing}
                      wingId={wingId}
                      members={wingMembers[wingId] || []}
                      isExpanded={expandedWings[wingId]}
                      onToggle={() => handleToggleWing(wingId)}
                      onRemoveMember={handleRemoveMember}
                      removingMember={removingMember}
                    />
                  );
                })
              )}
            </View>
          ) : null}

          {selectedTab === 'members' ? (
            <View style={styles.contentWrap}>
              <Text style={styles.sectionTitle}>All Members</Text>
              {allMembers.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="No Members Yet"
                  subtitle="Members will appear here once residents are added to wings."
                />
              ) : (
                <View style={[styles.membersGrid, (isTablet || isDesktop) && styles.membersGridWide]}>
                  {allMembers.map((member) => (
                    <View key={getId(member)} style={styles.memberListItem}>
                      <View style={styles.memberListInfo}>
                        <Text style={styles.memberListName}>{member.name || 'Unknown User'}</Text>
                        <Text style={styles.memberListWing}>{member.wingName || 'Wing'} • {member.email || 'No email'}</Text>
                      </View>
                      <View style={styles.memberListRole}>
                        <StatusBadge status={member.role === 'chairman' ? 'approved' : 'pending'} label={member.role || 'resident'} />
                      </View>
                      <Pressable
                        onPress={() => handleRemoveMember(getId(member), member.name || 'Member', member.wingId)}
                        disabled={removingMember === getId(member)}
                      >
                        {removingMember === getId(member) ? (
                          <ActivityIndicator size="small" color={COLORS.coral} />
                        ) : (
                          <Ionicons name="trash-outline" size={18} color={COLORS.coral} />
                        )}
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}
            </View>
          ) : null}
        </View>
      </ScrollView>

      <Modal transparent visible={showAddWing} animationType="slide" onRequestClose={() => setShowAddWing(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add New Wing</Text>
              <Pressable onPress={() => setShowAddWing(false)}>
                <Ionicons name="close" size={22} color={COLORS.textPrimary} />
              </Pressable>
            </View>

            <TextInput
              style={styles.input}
              placeholder="Enter wing name"
              placeholderTextColor={COLORS.textMuted}
              value={newWingName}
              onChangeText={setNewWingName}
            />

            <AppButton title={addingWing ? 'Adding Wing...' : 'Add Wing'} onPress={handleAddWing} loading={addingWing} />
          </View>
        </View>
      </Modal>
    </ScreenContainer>
  );
};

const StatCard = ({ label, value, icon, color, compact }) => (
  <View style={[styles.statCard, compact && styles.statCardCompact]}>
    <View style={[styles.statIcon, compact && styles.statIconCompact, { backgroundColor: `${color}16` }]}> 
      <Ionicons name={icon} size={compact ? 15 : 18} color={color} />
    </View>
    <Text style={[styles.statLabel, compact && styles.statLabelCompact]} numberOfLines={1}>{label}</Text>
    <Text style={[styles.statValue, compact && styles.statValueCompact]} numberOfLines={1}>{value}</Text>
  </View>
);

const MetricPill = ({ label, value, tone = 'neutral' }) => {
  const toneColor = tone === 'success' ? COLORS.success : tone === 'warning' ? COLORS.warning : COLORS.accent;

  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, { color: toneColor }]}>{value}</Text>
    </View>
  );
};

const WingCard = ({ wing, wingId, members, isExpanded, onToggle, onRemoveMember, removingMember }) => {
  const admins = members.filter((m) => m.role === 'admin');
  const chairman = members.find((m) => m.role === 'chairman');
  const residents = members.filter((m) => m.role === 'resident');

  return (
    <AppCard style={styles.wingCard}>
      <Pressable style={styles.wingHeader} onPress={onToggle}>
        <View style={styles.wingInfo}>
          <Text style={styles.wingName}>{wing.name || 'Unnamed Wing'}</Text>
          <Text style={styles.wingSubtitle}>{members.length} members</Text>
        </View>
        <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={20} color={COLORS.accent} />
      </Pressable>

      {isExpanded ? (
        <View style={styles.wingDetails}>
          {chairman ? (
            <View style={styles.roleSection}>
              <Text style={styles.roleTitle}>Secretary</Text>
              <MemberItem
                member={chairman}
                isRemoving={removingMember === getId(chairman)}
                onRemove={() => onRemoveMember(getId(chairman), chairman.name || 'Member', wingId)}
              />
            </View>
          ) : null}

          {admins.length > 0 ? (
            <View style={styles.roleSection}>
              <Text style={styles.roleTitle}>Admins ({admins.length})</Text>
              {admins.map((admin) => (
                <MemberItem
                  key={getId(admin)}
                  member={admin}
                  isRemoving={removingMember === getId(admin)}
                  onRemove={() => onRemoveMember(getId(admin), admin.name || 'Member', wingId)}
                />
              ))}
            </View>
          ) : null}

          {residents.length > 0 ? (
            <View style={styles.roleSection}>
              <Text style={styles.roleTitle}>Residents ({residents.length})</Text>
              {residents.slice(0, 4).map((resident) => (
                <MemberItem
                  key={getId(resident)}
                  member={resident}
                  isRemoving={removingMember === getId(resident)}
                  onRemove={() => onRemoveMember(getId(resident), resident.name || 'Member', wingId)}
                />
              ))}
              {residents.length > 4 ? <Text style={styles.moreMembers}>+{residents.length - 4} more residents</Text> : null}
            </View>
          ) : null}
        </View>
      ) : null}
    </AppCard>
  );
};

const MemberItem = ({ member, isRemoving, onRemove }) => (
  <View style={styles.memberItem}>
    <View style={styles.memberInfo}>
      <Text style={styles.memberName}>{member.name || 'Unknown Member'}</Text>
      <Text style={styles.memberEmail}>{member.email || 'No email'}</Text>
    </View>
    <Pressable style={[styles.removeButton, isRemoving && styles.removeButtonDisabled]} onPress={onRemove} disabled={isRemoving}>
      {isRemoving ? <ActivityIndicator size="small" color={COLORS.coral} /> : <Ionicons name="trash-outline" size={17} color={COLORS.coral} />}
    </Pressable>
  </View>
);

const styles = StyleSheet.create({
  pageWrap: {
    width: '100%',
    maxWidth: 1280,
    alignSelf: 'center',
  },
  heroCard: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  heroActions: {
    flexDirection: 'row',
  },
  heroActionBtn: {
    minHeight: 34,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  heroActionText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  heroMainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  societyIcon: {
    width: 54,
    height: 54,
    borderRadius: 16,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroContent: {
    flex: 1,
  },
  societyName: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
  },
  createdDate: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  heroBadge: {
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 7,
  },
  heroBadgeText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  tabContainer: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    marginBottom: SPACING.md,
    ...SHADOW.sm,
  },
  tabContainerMobile: {
    paddingHorizontal: SPACING.xs,
  },
  tabScrollWrap: {
    flexDirection: 'row',
    gap: SPACING.xs,
    padding: SPACING.xs,
  },
  tabScrollWrapDesktop: {
    justifyContent: 'space-between',
  },
  tab: {
    minHeight: 38,
    minWidth: 110,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.md,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : null),
  },
  activeTab: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  tabText: {
    color: COLORS.textMuted,
    fontWeight: '600',
    fontSize: 13,
    textTransform: 'capitalize',
  },
  activeTabText: {
    color: COLORS.accent,
  },
  contentWrap: {
    paddingBottom: SPACING.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  statsGridMobile: {
    gap: SPACING.xs,
  },
  statCard: {
    width: '24.2%',
    minHeight: 92,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    justifyContent: 'space-between',
    ...SHADOW.sm,
  },
  statCardCompact: {
    width: '48.5%',
    minHeight: 80,
    padding: SPACING.xs,
  },
  statIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  statIconCompact: {
    width: 24,
    height: 24,
    borderRadius: 8,
  },
  statLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  statLabelCompact: {
    fontSize: 10,
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginTop: 2,
  },
  statValueCompact: {
    fontSize: 16,
  },
  analyticsCard: {
    borderRadius: RADIUS.md,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  analyticsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  analyticsRowMobile: {
    flexDirection: 'column',
    gap: SPACING.xs,
  },
  metricPill: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.sm,
  },
  metricLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
  },
  metricValue: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '700',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  addWingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: COLORS.accent,
  },
  addWingButtonText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 12,
  },
  wingCard: {
    borderRadius: RADIUS.md,
    marginBottom: SPACING.sm,
  },
  wingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  wingInfo: {
    flex: 1,
  },
  wingName: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  wingSubtitle: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  wingDetails: {
    marginTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  roleSection: {
    marginBottom: SPACING.sm,
  },
  roleTitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
    marginBottom: SPACING.xs,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 13,
  },
  memberEmail: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  removeButton: {
    padding: SPACING.xs,
  },
  removeButtonDisabled: {
    opacity: 0.5,
  },
  moreMembers: {
    color: COLORS.accent,
    fontSize: 12,
    marginTop: SPACING.xs,
  },
  membersGrid: {
    gap: SPACING.sm,
  },
  membersGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  memberListItem: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  memberListInfo: {
    flex: 1,
  },
  memberListName: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  memberListWing: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  memberListRole: {
    marginRight: SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(2,6,23,0.42)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.bg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: SPACING.lg,
    minHeight: 240,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    minHeight: 50,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.md,
  },
  skeletonHeader: {
    height: 130,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  skeletonStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  skeletonStat: {
    width: '24.2%',
    minHeight: 90,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
  },
  skeletonBlock: {
    height: 120,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    marginBottom: SPACING.sm,
  },
  skeletonPulse: {
    opacity: 0.7,
  },
});

export default SocietyDetailsScreen;
