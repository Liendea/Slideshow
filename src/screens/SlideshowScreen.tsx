import { useKeepAwake } from 'expo-keep-awake';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ControlPanel } from '../components/ControlPanel';
import { SlideLayer, type LayerRole } from '../components/SlideLayer';
import { nextShuffleRound, sequentialOrder, shuffledOrder } from '../lib/order';
import { colors } from '../lib/theme';
import type { Slide, SlideshowSettings } from '../lib/types';

interface Props {
  slides: Slide[];
  settings: SlideshowSettings;
  onChangeSettings: (settings: SlideshowSettings) => void;
  onExit: () => void;
}

interface PlayState {
  /** Indices into `slides`, in the order they are shown. */
  order: number[];
  /** Position in `order` of the image on screen. */
  pos: number;
  /** Slide index that is transitioning out, if any. */
  previous: number | null;
  direction: 1 | -1;
  /** Number of image changes so far; alternates the Ken Burns pan direction. */
  changes: number;
}

const TRANSITION_MS = 900;
const PANEL_AUTO_HIDE_MS = 8000;

export function SlideshowScreen({ slides, settings, onChangeSettings, onExit }: Props) {
  useKeepAwake();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const count = slides.length;

  const [state, setState] = useState<PlayState>(() => ({
    order: settings.shuffle ? shuffledOrder(count) : sequentialOrder(count),
    pos: 0,
    previous: null,
    direction: 1,
    changes: 0,
  }));
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(false);
  const [interactions, setInteractions] = useState(0);
  const [allFailed, setAllFailed] = useState(false);
  const failedKeys = useRef(new Set<string>());

  const displayMs = settings.durationSeconds * 1000;
  const currentIndex = state.order[state.pos] ?? 0;
  const atEnd = state.pos === count - 1;

  const go = useCallback(
    (direction: 1 | -1) => {
      setState((s) => {
        if (count <= 1) return s;
        const current = s.order[s.pos] ?? 0;
        let pos = s.pos + direction;
        let order = s.order;
        if (pos >= count) {
          if (!settings.loop) return s;
          order = settings.shuffle ? nextShuffleRound(count, current) : s.order;
          pos = 0;
        } else if (pos < 0) {
          if (!settings.loop) return s;
          pos = count - 1;
        }
        return { order, pos, previous: current, direction, changes: s.changes + 1 };
      });
    },
    [count, settings.loop, settings.shuffle],
  );

  const restart = useCallback(() => {
    setState((s) => ({
      order: settings.shuffle ? nextShuffleRound(count, s.order[s.pos] ?? 0) : sequentialOrder(count),
      pos: 0,
      previous: s.order[s.pos] ?? null,
      direction: 1,
      changes: s.changes + 1,
    }));
  }, [count, settings.shuffle]);

  // Auto-advance. The timer restarts whenever the image, pause state or timing changes.
  useEffect(() => {
    if (paused || count <= 1) return;
    const timeout = setTimeout(() => {
      if (!settings.loop && atEnd) {
        setPaused(true); // "Play once" finished: stay on the last image.
      } else {
        go(1);
      }
    }, displayMs + TRANSITION_MS);
    return () => clearTimeout(timeout);
  }, [atEnd, count, displayMs, go, paused, settings.loop, state.pos, state.order]);

  // Switching shuffle on/off keeps the current image on screen and reorders the rest.
  const shuffleRef = useRef(settings.shuffle);
  useEffect(() => {
    if (shuffleRef.current === settings.shuffle) return;
    shuffleRef.current = settings.shuffle;
    setState((s) => {
      const current = s.order[s.pos] ?? 0;
      return settings.shuffle
        ? { ...s, order: shuffledOrder(count, current), pos: 0 }
        : { ...s, order: sequentialOrder(count), pos: current };
    });
  }, [count, settings.shuffle]);

  // Hide the control panel after a while without interaction.
  useEffect(() => {
    if (!controlsVisible) return;
    const timeout = setTimeout(() => setControlsVisible(false), PANEL_AUTO_HIDE_MS);
    return () => clearTimeout(timeout);
  }, [controlsVisible, interactions]);

  const touch = useCallback(() => setInteractions((n) => n + 1), []);

  const togglePause = () => {
    if (paused && !settings.loop && atEnd) {
      restart();
    }
    setPaused((p) => !p);
  };

  const handleError = (slide: Slide) => {
    failedKeys.current.add(slide.key);
    if (failedKeys.current.size >= count) {
      setAllFailed(true);
    } else {
      go(1);
    }
  };

  // ---------- Layers: outgoing, visible, and the next image preloading invisibly ----------
  const nextIndex =
    state.pos + 1 < count
      ? state.order[state.pos + 1]
      : settings.loop && !settings.shuffle
        ? state.order[0]
        : undefined;

  const layers: { index: number; role: LayerRole }[] = [];
  if (state.previous !== null && state.previous !== currentIndex) {
    layers.push({ index: state.previous, role: 'previous' });
  }
  layers.push({ index: currentIndex, role: 'current' });
  if (nextIndex !== undefined && nextIndex !== currentIndex && nextIndex !== state.previous) {
    layers.push({ index: nextIndex, role: 'next' });
  }

  return (
    <View style={styles.root}>
      <StatusBar hidden />

      {layers.map(({ index, role }) => {
        const slide = slides[index];
        if (!slide) return null;
        return (
          <SlideLayer
            key={slide.key}
            uri={slide.uri}
            role={role}
            transition={settings.transition}
            transitionMs={TRANSITION_MS}
            direction={state.direction}
            width={width}
            height={height}
            kenBurnsMs={displayMs + TRANSITION_MS}
            paused={paused}
            panSign={state.changes % 2 === 0 ? 1 : -1}
            onError={() => {
              if (role === 'current') handleError(slide);
            }}
          />
        );
      })}

      {allFailed && (
        <View style={styles.center} pointerEvents="none">
          <Text style={styles.message}>The photos couldn’t be displayed.</Text>
        </View>
      )}

      {/* Tap anywhere to show/hide the controls */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => {
          setControlsVisible((visible) => !visible);
          touch();
        }}
        accessibilityLabel="Show controls"
      />

      {paused && !controlsVisible && (
        <View style={[styles.pausedBadge, { top: 20 + insets.top }]} pointerEvents="none">
          <Text style={styles.pausedText}>Paused</Text>
        </View>
      )}

      {controlsVisible && (
        <View style={styles.panelContainer} pointerEvents="box-none">
          <ControlPanel
            settings={settings}
            onChangeSettings={onChangeSettings}
            paused={paused}
            onTogglePause={togglePause}
            onPrevious={() => go(-1)}
            onNext={() => go(1)}
            onExit={onExit}
            position={state.pos + 1}
            total={count}
            bottomInset={insets.bottom}
            onInteract={touch}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000', overflow: 'hidden' },
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  message: { color: colors.textMuted, fontSize: 18 },
  panelContainer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, justifyContent: 'flex-end' },
  pausedBadge: {
    position: 'absolute',
    left: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  pausedText: { color: colors.text, fontSize: 14, fontWeight: '600' },
});
