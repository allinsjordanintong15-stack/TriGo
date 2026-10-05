import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function formatMemberSince(value: Date): string {
  return value.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
}

export default function PersonalInformationScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useScreenBack();
  const { passenger } = useAuth();

  if (!passenger) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Personal Information" onBack={goBack} />
        <EmptyState icon="person-outline" title="Profile unavailable" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScreenHeader title="Personal Information" onBack={goBack} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.photoSection}>
          <Avatar name={passenger.fullName} imageUri={passenger.profileImage} size={96} />
        </View>

        <View style={styles.card}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Full name</Text>
            <Text style={styles.fieldValue}>{passenger.fullName}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <Text style={styles.fieldValue}>{passenger.email}</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Mobile number</Text>
            <Text style={styles.fieldValue}>{passenger.mobileNumber || '—'}</Text>
          </View>
          <View style={[styles.field, styles.fieldLast]}>
            <Text style={styles.fieldLabel}>Member since</Text>
            <Text style={styles.fieldValue}>{formatMemberSince(passenger.createdAt)}</Text>
          </View>
        </View>

        <Text style={styles.note}>
          Your email address is used to sign in and cannot be changed here.
        </Text>

        <Button title="Edit Profile" onPress={() => router.push('/profile/edit')} />
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
  photoSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  field: {
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  fieldLast: {
    borderBottomWidth: 0,
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  fieldValue: {
    ...typography.body,
    color: colors.text,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.lg,
  },
});
