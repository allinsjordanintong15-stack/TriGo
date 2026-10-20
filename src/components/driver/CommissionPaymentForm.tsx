import { Button } from '@/components/ui/Button';
import { ConfirmationDialog } from '@/components/ui/ConfirmationDialog';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TextInputField } from '@/components/ui/TextInputField';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import {
  CommissionServiceError,
  formatGcashNumber,
  PaymentSettings,
  submitCommissionPayment,
} from '@/services/commissionService';
import {
  centavosToAmountText,
  centavosToPesos,
  normalizeGcashReference,
  parsePesoAmount,
  validateGcashReference,
  validatePaymentAmount,
} from '@/utils/commission';
import { formatPhilippinePeso } from '@/utils/fare';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

interface CommissionPaymentFormProps {
  driverId: string;
  /** Recorded − confirmed paid; the most a payment can be. */
  balanceCentavos: number;
  /** Prefilled amount: what is overdue, else the whole balance. */
  suggestedCentavos: number;
  /** Payments waiting for an admin, so the driver does not pay twice. */
  pendingCentavos: number;
  /** Undefined while loading; null when the admin has not set TriGo's GCash account. */
  paymentSettings: PaymentSettings | null | undefined;
  onSubmitted: () => void;
}

/**
 * Pay commission: TriGo's GCash account, then the amount and GCash reference number of a
 * payment the driver already sent. An admin checks it before it counts as paid.
 */
export function CommissionPaymentForm({
  driverId,
  balanceCentavos,
  suggestedCentavos,
  pendingCentavos,
  paymentSettings,
  onSubmitted,
}: CommissionPaymentFormProps) {
  const [amount, setAmount] = useState(() => centavosToAmountText(suggestedCentavos));
  const [reference, setReference] = useState('');
  const [amountError, setAmountError] = useState('');
  const [referenceError, setReferenceError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Follow the balance when it changes (e.g. after TriGo confirms a payment).
  useEffect(() => {
    setAmount(centavosToAmountText(suggestedCentavos));
  }, [suggestedCentavos]);

  function handleReview() {
    const nextAmountError = validatePaymentAmount(amount, balanceCentavos) ?? '';
    const nextReferenceError = validateGcashReference(reference) ?? '';
    setAmountError(nextAmountError);
    setReferenceError(nextReferenceError);
    setSuccess('');
    setError('');
    if (!nextAmountError && !nextReferenceError) setConfirming(true);
  }

  async function handleSubmit() {
    const centavos = parsePesoAmount(amount);
    if (centavos === null) return;
    setSubmitting(true);
    setError('');
    try {
      await submitCommissionPayment(driverId, centavos, reference);
      setConfirming(false);
      setReference('');
      setSuccess(
        `Payment of ${formatPhilippinePeso(centavosToPesos(centavos))} submitted. TriGo will check it and update your balance.`,
      );
      onSubmitted();
    } catch (err) {
      setConfirming(false);
      setError(
        err instanceof CommissionServiceError
          ? err.message
          : 'Unable to submit your payment. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const amountCentavos = parsePesoAmount(amount);
  const gcash = paymentSettings
    ? `${paymentSettings.gcashName} (${formatGcashNumber(paymentSettings.gcashNumber)})`
    : '';

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Pay commission</Text>

      {paymentSettings === undefined ? (
        <ActivityIndicator color={colors.primary} style={styles.loading} />
      ) : paymentSettings === null ? (
        <Text style={styles.message}>
          TriGo has not set up its GCash account yet. Please contact TriGo support to pay.
        </Text>
      ) : (
        <>
          <Text style={styles.message}>
            1. Send the amount by GCash to TriGo. 2. Enter the amount and the reference number
            from your GCash receipt below.
          </Text>
          <View style={styles.gcashBox}>
            <Text style={styles.gcashLabel}>GCash name</Text>
            <Text style={styles.gcashValue} selectable>
              {paymentSettings.gcashName}
            </Text>
            <Text style={[styles.gcashLabel, styles.gcashLabelSpaced]}>GCash number</Text>
            <Text style={[styles.gcashValue, styles.gcashNumber]} selectable>
              {formatGcashNumber(paymentSettings.gcashNumber)}
            </Text>
          </View>

          {pendingCentavos > 0 ? (
            <Text style={styles.pending}>
              {formatPhilippinePeso(centavosToPesos(pendingCentavos))} you reported is waiting
              for TriGo to check it. Do not pay it again.
            </Text>
          ) : null}

          <TextInputField
            label={`Amount (₱1.00 to ${formatPhilippinePeso(centavosToPesos(balanceCentavos))})`}
            value={amount}
            onChangeText={(text) => {
              setAmount(text);
              setAmountError('');
            }}
            keyboardType="decimal-pad"
            error={amountError}
            editable={!submitting}
          />
          <TextInputField
            label="GCash reference number"
            value={reference}
            onChangeText={(text) => {
              setReference(text);
              setReferenceError('');
            }}
            keyboardType="number-pad"
            placeholder="e.g. 1234567890123"
            maxLength={24}
            error={referenceError}
            editable={!submitting}
          />

          <ErrorBanner message={error} />
          {success ? <Text style={styles.success}>{success}</Text> : null}

          <Button title="Submit payment" onPress={handleReview} loading={submitting} />
        </>
      )}

      <ConfirmationDialog
        visible={confirming}
        title="Submit this payment?"
        message={`Amount: ${
          amountCentavos !== null ? formatPhilippinePeso(centavosToPesos(amountCentavos)) : ''
        }\nGCash reference: ${normalizeGcashReference(reference)}\nSent to: ${gcash}\n\nSubmit only after you sent the money in GCash. TriGo checks every payment before it counts as paid.`}
        confirmLabel="Submit payment"
        loading={submitting}
        onConfirm={handleSubmit}
        onCancel={() => setConfirming(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.sm,
    ...shadow.card,
  },
  title: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
  },
  message: {
    ...typography.body,
    color: colors.text,
  },
  gcashBox: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  gcashLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  gcashLabelSpaced: {
    marginTop: spacing.sm,
  },
  gcashValue: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
  },
  gcashNumber: {
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  pending: {
    ...typography.caption,
    color: colors.primaryDark,
    backgroundColor: colors.goldLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  success: {
    ...typography.body,
    color: colors.primary,
  },
  loading: {
    alignSelf: 'flex-start',
  },
});
