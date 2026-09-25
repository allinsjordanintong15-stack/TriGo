import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { getServiceAreaLabel } from '@/services/serviceAreaService';
import { Modal, StyleSheet, Text, View } from 'react-native';

interface OutOfAreaNoticeProps {
  visible: boolean;
  pickupAddress: string;
  destinationAddress: string;
  pickupOutside: boolean;
  destinationOutside: boolean;
  onContinue: () => void;
  onChangeLocation: () => void;
  loading?: boolean;
}

function describeOutsideStops(pickupOutside: boolean, destinationOutside: boolean): string {
  if (pickupOutside && destinationOutside) return 'pickup and destination are';
  if (pickupOutside) return 'pickup is';
  return 'destination is';
}

export function OutOfAreaNotice({
  visible,
  pickupAddress,
  destinationAddress,
  pickupOutside,
  destinationOutside,
  onContinue,
  onChangeLocation,
  loading = false,
}: OutOfAreaNoticeProps) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.badge}>Out-of-Area Trip</Text>

          <Text style={styles.message}>
            Your selected {describeOutsideStops(pickupOutside, destinationOutside)} outside the
            TriGo service area of {getServiceAreaLabel()}. You may continue by submitting an
            out-of-area trip request.
          </Text>

          <Text style={styles.note}>
            A verified driver must accept the request, and you and the driver agree on the fare
            before the booking is confirmed.
          </Text>

          <View style={styles.tripBox}>
            <Text style={styles.stopLabel}>
              Pickup{pickupOutside ? ' · outside service area' : ''}
            </Text>
            <Text style={styles.stopValue} numberOfLines={2}>
              {pickupAddress}
            </Text>
            <Text style={[styles.stopLabel, styles.stopLabelSpaced]}>
              Destination{destinationOutside ? ' · outside service area' : ''}
            </Text>
            <Text style={styles.stopValue} numberOfLines={2}>
              {destinationAddress}
            </Text>
          </View>

          <Button title="Continue" loading={loading} onPress={onContinue} />

          <View style={styles.spacer} />

          <Button title="Change Location" variant="secondary" onPress={onChangeLocation} />
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
  badge: {
    ...typography.title,
    fontSize: 20,
    color: colors.primaryDark,
    marginBottom: spacing.md,
  },
  message: {
    ...typography.subtitle,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  note: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  tripBox: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
  },
  stopLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  stopLabelSpaced: {
    marginTop: spacing.sm,
  },
  stopValue: {
    ...typography.body,
    color: colors.text,
  },
  spacer: {
    height: spacing.sm,
  },
});
