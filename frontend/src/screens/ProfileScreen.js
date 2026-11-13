import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppInput from '../components/AppInput';
import PageHeader from '../components/PageHeader';
import ScreenContainer from '../components/ScreenContainer';
import { COLORS, GRADIENTS, RADIUS, SHADOW, SPACING, TYPOGRAPHY } from '../constants/theme';
import { ROLES } from '../constants/app';
import { useAuth } from '../context/AuthContext';
import { useResponsive } from '../hooks/useResponsive';
import { getErrorMessage } from '../utils/error';
import { showError, showSuccess } from '../utils/toast';
import { required } from '../utils/validators';
import { requestJoinWing } from '../services/societyService';
import apiClient from '../services/apiClient';

const getInitials = (name) =>
  String(name || 'U').split(' ').filter(Boolean).slice(0, 2).map(p => p.charAt(0).toUpperCase()).join('');

const ProfileScreen = () => {
  const { user, saveProfile, signOut, refreshProfile } = useAuth();
  const { isMobile, isTablet } = useResponsive();
  const [form, setForm] = useState({ name: '', phone: '', flatNumber: '' });
  const [pwForm, setPwForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [wingRequestId, setWingRequestId] = useState('');
  const [errors, setErrors] = useState({});
  const [pwErrors, setPwErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    setForm({ name: user?.name || '', phone: user?.phone || '', flatNumber: user?.flatNumber || '' });
    setWingRequestId('');
  }, [user]);

  const validate = () => {
    const e = {};
    if (!required(form.name)) e.name = 'Name is required';
    if (!required(form.flatNumber)) e.flatNumber = 'Flat number is required';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const validatePw = () => {
    const e = {};
    if (!required(pwForm.currentPassword)) e.currentPassword = 'Current password is required';
    if (!pwForm.newPassword || pwForm.newPassword.length < 8)
      e.newPassword = 'New password must be at least 8 characters';
    if (!/[a-zA-Z]/.test(pwForm.newPassword) || !/[0-9]/.test(pwForm.newPassword))
      e.newPassword = 'Password must contain a letter and a number';
    if (pwForm.newPassword !== pwForm.confirmPassword)
      e.confirmPassword = 'Passwords do not match';
    setPwErrors(e);
    return !Object.keys(e).length;
  };

  const onSave = async () => {
    if (!validate()) return;
    try {
      setSaving(true);
      await saveProfile({ name: form.name.trim(), phone: form.phone.trim(), flatNumber: form.flatNumber.trim() });
      showSuccess('Profile updated', 'Your details are up to date');
    } catch (e) { showError('Update failed', getErrorMessage(e)); }
    finally { setSaving(false); }
  };

  const onChangePassword = async () => {
    if (!validatePw()) return;
    try {
      setChangingPw(true);
      await apiClient.post('/auth/change-password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      showSuccess('Password changed', 'Please log in again on other devices');
    } catch (e) { showError('Password change failed', getErrorMessage(e)); }
    finally { setChangingPw(false); }
  };

  const onRequestWing = async () => {
    if (!wingRequestId.trim()) { showError('Missing wing ID', 'Enter the wing ID you want to join'); return; }
    try {
      setRequesting(true);
      await requestJoinWing(wingRequestId.trim());
      await refreshProfile();
      showSuccess('Request sent', 'Chairman approval is pending');
      setWingRequestId('');
    } catch (e) { showError('Request failed', getErrorMessage(e)); }
    finally { setRequesting(false); }
  };

  const confirmSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScreenContainer>
      <View style={styles.page}>
        <PageHeader title="Profile" subtitle="Manage account details and settings." icon="person-circle-outline" variant="compact" />
        <View style={styles.centered}>
          {/* Profile header card */}
          <AppCard style={[styles.profileCard, isMobile && styles.profileCardMobile]}>
            <LinearGradient colors={GRADIENTS.avatar || GRADIENTS.hero} style={[styles.avatar, isMobile && styles.avatarMobile]}>
              <Text style={[styles.avatarText, isMobile && styles.avatarTextMobile]}>{getInitials(user?.name)}</Text>
            </LinearGradient>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || '-'}</Text>
              <Text style={styles.profileEmail}>{user?.email || '-'}</Text>
              <View style={styles.badgeRow}>
                <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>{user?.role || '-'}</Text></View>
                <View style={styles.wingBadge}><Text style={styles.wingBadgeText}>Wing: {user?.wingStatus || 'none'}</Text></View>
              </View>
            </View>
          </AppCard>

          <View style={[styles.contentGrid, (isTablet || isMobile) && styles.contentGridStacked]}>
            <View style={styles.mainCol}>
              {/* Personal details */}
              <AppCard style={styles.formCard}>
                <Text style={styles.cardTitle}>Personal Details</Text>
                <Text style={styles.cardSub}>Keep your profile accurate for society records.</Text>
                <AppInput label="Name" leftIcon="person-outline" value={form.name} onChangeText={v => { setForm(p => ({ ...p, name: v })); setErrors(p => ({ ...p, name: '' })); }} placeholder="Your name" autoCapitalize="words" error={errors.name} />
                <AppInput label="Phone" leftIcon="call-outline" value={form.phone} onChangeText={v => setForm(p => ({ ...p, phone: v }))} placeholder="9876543210" keyboardType="phone-pad" />
                <AppInput label="Flat Number" leftIcon="home-outline" value={form.flatNumber} onChangeText={v => { setForm(p => ({ ...p, flatNumber: v })); setErrors(p => ({ ...p, flatNumber: '' })); }} placeholder="A-101" error={errors.flatNumber} />
                <AppButton title="Save Changes" onPress={onSave} loading={saving} size="small" />
              </AppCard>

              {/* Change Password */}
              <AppCard style={styles.formCard}>
                <Text style={styles.cardTitle}>Change Password</Text>
                <Text style={styles.cardSub}>Use a strong password with letters and numbers.</Text>
                <AppInput label="Current Password" leftIcon="lock-closed-outline" secureTextEntry value={pwForm.currentPassword} onChangeText={v => { setPwForm(p => ({ ...p, currentPassword: v })); setPwErrors(p => ({ ...p, currentPassword: '' })); }} placeholder="Current password" error={pwErrors.currentPassword} />
                <AppInput label="New Password" leftIcon="lock-open-outline" secureTextEntry value={pwForm.newPassword} onChangeText={v => { setPwForm(p => ({ ...p, newPassword: v })); setPwErrors(p => ({ ...p, newPassword: '' })); }} placeholder="Min 8 chars, letter + number" error={pwErrors.newPassword} />
                <AppInput label="Confirm New Password" leftIcon="checkmark-circle-outline" secureTextEntry value={pwForm.confirmPassword} onChangeText={v => { setPwForm(p => ({ ...p, confirmPassword: v })); setPwErrors(p => ({ ...p, confirmPassword: '' })); }} placeholder="Confirm new password" error={pwErrors.confirmPassword} />
                <AppButton title="Change Password" onPress={onChangePassword} loading={changingPw} size="small" />
              </AppCard>

              {/* Wing join */}
              {user?.role === ROLES.RESIDENT && user?.wingStatus !== 'approved' && (
                <AppCard style={styles.formCard}>
                  <Text style={styles.cardTitle}>Join Wing</Text>
                  <Text style={styles.cardSub}>Request access to your wing using the Wing ID.</Text>
                  <AppInput label="Wing ID" leftIcon="layers-outline" value={wingRequestId} onChangeText={setWingRequestId} placeholder="Enter wing ID" />
                  <AppButton title="Request Access" onPress={onRequestWing} loading={requesting} size="small" />
                </AppCard>
              )}
            </View>

            <View style={styles.sideCol}>
              <AppCard style={styles.infoCard}>
                <View style={styles.infoTitleRow}>
                  <Ionicons name="shield-checkmark-outline" size={16} color={COLORS.textSecondary} />
                  <Text style={styles.infoTitle}>Role Management</Text>
                </View>
                <Text style={styles.helperText}>
                  {user?.role === ROLES.ADMIN
                    ? 'Promote another user to admin before changing your own role.'
                    : 'Role access is managed by society admins.'}
                </Text>
              </AppCard>
              <AppButton title="Sign Out" onPress={confirmSignOut} variant="outline" size="small" style={styles.signOut} />
            </View>
          </View>
        </View>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  page: { width: '100%' },
  centered: { maxWidth: 920, alignSelf: 'center', width: '100%' },
  profileCard: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md, borderColor: COLORS.borderStrong, ...SHADOW.sm },
  profileCardMobile: { alignItems: 'flex-start', padding: SPACING.sm },
  avatar: { width: 56, height: 56, borderRadius: 999, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  avatarMobile: { width: 48, height: 48 },
  avatarText: { color: '#fff', fontSize: 20, fontWeight: '800' },
  avatarTextMobile: { fontSize: 17 },
  profileInfo: { flex: 1 },
  profileName: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary },
  profileEmail: { fontSize: 13, color: COLORS.textMuted, marginTop: 4 },
  badgeRow: { flexDirection: 'row', gap: SPACING.xs, marginTop: SPACING.sm, flexWrap: 'wrap' },
  roleBadge: { backgroundColor: COLORS.accentSoft, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5 },
  roleBadgeText: { color: COLORS.accent, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  wingBadge: { backgroundColor: COLORS.surfaceAlt, borderRadius: RADIUS.pill, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: COLORS.border },
  wingBadgeText: { color: COLORS.textMuted, fontSize: 11, fontWeight: '700' },
  contentGrid: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.md },
  contentGridStacked: { flexDirection: 'column' },
  mainCol: { flex: 1 },
  sideCol: { width: 280, maxWidth: '100%' },
  formCard: { backgroundColor: COLORS.surface },
  infoCard: { backgroundColor: COLORS.surface, ...SHADOW.sm },
  cardTitle: { ...TYPOGRAPHY.h3, color: COLORS.textPrimary, marginBottom: 4 },
  cardSub: { fontSize: 13, color: COLORS.textTertiary, marginBottom: SPACING.md },
  infoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, marginBottom: SPACING.xs },
  infoTitle: { fontSize: 13, fontWeight: '700', color: COLORS.textSecondary },
  helperText: { color: COLORS.textMuted, fontSize: 13, lineHeight: 20 },
  signOut: { marginTop: SPACING.xs, borderColor: '#F3D6D6', backgroundColor: '#FFF8F8' },
});

export default ProfileScreen;
