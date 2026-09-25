import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { router } from 'expo-router';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function getInitials(fullName: string): string {
  return fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

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
          {passenger.profileImage ? (
            <Image source={{ uri: passenger.profileImage }} style={styles.photo} />
          ) : (
            <View style={styles.photoFallback}>
              <Text style={styles.photoInitials}>{getInitials(passenger.fullName)}</Text>
            </View>
          )}
          <Text style={styles.photoLabel}>Profile photo</Text>
          <Text style={styles.photoNote}>
            {passenger.profileImage
              ? 'Photo from your account.'
              : 'No profile photo yet. Uploading a photo is not available yet.'}
          </Text>
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
  photo: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  photoFallback: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  photoInitials: {
    ...typography.title,
    fontSize: 32,
    color: colors.primary,
  },
  photoLabel: {
    ...typography.label,
    color: colors.text,
    marginTop: spacing.sm,
  },
  photoNote: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: 2,
    textAlign: 'center',
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
