import { Ionicons } from '@expo/vector-icons';
import { SupportContactsList } from '@/components/support/SupportContactsList';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Describes only features that exist in the app today, matching docs/DECISIONS.md.
const HELP_TOPICS: { question: string; answer: string }[] = [
  {
    question: 'How do I book a ride?',
    answer:
      'On Home, tap Pickup and Destination, then search for a place or tap the map. Choose a tricycle or motorcycle and tap Book a Ride. You can follow your booking on the status screen.',
  },
  {
    question: 'What is an out-of-area trip?',
    answer:
      'TriGo mainly serves Trinidad, Bohol. If your pickup or destination is outside Trinidad, tap Request Out-of-Area Ride to send a request to nearby drivers. A driver accepts it at the TriGo per-km fare, then you confirm that driver, or choose another, before the booking is made. The fare is final and is not negotiated. A request that is not confirmed in time expires.',
  },
  {
    question: 'How is the fare set?',
    answer:
      'Fares are set by TriGo: a base fare plus a per-km rate for your vehicle type, using the road distance of your trip. The fare is fixed: you pay the fare shown before you book. Out-of-area trips use the same per-km fare. Fixed barangay fares for trips between Poblacion and a barangay will apply once TriGo turns them on. If no road route can be found, the trip cannot be booked.',
  },
  {
    question: 'Can I cancel a ride?',
    answer:
      'Yes, until the trip starts. Open your booking (from Activity, tap the booking, then View live status) and tap Cancel Booking on the booking status screen. While an out-of-area request is still waiting for a driver, tap Cancel Request.',
  },
  {
    question: 'How do I become a TriGo driver?',
    answer:
      'Go to Profile → Driver and tap Apply to Become a Driver. Your application is reviewed by a TriGo administrator. You can use driver features only after your application is approved.',
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
        <SupportContactsList />
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
    borderRadius: radius.lg,
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
});
