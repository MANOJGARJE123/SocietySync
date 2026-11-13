import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppInput from '../components/AppInput';
import ScreenContainer from '../components/ScreenContainer';
import { ROLES } from '../constants/app';
import { COLORS, GRADIENTS, RADIUS, SPACING } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { getSocieties, getWingsBySociety } from '../services/societyService';
import { getErrorMessage } from '../utils/error';
import { showError, showSuccess } from '../utils/toast';
import { isValidEmail, minLength, required } from '../utils/validators';

const RegisterScreen = ({ navigation }) => {
  const { signUp } = useAuth();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: ROLES.RESIDENT,
    phone: '',
    flatNumber: '',
    societyId: '',
    wingId: ''
  });
  const [errors, setErrors] = useState({});
  const [societies, setSocieties] = useState([]);
  const [wings, setWings] = useState([]);
  const [loadingSocieties, setLoadingSocieties] = useState(true);
  const [loadingWings, setLoadingWings] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSocieties = async () => {
      try {
        setLoadingSocieties(true);
        const data = await getSocieties();
        setSocieties(data);
      } catch (error) {
        showError('Unable to load societies', getErrorMessage(error));
      } finally {
        setLoadingSocieties(false);
      }
    };

    loadSocieties();
  }, []);

  useEffect(() => {
    const loadWings = async () => {
      if (!form.societyId) {
        setWings([]);
        return;
      }

      try {
        setLoadingWings(true);
        const data = await getWingsBySociety(form.societyId);
        setWings(data);
      } catch (error) {
        setWings([]);
        showError('Unable to load wings', getErrorMessage(error));
      } finally {
        setLoadingWings(false);
      }
    };

    loadWings();
  }, [form.societyId]);

  const updateField = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'societyId' ? { wingId: '' } : {})
    }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!required(form.name)) nextErrors.name = 'Name is required';
    if (!required(form.email) || !isValidEmail(form.email)) nextErrors.email = 'Valid email is required';
    if (!minLength(form.password, 6)) nextErrors.password = 'Password should be at least 6 characters';
    if (!required(form.flatNumber)) nextErrors.flatNumber = 'Flat number is required';
    if (form.role === ROLES.RESIDENT && !required(form.societyId)) {
      nextErrors.societyId = 'Select your society';
    }
    if (form.role === ROLES.RESIDENT && !required(form.wingId)) {
      nextErrors.wingId = 'Select your wing';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      await signUp({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        // role always set server-side to 'resident' on self-registration
        phone: form.phone.trim(),
        flatNumber: form.flatNumber.trim(),
        wingId: form.role === ROLES.RESIDENT ? form.wingId.trim() : undefined
      });
      showSuccess('Registered', 'Your request is pending wing chairman approval');
    } catch (error) {
      showError('Registration failed', getErrorMessage(error, 'Unable to create account'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <LinearGradient colors={GRADIENTS.hero} style={styles.hero}>
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>Join your society dashboard with a professional profile.</Text>
      </LinearGradient>

      <AppCard>
        <AppInput
          label="Name"
          value={form.name}
          onChangeText={(value) => updateField('name', value)}
          placeholder="Full name"
          autoCapitalize="words"
          error={errors.name}
          leftIcon="person-outline"
        />
        <AppInput
          label="Email"
          value={form.email}
          onChangeText={(value) => updateField('email', value)}
          placeholder="you@example.com"
          keyboardType="email-address"
          error={errors.email}
          leftIcon="mail-outline"
        />
        <AppInput
          label="Password"
          value={form.password}
          onChangeText={(value) => updateField('password', value)}
          placeholder="Minimum 6 characters"
          secureTextEntry
          error={errors.password}
          leftIcon="lock-closed-outline"
        />
        <AppInput
          label="Flat Number"
          value={form.flatNumber}
          onChangeText={(value) => updateField('flatNumber', value)}
          placeholder="A-101"
          autoCapitalize="characters"
          error={errors.flatNumber}
          leftIcon="home-outline"
        />
        <AppInput
          label="Phone (optional)"
          value={form.phone}
          onChangeText={(value) => updateField('phone', value)}
          placeholder="9876543210"
          keyboardType="phone-pad"
          leftIcon="call-outline"
        />

        <Text style={styles.roleLabel}>Account Role</Text>
        <View style={styles.roleRow}>
          {[ROLES.RESIDENT].map((role) => (
            <Pressable
              key={role}
              style={[styles.roleChip, form.role === role && styles.activeRoleChip]}
              onPress={() => updateField('role', role)}
            >
              <Text style={[styles.roleChipText, form.role === role && styles.activeRoleChipText]}>
                {role}
              </Text>
            </Pressable>
          ))}
        </View>

        {form.role === ROLES.RESIDENT ? (
          <View style={styles.selectionSection}>
            <Text style={styles.roleLabel}>Select Society</Text>
            {errors.societyId ? <Text style={styles.errorText}>{errors.societyId}</Text> : null}
            {loadingSocieties ? (
              <Text style={styles.helperText}>Loading societies...</Text>
            ) : societies.length === 0 ? (
              <Text style={styles.helperText}>No societies are available yet.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {societies.map((society) => (
                  <Pressable
                    key={society._id}
                    style={[styles.optionChip, form.societyId === society._id && styles.activeOptionChip]}
                    onPress={() => updateField('societyId', society._id)}
                  >
                    <Text style={[styles.optionText, form.societyId === society._id && styles.activeOptionText]}>
                      {society.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            <Text style={styles.roleLabel}>Select Wing</Text>
            {errors.wingId ? <Text style={styles.errorText}>{errors.wingId}</Text> : null}
            {!form.societyId ? (
              <Text style={styles.helperText}>Choose a society first.</Text>
            ) : loadingWings ? (
              <Text style={styles.helperText}>Loading wings...</Text>
            ) : wings.length === 0 ? (
              <Text style={styles.helperText}>No wings are available for this society yet.</Text>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.optionRow}>
                {wings.map((wing) => (
                  <Pressable
                    key={wing._id}
                    style={[styles.optionChip, form.wingId === wing._id && styles.activeOptionChip]}
                    onPress={() => updateField('wingId', wing._id)}
                  >
                    <Text style={[styles.optionText, form.wingId === wing._id && styles.activeOptionText]}>
                      {wing.name}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        <AppButton title="Register" onPress={onSubmit} loading={loading} />
      </AppCard>

      <View style={styles.footerRow}>
        <Text style={styles.footerText}>Already have an account?</Text>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.linkText}>Login</Text>
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  hero: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.lg
  },
  title: {
    fontSize: 30,
    fontWeight: '800',
    color: COLORS.white,
    marginBottom: SPACING.xs
  },
  subtitle: {
    color: '#E7EEFF',
    fontSize: 15
  },
  roleLabel: {
    color: COLORS.textPrimary,
    fontWeight: '700',
    marginBottom: SPACING.sm
  },
  roleRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg
  },
  roleChip: {
    flex: 1,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingVertical: SPACING.sm,
    alignItems: 'center',
    backgroundColor: COLORS.white
  },
  activeRoleChip: {
    backgroundColor: '#E6EFFF',
    borderColor: COLORS.primary
  },
  roleChipText: {
    textTransform: 'capitalize',
    color: COLORS.textMuted,
    fontWeight: '600'
  },
  activeRoleChipText: {
    color: COLORS.primaryDark,
    fontWeight: '700'
  },
  selectionSection: {
    marginBottom: SPACING.md
  },
  optionRow: {
    gap: SPACING.sm,
    paddingBottom: SPACING.sm,
    marginBottom: SPACING.md
  },
  optionChip: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    minWidth: 96,
    alignItems: 'center'
  },
  activeOptionChip: {
    backgroundColor: '#E6EFFF',
    borderColor: COLORS.primary
  },
  optionText: {
    color: COLORS.textMuted,
    fontWeight: '700'
  },
  activeOptionText: {
    color: COLORS.primaryDark
  },
  helperText: {
    color: COLORS.textMuted,
    marginBottom: SPACING.md
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginBottom: SPACING.xs
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: SPACING.xs
  },
  footerText: {
    color: COLORS.textMuted
  },
  linkText: {
    color: COLORS.primaryDark,
    fontWeight: '800'
  }
});

export default RegisterScreen;
