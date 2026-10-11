import React, { useEffect, useMemo } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  withDelay,
  Easing,
  interpolate,
} from 'react-native-reanimated';

interface CrystalBallProps {
  size?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Twinkling star
function Star({ delay, x, y, size: starSize }: { delay: number; x: number; y: number; size: number }) {
  const twinkle = useSharedValue(0);

  useEffect(() => {
    twinkle.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 1000 + Math.random() * 1000, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.2, { duration: 1000 + Math.random() * 1000, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      )
    );
  }, []);

  const starStyle = useAnimatedStyle(() => ({
    opacity: twinkle.value,
    transform: [{ scale: interpolate(twinkle.value, [0.2, 1], [0.5, 1.2]) }],
  }));

  return (
    <Animated.View
      style={[
        styles.star,
        { left: x, top: y, width: starSize, height: starSize, borderRadius: starSize / 2 },
        starStyle,
      ]}
    />
  );
}

// Diamond sparkle
function DiamondSparkle({ delay, x, y, size: sparkleSize }: { delay: number; x: number; y: number; size: number }) {
  const sparkle = useSharedValue(0);

  useEffect(() => {
    sparkle.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 200, easing: Easing.out(Easing.ease) }),
          withTiming(0, { duration: 200, easing: Easing.in(Easing.ease) }),
          withTiming(0, { duration: 1500 + Math.random() * 2000 })
        ),
        -1,
        false
      )
    );
  }, []);

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkle.value,
    transform: [{ scale: interpolate(sparkle.value, [0, 1], [0.3, 1]) }],
  }));

  return (
    <Animated.View
      style={[
        styles.diamondSparkle,
        { left: x, top: y, width: sparkleSize, height: sparkleSize },
        sparkleStyle,
      ]}
    >
      <View style={styles.sparkleCore} />
      <View style={[styles.sparkleRay, styles.rayH]} />
      <View style={[styles.sparkleRay, styles.rayV]} />
      <View style={[styles.sparkleRay, styles.rayD1]} />
      <View style={[styles.sparkleRay, styles.rayD2]} />
    </Animated.View>
  );
}

export function CrystalBall({ size = 280 }: CrystalBallProps) {
  const spin = useSharedValue(0);
  const float = useSharedValue(0);
  const glow = useSharedValue(0);

  const stars = useMemo(() => {
    const arr: { id: number; x: number; y: number; size: number; delay: number }[] = [];
    for (let i = 0; i < 50; i++) {
      arr.push({
        id: i,
        x: Math.random() * SCREEN_WIDTH,
        y: Math.random() * 450,
        size: Math.random() * 2.5 + 0.5,
        delay: Math.random() * 3000,
      });
    }
    return arr;
  }, []);

  // Sparkles positioned around the ball
  const sparkles = useMemo(() => {
    const arr: { id: number; x: number; y: number; size: number; delay: number }[] = [];
    const count = 12;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const radius = size * 0.42;
      arr.push({
        id: i,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        size: 14 + Math.random() * 8,
        delay: Math.random() * 3000,
      });
    }
    return arr;
  }, [size]);

  useEffect(() => {
    // Continuous rotation
    spin.value = withRepeat(
      withTiming(360, { duration: 8000, easing: Easing.linear }),
      -1,
      false
    );

    // Gentle floating
    float.value = withRepeat(
      withSequence(
        withTiming(-12, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(12, { duration: 2500, easing: Easing.inOut(Easing.ease) })
      ),
      -1,
      true
    );

    // Pulsing glow
    glow.value = withRepeat(
      withTiming(1, { duration: 3000, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value }],
  }));

  const spinStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${spin.value}deg` }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(glow.value, [0, 1], [0.3, 0.7]),
    transform: [{ scale: interpolate(glow.value, [0, 1], [1, 1.1]) }],
  }));

  return (
    <View style={styles.container}>
      {/* Starfield */}
      <View style={styles.starfield}>
        {stars.map((star) => (
          <Star key={star.id} delay={star.delay} x={star.x} y={star.y} size={star.size} />
        ))}
      </View>

      {/* Ball */}
      <Animated.View style={[styles.floatContainer, floatStyle]}>
        {/* Outer glow */}
        <Animated.View
          style={[
            styles.outerGlow,
            { width: size * 1.4, height: size * 1.4, borderRadius: size * 0.7 },
            glowStyle,
          ]}
        />

        {/* The ball image - clipped to perfect circle */}
        <Animated.View
          style={[
            styles.ballWrapper,
            { width: size, height: size, borderRadius: size / 2 },
            spinStyle
          ]}
        >
          <Animated.Image
            source={require('@/../assets/images/blackball.png')}
            style={{ width: size, height: size, borderRadius: size / 2 }}
            resizeMode="cover"
          />
        </Animated.View>

        {/* Sparkles rotating around the ball */}
        <Animated.View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }, spinStyle]}>
          {sparkles.map((s) => (
            <DiamondSparkle
              key={s.id}
              delay={s.delay}
              x={s.x}
              y={s.y}
              size={s.size}
            />
          ))}
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: 420,
  },
  starfield: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
  },
  star: {
    position: 'absolute',
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 3,
  },
  floatContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  outerGlow: {
    position: 'absolute',
    backgroundColor: 'rgba(100, 140, 200, 0.05)',
    shadowColor: '#5588cc',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 50,
  },
  ballWrapper: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 25 },
    shadowOpacity: 0.8,
    shadowRadius: 35,
    elevation: 30,
  },
  diamondSparkle: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkleCore: {
    position: 'absolute',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#fff',
    shadowColor: '#fff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 5,
  },
  sparkleRay: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  rayH: {
    width: 12,
    height: 2,
    borderRadius: 1,
  },
  rayV: {
    width: 2,
    height: 12,
    borderRadius: 1,
  },
  rayD1: {
    width: 8,
    height: 1.5,
    borderRadius: 1,
    transform: [{ rotate: '45deg' }],
  },
  rayD2: {
    width: 8,
    height: 1.5,
    borderRadius: 1,
    transform: [{ rotate: '-45deg' }],
  },
});
