import { colors, typography } from '@/constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';

interface AvatarProps {
  name: string;
  imageUri?: string | null;
  size?: number;
  /** Show a small camera badge at the bottom right (e.g. "change photo"). */
  badge?: boolean;
  /** Dim the avatar and show a spinner, e.g. while a new photo uploads. */
  loading?: boolean;
}

/** First letters of the first two words, e.g. "Juan Dela Cruz" → "JD". */
export function getInitials(fullName: string): string {
  const initials = fullName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
  return initials || '?';
}

/** Round profile photo, or the person's initials when there is no photo. */
export function Avatar({ name, imageUri = null, size = 48, badge = false, loading = false }: AvatarProps) {
  const circle = { width: size, height: size, borderRadius: size / 2 };
  const badgeSize = Math.max(22, Math.round(size * 0.3));

  return (
    <View style={circle}>
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={circle} />
      ) : (
        <View style={[circle, styles.fallback]}>
          <Text style={[styles.initials, { fontSize: Math.round(size * 0.36) }]}>
            {getInitials(name)}
          </Text>
        </View>
      )}

      {loading ? (
        <View style={[circle, styles.loadingOverlay]}>
          <ActivityIndicator color={colors.white} />
        </View>
      ) : null}

      {badge ? (
        <View
          style={[
            styles.badge,
            { width: badgeSize, height: badgeSize, borderRadius: badgeSize / 2 },
          ]}
        >
          <Ionicons name="camera" size={Math.round(badgeSize * 0.55)} color={colors.white} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    ...typography.title,
    color: colors.primary,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
