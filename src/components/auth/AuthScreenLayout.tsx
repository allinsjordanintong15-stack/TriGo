import logo from '../../../assets/images/logo.png';
import { colors, radius, shadow, spacing, typography } from '@/constants/theme';
import { ReactNode } from 'react';
import { Image, KeyboardAvoidingView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const TAGLINE = 'Ride around Trinidad, Bohol';
const LOGO_SIZE = 88;

interface AuthScreenLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthScreenLayout({
  title,
  subtitle,
  children,
  footer,
}: AuthScreenLayoutProps) {
  const insets = useSafeAreaInsets();

  return (
    // Android is edge-to-edge, so the window no longer resizes for the keyboard;
    // padding on both platforms keeps the submit button scrollable into view.
    <KeyboardAvoidingView style={styles.flex} behavior="padding">
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.brand}>
          <Image
            source={logo}
            style={styles.logo}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
            accessible={false}
          />
          <Text style={styles.wordmark}>TriGo</Text>
          <View style={styles.brandAccent} />
          <Text style={styles.tagline}>{TAGLINE}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
        </View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: spacing.lg,
  },
  brand: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logo: {
    // logo.png is square, so equal sides keep its aspect ratio.
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginBottom: spacing.sm,
  },
  wordmark: {
    ...typography.display,
    color: colors.primary,
  },
  brandAccent: {
    width: 40,
    height: 4,
    borderRadius: radius.sm,
    backgroundColor: colors.gold,
    marginVertical: spacing.sm,
  },
  tagline: {
    ...typography.subtitle,
    color: colors.textSecondary,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadow.card,
  },
  title: {
    ...typography.title,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: spacing.lg,
  },
  footer: {
    marginTop: spacing.lg,
    alignItems: 'center',
  },
});
