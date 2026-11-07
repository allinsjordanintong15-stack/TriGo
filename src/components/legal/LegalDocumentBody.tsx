import { legalVersionLine, LegalDocument } from '@/constants/legal';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { StyleSheet, Text, View } from 'react-native';

interface LegalDocumentBodyProps {
  document: LegalDocument;
}

/**
 * The full text of the Privacy Notice or the Terms of Use, from the shared legal module
 * (never copied). Used by the reader screen and by the re-consent notice; the caller
 * provides the scrolling container.
 */
export function LegalDocumentBody({ document }: LegalDocumentBodyProps) {
  return (
    <View>
      <Text style={styles.title} accessibilityRole="header">
        {document.title}
      </Text>
      <Text style={styles.version}>{legalVersionLine()}</Text>

      <View style={styles.summary}>
        <Text style={styles.summaryTitle}>In short</Text>
        {document.summary.map((line) => (
          <Bullet key={line} text={line} />
        ))}
      </View>

      {document.sections.map((section) => (
        <View key={section.id} style={styles.section}>
          <Text style={styles.heading} accessibilityRole="header">
            {section.heading}
          </Text>
          {section.blocks.map((block, index) =>
            block.kind === 'paragraph' ? (
              <Text key={index} style={styles.paragraph}>
                {block.text}
              </Text>
            ) : (
              <View key={index} style={styles.list}>
                {block.items.map((item) => (
                  <Bullet key={item} text={item} />
                ))}
              </View>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bullet} importantForAccessibility="no" accessibilityElementsHidden>
        •
      </Text>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.title,
    fontSize: 24,
    color: colors.text,
  },
  version: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.md,
  },
  summary: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
  },
  summaryTitle: {
    ...typography.body,
    fontWeight: '700',
    color: colors.primaryDark,
    marginBottom: spacing.xs,
  },
  section: {
    marginBottom: spacing.lg,
  },
  heading: {
    ...typography.body,
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  paragraph: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
  list: {
    marginBottom: spacing.sm,
  },
  bulletRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  bullet: {
    ...typography.body,
    color: colors.textSecondary,
    width: 16,
    lineHeight: 22,
  },
  bulletText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    flex: 1,
  },
});
