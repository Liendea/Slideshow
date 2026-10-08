import { Image } from 'expo-image';
import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import type { TransitionType } from '../lib/types';

export type LayerRole = 'previous' | 'current' | 'next';

interface Props {
  uri: string;
  role: LayerRole;
  transition: TransitionType;
  transitionMs: number;
  /** 1 = moving forward, -1 = moving back. Decides which side a horizontal slide comes from. */
  direction: 1 | -1;
  width: number;
  height: number;
  /** How long the image is on screen, used for the Ken Burns zoom. */
  kenBurnsMs: number;
  paused: boolean;
  /** Alternates the Ken Burns pan direction between images. */
  panSign: 1 | -1;
  onError: () => void;
}

const KEN_BURNS_SCALE = 0.12;
const KEN_BURNS_PAN = 0.03;
const EASE = Easing.inOut(Easing.cubic);

/**
 * One image in the stack. Each layer owns its own enter/exit progress, so a layer that becomes
 * "current" always starts from its hidden state (no one-frame flash when roles swap).
 */
export function SlideLayer({
  uri,
  role,
  transition,
  transitionMs,
  direction,
  width,
  height,
  kenBurnsMs,
  paused,
  panSign,
  onError,
}: Props) {
  const enter = useSharedValue(0);
  const exit = useSharedValue(0);
  const kenBurns = useSharedValue(0);

  useEffect(() => {
    const duration = transition === 'none' ? 0 : transitionMs;
    if (role === 'current') {
      exit.set(0);
      enter.set(withTiming(1, { duration, easing: EASE }));
    } else if (role === 'previous') {
      exit.set(withTiming(1, { duration, easing: EASE }));
    } else {
      enter.set(0);
      exit.set(0);
      kenBurns.set(0);
    }
  }, [enter, exit, kenBurns, role, transition, transitionMs]);

  // Slow Ken Burns zoom while this layer is the visible image; pauses with the slideshow.
  const kenBurnsRunning = transition === 'kenBurns' && role === 'current' && !paused;
  useEffect(() => {
    if (!kenBurnsRunning) {
      cancelAnimation(kenBurns);
      return;
    }
    const remaining = Math.max(0, (1 - kenBurns.get()) * kenBurnsMs);
    kenBurns.set(withTiming(1, { duration: remaining, easing: Easing.linear }));
  }, [kenBurns, kenBurnsMs, kenBurnsRunning]);

  const animatedStyle = useAnimatedStyle(() => {
    if (role === 'next') {
      // Rendered invisibly so the image is already decoded when it is needed.
      return { opacity: 0, transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }] };
    }

    const incoming = role === 'current';
    const p = incoming ? enter.get() : exit.get();

    switch (transition) {
      case 'none':
        return {
          opacity: incoming ? 1 : 0,
          transform: [{ translateX: 0 }, { translateY: 0 }, { scale: 1 }],
        };
      case 'slideHorizontal':
        return {
          opacity: 1,
          transform: [
            { translateX: incoming ? (1 - p) * width * direction : -p * width * direction },
            { translateY: 0 },
            { scale: 1 },
          ],
        };
      case 'slideVertical':
        return {
          opacity: 1,
          transform: [
            { translateX: 0 },
            { translateY: incoming ? -(1 - p) * height : p * height },
            { scale: 1 },
          ],
        };
      case 'zoom':
        return {
          opacity: incoming ? p : 1 - p,
          transform: [
            { translateX: 0 },
            { translateY: 0 },
            { scale: incoming ? 1.15 - 0.15 * p : 1 - 0.08 * p },
          ],
        };
      case 'dissolve':
      case 'kenBurns': {
        const kb = transition === 'kenBurns' ? kenBurns.get() : 0;
        return {
          opacity: incoming ? p : 1 - p,
          transform: [
            { translateX: kb * KEN_BURNS_PAN * width * panSign },
            { translateY: 0 },
            { scale: 1 + kb * KEN_BURNS_SCALE },
          ],
        };
      }
    }
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]} pointerEvents="none">
      <Image
        source={uri}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        transition={0}
        priority={role === 'next' ? 'low' : 'high'}
        onError={onError}
      />
    </Animated.View>
  );
}
