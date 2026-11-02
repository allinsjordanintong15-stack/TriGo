import { Button } from '@/components/ui/Button';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { LocationProblem, locationProblemMessage } from '@/utils/goOnlineLocation';
import { StyleSheet, Text, View } from 'react-native';

interface GoOnlineLocationCardProps {
  problem: LocationProblem;
  busy: boolean;
  onAction: () => void;
}

/**
 * Why the driver could not go online for lack of a position (permission, location
 * services off, no GPS fix), with the one action that fixes it. The driver stays offline.
 */
export function GoOnlineLocationCard({ problem, busy, onAction }: GoOnlineLocationCardProps) {
  const text = locationProblemMessage(problem);
  return (
    <View style={styles.container} accessibilityRole="alert">
      <Text style={styles.title}>{text.title}</Text>
      <Text style={styles.message}>{text.message}</Text>
      <Button title={text.actionLabel} variant="secondary" loading={busy} onPress={onAction} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.errorBackground,
    borderRadius: radius.md,
    padding: spacing.md,
    borderLeftWidth: 4,
    borderLeftColor: colors.error,
    gap: spacing.sm,
  },
  title: {
    ...typography.label,
    color: colors.error,
  },
  message: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
});
