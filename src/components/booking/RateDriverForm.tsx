import { Button } from '@/components/ui/Button';
import { ErrorBanner } from '@/components/ui/ErrorBanner';
import { TextInputField } from '@/components/ui/TextInputField';
import { RATING_COMMENT_MAX_LENGTH, type RatingTagId } from '@/constants/rating';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { RatingServiceError, submitRating } from '@/services/ratingService';
import { Booking, Rating } from '@/types';
import { keepTagsForStars, ratingTagLabels, tagsForStars, validateRating } from '@/utils/rating';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const STAR_WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

interface RateDriverFormProps {
  booking: Booking;
  passengerId: string;
  /** Called with the saved rating (shown as "Thanks for your rating"). */
  onRated: (rating: Rating) => void;
  /** Shown as a secondary button when given (Trip completed screen). */
  onSkip?: () => void;
}

/** Stars, quick tags and an optional comment for the driver of a completed trip. */
export function RateDriverForm({ booking, passengerId, onRated, onSkip }: RateDriverFormProps) {
  const [stars, setStars] = useState<number | null>(null);
  const [tags, setTags] = useState<RatingTagId[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function pickStars(value: number) {
    setStars(value);
    setTags((current) => keepTagsForStars(current, value));
    setError('');
  }

  function toggleTag(tag: RatingTagId) {
    setTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  async function handleSubmit() {
    const invalid = validateRating(stars, comment);
    if (invalid || stars === null) {
      setError(invalid ?? 'Choose 1 to 5 stars.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      onRated(await submitRating(booking, passengerId, { stars, tags, comment }));
    } catch (err) {
      setError(
        err instanceof RatingServiceError ? err.message : 'Unable to send your rating. Please try again.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const offeredTags = tagsForStars(stars);

  return (
    <View style={styles.card}>
      <Text style={styles.title} accessibilityRole="header">
        Rate your driver
      </Text>

      <View style={styles.stars} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((value) => {
          const filled = stars !== null && value <= stars;
          return (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected: stars === value }}
              accessibilityLabel={`${value} star${value === 1 ? '' : 's'}, ${STAR_WORDS[value]}`}
              onPress={() => pickStars(value)}
              disabled={submitting}
              hitSlop={4}
              style={styles.starButton}
            >
              <Ionicons
                name={filled ? 'star' : 'star-outline'}
                size={36}
                color={filled ? colors.gold : colors.textMuted}
              />
            </Pressable>
          );
        })}
      </View>
      <Text style={styles.starWord}>{stars ? STAR_WORDS[stars] : 'Tap a star to rate'}</Text>

      {offeredTags.length > 0 ? (
        <View style={styles.tags}>
          {offeredTags.map((tag) => {
            const selected = tags.includes(tag.id);
            return (
              <Pressable
                key={tag.id}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: selected }}
                onPress={() => toggleTag(tag.id)}
                disabled={submitting}
                style={[styles.tag, selected ? styles.tagSelected : null]}
              >
                <Text style={[styles.tagText, selected ? styles.tagTextSelected : null]}>
                  {tag.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {stars !== null ? (
        <TextInputField
          label={`Comment (optional, up to ${RATING_COMMENT_MAX_LENGTH} characters)`}
          value={comment}
          onChangeText={setComment}
          maxLength={RATING_COMMENT_MAX_LENGTH}
          multiline
          autoCapitalize="sentences"
          autoCorrect
          editable={!submitting}
          placeholder="Anything you want to tell TriGo about this trip"
          style={styles.comment}
        />
      ) : null}

      <ErrorBanner message={error} />

      <Button
        title="Submit rating"
        onPress={() => void handleSubmit()}
        loading={submitting}
        disabled={stars === null}
      />
      {onSkip ? (
        <Button title="Skip" variant="secondary" onPress={onSkip} disabled={submitting} />
      ) : null}
    </View>
  );
}

/** A saved rating: stars, tags and comment (Activity detail, Trip completed). */
export function GivenRating({ rating }: { rating: Rating }) {
  const tagLabels = ratingTagLabels(rating.tags);
  return (
    <View style={styles.card} accessible accessibilityLabel={`You rated ${rating.stars} of 5 stars`}>
      <Text style={styles.title}>Your rating</Text>
      <View style={styles.givenStars}>
        {[1, 2, 3, 4, 5].map((value) => (
          <Ionicons
            key={value}
            name={value <= rating.stars ? 'star' : 'star-outline'}
            size={22}
            color={value <= rating.stars ? colors.gold : colors.textMuted}
          />
        ))}
      </View>
      {tagLabels.length > 0 ? <Text style={styles.givenTags}>{tagLabels.join(' · ')}</Text> : null}
      {rating.comment ? <Text style={styles.givenComment}>“{rating.comment}”</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    gap: spacing.md,
    ...shadow.card,
  },
  title: {
    ...typography.label,
    fontSize: 16,
    color: colors.primaryDark,
  },
  stars: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  starButton: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  starWord: {
    ...typography.label,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: -spacing.sm,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tag: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.white,
  },
  tagSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  tagText: {
    ...typography.label,
    color: colors.textSecondary,
  },
  tagTextSelected: {
    color: colors.primary,
  },
  comment: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  givenStars: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  givenTags: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  givenComment: {
    ...typography.body,
    color: colors.text,
    fontStyle: 'italic',
  },
});
