import { ProfileMenuItem, ProfileMenuSection } from '@/components/profile/ProfileMenuItem';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { legalVersionLine, PRIVACY_CONTACT } from '@/constants/legal';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { legalConsentLine } from '@/utils/legalConsent';
import { router } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Profile → Privacy Policy & Terms (passengers and drivers): what the user agreed to and
 * when, both documents, and the privacy contact.
 */
export default function LegalOverviewScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  const mailto = `mailto:${PRIVACY_CONTACT.email}?subject=${encodeURIComponent('TriGo privacy')}`;

  return (
    <View style={styles.container}>
      <ScreenHeader title="Privacy & Terms" onBack={goBack} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.consent}>{legalConsentLine(profile?.legalConsent)}</Text>
          <Text style={styles.current}>Current: {legalVersionLine()}</Text>
        </View>

        <ProfileMenuSection title="Documents">
          <ProfileMenuItem
            icon="shield-checkmark-outline"
            label="Privacy Notice"
            description="What we collect, why, who sees it and your rights"
            onPress={() => router.push('/legal/privacy-notice')}
          />
          <ProfileMenuItem
            icon="document-text-outline"
            label="Terms of Use"
            description="The rules for using TriGo"
            onPress={() => router.push('/legal/terms')}
            last
          />
        </ProfileMenuSection>

        <Text style={styles.sectionTitle}>Privacy contact</Text>
        <View style={styles.card}>
          <Text style={styles.contactName}>{PRIVACY_CONTACT.name}</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`Email ${PRIVACY_CONTACT.name} at ${PRIVACY_CONTACT.email}`}
            hitSlop={8}
            onPress={() => {
              Linking.openURL(mailto).catch(() => undefined);
            }}
          >
            <Text style={styles.contactEmail}>{PRIVACY_CONTACT.email}</Text>
          </Pressable>
          <Text style={styles.hint}>
            For questions about your data, or to ask for a copy, a correction or deletion.
          </Text>
        </View>
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
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.xs,
  },
  consent: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  current: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  contactName: {
    ...typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  contactEmail: {
    ...typography.body,
    color: colors.primary,
    textDecorationLine: 'underline',
    minHeight: 24,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
});
