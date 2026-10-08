import { colors, spacing, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

interface RouteTimelineProps {
  pickupAddress: string;
  destinationAddress: string;
  /** One line per address and no labels, for list cards. */
  compact?: boolean;
}

/** Pickup → destination as a vertical timeline: green dot, connecting line, gold pin. */
export function RouteTimeline({
  pickupAddress,
  destinationAddress,
  compact = false,
}: RouteTimelineProps) {
  const addressLines = compact ? 1 : 2;

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.markerColumn}>
          <View style={[styles.pickupDot, compact ? styles.pickupDotCompact : null]} />
          <View style={[styles.line, compact ? styles.lineCompact : null]} />
        </View>
        <View style={[styles.textColumn, compact ? styles.textColumnCompact : null]}>
          {!compact ? <Text style={styles.label}>Pickup</Text> : null}
          <Text
            style={[styles.address, compact ? styles.addressCompact : null]}
            numberOfLines={addressLines}
          >
            {pickupAddress}
          </Text>
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.markerColumn}>
          <Ionicons name="location" size={compact ? 16 : 20} color={colors.gold} />
        </View>
        <View style={[styles.textColumn, styles.lastText]}>
          {!compact ? <Text style={styles.label}>Destination</Text> : null}
          <Text
            style={[styles.address, compact ? styles.addressCompact : null]}
            numberOfLines={addressLines}
          >
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
  pickupDotCompact: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
  },
  line: {
    flex: 1,
    width: 2,
    marginVertical: spacing.xs,
    backgroundColor: colors.border,
  },
  lineCompact: {
    marginVertical: 2,
  },
  textColumn: {
    flex: 1,
    marginLeft: spacing.sm,
    paddingBottom: spacing.md,
  },
  textColumnCompact: {
    paddingBottom: spacing.sm,
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
  addressCompact: {
    ...typography.caption,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginTop: 0,
  },
});
