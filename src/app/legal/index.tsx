import { DeletionRequestDialog } from '@/components/legal/DeletionRequestDialog';
import { ProfileMenuItem, ProfileMenuSection } from '@/components/profile/ProfileMenuItem';
import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { legalVersionLine, PRIVACY_CONTACT } from '@/constants/legal';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import {
  DeletionRequestError,
  loadDeletionContext,
  requestAccountDeletion,
  subscribeToDeletionRequest,
  withdrawDeletionRequest,
} from '@/services/deletionRequestService';
import { DeletionRequest } from '@/types';
import { DeletionContext } from '@/utils/accountDeletion';
import { formatDate } from '@/utils/dateTime';
import { legalConsentLine } from '@/utils/legalConsent';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/**
 * Profile → Privacy Policy & Terms (passengers and drivers): what the user agreed to and
 * when, both documents, and the privacy contact.
 */
export default function LegalOverviewScreen() {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const uid = profile?.uid ?? null;

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

        {uid ? <AccountDeletionSection uid={uid} /> : null}
      </ScrollView>
    </View>
  );
}

/** Profile → Privacy Policy & Terms → Request account deletion, its status and Withdraw. */
function AccountDeletionSection({ uid }: { uid: string }) {
  const { driverRecord } = useAuth();
  // undefined while loading; null when there is no request.
  const [request, setRequest] = useState<DeletionRequest | null | undefined>(undefined);
  const [loadError, setLoadError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [context, setContext] = useState<DeletionContext | 'error' | null>(null);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');

  useEffect(
    () =>
      subscribeToDeletionRequest(
        uid,
        (next) => {
          setRequest(next);
          setLoadError('');
        },
        () => setLoadError('Unable to load your deletion request. Please try again later.'),
      ),
    [uid],
  );

  function openDialog() {
    setDialogOpen(true);
    setSendError('');
    setContext(null);
    // Checked when the dialog opens, with the live driver record.
    loadDeletionContext(uid, driverRecord)
      .then(setContext)
      .catch(() => setContext('error'));
  }

  async function handleRequest(reason: string) {
    setSending(true);
    setSendError('');
    try {
      await requestAccountDeletion(uid, reason);
      setDialogOpen(false);
    } catch (error) {
      setSendError(
        error instanceof DeletionRequestError ? error.message : 'Unable to send your request. Please try again.',
      );
    } finally {
      setSending(false);
    }
  }

  async function handleWithdraw() {
    setWithdrawing(true);
    setWithdrawError('');
    try {
      await withdrawDeletionRequest(uid);
    } catch (error) {
      setWithdrawError(
        error instanceof DeletionRequestError ? error.message : 'Unable to withdraw your request. Please try again.',
      );
    } finally {
      setWithdrawing(false);
      setConfirmWithdraw(false);
    }
  }

  return (
    <>
      {/* The menu section brings its own title; the other states use the same heading. */}
      {request !== null ? <Text style={styles.sectionTitle}>Your account</Text> : null}
      {loadError ? <ErrorBanner message={loadError} /> : null}

      {request === undefined && !loadError ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : null}

      {request === null ? (
        <ProfileMenuSection title="Your account">
          <ProfileMenuItem
            icon="trash-outline"
            label="Request account deletion"
            description="Ask the TriGo team to delete your account and personal data"
            onPress={openDialog}
            last
          />
        </ProfileMenuSection>
      ) : null}

      {request?.status === 'pending' ? (
        <View style={styles.card}>
          <Text style={styles.consent}>Requested on {formatDate(request.requestedAt)}</Text>
          {request.reason ? <Text style={styles.hint}>Your reason: {request.reason}</Text> : null}
          <Text style={styles.hint}>
            The TriGo team will delete your account and personal data. You can withdraw the
            request until then.
          </Text>
          {withdrawError ? <ErrorBanner message={withdrawError} /> : null}
          <Button
            title="Withdraw request"
            variant="secondary"
            loading={withdrawing}
            onPress={() => setConfirmWithdraw(true)}
          />
        </View>
      ) : null}

      {request?.status === 'completed' ? (
        <View style={styles.card}>
          <Text style={styles.consent}>
            Deletion completed on {formatDate(request.completedAt)}
          </Text>
          <Text style={styles.hint}>
            Your personal details were removed. Your sign-in account is deleted by the TriGo team.
          </Text>
        </View>
      ) : null}

      {dialogOpen ? (
        <DeletionRequestDialog
          context={context}
          sending={sending}
          error={sendError}
          onConfirm={(reason) => void handleRequest(reason)}
          onCancel={() => setDialogOpen(false)}
        />
      ) : null}

      <ConfirmationDialog
        visible={confirmWithdraw}
        title="Withdraw your deletion request?"
        message="Your account stays as it is. You can ask again at any time."
        confirmLabel="Withdraw"
        cancelLabel="Keep request"
        loading={withdrawing}
        onConfirm={() => void handleWithdraw()}
        onCancel={() => setConfirmWithdraw(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginVertical: spacing.md,
  },
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
