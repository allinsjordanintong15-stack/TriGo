import { AuthLink } from '@/components/auth/AuthLink';
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TextInputField } from '@/components/ui/TextInputField';
import { useAuth } from '@/hooks/useAuth';
import { AuthServiceError, loginUser } from '@/services/authService';
import { colors, spacing, typography } from '@/constants/theme';
import { logFirebaseError } from '@/utils/errors';
import { getRoleHomeHref } from '@/utils/roleRoutes';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

export default function LoginScreen() {
  const { refreshProfile } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setFormError('');
    setFieldErrors({});
    setLoading(true);

    try {
      const profile = await loginUser({ email, password });
      await refreshProfile();
      router.replace(getRoleHomeHref(profile.role));
    } catch (error) {
      if (error instanceof AuthServiceError) {
        if (error.fieldErrors) {
          setFieldErrors(error.fieldErrors);
        }
        setFormError(error.message);
      } else {
        logFirebaseError('LoginScreen', error);
        setFormError('Unable to log in. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenLayout
      title="Welcome back"
      subtitle="Sign in to book your ride in Trinidad, Bohol."
      footer={
        <View style={styles.footerLinks}>
          <Text style={styles.footerText}>Don&apos;t have an account?</Text>
          <AuthLink href="/(auth)/register" label="Create Account" />
        </View>
      }
    >
      <ErrorBanner message={formError} />

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

      <View>
        <TextInputField
          label="Password"
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          secureTextEntry={!showPassword}
          textContentType="password"
          autoComplete="password"
          placeholder="Enter your password"
        />
        <Pressable
          style={styles.showPassword}
          onPress={() => setShowPassword((current) => !current)}
        >
          <Text style={styles.showPasswordText}>{showPassword ? 'Hide' : 'Show'}</Text>
        </Pressable>
      </View>

      <View style={styles.forgotPasswordRow}>
        <AuthLink href="/(auth)/forgot-password" label="Forgot Password?" />
      </View>

      <View style={styles.spacer} />

      <Button title="Login" loading={loading} onPress={handleLogin} />
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
  forgotPasswordRow: {
    alignItems: 'flex-end',
    marginBottom: spacing.sm,
  },
  spacer: {
    height: spacing.lg,
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
