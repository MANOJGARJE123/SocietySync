import React, { useCallback, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppInput from '../components/AppInput';
import EmptyState from '../components/EmptyState';
import LoadingOverlay from '../components/LoadingOverlay';
import PageHeader from '../components/PageHeader';
import ScreenContainer from '../components/ScreenContainer';
import { COLORS, SPACING } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/error';
import { showError, showSuccess } from '../utils/toast';
import {
  approveWingRequest,
  getWingMembers,
  getWingRequests,
  registerResident,
  removeWingMember,
  rejectWingRequest
} from '../services/societyService';

const WingRequestsScreen = () => {
  const { user, refreshProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requests, setRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const [processingId, setProcessingId] = useState('');
  const [registering, setRegistering] = useState(false);
  const [residentForm, setResidentForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    flatNumber: ''
  });

  const wingId = user?.wingId;

  const loadRequests = useCallback(
    async (isRefresh = false) => {
      if (!wingId) {
        setRequests([]);
        setLoading(false);
        return;
      }

      try {
        if (isRefresh) setRefreshing(true);
        if (!isRefresh) setLoading(true);
        const [pending, approved] = await Promise.all([
          getWingRequests(wingId),
          getWingMembers(wingId)
        ]);
        setRequests(pending);
        setMembers(approved);
      } catch (error) {
        showError('Unable to load requests', getErrorMessage(error));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [wingId]
  );

  useFocusEffect(
    useCallback(() => {
      loadRequests();
    }, [loadRequests])
  );

  const handleApprove = async (userId) => {
    if (!wingId) return;
    try {
      setProcessingId(userId);
      await approveWingRequest(wingId, userId);
      showSuccess('Approved', 'Resident added to your wing');
      await refreshProfile();
      loadRequests(true);
    } catch (error) {
      showError('Approval failed', getErrorMessage(error));
    } finally {
      setProcessingId('');
    }
  };

  const handleReject = async (userId) => {
    if (!wingId) return;
    try {
      setProcessingId(userId);
      await rejectWingRequest(wingId, userId);
      showSuccess('Rejected', 'Request removed');
      loadRequests(true);
    } catch (error) {
      showError('Reject failed', getErrorMessage(error));
    } finally {
      setProcessingId('');
    }
  };

  const handleRegisterResident = async () => {
    if (!residentForm.name.trim() || !residentForm.email.trim() || !residentForm.password) {
      showError('Missing fields', 'Name, email and password are required');
      return;
    }

    try {
      setRegistering(true);
      await registerResident({
        name: residentForm.name.trim(),
        email: residentForm.email.trim(),
        password: residentForm.password,
        phone: residentForm.phone.trim(),
        flatNumber: residentForm.flatNumber.trim()
      });
      setResidentForm({
        name: '',
        email: '',
        password: '',
        phone: '',
        flatNumber: ''
      });
      showSuccess('Resident added', 'Resident was added to your wing');
      loadRequests(true);
    } catch (error) {
      showError('Resident registration failed', getErrorMessage(error));
    } finally {
      setRegistering(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!wingId) return;
    try {
      setProcessingId(userId);
      await removeWingMember(wingId, userId);
      showSuccess('Member removed', 'Resident was removed from your wing');
      loadRequests(true);
    } catch (error) {
      showError('Remove failed', getErrorMessage(error));
    } finally {
      setProcessingId('');
    }
  };

  if (loading) return <LoadingOverlay />;

  return (
    <ScreenContainer>
      <ScrollView
        style={{ flex: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadRequests(true)} />
        }
        showsVerticalScrollIndicator={false}
      >
        <PageHeader
          title="Wing Requests"
          subtitle="Approve requests, add members, and manage only your own wing."
          icon="people-outline"
        />

        <AppCard>
          <Text style={styles.sectionTitle}>Add Resident To Your Wing</Text>
          <AppInput
            label="Name"
            leftIcon="person-outline"
            value={residentForm.name}
            onChangeText={(value) => setResidentForm((prev) => ({ ...prev, name: value }))}
            placeholder="Resident name"
          />
          <AppInput
            label="Email"
            leftIcon="mail-outline"
            value={residentForm.email}
            onChangeText={(value) => setResidentForm((prev) => ({ ...prev, email: value }))}
            placeholder="resident@email.com"
            autoCapitalize="none"
          />
          <AppInput
            label="Password"
            leftIcon="lock-closed-outline"
            value={residentForm.password}
            onChangeText={(value) => setResidentForm((prev) => ({ ...prev, password: value }))}
            placeholder="Create a password"
            secureTextEntry
          />
          <AppInput
            label="Phone"
            leftIcon="call-outline"
            value={residentForm.phone}
            onChangeText={(value) => setResidentForm((prev) => ({ ...prev, phone: value }))}
            placeholder="9876543210"
            keyboardType="phone-pad"
          />
          <AppInput
            label="Flat Number"
            leftIcon="home-outline"
            value={residentForm.flatNumber}
            onChangeText={(value) => setResidentForm((prev) => ({ ...prev, flatNumber: value }))}
            placeholder="A-101"
          />
          <AppButton title="Add Resident" onPress={handleRegisterResident} loading={registering} />
        </AppCard>

        <Text style={styles.sectionTitle}>Pending Requests</Text>
        {requests.length === 0 ? (
          <EmptyState title="No pending requests" subtitle="New join requests will appear here." />
        ) : (
          requests.map((item) => (
            <AppCard key={item._id}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.meta}>Email: {item.email}</Text>
              <Text style={styles.meta}>Phone: {item.phone || '-'}</Text>
              <Text style={styles.meta}>Flat: {item.flatNumber || '-'}</Text>
              <View style={styles.actionRow}>
                <AppButton
                  title="Approve"
                  onPress={() => handleApprove(item._id)}
                  loading={processingId === item._id}
                />
                <AppButton
                  title="Reject"
                  variant="outline"
                  onPress={() => handleReject(item._id)}
                  loading={processingId === item._id}
                  style={styles.rejectButton}
                />
              </View>
            </AppCard>
          ))
        )}

        <Text style={styles.sectionTitle}>Wing Members</Text>
        {members.length === 0 ? (
          <EmptyState title="No members yet" subtitle="Approved wing members will appear here." />
        ) : (
          members.map((item) => (
            <AppCard key={item._id}>
              <Text style={styles.title}>{item.name}</Text>
              <Text style={styles.meta}>Email: {item.email}</Text>
              <Text style={styles.meta}>Phone: {item.phone || '-'}</Text>
              <Text style={styles.meta}>Flat: {item.flatNumber || '-'}</Text>
              <View style={styles.actionRow}>
                <AppButton
                  title="Remove From Wing"
                  variant="outline"
                  onPress={() => handleRemoveMember(item._id)}
                  loading={processingId === item._id}
                  style={styles.rejectButton}
                />
              </View>
            </AppCard>
          ))
        )}
      </ScrollView>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.textPrimary,
    marginBottom: SPACING.xs
  },
  meta: {
    color: COLORS.textMuted,
    fontSize: 12,
    marginBottom: 2
  },
  actionRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md
  },
  rejectButton: {
    flex: 1
  }
});

export default WingRequestsScreen;
