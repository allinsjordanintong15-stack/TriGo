import { Ionicons } from '@expo/vector-icons';
import { ScreenHeader, useScreenBack } from '@/components/ui/ScreenHeader';
import { colors, radius, spacing, typography } from '@/constants/theme';
import { fetchActiveSupportContacts, SupportContact } from '@/services/supportContactService';
import { toTelUri } from '@/utils/phone';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
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
    question: 'How is the fare set?',
    answer:
      'Trips within Trinidad use the standard TriGo fare, based on vehicle type and road distance. It is fixed: you pay the fare shown before you book. Out-of-area trips use the fare you agree on with the driver.',
  },
  {
    question: 'Can I cancel a ride?',
    answer:
      'Yes, until the trip starts. Open your booking (from Activity, tap the booking, then View live status) and tap Cancel Booking on the booking status screen.',
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
  // null while loading; 'error' when the contacts could not be loaded.
  const [contacts, setContacts] = useState<SupportContact[] | 'error' | null>(null);

  const loadContacts = useCallback(() => {
    let active = true;
    setContacts(null);
    fetchActiveSupportContacts()
      .then((result) => {
        if (active) setContacts(result);
      })
      .catch(() => {
        if (active) setContacts('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => loadContacts(), [loadContacts]);

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
        {contacts === null ? (
          <ActivityIndicator color={colors.primary} style={styles.loading} />
        ) : contacts === 'error' ? (
          <View style={styles.notice}>
            <Ionicons name="cloud-offline-outline" size={20} color={colors.primaryDark} />
            <View style={styles.noticeBody}>
              <Text style={styles.noticeText}>
                Support contacts could not be loaded. Check your internet connection.
              </Text>
              <Pressable accessibilityRole="button" onPress={loadContacts} hitSlop={8}>
                <Text style={styles.retry}>Try again</Text>
              </Pressable>
            </View>
          </View>
        ) : contacts.length === 0 ? (
          <View style={styles.notice}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primaryDark} />
            <Text style={styles.noticeText}>
              No support contacts are available right now. Please check again later.
            </Text>
          </View>
        ) : (
          <View style={styles.card}>
            {contacts.map((contact, index) => {
              const telUri = toTelUri(contact.phone);
              return (
                <Pressable
                  key={contact.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${contact.label}, ${contact.phone}`}
                  disabled={!telUri}
                  style={({ pressed }) => [
                    styles.contact,
                    index === contacts.length - 1 ? styles.topicLast : null,
                    pressed ? styles.pressed : null,
                  ]}
                  onPress={() => {
                    if (!telUri) return;
                    Linking.openURL(telUri).catch(() => {
                      // No dialer available (e.g. a tablet); nothing else to do.
                    });
                  }}
                >
                  <View style={styles.contactText}>
                    <Text style={styles.question}>{contact.label}</Text>
                    <Text style={styles.phone}>{contact.phone}</Text>
                  </View>
                  <View style={styles.callIcon}>
                    <Ionicons name="call" size={18} color={colors.white} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
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
  noticeBody: {
    flex: 1,
    gap: spacing.xs,
  },
  retry: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  loading: {
    marginVertical: spacing.md,
  },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  contactText: {
    flex: 1,
  },
  phone: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  callIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
