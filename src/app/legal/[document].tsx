import { LegalDocumentBody } from '@/components/legal/LegalDocumentBody';
import { EmptyState } from '@/components/ui/EmptyState';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { PRIVACY_NOTICE, TERMS } from '@/constants/legal';
import { colors, spacing } from '@/constants/theme';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const DOCUMENTS = {
  'privacy-notice': PRIVACY_NOTICE,
  terms: TERMS,
} as const;

/**
 * In-app reader for the Privacy Notice (/legal/privacy-notice) and the Terms of Use
 * (/legal/terms). A root route, so it opens from registration (signed out) as well as from
 * Profile (passenger and driver).
 */
export default function LegalDocumentScreen() {
  const insets = useSafeAreaInsets();
  const { document: documentId } = useLocalSearchParams<{ document: string }>();
  const document = DOCUMENTS[documentId as keyof typeof DOCUMENTS];

  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }

  return (
    <View style={styles.container}>
      <ScreenHeader
        title={document?.id === 'terms' ? 'Terms of Use' : 'Privacy Notice'}
        onBack={goBack}
      />
      {document ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        >
          <LegalDocumentBody document={document} />
        </ScrollView>
      ) : (
        <EmptyState icon="document-text-outline" title="Document not found" />
      )}
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
});
