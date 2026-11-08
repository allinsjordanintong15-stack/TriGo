import { Ionicons } from '@expo/vector-icons';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface ProfileMenuSectionProps {
  /** Optional: a section without a title (e.g. Log out) shows only the card. */
  title?: string;
  /** Optional small muted note under the card. */
  footer?: string;
  children: ReactNode;
}

/** A titled group of profile menu rows. */
export function ProfileMenuSection({ title, footer, children }: ProfileMenuSectionProps) {
  return (
    <View style={styles.section}>
      {title ? (
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.sectionCard}>{children}</View>
      {footer ? <Text style={styles.footer}>{footer}</Text> : null}
    </View>
  );
}

export type ProfileMenuPillTone = 'on' | 'off';

interface ProfileMenuItemProps {
  icon: IconName;
  label: string;
  description?: string;
  /**
   * Display-only rows: a value under the label (e.g. an email), shown in body text and
   * wrapping when long. The label is then shown small, as a field name.
   */
  value?: string;
  /** Short status pill at the right, e.g. On / Off. */
  pill?: { label: string; tone: ProfileMenuPillTone };
  /** Omit for a display-only row: no press feedback, no chevron. */
  onPress?: () => void;
  /** Defaults to true when the row has onPress, false otherwise. */
  showChevron?: boolean;
  /** Red label and icon, e.g. Log out. */
  destructive?: boolean;
  /** Shows a spinner instead of the chevron and ignores presses. */
  loading?: boolean;
  disabled?: boolean;
  last?: boolean;
}

export function ProfileMenuItem({
  icon,
  label,
  description,
  value,
  pill,
  onPress,
  showChevron,
  destructive = false,
  loading = false,
  disabled = false,
  last,
}: ProfileMenuItemProps) {
  const pressable = onPress !== undefined;
  const chevron = showChevron ?? pressable;
  const iconColor = destructive ? colors.error : colors.primary;

  const content = (
    <>
      <View style={[styles.iconWrap, destructive ? styles.iconWrapDestructive : null]}>
        <Ionicons name={icon} size={20} color={iconColor} />
      </View>
      <View style={styles.text}>
        {value !== undefined ? (
          <>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={styles.value}>{value}</Text>
          </>
        ) : (
          <Text style={[styles.label, destructive ? styles.labelDestructive : null]}>{label}</Text>
        )}
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      {pill ? (
        <View style={[styles.pill, pill.tone === 'on' ? styles.pillOn : styles.pillOff]}>
          <Text style={[styles.pillText, pill.tone === 'on' ? styles.pillTextOn : null]}>
            {pill.label}
          </Text>
        </View>
      ) : null}
      {loading ? (
        <ActivityIndicator color={iconColor} />
      ) : chevron ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </>
  );

  if (!pressable) {
    return (
      <View
        accessible
        accessibilityLabel={[label, value, pill?.label, description].filter(Boolean).join(', ')}
        style={[styles.item, last ? styles.itemLast : null]}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={pill ? `${label}, ${pill.label}` : label}
      accessibilityState={loading || disabled ? { disabled: true, busy: loading } : undefined}
      disabled={loading || disabled}
      style={({ pressed }) => [
        styles.item,
        last ? styles.itemLast : null,
        pressed ? styles.itemPressed : null,
      ]}
      onPress={onPress}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: spacing.lg,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  sectionCard: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  footer: {
    ...typography.caption,
    color: colors.textMuted,
    lineHeight: 18,
    marginTop: spacing.sm,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  itemLast: {
    borderBottomWidth: 0,
  },
  itemPressed: {
    backgroundColor: colors.primaryLight,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  iconWrapDestructive: {
    backgroundColor: colors.errorBackground,
  },
  text: {
    flex: 1,
  },
  label: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
  },
  labelDestructive: {
    color: colors.error,
    fontWeight: '600',
  },
  fieldLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  value: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
    marginTop: 2,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  pill: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    marginLeft: spacing.sm,
    marginRight: spacing.xs,
  },
  pillOn: {
    backgroundColor: colors.primaryLight,
  },
  pillOff: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  pillTextOn: {
    color: colors.primary,
  },
});
