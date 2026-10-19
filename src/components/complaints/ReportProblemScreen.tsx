import { LoadingScreen } from '@/components/LoadingScreen';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { TextInputField } from '@/components/ui/TextInputField';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useAuth } from '@/hooks/useAuth';
import { getBooking } from '@/services/bookingService';
import {
  COMPLAINT_CATEGORIES,
  COMPLAINT_CATEGORY_LABELS,
  COMPLAINT_MESSAGE_MAX_LENGTH,
  COMPLAINT_STATUS_LABELS,
  ComplaintCategory,
  ComplaintRole,
  ComplaintServiceError,
  getOwnComplaint,
  OwnComplaint,
  submitComplaint,
} from '@/services/complaintService';
import { Booking } from '@/types';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ReportProblemScreenProps {
  bookingId: string;
  /** Which side of the booking the signed-in user reports as. */
  role: ComplaintRole;
  onBack: () => void;
}

type Loaded =
  | { kind: 'loading' }
  | { kind: 'error' }
  | { kind: 'not_found' }
  | { kind: 'ready'; booking: Booking; complaint: OwnComplaint | null };

function formatDate(value: Date): string {
  return value.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** "Report a problem" for the signed-in passenger or driver on their own booking. */
export function ReportProblemScreen({ bookingId, role, onBack }: ReportProblemScreenProps) {
  const insets = useSafeAreaInsets();
  const { profile } = useAuth();
  const uid = profile?.uid ?? null;
  const [loaded, setLoaded] = useState<Loaded>({ kind: 'loading' });
  const [category, setCategory] = useState<ComplaintCategory | null>(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!uid || !bookingId) {
      setLoaded({ kind: 'not_found' });
      return;
    }
    setLoaded({ kind: 'loading' });
    try {
      const [booking, complaint] = await Promise.all([
        getBooking(bookingId),
        getOwnComplaint(bookingId, uid),
      ]);
      const isOwn =
        booking !== null &&
        (role === 'passenger' ? booking.passengerId === uid : booking.driverId === uid);
      setLoaded(isOwn ? { kind: 'ready', booking, complaint } : { kind: 'not_found' });
    } catch {
      setLoaded({ kind: 'error' });
    }
  }, [bookingId, role, uid]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSubmit() {
    if (!uid || !category) {
      setError('Please choose what the problem is about.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await submitComplaint(bookingId, uid, role, category, message);
      await load();
    } catch (submitError) {
      setError(
        submitError instanceof ComplaintServiceError
          ? submitError.message
          : 'Unable to send your report. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const header = <ScreenHeader title="Report a Problem" onBack={onBack} />;

  if (loaded.kind === 'loading') {
    return (
      <View style={styles.container}>
        {header}
        <LoadingScreen />
      </View>
    );
  }

  if (loaded.kind === 'not_found') {
    return (
      <View style={styles.container}>
        {header}
        <EmptyState
          icon="document-text-outline"
          title="Booking not found"
          message="You can only report a problem for your own booking."
        />
      </View>
    );
  }

  if (loaded.kind === 'error') {
    return (
      <View style={styles.container}>
        {header}
        <View style={styles.content}>
          <ErrorBanner message="Unable to load this booking. Check your connection and try again." />
          <Button title="Retry" variant="secondary" onPress={() => void load()} />
        </View>
      </View>
    );
  }

  const { booking, complaint } = loaded;
  const remaining = COMPLAINT_MESSAGE_MAX_LENGTH - message.length;

  return (
    <View style={styles.container}>
      {header}
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.card}>
          <Text style={styles.caption}>
            Booking {booking.bookingId.slice(-6).toUpperCase()} · {formatDate(booking.createdAt)}
          </Text>
          <Text style={styles.route} numberOfLines={2}>
            {booking.pickupLocation.address} → {booking.destination.address}
          </Text>
        </View>

        {complaint ? (
          <>
            <View style={styles.card}>
              <View style={styles.statusRow}>
                <Ionicons name="checkmark-circle" size={22} color={colors.primary} />
                <Text style={styles.statusTitle}>You reported a problem</Text>
              </View>
              <Text style={styles.statusLine}>
                Status: <Text style={styles.statusValue}>{COMPLAINT_STATUS_LABELS[complaint.status]}</Text>
              </Text>
              {complaint.category ? (
                <Text style={styles.statusLine}>
                  About: {COMPLAINT_CATEGORY_LABELS[complaint.category]}
                </Text>
              ) : null}
              {complaint.createdAt ? (
                <Text style={styles.statusLine}>Sent: {formatDate(complaint.createdAt)}</Text>
              ) : null}
              <Text style={styles.message}>{complaint.message}</Text>
            </View>
            <Text style={styles.note}>
              A TriGo administrator reviews every report. You can send one report per booking.
            </Text>
            <Button title="Done" onPress={onBack} />
          </>
        ) : (
          <>
            <Text style={styles.sectionTitle}>What is the problem about?</Text>
            <View style={styles.card} accessibilityRole="radiogroup">
              {COMPLAINT_CATEGORIES[role].map((option, index, all) => {
                const selected = category === option;
                return (
                  <Pressable
                    key={option}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected, disabled: submitting }}
                    disabled={submitting}
                    onPress={() => {
                      setCategory(option);
                      setError('');
                    }}
                    style={[styles.option, index === all.length - 1 ? styles.optionLast : null]}
                  >
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={20}
                      color={selected ? colors.primary : colors.textMuted}
                    />
                    <Text style={styles.optionLabel}>{COMPLAINT_CATEGORY_LABELS[option]}</Text>
                  </Pressable>
                );
              })}
            </View>

            <TextInputField
              label="Tell us what happened"
              value={message}
              onChangeText={setMessage}
              multiline
              maxLength={COMPLAINT_MESSAGE_MAX_LENGTH}
              autoCapitalize="sentences"
              autoCorrect
              editable={!submitting}
              placeholder="Describe the problem"
              style={styles.messageInput}
            />
            <Text style={styles.counter}>{remaining} characters left</Text>

            <ErrorBanner message={error} />

            <Button
              title="Send Report"
              loading={submitting}
              disabled={!category || !message.trim()}
              onPress={() => void handleSubmit()}
            />
            <Text style={styles.note}>
              A TriGo administrator will review your report. You can send one report per booking.
            </Text>
          </>
        )}
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
  },
  caption: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  route: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLast: {
    borderBottomWidth: 0,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text,
  },
  messageInput: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  counter: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  note: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginVertical: spacing.md,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusTitle: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
  },
  statusLine: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusValue: {
    fontWeight: '700',
    color: colors.primary,
  },
  message: {
    ...typography.body,
    color: colors.text,
    marginTop: spacing.sm,
  },
});
