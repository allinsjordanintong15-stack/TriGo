import { Button } from '@/components/ui/Button';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { ComponentProps, ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface DriverStatusCardProps {
  icon: IconName;
  title: string;
  message: string;
  /** Short highlighted text beside the title, e.g. an expiry countdown. */
  badge?: string;
  /** 'attention' for states that need the driver (verification, a pending request). */
  tone?: 'default' | 'attention';
  actionTitle?: string;
  onAction?: () => void;
  actionLoading?: boolean;
  actionVariant?: 'primary' | 'secondary';
  /** Extra details between the message and the action, e.g. the request's route. */
  children?: ReactNode;
}

/** The driver's current state on Home, with at most one main action. */
export function DriverStatusCard({
  icon,
  title,
  message,
  badge,
  tone = 'default',
  actionTitle,
  onAction,
  actionLoading = false,
  actionVariant = 'primary',
  children,
}: DriverStatusCardProps) {
  return (
    <View style={[styles.card, tone === 'attention' ? styles.cardAttention : null]}>
      <View style={styles.header}>
        <View style={[styles.iconWrap, tone === 'attention' ? styles.iconWrapAttention : null]}>
          <Ionicons name={icon} size={22} color={colors.primary} />
        </View>
        <View style={styles.headerText}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>{title}</Text>
            {badge ? <Text style={styles.badge}>{badge}</Text> : null}
          </View>
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>

      {children ? <View style={styles.body}>{children}</View> : null}

      {actionTitle && onAction ? (
        <View style={styles.action}>
          <Button
            title={actionTitle}
            variant={actionVariant}
            loading={actionLoading}
            onPress={onAction}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  cardAttention: {
    borderLeftWidth: 4,
    borderLeftColor: colors.gold,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapAttention: {
    backgroundColor: colors.goldLight,
  },
  headerText: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  title: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
    flexShrink: 1,
  },
  badge: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.error,
    fontVariant: ['tabular-nums'],
  },
  message: {
    ...typography.body,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    lineHeight: 22,
  },
  body: {
    marginTop: spacing.md,
  },
  action: {
    marginTop: spacing.md,
  },
});
