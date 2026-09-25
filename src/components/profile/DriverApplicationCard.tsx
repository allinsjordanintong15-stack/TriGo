import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { DriverApplication } from '@/types';
import { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface DriverApplicationCardProps {
  application: DriverApplication | null;
  loading: boolean;
  /** Approved and the administrator has created the driver record. */
  driverModeReady: boolean;
  onApply: () => void;
  onViewApplication: () => void;
  onOpenDriverMode: () => void;
}

interface CardContent {
  icon: IconName;
  heading: string;
  badge: string | null;
  badgeTone: 'pending' | 'approved' | 'rejected' | null;
  message: string;
}

function getContent(application: DriverApplication | null, driverModeReady: boolean): CardContent {
  if (!application) {
    return {
      icon: 'car-outline',
      heading: 'Become a TriGo Driver',
      badge: null,
      badgeTone: null,
      message: 'Want to provide transportation services through TriGo?',
    };
  }

  switch (application.status) {
    case 'pending':
      return {
        icon: 'time-outline',
        heading: 'Driver Application',
        badge: 'Pending Verification',
        badgeTone: 'pending',
        message:
          'Your application has been submitted and is waiting for administrator verification.',
      };
    case 'approved':
      return {
        icon: 'shield-checkmark-outline',
        heading: 'TriGo Driver',
        badge: 'Verified Driver',
        badgeTone: 'approved',
        message: driverModeReady
          ? 'Your Driver application has been approved.'
          : 'Your Driver application has been approved. Your driver account is being set up by the TriGo administrator.',
      };
    case 'rejected':
      return {
        icon: 'close-circle-outline',
        heading: 'Driver Application',
        badge: 'Rejected',
        badgeTone: 'rejected',
        message: 'Your application was not approved.',
      };
  }
}

/** The Profile "Driver" section. Its content and action follow the application status. */
export function DriverApplicationCard({
  application,
  loading,
  driverModeReady,
  onApply,
  onViewApplication,
  onOpenDriverMode,
}: DriverApplicationCardProps) {
  if (loading) {
    return (
      <View style={[styles.card, styles.loadingCard]}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const content = getContent(application, driverModeReady);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.iconWrap}>
          <Ionicons name={content.icon} size={22} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.heading}>{content.heading}</Text>
          {content.badge ? (
            <Text
              style={[
                styles.badge,
                content.badgeTone === 'approved' ? styles.badgeApproved : null,
                content.badgeTone === 'pending' ? styles.badgePending : null,
                content.badgeTone === 'rejected' ? styles.badgeRejected : null,
              ]}
            >
              {content.badge}
            </Text>
          ) : null}
        </View>
      </View>

      <Text style={styles.message}>{content.message}</Text>

      {application?.status === 'rejected' && application.adminRemarks ? (
        <View style={styles.remarks}>
          <Text style={styles.remarksLabel}>Administrator remarks</Text>
          <Text style={styles.remarksText}>{application.adminRemarks}</Text>
        </View>
      ) : null}

      {!application ? (
        <Button title="Apply to Become a Driver" onPress={onApply} />
      ) : application.status === 'approved' ? (
        driverModeReady ? (
          <Button title="Open Driver Mode" onPress={onOpenDriverMode} />
        ) : (
          <Button title="View Application" variant="secondary" onPress={onViewApplication} />
        )
      ) : (
        <Button title="View Application" variant="secondary" onPress={onViewApplication} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    padding: spacing.md,
  },
  loadingCard: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  heading: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
  },
  badge: {
    ...typography.caption,
    fontWeight: '700',
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 4,
  },
  badgePending: {
    backgroundColor: colors.accent,
    color: colors.primaryDark,
  },
  badgeApproved: {
    backgroundColor: colors.primaryLight,
    color: colors.primary,
  },
  badgeRejected: {
    backgroundColor: colors.errorBackground,
    color: colors.error,
  },
  message: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  remarks: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  remarksLabel: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 2,
  },
  remarksText: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 18,
  },
});
