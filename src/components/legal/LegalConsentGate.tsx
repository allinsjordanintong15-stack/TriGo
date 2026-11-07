import { LegalDocumentBody } from '@/components/legal/LegalDocumentBody';
import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { LegalDocument, legalVersionLine, PRIVACY_NOTICE, TERMS } from '@/constants/legal';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { logout } from '@/services/authService';
import { goOffline } from '@/services/driverService';
import { acceptCurrentLegalVersion } from '@/services/legalConsentService';
import { getFirebaseErrorMessage, logFirebaseError } from '@/utils/errors';
import { needsLegalConsent } from '@/utils/legalConsent';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Re-consent: any signed-in passenger or driver without the current legal version sees this
 * full-screen notice until they agree or sign out. It is a modal over the app, so the screen
 * underneath stays mounted: a driver on an active trip is back on the trip after agreeing.
 * Both documents open inside the notice (a pushed route would sit behind the modal).
 */
export function LegalConsentGate() {
  const { isAuthenticated, profile } = useAuth();
  // Set once the agreement is saved, so the notice closes even if reloading the profile
  // fails (a second "I agree" would be refused: the version's log entry already exists).
  const [acceptedUid, setAcceptedUid] = useState<string | null>(null);

  if (
    !isAuthenticated ||
    !profile ||
    acceptedUid === profile.uid ||
    !needsLegalConsent(profile.legalConsent)
  ) {
    return null;
  }

  // Keyed by uid so nothing carries over from another account's session.
  return (
    <ConsentNotice
      key={profile.uid}
      uid={profile.uid}
      hadConsent={profile.legalConsent !== null}
      onAccepted={() => setAcceptedUid(profile.uid)}
    />
  );
}

interface ConsentNoticeProps {
  uid: string;
  /** true: an older version was accepted (updated notice); false: never accepted. */
  hadConsent: boolean;
  onAccepted: () => void;
}

function ConsentNotice({ uid, hadConsent, onAccepted }: ConsentNoticeProps) {
  const insets = useSafeAreaInsets();
  const { refreshProfile, driverRecord } = useAuth();
  const [reading, setReading] = useState<LegalDocument | null>(null);
  const [busy, setBusy] = useState<'agree' | 'signout' | null>(null);
  const [error, setError] = useState('');

  async function handleAgree() {
    if (busy) return;
    setBusy('agree');
    setError('');
    try {
      await acceptCurrentLegalVersion(uid);
    } catch (agreeError) {
      logFirebaseError('LegalConsentGate: accept', agreeError);
      setError(getFirebaseErrorMessage(agreeError, 'Unable to save your agreement. Please try again.'));
      setBusy(null);
      return;
    }
    onAccepted();
    // Profile → Privacy Policy & Terms shows the new date once the profile reloads.
    refreshProfile().catch(() => undefined);
  }

  async function handleSignOut() {
    if (busy) return;
    setBusy('signout');
    setError('');
    try {
      // Same as Profile → Log Out for drivers: go off duty first, while the record can
      // still be written. A trip in progress is kept (goOffline leaves currentBookingId).
      if (driverRecord?.isOnline || driverRecord?.isAvailable) {
        await goOffline(driverRecord.driverId, driverRecord.currentRequestId).catch(() => undefined);
      }
      await logout();
      router.replace('/(auth)/login');
    } catch {
      setError('Unable to sign out. Please try again.');
      setBusy(null);
    }
  }

  return (
    <Modal
      visible
      animationType="slide"
      statusBarTranslucent
      // Android back: close the document being read; the notice itself cannot be dismissed.
      onRequestClose={() => setReading(null)}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {reading ? (
          <>
            <View style={styles.readerHeader}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Back to the notice"
                style={styles.back}
                hitSlop={4}
                onPress={() => setReading(null)}
              >
                <Ionicons name="chevron-back" color={colors.primary} size={26} />
              </Pressable>
              <Text style={styles.readerTitle} numberOfLines={1}>
                {reading.id === 'terms' ? 'Terms of Use' : 'Privacy Notice'}
              </Text>
              <View style={styles.back} />
            </View>
            <ScrollView
              contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
            >
              <LegalDocumentBody document={reading} />
            </ScrollView>
          </>
        ) : (
          <>
            <ScrollView contentContainerStyle={styles.content}>
              <Ionicons
                name="shield-checkmark-outline"
                size={48}
                color={colors.primary}
                style={styles.icon}
                importantForAccessibility="no"
              />
              <Text style={styles.title} accessibilityRole="header">
                {hadConsent ? 'We updated our Privacy Notice and Terms' : 'Privacy Notice and Terms'}
              </Text>
              <Text style={styles.body}>
                {hadConsent
                  ? 'Please read the new version and agree to keep using TriGo.'
                  : 'To keep using TriGo, please read and agree to how we handle your data and the rules for using the app.'}
              </Text>
              <Text style={styles.version}>{legalVersionLine()}</Text>

              <DocumentLink label="Read the Privacy Notice" onPress={() => setReading(PRIVACY_NOTICE)} />
              <DocumentLink label="Read the Terms of Use" onPress={() => setReading(TERMS)} />

              <Text style={styles.hint}>
                If you do not agree, you can sign out. To ask about your data or have your account
                deleted, use the privacy contact in the Privacy Notice.
              </Text>
            </ScrollView>

            <View style={[styles.actions, { paddingBottom: insets.bottom + spacing.md }]}>
              {error ? <ErrorBanner message={error} /> : null}
              <Button
                title="I agree"
                accessibilityLabel={`I agree to the Privacy Notice and Terms of Use, ${legalVersionLine()}`}
                loading={busy === 'agree'}
                disabled={busy !== null}
                onPress={() => void handleAgree()}
              />
              <Button
                title="Sign out"
                variant="secondary"
                loading={busy === 'signout'}
                disabled={busy !== null}
                onPress={() => void handleSignOut()}
              />
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

function DocumentLink({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [styles.link, pressed ? styles.linkPressed : null]}
      onPress={onPress}
    >
      <Text style={styles.linkText}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.primary} />
    </Pressable>
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
  icon: {
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    ...typography.title,
    fontSize: 24,
    color: colors.text,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: spacing.sm,
  },
  version: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
    marginBottom: spacing.lg,
  },
  link: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.sm,
  },
  linkPressed: {
    opacity: 0.8,
  },
  linkText: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primary,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: spacing.md,
  },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    gap: spacing.sm,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    backgroundColor: colors.background,
  },
  readerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
  },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerTitle: {
    ...typography.title,
    fontSize: 20,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
});
