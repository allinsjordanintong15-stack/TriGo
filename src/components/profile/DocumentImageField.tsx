import { Ionicons } from '@expo/vector-icons';
import { Button } from '@/components/ui/Button';
import { colors, spacing, typography } from '@/constants/theme';
import { ApplicationDocumentImage, LocalDocumentImage } from '@/services/driverApplicationService';
import { validateDocumentImage } from '@/validations/driverApplication';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type PickSource = 'camera' | 'library';

interface DocumentImageFieldProps {
  label: string;
  description: string;
  /** Used for the default file name, e.g. "orCr" → "orCr.jpg". */
  fileNamePrefix: string;
  value: ApplicationDocumentImage | null;
  onChange: (value: ApplicationDocumentImage) => void;
  error?: string;
}

const PICKER_OPTIONS: ImagePicker.ImagePickerOptions = {
  mediaTypes: ['images'],
  quality: 0.7,
  allowsEditing: false,
  exif: false,
};

function imageUri(value: ApplicationDocumentImage): string {
  return value.kind === 'local' ? value.uri : value.document.downloadUrl;
}

function extensionFor(mimeType: string): string {
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/heic' || mimeType === 'image/heif') return 'heic';
  return 'jpg';
}

/**
 * Required document photo: take a photo or choose one from the device, confirm it in a
 * preview (Use / Retake), then view or replace it until the application is submitted.
 */
export function DocumentImageField({
  label,
  description,
  fileNamePrefix,
  value,
  onChange,
  error,
}: DocumentImageFieldProps) {
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<{ image: LocalDocumentImage; source: PickSource } | null>(
    null,
  );
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
      const mimeType = asset.mimeType ?? 'image/jpeg';
      const validationError = validateDocumentImage({ mimeType, fileSize: asset.fileSize });
      if (validationError) {
        setPickError(validationError);
        return;
      }

      setPending({
        source,
        image: {
          kind: 'local',
          uri: asset.uri,
          fileName: asset.fileName ?? `${fileNamePrefix}.${extensionFor(mimeType)}`,
          mimeType,
          fileSize: asset.fileSize ?? null,
        },
      });
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

      {value ? (
        <Pressable
          accessibilityRole="imagebutton"
          accessibilityLabel={`View ${label}`}
          onPress={() => setViewing(true)}
          style={styles.previewWrap}
        >
          <Image source={{ uri: imageUri(value) }} style={styles.preview} resizeMode="cover" />
          <View style={styles.previewBadge}>
            <Ionicons name="checkmark-circle" size={16} color={colors.white} />
            <Text style={styles.previewBadgeText}>
              {value.kind === 'uploaded' ? 'Previously submitted' : 'Added'} · Tap to view
            </Text>
          </View>
        </Pressable>
      ) : (
        <View style={[styles.placeholder, shownError ? styles.placeholderError : null]}>
          <Ionicons name="document-text-outline" size={32} color={colors.textMuted} />
          <Text style={styles.placeholderText}>No image added yet</Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
          onPress={() => pick('camera')}
        >
          <Ionicons name="camera-outline" size={18} color={colors.primary} />
          <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {value ? 'Retake Photo' : 'Take Photo'}
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed ? styles.actionPressed : null]}
          onPress={() => pick('library')}
        >
          <Ionicons name="images-outline" size={18} color={colors.primary} />
          <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
            {value ? 'Replace' : 'Choose from Device'}
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
          {value ? (
            <Image source={{ uri: imageUri(value) }} style={styles.viewerImage} resizeMode="contain" />
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
