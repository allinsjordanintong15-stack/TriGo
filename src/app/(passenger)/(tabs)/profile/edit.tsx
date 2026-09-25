import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { TextInputField } from '@/components/ui/TextInputField';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { AuthServiceError, updatePassengerProfile } from '@/services/authService';
import { validateMobileNumber } from '@/validations/auth';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useScreenBack();
  const { passenger, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(passenger?.fullName ?? '');
  const [mobileNumber, setMobileNumber] = useState(passenger?.mobileNumber ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setError('');
    setFieldErrors({});

    const errors: Record<string, string> = {};
    if (!fullName.trim()) {
      errors.fullName = 'Full name is required.';
    }
    const mobileError = validateMobileNumber(mobileNumber);
    if (mobileError) {
      errors.mobileNumber = mobileError;
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    if (!passenger) return;

    setSaving(true);
    try {
      await updatePassengerProfile(passenger.uid, {
        fullName,
        mobileNumber,
      });
      await refreshProfile();
      goBack();
    } catch (err) {
      if (err instanceof AuthServiceError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors);
      }
      setError(
        err instanceof Error ? err.message : 'Unable to update your profile. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Edit Profile" onBack={goBack} />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ErrorBanner message={error} />

        <TextInputField
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          error={fieldErrors.fullName}
          autoCapitalize="words"
          textContentType="name"
          placeholder="Juan Dela Cruz"
        />

        <TextInputField
          label="Mobile Number"
          value={mobileNumber}
          onChangeText={setMobileNumber}
          error={fieldErrors.mobileNumber}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          placeholder="09171234567"
        />

        <View style={styles.spacer} />

        <Button title="Save Changes" loading={saving} onPress={handleSave} />
        <View style={styles.spacer} />
        <Text style={styles.note}>
          Your email and account role are managed securely and cannot be changed here.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  spacer: {
    height: spacing.md,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
