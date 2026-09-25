import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants/theme';
import { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

type IconName = ComponentProps<typeof Ionicons>['name'];

interface ProfileMenuSectionProps {
  title: string;
  children: ReactNode;
}

/** A titled group of profile menu rows. */
export function ProfileMenuSection({ title, children }: ProfileMenuSectionProps) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

interface ProfileMenuItemProps {
  icon: IconName;
  label: string;
  description?: string;
  onPress: () => void;
  last?: boolean;
}

export function ProfileMenuItem({ icon, label, description, onPress, last }: ProfileMenuItemProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.item,
        last ? styles.itemLast : null,
        pressed ? styles.itemPressed : null,
      ]}
      onPress={onPress}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.description}>{description}</Text> : null}
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
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
  text: {
    flex: 1,
  },
  label: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
});
