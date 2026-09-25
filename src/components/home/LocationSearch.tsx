import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants/theme';
import {
  LocationSearchResult,
  LocationServiceError,
  searchLocations,
} from '@/services/locationService';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

/** Typing pauses this long before searching, so the geocoder is not hit on every key. */
const SEARCH_DEBOUNCE_MS = 600;
/** Search-as-you-type starts at this many characters; the keyboard's search key needs 2. */
const MIN_AUTO_SEARCH_LENGTH = 3;

interface LocationSearchProps {
  target: 'pickup' | 'destination';
  label: string;
  placeholder: string;
  onSelect: (result: LocationSearchResult) => void;
  /** Keeps the suggestion list within the visible map area (above the keyboard). */
  resultsMaxHeight?: number;
}

/**
 * Editable pickup/destination field for the floating map card. Suggestions appear below
 * the field while the passenger types; out-of-area places are listed, never filtered out.
 */
export function LocationSearch({
  target,
  label,
  placeholder,
  onSelect,
  resultsMaxHeight,
}: LocationSearchProps) {
  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<LocationSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState('');
  // Only the newest search may update the list; slower, older ones are ignored.
  const latestSearchId = useRef(0);

  async function runSearch(text: string) {
    const searchId = ++latestSearchId.current;
    setSearching(true);
    setMessage('');

    try {
      const found = await searchLocations(text);
      if (searchId !== latestSearchId.current) return;
      setResults(found);
      if (found.length === 0) {
        setMessage('No matching locations found. Try another search.');
      }
    } catch (error) {
      if (searchId !== latestSearchId.current) return;
      setResults([]);
      setMessage(
        error instanceof LocationServiceError
          ? error.message
          : 'Unable to search right now. Check your connection, or tap the map instead.',
      );
    } finally {
      if (searchId === latestSearchId.current) setSearching(false);
    }
  }

  useEffect(() => {
    const trimmed = searchText.trim();

    if (trimmed.length < MIN_AUTO_SEARCH_LENGTH) {
      // Drop any in-flight search and clear stale suggestions.
      latestSearchId.current += 1;
      setResults([]);
      setMessage('');
      setSearching(false);
      return;
    }

    const timer = setTimeout(() => runSearch(trimmed), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchText]);

  function handleSubmit() {
    const trimmed = searchText.trim();
    if (trimmed.length >= 2) runSearch(trimmed);
  }

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <View style={[styles.dot, target === 'destination' ? styles.dotDestination : null]} />
        <View style={styles.fieldContent}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            style={styles.input}
            value={searchText}
            onChangeText={setSearchText}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            returnKeyType="search"
            onSubmitEditing={handleSubmit}
            autoFocus
            autoCorrect={false}
            accessibilityLabel={`${label} search`}
          />
        </View>
        {searching ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : searchText ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search text"
            hitSlop={8}
            onPress={() => setSearchText('')}
          >
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </Pressable>
        ) : (
          <Ionicons name="search" size={18} color={colors.primary} />
        )}
      </View>

      {searching && results.length === 0 ? (
        <Text style={styles.message}>Searching...</Text>
      ) : null}

      {message ? <Text style={styles.message}>{message}</Text> : null}

      {results.length > 0 ? (
        <ScrollView
          style={resultsMaxHeight ? { maxHeight: resultsMaxHeight } : null}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          showsVerticalScrollIndicator={false}
        >
          {results.map((result) => {
            const [name, ...rest] = result.address.split(', ');
            return (
              <Pressable
                key={`${result.latitude},${result.longitude}`}
                accessibilityRole="button"
                accessibilityLabel={`Select ${result.address}`}
                style={({ pressed }) => [styles.result, pressed ? styles.resultPressed : null]}
                onPress={() => onSelect(result)}
              >
                <Ionicons
                  name="location-sharp"
                  size={18}
                  color={target === 'destination' ? colors.accent : colors.primary}
                  style={styles.resultIcon}
                />
                <View style={styles.resultText}>
                  <Text style={styles.resultName} numberOfLines={1}>
                    {name}
                  </Text>
                  {rest.length > 0 ? (
                    <Text style={styles.resultAddress} numberOfLines={1}>
                      {rest.join(', ')}
                    </Text>
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.resultTag,
                    result.withinServiceArea ? styles.resultTagLocal : styles.resultTagOutside,
                  ]}
                >
                  {result.withinServiceArea ? 'Trinidad' : 'Out-of-area'}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.xs,
  },
  // Matches the active compact LocationInput so the row reads as the same field.
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginRight: spacing.md,
  },
  dotDestination: {
    backgroundColor: colors.accent,
  },
  fieldContent: {
    flex: 1,
    marginRight: spacing.sm,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  input: {
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  message: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  resultPressed: {
    backgroundColor: colors.primaryLight,
  },
  resultIcon: {
    marginRight: spacing.sm,
  },
  resultText: {
    flex: 1,
    marginRight: spacing.sm,
  },
  resultName: {
    ...typography.label,
    color: colors.text,
  },
  resultAddress: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  resultTag: {
    ...typography.caption,
    fontSize: 11,
    fontWeight: '700',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 8,
    overflow: 'hidden',
  },
  resultTagLocal: {
    color: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  resultTagOutside: {
    color: colors.primaryDark,
    backgroundColor: colors.accent,
  },
});
