import { Button } from '@/components/ui/Button';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { APP_NAME } from '@/constants';
import { colors, spacing, typography } from '@/constants/theme';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PermissionState = 'checking' | 'granted' | 'denied' | 'undetermined';

const PERMISSION_LABELS: Record<PermissionState, string> = {
  checking: 'Checking…',
  granted: 'Allowed',
  denied: 'Not allowed',
  undetermined: 'Not asked yet',
};

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useScreenBack();
  const [locationPermission, setLocationPermission] = useState<PermissionState>('checking');

  // Re-check when returning from the device settings app.
  useFocusEffect(
    useCallback(() => {
      let active = true;
      Location.getForegroundPermissionsAsync()
        .then(({ status }) => {
          if (!active) return;
          setLocationPermission(
            status === Location.PermissionStatus.GRANTED
              ? 'granted'
              : status === Location.PermissionStatus.DENIED
                ? 'denied'
                : 'undetermined',
          );
        })
        .catch(() => {
          if (active) setLocationPermission('undetermined');
        });
      return () => {
        active = false;
      };
    }, []),
  );

  const appVersion = Constants.expoConfig?.version ?? '—';

  return (
    <View style={styles.container}>
      <ScreenHeader title="Settings" onBack={goBack} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Location</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Location access</Text>
            <Text
              style={[
                styles.value,
                locationPermission === 'granted' ? styles.valueGood : null,
                locationPermission === 'denied' ? styles.valueBad : null,
              ]}
            >
              {PERMISSION_LABELS[locationPermission]}
            </Text>
          </View>
          <Text style={styles.help}>
            {APP_NAME} uses your location to suggest your pickup point and show your trip on the
            map. You can still choose locations manually by searching or tapping the map.
          </Text>
          <Button
            title="Open Device Settings"
            variant="secondary"
            onPress={() => {
              Linking.openSettings().catch(() => undefined);
            }}
          />
        </View>

        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>App</Text>
            <Text style={styles.value}>{APP_NAME}</Text>
          </View>
          <View style={[styles.rowBetween, styles.rowSpaced]}>
            <Text style={styles.label}>Version</Text>
            <Text style={styles.value}>{appVersion}</Text>
          </View>
          <View style={[styles.rowBetween, styles.rowSpaced]}>
            <Text style={styles.label}>Service area</Text>
            <Text style={styles.value}>Trinidad, Bohol</Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowSpaced: {
    marginTop: spacing.sm,
  },
  label: {
    ...typography.body,
    fontSize: 15,
    color: colors.text,
  },
  value: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  valueGood: {
    color: colors.primary,
  },
  valueBad: {
    color: colors.error,
  },
  help: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginVertical: spacing.sm,
  },
});
