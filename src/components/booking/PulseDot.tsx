import { colors } from '@/constants/theme';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

interface PulseDotProps {
  color?: string;
  size?: number;
  /** When false, the dot is shown still. */
  animated?: boolean;
}

/** Status dot with a soft ring that pulses outward while something is in progress. */
export function PulseDot({ color = colors.primary, size = 14, animated = true }: PulseDotProps) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animated) {
      progress.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: 1400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [animated, progress]);

  const ringStyle = {
    width: size,
    height: size,
    borderRadius: size / 2,
    backgroundColor: color,
    opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
    transform: [{ scale: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 2.6] }) }],
  };

  return (
    <View style={[styles.wrap, { width: size * 2.6, height: size * 2.6 }]}>
      {animated ? <Animated.View style={[styles.ring, ringStyle]} /> : null}
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
  },
});
