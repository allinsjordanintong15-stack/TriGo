import { Ionicons } from '@expo/vector-icons';
import { colors, spacing, typography } from '@/constants/theme';
import { router } from 'expo-router';
import { ReactNode } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import logo from '../../../assets/images/logo.png';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const BRAND_LOGO_SIZE = 30;

interface TitleHeaderProps {
  brand?: false;
  title: string;
  onBack?: () => void;
  right?: ReactNode;
  /**
   * Optional: a right element wider than 48 dp (e.g. a chip). Both sides then share the
   * space left by the title equally, so the title stays centred. Off by default.
   */
  wideRight?: boolean;
}

/**
 * Brand mode for main tab screens: logo + "TriGo" on the left, the right slot on the
 * right, no back button and no centred title.
 */
interface BrandHeaderProps {
  brand: true;
  right?: ReactNode;
}

type ScreenHeaderProps = TitleHeaderProps | BrandHeaderProps;

export function ScreenHeader(props: ScreenHeaderProps) {
  if (props.brand) {
    return <BrandHeader right={props.right} />;
  }
  return <TitleHeader {...props} />;
}

function BrandHeader({ right }: { right?: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={[styles.row, styles.brandRow]}>
        <View style={styles.brand} accessible accessibilityRole="header" accessibilityLabel="TriGo">
          {/* logo.png is square, so equal sides keep its aspect ratio. */}
          <Image source={logo} style={styles.brandLogo} resizeMode="contain" />
          <Text style={styles.brandName} numberOfLines={1}>
            TriGo
          </Text>
        </View>
        <View style={styles.brandRight}>{right}</View>
      </View>
    </View>
  );
}

function TitleHeader({ title, onBack, right, wideRight = false }: TitleHeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.md }]}>
      <View style={styles.row}>
        <View style={wideRight ? styles.sideWide : null}>
          {onBack ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Go back"
              style={styles.back}
              hitSlop={4}
              onPress={onBack}
            >
              <Ionicons name="chevron-back" color={colors.primary} size={26} />
            </Pressable>
          ) : (
            <View style={styles.backPlaceholder} />
          )}
        </View>
        <Text style={[styles.title, wideRight ? styles.titleWide : null]} numberOfLines={1}>
          {title}
        </Text>
        <View style={wideRight ? [styles.sideWide, styles.rightWide] : styles.right}>{right}</View>
      </View>
    </View>
  );
}

export function useScreenBack() {
  return () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/home');
    }
  };
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingBottom: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  back: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
  },
  backPlaceholder: {
    width: 48,
    marginRight: spacing.xs,
  },
  title: {
    ...typography.title,
    fontSize: 22,
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  right: {
    width: 48,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // wideRight: left and right take equal shares of the free space; the title its own width.
  sideWide: {
    flex: 1,
    flexBasis: 0,
    minWidth: 48,
  },
  titleWide: {
    flex: 0,
    flexShrink: 1,
    marginHorizontal: spacing.sm,
  },
  rightWide: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  // Brand mode: same 48 dp row height as the back-button header.
  brandRow: {
    minHeight: 48,
  },
  brand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexShrink: 0,
  },
  brandLogo: {
    width: BRAND_LOGO_SIZE,
    height: BRAND_LOGO_SIZE,
  },
  brandName: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primaryDark,
  },
  // Takes the rest of the row so a wide chip shrinks instead of overlapping the brand.
  brandRight: {
    flex: 1,
    minWidth: 0,
    marginLeft: spacing.md,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
});
