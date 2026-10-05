import { colors, spacing, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

interface RouteTimelineProps {
  pickupAddress: string;
  destinationAddress: string;
}

/** Pickup → destination as a vertical timeline: green dot, connecting line, gold pin. */
export function RouteTimeline({ pickupAddress, destinationAddress }: RouteTimelineProps) {
  return (
    <View>
      <View style={styles.row}>
        <View style={styles.markerColumn}>
          <View style={styles.pickupDot} />
          <View style={styles.line} />
        </View>
        <View style={styles.textColumn}>
          <Text style={styles.label}>Pickup</Text>
          <Text style={styles.address} numberOfLines={2}>
            {pickupAddress}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.markerColumn}>
          <Ionicons name="location" size={20} color={colors.gold} />
        </View>
        <View style={[styles.textColumn, styles.lastText]}>
          <Text style={styles.label}>Destination</Text>
          <Text style={styles.address} numberOfLines={2}>
            {destinationAddress}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  markerColumn: {
    width: 24,
    alignItems: 'center',
    paddingTop: 2,
  },
  pickupDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.primaryLight,
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: spacing.xs,
    backgroundColor: colors.border,
  },
  textColumn: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  lastText: {
    paddingBottom: 0,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  address: {
    ...typography.body,
    fontWeight: '600',
    color: colors.text,
    marginTop: 2,
  },
});
