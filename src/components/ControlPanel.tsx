import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';

import { colors, radius } from '../lib/theme';
import { DURATIONS, TRANSITIONS, type SlideshowSettings } from '../lib/types';

interface Props {
  settings: SlideshowSettings;
  onChangeSettings: (settings: SlideshowSettings) => void;
  paused: boolean;
  onTogglePause: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onExit: () => void;
  position: number;
  total: number;
  bottomInset: number;
  /** Called on every interaction so the panel's auto-hide timer restarts. */
  onInteract: () => void;
}

export function ControlPanel({
  settings,
  onChangeSettings,
  paused,
  onTogglePause,
  onPrevious,
  onNext,
  onExit,
  position,
  total,
  bottomInset,
  onInteract,
}: Props) {
  const [exitHint, setExitHint] = useState(false);

  const update = (patch: Partial<SlideshowSettings>) => {
    onInteract();
    onChangeSettings({ ...settings, ...patch });
  };

  const act = (action: () => void) => () => {
    onInteract();
    action();
  };

  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      exiting={FadeOut.duration(250)}
      style={[styles.panel, { marginBottom: 24 + bottomInset }]}
    >
      {/* Transport row */}
      <View style={styles.row}>
        <Text style={styles.counter}>
          {position} / {total}
        </Text>

        <View style={styles.transport}>
          <RoundButton label="Previous" onPress={act(onPrevious)}>
            <Text style={styles.chevron}>‹</Text>
          </RoundButton>
          <RoundButton label={paused ? 'Play' : 'Pause'} onPress={act(onTogglePause)} large>
            {paused ? <PlayIcon /> : <PauseIcon />}
          </RoundButton>
          <RoundButton label="Next" onPress={act(onNext)}>
            <Text style={styles.chevron}>›</Text>
          </RoundButton>
        </View>

        <Pressable
          onPress={() => {
            onInteract();
            setExitHint(true);
          }}
          onLongPress={onExit}
          delayLongPress={700}
          style={({ pressed }) => [styles.exit, pressed && styles.exitPressed]}
          accessibilityLabel="Exit slideshow, press and hold"
        >
          <Text style={styles.exitText}>{exitHint ? 'Press and hold to exit' : 'Exit'}</Text>
        </Pressable>
      </View>

      <Group title="Time per photo">
        {DURATIONS.map((seconds) => (
          <Chip
            key={seconds}
            label={`${seconds} s`}
            selected={settings.durationSeconds === seconds}
            onPress={() => update({ durationSeconds: seconds })}
          />
        ))}
      </Group>

      <Group title="Transition">
        {TRANSITIONS.map((transition) => (
          <Chip
            key={transition.id}
            label={transition.label}
            selected={settings.transition === transition.id}
            onPress={() => update({ transition: transition.id })}
          />
        ))}
      </Group>

      <Group title="Playback">
        <Chip label="Loop" selected={settings.loop} onPress={() => update({ loop: true })} />
        <Chip label="Play once" selected={!settings.loop} onPress={() => update({ loop: false })} />
        <View style={styles.divider} />
        <Chip label="In order" selected={!settings.shuffle} onPress={() => update({ shuffle: false })} />
        <Chip label="Shuffle" selected={settings.shuffle} onPress={() => update({ shuffle: true })} />
      </Group>
    </Animated.View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityState={{ selected }}
      style={({ pressed }) => [styles.chip, selected && styles.chipSelected, pressed && styles.pressed]}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function RoundButton({
  label,
  onPress,
  large = false,
  children,
}: {
  label: string;
  onPress: () => void;
  large?: boolean;
  children: ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.round, large && styles.roundLarge, pressed && styles.pressed]}
    >
      {children}
    </Pressable>
  );
}

function PlayIcon() {
  return <View style={styles.playTriangle} />;
}

function PauseIcon() {
  return (
    <View style={styles.pauseIcon}>
      <View style={styles.pauseBar} />
      <View style={styles.pauseBar} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    alignSelf: 'center',
    width: '92%',
    maxWidth: 900,
    backgroundColor: 'rgba(20, 20, 23, 0.92)',
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 28,
    paddingVertical: 22,
    gap: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  counter: { color: colors.textMuted, fontSize: 16, fontVariant: ['tabular-nums'], minWidth: 120 },
  transport: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  round: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roundLarge: { width: 68, height: 68, borderRadius: 34, backgroundColor: colors.accent },
  chevron: { color: colors.text, fontSize: 34, lineHeight: 38, marginTop: -4 },
  playTriangle: {
    marginLeft: 6,
    width: 0,
    height: 0,
    borderTopWidth: 13,
    borderBottomWidth: 13,
    borderLeftWidth: 22,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
    borderLeftColor: colors.accentText,
  },
  pauseIcon: { flexDirection: 'row', gap: 7 },
  pauseBar: { width: 7, height: 24, borderRadius: 2, backgroundColor: colors.accentText },
  exit: {
    minWidth: 120,
    alignItems: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: radius.sm,
  },
  exitPressed: { backgroundColor: 'rgba(255, 107, 94, 0.15)' },
  exitText: { color: colors.danger, fontSize: 16, fontWeight: '600' },
  group: { gap: 10 },
  groupTitle: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceRaised,
  },
  chipSelected: { backgroundColor: colors.text },
  chipText: { color: colors.text, fontSize: 15, fontWeight: '500' },
  chipTextSelected: { color: colors.background, fontWeight: '700' },
  divider: { width: 1, height: 24, backgroundColor: colors.border, marginHorizontal: 8 },
  pressed: { opacity: 0.7 },
});
