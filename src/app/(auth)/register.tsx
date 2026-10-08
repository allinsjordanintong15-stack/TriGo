import { AuthLink } from '@/components/auth/AuthLink';
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { PasswordField } from '@/components/auth/PasswordField';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TextInputField } from '@/components/ui/TextInputField';
import { useAuth } from '@/hooks/useAuth';
import { AuthServiceError, registerPassenger } from '@/services/authService';
import { colors, spacing, typography } from '@/constants/theme';
import { logFirebaseError } from '@/utils/errors';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
  // Blocks a second tap that lands before the loading state re-renders the button.
  const submitting = useRef(false);

  async function handleRegister() {
    if (submitting.current) return;
    submitting.current = true;
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
      router.replace('/home');
    } catch (error) {
      if (error instanceof AuthServiceError) {
        if (error.fieldErrors) {
          setFieldErrors(error.fieldErrors);
        }
        setFormError(error.message);
      } else {
        logFirebaseError('RegisterScreen', error);
        setFormError('Unable to create your account. Please try again.');
      }
    } finally {
      submitting.current = false;
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
        returnKeyType="next"
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
        returnKeyType="next"
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

      <PasswordField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        visible={showPassword}
        onToggleVisible={() => setShowPassword((current) => !current)}
        textContentType="newPassword"
        autoComplete="password-new"
        placeholder="At least 8 characters"
        returnKeyType="next"
      />

      <Text style={styles.hint}>
        Password must include uppercase, lowercase, and a number.
      </Text>

      {/* Follows the Password field's eye toggle. */}
      <PasswordField
        label="Confirm Password"
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        error={fieldErrors.confirmPassword}
        visible={showPassword}
        onToggleVisible={() => setShowPassword((current) => !current)}
        showToggle={false}
        textContentType="newPassword"
        autoComplete="password-new"
        placeholder="Re-enter your password"
        returnKeyType="go"
        onSubmitEditing={handleRegister}
      />

      <View style={styles.spacer} />

      <Button title="Create Account" loading={loading} onPress={handleRegister} />
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
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
