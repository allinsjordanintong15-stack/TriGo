import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { ReactNode, useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface TripChoiceOption<T extends string> {
  value: T;
  label: string;
}

interface TripChoiceDialogProps<T extends string> {
  visible: boolean;
  title: string;
  /** Content above the options, e.g. the final fare. */
  children?: ReactNode;
  options: readonly TripChoiceOption<T>[];
  confirmLabel: string;
  loading?: boolean;
  onConfirm: (value: T) => void;
  onCancel: () => void;
}

/** A confirmation dialog that requires picking one option (payment method, cancel reason). */
export function TripChoiceDialog<T extends string>({
  visible,
  title,
  children,
  options,
  confirmLabel,
  loading = false,
  onConfirm,
  onCancel,
}: TripChoiceDialogProps<T>) {
  const [selected, setSelected] = useState<T | null>(null);

  useEffect(() => {
    if (visible) setSelected(null);
  }, [visible]);

  if (!visible) {
    return null;
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={loading ? undefined : onCancel}>
        <Pressable style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {children}

          <View style={styles.options}>
            {options.map((option) => {
              const isSelected = option.value === selected;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  style={[styles.option, isSelected ? styles.optionSelected : null]}
                  onPress={() => setSelected(option.value)}
                  disabled={loading}
                >
                  <Ionicons
                    name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                    color={isSelected ? colors.primary : colors.textMuted}
                    size={20}
                  />
                  <Text style={styles.optionLabel}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Button title="Back" variant="secondary" onPress={onCancel} disabled={loading} />
            <View style={styles.actionSpacer} />
            <Button
              title={confirmLabel}
              onPress={() => selected && onConfirm(selected)}
              disabled={!selected}
              loading={loading}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15,61,38,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  card: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: spacing.lg,
  },
  title: {
    ...typography.title,
    fontSize: 20,
    color: colors.text,
    marginBottom: spacing.sm,
  },
  options: {
    marginVertical: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  optionLabel: {
    ...typography.body,
    color: colors.text,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionSpacer: {
    width: spacing.sm,
  },
});
