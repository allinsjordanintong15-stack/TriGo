import { AuthLink } from '@/components/auth/AuthLink';
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TextInputField } from '@/components/ui/TextInputField';
import { useAuth } from '@/hooks/useAuth';
import { AuthServiceError, registerPassenger } from '@/services/authService';
import { colors, spacing, typography } from '@/constants/theme';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function RegisterScreen() {
  const { refreshProfile } = useAuth();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    setFormError('');
    setFieldErrors({});
    setLoading(true);

    try {
      await registerPassenger({
        fullName,
        email,
        password,
        confirmPassword,
        mobileNumber,
      });
      await refreshProfile();
      router.replace('/(passenger)/home');
    } catch (error) {
      if (error instanceof AuthServiceError) {
        if (error.fieldErrors) {
          setFieldErrors(error.fieldErrors);
        }
        setFormError(error.message);
      } else {
        setFormError('Unable to create your account. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenLayout
      title="Create account"
      subtitle="Register as a passenger to start booking rides."
      footer={
        <View style={styles.footerLinks}>
          <Text style={styles.footerText}>Already have an account?</Text>
          <AuthLink href="/(auth)/login" label="Sign In" />
        </View>
      }
    >
      <ErrorBanner message={formError} />

      <TextInputField
        label="Full Name"
        value={fullName}
        onChangeText={setFullName}
        error={fieldErrors.fullName}
        autoCapitalize="words"
        textContentType="name"
        autoComplete="name"
        placeholder="Juan Dela Cruz"
      />

      <TextInputField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        placeholder="you@example.com"
      />

      <TextInputField
        label="Mobile Number"
        value={mobileNumber}
        onChangeText={setMobileNumber}
        error={fieldErrors.mobileNumber}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        placeholder="09171234567"
      />

      <View>
        <TextInputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          secureTextEntry={!showPassword}
          textContentType="newPassword"
          autoComplete="password-new"
          placeholder="At least 8 characters"
        />
        <Pressable
          style={styles.showPassword}
          onPress={() => setShowPassword((current) => !current)}
        >
          <Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Password must include uppercase, lowercase, and a number.
      </Text>

      <TextInputField
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={fieldErrors.confirmPassword}
        secureTextEntry={!showPassword}
        textContentType="newPassword"
        autoComplete="password-new"
        placeholder="Re-enter your password"
      />

      <View style={styles.spacer} />

      <Button title="Create Account" loading={loading} onPress={handleRegister} />
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  showPassword: {
    position: 'absolute',
    right: spacing.md,
    top: 38,
    padding: spacing.xs,
  },
  showPasswordText: {
    ...typography.caption,
    color: colors.primary,
    fontWeight: '600',
  },
  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  spacer: {
    height: spacing.md,
  },
  footerLinks: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  footerText: {
    ...typography.body,
    color: colors.textSecondary,
  },
});
