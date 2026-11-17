import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { DOCUMENT_PHOTO_HINT } from '@/constants/applicationDocuments';
import { colors, spacing, typography } from '@/constants/theme';
import {
  ApplicationDocumentError,
  ApplicationDocumentImage,
  prepareDocumentImage,
  PreparedDocumentImage,
} from '@/services/applicationDocumentService';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { ActivityIndicator, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PickSource = 'camera' | 'library';

interface DocumentImageFieldProps {
  label: string;
  description: string;
  value: ApplicationDocumentImage | null;
  onChange: (value: ApplicationDocumentImage) => void;
  error?: string;
}

// Full quality from the picker: the app compresses once, itself (applicationDocumentService).
const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 1,
  allowsEditing: false,
  exif: false,
};

function formatKilobytes(bytes: number): string {
  return `${Math.max(1, Math.round(bytes / 1000))} KB`;
}

/**
 * Required document photo: take a photo or choose one from the gallery. It is compressed
 * on the device right away (with a progress state), confirmed in a preview (Use / Retake),
 * and can be viewed or replaced until the application is submitted. Photos only.
 */
export function DocumentImageField({ label, description, value, onChange, error }: DocumentImageFieldProps) {
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<{ image: PreparedDocumentImage; source: PickSource } | null>(
    null,
  );
  const [preparing, setPreparing] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [pickError, setPickError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);

  async function pick(source: PickSource) {
    setPickError('');
    setPermissionDenied(false);

    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setPermissionDenied(true);
          setPickError('Camera access is needed to take a photo. You can allow it in Settings.');
          return;
        }
      }

      const result =
        source === 'camera'
          ? await ImagePicker.launchCameraAsync(PICKER_OPTIONS)
          : await ImagePicker.launchImageLibraryAsync(PICKER_OPTIONS);

      // Cancelling the camera or picker is not an error: keep the current image.
      if (result.canceled || !result.assets?.[0]) return;

      const asset = result.assets[0];
      setPreparing(true);
      try {
        const image = await prepareDocumentImage(asset);
        setPending({ source, image });
      } catch (prepareError) {
        setPickError(
          prepareError instanceof ApplicationDocumentError
            ? prepareError.message
            : 'This photo could not be read. Please take the photo again or choose another one.',
        );
      } finally {
        setPreparing(false);
      }
    } catch {
      setPickError(
        source === 'camera'
          ? 'Unable to open the camera on this device.'
          : 'Unable to open your photos. Please try again.',
      );
    }
  }

  function confirmPending() {
    if (!pending) return;
    onChange(pending.image);
    setPending(null);
  }

  async function retakeOrChooseAgain() {
    const source = pending?.source ?? 'camera';
    setPending(null);
    // Let the preview modal finish closing; iOS cannot present the camera mid-dismiss.
    await new Promise((resolve) => setTimeout(resolve, 450));
    await pick(source);
  }

  const shownError = pickError || error;

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} <Text style={styles.required}>*</Text>
      </Text>
      <Text style={styles.description}>{description}</Text>
      <Text style={styles.hint}>{DOCUMENT_PHOTO_HINT}</Text>

      {preparing ? (
        <View style={styles.placeholder} accessibilityLiveRegion="polite">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.placeholderText}>Preparing photo…</Text>
        </View>
      ) : value?.kind === 'stored' ? (
        // On file from an earlier submission: known from the application's reference only
        // (the photo is never downloaded to the phone). Kept unless retaken.
        <View style={styles.placeholder} accessibilityLabel={`${label}: previously submitted photo, kept`}>
          <Ionicons name="checkmark-circle" size={32} color={colors.primary} />
          <Text style={styles.placeholderText}>Previously submitted photo — kept</Text>
        </View>
      ) : value ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={`View ${label}`}
          onPress={() => setViewing(true)}
          style={styles.previewWrap}
        >
          <Image source={{ uri: value.uri }} style={styles.preview} resizeMode="cover" />
          <View style={styles.previewBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.white} />
            <Text style={styles.previewBadgeText}>
              Ready · {formatKilobytes(value.sizeBytes)} · Tap to view
            </Text>
          </View>
        </Pressable>
      ) : (
        <View style={[styles.placeholder, shownError ? styles.placeholderError : null]}>
          <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
          <Text style={styles.placeholderText}>No photo added yet</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
          onPress={() => pick('camera')}
          disabled={preparing}
        >
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
          <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {value ? 'Retake' : 'Take photo'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
          onPress={() => pick('library')}
          disabled={preparing}
        >
          <Ionicons name="images-outline" size={18} color={colors.primary} />
          <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {value ? 'Choose another' : 'Choose from gallery'}
          </Text>
        </Pressable>
      </View>

      {shownError ? <Text style={styles.error}>{shownError}</Text> : null}
      {permissionDenied ? (
        <Pressable onPress={() => Linking.openSettings().catch(() => undefined)} hitSlop={8}>
          <Text style={styles.settingsLink}>Open device settings</Text>
        </Pressable>
      ) : null}

      {/* Confirm step: nothing is saved to the application until the applicant confirms. */}
      <Modal visible={pending !== null} animationType="slide" onRequestClose={() => setPending(null)}>
        <View
          style={[
            styles.modal,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          <Text style={styles.modalTitle}>Check your {label}</Text>
          <Text style={styles.modalHint}>
            Make sure the whole document is visible, in focus and readable.
            {pending ? ` Compressed to ${formatKilobytes(pending.image.sizeBytes)}.` : ''}
          </Text>
          {pending ? (
            <Image
              source={{ uri: pending.image.uri }}
              style={styles.modalImage}
              resizeMode="contain"
            />
          ) : null}
          <Button
            title={pending?.source === 'camera' ? 'Use Photo' : 'Use Image'}
            onPress={confirmPending}
          />
          <View style={styles.spacer} />
          <Button
            title={pending?.source === 'camera' ? 'Retake' : 'Choose Another'}
            variant="secondary"
            onPress={retakeOrChooseAgain}
          />
          <Pressable onPress={() => setPending(null)} style={styles.cancel} hitSlop={8}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>
      </Modal>

      {/* Full-screen view of the confirmed image. */}
      <Modal visible={viewing} animationType="fade" onRequestClose={() => setViewing(false)}>
        <View
          style={[
            styles.viewer,
            { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.lg },
          ]}
        >
          {value?.kind === 'prepared' ? (
            <Image source={{ uri: value.uri }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}
          <Button title="Close" variant="secondary" onPress={() => setViewing(false)} />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  label: {
    ...typography.label,
    fontSize: 15,
    color: colors.text,
  },
  required: {
    color: colors.error,
  },
  description: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  hint: {
    ...typography.caption,
    color: colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
    marginTop: 2,
    marginBottom: spacing.sm,
  },
  previewWrap: {
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  preview: {
    width: '100%',
    height: 180,
    backgroundColor: colors.surface,
  },
  previewBadge: {
    position: 'absolute',
    left: spacing.sm,
    bottom: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,61,38,0.85)',
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  previewBadgeText: {
    ...typography.caption,
    fontSize: 12,
    color: colors.white,
    fontWeight: '600',
  },
  placeholder: {
    height: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  placeholderError: {
    borderColor: colors.error,
  },
  placeholderText: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: spacing.sm,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  actionPressed: {
    backgroundColor: colors.primaryLight,
  },
  actionText: {
    ...typography.caption,
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
    // Shrink within the button instead of wrapping or overflowing its border.
    flexShrink: 1,
  },
  error: {
    ...typography.caption,
    color: colors.error,
    marginTop: spacing.sm,
  },
  settingsLink: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
    marginTop: spacing.xs,
  },
  modal: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
  },
  modalTitle: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
  },
  modalHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  modalImage: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
    backgroundColor: colors.primaryDark,
    marginBottom: spacing.lg,
  },
  spacer: {
    height: spacing.sm,
  },
  cancel: {
    alignItems: 'center',
    marginTop: spacing.md,
  },
  cancelText: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  viewer: {
    flex: 1,
    backgroundColor: colors.primaryDark,
    paddingHorizontal: spacing.lg,
  },
  viewerImage: {
    flex: 1,
    width: '100%',
    marginBottom: spacing.lg,
  },
});
