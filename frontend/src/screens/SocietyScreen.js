import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
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
import { getErrorMessage } from '../utils/error';
import { showError, showSuccess } from '../utils/toast';
import { getUsers } from '../services/userService';
import {
  addWing,
  assignChairmanByContact,
  createSociety,
  deleteUser,
  getSociety,
  getWingsBySociety,
  registerResident,
} from '../services/societyService';

const SocietyScreen = () => {
  const { user, refreshProfile } = useAuth();
  const { isMobile, isTablet, isDesktop } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [society, setSociety] = useState(null);
  const [wings, setWings] = useState([]);
  const [creating, setCreating] = useState(false);
  const [addingWing, setAddingWing] = useState(false);
  const [assigning, setAssigning] = useState({});
  const [assigningWing, setAssigningWing] = useState('');
  const [registering, setRegistering] = useState(false);
  const [societyUsers, setSocietyUsers] = useState([]);

  const [societyForm, setSocietyForm] = useState({ name: '', wings: ['A'] });
  const [newWingName, setNewWingName] = useState('');
  const [residentForm, setResidentForm] = useState({
    name: '',
    email: '',
    password: '',
    wingId: '',
    phone: '',
    flatNumber: '',
  });
  const [residentSearch, setResidentSearch] = useState('');
  const [showResidentForm, setShowResidentForm] = useState(false);
  const [deletingResidentId, setDeletingResidentId] = useState('');

  const societyId = user?.societyId;
  const isAdmin = user?.role === ROLES.ADMIN;

  const loadSocietyData = useCallback(async () => {
    if (!societyId) {
      setSociety(null);
      setWings([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const [societyData, wingList, usersData] = await Promise.all([
        getSociety(societyId),
        getWingsBySociety(societyId),
        getUsers(),
      ]);
      setSociety(societyData);
      setWings(wingList || []);
      setSocietyUsers(usersData || []);
    } catch (error) {
      showError('Failed to load society', getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [societyId]);

  useFocusEffect(
    useCallback(() => {
      loadSocietyData();
    }, [loadSocietyData])
  );

  const wingList = useMemo(() => wings, [wings]);

  const residents = useMemo(
    () => societyUsers.filter((u) => u.role === ROLES.RESIDENT && u.societyId === societyId),
    [societyId, societyUsers]
  );

  const chairmenCount = useMemo(
    () => wings.filter((w) => w.chairmanName || w.chairmanEmail || w.chairmanPhone).length,
    [wings]
  );

  const occupiedFlats = useMemo(
    () => residents.filter((r) => String(r.flatNumber || '').trim().length > 0).length,
    [residents]
  );

  const residentsById = useMemo(() => {
    const map = {};
    residents.forEach((r) => {
      map[r._id] = r;
    });
    return map;
  }, [residents]);

  const residentRows = useMemo(() => {
    const q = residentSearch.trim().toLowerCase();
    const wingNameById = wings.reduce((acc, w) => {
      acc[w._id] = w.name;
      return acc;
    }, {});

    const list = residents.map((r) => ({
      ...r,
      wingName: wingNameById[r.wingId] || 'Unassigned',
      status: r.wingStatus || 'pending',
    }));

    if (!q) return list;
    return list.filter((r) => {
      const blob = `${r.name || ''} ${r.email || ''} ${r.phone || ''} ${r.flatNumber || ''} ${r.wingName || ''}`.toLowerCase();
      return blob.includes(q);
    });
  }, [residentSearch, residents, wings]);

  const suggestionEmails = useMemo(() => {
    const uniqueEmails = new Set();
    societyUsers.forEach((member) => {
      const email = String(member?.email || '').trim().toLowerCase();
      if (email) uniqueEmails.add(email);
    });
    return Array.from(uniqueEmails);
  }, [societyUsers]);

  const updateWingName = (value, index) => {
    setSocietyForm((prev) => {
      const next = [...prev.wings];
      next[index] = value;
      return { ...prev, wings: next };
    });
  };

  const addWingField = () => {
    setSocietyForm((prev) => ({ ...prev, wings: [...prev.wings, ''] }));
  };

  const removeWingField = (index) => {
    setSocietyForm((prev) => ({
      ...prev,
      wings: prev.wings.filter((_, idx) => idx !== index),
    }));
  };

  const handleCreateSociety = async () => {
    if (!societyForm.name.trim()) {
      showError('Missing society name', 'Please enter a society name');
      return;
    }

    const wingNames = societyForm.wings.map((item) => item.trim()).filter(Boolean);
    if (wingNames.length === 0) {
      showError('Missing wings', 'Please add at least one wing');
      return;
    }

    try {
      setCreating(true);
      const created = await createSociety({ name: societyForm.name.trim(), wings: wingNames });
      setSociety(created);
      setWings(created.wings || []);
      await refreshProfile();
      showSuccess('Society created', 'Wings are ready to assign chairmen.');
    } catch (error) {
      showError('Society creation failed', getErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const handleAddWing = async () => {
    if (!societyId) return;
    if (!newWingName.trim()) {
      showError('Missing wing name', 'Enter a wing name');
      return;
    }

    try {
      setAddingWing(true);
      const wing = await addWing(societyId, { name: newWingName.trim() });
      setWings((prev) => [...prev, wing]);
      setNewWingName('');
      showSuccess('Wing added', 'Wing is available for chairman assignment.');
    } catch (error) {
      showError('Failed to add wing', getErrorMessage(error));
    } finally {
      setAddingWing(false);
    }
  };

  const handleAssignChairman = async (wingId) => {
    const contact = assigning[wingId]?.trim();
    if (!contact) {
      showError('Missing chairman', 'Provide a chairman phone or email');
      return;
    }

    try {
      setAssigningWing(wingId);
      const updated = await assignChairmanByContact(wingId, contact);
      setWings((prev) => prev.map((item) => (item._id === updated._id ? updated : item)));
      setAssigning((prev) => ({ ...prev, [wingId]: '' }));
      showSuccess('Chairman assigned', 'Wing updated successfully.');
    } catch (error) {
      showError('Assignment failed', getErrorMessage(error));
    } finally {
      setAssigningWing('');
    }
  };

  const getEmailSuggestions = (wingId) => {
    const raw = String(assigning[wingId] || '').trim().toLowerCase();
    if (!raw || raw.length < 2 || (!raw.includes('@') && raw.length < 4)) return [];
    return suggestionEmails.filter((email) => email.includes(raw)).filter((email) => email !== raw).slice(0, 6);
  };

  const handleRegisterResident = async () => {
    if (!residentForm.name.trim() || !residentForm.email.trim() || !residentForm.password || !residentForm.wingId) {
      showError('Missing fields', 'Name, email, password and wing are required');
      return;
    }

    try {
      setRegistering(true);
      await registerResident({
        name: residentForm.name.trim(),
        email: residentForm.email.trim(),
        password: residentForm.password,
        wingId: residentForm.wingId.trim(),
        phone: residentForm.phone.trim(),
        flatNumber: residentForm.flatNumber.trim(),
      });
      setResidentForm({ name: '', email: '', password: '', wingId: '', phone: '', flatNumber: '' });
      showSuccess('Resident added', 'Resident linked to selected wing.');
      loadSocietyData();
      setShowResidentForm(false);
    } catch (error) {
      showError('Resident registration failed', getErrorMessage(error));
    } finally {
      setRegistering(false);
    }
  };

  const handleDeleteResident = (residentId) => {
    const resident = residentsById[residentId];
    Alert.alert(
      'Delete Resident',
      `Are you sure you want to delete ${resident?.name || 'this resident'}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setDeletingResidentId(residentId);
              await deleteUser(residentId);
              showSuccess('Resident removed', 'Resident deleted successfully.');
              loadSocietyData();
            } catch (error) {
              showError('Delete failed', getErrorMessage(error));
            } finally {
              setDeletingResidentId('');
            }
          },
        },
      ]
    );
  };

  const viewResident = (resident) => {
    Alert.alert(
      resident.name || 'Resident',
      `Email: ${resident.email || '-'}\nPhone: ${resident.phone || '-'}\nFlat: ${resident.flatNumber || '-'}\nWing: ${resident.wingName || '-'}\nStatus: ${resident.status || '-'}`
    );
  };

  if (!isAdmin) {
    return (
      <ScreenContainer>
        <PageHeader title="Society Setup" subtitle="Only admins can create societies and manage wings." icon="business-outline" />
        <EmptyState title="Admin access required" subtitle="Switch to an admin account to manage societies." />
      </ScreenContainer>
    );
  }

  if (loading) return <LoadingOverlay />;

  return (
    <ScreenContainer scroll={false}>
      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={styles.pageWrap}>
          <PageHeader
            title="Society Management"
            subtitle="Manage wings, leadership, and residents from one operational dashboard."
            icon="business-outline"
          />

          {!society ? (
            <AppCard style={[styles.sectionCard, isMobile && styles.sectionCardMobile]}>
              <Text style={styles.sectionTitle}>Create Society</Text>
              <AppInput
                label="Society Name"
                leftIcon="home-outline"
                value={societyForm.name}
                onChangeText={(value) => setSocietyForm((prev) => ({ ...prev, name: value }))}
                placeholder="Green Heights"
              />

              <Text style={styles.fieldTitle}>Initial Wings</Text>
              {societyForm.wings.map((wing, index) => (
                <View key={`wing-${index}`} style={styles.wingRow}>
                  <View style={styles.wingInput}>
                    <AppInput
                      label={`Wing ${index + 1}`}
                      leftIcon="layers-outline"
                      value={wing}
                      onChangeText={(value) => updateWingName(value, index)}
                      placeholder="A"
                    />
                  </View>
                  {societyForm.wings.length > 1 ? (
                    <Pressable onPress={() => removeWingField(index)} style={styles.removeChip}>
                      <Text style={styles.removeText}>Remove</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))}

              <View style={styles.buttonRow}>
                <AppButton title="Add Wing Field" variant="outline" onPress={addWingField} style={styles.halfBtn} />
                <AppButton title="Create Society" onPress={handleCreateSociety} loading={creating} style={styles.halfBtn} />
              </View>
            </AppCard>
          ) : (
            <>
              <View style={[styles.kpiGrid, isMobile && styles.kpiGridMobile]}>
                <KpiCard icon="layers-outline" label="Total Wings" value={wings.length} color={COLORS.accent} compact={isMobile} />
                <KpiCard icon="people-outline" label="Total Residents" value={residents.length} color={COLORS.success} compact={isMobile} />
                <KpiCard icon="shield-outline" label="Total Chairmen" value={chairmenCount} color={COLORS.warning} compact={isMobile} />
                <KpiCard icon="home-outline" label="Occupied Flats" value={occupiedFlats} color={COLORS.accent} compact={isMobile} />
              </View>

              <View style={[styles.mainGrid, isDesktop && styles.mainGridDesktop, isTablet && styles.mainGridTablet, isMobile && styles.mainGridMobile]}>
                <View style={[styles.leftColumn, isDesktop && styles.leftColumnWide]}>
                  <AppCard style={[styles.sectionCard, isMobile && styles.sectionCardMobile]}>
                    <Text style={styles.sectionTitle}>Society Information</Text>
                    <View style={styles.infoGrid}>
                      <InfoCell label="Society Name" value={society.name || '-'} fullWidth={isMobile} />
                      <InfoCell label="Total Wings" value={String(wings.length)} fullWidth={isMobile} />
                      <InfoCell label="Resident Count" value={String(residents.length)} fullWidth={isMobile} />
                      <InfoCell label="Creation Date" value={society.created_at ? new Date(society.created_at).toLocaleDateString() : 'Date unavailable'} fullWidth={isMobile} />
                      <InfoCell label="Status" value="Active" tone="success" fullWidth={isMobile} />
                    </View>
                  </AppCard>

                  <AppCard style={[styles.sectionCard, isMobile && styles.sectionCardMobile]}>
                    <Text style={styles.sectionTitle}>Wing Management</Text>
                    <View style={[styles.inlineRow, isMobile && styles.inlineRowMobile]}>
                      <View style={{ flex: 1 }}>
                        <AppInput
                          label="Add Wing"
                          leftIcon="add-circle-outline"
                          value={newWingName}
                          onChangeText={setNewWingName}
                          placeholder="Enter wing name"
                        />
                      </View>
                      <View style={[styles.inlineBtnWrap, isMobile && styles.inlineBtnWrapMobile]}>
                        <AppButton title="Add" onPress={handleAddWing} loading={addingWing} />
                      </View>
                    </View>

                    {wingList.length === 0 ? (
                      <EmptyState title="No Wings" subtitle="Create your first wing to get started." />
                    ) : (
                      <View style={[styles.wingsGrid, (isTablet || isDesktop) && styles.wingsGridWide]}>
                        {wingList.map((wing) => (
                          <View key={wing._id} style={[styles.wingChipCard, (isTablet || isDesktop) && styles.wingChipCardWide]}>
                            <Text style={styles.wingChipName}>Wing {wing.name}</Text>
                            <Text style={styles.wingChipMeta}>{wing._id?.slice(-6) || '-'}</Text>
                            <View style={[styles.statusPill, wing.chairmanName || wing.chairmanEmail || wing.chairmanPhone ? styles.statusAssigned : styles.statusPending]}>
                              <Text style={[styles.statusPillText, wing.chairmanName || wing.chairmanEmail || wing.chairmanPhone ? styles.statusAssignedText : styles.statusPendingText]}>
                                {wing.chairmanName || wing.chairmanEmail || wing.chairmanPhone ? 'Assigned' : 'Pending'}
                              </Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </AppCard>
                </View>

                <View style={[styles.rightColumn, isDesktop && styles.rightColumnWide]}>
                  <AppCard style={[styles.sectionCard, isMobile && styles.sectionCardMobile]}>
                    <Text style={styles.sectionTitle}>Chairman Assignment</Text>
                    {wingList.length === 0 ? (
                      <EmptyState title="No Wings" subtitle="Add wings before assigning chairmen." />
                    ) : (
                      wingList.map((wing) => {
                        const suggestions = getEmailSuggestions(wing._id);
                        const hasChairman = wing.chairmanName || wing.chairmanEmail || wing.chairmanPhone;
                        return (
                          <View key={wing._id} style={styles.chairmanRow}>
                            <View style={styles.chairmanHead}>
                              <Text style={styles.chairmanWing}>Wing {wing.name}</Text>
                              <Text style={styles.chairmanMeta}>
                                {hasChairman ? `Current: ${wing.chairmanName || wing.chairmanEmail || wing.chairmanPhone}` : 'Current: Not assigned'}
                              </Text>
                            </View>
                            <AppInput
                              label="Chairman Contact"
                              leftIcon="person-outline"
                              value={assigning[wing._id] || ''}
                              onChangeText={(value) => setAssigning((prev) => ({ ...prev, [wing._id]: value }))}
                              placeholder="Phone or email"
                            />
                            {suggestions.length ? (
                              <View style={styles.suggestionsCard}>
                                {suggestions.map((email) => (
                                  <Pressable
                                    key={`${wing._id}-${email}`}
                                    style={styles.suggestionItem}
                                    onPress={() => setAssigning((prev) => ({ ...prev, [wing._id]: email }))}
                                  >
                                    <Ionicons name="mail-outline" size={14} color={COLORS.textMuted} />
                                    <Text style={styles.suggestionText}>{email}</Text>
                                  </Pressable>
                                ))}
                              </View>
                            ) : null}
                            <View style={styles.buttonRow}>
                              <AppButton
                                title={hasChairman ? 'Replace Chairman' : 'Assign Chairman'}
                                onPress={() => handleAssignChairman(wing._id)}
                                loading={assigningWing === wing._id}
                                style={styles.halfBtn}
                              />
                              <AppButton
                                title="Clear Input"
                                variant="outline"
                                onPress={() => setAssigning((prev) => ({ ...prev, [wing._id]: '' }))}
                                style={styles.halfBtn}
                              />
                            </View>
                          </View>
                        );
                      })
                    )}
                  </AppCard>
                </View>
              </View>

              <AppCard style={[styles.sectionCard, isMobile && styles.sectionCardMobile]}>
                <View style={[styles.sectionHeaderRow, isMobile && styles.sectionHeaderRowMobile]}>
                  <Text style={styles.sectionTitle}>Resident Management</Text>
                  <AppButton
                    title={showResidentForm ? 'Hide Form' : 'Add Resident'}
                    variant={showResidentForm ? 'outline' : 'primary'}
                    onPress={() => setShowResidentForm((prev) => !prev)}
                    size="small"
                    style={[styles.addResidentBtn, isMobile && styles.addResidentBtnMobile]}
                  />
                </View>

                <View style={styles.searchResidentWrap}>
                  <AppInput
                    label="Search Residents"
                    leftIcon="search-outline"
                    value={residentSearch}
                    onChangeText={setResidentSearch}
                    placeholder="Search by name, email, phone, flat, wing"
                  />
                </View>

                {showResidentForm ? (
                  <View style={styles.residentFormCard}>
                    <AppInput label="Name" leftIcon="person-outline" value={residentForm.name} onChangeText={(value) => setResidentForm((prev) => ({ ...prev, name: value }))} placeholder="Resident name" />
                    <AppInput label="Email" leftIcon="mail-outline" value={residentForm.email} onChangeText={(value) => setResidentForm((prev) => ({ ...prev, email: value }))} placeholder="resident@email.com" autoCapitalize="none" />
                    <AppInput label="Password" leftIcon="lock-closed-outline" value={residentForm.password} onChangeText={(value) => setResidentForm((prev) => ({ ...prev, password: value }))} placeholder="Create password" secureTextEntry />
                    <AppInput label="Wing ID" leftIcon="layers-outline" value={residentForm.wingId} onChangeText={(value) => setResidentForm((prev) => ({ ...prev, wingId: value }))} placeholder="Select from wings above" />
                    <AppInput label="Phone" leftIcon="call-outline" value={residentForm.phone} onChangeText={(value) => setResidentForm((prev) => ({ ...prev, phone: value }))} placeholder="9876543210" keyboardType="phone-pad" />
                    <AppInput label="Flat Number" leftIcon="home-outline" value={residentForm.flatNumber} onChangeText={(value) => setResidentForm((prev) => ({ ...prev, flatNumber: value }))} placeholder="A-101" />
                    <AppButton title="Register Resident" onPress={handleRegisterResident} loading={registering} />
                  </View>
                ) : null}

                {residentRows.length === 0 ? (
                  <EmptyState title="No Residents Found" subtitle={residentSearch ? 'Try a different search.' : 'Add a resident to get started.'} />
                ) : (
                  <View style={styles.residentList}>
                    {residentRows.map((resident) => (
                      <View key={resident._id} style={[styles.residentRow, isMobile && styles.residentRowMobile]}>
                        <View style={styles.residentMain}>
                          <Text style={styles.residentName}>{resident.name || '-'}</Text>
                          <Text style={styles.residentMeta}>{resident.email || '-'} • {resident.phone || '-'}</Text>
                          <Text style={styles.residentMeta}>Wing: {resident.wingName || '-'} • Flat: {resident.flatNumber || '-'}</Text>
                        </View>
                        <View style={[styles.residentActions, isMobile && styles.residentActionsMobile]}>
                          <Pressable style={[styles.smallAction, styles.viewAction]} onPress={() => viewResident(resident)}>
                            <Text style={styles.smallActionText}>View</Text>
                          </Pressable>
                          <Pressable style={[styles.smallAction, styles.editAction]} onPress={() => showError('Edit coming soon', 'Resident edit UI can be added next.') }>
                            <Text style={styles.smallActionText}>Edit</Text>
                          </Pressable>
                          <Pressable style={[styles.smallAction, styles.deleteAction]} onPress={() => handleDeleteResident(resident._id)} disabled={deletingResidentId === resident._id}>
                            <Text style={styles.smallActionText}>{deletingResidentId === resident._id ? '...' : 'Delete'}</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </AppCard>
            </>
          )}
        </View>
      </ScrollView>
    </ScreenContainer>
  );
};

const KpiCard = ({ icon, label, value, color, compact }) => (
  <AppCard style={[styles.kpiCard, compact && styles.kpiCardCompact]}>
    <View style={[styles.kpiIcon, { backgroundColor: `${color}1C` }]}> 
      <Ionicons name={icon} size={compact ? 14 : 18} color={color} />
    </View>
    <Text style={[styles.kpiValue, compact && styles.kpiValueCompact]}>{value}</Text>
    <Text style={[styles.kpiLabel, compact && styles.kpiLabelCompact]}>{label}</Text>
  </AppCard>
);

const InfoCell = ({ label, value, tone = 'default', fullWidth = false }) => (
  <View style={[styles.infoCell, fullWidth && styles.infoCellFull]}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={[styles.infoValue, tone === 'success' && { color: COLORS.success }]}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  pageWrap: {
    width: '100%',
    maxWidth: 1320,
    alignSelf: 'center',
  },
  sectionCard: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.lg,
  },
  sectionCardMobile: {
    marginBottom: SPACING.sm,
  },
  sectionTitle: {
    ...TYPOGRAPHY.h3,
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
  },
  fieldTitle: {
    ...TYPOGRAPHY.label,
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  kpiGridMobile: {
    gap: SPACING.xs,
  },
  kpiCard: {
    flexBasis: 230,
    flexGrow: 1,
    minHeight: 108,
    borderRadius: RADIUS.lg,
  },
  kpiCardCompact: {
    width: '48.5%',
    flexBasis: '48.5%',
    minHeight: 86,
    padding: SPACING.xs,
    marginBottom: SPACING.xs,
  },
  kpiIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.xs,
  },
  kpiValue: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  kpiValueCompact: {
    fontSize: 16,
  },
  kpiLabel: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  kpiLabelCompact: {
    fontSize: 10,
  },
  mainGrid: {
    flexDirection: 'column',
    gap: SPACING.xl,
  },
  mainGridMobile: {
    gap: SPACING.sm,
  },
  mainGridDesktop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  mainGridTablet: {
    flexDirection: 'column',
  },
  leftColumn: {
    width: '100%',
    minWidth: 0,
  },
  leftColumnWide: {
    flex: 1,
  },
  rightColumn: {
    width: '100%',
    minWidth: 0,
  },
  rightColumnWide: {
    flex: 1,
  },
  infoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
  },
  infoCell: {
    width: '48.5%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
  },
  infoCellFull: {
    width: '100%',
  },
  infoLabel: {
    color: COLORS.textMuted,
    fontSize: 11,
    marginBottom: 4,
  },
  infoValue: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  inlineRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-end',
  },
  inlineRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  inlineBtnWrap: {
    width: 140,
    marginBottom: SPACING.md,
  },
  inlineBtnWrapMobile: {
    width: '100%',
    marginBottom: 0,
  },
  wingsGrid: {
    gap: SPACING.sm,
  },
  wingsGridWide: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  wingChipCard: {
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
  },
  wingChipCardWide: {
    width: '48.5%',
  },
  wingChipName: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    fontSize: 14,
  },
  wingChipMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 4,
    marginBottom: SPACING.xs,
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
  },
  statusAssigned: {
    backgroundColor: 'rgba(16,185,129,0.15)',
    borderColor: 'rgba(16,185,129,0.24)',
  },
  statusPending: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderColor: 'rgba(245,158,11,0.24)',
  },
  statusPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusAssignedText: {
    color: COLORS.success,
  },
  statusPendingText: {
    color: COLORS.warning,
  },
  chairmanRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    backgroundColor: COLORS.surface,
    marginBottom: SPACING.sm,
  },
  chairmanHead: {
    marginBottom: SPACING.xs,
  },
  chairmanWing: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  chairmanMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  suggestionsCard: {
    marginTop: 0,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.surface,
  },
  suggestionItem: {
    minHeight: 36,
    paddingHorizontal: SPACING.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionText: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: SPACING.sm,
  },
  sectionHeaderRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  addResidentBtn: {
    width: 130,
  },
  addResidentBtnMobile: {
    width: '100%',
  },
  searchResidentWrap: {
    marginTop: SPACING.xs,
  },
  residentFormCard: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surfaceAlt,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  residentList: {
    gap: SPACING.sm,
  },
  residentRow: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.surface,
    padding: SPACING.sm,
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  residentRowMobile: {
    flexDirection: 'column',
    alignItems: 'stretch',
  },
  residentMain: {
    flex: 1,
  },
  residentName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  residentMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginTop: 3,
  },
  residentActions: {
    gap: 6,
  },
  residentActionsMobile: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  smallAction: {
    minHeight: 30,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  viewAction: {
    borderColor: COLORS.border,
    backgroundColor: COLORS.surfaceAlt,
  },
  editAction: {
    borderColor: COLORS.accent,
    backgroundColor: COLORS.accentSoft,
  },
  deleteAction: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  smallActionText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.textSecondary,
  },
  wingRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  wingInput: {
    flex: 1,
  },
  removeChip: {
    marginTop: 36,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.24)',
    backgroundColor: 'rgba(239,68,68,0.12)',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 8,
  },
  removeText: {
    color: '#EF4444',
    fontWeight: '700',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  halfBtn: {
    flex: 1,
  },
});

export default SocietyScreen;
