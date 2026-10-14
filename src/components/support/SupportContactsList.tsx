import { colors, radius, spacing, typography } from '@/constants/theme';
import { fetchActiveSupportContacts, SupportContact } from '@/services/supportContactService';
import { toTelUri } from '@/utils/phone';
import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

/**
 * Active TriGo support contacts (managed on the admin website), tap to call. Loads once on
 * mount and shows its own loading, error (with retry) and empty states. Used on the
 * passenger Help screen, the driver Profile and the driver's "access revoked" card.
 */
export function SupportContactsList() {
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

  if (contacts === null) {
    return <ActivityIndicator color={colors.primary} style={styles.loading} />;
  }

  if (contacts === 'error') {
    return (
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
    );
  }

  if (contacts.length === 0) {
    return (
      <View style={styles.notice}>
        <Ionicons name="information-circle-outline" size={20} color={colors.primaryDark} />
        <Text style={styles.noticeText}>
          No support contacts are available right now. Please check again later.
        </Text>
      </View>
    );
  }

  return (
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
              index === contacts.length - 1 ? styles.contactLast : null,
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
              <Text style={styles.label}>{contact.label}</Text>
              <Text style={styles.phone}>{contact.phone}</Text>
            </View>
            <View style={styles.callIcon}>
              <Ionicons name="call" size={18} color={colors.white} />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    marginVertical: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  contact: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  contactLast: {
    borderBottomWidth: 0,
  },
  pressed: {
    opacity: 0.7,
  },
  contactText: {
    flex: 1,
  },
  label: {
    ...typography.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
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
  noticeBody: {
    flex: 1,
    gap: spacing.xs,
  },
  noticeText: {
    ...typography.caption,
    color: colors.primaryDark,
    lineHeight: 18,
    flex: 1,
  },
  retry: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
});
