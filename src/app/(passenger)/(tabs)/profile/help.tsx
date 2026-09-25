import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { colors, spacing, typography } from '@/constants/theme';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Describes only features that exist in the app today.
const HELP_TOPICS: { question: string; answer: string }[] = [
  {
    question: 'How do I book a ride?',
    answer:
      'On Home, tap Pickup and Destination, then search for a place or tap the map. Choose a tricycle or motorcycle and tap Book a Ride. You can follow your booking on the status screen.',
  },
  {
    question: 'What is an out-of-area trip?',
    answer:
      'TriGo mainly serves Trinidad, Bohol. If your pickup or destination is outside Trinidad, you can still send an out-of-area trip request. A driver reviews it, and you and the driver agree on the fare before the booking is confirmed.',
  },
  {
    question: 'How is the fare estimated?',
    answer:
      'Trips within Trinidad use the standard TriGo estimate based on vehicle type and distance. The estimate is not a fixed fare. Out-of-area trips use the fare you agree on with the driver.',
  },
  {
    question: 'Can I cancel a ride?',
    answer:
      'Yes. While a ride is still pending or the driver has not started the trip, open the booking status or Ride History and tap Cancel Ride.',
  },
  {
    question: 'How do I become a TriGo driver?',
    answer:
      'Go to Profile → Driver and apply. Your application is reviewed by a TriGo administrator. You can use driver features only after your application is approved.',
  },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const goBack = useScreenBack();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <View style={styles.container}>
      <ScreenHeader title="Help & Support" onBack={goBack} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + spacing.xl }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Common questions</Text>
        <View style={styles.card}>
          {HELP_TOPICS.map((topic, index) => {
            const isOpen = openIndex === index;
            return (
              <Pressable
                key={topic.question}
                accessibilityRole="button"
                accessibilityState={{ expanded: isOpen }}
                style={[styles.topic, index === HELP_TOPICS.length - 1 ? styles.topicLast : null]}
                onPress={() => setOpenIndex(isOpen ? null : index)}
              >
                <View style={styles.topicHeader}>
                  <Text style={styles.question}>{topic.question}</Text>
                  <Ionicons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={colors.textMuted}
                  />
                </View>
                {isOpen ? <Text style={styles.answer}>{topic.answer}</Text> : null}
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionTitle}>Contact support</Text>
        <View style={styles.notice}>
          <Ionicons name="information-circle-outline" size={20} color={colors.primaryDark} />
          <Text style={styles.noticeText}>
            In-app support contact is not available yet. Official TriGo support channels will be
            added here.
          </Text>
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
    backgroundColor: colors.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  topic: {
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topicLast: {
    borderBottomWidth: 0,
  },
  topicHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  question: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
    marginRight: spacing.sm,
  },
  answer: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 19,
    marginTop: spacing.sm,
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: colors.primaryLight,
    borderLeftWidth: 4,
    borderLeftColor: colors.accent,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.sm,
  },
  noticeText: {
    ...typography.caption,
    color: colors.primaryDark,
    lineHeight: 18,
    flex: 1,
  },
});
