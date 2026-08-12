import { AuthLink } from '@/components/auth/AuthLink';
import { AuthScreenLayout } from '@/components/auth/AuthScreenLayout';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TextInputField } from '@/components/ui/TextInputField';
import { AuthServiceError, sendPasswordReset } from '@/services/authService';
import { colors, spacing, typography } from '@/constants/theme';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { validateEmail } from '@/validations/auth';

export default function ForgotPasswordScreen() {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleResetPassword() {
    setFormError('');
    setFieldError('');
    setSuccessMessage('');

    const emailValidation = validateEmail(email);
    if (emailValidation) {
      setFieldError(emailValidation);
      return;
    }

    setLoading(true);

    try {
      await sendPasswordReset(email);
      setSuccessMessage(
        'If an account exists for this email, a password reset link has been sent. Please check your inbox.',
      );
    } catch (error) {
      if (error instanceof AuthServiceError) {
        setFormError(error.message);
      } else {
        setFormError('Unable to send reset email. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthScreenLayout
      title="Forgot password?"
      subtitle="Enter your email and we will send you a link to reset your password."
      footer={<AuthLink href="/(auth)/login" label="Back to Login" />}
    >
      {successMessage ? (
        <View style={styles.successBanner}>
          <Text style={styles.successText}>{successMessage}</Text>
        </View>
      ) : null}

      <ErrorBanner message={formError} />

      <TextInputField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldError}
        keyboardType="email-address"
        textContentType="emailAddress"
        autoComplete="email"
        placeholder="you@example.com"
        editable={!successMessage}
      />

      <View style={styles.spacer} />

      <Button
        title={successMessage ? 'Email Sent' : 'Send Reset Link'}
        loading={loading}
        disabled={Boolean(successMessage)}
        onPress={handleResetPassword}
      />
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  successBanner: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
  },
  successText: {
    ...typography.caption,
    color: colors.primaryDark,
    lineHeight: 18,
  },
  spacer: {
    height: spacing.lg,
  },
});
