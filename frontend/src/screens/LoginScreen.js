import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import AppButton from '../components/AppButton';
import AppCard from '../components/AppCard';
import AppInput from '../components/AppInput';
import ScreenContainer from '../components/ScreenContainer';
import { COLORS, GRADIENTS, RADIUS, SPACING, TYPOGRAPHY } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/error';
import { showError, showSuccess } from '../utils/toast';
import { isValidEmail, minLength, required } from '../utils/validators';

const LoginScreen = ({ navigation }) => {
  const { signIn } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const updateField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!required(form.email) || !isValidEmail(form.email)) {
      nextErrors.email = 'Enter a valid email';
    }
    if (!minLength(form.password, 6)) {
      nextErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSubmit = async () => {
    if (!validate()) return;
    try {
      setLoading(true);
      await signIn({ email: form.email.trim(), password: form.password });
      showSuccess('Welcome back', 'Login successful');
    } catch (error) {
      showError('Login failed', getErrorMessage(error, 'Unable to login'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer contentContainerStyle={styles.container}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <LinearGradient
          colors={GRADIENTS.hero}
          style={styles.logoWrap}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Ionicons name="business" size={32} color={COLORS.white} />
        </LinearGradient>
        
        <Text style={styles.heroTitle}>Society Management</Text>
        <Text style={styles.heroSubtitle}>
          Welcome back. Sign in to access your resident workspace.
        </Text>
      </View>

      {/* Login Form */}
      <AppCard variant="elevated" style={styles.formCard}>
        <Text style={styles.formTitle}>Sign In</Text>
        
        <AppInput
          label="Email Address"
          value={form.email}
          onChangeText={(value) => updateField('email', value)}
          placeholder="you@example.com"
          keyboardType="email-address"
          error={errors.email}
          leftIcon="mail-outline"
          autoCapitalize="none"
        />
        
        <AppInput
          label="Password"
          value={form.password}
          onChangeText={(value) => updateField('password', value)}
          placeholder="Enter your password"
          secureTextEntry={!showPassword}
          error={errors.password}
          leftIcon="lock-closed-outline"
          rightIcon={
            <TouchableOpacity 
              onPress={() => setShowPassword(!showPassword)}
              style={styles.eyeButton}
            >
              <Ionicons 
                name={showPassword ? 'eye-off-outline' : 'eye-outline'} 
                size={20} 
                color={COLORS.textSecondary} 
              />
            </TouchableOpacity>
          }
        />

        <AppButton 
          title="Sign In" 
          onPress={onSubmit} 
          loading={loading}
          style={styles.submitButton}
        />
      </AppCard>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>Don't have an account?</Text>
        <TouchableOpacity 
          onPress={() => navigation.navigate('Register')}
          style={styles.linkButton}
        >
          <Text style={styles.linkText}>Create Account</Text>
          <Ionicons name="arrow-forward" size={16} color={COLORS.accent} />
        </TouchableOpacity>
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    minHeight: '100%',
    paddingVertical: SPACING.xxxl
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: SPACING.xxxl
  },
  logoWrap: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong
  },
  heroTitle: {
    ...TYPOGRAPHY.displayLarge,
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.sm
  },
  heroSubtitle: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320
  },
  formCard: {
    marginBottom: SPACING.lg
  },
  formTitle: {
    ...TYPOGRAPHY.h2,
    color: COLORS.textPrimary,
    marginBottom: SPACING.lg
  },
  eyeButton: {
    padding: SPACING.xs
  },
  submitButton: {
    marginTop: SPACING.sm
  },
  footer: {
    alignItems: 'center',
    gap: SPACING.sm
  },
  footerText: {
    ...TYPOGRAPHY.body,
    color: COLORS.textSecondary
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs
  },
  linkText: {
    ...TYPOGRAPHY.body,
    color: COLORS.accent,
    fontWeight: '600'
  }
});

export default LoginScreen;
