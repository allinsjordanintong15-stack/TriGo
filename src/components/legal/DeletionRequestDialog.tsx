import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TextInputField } from '@/components/ui/TextInputField';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { DeletionContext, DELETION_REASON_MAX_LENGTH, deletionNotes } from '@/utils/accountDeletion';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

interface DeletionRequestDialogProps {
  /** null while loading; 'error' when open items could not be checked. */
  context: DeletionContext | 'error' | null;
  sending: boolean;
  error: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

/**
 * Confirm an account deletion request, with an optional reason. Explains what happens and,
 * when something is still open (active trip, held request, unpaid commission), which
 * records are kept.
 */
export function DeletionRequestDialog({
  context,
  sending,
  error,
  onConfirm,
  onCancel,
}: DeletionRequestDialogProps) {
  const [reason, setReason] = useState('');
  const notes = context && context !== 'error' ? deletionNotes(context) : [];
  const tooLong = reason.trim().length > DELETION_REASON_MAX_LENGTH;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={sending ? () => undefined : onCancel}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title} accessibilityRole="header">
              Request account deletion?
            </Text>
            <Text style={styles.message}>
              The TriGo team removes your name, mobile number and other personal details (for
              drivers also your plate and vehicle details) and then deletes your sign-in account.
              Trip, commission and payment records are kept without your personal details. You
              can withdraw the request until it is completed.
            </Text>

            {context === null ? (
              <View style={styles.checking}>
                <ActivityIndicator color={colors.primary} />
                <Text style={styles.checkingText}>Checking for open trips and commission…</Text>
              </View>
            ) : null}
            {context === 'error' ? (
              <Text style={styles.note}>
                We could not check for open trips or unpaid commission. If you have any, their
                records are kept and the TriGo team may contact you before deleting your account.
              </Text>
            ) : null}
            {notes.map((note) => (
              <Text key={note} style={styles.note}>
                {note}
              </Text>
            ))}

            <TextInputField
              label="Reason (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="Tell us why, if you like"
              autoCapitalize="sentences"
              autoCorrect
              multiline
              maxLength={DELETION_REASON_MAX_LENGTH + 50}
              style={styles.reasonInput}
              editable={!sending}
              error={
                tooLong
                  ? `Please keep the reason to ${DELETION_REASON_MAX_LENGTH} characters or fewer.`
                  : undefined
              }
            />
            <Text style={styles.counter}>
              {reason.trim().length}/{DELETION_REASON_MAX_LENGTH}
            </Text>

            {error ? <ErrorBanner message={error} /> : null}

            <View style={styles.actions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={onCancel}
                disabled={sending}
                style={styles.actionButton}
              />
              <View style={styles.actionSpacer} />
              <Button
                title="Request deletion"
                onPress={() => onConfirm(reason)}
                loading={sending}
                disabled={tooLong || context === null}
                style={styles.destructiveButton}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  title: {
    ...typography.title,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  checking: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  checkingText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  note: {
    ...typography.caption,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
    backgroundColor: colors.goldLight,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  reasonInput: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  counter: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'right',
    marginTop: -spacing.sm,
    marginBottom: spacing.md,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionSpacer: {
    width: spacing.sm,
  },
  actionButton: {
    flex: 1,
    paddingHorizontal: spacing.md,
  },
  destructiveButton: {
    flex: 1,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.error,
  },
});
