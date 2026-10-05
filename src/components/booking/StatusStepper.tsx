import { colors, spacing, typography } from '@/constants/theme';
import { formatStepTime, ProgressStep } from '@/utils/bookingStatus';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

interface StatusStepperProps {
  steps: ProgressStep[];
}

const CIRCLE_SIZE = 22;

/** Horizontal booking progress: filled steps reached, ringed current step, red cancelled step. */
export function StatusStepper({ steps }: StatusStepperProps) {
  return (
    <View style={styles.row}>
      {steps.map((step, index) => {
        const previous = steps[index - 1];
        const next = steps[index + 1];
        // A connector is green when the step it leads into has been reached.
        const leftReached = previous !== undefined && isReached(step);
        const rightReached = next !== undefined && isReached(next);
        const time = step.state === 'upcoming' ? null : formatStepTime(step.time);

        return (
          <View key={`${index}-${step.label}`} style={styles.step}>
            <View style={styles.track}>
              <View
                style={[
                  styles.connector,
                  previous === undefined ? styles.connectorHidden : null,
                  leftReached ? styles.connectorReached : null,
                ]}
              />
              <StepCircle step={step} />
              <View
                style={[
                  styles.connector,
                  next === undefined ? styles.connectorHidden : null,
                  rightReached ? styles.connectorReached : null,
                ]}
              />
            </View>
            <Text
              style={[
                styles.label,
                step.state === 'current' ? styles.labelCurrent : null,
                step.state === 'upcoming' ? styles.labelUpcoming : null,
                step.state === 'cancelled' ? styles.labelCancelled : null,
              ]}
              numberOfLines={2}
            >
              {step.label}
            </Text>
            {time ? (
              <Text style={[styles.time, step.state === 'cancelled' ? styles.labelCancelled : null]}>
                {time}
              </Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function isReached(step: ProgressStep): boolean {
  return step.state === 'done' || step.state === 'current';
}

function StepCircle({ step }: { step: ProgressStep }) {
  switch (step.state) {
    case 'done':
      return (
        <View style={[styles.circle, styles.circleDone]}>
          <Ionicons name="checkmark" size={14} color={colors.white} />
        </View>
      );
    case 'current':
      return (
        <View style={[styles.circle, styles.circleCurrent]}>
          <View style={styles.currentInner} />
        </View>
      );
    case 'cancelled':
      return (
        <View style={[styles.circle, styles.circleCancelled]}>
          <Ionicons name="close" size={14} color={colors.white} />
        </View>
      );
    default:
      return <View style={[styles.circle, styles.circleUpcoming]} />;
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  step: {
    flex: 1,
    alignItems: 'center',
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  connector: {
    flex: 1,
    height: 2,
    backgroundColor: colors.border,
  },
  connectorHidden: {
    backgroundColor: 'transparent',
  },
  connectorReached: {
    backgroundColor: colors.primary,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: {
    backgroundColor: colors.primary,
  },
  circleCurrent: {
    backgroundColor: colors.primaryLight,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  currentInner: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
  },
  circleCancelled: {
    backgroundColor: colors.error,
  },
  circleUpcoming: {
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.border,
  },
  label: {
    ...typography.caption,
    fontSize: 11,
    color: colors.text,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  labelCurrent: {
    color: colors.primary,
    fontWeight: '700',
  },
  labelUpcoming: {
    color: colors.textMuted,
  },
  labelCancelled: {
    color: colors.error,
    fontWeight: '700',
  },
  time: {
    ...typography.caption,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
