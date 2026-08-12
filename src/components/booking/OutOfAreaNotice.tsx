import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { Modal, StyleSheet, Text, View } from 'react-native';

interface OutOfAreaNoticeProps {
  visible: boolean;
  destinationAddress: string;
  onFindDrivers: () => void;
  onChangeDestination: () => void;
  loading?: boolean;
}

export function OutOfAreaNotice({
  visible,
  destinationAddress,
  onFindDrivers,
  onChangeDestination,
  loading = false,
}: OutOfAreaNoticeProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>Destination Outside TriGo Service Area</Text>

          <Text style={styles.message}>
            Your selected destination is outside the standard TriGo service area for Trinidad,
            Bohol. You may request an out-of-area trip from nearby available drivers. A driver
            must agree to the trip and fare before the booking is confirmed.
          </Text>

          <View style={styles.destinationBox}>
            <Text style={styles.destinationLabel}>Selected destination</Text>
            <Text style={styles.destinationValue} numberOfLines={3}>
              {destinationAddress}
            </Text>
          </View>

          <Button
            title="Find Available Drivers"
            loading={loading}
            onPress={onFindDrivers}
          />

          <View style={styles.spacer} />

          <Button title="Change Destination" variant="secondary" onPress={onChangeDestination} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  title: {
    ...typography.title,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.md,
  },
  message: {
    ...typography.subtitle,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  destinationBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  destinationLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  destinationValue: {
    ...typography.body,
    color: colors.text,
  },
  spacer: {
    height: spacing.sm,
  },
});
